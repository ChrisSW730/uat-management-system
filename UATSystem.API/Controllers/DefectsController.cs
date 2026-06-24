using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using UATSystem.API.Data;
using UATSystem.API.Models;

namespace UATSystem.API.Controllers;

[ApiController]
[Route("[controller]")]
[Authorize]
public class DefectsController : ControllerBase
{
    private readonly UATDbContext _db;
    private readonly IWebHostEnvironment _env;
    public DefectsController(UATDbContext db, IWebHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    private string UploadRoot
    {
        get
        {
            var root = _env.WebRootPath;
            if (string.IsNullOrWhiteSpace(root))
            {
                root = Path.Combine(_env.ContentRootPath, "wwwroot");
            }

            var dir = Path.Combine(root, "uploads", "defects");
            Directory.CreateDirectory(dir);
            return dir;
        }
    }

    private DefectAttachmentDto ToAttachmentDto(DefectAttachment a)
    {
        var fileUrl = Url.Action(nameof(GetAttachmentFile), null, new { id = a.DefectId, attachmentId = a.Id }, Request.Scheme, Request.Host.Value);
        return new DefectAttachmentDto(a.Id, a.FileName, a.ContentType, a.Size, a.UploadedBy, a.UploadedAt, fileUrl ?? string.Empty);
    }

    private string GetChangedBy()
    {
        if (Request.Headers.TryGetValue("X-User-Name", out var value) && !string.IsNullOrWhiteSpace(value))
        {
            return value.ToString();
        }
        return "Unknown";
    }

    private async Task<string> GetCurrentUserDisplayNameAsync()
    {
        var username = User.Identity?.Name;
        if (string.IsNullOrWhiteSpace(username) && Request.Headers.TryGetValue("X-User-Name", out var headerUser))
        {
            username = headerUser.ToString();
        }

        if (string.IsNullOrWhiteSpace(username))
        {
            return "Unknown";
        }

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == username);
        return user?.DisplayName ?? username;
    }

    private async Task NotifyUserByDisplayNameAsync(string? displayName, string message, string link)
    {
        var target = (displayName ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(target)) return;

        var lowered = target.ToLower();
        var recipient = await _db.Users
            .Where(u => u.IsActive)
            .FirstOrDefaultAsync(u => u.DisplayName.ToLower() == lowered);

        if (recipient == null) return;

        _db.UserNotifications.Add(new UserNotification
        {
            RecipientUserId = recipient.Id,
            Message = message,
            Link = link,
            IsRead = false,
            CreatedAt = DateTime.UtcNow,
        });
    }

    private async Task CreateMentionNotificationsAsync(string message, string actorDisplayName, string link, string defectNumber)
    {
        if (string.IsNullOrWhiteSpace(message)) return;

        var actorUserIdRaw = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int.TryParse(actorUserIdRaw, out var actorUserId);

        var activeUsers = await _db.Users
            .Where(u => u.IsActive && !string.IsNullOrWhiteSpace(u.DisplayName))
            .ToListAsync();

        var matchedIds = activeUsers
            .Where(u => u.Id != actorUserId && message.Contains($"@{u.DisplayName}", StringComparison.OrdinalIgnoreCase))
            .Select(u => u.Id)
            .Distinct()
            .ToList();

        if (matchedIds.Count == 0) return;

        var now = DateTime.UtcNow;
        foreach (var uid in matchedIds)
        {
            _db.UserNotifications.Add(new UserNotification
            {
                RecipientUserId = uid,
                Message = $"{actorDisplayName} mentioned you in a defect comment (Defect ID: {defectNumber}).",
                Link = link,
                IsRead = false,
                CreatedAt = now,
            });
        }
    }

    private static string AuditDate(DateTime value) => value.ToString("o");
    private static string AuditDate(DateTime? value) => value?.ToString("o") ?? string.Empty;

