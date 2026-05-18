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
    public DefectsController(UATDbContext db) => _db = db;

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
            DateRaised = DateTime.UtcNow,
            TargetFixDate = dto.TargetFixDate,
            Remarks = dto.Remarks,
            CreatedAt = DateTime.UtcNow,
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
        defect.Status = dto.Status;

        await _db.SaveChangesAsync();
        return Ok(defect);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateDefect(int id, UpdateDefectDto dto)
    {
        var defect = await _db.Defects.FindAsync(id);
        if (defect == null) return NotFound();

        var changedBy = GetChangedBy();

        AddAudit(defect, "Description", defect.Description, dto.Description, changedBy);
        AddAudit(defect, "ExpectedResult", defect.ExpectedResult, dto.ExpectedResult, changedBy);
        AddAudit(defect, "ActualResult", defect.ActualResult, dto.ActualResult, changedBy);
        AddAudit(defect, "Priority", defect.Priority, dto.Priority, changedBy);
        AddAudit(defect, "RaisedBy", defect.RaisedBy, dto.RaisedBy, changedBy);
        AddAudit(defect, "AssignedTo", defect.AssignedTo, dto.AssignedTo, changedBy);
        AddAudit(defect, "DateRaised", AuditDate(defect.DateRaised), AuditDate(dto.DateRaised), changedBy);
        AddAudit(defect, "TargetFixDate", AuditDate(defect.TargetFixDate), AuditDate(dto.TargetFixDate), changedBy);
        AddAudit(defect, "Status", defect.Status, dto.Status, changedBy);

        defect.Description = dto.Description;
        defect.ExpectedResult = dto.ExpectedResult;
        defect.ActualResult = dto.ActualResult;
        defect.Priority = dto.Priority;
        defect.RaisedBy = dto.RaisedBy;
        defect.AssignedTo = dto.AssignedTo;
        defect.DateRaised = dto.DateRaised;
        defect.TargetFixDate = dto.TargetFixDate;
        defect.Status = dto.Status;

        await _db.SaveChangesAsync();
        return Ok(defect);
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
}

public record CreateDefectDto(
    int? TestRunId, int? TestCaseId,
    string Market, string Description, string IssueType,
    string ExpectedResult, string ActualResult,
    string Priority, string RaisedBy, string AssignedTo,
    DateTime? TargetFixDate, string Remarks);

public record UpdateStatusDto(string Status);

public record UpdateDefectDto(
    string Description,
    string ExpectedResult,
    string ActualResult,
    string Priority,
    string RaisedBy,
    string AssignedTo,
    DateTime DateRaised,
    DateTime? TargetFixDate,
    string Status);