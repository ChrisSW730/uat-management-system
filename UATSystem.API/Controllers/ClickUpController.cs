using System.Net;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UATSystem.API.Data;
using UATSystem.API.Models;

namespace UATSystem.API.Controllers;

[ApiController]
[Route("[controller]")]
[Authorize]
public class ClickUpController : ControllerBase
{
    private static readonly HashSet<string> SystemClickUpFieldIds = new(StringComparer.OrdinalIgnoreCase)
    {
        "name",
        "description",
        "status",
        "priority",
        "assignees",
        "due_date",
        "start_date",
        "tags",
    };

    private readonly UATDbContext _db;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IDataProtector _protector;

    public ClickUpController(UATDbContext db, IHttpClientFactory httpClientFactory, IDataProtectionProvider dataProtectionProvider)
    {
        _db = db;
        _httpClientFactory = httpClientFactory;
        _protector = dataProtectionProvider.CreateProtector("ClickUpIntegration");
    }

    [HttpGet("integration")]
    public async Task<IActionResult> GetIntegration()
    {
        var user = await GetCurrentUserAsync();
        if (user == null) return Unauthorized();

        var parsedConfig = ParseConfiguration(user.ClickUpMappingsJson);
        return Ok(new ClickUpIntegrationStateDto(
            user.ClickUpIntegrationEnabled,
            user.ClickUpValidationStatus,
            ToWorkspaceDto(user.ClickUpWorkspaceId, user.ClickUpWorkspaceName),
            ToWorkspaceDto(user.ClickUpSpaceId, user.ClickUpSpaceName),
            parsedConfig.List,
            parsedConfig.CustomItem,
            parsedConfig.Mappings,
            !string.IsNullOrWhiteSpace(user.ClickUpApiTokenEncrypted),
            parsedConfig.FieldMappings,
            parsedConfig.StatusMappings,
            parsedConfig.PriorityMappings,
            parsedConfig.CustomFieldValueMappings,
            parsedConfig.SyncStatus));
    }

    [HttpPost("validate")]
    public async Task<IActionResult> Validate([FromBody] ClickUpValidateRequest request)
    {
        var user = await GetCurrentUserAsync();
        if (user == null) return Unauthorized();

        var token = request.Token?.Trim();
        if (string.IsNullOrWhiteSpace(token))
        {
            user.ClickUpValidationStatus = "invalid";
            user.ClickUpIntegrationEnabled = false;
            user.ClickUpWorkspaceId = null;
            user.ClickUpWorkspaceName = null;
            user.ClickUpSpaceId = null;
            user.ClickUpSpaceName = null;
            user.ClickUpMappingsJson = null;
            user.ClickUpApiTokenEncrypted = null;
            await _db.SaveChangesAsync();
            return BadRequest("A ClickUp API token is required.");
        }

        var userResponse = await CallClickUpAsync("/user", token);
        if (!userResponse.IsSuccessStatusCode)
        {
            user.ClickUpValidationStatus = "invalid";
            user.ClickUpIntegrationEnabled = false;
            user.ClickUpWorkspaceId = null;
            user.ClickUpWorkspaceName = null;
            user.ClickUpSpaceId = null;
            user.ClickUpSpaceName = null;
            user.ClickUpMappingsJson = null;
            user.ClickUpApiTokenEncrypted = null;
            await _db.SaveChangesAsync();
            return await BuildClickUpErrorResponse(userResponse, "validate", "We could not validate your ClickUp connection.");
        }

        var workspaces = await LoadWorkspacesAsync(token);

        return Ok(new ClickUpValidationResultDto(
            true,
            "valid",
            workspaces.Select(w => new ClickUpWorkspaceDto(w.Id, w.Name)).ToList(),
            false));
    }

    [HttpGet("workspaces")]
    public async Task<IActionResult> GetWorkspaces([FromHeader(Name = "X-ClickUp-Token")] string? token)
    {
        var user = await GetCurrentUserAsync();
        if (user == null) return Unauthorized();

        var effectiveToken = NormalizeToken(token) ?? GetStoredToken(user);
        if (string.IsNullOrWhiteSpace(effectiveToken))
        {
            return BadRequest("No ClickUp token is configured for this user.");
        }

        var workspaces = await LoadWorkspacesAsync(effectiveToken);
        return Ok(workspaces.Select(w => new ClickUpWorkspaceDto(w.Id, w.Name)).ToList());
    }

    [HttpGet("workspaces/{workspaceId}/spaces")]
    public async Task<IActionResult> GetSpaces(string workspaceId, [FromHeader(Name = "X-ClickUp-Token")] string? token)
    {
        var user = await GetCurrentUserAsync();
        if (user == null) return Unauthorized();

        var effectiveToken = NormalizeToken(token) ?? GetStoredToken(user);
        if (string.IsNullOrWhiteSpace(effectiveToken))
        {
            return BadRequest("No ClickUp token is configured for this user.");
        }

        var response = await CallClickUpAsync($"/team/{workspaceId}/space", effectiveToken);
        if (!response.IsSuccessStatusCode)
        {
            return await BuildClickUpErrorResponse(response, "spaces", "We could not load ClickUp spaces.");
        }

        var payload = await response.Content.ReadFromJsonAsync<ClickUpSpacesApiResponse>();
        var spaces = payload?.Spaces?.Select(space => new ClickUpWorkspaceDto(space.Id, space.Name)).ToList() ?? new List<ClickUpWorkspaceDto>();
        return Ok(spaces);
    }

    [HttpGet("workspaces/{workspaceId}/spaces/{spaceId}/metadata")]
    public async Task<IActionResult> GetSpaceMetadata(string workspaceId, string spaceId, [FromQuery] string? listId, [FromHeader(Name = "X-ClickUp-Token")] string? token)
    {
        _ = listId;

        var user = await GetCurrentUserAsync();
        if (user == null) return Unauthorized();

        var effectiveToken = NormalizeToken(token) ?? GetStoredToken(user);
        if (string.IsNullOrWhiteSpace(effectiveToken))
        {
            return BadRequest("No ClickUp token is configured for this user.");
        }

        var fields = await LoadCustomFieldsAsync(spaceId, effectiveToken);
        var statuses = await LoadStatusesFromFoldersAsync(spaceId, effectiveToken);
        var priorities = await LoadPrioritiesFromWorkspaceSpacesAsync(workspaceId, effectiveToken);

        return Ok(new ClickUpSpaceMetadataDto(fields, statuses, priorities));
    }

    [HttpGet("workspaces/{workspaceId}/spaces/{spaceId}/lists")]
    public async Task<IActionResult> GetLists(string workspaceId, string spaceId, [FromQuery] string? folderId, [FromHeader(Name = "X-ClickUp-Token")] string? token)
    {
        var user = await GetCurrentUserAsync();
        if (user == null) return Unauthorized();

        var effectiveToken = NormalizeToken(token) ?? GetStoredToken(user);
        if (string.IsNullOrWhiteSpace(effectiveToken))
        {
            return BadRequest("No ClickUp token is configured for this user.");
        }

        var lists = new List<ClickUpWorkspaceDto>();

        if (!string.IsNullOrWhiteSpace(folderId))
        {
            var folderListsResponse = await CallClickUpAsync($"/folder/{folderId}/list", effectiveToken);
            if (folderListsResponse.IsSuccessStatusCode)
            {
                var payload = await folderListsResponse.Content.ReadFromJsonAsync<JsonElement>();
                lists.AddRange(ParseLists(payload));
            }
        }
        else
        {
            var folderResponse = await CallClickUpAsync($"/space/{spaceId}/folder", effectiveToken);
            if (folderResponse.IsSuccessStatusCode)
            {
                var folderPayload = await folderResponse.Content.ReadFromJsonAsync<JsonElement>();
                foreach (var folder in ParseWorkspaceItems(folderPayload, "folders"))
                {
                    var folderListsResponse = await CallClickUpAsync($"/folder/{folder.Id}/list", effectiveToken);
                    if (!folderListsResponse.IsSuccessStatusCode) continue;

                    var folderListPayload = await folderListsResponse.Content.ReadFromJsonAsync<JsonElement>();
                    lists.AddRange(ParseLists(folderListPayload));
                }
            }

            var directListsResponse = await CallClickUpAsync($"/space/{spaceId}/list", effectiveToken);
            if (directListsResponse.IsSuccessStatusCode)
            {
                var directPayload = await directListsResponse.Content.ReadFromJsonAsync<JsonElement>();
                lists.AddRange(ParseLists(directPayload));
            }
        }

        return Ok(lists
            .Where(l => !string.IsNullOrWhiteSpace(l.Id))
            .DistinctBy(l => l.Id)
            .OrderBy(l => l.Name, StringComparer.OrdinalIgnoreCase)
            .ToList());
    }

    [HttpGet("workspaces/{workspaceId}/custom-items")]
    public async Task<IActionResult> GetCustomItems(string workspaceId, [FromHeader(Name = "X-ClickUp-Token")] string? token)
    {
        var user = await GetCurrentUserAsync();
        if (user == null) return Unauthorized();

        var effectiveToken = NormalizeToken(token) ?? GetStoredToken(user);
        if (string.IsNullOrWhiteSpace(effectiveToken))
        {
            return BadRequest("No ClickUp token is configured for this user.");
        }

        var response = await CallClickUpAsync($"/team/{workspaceId}/custom_item", effectiveToken);
        if (!response.IsSuccessStatusCode)
        {
            return await BuildClickUpErrorResponse(response, "custom-items", "We could not load ClickUp custom item types.");
        }

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        return Ok(ParseCustomItems(payload));
    }

    [HttpGet("lists/{listId}/tasks")]
    public async Task<IActionResult> GetListTasks(string listId, [FromHeader(Name = "X-ClickUp-Token")] string? token)
    {
        var user = await GetCurrentUserAsync();
        if (user == null) return Unauthorized();

        var effectiveToken = NormalizeToken(token) ?? GetStoredToken(user);
        if (string.IsNullOrWhiteSpace(effectiveToken))
        {
            return BadRequest("No ClickUp token is configured for this user.");
        }

        var response = await CallClickUpAsync($"/list/{listId}/task?page=0", effectiveToken);
        if (!response.IsSuccessStatusCode)
        {
            return await BuildClickUpErrorResponse(response, "list-tasks", "We could not load ClickUp tasks for this list.");
        }

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        return Ok(ParseTasks(payload));
    }

