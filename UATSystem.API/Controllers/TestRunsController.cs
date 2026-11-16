using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using UATSystem.API.Data;
using UATSystem.API.Helpers;
using UATSystem.API.Models;

namespace UATSystem.API.Controllers;

[ApiController]
[Route("[controller]")]
[Authorize]
public class TestRunsController : ControllerBase
{
    private readonly UATDbContext _db;
    private readonly IWebHostEnvironment _env;
    public TestRunsController(UATDbContext db, IWebHostEnvironment env)
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

            var dir = Path.Combine(root, "uploads", "testruns");
            Directory.CreateDirectory(dir);
            return dir;
        }
    }

    private string EntryUploadRoot
    {
        get
        {
            var root = _env.WebRootPath;
            if (string.IsNullOrWhiteSpace(root))
            {
                root = Path.Combine(_env.ContentRootPath, "wwwroot");
            }

            var dir = Path.Combine(root, "uploads", "testruns", "entries");
            Directory.CreateDirectory(dir);
            return dir;
        }
    }

    private TestRunAttachmentDto ToAttachmentDto(TestRunAttachment a)
    {
        var fileUrl = UrlBuilder.BuildAbsoluteUrl(
            Request,
            Url.Action(nameof(GetAttachmentFile), null, new { id = a.TestRunId, attachmentId = a.Id }));
        return new TestRunAttachmentDto(a.Id, a.FileName, a.ContentType, a.Size, a.UploadedBy, a.UploadedAt, fileUrl);
    }

    private TestRunEntryAttachmentDto ToEntryAttachmentDto(TestRunEntryAttachment a, int runId, int testCaseId)
    {
        var fileUrl = UrlBuilder.BuildAbsoluteUrl(
            Request,
            Url.Action(nameof(GetEntryAttachmentFile), null, new { id = runId, testCaseId, attachmentId = a.Id }));
        return new TestRunEntryAttachmentDto(a.Id, a.FileName, a.ContentType, a.Size, a.UploadedBy, a.UploadedAt, fileUrl);
    }

    private async Task<string> GetCommentTesterAsync()
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

    private async Task CreateMentionNotificationsAsync(string message, string actorDisplayName, string link, string testCaseNumber)
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
                Message = $"{actorDisplayName} mentioned you in a test run comment (TC ID: {testCaseNumber}).",
                Link = link,
                IsRead = false,
                CreatedAt = now,
            });
        }
    }

    private async Task HydrateRunEntryDefectsAsync(List<TestRun> runs)
    {
        if (runs.Count == 0)
        {
            return;
        }

        var entryIds = runs
            .SelectMany(r => r.Entries)
            .Select(e => e.Id)
            .Distinct()
            .ToList();

        if (entryIds.Count == 0)
        {
            foreach (var run in runs)
            {
                foreach (var entry in run.Entries)
                {
                    entry.Defects = new List<Defect>();
                }
            }
            return;
        }

        var directDefectsByEntryId = await _db.Defects
            .Where(d => d.TestRunEntryId.HasValue && entryIds.Contains(d.TestRunEntryId.Value))
            .GroupBy(d => d.TestRunEntryId!.Value)
            .ToDictionaryAsync(
                group => group.Key,
                group => group.ToList());

        var linkedTestCaseIds = runs
            .SelectMany(r => r.Entries)
            .Select(e => e.TestCaseId)
            .Distinct()
            .ToList();

        var linkedDefectsByTestCaseId = await _db.TestCaseDefects
            .Include(link => link.Defect)
            .Where(link => linkedTestCaseIds.Contains(link.TestCaseId))
            .GroupBy(link => link.TestCaseId)
            .ToDictionaryAsync(
                group => group.Key,
                group => group.Select(link => link.Defect).ToList());

        foreach (var run in runs)
        {
            foreach (var entry in run.Entries)
            {
                var resolvedDefects = new List<Defect>();

                if (directDefectsByEntryId.TryGetValue(entry.Id, out var directDefects))
                {
                    resolvedDefects.AddRange(directDefects);
                }

                if (linkedDefectsByTestCaseId.TryGetValue(entry.TestCaseId, out var linkedDefects))
                {
                    resolvedDefects.AddRange(linkedDefects);
                }

                entry.Defects = resolvedDefects
                    .GroupBy(defect => defect.Id)
                    .Select(group => group.First())
                    .OrderBy(defect => defect.DefectNumber)
                    .ToList();
            }
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var runs = await _db.TestRuns
            .AsNoTracking()
            .AsSplitQuery()
            .Include(r => r.Entries)
                .ThenInclude(e => e.TestCase)
            .Include(r => r.Entries)
                .ThenInclude(e => e.Comments)
            .Include(r => r.Attachments)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        await HydrateRunEntryDefectsAsync(runs);
        return Ok(runs);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(int id)
    {
        var run = await _db.TestRuns
            .AsNoTracking()
            .AsSplitQuery()
            .Include(r => r.Entries)
                .ThenInclude(e => e.TestCase)
            .Include(r => r.Entries)
                .ThenInclude(e => e.Comments)
            .Include(r => r.Attachments)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (run == null)
        {
            return NotFound();
        }

        await HydrateRunEntryDefectsAsync(new List<TestRun> { run });
        return Ok(run);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Test Lead,Tester")]
    public async Task<IActionResult> Create(CreateRunDto dto)
    {
        var count = await _db.TestRuns.CountAsync();
        var now = DateTime.UtcNow;
        var run = new TestRun
        {
            RunNumber = $"RUN-{(count + 1):D3}",
            Name = dto.Name,
            Tester = dto.Tester,
            CreatedAt = now,
            UpdatedAt = now,
        };
        foreach (var tcId in dto.TestCaseIds)
        {
            run.Entries.Add(new TestRunEntry
            {
                TestCaseId = tcId,
                ExecStatus = "Not Run",
                Comment = ""
            });
        }
        _db.TestRuns.Add(run);
        await _db.SaveChangesAsync();
        return Ok(run);
    }

    [HttpPost("{id}/entries")]
    [Authorize(Roles = "Admin,Test Lead,Tester")]
    public async Task<IActionResult> AddEntry(int id, AddEntryDto dto)
    {
        var run = await _db.TestRuns.Include(r => r.Entries).FirstOrDefaultAsync(r => r.Id == id);
        if (run == null) return NotFound();
        if (run.Entries.Any(e => e.TestCaseId == dto.TestCaseId))
            return BadRequest("Test case already in this run.");
        run.Entries.Add(new TestRunEntry
        {
            TestCaseId = dto.TestCaseId,
            ExecStatus = "Not Run",
            Comment = ""
        });
        run.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(run);
    }

    [HttpDelete("{id}/entries/{testCaseId}")]
    [Authorize(Roles = "Admin,Test Lead")]
    public async Task<IActionResult> RemoveEntry(int id, int testCaseId)
    {
        var entry = await _db.TestRunEntries
            .Include(e => e.TestRun)
            .FirstOrDefaultAsync(e => e.TestRunId == id && e.TestCaseId == testCaseId);
        if (entry == null) return NotFound();
        entry.TestRun.UpdatedAt = DateTime.UtcNow;
        _db.TestRunEntries.Remove(entry);
        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpPost("{id}/entries/{testCaseId}/comments")]
    [Authorize(Roles = "Admin,Test Lead,Tester,Developer")]
    public async Task<IActionResult> AddComment(int id, int testCaseId, AddEntryCommentDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Message))
        {
            return BadRequest("Comment message is required.");
        }

        var entry = await _db.TestRunEntries
            .Include(e => e.TestRun)
            .FirstOrDefaultAsync(e => e.TestRunId == id && e.TestCaseId == testCaseId);
        if (entry == null) return NotFound();

        var testCaseNumber = await _db.TestCases
            .Where(tc => tc.Id == testCaseId)
            .Select(tc => tc.TcNumber)
            .FirstOrDefaultAsync() ?? testCaseId.ToString();

        var actorDisplayName = await GetCommentTesterAsync();
        var comment = new TestRunEntryComment
        {
            TestRunEntryId = entry.Id,
            Tester = actorDisplayName,
            Message = dto.Message.Trim(),
            CreatedAt = DateTime.UtcNow,
        };

        _db.TestRunEntryComments.Add(comment);
        entry.TestRun.UpdatedAt = DateTime.UtcNow;
        await CreateMentionNotificationsAsync(dto.Message.Trim(), actorDisplayName, $"/runs/{id}", testCaseNumber);
        await _db.SaveChangesAsync();
        return Ok(comment);
    }

    [HttpDelete("{id}/entries/{testCaseId}/comments/{commentId}")]
    [Authorize(Roles = "Admin,Test Lead")]
    public async Task<IActionResult> DeleteComment(int id, int testCaseId, int commentId)
    {
        var comment = await _db.TestRunEntryComments
            .Include(c => c.TestRunEntry)
                .ThenInclude(e => e.TestRun)
            .FirstOrDefaultAsync(c => c.Id == commentId && c.TestRunEntry.TestRunId == id && c.TestRunEntry.TestCaseId == testCaseId);
        if (comment == null) return NotFound();

        comment.TestRunEntry.TestRun.UpdatedAt = DateTime.UtcNow;
        _db.TestRunEntryComments.Remove(comment);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPatch("{id}")]
    [Authorize(Roles = "Admin,Test Lead,Tester")]
    public async Task<IActionResult> UpdateRun(int id, UpdateRunDto dto)
    {
        var run = await _db.TestRuns
            .Include(r => r.Entries)
                .ThenInclude(e => e.TestCase)
            .Include(r => r.Entries)
                .ThenInclude(e => e.Defects)
            .Include(r => r.Entries)
                .ThenInclude(e => e.Comments)
            .FirstOrDefaultAsync(r => r.Id == id);
        if (run == null) return NotFound();

        run.Name = dto.Name;
        run.Tester = dto.Tester;
        run.UpdatedAt = DateTime.UtcNow;

        if (dto.TestCaseIds is not null)
        {
            var requestedIds = dto.TestCaseIds
                .Where(testCaseId => testCaseId > 0)
                .Distinct()
                .ToList();

            var existingIds = run.Entries
                .Select(entry => entry.TestCaseId)
                .ToHashSet();

            var entriesToRemove = run.Entries
                .Where(entry => !requestedIds.Contains(entry.TestCaseId))
                .ToList();

            if (entriesToRemove.Count > 0)
            {
                _db.TestRunEntries.RemoveRange(entriesToRemove);
            }

            foreach (var testCaseId in requestedIds)
            {
                if (existingIds.Contains(testCaseId))
                {
                    continue;
                }

                run.Entries.Add(new TestRunEntry
                {
                    TestCaseId = testCaseId,
                    ExecStatus = "Not Run",
                    Comment = string.Empty,
                });
            }
        }

        await _db.SaveChangesAsync();
        return Ok(run);
    }

    [HttpPatch("{id}/entries/{testCaseId}")]
    [Authorize(Roles = "Admin,Test Lead,Tester")]
    public async Task<IActionResult> UpdateEntry(int id, int testCaseId, UpdateEntryDto dto)
    {
        var entry = await _db.TestRunEntries
            .Include(e => e.TestRun)
            .FirstOrDefaultAsync(e => e.TestRunId == id && e.TestCaseId == testCaseId);
        if (entry == null) return NotFound();

        // Record timestamp and user if status is changing
        if (entry.ExecStatus != dto.ExecStatus)
        {
            entry.StatusChangedAt = DateTime.UtcNow;
            entry.StatusChangedBy = await GetCommentTesterAsync();
        }

        entry.ExecStatus = dto.ExecStatus;
        entry.Comment = dto.Comment;
        entry.TestRun.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(entry);
    }

    [HttpGet("{id}/entries/{testCaseId}/attachments")]
    public async Task<IActionResult> GetEntryAttachments(int id, int testCaseId)
    {
        var entry = await _db.TestRunEntries
            .FirstOrDefaultAsync(e => e.TestRunId == id && e.TestCaseId == testCaseId);
        if (entry == null) return NotFound();

        var attachments = await _db.TestRunEntryAttachments
            .Where(a => a.TestRunEntryId == entry.Id)
            .OrderByDescending(a => a.UploadedAt)
            .ToListAsync();

        return Ok(attachments.Select(a => ToEntryAttachmentDto(a, id, testCaseId)));
    }

    [HttpPost("{id}/entries/{testCaseId}/attachments")]
    [Authorize(Roles = "Admin,Test Lead,Tester")]
    [RequestSizeLimit(50_000_000)]
    public async Task<IActionResult> UploadEntryAttachments(int id, int testCaseId, [FromForm] List<IFormFile> files)
    {
        var entry = await _db.TestRunEntries
            .FirstOrDefaultAsync(e => e.TestRunId == id && e.TestCaseId == testCaseId);
        if (entry == null) return NotFound();
        if (files == null || files.Count == 0) return BadRequest("No files uploaded.");

        var uploadedBy = Request.Headers.TryGetValue("X-User-Name", out var value) && !string.IsNullOrWhiteSpace(value)
            ? value.ToString()
            : "Unknown";

        var created = new List<TestRunEntryAttachment>();
        foreach (var file in files.Where(f => f.Length > 0))
        {
            var ext = Path.GetExtension(file.FileName);
            var storedFileName = $"{Guid.NewGuid():N}{ext}";
            var fullPath = Path.Combine(EntryUploadRoot, storedFileName);

            await using (var stream = System.IO.File.Create(fullPath))
            {
                await file.CopyToAsync(stream);
            }

            var attachment = new TestRunEntryAttachment
            {
                TestRunEntryId = entry.Id,
                FileName = file.FileName,
                StoredFileName = storedFileName,
                ContentType = file.ContentType ?? "application/octet-stream",
                Size = file.Length,
                UploadedBy = uploadedBy,
                UploadedAt = DateTime.UtcNow,
            };

            created.Add(attachment);
            _db.TestRunEntryAttachments.Add(attachment);
        }

        await _db.SaveChangesAsync();
        return Ok(created.Select(a => ToEntryAttachmentDto(a, id, testCaseId)));
    }

    [HttpDelete("{id}/entries/{testCaseId}/attachments/{attachmentId}")]
    [Authorize(Roles = "Admin,Test Lead,Tester")]
    public async Task<IActionResult> DeleteEntryAttachment(int id, int testCaseId, int attachmentId)
    {
        var entry = await _db.TestRunEntries
            .FirstOrDefaultAsync(e => e.TestRunId == id && e.TestCaseId == testCaseId);
        if (entry == null) return NotFound();

        var attachment = await _db.TestRunEntryAttachments
            .FirstOrDefaultAsync(a => a.TestRunEntryId == entry.Id && a.Id == attachmentId);
        if (attachment == null) return NotFound();

        var fullPath = Path.Combine(EntryUploadRoot, attachment.StoredFileName);
        if (System.IO.File.Exists(fullPath))
        {
            System.IO.File.Delete(fullPath);
        }

        _db.TestRunEntryAttachments.Remove(attachment);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("{id}/entries/{testCaseId}/attachments/{attachmentId}/file")]
    public async Task<IActionResult> GetEntryAttachmentFile(int id, int testCaseId, int attachmentId)
    {
        var entry = await _db.TestRunEntries
            .FirstOrDefaultAsync(e => e.TestRunId == id && e.TestCaseId == testCaseId);
        if (entry == null) return NotFound();

        var attachment = await _db.TestRunEntryAttachments
            .FirstOrDefaultAsync(a => a.TestRunEntryId == entry.Id && a.Id == attachmentId);
        if (attachment == null) return NotFound();

        var fullPath = Path.Combine(EntryUploadRoot, attachment.StoredFileName);
        if (!System.IO.File.Exists(fullPath)) return NotFound();

        return PhysicalFile(fullPath, attachment.ContentType, attachment.FileName);
    }

    [HttpGet("{id}/attachments")]
    public async Task<IActionResult> GetAttachments(int id)
    {
        var exists = await _db.TestRuns.AnyAsync(r => r.Id == id);
        if (!exists) return NotFound();

        var attachments = await _db.TestRunAttachments
            .Where(a => a.TestRunId == id)
            .OrderByDescending(a => a.UploadedAt)
            .ToListAsync();

        return Ok(attachments.Select(ToAttachmentDto));
    }

    [HttpPost("{id}/attachments")]
    [Authorize(Roles = "Admin,Test Lead,Tester")]
    [RequestSizeLimit(50_000_000)]
    public async Task<IActionResult> UploadAttachments(int id, [FromForm] List<IFormFile> files)
    {
        var run = await _db.TestRuns.FindAsync(id);
        if (run == null) return NotFound();
        if (files == null || files.Count == 0) return BadRequest("No files uploaded.");

        var uploadedBy = Request.Headers.TryGetValue("X-User-Name", out var value) && !string.IsNullOrWhiteSpace(value)
            ? value.ToString()
            : "Unknown";

        var created = new List<TestRunAttachment>();
        foreach (var file in files.Where(f => f.Length > 0))
        {
            var ext = Path.GetExtension(file.FileName);
            var storedFileName = $"{Guid.NewGuid():N}{ext}";
            var fullPath = Path.Combine(UploadRoot, storedFileName);

            await using (var stream = System.IO.File.Create(fullPath))
            {
                await file.CopyToAsync(stream);
            }

            var attachment = new TestRunAttachment
            {
                TestRunId = id,
                FileName = file.FileName,
                StoredFileName = storedFileName,
                ContentType = file.ContentType ?? "application/octet-stream",
                Size = file.Length,
                UploadedBy = uploadedBy,
                UploadedAt = DateTime.UtcNow,
            };

            created.Add(attachment);
            _db.TestRunAttachments.Add(attachment);
        }

        await _db.SaveChangesAsync();
        return Ok(created.Select(ToAttachmentDto));
    }

    [HttpDelete("{id}/attachments/{attachmentId}")]
    [Authorize(Roles = "Admin,Test Lead")]
    public async Task<IActionResult> DeleteAttachment(int id, int attachmentId)
    {
        var attachment = await _db.TestRunAttachments
            .FirstOrDefaultAsync(a => a.TestRunId == id && a.Id == attachmentId);
        if (attachment == null) return NotFound();

        var fullPath = Path.Combine(UploadRoot, attachment.StoredFileName);
        if (System.IO.File.Exists(fullPath))
        {
            System.IO.File.Delete(fullPath);
        }

        _db.TestRunAttachments.Remove(attachment);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("{id}/attachments/{attachmentId}/file")]
    public async Task<IActionResult> GetAttachmentFile(int id, int attachmentId)
    {
        var attachment = await _db.TestRunAttachments
            .FirstOrDefaultAsync(a => a.TestRunId == id && a.Id == attachmentId);
        if (attachment == null) return NotFound();

        var fullPath = Path.Combine(UploadRoot, attachment.StoredFileName);
        if (!System.IO.File.Exists(fullPath)) return NotFound();

        return PhysicalFile(fullPath, attachment.ContentType, attachment.FileName);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Test Lead")]
    public async Task<IActionResult> Delete(int id)
    {
        var run = await _db.TestRuns.FindAsync(id);
        if (run == null) return NotFound();

        _db.TestRuns.Remove(run);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id}/duplicate")]
    [Authorize(Roles = "Admin,Test Lead,Tester")]
    public async Task<IActionResult> Duplicate(int id)
    {
        var original = await _db.TestRuns
            .Include(r => r.Entries)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (original == null)
            return NotFound();

        var count = await _db.TestRuns.CountAsync();

        var copy = new TestRun
        {
            RunNumber = $"RUN-{(count + 1):D3}",
            Name = original.Name + " (Copy)",
            Tester = original.Tester,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        foreach (var entry in original.Entries)
        {
            copy.Entries.Add(new TestRunEntry
            {
                TestCaseId = entry.TestCaseId,

                // Reset execution
                ExecStatus = "Not Run",
                Comment = "",
            });
        }

        _db.TestRuns.Add(copy);
        await _db.SaveChangesAsync();

        return Ok(copy);
    }
}

public record CreateRunDto(string Name, string Tester, List<int> TestCaseIds);
public record AddEntryDto(int TestCaseId);
public record UpdateRunDto(string Name, string Tester, List<int>? TestCaseIds = null);
public record UpdateEntryDto(string ExecStatus, string Comment);
public record AddEntryCommentDto(string Message);
public record TestRunAttachmentDto(
    int Id,
    string FileName,
    string ContentType,
    long Size,
    string UploadedBy,
    DateTime UploadedAt,
    string Url);
public record TestRunEntryAttachmentDto(
    int Id,
    string FileName,
    string ContentType,
    long Size,
    string UploadedBy,
    DateTime UploadedAt,
    string Url);