    private void AddAudit(Defect defect, string fieldName, string oldValue, string newValue, string changedBy)
    {
        if (oldValue == newValue)
        {
            return;
        }

        _db.DefectAuditLogs.Add(new DefectAuditLog
        {
            DefectId = defect.Id,
            FieldName = fieldName,
            OldValue = oldValue,
            NewValue = newValue,
            ChangedBy = changedBy,
            ChangedAt = DateTime.UtcNow,
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await _db.Defects
            .Include(d => d.Comments)
            .OrderByDescending(d => d.CreatedAt)
            .ToListAsync());

    [HttpPost]
    [Authorize(Roles = "Admin,Test Lead,Tester")]
    public async Task<IActionResult> Create(CreateDefectDto dto)
    {
        if (!dto.TestRunId.HasValue && dto.TestCaseId.HasValue)
        {
            return BadRequest("TestCaseId cannot be provided without TestRunId.");
        }

        TestRun? run = null;
        if (dto.TestRunId.HasValue)
        {
            run = await _db.TestRuns.FirstOrDefaultAsync(r => r.Id == dto.TestRunId.Value);
            if (run == null) return NotFound("Test run not found.");
        }

        TestRunEntry? entry = null;
        if (dto.TestRunId.HasValue && dto.TestCaseId.HasValue)
        {
            entry = await _db.TestRunEntries
                .Include(e => e.TestCase)
                .Include(e => e.TestRun)
                .FirstOrDefaultAsync(e => e.TestRunId == dto.TestRunId.Value && e.TestCaseId == dto.TestCaseId.Value);

            if (entry == null) return NotFound("Test run entry not found.");
        }

        var count = await _db.Defects.CountAsync();
        var now = DateTime.UtcNow;
        var defect = new Defect
        {
            DefectNumber = $"DEF-{(count + 1):D3}",
            TestRunEntryId = entry?.Id,
            TestPlanId = dto.TestPlanId,
            RunNumber = entry?.TestRun.RunNumber ?? run?.RunNumber ?? "-",
            TcNumber = entry?.TestCase.TcNumber ?? "-",
            Market = dto.Market,
            Description = dto.Description,
            IssueType = dto.IssueType,
            ExpectedResult = dto.ExpectedResult,
            ActualResult = dto.ActualResult,
            Priority = dto.Priority,
            Status = "New",
            RaisedBy = dto.RaisedBy,
            AssignedTo = dto.AssignedTo,
            DateRaised = now,
            OpenDateTime = now,
            CloseDateTime = null,
            TargetFixDate = dto.TargetFixDate,
            Remarks = dto.Remarks,
            CreatedAt = now,
        };
        _db.Defects.Add(defect);
        await _db.SaveChangesAsync();

        if (!string.IsNullOrWhiteSpace(defect.AssignedTo))
        {
            var actorDisplayName = await GetCurrentUserDisplayNameAsync();
            await NotifyUserByDisplayNameAsync(
                defect.AssignedTo,
                $"{actorDisplayName} assigned {defect.DefectNumber} to you.",
                $"/defects/{defect.Id}"
            );
            await _db.SaveChangesAsync();
        }

        return Ok(defect);
    }

    [HttpPatch("{id}/status")]
    [Authorize(Roles = "Admin,Test Lead,Tester,Developer")]
    public async Task<IActionResult> UpdateStatus(int id, UpdateStatusDto dto)
    {
        var defect = await _db.Defects.FindAsync(id);
        if (defect == null) return NotFound();

        var changedBy = GetChangedBy();
        AddAudit(defect, "Status", defect.Status, dto.Status, changedBy);

        var oldClose = defect.CloseDateTime;
        if (dto.Status == "Closed")
        {
            defect.CloseDateTime = DateTime.UtcNow;
        }
        else
        {
            defect.CloseDateTime = null;
        }

        AddAudit(defect, "CloseDateTime", AuditDate(oldClose), AuditDate(defect.CloseDateTime), changedBy);
        defect.Status = dto.Status;

        await _db.SaveChangesAsync();
        return Ok(defect);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Test Lead,Tester")]
    public async Task<IActionResult> UpdateDefect(int id, UpdateDefectDto dto)
    {
        var defect = await _db.Defects.FindAsync(id);
        if (defect == null) return NotFound();

        var oldAssignedTo = defect.AssignedTo;

        if (!dto.TestRunId.HasValue && dto.TestCaseId.HasValue)
        {
            return BadRequest("TestCaseId cannot be provided without TestRunId.");
        }

        TestRun? run = null;
        if (dto.TestRunId.HasValue)
        {
            run = await _db.TestRuns.FirstOrDefaultAsync(r => r.Id == dto.TestRunId.Value);
            if (run == null) return NotFound("Test run not found.");
        }

        TestRunEntry? entry = null;
        if (dto.TestRunId.HasValue && dto.TestCaseId.HasValue)
        {
            entry = await _db.TestRunEntries
                .Include(e => e.TestCase)
                .Include(e => e.TestRun)
                .FirstOrDefaultAsync(e => e.TestRunId == dto.TestRunId.Value && e.TestCaseId == dto.TestCaseId.Value);

            if (entry == null) return NotFound("Test run entry not found.");
        }

        var changedBy = GetChangedBy();

        AddAudit(defect, "RunNumber", defect.RunNumber, entry?.TestRun.RunNumber ?? run?.RunNumber ?? "-", changedBy);
        AddAudit(defect, "TcNumber", defect.TcNumber, entry?.TestCase.TcNumber ?? "-", changedBy);
        AddAudit(defect, "Market", defect.Market, dto.Market, changedBy);
        AddAudit(defect, "Description", defect.Description, dto.Description, changedBy);
        AddAudit(defect, "ExpectedResult", defect.ExpectedResult, dto.ExpectedResult, changedBy);
        AddAudit(defect, "ActualResult", defect.ActualResult, dto.ActualResult, changedBy);
        AddAudit(defect, "Priority", defect.Priority, dto.Priority, changedBy);
        AddAudit(defect, "RaisedBy", defect.RaisedBy, dto.RaisedBy, changedBy);
        AddAudit(defect, "AssignedTo", defect.AssignedTo, dto.AssignedTo, changedBy);
        AddAudit(defect, "DateRaised", AuditDate(defect.DateRaised), AuditDate(dto.DateRaised), changedBy);
        AddAudit(defect, "OpenDateTime", AuditDate(defect.OpenDateTime), AuditDate(dto.DateRaised), changedBy);
        AddAudit(defect, "TargetFixDate", AuditDate(defect.TargetFixDate), AuditDate(dto.TargetFixDate), changedBy);
        AddAudit(defect, "Status", defect.Status, dto.Status, changedBy);

        var oldClose = defect.CloseDateTime;
        DateTime? newClose = dto.Status == "Closed" ? DateTime.UtcNow : null;
        AddAudit(defect, "CloseDateTime", AuditDate(oldClose), AuditDate(newClose), changedBy);

        defect.TestRunEntryId = entry?.Id;
        defect.TestPlanId = dto.TestPlanId;
        defect.RunNumber = entry?.TestRun.RunNumber ?? run?.RunNumber ?? "-";
        defect.TcNumber = entry?.TestCase.TcNumber ?? "-";
        defect.Market = dto.Market;
        defect.Description = dto.Description;
        defect.ExpectedResult = dto.ExpectedResult;
        defect.ActualResult = dto.ActualResult;
        defect.Priority = dto.Priority;
        defect.RaisedBy = dto.RaisedBy;
        defect.AssignedTo = dto.AssignedTo;
        defect.DateRaised = dto.DateRaised;
        defect.OpenDateTime = dto.DateRaised;
        defect.CloseDateTime = newClose;
        defect.TargetFixDate = dto.TargetFixDate;
        defect.Status = dto.Status;

        if (!string.Equals((oldAssignedTo ?? string.Empty).Trim(), (defect.AssignedTo ?? string.Empty).Trim(), StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(defect.AssignedTo))
        {
            var actorDisplayName = await GetCurrentUserDisplayNameAsync();
            await NotifyUserByDisplayNameAsync(
                defect.AssignedTo,
                $"{actorDisplayName} assigned {defect.DefectNumber} to you.",
                $"/defects/{defect.Id}"
            );
        }

        await _db.SaveChangesAsync();
        return Ok(defect);
    }

    [HttpPatch("{id}/assignee")]
    [Authorize(Roles = "Admin,Test Lead,Tester,Developer")]
    public async Task<IActionResult> UpdateAssignee(int id, UpdateAssigneeDto dto)
    {
        var defect = await _db.Defects.FindAsync(id);
        if (defect == null) return NotFound();

        var changedBy = GetChangedBy();
        var oldAssignedTo = defect.AssignedTo;
        var newAssignedTo = (dto.AssignedTo ?? string.Empty).Trim();

        AddAudit(defect, "AssignedTo", defect.AssignedTo, newAssignedTo, changedBy);
        defect.AssignedTo = newAssignedTo;

        if (!string.Equals((oldAssignedTo ?? string.Empty).Trim(), (newAssignedTo ?? string.Empty).Trim(), StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(newAssignedTo))
        {
            var actorDisplayName = await GetCurrentUserDisplayNameAsync();
            await NotifyUserByDisplayNameAsync(
                newAssignedTo,
                $"{actorDisplayName} assigned {defect.DefectNumber} to you.",
                $"/defects/{defect.Id}"
            );
        }

        await _db.SaveChangesAsync();
        return Ok(defect);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Test Lead")]
    public async Task<IActionResult> Delete(int id)
    {
        var defect = await _db.Defects.FindAsync(id);
        if (defect == null) return NotFound();

        var attachments = await _db.DefectAttachments
            .Where(a => a.DefectId == id)
            .ToListAsync();

        foreach (var attachment in attachments)
        {
            var fullPath = Path.Combine(UploadRoot, attachment.StoredFileName);
            if (System.IO.File.Exists(fullPath))
            {
                System.IO.File.Delete(fullPath);
            }
        }

        _db.Defects.Remove(defect);
        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpPost("{id}/comments")]
    [Authorize(Roles = "Admin,Test Lead,Tester,Developer")]
    public async Task<IActionResult> AddComment(int id, AddDefectCommentDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Message))
        {
            return BadRequest("Comment message is required.");
        }

        var defect = await _db.Defects.FirstOrDefaultAsync(d => d.Id == id);
        if (defect == null) return NotFound();

        var actorDisplayName = await GetCurrentUserDisplayNameAsync();
        var comment = new DefectComment
        {
            DefectId = id,
            Tester = actorDisplayName,
            Message = dto.Message.Trim(),
            CreatedAt = DateTime.UtcNow,
        };

        _db.DefectComments.Add(comment);
        await CreateMentionNotificationsAsync(dto.Message.Trim(), actorDisplayName, $"/defects/{id}", defect.DefectNumber);
        await _db.SaveChangesAsync();
        return Ok(comment);
    }

    [HttpDelete("{id}/comments/{commentId}")]
    [Authorize(Roles = "Admin,Test Lead")]
    public async Task<IActionResult> DeleteComment(int id, int commentId)
    {
        var comment = await _db.DefectComments
            .FirstOrDefaultAsync(c => c.Id == commentId && c.DefectId == id);
        if (comment == null) return NotFound();

        _db.DefectComments.Remove(comment);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("{id}/audits")]
    public async Task<IActionResult> GetAudits(int id)
    {
        var exists = await _db.Defects.AnyAsync(d => d.Id == id);
        if (!exists) return NotFound();

        var audits = await _db.DefectAuditLogs
            .Where(a => a.DefectId == id)
            .OrderByDescending(a => a.ChangedAt)
            .ToListAsync();

        return Ok(audits);
    }

    [HttpGet("{id}/attachments")]
    public async Task<IActionResult> GetAttachments(int id)
    {
        var exists = await _db.Defects.AnyAsync(d => d.Id == id);
        if (!exists) return NotFound();

        var attachments = await _db.DefectAttachments
            .Where(a => a.DefectId == id)
            .OrderByDescending(a => a.UploadedAt)
            .ToListAsync();

        return Ok(attachments.Select(ToAttachmentDto));
    }

    [HttpPost("{id}/attachments")]
    [Authorize(Roles = "Admin,Test Lead,Tester")]
    [RequestSizeLimit(50_000_000)]
    public async Task<IActionResult> UploadAttachments(int id, [FromForm] List<IFormFile> files)
    {
        var defect = await _db.Defects.FindAsync(id);
        if (defect == null) return NotFound();
        if (files == null || files.Count == 0) return BadRequest("No files uploaded.");

        var uploadedBy = GetChangedBy();
        var created = new List<DefectAttachment>();

        foreach (var file in files.Where(f => f.Length > 0))
        {
            var ext = Path.GetExtension(file.FileName);
            var storedFileName = $"{Guid.NewGuid():N}{ext}";
            var fullPath = Path.Combine(UploadRoot, storedFileName);

            await using (var stream = System.IO.File.Create(fullPath))
            {
                await file.CopyToAsync(stream);
            }

            var attachment = new DefectAttachment
            {
                DefectId = id,
                FileName = file.FileName,
                StoredFileName = storedFileName,
                ContentType = file.ContentType ?? "application/octet-stream",
                Size = file.Length,
                UploadedBy = uploadedBy,
                UploadedAt = DateTime.UtcNow,
            };

            created.Add(attachment);
            _db.DefectAttachments.Add(attachment);
        }

        await _db.SaveChangesAsync();
        return Ok(created.Select(ToAttachmentDto));
    }

    [HttpDelete("{id}/attachments/{attachmentId}")]
    [Authorize(Roles = "Admin,Test Lead")]
    public async Task<IActionResult> DeleteAttachment(int id, int attachmentId)
    {
        var attachment = await _db.DefectAttachments
            .FirstOrDefaultAsync(a => a.DefectId == id && a.Id == attachmentId);
        if (attachment == null) return NotFound();

        var fullPath = Path.Combine(UploadRoot, attachment.StoredFileName);
        if (System.IO.File.Exists(fullPath))
        {
            System.IO.File.Delete(fullPath);
        }

        _db.DefectAttachments.Remove(attachment);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("{id}/attachments/{attachmentId}/file")]
    public async Task<IActionResult> GetAttachmentFile(int id, int attachmentId)
    {
        var attachment = await _db.DefectAttachments
            .FirstOrDefaultAsync(a => a.DefectId == id && a.Id == attachmentId);
        if (attachment == null) return NotFound();

        var fullPath = Path.Combine(UploadRoot, attachment.StoredFileName);
        if (!System.IO.File.Exists(fullPath)) return NotFound();

        return PhysicalFile(fullPath, attachment.ContentType, attachment.FileName);
    }
}

public record CreateDefectDto(
    int? TestRunId, int? TestCaseId, int? TestPlanId,
    string Market, string Description, string IssueType,
    string ExpectedResult, string ActualResult,
    string Priority, string RaisedBy, string AssignedTo,
    DateTime? TargetFixDate, string Remarks);

public record UpdateStatusDto(string Status);

public record UpdateDefectDto(
    int? TestRunId,
    int? TestCaseId,
    int? TestPlanId,
    string Market,
    string Description,
    string ExpectedResult,
    string ActualResult,
    string Priority,
    string RaisedBy,
    string AssignedTo,
    DateTime DateRaised,
    DateTime? TargetFixDate,
    string Status);

public record UpdateAssigneeDto(string AssignedTo);

public record DefectAttachmentDto(
    int Id,
    string FileName,
    string ContentType,
    long Size,
    string UploadedBy,
    DateTime UploadedAt,
    string Url);

public record AddDefectCommentDto(string Message);