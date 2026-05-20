using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using UATSystem.API.Data;
using UATSystem.API.Models;

namespace UATSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TestRunsController : ControllerBase
{
    private readonly UATDbContext _db;
    public TestRunsController(UATDbContext db) => _db = db;

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

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var runs = await _db.TestRuns
            .Include(r => r.Entries)
                .ThenInclude(e => e.TestCase)
            .Include(r => r.Entries)
                .ThenInclude(e => e.Defects)
            .Include(r => r.Entries)
                .ThenInclude(e => e.Comments)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();
        return Ok(runs);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(int id)
    {
        var run = await _db.TestRuns
            .Include(r => r.Entries)
                .ThenInclude(e => e.TestCase)
            .Include(r => r.Entries)
                .ThenInclude(e => e.Defects)
            .Include(r => r.Entries)
                .ThenInclude(e => e.Comments)
            .FirstOrDefaultAsync(r => r.Id == id);
        return run == null ? NotFound() : Ok(run);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Test Lead,Tester")]
    public async Task<IActionResult> Create(CreateRunDto dto)
    {
        var count = await _db.TestRuns.CountAsync();
        var run = new TestRun
        {
            RunNumber = $"RUN-{(count + 1):D3}",
            Name = dto.Name,
            Tester = dto.Tester,
            CreatedAt = DateTime.UtcNow,
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
        await _db.SaveChangesAsync();
        return Ok(run);
    }

    [HttpDelete("{id}/entries/{testCaseId}")]
    [Authorize(Roles = "Admin,Test Lead")]
    public async Task<IActionResult> RemoveEntry(int id, int testCaseId)
    {
        var entry = await _db.TestRunEntries
            .FirstOrDefaultAsync(e => e.TestRunId == id && e.TestCaseId == testCaseId);
        if (entry == null) return NotFound();
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
            .FirstOrDefaultAsync(c => c.Id == commentId && c.TestRunEntry.TestRunId == id && c.TestRunEntry.TestCaseId == testCaseId);
        if (comment == null) return NotFound();

        _db.TestRunEntryComments.Remove(comment);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPatch("{id}/entries/{testCaseId}")]
    [Authorize(Roles = "Admin,Test Lead,Tester")]
    public async Task<IActionResult> UpdateEntry(int id, int testCaseId, UpdateEntryDto dto)
    {
        var entry = await _db.TestRunEntries
            .FirstOrDefaultAsync(e => e.TestRunId == id && e.TestCaseId == testCaseId);
        if (entry == null) return NotFound();
        entry.ExecStatus = dto.ExecStatus;
        entry.Comment = dto.Comment;
        await _db.SaveChangesAsync();
        return Ok(entry);
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
}

public record CreateRunDto(string Name, string Tester, List<int> TestCaseIds);
public record AddEntryDto(int TestCaseId);
public record UpdateEntryDto(string ExecStatus, string Comment);
public record AddEntryCommentDto(string Message);