    [HttpPut("integration")]
    public async Task<IActionResult> SaveIntegration([FromBody] ClickUpIntegrationRequest request)
    {
        var user = await GetCurrentUserAsync();
        if (user == null) return Unauthorized();

        var saveToken = NormalizeToken(request.Token) ?? GetStoredToken(user);
        if (string.IsNullOrWhiteSpace(saveToken))
        {
            return BadRequest("Please provide a ClickUp API token before saving the integration settings.");
        }

        var saveValidationResponse = await CallClickUpAsync("/user", saveToken);
        if (!saveValidationResponse.IsSuccessStatusCode)
        {
            return await BuildClickUpErrorResponse(saveValidationResponse, "integration", "We could not validate your ClickUp connection.");
        }

        if (request.Enabled && (string.IsNullOrWhiteSpace(request.Workspace?.Id) || string.IsNullOrWhiteSpace(request.Space?.Id)))
        {
            return BadRequest("Please validate the connection and select a workspace and space before enabling ClickUp Integration.");
        }

        var validationErrors = ValidateIntegrationMappings(request);
        if (validationErrors.Count > 0)
        {
            return BadRequest(new
            {
                message = "Please resolve the ClickUp mapping validation issues before saving.",
                errors = validationErrors,
            });
        }

        await using var transaction = await _db.Database.BeginTransactionAsync();

        var payload = BuildConfigurationPayload(request.List, request.CustomItem, request.Mappings, request.FieldMappings, request.StatusMappings, request.PriorityMappings, request.CustomFieldValueMappings, request.SyncStatus ?? true);

        user.ClickUpApiTokenEncrypted = _protector.Protect(saveToken);
        user.ClickUpIntegrationEnabled = request.Enabled;
        user.ClickUpValidationStatus = request.Enabled ? "valid" : (string.IsNullOrWhiteSpace(user.ClickUpValidationStatus) ? "not-validated" : user.ClickUpValidationStatus);
        user.ClickUpWorkspaceId = request.Workspace?.Id;
        user.ClickUpWorkspaceName = request.Workspace?.Name;
        user.ClickUpSpaceId = request.Space?.Id;
        user.ClickUpSpaceName = request.Space?.Name;
        user.ClickUpMappingsJson = JsonSerializer.Serialize(payload);
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await transaction.CommitAsync();

        var parsedConfig = ParseConfiguration(user.ClickUpMappingsJson);
        return Ok(new ClickUpIntegrationStateDto(
            user.ClickUpIntegrationEnabled,
            user.ClickUpValidationStatus,
            ToWorkspaceDto(user.ClickUpWorkspaceId, user.ClickUpWorkspaceName),
            ToWorkspaceDto(user.ClickUpSpaceId, user.ClickUpSpaceName),
            parsedConfig.List,
            parsedConfig.CustomItem,
            parsedConfig.Mappings,
            true,
            parsedConfig.FieldMappings,
            parsedConfig.StatusMappings,
            parsedConfig.PriorityMappings,
            parsedConfig.CustomFieldValueMappings,
            parsedConfig.SyncStatus));
    }

    [HttpPost("defects/{defectId:int}/sync")]
    public async Task<IActionResult> SyncDefectToClickUp(int defectId, [FromBody] ClickUpDefectSyncRequest request)
    {
        var user = await GetCurrentUserAsync();
        if (user == null) return Unauthorized();

        if (!user.ClickUpIntegrationEnabled)
        {
            return BadRequest("ClickUp integration is disabled.");
        }

        var token = GetStoredToken(user);
        if (string.IsNullOrWhiteSpace(token))
        {
            return BadRequest("No ClickUp token is configured for this user.");
        }

        var config = ParseConfiguration(user.ClickUpMappingsJson);
        ClickUpWorkspaceDto? targetList;
        var requestedListId = NormalizeToken(request.ListId);
        if (!string.IsNullOrWhiteSpace(requestedListId))
        {
            targetList = new ClickUpWorkspaceDto(requestedListId, string.Empty);
        }
        else
        {
            targetList = config.List;
        }

        if (string.IsNullOrWhiteSpace(targetList?.Id))
        {
            if (string.IsNullOrWhiteSpace(user.ClickUpSpaceId))
            {
                return BadRequest("ClickUp integration is not configured. Please select workspace and space in Settings.");
            }

            var resolvedLists = await LoadListsForSpaceAsync(user.ClickUpSpaceId, token);
            targetList = resolvedLists.FirstOrDefault();
            if (targetList == null || string.IsNullOrWhiteSpace(targetList.Id))
            {
                return BadRequest("No destination ClickUp list is available for the selected ClickUp space.");
            }
        }

        var defect = await _db.Defects.FirstOrDefaultAsync(d => d.Id == defectId);
        if (defect == null)
        {
            return NotFound("Defect not found.");
        }

        var targetCustomItemId = NormalizeToken(request.CustomItemId)
            ?? NormalizeToken(config.CustomItem?.Id)
            ?? NormalizeToken(defect.ClickUpCustomItemId);
        if (string.IsNullOrWhiteSpace(targetCustomItemId) && string.IsNullOrWhiteSpace(defect.ClickUpTaskId))
        {
            return BadRequest("No ClickUp custom item type is configured.");
        }

        var targetTaskName = string.IsNullOrWhiteSpace(defect.Title) ? defect.DefectNumber : defect.Title;
        var normalizedParentTaskId = NormalizeToken(request.ParentTaskId);
        var configuredFieldMappings = BuildConfiguredFieldMappings(config);
        var assigneeSource = ResolveConfiguredPeekQaFieldValue(defect, configuredFieldMappings, "assignees") ?? defect.AssignedTo;
        var assignees = await ResolveAssigneesAsync(assigneeSource, user.ClickUpWorkspaceId, token);
        var effectiveCustomItemId = targetCustomItemId ?? string.Empty;
        var createTaskPayload = BuildCreateTaskPayload(defect, config, configuredFieldMappings, normalizedParentTaskId, assignees, effectiveCustomItemId);
        var selectedListName = !string.IsNullOrWhiteSpace(targetList.Name) ? targetList.Name : targetList.Id;
        var selectedCustomItemName = string.IsNullOrWhiteSpace(effectiveCustomItemId)
            ? (config.CustomItem?.Name ?? defect.ClickUpCustomItemName ?? string.Empty)
            : await ResolveCustomItemNameAsync(user.ClickUpWorkspaceId, effectiveCustomItemId, token, config.CustomItem?.Name ?? defect.ClickUpCustomItemName);

        if (!string.IsNullOrWhiteSpace(defect.ClickUpTaskId))
        {
            // Fetch current ClickUp task to resolve status conflicts based on timestamps
            var currentTaskResponse = await CallClickUpAsync($"/task/{defect.ClickUpTaskId}", token);
            if (currentTaskResponse.IsSuccessStatusCode)
            {
                var currentTaskJson = await currentTaskResponse.Content.ReadFromJsonAsync<JsonElement>();
                var clickStatus = GetTaskStatusFromTask(currentTaskJson);
                var clickUpdatedAt = GetTaskLastUpdatedUtc(currentTaskJson);

                if (!string.IsNullOrWhiteSpace(clickStatus) && clickUpdatedAt.HasValue && (defect.StatusUpdatedAt == null || clickUpdatedAt > defect.StatusUpdatedAt))
                {
                    // reverse-map ClickUp status back to PeekQA status
                    var mappedPeekQaStatus = config.StatusMappings.FirstOrDefault(kvp => string.Equals(kvp.Value, clickStatus, StringComparison.OrdinalIgnoreCase)).Key;
                    if (!string.IsNullOrWhiteSpace(mappedPeekQaStatus))
                    {
                        _db.DefectAuditLogs.Add(new DefectAuditLog
                        {
                            DefectId = defect.Id,
                            FieldName = "Status",
                            OldValue = defect.Status,
                            NewValue = mappedPeekQaStatus,
                            ChangedBy = "ClickUp",
                            ChangedAt = clickUpdatedAt.Value,
                        });

                        defect.Status = mappedPeekQaStatus;
                        defect.StatusUpdatedAt = clickUpdatedAt;
                        // avoid overwriting ClickUp status
                        createTaskPayload.Remove("status");
                        await _db.SaveChangesAsync();
                    }
                }
            }

            var updatedPersistedTask = await UpdateExistingClickUpTaskAsync(defect.ClickUpTaskId, createTaskPayload, token);
            if (updatedPersistedTask == null)
            {
                return StatusCode(502, new { message = "We could not sync the linked ClickUp task for this defect." });
            }

            var persistedCustomItemId = string.IsNullOrWhiteSpace(defect.ClickUpCustomItemId) ? effectiveCustomItemId : defect.ClickUpCustomItemId;
            var persistedCustomItemName = string.IsNullOrWhiteSpace(defect.ClickUpCustomItemName) ? selectedCustomItemName : defect.ClickUpCustomItemName;
            ApplyClickUpLink(defect, defect.ClickUpTaskId, updatedPersistedTask.Url, defect.ClickUpListId, defect.ClickUpListName, defect.ClickUpParentTaskId, defect.ClickUpParentTaskName, persistedCustomItemId, persistedCustomItemName);
            await _db.SaveChangesAsync();
            return Ok(new ClickUpDefectSyncResponse(defect.ClickUpTaskId, updatedPersistedTask.Url, defect.ClickUpListId, defect.ClickUpListName, string.IsNullOrWhiteSpace(defect.ClickUpParentTaskId) ? null : defect.ClickUpParentTaskId, true, Status: defect.Status));
        }

        var existingTask = await FindTaskByExactNameAsync(targetList.Id, targetTaskName, normalizedParentTaskId, token);

        if (existingTask != null)
        {
            // Fetch current ClickUp task to resolve status conflicts based on timestamps
            var currentTaskResponse = await CallClickUpAsync($"/task/{existingTask.Id}", token);
            if (currentTaskResponse.IsSuccessStatusCode)
            {
                var currentTaskJson = await currentTaskResponse.Content.ReadFromJsonAsync<JsonElement>();
                var clickStatus = GetTaskStatusFromTask(currentTaskJson);
                var clickUpdatedAt = GetTaskLastUpdatedUtc(currentTaskJson);

                if (!string.IsNullOrWhiteSpace(clickStatus) && clickUpdatedAt.HasValue && (defect.StatusUpdatedAt == null || clickUpdatedAt > defect.StatusUpdatedAt))
                {
                    var mappedPeekQaStatus = config.StatusMappings.FirstOrDefault(kvp => string.Equals(kvp.Value, clickStatus, StringComparison.OrdinalIgnoreCase)).Key;
                    if (!string.IsNullOrWhiteSpace(mappedPeekQaStatus))
                    {
                        _db.DefectAuditLogs.Add(new DefectAuditLog
                        {
                            DefectId = defect.Id,
                            FieldName = "Status",
                            OldValue = defect.Status,
                            NewValue = mappedPeekQaStatus,
                            ChangedBy = "ClickUp",
                            ChangedAt = clickUpdatedAt.Value,
                        });

                        defect.Status = mappedPeekQaStatus;
                        defect.StatusUpdatedAt = clickUpdatedAt;
                        // avoid overwriting ClickUp status
                        createTaskPayload.Remove("status");
                        await _db.SaveChangesAsync();
                    }
                }
            }

            var updatedExistingTask = await UpdateExistingClickUpTaskAsync(existingTask.Id, createTaskPayload, token);
            if (updatedExistingTask == null)
            {
                return StatusCode(502, new { message = "We could not sync the linked ClickUp task for this defect." });
            }

            ApplyClickUpLink(defect, existingTask.Id, updatedExistingTask.Url ?? existingTask.Url, targetList.Id, selectedListName, normalizedParentTaskId, existingTask.ParentTaskName, effectiveCustomItemId, selectedCustomItemName);
            await _db.SaveChangesAsync();
            return Ok(new ClickUpDefectSyncResponse(existingTask.Id, updatedExistingTask.Url ?? existingTask.Url, targetList.Id, selectedListName, normalizedParentTaskId, true, Status: defect.Status));
        }

        var createResponse = await CallClickUpAsync($"/list/{targetList.Id}/task", token, HttpMethod.Post, createTaskPayload.ToJsonString());
        if (!createResponse.IsSuccessStatusCode)
        {
            return await BuildClickUpErrorResponse(createResponse, "create-task", "We could not create the ClickUp task for this defect.");
        }

        var responseJson = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var taskId = GetString(responseJson, "id", "task_id") ?? string.Empty;
        var taskUrl = GetString(responseJson, "url", "task_url");

        var listName = !string.IsNullOrWhiteSpace(targetList.Name) ? targetList.Name : GetString(responseJson, "list", "name") ?? targetList.Id;
        var parentTaskName = await ResolveParentTaskNameAsync(targetList.Id, normalizedParentTaskId, token);
        ApplyClickUpLink(defect, taskId, taskUrl, targetList.Id, listName, normalizedParentTaskId, parentTaskName, effectiveCustomItemId, selectedCustomItemName);
        await _db.SaveChangesAsync();
        return Ok(new ClickUpDefectSyncResponse(taskId, taskUrl, targetList.Id, listName, normalizedParentTaskId, false, Status: defect.Status));
    }

