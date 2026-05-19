using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
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

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var runs = await _db.TestRuns
            .Include(r => r.Entries)
                .ThenInclude(e => e.TestCase)
            .Include(r => r.Entries)
                .ThenInclude(e => e.Defects)
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