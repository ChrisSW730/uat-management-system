using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UATSystem.API.Data;
using UATSystem.API.Models;

namespace UATSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
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
        var fileUrl = $"{Request.Scheme}://{Request.Host}/api/defects/{a.DefectId}/attachments/{a.Id}/file";
        return new DefectAttachmentDto(a.Id, a.FileName, a.ContentType, a.Size, a.UploadedBy, a.UploadedAt, fileUrl);
    }

    private string GetChangedBy()
    {
        if (Request.Headers.TryGetValue("X-User-Name", out var value) && !string.IsNullOrWhiteSpace(value))
        {
            return value.ToString();
        }
        return "Unknown";
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
        Ok(await _db.Defects.OrderByDescending(d => d.CreatedAt).ToListAsync());

    [HttpPost]
    public async Task<IActionResult> Create(CreateDefectDto dto)
    {
        if ((dto.TestRunId.HasValue && !dto.TestCaseId.HasValue) || (!dto.TestRunId.HasValue && dto.TestCaseId.HasValue))
        {
            return BadRequest("Both TestRunId and TestCaseId must be provided together.");
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
            RunNumber = entry?.TestRun.RunNumber ?? "-",
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
        return Ok(defect);
    }

    [HttpPatch("{id}/status")]
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
    public async Task<IActionResult> UpdateDefect(int id, UpdateDefectDto dto)
    {
        var defect = await _db.Defects.FindAsync(id);
        if (defect == null) return NotFound();

        if ((dto.TestRunId.HasValue && !dto.TestCaseId.HasValue) || (!dto.TestRunId.HasValue && dto.TestCaseId.HasValue))
        {
            return BadRequest("Both TestRunId and TestCaseId must be provided together.");
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

        AddAudit(defect, "RunNumber", defect.RunNumber, entry?.TestRun.RunNumber ?? "-", changedBy);
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
        defect.RunNumber = entry?.TestRun.RunNumber ?? "-";
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

        await _db.SaveChangesAsync();
        return Ok(defect);
    }

    [HttpDelete("{id}")]
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
    int? TestRunId, int? TestCaseId,
    string Market, string Description, string IssueType,
    string ExpectedResult, string ActualResult,
    string Priority, string RaisedBy, string AssignedTo,
    DateTime? TargetFixDate, string Remarks);

public record UpdateStatusDto(string Status);

public record UpdateDefectDto(
    int? TestRunId,
    int? TestCaseId,
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

public record DefectAttachmentDto(
    int Id,
    string FileName,
    string ContentType,
    long Size,
    string UploadedBy,
    DateTime UploadedAt,
    string Url);