    [HttpPost("defects/{defectId:int}/unlink")]
    public async Task<IActionResult> UnlinkDefectFromClickUp(int defectId)
    {
        var user = await GetCurrentUserAsync();
        if (user == null) return Unauthorized();

        var defect = await _db.Defects.FirstOrDefaultAsync(d => d.Id == defectId);
        if (defect == null)
        {
            return NotFound("Defect not found.");
        }

        ClearClickUpLink(defect);
        await _db.SaveChangesAsync();
        return Ok(defect);
    }

    private sealed record ClickUpTaskLookupDto(string Id, string Name, string? Url, string? ParentTaskId, string? ParentTaskName);

    private sealed record ClickUpTaskUpdateResult(string? Url);

    private sealed record ClickUpCustomFieldUpdate(string FieldId, JsonNode? Value);

    private async Task<ClickUpTaskLookupDto?> FindTaskByExactNameAsync(string listId, string? taskName, string? parentTaskId, string token)
    {
        var normalizedTargetName = (taskName ?? string.Empty).Trim();
        var normalizedParentTaskId = NormalizeToken(parentTaskId);
        if (string.IsNullOrWhiteSpace(normalizedTargetName))
        {
            return null;
        }

        for (var page = 0; page < 25; page++)
        {
            var response = await CallClickUpAsync($"/list/{listId}/task?page={page}&subtasks=true", token);
            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            var root = document.RootElement;
            if (!root.TryGetProperty("tasks", out var tasksElement) || tasksElement.ValueKind != JsonValueKind.Array)
            {
                return null;
            }

            var pageTaskCount = 0;
            foreach (var task in tasksElement.EnumerateArray())
            {
                pageTaskCount++;
                var taskParentId = GetParentTaskId(task);
                if (!string.IsNullOrWhiteSpace(normalizedParentTaskId))
                {
                    if (!string.Equals(taskParentId, normalizedParentTaskId, StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }
                }
                else if (!string.IsNullOrWhiteSpace(taskParentId))
                {
                    continue;
                }

                var candidateName = GetString(task, "name");
                if (!string.Equals(candidateName?.Trim(), normalizedTargetName, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var candidateId = GetString(task, "id", "task_id");
                if (string.IsNullOrWhiteSpace(candidateId))
                {
                    continue;
                }

                var candidateUrl = GetString(task, "url", "task_url");
                var taskParentName = GetParentTaskName(task);
                return new ClickUpTaskLookupDto(candidateId, candidateName ?? normalizedTargetName, candidateUrl, taskParentId, taskParentName);
            }

            if (pageTaskCount == 0)
            {
                break;
            }
        }

        return null;
    }

    private static string? GetParentTaskId(JsonElement task)
    {
        if (!task.TryGetProperty("parent", out var parentElement))
        {
            return null;
        }

        return parentElement.ValueKind switch
        {
            JsonValueKind.String => parentElement.GetString(),
            JsonValueKind.Number => parentElement.ToString(),
            JsonValueKind.Object => GetString(parentElement, "id", "task_id", "taskId"),
            _ => null,
        };
    }

    private static string? GetParentTaskName(JsonElement task)
    {
        if (!task.TryGetProperty("parent", out var parentElement) || parentElement.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        return GetString(parentElement, "name", "title");
    }

    private async Task<ClickUpTaskUpdateResult?> UpdateExistingClickUpTaskAsync(string taskId, JsonObject createTaskPayload, string token)
    {
        var currentTaskResponse = await CallClickUpAsync($"/task/{taskId}", token);
        if (!currentTaskResponse.IsSuccessStatusCode)
        {
            return null;
        }

        using var currentTaskDocument = JsonDocument.Parse(await currentTaskResponse.Content.ReadAsStringAsync());
        var currentTask = currentTaskDocument.RootElement.Clone();

        var updatePayload = JsonNode.Parse(createTaskPayload.ToJsonString())?.AsObject() ?? new JsonObject();
        var desiredAssigneeIds = ExtractAssigneeIds(updatePayload);
        var customFieldUpdates = ExtractCustomFieldUpdates(updatePayload);

        updatePayload.Remove("assignees");
        updatePayload.Remove("custom_fields");
        updatePayload.Remove("custom_item_id");
        updatePayload.Remove("check_required_custom_fields");
        updatePayload.Remove("parent");

        var changedTaskPayload = BuildChangedTaskPayload(updatePayload, currentTask);
        JsonElement latestTaskSnapshot = currentTask;

        if (changedTaskPayload.Count > 0)
        {
            var updateResponse = await CallClickUpAsync($"/task/{taskId}", token, HttpMethod.Put, changedTaskPayload.ToJsonString());
            if (!updateResponse.IsSuccessStatusCode)
            {
                return null;
            }

            var updatedTaskJson = await updateResponse.Content.ReadFromJsonAsync<JsonElement>();
            latestTaskSnapshot = updatedTaskJson;
        }

        var currentAssigneeIds = GetCurrentTaskAssigneeIds(currentTask);
        if (!await ReplaceTaskAssigneesAsync(taskId, desiredAssigneeIds, currentAssigneeIds, token))
        {
            return null;
        }

        var currentCustomFieldValues = GetCurrentTaskCustomFieldValues(currentTask);
        if (!await UpsertTaskCustomFieldsAsync(taskId, customFieldUpdates, currentCustomFieldValues, token))
        {
            return null;
        }

        return new ClickUpTaskUpdateResult(GetString(latestTaskSnapshot, "url", "task_url"));
    }

    private static JsonObject BuildChangedTaskPayload(JsonObject desiredPayload, JsonElement currentTask)
    {
        var changed = new JsonObject();

        foreach (var property in desiredPayload)
        {
            var desiredNode = property.Value;
            var hasCurrent = currentTask.TryGetProperty(property.Key, out var currentValue);
            var isSame = hasCurrent && AreJsonValuesEqual(desiredNode, currentValue);
            if (isSame)
            {
                continue;
            }

            changed[property.Key] = desiredNode == null ? null : JsonNode.Parse(desiredNode.ToJsonString());
        }

        return changed;
    }

    private static bool AreJsonValuesEqual(JsonNode? desired, JsonElement current)
    {
        if (desired == null)
        {
            return current.ValueKind == JsonValueKind.Null || current.ValueKind == JsonValueKind.Undefined;
        }

        var currentNode = JsonNode.Parse(current.GetRawText());
        return JsonNode.DeepEquals(desired, currentNode);
    }

    private static List<string> ExtractAssigneeIds(JsonObject payload)
    {
        var ids = new List<string>();
        if (!payload.TryGetPropertyValue("assignees", out var assigneesNode) || assigneesNode is not JsonArray assigneesArray)
        {
            return ids;
        }

        foreach (var item in assigneesArray)
        {
            var id = item?.GetValue<string>()?.Trim();
            if (string.IsNullOrWhiteSpace(id) && item != null)
            {
                id = item.ToJsonString().Trim('"');
            }

            if (!string.IsNullOrWhiteSpace(id) && !ids.Contains(id, StringComparer.OrdinalIgnoreCase))
            {
                ids.Add(id);
            }
        }

        return ids;
    }

    private static List<ClickUpCustomFieldUpdate> ExtractCustomFieldUpdates(JsonObject payload)
    {
        var updates = new List<ClickUpCustomFieldUpdate>();
        if (!payload.TryGetPropertyValue("custom_fields", out var customFieldsNode) || customFieldsNode is not JsonArray customFieldsArray)
        {
            return updates;
        }

        foreach (var item in customFieldsArray)
        {
            if (item is not JsonObject fieldObject)
            {
                continue;
            }

            var fieldId = fieldObject["id"]?.GetValue<string>()?.Trim();
            if (string.IsNullOrWhiteSpace(fieldId))
            {
                continue;
            }

            var valueNode = fieldObject.TryGetPropertyValue("value", out var rawValue)
                ? JsonNode.Parse(rawValue?.ToJsonString() ?? "null")
                : null;

            updates.Add(new ClickUpCustomFieldUpdate(fieldId, valueNode));
        }

        return updates;
    }

    private async Task<bool> ReplaceTaskAssigneesAsync(string taskId, IReadOnlyCollection<string> desiredAssigneeIds, IReadOnlyCollection<string> currentAssigneeIds, string token)
    {
        var current = new HashSet<string>(currentAssigneeIds.Where(id => !string.IsNullOrWhiteSpace(id)), StringComparer.OrdinalIgnoreCase);
        var desired = new HashSet<string>(desiredAssigneeIds.Where(id => !string.IsNullOrWhiteSpace(id)), StringComparer.OrdinalIgnoreCase);
        var addAssignees = desired.Where(id => !current.Contains(id)).ToList();
        var removeAssignees = current.Where(id => !desired.Contains(id)).ToList();

        if (addAssignees.Count == 0 && removeAssignees.Count == 0)
        {
            return true;
        }

        var payload = new JsonObject();

        if (addAssignees.Count > 0)
        {
            payload["add_assignees"] = BuildAssigneeArray(addAssignees);
        }

        if (removeAssignees.Count > 0)
        {
            payload["rem_assignees"] = BuildAssigneeArray(removeAssignees);
        }

        var updateAssigneesResponse = await CallClickUpAsync($"/task/{taskId}", token, HttpMethod.Put, payload.ToJsonString());
        return updateAssigneesResponse.IsSuccessStatusCode;
    }

    private static JsonArray BuildAssigneeArray(IEnumerable<string> ids)
    {
        var json = new JsonArray();
        foreach (var id in ids)
        {
            if (long.TryParse(id, out var numericId))
            {
                json.Add(numericId);
            }
            else
            {
                json.Add(id);
            }
        }

        return json;
    }

    private static List<string> GetCurrentTaskAssigneeIds(JsonElement task)
    {
        var ids = new List<string>();
        if (!task.TryGetProperty("assignees", out var assigneesElement)
            || assigneesElement.ValueKind != JsonValueKind.Array)
        {
            return ids;
        }

        foreach (var assignee in assigneesElement.EnumerateArray())
        {
            var currentId = GetString(assignee, "id", "userid", "user_id");
            if (!string.IsNullOrWhiteSpace(currentId) && !ids.Contains(currentId, StringComparer.OrdinalIgnoreCase))
            {
                ids.Add(currentId);
            }
        }

        return ids;
    }

    private static Dictionary<string, JsonNode?> GetCurrentTaskCustomFieldValues(JsonElement task)
    {
        var values = new Dictionary<string, JsonNode?>(StringComparer.OrdinalIgnoreCase);
        if (!task.TryGetProperty("custom_fields", out var customFieldsElement)
            || customFieldsElement.ValueKind != JsonValueKind.Array)
        {
            return values;
        }

        foreach (var field in customFieldsElement.EnumerateArray())
        {
            var fieldId = GetString(field, "id", "field_id", "fieldId");
            if (string.IsNullOrWhiteSpace(fieldId))
            {
                continue;
            }

            JsonNode? valueNode = null;
            if (field.TryGetProperty("value", out var valueElement)
                && valueElement.ValueKind != JsonValueKind.Undefined)
            {
                valueNode = JsonNode.Parse(valueElement.GetRawText());
            }

            values[fieldId] = valueNode;
        }

        return values;
    }

    private async Task<bool> UpsertTaskCustomFieldsAsync(string taskId, IReadOnlyCollection<ClickUpCustomFieldUpdate> fieldUpdates, IReadOnlyDictionary<string, JsonNode?> currentFieldValues, string token)
    {
        foreach (var field in fieldUpdates)
        {
            if (currentFieldValues.TryGetValue(field.FieldId, out var currentValue)
                && JsonNode.DeepEquals(field.Value, currentValue))
            {
                continue;
            }

            var payload = new JsonObject
            {
                ["value"] = field.Value == null ? null : JsonNode.Parse(field.Value.ToJsonString()),
            };

            var response = await CallClickUpAsync($"/task/{taskId}/field/{field.FieldId}", token, HttpMethod.Post, payload.ToJsonString());
            if (!response.IsSuccessStatusCode)
            {
                return false;
            }
        }

        return true;
    }

    private async Task<string> ResolveCustomItemNameAsync(string? workspaceId, string customItemId, string token, string? fallbackName)
    {
        if (string.IsNullOrWhiteSpace(workspaceId))
        {
            return fallbackName ?? string.Empty;
        }

        var customItems = await GetCustomItemsForWorkspaceAsync(workspaceId, token);
        return customItems.FirstOrDefault(item => string.Equals(item.Id, customItemId, StringComparison.OrdinalIgnoreCase))?.Name
            ?? fallbackName
            ?? customItemId;
    }

    private async Task<string?> ResolveParentTaskNameAsync(string listId, string? parentTaskId, string token)
    {
        var normalizedParentTaskId = NormalizeToken(parentTaskId);
        if (string.IsNullOrWhiteSpace(normalizedParentTaskId))
        {
            return null;
        }

        for (var page = 0; page < 25; page++)
        {
            var response = await CallClickUpAsync($"/list/{listId}/task?page={page}&subtasks=true", token);
            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            if (!document.RootElement.TryGetProperty("tasks", out var tasksElement) || tasksElement.ValueKind != JsonValueKind.Array)
            {
                return null;
            }

            var count = 0;
            foreach (var task in tasksElement.EnumerateArray())
            {
                count++;
                var taskId = GetString(task, "id", "task_id");
                if (string.Equals(taskId, normalizedParentTaskId, StringComparison.OrdinalIgnoreCase))
                {
                    return GetString(task, "name", "title");
                }
            }

            if (count == 0)
            {
                break;
            }
        }

        return null;
    }

    private async Task<List<ClickUpCustomItemDto>> GetCustomItemsForWorkspaceAsync(string workspaceId, string token)
    {
        var response = await CallClickUpAsync($"/team/{workspaceId}/custom_item", token);
        if (!response.IsSuccessStatusCode)
        {
            return new List<ClickUpCustomItemDto>();
        }

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        return ParseCustomItems(payload);
    }

    private static void ApplyClickUpLink(Defect defect, string taskId, string? taskUrl, string listId, string listName, string? parentTaskId, string? parentTaskName, string customItemId, string customItemName)
    {
        defect.ClickUpTaskId = taskId ?? string.Empty;
        defect.ClickUpTaskUrl = taskUrl ?? string.Empty;
        defect.ClickUpListId = listId ?? string.Empty;
        defect.ClickUpListName = listName ?? string.Empty;
        defect.ClickUpParentTaskId = parentTaskId ?? string.Empty;
        defect.ClickUpParentTaskName = parentTaskName ?? string.Empty;
        defect.ClickUpCustomItemId = customItemId ?? string.Empty;
        defect.ClickUpCustomItemName = customItemName ?? string.Empty;
        defect.ClickUpLinkedAt = DateTime.UtcNow;
    }

    private static void ClearClickUpLink(Defect defect)
    {
        defect.ClickUpTaskId = string.Empty;
        defect.ClickUpTaskUrl = string.Empty;
        defect.ClickUpListId = string.Empty;
        defect.ClickUpListName = string.Empty;
        defect.ClickUpParentTaskId = string.Empty;
        defect.ClickUpParentTaskName = string.Empty;
        defect.ClickUpCustomItemId = string.Empty;
        defect.ClickUpCustomItemName = string.Empty;
        defect.ClickUpLinkedAt = null;
    }

    private async Task<List<ClickUpWorkspaceDto>> LoadListsForSpaceAsync(string spaceId, string token)
    {
        var lists = new List<ClickUpWorkspaceDto>();

        var folderResponse = await CallClickUpAsync($"/space/{spaceId}/folder", token);
        if (folderResponse.IsSuccessStatusCode)
        {
            var folderPayload = await folderResponse.Content.ReadFromJsonAsync<JsonElement>();
            foreach (var folder in ParseWorkspaceItems(folderPayload, "folders"))
            {
                var folderListsResponse = await CallClickUpAsync($"/folder/{folder.Id}/list", token);
                if (!folderListsResponse.IsSuccessStatusCode) continue;

                var folderListPayload = await folderListsResponse.Content.ReadFromJsonAsync<JsonElement>();
                lists.AddRange(ParseLists(folderListPayload));
            }
        }

        var directListsResponse = await CallClickUpAsync($"/space/{spaceId}/list", token);
        if (directListsResponse.IsSuccessStatusCode)
        {
            var directPayload = await directListsResponse.Content.ReadFromJsonAsync<JsonElement>();
            lists.AddRange(ParseLists(directPayload));
        }

        return lists
            .Where(l => !string.IsNullOrWhiteSpace(l.Id))
            .DistinctBy(l => l.Id)
            .OrderBy(l => l.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private JsonObject BuildCreateTaskPayload(Defect defect, ClickUpConfigurationParseResult config, IReadOnlyDictionary<string, string> configuredFieldMappings, string? parentTaskId, List<string> assignees, string targetCustomItemId)
    {
        var mappedName = ResolveConfiguredPeekQaFieldValue(defect, configuredFieldMappings, "name");
        var mappedDescription = ResolveConfiguredPeekQaFieldValue(defect, configuredFieldMappings, "description");

        var payload = new JsonObject
        {
            ["name"] = string.IsNullOrWhiteSpace(mappedName) ? (string.IsNullOrWhiteSpace(defect.Title) ? defect.DefectNumber : defect.Title) : mappedName,
            ["description"] = mappedDescription ?? string.Empty,
            ["check_required_custom_fields"] = true,
        };

        if (int.TryParse(targetCustomItemId, out var customItemId))
        {
            payload["custom_item_id"] = customItemId;
        }
        else if (!string.IsNullOrWhiteSpace(targetCustomItemId))
        {
            payload["custom_item_id"] = targetCustomItemId;
        }

        if (!string.IsNullOrWhiteSpace(parentTaskId))
        {
            payload["parent"] = parentTaskId.Trim();
        }

        var configuredStatus = ResolveConfiguredPeekQaFieldValue(defect, configuredFieldMappings, "status") ?? defect.Status;
        var rawStatus = configuredStatus?.Trim() ?? string.Empty;
        var normalizedStatus = NormalizePeekQaStatus(configuredStatus);
        var mappedStatus = string.Empty;
        var hasMappedStatus = (!string.IsNullOrWhiteSpace(rawStatus)
            && config.StatusMappings.TryGetValue(rawStatus, out mappedStatus))
            || (!string.IsNullOrWhiteSpace(normalizedStatus)
                && config.StatusMappings.TryGetValue(normalizedStatus, out mappedStatus));

        if (hasMappedStatus
            && !string.IsNullOrWhiteSpace(mappedStatus))
        {
            payload["status"] = mappedStatus;
        }

        var configuredPriority = ResolveConfiguredPeekQaFieldValue(defect, configuredFieldMappings, "priority") ?? defect.Priority;
        var normalizedPriority = NormalizePeekQaPriority(configuredPriority);
        if (!string.IsNullOrWhiteSpace(normalizedPriority)
            && config.PriorityMappings.TryGetValue(normalizedPriority, out var mappedPriority)
            && !string.IsNullOrWhiteSpace(mappedPriority))
        {
            payload["priority"] = mappedPriority;
        }

        if (assignees.Count > 0)
        {
            var assigneeArray = new JsonArray();
            foreach (var id in assignees)
            {
                assigneeArray.Add(id);
            }

            payload["assignees"] = assigneeArray;
        }

        var customFields = new JsonArray();
        foreach (var mapping in configuredFieldMappings.Where(m => !SystemClickUpFieldIds.Contains(m.Key) && !string.IsNullOrWhiteSpace(m.Key) && !string.IsNullOrWhiteSpace(m.Value)))
        {
            var rawValue = ResolvePeekQaFieldValue(defect, mapping.Value);
            if (rawValue == null) continue;

            var mappedValue = rawValue;
            if (config.CustomFieldValueMappings.TryGetValue(mapping.Key, out var optionMappings)
                && optionMappings.TryGetValue(rawValue, out var mappedOption)
                && !string.IsNullOrWhiteSpace(mappedOption))
            {
                mappedValue = mappedOption;
            }

            customFields.Add(new JsonObject
            {
                ["id"] = mapping.Key,
                ["value"] = mappedValue,
            });
        }

        if (customFields.Count > 0)
        {
            payload["custom_fields"] = customFields;
        }

        return payload;
    }

    private static Dictionary<string, string> BuildConfiguredFieldMappings(ClickUpConfigurationParseResult config)
    {
        var mappings = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var mapping in config.Mappings)
        {
            if (!string.IsNullOrWhiteSpace(mapping.Key) && !string.IsNullOrWhiteSpace(mapping.Value))
            {
                mappings[mapping.Key] = mapping.Value.Trim();
            }
        }

        foreach (var mapping in config.FieldMappings)
        {
            if (string.IsNullOrWhiteSpace(mapping.ClickUpFieldId) || string.IsNullOrWhiteSpace(mapping.PeekQaFieldName))
            {
                continue;
            }

            mappings[mapping.ClickUpFieldId] = mapping.PeekQaFieldName.Trim();
        }

        return mappings;
    }

    private static string? ResolveConfiguredPeekQaFieldValue(Defect defect, IReadOnlyDictionary<string, string> configuredFieldMappings, string clickUpFieldId)
    {
        if (!configuredFieldMappings.TryGetValue(clickUpFieldId, out var peekQaFieldName) || string.IsNullOrWhiteSpace(peekQaFieldName))
        {
            return null;
        }

        return ResolvePeekQaFieldValue(defect, peekQaFieldName);
    }

    private async Task<List<string>> ResolveAssigneesAsync(string? assignedIdentity, string? workspaceId, string token)
    {
        var ids = new List<string>();
        if (string.IsNullOrWhiteSpace(assignedIdentity) || string.IsNullOrWhiteSpace(workspaceId))
        {
            return ids;
        }

        var assignedDisplayName = assignedIdentity.Trim();
        var assignedUser = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.IsActive && (u.DisplayName == assignedDisplayName || u.Username == assignedDisplayName));
        if (assignedUser == null || string.IsNullOrWhiteSpace(assignedUser.Username))
        {
            return ids;
        }

        var teamResponse = await CallClickUpAsync("/team", token);
        if (!teamResponse.IsSuccessStatusCode)
        {
            return ids;
        }

        try
        {
            using var document = JsonDocument.Parse(await teamResponse.Content.ReadAsStringAsync());
            var root = document.RootElement;
            if (!root.TryGetProperty("teams", out var teams) || teams.ValueKind != JsonValueKind.Array)
            {
                return ids;
            }

            foreach (var team in teams.EnumerateArray())
            {
                var teamId = GetString(team, "id");
                if (!string.Equals(teamId, workspaceId, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                if (!team.TryGetProperty("members", out var members) || members.ValueKind != JsonValueKind.Array)
                {
                    break;
                }

                foreach (var member in members.EnumerateArray())
                {
                    if (!member.TryGetProperty("user", out var userElement) || userElement.ValueKind != JsonValueKind.Object)
                    {
                        continue;
                    }

                    var email = GetString(userElement, "email", "username");
                    if (!string.Equals(email, assignedUser.Username, StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    var memberId = GetString(userElement, "id", "userid", "user_id");
                    if (!string.IsNullOrWhiteSpace(memberId))
                    {
                        ids.Add(memberId);
                    }

                    return ids;
                }
            }
        }
        catch
        {
            return ids;
        }

        return ids;
    }

    private static string? ResolvePeekQaFieldValue(Defect defect, string peekQaField)
    {
        return peekQaField.Trim() switch
        {
            "Defect Title" => defect.Title,
            "Description" => defect.Description,
            "Expected Result" => defect.ExpectedResult,
            "Actual Result" => defect.ActualResult,
            "Priority" => defect.Priority,
            "Severity" => defect.Severity,
            "Status" => defect.Status,
            "Assigned To" => defect.AssignedTo,
            "Raised By" => defect.RaisedBy,
            "Date Raised" => defect.DateRaised.ToString("yyyy-MM-dd"),
            "Open Date" => defect.OpenDateTime.ToString("yyyy-MM-dd"),
            "Close Date" => defect.CloseDateTime?.ToString("yyyy-MM-dd"),
            "Issue Type" => defect.IssueType,
            "Environment" => defect.Market,
            "Module" => defect.ProjectId.ToString(),
            "Build Version" => defect.RunNumber,
            "Attachment" => null,
            "Steps To Reproduce" => string.Join(Environment.NewLine, new[] { defect.Description, defect.ExpectedResult, defect.ActualResult }.Where(v => !string.IsNullOrWhiteSpace(v))),
            "Target Fix Date" => defect.TargetFixDate?.ToString("yyyy-MM-dd"),
            "Remarks" => defect.Remarks,
            "Source" => defect.Source,
            _ => null,
        };
    }

    private static string NormalizePeekQaStatus(string? status)
    {
        var value = status?.Trim() ?? string.Empty;
        return value switch
        {
            "New" => "Open",
            "In Progress" => "Assigned",
            "Reopened" => "Retest",
            "Fixed" => "Fixed",
            "Closed" => "Closed",
            "Rejected" => "Closed",
            "Change Request" => "Assigned",
            _ => value,
        };
    }

    private static string NormalizePeekQaPriority(string? priority)
    {
        var value = priority?.Trim() ?? string.Empty;
        return value switch
        {
            "Showstopper" => "Critical",
            _ => value,
        };
    }

    private async Task<UserAccount?> GetCurrentUserAsync()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
        {
            return null;
        }

        return await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
    }

    private async Task<List<ClickUpWorkspaceApiModel>> LoadWorkspacesAsync(string token)
    {
        var response = await CallClickUpAsync("/team", token);
        if (!response.IsSuccessStatusCode)
        {
            return new List<ClickUpWorkspaceApiModel>();
        }

        var payload = await response.Content.ReadFromJsonAsync<ClickUpWorkspacesApiResponse>();
        return payload?.Teams?.Select(team => new ClickUpWorkspaceApiModel(team.Id, team.Name)).ToList() ?? new List<ClickUpWorkspaceApiModel>();
    }

    private async Task<List<ClickUpFieldMetadataDto>> LoadCustomFieldsAsync(string spaceId, string token)
    {
        var response = await CallClickUpAsync($"/space/{spaceId}/field", token);
        if (!response.IsSuccessStatusCode)
        {
            return new List<ClickUpFieldMetadataDto>();
        }

        try
        {
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            var root = document.RootElement;
            var elementArray = root.ValueKind == JsonValueKind.Array ? root : (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("fields", out var fieldsElement) ? fieldsElement : root);
            if (elementArray.ValueKind != JsonValueKind.Array)
            {
                return new List<ClickUpFieldMetadataDto>();
            }

            var fields = new List<ClickUpFieldMetadataDto>();
            foreach (var item in elementArray.EnumerateArray())
            {
                var id = GetString(item, "id", "field_id", "fieldId", "key");
                var name = GetString(item, "name", "label", "field_name", "fieldName");
                var type = GetString(item, "type", "field_type", "fieldType", "kind");
                var isRequired = item.TryGetProperty("required", out var requiredElement) && requiredElement.ValueKind == JsonValueKind.True;
                var options = ParseFieldOptions(item);

                if (!string.IsNullOrWhiteSpace(id) && !string.IsNullOrWhiteSpace(name))
                {
                    fields.Add(new ClickUpFieldMetadataDto(id, name, type ?? "custom", isRequired, false, options));
                }
            }

            return fields;
        }
        catch
        {
            return new List<ClickUpFieldMetadataDto>();
        }
    }

    private async Task<List<ClickUpStatusOptionDto>> LoadStatusesFromFoldersAsync(string spaceId, string token)
    {
        var response = await CallClickUpAsync($"/space/{spaceId}/folder", token);
        if (!response.IsSuccessStatusCode)
        {
            return GetDefaultStatuses();
        }

        try
        {
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return ParseStatusesFromFolders(document.RootElement);
        }
        catch
        {
            return GetDefaultStatuses();
        }
    }

    private async Task<List<ClickUpPriorityOptionDto>> LoadPrioritiesFromWorkspaceSpacesAsync(string workspaceId, string token)
    {
        var response = await CallClickUpAsync($"/team/{workspaceId}/space", token);
        if (!response.IsSuccessStatusCode)
        {
            return GetDefaultPriorities();
        }

        try
        {
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return ParsePrioritiesFromSpaces(document.RootElement);
        }
        catch
        {
            return GetDefaultPriorities();
        }
    }

    private static List<ClickUpStatusOptionDto> ParseStatusesFromFolders(JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Object || !payload.TryGetProperty("folders", out var foldersElement) || foldersElement.ValueKind != JsonValueKind.Array)
        {
            return GetDefaultStatuses();
        }

        var values = new List<ClickUpStatusOptionDto>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var folder in foldersElement.EnumerateArray())
        {
            if (!folder.TryGetProperty("statuses", out var statusesElement) || statusesElement.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var status in statusesElement.EnumerateArray())
            {
                var value = GetString(status, "status", "id", "name", "label");
                var label = GetString(status, "label", "name", "status") ?? value;
                if (string.IsNullOrWhiteSpace(value) || !seen.Add(value))
                {
                    continue;
                }

                values.Add(new ClickUpStatusOptionDto(value, string.IsNullOrWhiteSpace(label) ? value : label));
            }
        }

        return values.Count > 0 ? values : GetDefaultStatuses();
    }

    private static List<ClickUpPriorityOptionDto> ParsePrioritiesFromSpaces(JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Object || !payload.TryGetProperty("spaces", out var spacesElement) || spacesElement.ValueKind != JsonValueKind.Array)
        {
            return GetDefaultPriorities();
        }

        var values = new List<ClickUpPriorityOptionDto>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var space in spacesElement.EnumerateArray())
        {
            if (!space.TryGetProperty("features", out var featuresElement) || featuresElement.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            if (!featuresElement.TryGetProperty("priorities", out var prioritiesFeatureElement) || prioritiesFeatureElement.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            if (!prioritiesFeatureElement.TryGetProperty("priorities", out var prioritiesElement) || prioritiesElement.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var priority in prioritiesElement.EnumerateArray())
            {
                var value = GetString(priority, "id", "priority", "name");
                var label = GetString(priority, "priority", "name", "label") ?? value;
                if (string.IsNullOrWhiteSpace(value) || !seen.Add(value))
                {
                    continue;
                }

                values.Add(new ClickUpPriorityOptionDto(value, string.IsNullOrWhiteSpace(label) ? value : label));
            }
        }

        return values.Count > 0 ? values : GetDefaultPriorities();
    }

    private static List<ClickUpSelectOptionDto> ParseFieldOptions(JsonElement fieldElement)
    {
        var options = new List<ClickUpSelectOptionDto>();
        if (!fieldElement.TryGetProperty("type_config", out var typeConfig) || typeConfig.ValueKind != JsonValueKind.Object)
        {
            return options;
        }

        if (!typeConfig.TryGetProperty("options", out var optionsElement) || optionsElement.ValueKind != JsonValueKind.Array)
        {
            return options;
        }

        foreach (var option in optionsElement.EnumerateArray())
        {
            var id = GetString(option, "id", "value");
            var name = GetString(option, "name", "label") ?? id;
            if (!string.IsNullOrWhiteSpace(id) && !string.IsNullOrWhiteSpace(name))
            {
                options.Add(new ClickUpSelectOptionDto(id, name));
            }
        }

        return options;
    }

    private static List<ClickUpWorkspaceDto> ParseWorkspaceItems(JsonElement payload, string propertyName)
    {
        if (payload.ValueKind != JsonValueKind.Object || !payload.TryGetProperty(propertyName, out var items) || items.ValueKind != JsonValueKind.Array)
        {
            return new List<ClickUpWorkspaceDto>();
        }

        return items.EnumerateArray()
            .Select(item => new ClickUpWorkspaceDto(GetString(item, "id") ?? string.Empty, GetString(item, "name") ?? string.Empty))
            .Where(item => !string.IsNullOrWhiteSpace(item.Id))
            .ToList();
    }

    private static List<ClickUpWorkspaceDto> ParseLists(JsonElement payload)
    {
        return ParseWorkspaceItems(payload, "lists");
    }

    private static List<ClickUpCustomItemDto> ParseCustomItems(JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Object || !payload.TryGetProperty("custom_items", out var items) || items.ValueKind != JsonValueKind.Array)
        {
            return new List<ClickUpCustomItemDto>();
        }

        var values = new List<ClickUpCustomItemDto>();
        foreach (var item in items.EnumerateArray())
        {
            var id = GetString(item, "id", "type", "value");
            var name = GetString(item, "name", "label");
            if (!string.IsNullOrWhiteSpace(id) && !string.IsNullOrWhiteSpace(name))
            {
                values.Add(new ClickUpCustomItemDto(id, name));
            }
        }

        return values;
    }

    private static List<ClickUpWorkspaceDto> ParseTasks(JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Object || !payload.TryGetProperty("tasks", out var items) || items.ValueKind != JsonValueKind.Array)
        {
            return new List<ClickUpWorkspaceDto>();
        }

        return items.EnumerateArray()
            .Select(item => new ClickUpWorkspaceDto(GetString(item, "id") ?? string.Empty, GetString(item, "name") ?? string.Empty))
            .Where(item => !string.IsNullOrWhiteSpace(item.Id))
            .ToList();
    }

    private static List<ClickUpStatusOptionDto> GetDefaultStatuses()
    {
        return new()
        {
            new("to_do", "To Do"),
            new("in_progress", "In Progress"),
            new("ready_for_test", "Ready for Test"),
            new("in_review", "In Review"),
            new("done", "Done"),
        };
    }

    private static string? GetTaskStatusFromTask(JsonElement task)
    {
        if (!task.TryGetProperty("status", out var statusElement))
        {
            return null;
        }

        if (statusElement.ValueKind == JsonValueKind.String)
        {
            return statusElement.GetString();
        }

        if (statusElement.ValueKind == JsonValueKind.Object)
        {
            return GetString(statusElement, "status", "id", "label", "name");
        }

        return null;
    }

    private static DateTime? GetTaskLastUpdatedUtc(JsonElement task)
    {
        // ClickUp typically returns epoch milliseconds in properties like "date_updated" or "date_created"
        long? ms = TryGetLongFromElement(task, "date_updated") ?? TryGetLongFromElement(task, "date_closed") ?? TryGetLongFromElement(task, "date_created") ?? TryGetLongFromElement(task, "modified_at");
        if (!ms.HasValue) return null;
        try
        {
            return DateTimeOffset.FromUnixTimeMilliseconds(ms.Value).UtcDateTime;
        }
        catch
        {
            return null;
        }
    }

    private static long? TryGetLongFromElement(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var pe)) return null;
        try
        {
            if (pe.ValueKind == JsonValueKind.Number && pe.TryGetInt64(out var v)) return v;
            if (pe.ValueKind == JsonValueKind.String && long.TryParse(pe.GetString(), out var s)) return s;
        }
        catch { }
        return null;
    }

    private static List<ClickUpPriorityOptionDto> GetDefaultPriorities()
    {
        return new()
        {
            new("low", "Low"),
            new("normal", "Normal"),
            new("high", "High"),
            new("urgent", "Urgent"),
        };
    }

    private static string? GetString(JsonElement element, params string[] propertyNames)
    {
        foreach (var propertyName in propertyNames)
        {
            if (!element.TryGetProperty(propertyName, out var propertyValue))
            {
                continue;
            }

            string? value = propertyValue.ValueKind switch
            {
                JsonValueKind.String => propertyValue.GetString(),
                JsonValueKind.Number => propertyValue.ToString(),
                JsonValueKind.True => bool.TrueString,
                JsonValueKind.False => bool.FalseString,
                _ => null,
            };

            if (!string.IsNullOrWhiteSpace(value))
            {
                return value;
            }
        }

        return null;
    }

    private static object BuildConfigurationPayload(
        ClickUpWorkspaceDto? list,
        ClickUpCustomItemDto? customItem,
        Dictionary<string, string>? mappings,
        List<ClickUpFieldMappingRequestDto>? fieldMappings,
        Dictionary<string, string>? statusMappings,
        Dictionary<string, string>? priorityMappings,
        Dictionary<string, Dictionary<string, string>>? customFieldValueMappings,
        bool syncStatus)
    {
        var normalizedMappings = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var mapping in mappings ?? new Dictionary<string, string>())
        {
            if (!string.IsNullOrWhiteSpace(mapping.Key) && !string.IsNullOrWhiteSpace(mapping.Value))
            {
                normalizedMappings[mapping.Key] = mapping.Value;
            }
        }

        var normalizedFieldMappings = new List<ClickUpFieldMappingRequestDto>();
        foreach (var fieldMapping in fieldMappings ?? new List<ClickUpFieldMappingRequestDto>())
        {
            if (string.IsNullOrWhiteSpace(fieldMapping.ClickUpFieldId))
            {
                continue;
            }

            normalizedFieldMappings.Add(new ClickUpFieldMappingRequestDto(
                fieldMapping.ClickUpFieldId,
                fieldMapping.ClickUpFieldName,
                fieldMapping.ClickUpFieldType,
                fieldMapping.PeekQaFieldName,
                fieldMapping.IsRequired,
                fieldMapping.IsSystemField,
                fieldMapping.ValueMappings));
        }

        var normalizedStatusMappings = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var mapping in statusMappings ?? new Dictionary<string, string>())
        {
            if (!string.IsNullOrWhiteSpace(mapping.Key) && !string.IsNullOrWhiteSpace(mapping.Value))
            {
                normalizedStatusMappings[mapping.Key] = mapping.Value;
            }
        }

