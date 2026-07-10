using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using UATSystem.API.Data;
using UATSystem.API.Models;

namespace UATSystem.API.Controllers;

[ApiController]
[Route("[controller]")]
[Authorize]
public class TestCasesController : ControllerBase
{
    private readonly UATDbContext _db;
    private readonly IWebHostEnvironment _env;
    public TestCasesController(UATDbContext db, IWebHostEnvironment env)
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

            var dir = Path.Combine(root, "uploads", "testcases");
            Directory.CreateDirectory(dir);
            return dir;
        }
    }

    private TestCaseAttachmentDto ToAttachmentDto(TestCaseAttachment a)
    {
        var fileUrl = Url.Action(nameof(GetAttachmentFile), null, new { id = a.TestCaseId, attachmentId = a.Id }, Request.Scheme, Request.Host.Value);
        return new TestCaseAttachmentDto(a.Id, a.FileName, a.ContentType, a.Size, a.UploadedBy, a.UploadedAt, fileUrl ?? string.Empty);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? testPlanId)
    {
        var query = _db.TestCases.AsQueryable();
        if (testPlanId.HasValue)
        {
            query = query.Where(t => t.TestPlanId == testPlanId.Value);
        }

        return Ok(await query.OrderBy(t => t.TcNumber).ToListAsync());
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(int id)
    {
        var tc = await _db.TestCases.FindAsync(id);
        return tc == null ? NotFound() : Ok(tc);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Test Lead,Tester")]
    public async Task<IActionResult> Create(TestCase tc)
    {
        if (!tc.TestPlanId.HasValue)
        {
            return BadRequest("TestPlanId is required.");
        }

        var planExists = await _db.TestPlans.AnyAsync(tp => tp.Id == tc.TestPlanId.Value);
        if (!planExists)
        {
            return BadRequest("Invalid TestPlanId.");
        }

        if (tc.TestScopeId.HasValue)
        {
            var validScope = await _db.TestScopes.AnyAsync(ts => ts.Id == tc.TestScopeId.Value && ts.TestPlanId == tc.TestPlanId.Value);
            if (!validScope)
            {
                return BadRequest("Invalid TestScopeId for selected TestPlanId.");
            }
        }

        var existingNumbers = await _db.TestCases
            .Where(t => t.TestPlanId == tc.TestPlanId.Value)
            .Select(t => t.TcNumber)
            .ToListAsync();

        var maxNum = existingNumbers
            .Select(n => n.StartsWith("TC-") && int.TryParse(n[3..], out int v) ? v : 0)
            .DefaultIfEmpty(0)
            .Max();

        string candidate;
        do
        {
            maxNum++;
            candidate = $"TC-{maxNum:D3}";
        } while (existingNumbers.Contains(candidate));

        tc.TcNumber = candidate;
        tc.CreatedAt = DateTime.UtcNow;
        _db.TestCases.Add(tc);
        await _db.SaveChangesAsync();
        return Ok(tc);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Test Lead,Tester")]
    public async Task<IActionResult> Update(int id, TestCase updated)
    {
        var tc = await _db.TestCases.FindAsync(id);
        if (tc == null) return NotFound();

        if (!updated.TestPlanId.HasValue)
        {
            return BadRequest("TestPlanId is required.");
        }

        var planExists = await _db.TestPlans.AnyAsync(tp => tp.Id == updated.TestPlanId.Value);
        if (!planExists)
        {
            return BadRequest("Invalid TestPlanId.");
        }

        if (updated.TestScopeId.HasValue)
        {
            var validScope = await _db.TestScopes.AnyAsync(ts => ts.Id == updated.TestScopeId.Value && ts.TestPlanId == updated.TestPlanId.Value);
            if (!validScope)
            {
                return BadRequest("Invalid TestScopeId for selected TestPlanId.");
            }
        }

        tc.Name = updated.Name;
        tc.Description = updated.Description;
        tc.Steps = updated.Steps;
        tc.ExpectedResult = updated.ExpectedResult;
        tc.Priority = updated.Priority;
        tc.Category = updated.Category;
        tc.Remarks = updated.Remarks;
        tc.TestPlanId = updated.TestPlanId;
        tc.TestScopeId = updated.TestScopeId;
        await _db.SaveChangesAsync();
        return Ok(tc);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Test Lead")]
    public async Task<IActionResult> Delete(int id)
    {
        var tc = await _db.TestCases.FindAsync(id);
        if (tc == null) return NotFound();
        _db.TestCases.Remove(tc);
        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpGet("{id}/attachments")]
    public async Task<IActionResult> GetAttachments(int id)
    {
        var exists = await _db.TestCases.AnyAsync(t => t.Id == id);
        if (!exists) return NotFound();

        var attachments = await _db.TestCaseAttachments
            .Where(a => a.TestCaseId == id)
            .OrderByDescending(a => a.UploadedAt)
            .ToListAsync();

        return Ok(attachments.Select(ToAttachmentDto));
    }

    [HttpPost("{id}/attachments")]
    [Authorize(Roles = "Admin,Test Lead,Tester")]
    [RequestSizeLimit(50_000_000)]
    public async Task<IActionResult> UploadAttachments(int id, [FromForm] List<IFormFile> files)
    {
        var testCase = await _db.TestCases.FindAsync(id);
        if (testCase == null) return NotFound();
        if (files == null || files.Count == 0) return BadRequest("No files uploaded.");

        var uploadedBy = Request.Headers.TryGetValue("X-User-Name", out var value) && !string.IsNullOrWhiteSpace(value)
            ? value.ToString()
            : "Unknown";

        var created = new List<TestCaseAttachment>();
        foreach (var file in files.Where(f => f.Length > 0))
        {
            var ext = Path.GetExtension(file.FileName);
            var storedFileName = $"{Guid.NewGuid():N}{ext}";
            var fullPath = Path.Combine(UploadRoot, storedFileName);

            await using (var stream = System.IO.File.Create(fullPath))
            {
                await file.CopyToAsync(stream);
            }

            var attachment = new TestCaseAttachment
            {
                TestCaseId = id,
                FileName = file.FileName,
                StoredFileName = storedFileName,
                ContentType = file.ContentType ?? "application/octet-stream",
                Size = file.Length,
                UploadedBy = uploadedBy,
                UploadedAt = DateTime.UtcNow,
            };

            created.Add(attachment);
            _db.TestCaseAttachments.Add(attachment);
        }

        await _db.SaveChangesAsync();
        return Ok(created.Select(ToAttachmentDto));
    }

    [HttpDelete("{id}/attachments/{attachmentId}")]
    [Authorize(Roles = "Admin,Test Lead")]
    public async Task<IActionResult> DeleteAttachment(int id, int attachmentId)
    {
        var attachment = await _db.TestCaseAttachments
            .FirstOrDefaultAsync(a => a.TestCaseId == id && a.Id == attachmentId);
        if (attachment == null) return NotFound();

        var fullPath = Path.Combine(UploadRoot, attachment.StoredFileName);
        if (System.IO.File.Exists(fullPath))
        {
            System.IO.File.Delete(fullPath);
        }

        _db.TestCaseAttachments.Remove(attachment);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("{id}/attachments/{attachmentId}/file")]
    public async Task<IActionResult> GetAttachmentFile(int id, int attachmentId)
    {
        var attachment = await _db.TestCaseAttachments
            .FirstOrDefaultAsync(a => a.TestCaseId == id && a.Id == attachmentId);
        if (attachment == null) return NotFound();

        var fullPath = Path.Combine(UploadRoot, attachment.StoredFileName);
        if (!System.IO.File.Exists(fullPath)) return NotFound();

        return PhysicalFile(fullPath, attachment.ContentType, attachment.FileName);
    }
}

public record TestCaseAttachmentDto(
    int Id,
    string FileName,
    string ContentType,
    long Size,
    string UploadedBy,
    DateTime UploadedAt,
    string Url);