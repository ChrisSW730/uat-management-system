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

        var (syncSucceeded, statusWasUpdatedFromClickUp) = await SyncDefectDetailsFromClickUpAsync(defect, config, token);
        var requestedLinkedTaskIds = (request.LinkedTaskIds ?? new List<string>())
            .Select(ExtractTaskIdFromLink)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

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
        var reconciliationListId = !string.IsNullOrWhiteSpace(defect.ClickUpListId)
            ? defect.ClickUpListId
            : targetList.Id;
        configuredFieldMappings = await ReconcileConfiguredFieldMappingsAsync(configuredFieldMappings, config, user.ClickUpSpaceId, reconciliationListId, token);
        configuredFieldMappings = await EnsureCriticalLongTextMappingsAsync(configuredFieldMappings, user.ClickUpSpaceId, reconciliationListId, token);
        var assigneeSource = ResolveConfiguredPeekQaFieldValue(defect, configuredFieldMappings, "assignees") ?? defect.AssignedTo;
        var assignees = await ResolveAssigneesAsync(assigneeSource, user.ClickUpWorkspaceId, token);
        var preserveLocalAssignedTo = !string.IsNullOrWhiteSpace((assigneeSource ?? string.Empty).Trim()) && assignees.Count == 0;
        var effectiveCustomItemId = targetCustomItemId ?? string.Empty;
        var createTaskPayload = BuildCreateTaskPayload(defect, config, configuredFieldMappings, normalizedParentTaskId, assignees, effectiveCustomItemId);
        var selectedListName = !string.IsNullOrWhiteSpace(targetList.Name) ? targetList.Name : targetList.Id;
        var selectedCustomItemName = string.IsNullOrWhiteSpace(effectiveCustomItemId)
            ? (config.CustomItem?.Name ?? defect.ClickUpCustomItemName ?? string.Empty)
            : await ResolveCustomItemNameAsync(user.ClickUpWorkspaceId, effectiveCustomItemId, token, config.CustomItem?.Name ?? defect.ClickUpCustomItemName);

        async Task<IActionResult?> LinkSyncedTaskAsync(string taskId)
        {
            if (requestedLinkedTaskIds.Count == 0)
            {
                return null;
            }

            foreach (var requestedLinkedTaskId in requestedLinkedTaskIds)
            {
                var normalizedLinkedTaskId = NormalizeToken(requestedLinkedTaskId);
                if (string.IsNullOrWhiteSpace(normalizedLinkedTaskId) || string.Equals(normalizedLinkedTaskId, taskId, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var linkResponse = await CallClickUpAsync($"/task/{taskId}/link/{normalizedLinkedTaskId}", token, HttpMethod.Post);
                if (!linkResponse.IsSuccessStatusCode)
                {
                    return await BuildClickUpErrorResponse(linkResponse, "link-task", "We could not link one or more ClickUp tasks for this defect.");
                }
            }

            return null;
        }

        if (!string.IsNullOrWhiteSpace(defect.ClickUpTaskId))
        {
            var (_, statusWasUpdatedFromCurrentTask) = await SyncDefectDetailsFromClickUpAsync(defect, config, token);
            if (statusWasUpdatedFromCurrentTask)
            {
                createTaskPayload.Remove("status");
            }

            var updatedPersistedTask = await UpdateExistingClickUpTaskAsync(defect.ClickUpTaskId, createTaskPayload, token);
            if (!string.IsNullOrWhiteSpace(updatedPersistedTask.ErrorMessage))
            {
                return StatusCode(502, new
                {
                    message = updatedPersistedTask.ErrorMessage,
                    fieldId = updatedPersistedTask.FailedFieldId,
                });
            }

            var persistedCustomItemId = string.IsNullOrWhiteSpace(defect.ClickUpCustomItemId) ? effectiveCustomItemId : defect.ClickUpCustomItemId;
            var persistedCustomItemName = string.IsNullOrWhiteSpace(defect.ClickUpCustomItemName) ? selectedCustomItemName : defect.ClickUpCustomItemName;
            ApplyClickUpLink(defect, defect.ClickUpTaskId, updatedPersistedTask.Url, defect.ClickUpListId, defect.ClickUpListName, defect.ClickUpParentTaskId, defect.ClickUpParentTaskName, persistedCustomItemId, persistedCustomItemName);

            var linkResponse = await LinkSyncedTaskAsync(defect.ClickUpTaskId);
            if (linkResponse != null)
            {
                return linkResponse;
            }

            if (preserveLocalAssignedTo)
            {
                defect.AssignedToUpdatedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync();
            return Ok(new ClickUpDefectSyncResponse(defect.ClickUpTaskId, updatedPersistedTask.Url, defect.ClickUpListId, defect.ClickUpListName, string.IsNullOrWhiteSpace(defect.ClickUpParentTaskId) ? null : defect.ClickUpParentTaskId, true, Status: defect.Status, AssignedTo: defect.AssignedTo));
        }

        var existingTask = await FindTaskByExactNameAsync(targetList.Id, targetTaskName, normalizedParentTaskId, token);

        if (existingTask != null)
        {
            var (_, statusWasUpdatedFromCurrentTask) = await SyncDefectDetailsFromClickUpAsync(defect, config, token);
            if (statusWasUpdatedFromCurrentTask)
            {
                createTaskPayload.Remove("status");
            }

            var updatedExistingTask = await UpdateExistingClickUpTaskAsync(existingTask.Id, createTaskPayload, token);
            if (!string.IsNullOrWhiteSpace(updatedExistingTask.ErrorMessage))
            {
                return StatusCode(502, new
                {
                    message = updatedExistingTask.ErrorMessage,
                    fieldId = updatedExistingTask.FailedFieldId,
                });
            }

            ApplyClickUpLink(defect, existingTask.Id, updatedExistingTask.Url ?? existingTask.Url, targetList.Id, selectedListName, normalizedParentTaskId, existingTask.ParentTaskName, effectiveCustomItemId, selectedCustomItemName);

            var linkResponse = await LinkSyncedTaskAsync(existingTask.Id);
            if (linkResponse != null)
            {
                return linkResponse;
            }

            if (preserveLocalAssignedTo)
            {
                defect.AssignedToUpdatedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync();
            return Ok(new ClickUpDefectSyncResponse(existingTask.Id, updatedExistingTask.Url ?? existingTask.Url, targetList.Id, selectedListName, normalizedParentTaskId, true, Status: defect.Status, AssignedTo: defect.AssignedTo));
        }

        var createResponse = await CallClickUpAsync($"/list/{targetList.Id}/task", token, HttpMethod.Post, createTaskPayload.ToJsonString());
        if (!createResponse.IsSuccessStatusCode)
        {
            return await BuildClickUpErrorResponse(createResponse, "create-task", "We could not create the ClickUp task for this defect.");
        }

        var responseJson = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var taskId = GetString(responseJson, "id", "task_id") ?? string.Empty;
        var taskUrl = GetString(responseJson, "url", "task_url");

        var createCustomFieldUpdates = ExtractCustomFieldUpdates(createTaskPayload);
        if (createCustomFieldUpdates.Count > 0)
        {
            var customFieldUpsert = await UpsertTaskCustomFieldsAsync(
                taskId,
                createCustomFieldUpdates,
                new Dictionary<string, JsonNode?>(StringComparer.OrdinalIgnoreCase),
                token);

            if (!customFieldUpsert.Success)
            {
                return StatusCode(502, new
                {
                    message = customFieldUpsert.ErrorMessage ?? "ClickUp rejected the custom field update.",
                    fieldId = customFieldUpsert.FailedFieldId,
                });
            }
        }

        var listName = !string.IsNullOrWhiteSpace(targetList.Name) ? targetList.Name : GetString(responseJson, "list", "name") ?? targetList.Id;
        var parentTaskName = await ResolveParentTaskNameAsync(targetList.Id, normalizedParentTaskId, token);
        ApplyClickUpLink(defect, taskId, taskUrl, targetList.Id, listName, normalizedParentTaskId, parentTaskName, effectiveCustomItemId, selectedCustomItemName);

        var createdLinkResponse = await LinkSyncedTaskAsync(taskId);
        if (createdLinkResponse != null)
        {
            return createdLinkResponse;
        }

        if (preserveLocalAssignedTo)
        {
            defect.AssignedToUpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        return Ok(new ClickUpDefectSyncResponse(taskId, taskUrl, targetList.Id, listName, normalizedParentTaskId, false, Status: defect.Status, AssignedTo: defect.AssignedTo));
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

    [HttpGet("defects/{defectId:int}/links")]
    public async Task<IActionResult> GetDefectClickUpLinks(int defectId)
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

        var defect = await _db.Defects.FirstOrDefaultAsync(d => d.Id == defectId);
        if (defect == null)
        {
            return NotFound("Defect not found.");
        }

        if (string.IsNullOrWhiteSpace(defect.ClickUpTaskId))
        {
            return Ok(new ClickUpDefectLinkedTasksResponse(new List<string>()));
        }

        var response = await CallClickUpAsync($"/task/{defect.ClickUpTaskId}", token);
        if (!response.IsSuccessStatusCode)
        {
            return await BuildClickUpErrorResponse(response, "linked-tasks", "We could not load the linked ClickUp tasks for this defect.");
        }

        var taskJson = await response.Content.ReadFromJsonAsync<JsonElement>();
        var linkedTaskIds = GetLinkedTaskIds(taskJson)
            .Where(id => !string.Equals(id, defect.ClickUpTaskId, StringComparison.OrdinalIgnoreCase))
            .ToList();

        return Ok(new ClickUpDefectLinkedTasksResponse(linkedTaskIds));
    }

    [HttpDelete("defects/{defectId:int}/links/{linkedTaskId}")]
    public async Task<IActionResult> UnlinkDefectTaskLink(int defectId, string linkedTaskId)
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

        var defect = await _db.Defects.FirstOrDefaultAsync(d => d.Id == defectId);
        if (defect == null)
        {
            return NotFound("Defect not found.");
        }

        if (string.IsNullOrWhiteSpace(defect.ClickUpTaskId))
        {
            return BadRequest("This defect is not linked to ClickUp.");
        }

        var normalizedLinkedTaskId = ExtractTaskIdFromLink(linkedTaskId);
        if (string.IsNullOrWhiteSpace(normalizedLinkedTaskId))
        {
            return BadRequest("A valid linked ClickUp task id is required.");
        }

        if (string.Equals(normalizedLinkedTaskId, defect.ClickUpTaskId, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("A ClickUp task cannot be unlinked from itself.");
        }

        var response = await CallClickUpAsync($"/task/{defect.ClickUpTaskId}/link/{normalizedLinkedTaskId}", token, HttpMethod.Delete);
        if (!response.IsSuccessStatusCode)
        {
            return await BuildClickUpErrorResponse(response, "unlink-task", "We could not unlink the ClickUp task for this defect.");
        }

        return NoContent();
    }

    [HttpPost("defects/sync-open-linked")]
    public async Task<IActionResult> SyncOpenLinkedDefectsFromClickUp()
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

        var defectCandidates = await _db.Defects
            .AsNoTracking()
            .Where(d => !string.IsNullOrWhiteSpace(d.ClickUpTaskId)
                && !string.IsNullOrWhiteSpace(d.Status)
                && d.Status.Trim().ToUpper() != "CLOSED")
            .OrderByDescending(d => d.CreatedAt)
            .Select(d => new { d.Id, d.DefectNumber })
            .ToListAsync();

        var syncedDefectIds = new List<int>();
        var failures = new List<ClickUpBulkDefectSyncFailureDto>();

        foreach (var defectCandidate in defectCandidates)
        {
            var defect = await _db.Defects.FirstOrDefaultAsync(d => d.Id == defectCandidate.Id);
            if (defect == null)
            {
                failures.Add(new ClickUpBulkDefectSyncFailureDto(
                    defectCandidate.Id,
                    defectCandidate.DefectNumber,
                    "Defect not found."));
                continue;
            }

            var (synced, _) = await SyncDefectDetailsFromClickUpAsync(defect, config, token);
            if (synced)
            {
                syncedDefectIds.Add(defectCandidate.Id);
                continue;
            }

            failures.Add(new ClickUpBulkDefectSyncFailureDto(
                defectCandidate.Id,
                defectCandidate.DefectNumber,
                "We could not refresh the linked ClickUp task details for this defect."));
        }

        return Ok(new ClickUpBulkDefectSyncBatchResponse(
            defectCandidates.Count,
            syncedDefectIds.Count,
            failures.Count,
            syncedDefectIds,
            failures));
    }

    private async Task<(bool Success, bool StatusWasUpdated)> SyncDefectDetailsFromClickUpAsync(Defect defect, ClickUpConfigurationParseResult config, string token)
    {
        if (string.IsNullOrWhiteSpace(defect.ClickUpTaskId))
        {
            return (false, false);
        }

        var currentTaskResponse = await CallClickUpAsync($"/task/{defect.ClickUpTaskId}", token);
        if (!currentTaskResponse.IsSuccessStatusCode)
        {
            return (false, false);
        }

        var currentTaskJson = await currentTaskResponse.Content.ReadFromJsonAsync<JsonElement>();
        var clickStatus = GetTaskStatusFromTask(currentTaskJson);
        var clickUpdatedAt = GetTaskLastUpdatedUtc(currentTaskJson);

        if (!string.IsNullOrWhiteSpace(clickStatus) && clickUpdatedAt.HasValue && (defect.StatusUpdatedAt == null || clickUpdatedAt > defect.StatusUpdatedAt))
        {
            var statusMappings = config.StatusMappings ?? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            var mappedPeekQaStatus = statusMappings
                .Where(kvp => !string.IsNullOrWhiteSpace(kvp.Value))
                .FirstOrDefault(kvp => string.Equals(kvp.Value, clickStatus, StringComparison.OrdinalIgnoreCase)).Key;

            if (string.IsNullOrWhiteSpace(mappedPeekQaStatus))
            {
                // ClickUp status has no configured PeekQA mapping. Leave the current PeekQA status as-is and continue syncing other fields.
                if (clickUpdatedAt.HasValue)
                {
                    await SyncAssignedToFromClickUpTaskAsync(defect, currentTaskJson, clickUpdatedAt.Value);
                }

                return (true, false);
            }

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
            await _db.SaveChangesAsync();
            return (true, true);
        }

        if (clickUpdatedAt.HasValue)
        {
            await SyncAssignedToFromClickUpTaskAsync(defect, currentTaskJson, clickUpdatedAt.Value);
        }

        return (true, false);
    }

    private static string ExtractActionResultMessage(IActionResult actionResult)
    {
        return actionResult switch
        {
            ObjectResult objectResult when objectResult.Value is string message && !string.IsNullOrWhiteSpace(message)
                => message,
            ObjectResult objectResult when objectResult.Value is not null
                => objectResult.Value.ToString() ?? $"ClickUp sync failed with status code {objectResult.StatusCode ?? 500}.",
            StatusCodeResult statusCodeResult
                => $"ClickUp sync failed with status code {statusCodeResult.StatusCode}.",
            _ => "ClickUp sync failed.",
        };
    }

    private sealed record ClickUpTaskLookupDto(string Id, string Name, string? Url, string? ParentTaskId, string? ParentTaskName);

    private sealed record ClickUpTaskUpdateResult(string? Url, string? ErrorMessage = null, string? FailedFieldId = null);

    private sealed record ClickUpCustomFieldUpdate(string FieldId, JsonNode? Value);

    private sealed record ClickUpCustomFieldUpsertResult(bool Success, string? ErrorMessage = null, string? FailedFieldId = null);

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

    private static List<string> GetLinkedTaskIds(JsonElement task)
    {
        var linkedTaskIds = new List<string>();
        if (!task.TryGetProperty("linked_tasks", out var linkedTasksElement) || linkedTasksElement.ValueKind != JsonValueKind.Array)
        {
            return linkedTaskIds;
        }

        foreach (var linkedTask in linkedTasksElement.EnumerateArray())
        {
            string? linkedTaskId = linkedTask.ValueKind switch
            {
                JsonValueKind.String => linkedTask.GetString(),
                JsonValueKind.Number => linkedTask.ToString(),
                JsonValueKind.Object => GetString(linkedTask, "task_id", "taskId", "id", "links_to"),
                _ => null,
            };

            linkedTaskId = NormalizeToken(linkedTaskId);
            if (!string.IsNullOrWhiteSpace(linkedTaskId) && !linkedTaskIds.Contains(linkedTaskId, StringComparer.OrdinalIgnoreCase))
            {
                linkedTaskIds.Add(linkedTaskId);
            }
        }

        return linkedTaskIds;
    }

    private async Task<ClickUpTaskUpdateResult> UpdateExistingClickUpTaskAsync(string taskId, JsonObject createTaskPayload, string token)
    {
        var currentTaskResponse = await CallClickUpAsync($"/task/{taskId}", token);
        if (!currentTaskResponse.IsSuccessStatusCode)
        {
            var body = await currentTaskResponse.Content.ReadAsStringAsync();
            var detail = GetFriendlyClickUpErrorMessage(currentTaskResponse.StatusCode, body, "We could not load the linked ClickUp task.");
            return new ClickUpTaskUpdateResult(null, detail);
        }

        using var currentTaskDocument = JsonDocument.Parse(await currentTaskResponse.Content.ReadAsStringAsync());
        var currentTask = currentTaskDocument.RootElement.Clone();

        var updatePayload = JsonNode.Parse(createTaskPayload.ToJsonString())?.AsObject() ?? new JsonObject();
        var shouldUpdateAssignees = updatePayload.TryGetPropertyValue("assignees", out var assigneesNode)
            && assigneesNode is JsonArray;
        var desiredAssigneeIds = shouldUpdateAssignees ? ExtractAssigneeIds(updatePayload) : new List<string>();
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
                var body = await updateResponse.Content.ReadAsStringAsync();
                var detail = GetFriendlyClickUpErrorMessage(updateResponse.StatusCode, body, "We could not update the linked ClickUp task.");
                return new ClickUpTaskUpdateResult(null, detail);
            }

            var updatedTaskJson = await updateResponse.Content.ReadFromJsonAsync<JsonElement>();
            latestTaskSnapshot = updatedTaskJson;
        }

        if (shouldUpdateAssignees)
        {
            var currentAssigneeIds = GetCurrentTaskAssigneeIds(currentTask);
            if (!await ReplaceTaskAssigneesAsync(taskId, desiredAssigneeIds, currentAssigneeIds, token))
            {
                return new ClickUpTaskUpdateResult(null, "We could not sync assignees for the linked ClickUp task.");
            }
        }

        var currentCustomFieldValues = GetCurrentTaskCustomFieldValues(currentTask);
        var customFieldUpsert = await UpsertTaskCustomFieldsAsync(taskId, customFieldUpdates, currentCustomFieldValues, token);
        if (!customFieldUpsert.Success)
        {
            return new ClickUpTaskUpdateResult(null, customFieldUpsert.ErrorMessage ?? "We could not sync one or more mapped ClickUp custom fields for this defect.", customFieldUpsert.FailedFieldId);
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

        // Preferred payload shape follows ClickUp's documented assignee update structure.
        var structuredPayload = new JsonObject
        {
            ["assignees"] = new JsonObject
            {
                ["add"] = BuildAssigneeArray(addAssignees),
                ["rem"] = BuildAssigneeArray(removeAssignees),
            },
        };

        if (await TryUpdateTaskAssigneesAsync(taskId, token, structuredPayload, desired))
        {
            return true;
        }

        // Fallback for legacy payload variants used by some integrations.
        var legacyPayload = new JsonObject();
        if (addAssignees.Count > 0)
        {
            legacyPayload["add_assignees"] = BuildAssigneeArray(addAssignees);
        }

        if (removeAssignees.Count > 0)
        {
            legacyPayload["rem_assignees"] = BuildAssigneeArray(removeAssignees);
        }

        return await TryUpdateTaskAssigneesAsync(taskId, token, legacyPayload, desired);
    }

    private async Task<bool> TryUpdateTaskAssigneesAsync(string taskId, string token, JsonObject payload, HashSet<string> desiredAssignees)
    {
        var updateAssigneesResponse = await CallClickUpAsync($"/task/{taskId}", token, HttpMethod.Put, payload.ToJsonString());
        if (!updateAssigneesResponse.IsSuccessStatusCode)
        {
            return false;
        }

        // Verify the task now has the intended assignee set.
        var verifyResponse = await CallClickUpAsync($"/task/{taskId}", token);
        if (!verifyResponse.IsSuccessStatusCode)
        {
            return false;
        }

        var verifyTask = await verifyResponse.Content.ReadFromJsonAsync<JsonElement>();
        var actualAssignees = new HashSet<string>(GetCurrentTaskAssigneeIds(verifyTask), StringComparer.OrdinalIgnoreCase);
        return actualAssignees.SetEquals(desiredAssignees);
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

    private async Task<ClickUpCustomFieldUpsertResult> UpsertTaskCustomFieldsAsync(string taskId, IReadOnlyCollection<ClickUpCustomFieldUpdate> fieldUpdates, IReadOnlyDictionary<string, JsonNode?> currentFieldValues, string token)
    {
        var availableFieldValues = currentFieldValues;
        if (availableFieldValues.Count == 0)
        {
            var taskResponse = await CallClickUpAsync($"/task/{taskId}", token);
            if (taskResponse.IsSuccessStatusCode)
            {
                using var taskDocument = JsonDocument.Parse(await taskResponse.Content.ReadAsStringAsync());
                availableFieldValues = GetCurrentTaskCustomFieldValues(taskDocument.RootElement);
            }
        }

        foreach (var field in fieldUpdates)
        {
            if (availableFieldValues.TryGetValue(field.FieldId, out var currentValue)
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
                var body = await response.Content.ReadAsStringAsync();
                var detail = GetFriendlyClickUpErrorMessage(response.StatusCode, body, "ClickUp rejected the custom field update.");

                if (IsTaskLocationHierarchyFieldError(detail))
                {
                    continue;
                }

                return new ClickUpCustomFieldUpsertResult(false, detail, field.FieldId);
            }
        }

        return new ClickUpCustomFieldUpsertResult(true);
    }

    private static bool IsTaskLocationHierarchyFieldError(string? message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return false;
        }

        return message.Contains("Custom field does not exist in the task location hierarchy", StringComparison.OrdinalIgnoreCase)
            || message.Contains("custom field does not exist", StringComparison.OrdinalIgnoreCase)
            || message.Contains("field does not exist", StringComparison.OrdinalIgnoreCase);
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
        var resolvedDescription = mappedDescription ?? defect.Description ?? string.Empty;

        var payload = new JsonObject
        {
            ["name"] = string.IsNullOrWhiteSpace(mappedName) ? (string.IsNullOrWhiteSpace(defect.Title) ? defect.DefectNumber : defect.Title) : mappedName,
            ["description"] = resolvedDescription,
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
        var mappedPriority = string.Empty;
        var hasMappedPriority = !string.IsNullOrWhiteSpace(normalizedPriority)
            && config.PriorityMappings.TryGetValue(normalizedPriority, out mappedPriority)
            && !string.IsNullOrWhiteSpace(mappedPriority);

        if (!hasMappedPriority && !string.IsNullOrWhiteSpace(normalizedPriority))
        {
            hasMappedPriority = TryResolveDefaultClickUpPriority(normalizedPriority, out mappedPriority);
        }

        if (hasMappedPriority && !string.IsNullOrWhiteSpace(mappedPriority))
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

            if (string.IsNullOrWhiteSpace(mappedValue))
            {
                continue;
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

    private async Task<Dictionary<string, string>> ReconcileConfiguredFieldMappingsAsync(
        Dictionary<string, string> configuredFieldMappings,
        ClickUpConfigurationParseResult config,
        string? spaceId,
        string? listId,
        string token)
    {
        if (config.FieldMappings.Count == 0
            || configuredFieldMappings.Count == 0)
        {
            return configuredFieldMappings;
        }

        var liveFields = new List<ClickUpFieldMetadataDto>();
        if (!string.IsNullOrWhiteSpace(listId))
        {
            liveFields = await LoadCustomFieldsForListAsync(listId, token);
        }

        if (liveFields.Count == 0 && !string.IsNullOrWhiteSpace(spaceId))
        {
            liveFields = await LoadCustomFieldsAsync(spaceId, token);
        }

        if (liveFields.Count == 0)
        {
            return configuredFieldMappings;
        }

        var liveIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var liveIdByName = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var liveFieldByName = new Dictionary<string, ClickUpFieldMetadataDto>(StringComparer.OrdinalIgnoreCase);

        foreach (var field in liveFields)
        {
            var liveId = field.Id?.Trim();
            var liveName = field.Name?.Trim();
            if (string.IsNullOrWhiteSpace(liveId) || string.IsNullOrWhiteSpace(liveName))
            {
                continue;
            }

            liveIds.Add(liveId);
            if (!liveFieldByName.TryGetValue(liveName, out var existingByName)
                || (!existingByName.HasAppliedObjects && field.HasAppliedObjects))
            {
                liveFieldByName[liveName] = field;
                liveIdByName[liveName] = liveId;
            }
        }

        foreach (var mapping in config.FieldMappings)
        {
            var configuredId = mapping.ClickUpFieldId?.Trim();
            var configuredName = mapping.ClickUpFieldName?.Trim();
            var peekQaField = mapping.PeekQaFieldName?.Trim();

            if (string.IsNullOrWhiteSpace(configuredId)
                || string.IsNullOrWhiteSpace(configuredName)
                || string.IsNullOrWhiteSpace(peekQaField)
                || SystemClickUpFieldIds.Contains(configuredId)
                || liveIds.Contains(configuredId)
                || !liveIdByName.TryGetValue(configuredName, out var liveId)
                || string.IsNullOrWhiteSpace(liveId))
            {
                continue;
            }

            configuredFieldMappings.Remove(configuredId);
            configuredFieldMappings[liveId] = peekQaField;
        }

        // Fallback: if persisted metadata is missing/outdated, remap stale IDs by PeekQA field label.
        // This helps when ClickUp recreated field IDs after a type change (e.g. Text -> Long Text).
        var staleEntries = configuredFieldMappings
            .Where(entry => !SystemClickUpFieldIds.Contains(entry.Key) && !liveIds.Contains(entry.Key))
            .ToList();

        foreach (var staleEntry in staleEntries)
        {
            var peekQaField = staleEntry.Value?.Trim();
            if (string.IsNullOrWhiteSpace(peekQaField))
            {
                continue;
            }

            if (!liveIdByName.TryGetValue(peekQaField, out var liveId) || string.IsNullOrWhiteSpace(liveId))
            {
                continue;
            }

            configuredFieldMappings.Remove(staleEntry.Key);
            configuredFieldMappings[liveId] = peekQaField;
        }

        return configuredFieldMappings;
    }

    private async Task<Dictionary<string, string>> EnsureCriticalLongTextMappingsAsync(
        Dictionary<string, string> configuredFieldMappings,
        string? spaceId,
        string? listId,
        string token)
    {
        var liveFields = new List<ClickUpFieldMetadataDto>();
        if (!string.IsNullOrWhiteSpace(listId))
        {
            liveFields = await LoadCustomFieldsForListAsync(listId, token);
        }

        if (liveFields.Count == 0 && !string.IsNullOrWhiteSpace(spaceId))
        {
            liveFields = await LoadCustomFieldsAsync(spaceId, token);
        }

        if (liveFields.Count == 0)
        {
            return configuredFieldMappings;
        }

        static string NormalizeLabel(string value)
        {
            var chars = value.Where(char.IsLetterOrDigit).ToArray();
            return new string(chars).ToLowerInvariant();
        }

        var fieldByNormalizedName = new Dictionary<string, ClickUpFieldMetadataDto>(StringComparer.OrdinalIgnoreCase);
        foreach (var field in liveFields)
        {
            var id = field.Id?.Trim();
            var name = field.Name?.Trim();
            if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(name))
            {
                continue;
            }

            var key = NormalizeLabel(name);
            if (!fieldByNormalizedName.TryGetValue(key, out var existing)
                || (!existing.HasAppliedObjects && field.HasAppliedObjects))
            {
                fieldByNormalizedName[key] = field;
            }
        }

        string? FindPreferredFieldId(params string[] candidateNames)
        {
            foreach (var candidate in candidateNames)
            {
                var key = NormalizeLabel(candidate);
                if (!fieldByNormalizedName.TryGetValue(key, out var field) || string.IsNullOrWhiteSpace(field.Id))
                {
                    continue;
                }

                return field.Id;
            }

            return null;
        }

        void EnsureMapping(string peekQaField, params string[] candidateNames)
        {
            var preferredFieldId = FindPreferredFieldId(candidateNames);
            if (string.IsNullOrWhiteSpace(preferredFieldId))
            {
                return;
            }

            var currentlyMappedIds = configuredFieldMappings
                .Where(entry => string.Equals(entry.Value?.Trim(), peekQaField, StringComparison.OrdinalIgnoreCase))
                .Select(entry => entry.Key)
                .ToList();

            foreach (var mappedId in currentlyMappedIds)
            {
                if (!string.Equals(mappedId, preferredFieldId, StringComparison.OrdinalIgnoreCase))
                {
                    configuredFieldMappings.Remove(mappedId);
                }
            }

            configuredFieldMappings[preferredFieldId] = peekQaField;
        }

        EnsureMapping("Expected Result", "Expected Result", "Expected", "ExpectedResult");
        EnsureMapping("Actual Result", "Actual Result", "Actual", "ActualResult");

        return configuredFieldMappings;
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
        if (string.IsNullOrWhiteSpace(assignedIdentity))
        {
            return ids;
        }

        var assignedDisplayName = assignedIdentity.Trim();
        var assignedUser = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.IsActive && (u.DisplayName == assignedDisplayName || u.Username == assignedDisplayName));
        var assignedEmail = ResolvePreferredAssigneeEmail(assignedDisplayName, assignedUser?.Username);
        var identityCandidates = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        identityCandidates.Add(assignedDisplayName);

        if (!string.IsNullOrWhiteSpace(assignedUser?.Username))
        {
            identityCandidates.Add(assignedUser.Username.Trim());
        }

        if (!string.IsNullOrWhiteSpace(assignedUser?.DisplayName))
        {
            identityCandidates.Add(assignedUser.DisplayName.Trim());
        }

        if (identityCandidates.Count == 0)
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

            var teamsToSearch = teams.EnumerateArray().ToList();
            var preferredTeams = string.IsNullOrWhiteSpace(workspaceId)
                ? teamsToSearch
                : teamsToSearch.Where(team => string.Equals(GetString(team, "id"), workspaceId, StringComparison.OrdinalIgnoreCase)).ToList();

            foreach (var team in preferredTeams)
            {
                if (!team.TryGetProperty("members", out var members) || members.ValueKind != JsonValueKind.Array)
                {
                    continue;
                }

                foreach (var member in members.EnumerateArray())
                {
                    if (!member.TryGetProperty("user", out var userElement) || userElement.ValueKind != JsonValueKind.Object)
                    {
                        continue;
                    }

                    var email = GetString(userElement, "email");
                    var username = GetString(userElement, "username");
                    var fullName = GetString(userElement, "name");

                    var isMatchedIdentity = !string.IsNullOrWhiteSpace(assignedEmail)
                        ? string.Equals(email?.Trim(), assignedEmail, StringComparison.OrdinalIgnoreCase)
                        : IsIdentityMatch(identityCandidates, email)
                            || IsIdentityMatch(identityCandidates, username)
                            || IsIdentityMatch(identityCandidates, fullName)
                            || IsIdentityMatch(identityCandidates, GetEmailLocalPart(email));

                    if (!isMatchedIdentity)
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

            // Workspace can be stale or not aligned with the selected list; fallback to all teams.
            if (ids.Count == 0 && preferredTeams.Count != teamsToSearch.Count)
            {
                foreach (var team in teamsToSearch)
                {
                    if (!team.TryGetProperty("members", out var members) || members.ValueKind != JsonValueKind.Array)
                    {
                        continue;
                    }

                    foreach (var member in members.EnumerateArray())
                    {
                        if (!member.TryGetProperty("user", out var userElement) || userElement.ValueKind != JsonValueKind.Object)
                        {
                            continue;
                        }

                        var email = GetString(userElement, "email");
                        var username = GetString(userElement, "username");
                        var fullName = GetString(userElement, "name");

                        var isMatchedIdentity = !string.IsNullOrWhiteSpace(assignedEmail)
                            ? string.Equals(email?.Trim(), assignedEmail, StringComparison.OrdinalIgnoreCase)
                            : IsIdentityMatch(identityCandidates, email)
                                || IsIdentityMatch(identityCandidates, username)
                                || IsIdentityMatch(identityCandidates, fullName)
                                || IsIdentityMatch(identityCandidates, GetEmailLocalPart(email));

                        if (!isMatchedIdentity)
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
        }
        catch
        {
            return ids;
        }

        return ids;
    }

    private static bool IsIdentityMatch(IEnumerable<string> candidates, string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        var normalizedValue = NormalizeIdentity(value);
        foreach (var candidate in candidates)
        {
            if (string.IsNullOrWhiteSpace(candidate))
            {
                continue;
            }

            if (string.Equals(candidate, value, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            var normalizedCandidate = NormalizeIdentity(candidate);
            if (!string.IsNullOrWhiteSpace(normalizedCandidate)
                && !string.IsNullOrWhiteSpace(normalizedValue)
                && (string.Equals(normalizedCandidate, normalizedValue, StringComparison.Ordinal)
                    || normalizedCandidate.Contains(normalizedValue, StringComparison.Ordinal)
                    || normalizedValue.Contains(normalizedCandidate, StringComparison.Ordinal)))
            {
                return true;
            }
        }

        return false;
    }

    private static string NormalizeIdentity(string value)
    {
        var builder = new StringBuilder(value.Length);
        foreach (var ch in value)
        {
            if (char.IsLetterOrDigit(ch))
            {
                builder.Append(char.ToLowerInvariant(ch));
            }
        }

        return builder.ToString();
    }

    private static string? ResolvePreferredAssigneeEmail(string assignedIdentity, string? username)
    {
        static bool LooksLikeEmail(string value) => !string.IsNullOrWhiteSpace(value) && value.Contains('@');

        if (LooksLikeEmail(assignedIdentity))
        {
            return assignedIdentity.Trim();
        }

        if (LooksLikeEmail(username ?? string.Empty))
        {
            return username!.Trim();
        }

        return null;
    }

    private static string GetEmailLocalPart(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return string.Empty;
        }

        var atIndex = email.IndexOf('@');
        if (atIndex <= 0)
        {
            return email.Trim();
        }

        return email[..atIndex].Trim();
    }

    private async Task SyncAssignedToFromClickUpTaskAsync(Defect defect, JsonElement clickUpTask, DateTime clickUpdatedAt)
    {
        var localUpdatedAt = defect.AssignedToUpdatedAt ?? defect.CreatedAt;
        if (clickUpdatedAt <= localUpdatedAt)
        {
            return;
        }

        var resolvedAssignedTo = await ResolvePeekQaAssignedToFromClickUpTaskAsync(clickUpTask);
        var currentAssignedTo = (defect.AssignedTo ?? string.Empty).Trim();
        if (!string.Equals(currentAssignedTo, resolvedAssignedTo, StringComparison.OrdinalIgnoreCase))
        {
            _db.DefectAuditLogs.Add(new DefectAuditLog
            {
                DefectId = defect.Id,
                FieldName = "AssignedTo",
                OldValue = defect.AssignedTo,
                NewValue = resolvedAssignedTo,
                ChangedBy = "ClickUp",
                ChangedAt = clickUpdatedAt,
            });

            defect.AssignedTo = resolvedAssignedTo;
        }

        defect.AssignedToUpdatedAt = clickUpdatedAt;
        await _db.SaveChangesAsync();
    }

    private async Task<string> ResolvePeekQaAssignedToFromClickUpTaskAsync(JsonElement clickUpTask)
    {
        if (!clickUpTask.TryGetProperty("assignees", out var assigneesElement)
            || assigneesElement.ValueKind != JsonValueKind.Array)
        {
            return string.Empty;
        }

        var activeUsers = await _db.Users
            .AsNoTracking()
            .Where(u => u.IsActive)
            .Select(u => new { u.Username, u.DisplayName })
            .ToListAsync();

        foreach (var assignee in assigneesElement.EnumerateArray())
        {
            var assigneeUser = assignee;
            if (assignee.TryGetProperty("user", out var nestedUser) && nestedUser.ValueKind == JsonValueKind.Object)
            {
                assigneeUser = nestedUser;
            }

            var email = GetString(assigneeUser, "email");
            var username = GetString(assigneeUser, "username");
            var fullName = GetString(assigneeUser, "name");
            var id = GetString(assigneeUser, "id", "userid", "user_id");

            var matchedUser = activeUsers.FirstOrDefault(user =>
                (!string.IsNullOrWhiteSpace(email) && string.Equals(user.Username, email, StringComparison.OrdinalIgnoreCase))
                || (!string.IsNullOrWhiteSpace(username) && string.Equals(user.DisplayName, username, StringComparison.OrdinalIgnoreCase))
                || (!string.IsNullOrWhiteSpace(fullName) && string.Equals(user.DisplayName, fullName, StringComparison.OrdinalIgnoreCase))
                || (!string.IsNullOrWhiteSpace(username) && string.Equals(user.Username, username, StringComparison.OrdinalIgnoreCase)));

            if (!string.IsNullOrWhiteSpace(matchedUser?.DisplayName))
            {
                return matchedUser.DisplayName.Trim();
            }

            var fallback = fullName ?? username ?? email ?? id ?? string.Empty;
            if (!string.IsNullOrWhiteSpace(fallback))
            {
                return fallback.Trim();
            }
        }

        return string.Empty;
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

    private static bool TryResolveDefaultClickUpPriority(string normalizedPriority, out string mappedPriority)
    {
        mappedPriority = normalizedPriority switch
        {
            "Low" => "low",
            "Medium" => "normal",
            "High" => "high",
            "Critical" => "urgent",
            _ => string.Empty,
        };

        return !string.IsNullOrWhiteSpace(mappedPriority);
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
                var hasAppliedObjects = item.TryGetProperty("applied_objects", out var appliedObjectsElement)
                    && appliedObjectsElement.ValueKind == JsonValueKind.Array
                    && appliedObjectsElement.GetArrayLength() > 0;

                if (!string.IsNullOrWhiteSpace(id) && !string.IsNullOrWhiteSpace(name))
                {
                    fields.Add(new ClickUpFieldMetadataDto(id, name, type ?? "custom", isRequired, false, options, hasAppliedObjects));
                }
            }

            return fields;
        }
        catch
        {
            return new List<ClickUpFieldMetadataDto>();
        }
    }

    private async Task<List<ClickUpFieldMetadataDto>> LoadCustomFieldsForListAsync(string listId, string token)
    {
        var response = await CallClickUpAsync($"/list/{listId}/field", token);
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
                var hasAppliedObjects = item.TryGetProperty("applied_objects", out var appliedObjectsElement)
                    && appliedObjectsElement.ValueKind == JsonValueKind.Array
                    && appliedObjectsElement.GetArrayLength() > 0;

                if (!string.IsNullOrWhiteSpace(id) && !string.IsNullOrWhiteSpace(name))
                {
                    fields.Add(new ClickUpFieldMetadataDto(id, name, type ?? "custom", isRequired, false, options, hasAppliedObjects));
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
            new("pending_deployment", "Pending Deployment"),
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
            _ => TryExtractClickUpErrorDetail(responseBody) ?? fallbackMessage,
        };
    }

    private static string? TryExtractClickUpErrorDetail(string? responseBody)
    {
        if (string.IsNullOrWhiteSpace(responseBody))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(responseBody);
            var root = document.RootElement;

            foreach (var key in new[] { "err", "error", "message", "detail", "ECODE", "meta_err" })
            {
                if (root.TryGetProperty(key, out var value))
                {
                    if (value.ValueKind == JsonValueKind.String)
                    {
                        var text = value.GetString();
                        if (!string.IsNullOrWhiteSpace(text))
                        {
                            return text.Trim();
                        }
                    }
                    else
                    {
                        var raw = value.GetRawText();
                        if (!string.IsNullOrWhiteSpace(raw) && raw != "{}" && raw != "[]")
                        {
                            return raw;
                        }
                    }
                }
            }
        }
        catch
        {
            if (!string.IsNullOrWhiteSpace(responseBody))
            {
                return responseBody.Trim();
            }
        }

        return null;
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

    private static string? ExtractTaskIdFromLink(string? link)
    {
        var normalizedLink = NormalizeToken(link);
        if (string.IsNullOrWhiteSpace(normalizedLink))
        {
            return null;
        }

        if (Uri.TryCreate(normalizedLink, UriKind.Absolute, out var uri))
        {
            var segments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            for (var index = segments.Length - 1; index >= 0; index--)
            {
                if (!string.IsNullOrWhiteSpace(segments[index]) && !string.Equals(segments[index], "task", StringComparison.OrdinalIgnoreCase) && !string.Equals(segments[index], "link", StringComparison.OrdinalIgnoreCase))
                {
                    return segments[index];
                }
            }

            return null;
        }

        return normalizedLink;
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
public record ClickUpFieldMetadataDto(string Id, string Name, string Type, bool Required, bool IsSystemField, List<ClickUpSelectOptionDto> Options, bool HasAppliedObjects = false);
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
public record ClickUpDefectSyncRequest(string? ParentTaskId, string? ListId = null, string? CustomItemId = null, List<string>? LinkedTaskIds = null);
public record ClickUpDefectSyncResponse(string TaskId, string? TaskUrl, string ListId, string ListName, string? ParentTaskId, bool LinkedExisting = false, string? Status = null, string? AssignedTo = null);
public record ClickUpDefectLinkedTasksResponse(List<string> LinkedTaskIds);
public record ClickUpBulkDefectSyncFailureDto(int DefectId, string DefectNumber, string Message);
public record ClickUpBulkDefectSyncBatchResponse(int AttemptedCount, int SyncedCount, int FailedCount, List<int> SyncedDefectIds, List<ClickUpBulkDefectSyncFailureDto> Failures);