        var normalizedPriorityMappings = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var mapping in priorityMappings ?? new Dictionary<string, string>())
        {
            if (!string.IsNullOrWhiteSpace(mapping.Key) && !string.IsNullOrWhiteSpace(mapping.Value))
            {
                normalizedPriorityMappings[mapping.Key] = mapping.Value;
            }
        }

        var normalizedCustomFieldValueMappings = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase);
        foreach (var fieldMap in customFieldValueMappings ?? new Dictionary<string, Dictionary<string, string>>())
        {
            if (string.IsNullOrWhiteSpace(fieldMap.Key) || fieldMap.Value == null)
            {
                continue;
            }

            var normalizedValueMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var valueMap in fieldMap.Value)
            {
                if (!string.IsNullOrWhiteSpace(valueMap.Key) && !string.IsNullOrWhiteSpace(valueMap.Value))
                {
                    normalizedValueMap[valueMap.Key] = valueMap.Value;
                }
            }

            normalizedCustomFieldValueMappings[fieldMap.Key] = normalizedValueMap;
        }

        return new
        {
            list,
            customItem,
            mappings = normalizedMappings,
            fieldMappings = normalizedFieldMappings,
            statusMappings = normalizedStatusMappings,
            priorityMappings = normalizedPriorityMappings,
            customFieldValueMappings = normalizedCustomFieldValueMappings,
            syncStatus = syncStatus,
        };
    }

    private static List<string> ValidateIntegrationMappings(ClickUpIntegrationRequest request)
    {
        var errors = new List<string>();
        var mappings = request.Mappings ?? new Dictionary<string, string>();
        var requiredPeekQaFieldMappings = new[] { "Expected Result", "Actual Result" };

        var clickUpFieldIds = request.FieldMappings?
            .Where(field => !string.IsNullOrWhiteSpace(field.ClickUpFieldId))
            .Select(field => field.ClickUpFieldId!.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList() ?? mappings.Keys.ToList();

        var mappedPeekQaFields = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
        foreach (var clickUpFieldId in clickUpFieldIds)
        {
            if (string.Equals(clickUpFieldId, "assignees", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (!mappings.TryGetValue(clickUpFieldId, out var peekQaFieldName) || string.IsNullOrWhiteSpace(peekQaFieldName))
            {
                continue;
            }

            var normalizedPeekQaFieldName = peekQaFieldName.Trim();
            if (!mappedPeekQaFields.TryGetValue(normalizedPeekQaFieldName, out var mappedClickUpFieldIds))
            {
                mappedClickUpFieldIds = new List<string>();
                mappedPeekQaFields[normalizedPeekQaFieldName] = mappedClickUpFieldIds;
            }

            mappedClickUpFieldIds.Add(clickUpFieldId);
        }

        foreach (var mapping in mappedPeekQaFields)
        {
            if (mapping.Value.Count > 1)
            {
                errors.Add($"PeekQA field \"{mapping.Key}\" is mapped more than once ({string.Join(", ", mapping.Value)}).");
            }
        }

        foreach (var requiredPeekQaField in requiredPeekQaFieldMappings)
        {
            if (!mappedPeekQaFields.ContainsKey(requiredPeekQaField))
            {
                errors.Add($"PeekQA field \"{requiredPeekQaField}\" must be mapped to a ClickUp field.");
            }
        }

        var normalizedCustomFieldValueMappings = request.CustomFieldValueMappings ?? new Dictionary<string, Dictionary<string, string>>();
        var fieldMappings = request.FieldMappings ?? new List<ClickUpFieldMappingRequestDto>();

        foreach (var field in fieldMappings.Where(f => !string.IsNullOrWhiteSpace(f.ClickUpFieldId) && !string.IsNullOrWhiteSpace(f.PeekQaFieldName)))
        {
            var fieldId = field.ClickUpFieldId!.Trim();
            var peekQaField = field.PeekQaFieldName!.Trim();
            if (!peekQaField.Equals("Severity", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var requiredValues = new[] { "Critical", "High", "Medium", "Low" };

            normalizedCustomFieldValueMappings.TryGetValue(fieldId, out var valueMap);
            foreach (var requiredValue in requiredValues)
            {
                if (valueMap == null
                    || !valueMap.TryGetValue(requiredValue, out var mappedOption)
                    || string.IsNullOrWhiteSpace(mappedOption))
                {
                    errors.Add($"ClickUp field \"{field.ClickUpFieldName ?? fieldId}\" mapped to PeekQA \"{peekQaField}\" must map value \"{requiredValue}\".");
                }
            }
        }

        return errors;
    }

    private async Task<HttpResponseMessage> CallClickUpAsync(string path, string token, HttpMethod? method = null, string? body = null)
    {
        var normalizedToken = token.Trim();
        var request = new HttpRequestMessage(method ?? HttpMethod.Get, $"https://api.clickup.com/api/v2{path}");
        request.Headers.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json"));

        request.Headers.TryAddWithoutValidation("Authorization", normalizedToken);

        if (!string.IsNullOrWhiteSpace(body))
        {
            request.Content = new StringContent(body, Encoding.UTF8, "application/json");
        }

        return await _httpClientFactory.CreateClient().SendAsync(request);
    }

    private async Task<ObjectResult> BuildClickUpErrorResponse(HttpResponseMessage response, string operation, string fallbackMessage)
    {
        var responseBody = await response.Content.ReadAsStringAsync();
        var message = GetFriendlyClickUpErrorMessage(response.StatusCode, responseBody, fallbackMessage);
        return StatusCode((int)response.StatusCode, new
        {
            message,
            operation,
            statusCode = (int)response.StatusCode,
        });
    }

    private static string GetFriendlyClickUpErrorMessage(HttpStatusCode statusCode, string? responseBody, string fallbackMessage)
    {
        return statusCode switch
        {
            HttpStatusCode.Unauthorized => "Your ClickUp API token is invalid or unauthorized.",
            HttpStatusCode.Forbidden => "ClickUp denied access to this workspace. Please verify the token permissions.",
            HttpStatusCode.TooManyRequests => "ClickUp is rate limiting requests. Please try again shortly.",
            HttpStatusCode.NotFound => "ClickUp could not find the requested resource. Please verify your workspace and space selection.",
            HttpStatusCode.InternalServerError or HttpStatusCode.BadGateway or HttpStatusCode.ServiceUnavailable or HttpStatusCode.GatewayTimeout => "ClickUp is temporarily unavailable. Please try again shortly.",
            _ => fallbackMessage,
        };
    }

    private string? GetStoredToken(UserAccount user)
    {
        if (string.IsNullOrWhiteSpace(user.ClickUpApiTokenEncrypted))
        {
            return null;
        }

        try
        {
            return _protector.Unprotect(user.ClickUpApiTokenEncrypted);
        }
        catch
        {
            return null;
        }
    }

    private static string? NormalizeToken(string? token)
    {
        return string.IsNullOrWhiteSpace(token) ? null : token.Trim();
    }

    private static ClickUpWorkspaceDto? ToWorkspaceDto(string? id, string? name)
    {
        if (string.IsNullOrWhiteSpace(id) && string.IsNullOrWhiteSpace(name))
        {
            return null;
        }

        return new ClickUpWorkspaceDto(id ?? string.Empty, name ?? string.Empty);
    }

    private static ClickUpConfigurationParseResult ParseConfiguration(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new ClickUpConfigurationParseResult(
                new Dictionary<string, string>(),
                new List<ClickUpFieldMappingDto>(),
                new Dictionary<string, string>(),
                new Dictionary<string, string>(),
                null,
                null,
                new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase),
                true);
        }

        try
        {
            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return new ClickUpConfigurationParseResult(
                    new Dictionary<string, string>(),
                    new List<ClickUpFieldMappingDto>(),
                    new Dictionary<string, string>(),
                    new Dictionary<string, string>(),
                    null,
                    null,
                    new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase),
                    true);
            }

            var mappings = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            var fieldMappings = new List<ClickUpFieldMappingDto>();
            var statusMappings = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            var priorityMappings = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            var customFieldValueMappings = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase);
            var syncStatus = true;

            static bool TryGetPropertyIgnoreCase(JsonElement element, string propertyName, out JsonElement propertyValue)
            {
                if (element.TryGetProperty(propertyName, out propertyValue))
                {
                    return true;
                }

                foreach (var property in element.EnumerateObject())
                {
                    if (property.Name.Equals(propertyName, StringComparison.OrdinalIgnoreCase))
                    {
                        propertyValue = property.Value;
                        return true;
                    }
                }

                propertyValue = default;
                return false;
            }

            ClickUpWorkspaceDto? list = null;
            if (TryGetPropertyIgnoreCase(root, "list", out var listElement) && listElement.ValueKind == JsonValueKind.Object)
            {
                list = new ClickUpWorkspaceDto(GetString(listElement, "id") ?? string.Empty, GetString(listElement, "name") ?? string.Empty);
            }

            ClickUpCustomItemDto? customItem = null;
            if (TryGetPropertyIgnoreCase(root, "customItem", out var customItemElement) && customItemElement.ValueKind == JsonValueKind.Object)
            {
                customItem = new ClickUpCustomItemDto(GetString(customItemElement, "id") ?? string.Empty, GetString(customItemElement, "name") ?? string.Empty);
            }

            if (TryGetPropertyIgnoreCase(root, "mappings", out var mappingsElement) && mappingsElement.ValueKind == JsonValueKind.Object)
            {
                foreach (var property in mappingsElement.EnumerateObject())
                {
                    if (!string.IsNullOrWhiteSpace(property.Name) && property.Value.ValueKind == JsonValueKind.String)
                    {
                        mappings[property.Name] = property.Value.GetString() ?? string.Empty;
                    }
                }
            }
            else
            {
                foreach (var property in root.EnumerateObject())
                {
                    if (property.Name.Equals("fieldMappings", StringComparison.OrdinalIgnoreCase)
                        || property.Name.Equals("statusMappings", StringComparison.OrdinalIgnoreCase)
                        || property.Name.Equals("priorityMappings", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    if (property.Value.ValueKind == JsonValueKind.String)
                    {
                        mappings[property.Name] = property.Value.GetString() ?? string.Empty;
                    }
                }
            }

            if (TryGetPropertyIgnoreCase(root, "fieldMappings", out var fieldMappingsElement) && fieldMappingsElement.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in fieldMappingsElement.EnumerateArray())
                {
                    var id = GetString(item, "clickUpFieldId", "clickupFieldId", "clickUpFieldID", "clickUpFieldId");
                    var name = GetString(item, "clickUpFieldName", "clickupFieldName", "name");
                    var type = GetString(item, "clickUpFieldType", "clickupFieldType", "type");
                    var peekQa = GetString(item, "peekQaFieldName", "peekqaFieldName", "peekQaField", "peekQaFieldName");
                    var isRequired = item.TryGetProperty("isRequired", out var requiredElement) && requiredElement.ValueKind == JsonValueKind.True;
                    var isSystemField = item.TryGetProperty("isSystemField", out var systemElement) && systemElement.ValueKind == JsonValueKind.True;
                    var valueMappings = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

                    if (item.TryGetProperty("valueMappings", out var valueMappingsElement) && valueMappingsElement.ValueKind == JsonValueKind.Object)
                    {
                        foreach (var valueProperty in valueMappingsElement.EnumerateObject())
                        {
                            if (!string.IsNullOrWhiteSpace(valueProperty.Name) && valueProperty.Value.ValueKind == JsonValueKind.String)
                            {
                                valueMappings[valueProperty.Name] = valueProperty.Value.GetString() ?? string.Empty;
                            }
                        }
                    }

                    if (!string.IsNullOrWhiteSpace(id))
                    {
                        fieldMappings.Add(new ClickUpFieldMappingDto(id, name ?? id, type ?? "custom", peekQa ?? string.Empty, isRequired, isSystemField, valueMappings));
                    }
                }
            }

            if (TryGetPropertyIgnoreCase(root, "statusMappings", out var statusElement) && statusElement.ValueKind == JsonValueKind.Object)
            {
                foreach (var property in statusElement.EnumerateObject())
                {
                    if (!string.IsNullOrWhiteSpace(property.Name) && property.Value.ValueKind == JsonValueKind.String)
                    {
                        statusMappings[property.Name] = property.Value.GetString() ?? string.Empty;
                    }
                }
            }

            if (TryGetPropertyIgnoreCase(root, "priorityMappings", out var priorityElement) && priorityElement.ValueKind == JsonValueKind.Object)
            {
                foreach (var property in priorityElement.EnumerateObject())
                {
                    if (!string.IsNullOrWhiteSpace(property.Name) && property.Value.ValueKind == JsonValueKind.String)
                    {
                        priorityMappings[property.Name] = property.Value.GetString() ?? string.Empty;
                    }
                }
            }

            if (TryGetPropertyIgnoreCase(root, "customFieldValueMappings", out var customFieldMappingsElement) && customFieldMappingsElement.ValueKind == JsonValueKind.Object)
            {
                foreach (var fieldProperty in customFieldMappingsElement.EnumerateObject())
                {
                    if (fieldProperty.Value.ValueKind != JsonValueKind.Object) continue;

                    var valueMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                    foreach (var valueProperty in fieldProperty.Value.EnumerateObject())
                    {
                        if (!string.IsNullOrWhiteSpace(valueProperty.Name) && valueProperty.Value.ValueKind == JsonValueKind.String)
                        {
                            valueMap[valueProperty.Name] = valueProperty.Value.GetString() ?? string.Empty;
                        }
                    }

                    customFieldValueMappings[fieldProperty.Name] = valueMap;
                }
            }

            if (TryGetPropertyIgnoreCase(root, "syncStatus", out var syncElement))
            {
                if (syncElement.ValueKind == JsonValueKind.True) syncStatus = true;
                else if (syncElement.ValueKind == JsonValueKind.False) syncStatus = false;
                else if (syncElement.ValueKind == JsonValueKind.String)
                {
                    var s = syncElement.GetString();
                    if (!string.IsNullOrWhiteSpace(s) && bool.TryParse(s, out var parsed)) syncStatus = parsed;
                }
            }

            foreach (var field in fieldMappings.Where(f => !string.IsNullOrWhiteSpace(f.ClickUpFieldId)))
            {
                if (field.ValueMappings != null && field.ValueMappings.Count > 0)
                {
                    customFieldValueMappings[field.ClickUpFieldId] = field.ValueMappings;
                }
            }

            return new ClickUpConfigurationParseResult(mappings, fieldMappings, statusMappings, priorityMappings, list, customItem, customFieldValueMappings, syncStatus);
        }
        catch
        {
            return new ClickUpConfigurationParseResult(
                new Dictionary<string, string>(),
                new List<ClickUpFieldMappingDto>(),
                new Dictionary<string, string>(),
                new Dictionary<string, string>(),
                null,
                null,
                new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase),
                true);
        }
    }
}

public record ClickUpValidateRequest(string? Token);
public record ClickUpIntegrationRequest(
    string? Token,
    bool Enabled,
    string? ValidationStatus,
    ClickUpWorkspaceDto? Workspace,
    ClickUpWorkspaceDto? Space,
    ClickUpWorkspaceDto? List,
    ClickUpCustomItemDto? CustomItem,
    Dictionary<string, string>? Mappings,
    List<ClickUpFieldMappingRequestDto>? FieldMappings,
    Dictionary<string, string>? StatusMappings,
    Dictionary<string, string>? PriorityMappings,
    Dictionary<string, Dictionary<string, string>>? CustomFieldValueMappings,
    bool? SyncStatus);
public record ClickUpIntegrationStateDto(
    bool Enabled,
    string ValidationStatus,
    ClickUpWorkspaceDto? Workspace,
    ClickUpWorkspaceDto? Space,
    ClickUpWorkspaceDto? List,
    ClickUpCustomItemDto? CustomItem,
    Dictionary<string, string> Mappings,
    bool HasStoredToken,
    List<ClickUpFieldMappingDto> FieldMappings,
    Dictionary<string, string> StatusMappings,
    Dictionary<string, string> PriorityMappings,
    Dictionary<string, Dictionary<string, string>> CustomFieldValueMappings,
    bool SyncStatus);
public record ClickUpValidationResultDto(bool Success, string ValidationStatus, List<ClickUpWorkspaceDto> Workspaces, bool HasStoredToken);
public record ClickUpWorkspaceDto(string Id, string Name);
public record ClickUpCustomItemDto(string Id, string Name);
public record ClickUpWorkspaceApiModel(string Id, string Name);
public record ClickUpWorkspacesApiResponse(List<ClickUpTeamApiModel>? Teams);
public record ClickUpTeamApiModel(string Id, string Name);
public record ClickUpSpacesApiResponse(List<ClickUpWorkspaceApiModel>? Spaces);
public record ClickUpSpaceMetadataDto(List<ClickUpFieldMetadataDto> Fields, List<ClickUpStatusOptionDto> Statuses, List<ClickUpPriorityOptionDto> Priorities);
public record ClickUpFieldMetadataDto(string Id, string Name, string Type, bool Required, bool IsSystemField, List<ClickUpSelectOptionDto> Options);
public record ClickUpSelectOptionDto(string Value, string Label);
public record ClickUpStatusOptionDto(string Value, string Label);
public record ClickUpPriorityOptionDto(string Value, string Label);
public record ClickUpFieldMappingRequestDto(string? ClickUpFieldId, string? ClickUpFieldName, string? ClickUpFieldType, string? PeekQaFieldName, bool IsRequired, bool IsSystemField, Dictionary<string, string>? ValueMappings = null);
public record ClickUpFieldMappingDto(string ClickUpFieldId, string? ClickUpFieldName, string? ClickUpFieldType, string? PeekQaFieldName, bool IsRequired, bool IsSystemField, Dictionary<string, string>? ValueMappings = null);
public record ClickUpConfigurationParseResult(
    Dictionary<string, string> Mappings,
    List<ClickUpFieldMappingDto> FieldMappings,
    Dictionary<string, string> StatusMappings,
    Dictionary<string, string> PriorityMappings,
    ClickUpWorkspaceDto? List,
    ClickUpCustomItemDto? CustomItem,
    Dictionary<string, Dictionary<string, string>> CustomFieldValueMappings,
    bool SyncStatus);
public record ClickUpDefectSyncRequest(string? ParentTaskId, string? ListId = null, string? CustomItemId = null);
public record ClickUpDefectSyncResponse(string TaskId, string? TaskUrl, string ListId, string ListName, string? ParentTaskId, bool LinkedExisting = false, string? Status = null);
