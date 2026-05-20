using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using UATSystem.API.Data;
using UATSystem.API.Models;

namespace UATSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProjectsController : ControllerBase
{
    private readonly UATDbContext _db;

    public ProjectsController(UATDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var projects = await _db.Projects
            .Include(p => p.TestPlans)
                .ThenInclude(tp => tp.TestScopes)
            .OrderBy(p => p.Name)
            .ToListAsync();

        return Ok(projects.Select(p => new ProjectDto(
            p.Id,
            p.Name,
            p.StartDate,
            p.EndDate,
            p.CreatedAt,
            p.TestPlans
                .OrderBy(tp => tp.Name)
                .Select(tp => new TestPlanDto(
                    tp.Id,
                    tp.ProjectId,
                    tp.Name,
                    tp.StartDate,
                    tp.EndDate,
                    tp.CreatedAt,
                    tp.TestScopes
                        .OrderBy(ts => ts.Name)
                        .Select(ts => new TestScopeDto(ts.Id, ts.TestPlanId, ts.Name, ts.CreatedAt))
                        .ToList()
                ))
                .ToList()
        )));
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Test Lead,Tester")]
    public async Task<IActionResult> Create(CreateProjectDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Project name is required.");
        if (!TryNormalizeRange(dto.StartDate, dto.EndDate, out var startDate, out var endDate, out var rangeError))
        {
            return BadRequest(rangeError);
        }

        var project = new Project
        {
            Name = dto.Name.Trim(),
            StartDate = startDate,
            EndDate = endDate,
            CreatedAt = DateTime.UtcNow,
        };

        _db.Projects.Add(project);
        await _db.SaveChangesAsync();

        return Ok(new ProjectDto(project.Id, project.Name, project.StartDate, project.EndDate, project.CreatedAt, new List<TestPlanDto>()));
    }

    [HttpPut("{projectId}")]
    [Authorize(Roles = "Admin,Test Lead,Tester")]
    public async Task<IActionResult> UpdateProject(int projectId, UpdateProjectDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Project name is required.");
        if (!TryNormalizeRange(dto.StartDate, dto.EndDate, out var startDate, out var endDate, out var rangeError))
        {
            return BadRequest(rangeError);
        }

        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == projectId);
        if (project is null) return NotFound();

        var outOfRangePlan = await _db.TestPlans
            .Where(tp => tp.ProjectId == projectId && tp.StartDate.HasValue && tp.EndDate.HasValue)
            .AnyAsync(tp => tp.StartDate!.Value.Date < startDate!.Value.Date || tp.EndDate!.Value.Date > endDate!.Value.Date);
        if (outOfRangePlan)
        {
            return BadRequest("Project timeline must include all existing test plan timelines.");
        }

        project.Name = dto.Name.Trim();
        project.StartDate = startDate;
        project.EndDate = endDate;
        await _db.SaveChangesAsync();

        return Ok(new ProjectDto(project.Id, project.Name, project.StartDate, project.EndDate, project.CreatedAt, new List<TestPlanDto>()));
    }

    [HttpDelete("{projectId}")]
    [Authorize(Roles = "Admin,Test Lead")]
    public async Task<IActionResult> DeleteProject(int projectId)
    {
        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == projectId);
        if (project is null) return NotFound();

        _db.Projects.Remove(project);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{projectId}/testplans")]
    [Authorize(Roles = "Admin,Test Lead")]
    public async Task<IActionResult> CreateTestPlan(int projectId, CreateTestPlanDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Test plan name is required.");
        if (!TryNormalizeRange(dto.StartDate, dto.EndDate, out var startDate, out var endDate, out var rangeError))
        {
            return BadRequest(rangeError);
        }

        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == projectId);
        if (project is null) return NotFound();

        if (project.StartDate is null || project.EndDate is null)
        {
            return BadRequest("Project timeline is required before creating a test plan timeline.");
        }

        if (startDate!.Value.Date < project.StartDate.Value.Date || endDate!.Value.Date > project.EndDate.Value.Date)
        {
            return BadRequest("Test plan timeline must be within the project timeline.");
        }

        var testPlan = new TestPlan
        {
            ProjectId = projectId,
            Name = dto.Name.Trim(),
            StartDate = startDate,
            EndDate = endDate,
            CreatedAt = DateTime.UtcNow,
        };

        _db.TestPlans.Add(testPlan);
        await _db.SaveChangesAsync();

        return Ok(new TestPlanDto(testPlan.Id, testPlan.ProjectId, testPlan.Name, testPlan.StartDate, testPlan.EndDate, testPlan.CreatedAt, new List<TestScopeDto>()));
    }

    [HttpPut("testplans/{testPlanId}")]
    [Authorize(Roles = "Admin,Test Lead")]
    public async Task<IActionResult> UpdateTestPlan(int testPlanId, UpdateTestPlanDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Test plan name is required.");
        if (!TryNormalizeRange(dto.StartDate, dto.EndDate, out var startDate, out var endDate, out var rangeError))
        {
            return BadRequest(rangeError);
        }

        var testPlan = await _db.TestPlans
            .Include(tp => tp.Project)
            .FirstOrDefaultAsync(tp => tp.Id == testPlanId);
        if (testPlan is null) return NotFound();

        if (testPlan.Project.StartDate is null || testPlan.Project.EndDate is null)
        {
            return BadRequest("Project timeline is required before setting a test plan timeline.");
        }

        if (startDate!.Value.Date < testPlan.Project.StartDate.Value.Date || endDate!.Value.Date > testPlan.Project.EndDate.Value.Date)
        {
            return BadRequest("Test plan timeline must be within the project timeline.");
        }

        testPlan.Name = dto.Name.Trim();
        testPlan.StartDate = startDate;
        testPlan.EndDate = endDate;
        await _db.SaveChangesAsync();

        return Ok(new TestPlanDto(testPlan.Id, testPlan.ProjectId, testPlan.Name, testPlan.StartDate, testPlan.EndDate, testPlan.CreatedAt, new List<TestScopeDto>()));
    }

    [HttpGet("testplans/{testPlanId}/scopes")]
    public async Task<IActionResult> GetTestScopes(int testPlanId)
    {
        var exists = await _db.TestPlans.AnyAsync(tp => tp.Id == testPlanId);
        if (!exists) return NotFound();

        var scopes = await _db.TestScopes
            .Where(ts => ts.TestPlanId == testPlanId)
            .OrderBy(ts => ts.Name)
            .Select(ts => new TestScopeDto(ts.Id, ts.TestPlanId, ts.Name, ts.CreatedAt))
            .ToListAsync();

        return Ok(scopes);
    }

    [HttpPost("testplans/{testPlanId}/scopes")]
    [Authorize(Roles = "Admin,Test Lead")]
    public async Task<IActionResult> CreateTestScope(int testPlanId, CreateTestScopeDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Testing scope name is required.");

        var testPlan = await _db.TestPlans.FirstOrDefaultAsync(tp => tp.Id == testPlanId);
        if (testPlan is null) return NotFound();

        var normalized = dto.Name.Trim();
        var duplicateExists = await _db.TestScopes.AnyAsync(ts => ts.TestPlanId == testPlanId && ts.Name == normalized);
        if (duplicateExists) return BadRequest("This testing scope already exists in the test plan.");

        var scope = new TestScope
        {
            TestPlanId = testPlanId,
            Name = normalized,
            CreatedAt = DateTime.UtcNow,
        };

        _db.TestScopes.Add(scope);
        await _db.SaveChangesAsync();

        return Ok(new TestScopeDto(scope.Id, scope.TestPlanId, scope.Name, scope.CreatedAt));
    }

    [HttpDelete("testplans/{testPlanId}/scopes/{scopeId}")]
    [Authorize(Roles = "Admin,Test Lead")]
    public async Task<IActionResult> DeleteTestScope(int testPlanId, int scopeId)
    {
        var scope = await _db.TestScopes.FirstOrDefaultAsync(ts => ts.Id == scopeId && ts.TestPlanId == testPlanId);
        if (scope is null) return NotFound();

        var linkedCases = await _db.TestCases.Where(tc => tc.TestScopeId == scopeId).ToListAsync();
        foreach (var testCase in linkedCases)
        {
            testCase.TestScopeId = null;
        }

        _db.TestScopes.Remove(scope);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("testplans/{testPlanId}")]
    [Authorize(Roles = "Admin,Test Lead")]
    public async Task<IActionResult> DeleteTestPlan(int testPlanId)
    {
        var testPlan = await _db.TestPlans.FirstOrDefaultAsync(tp => tp.Id == testPlanId);
        if (testPlan is null) return NotFound();

        _db.TestPlans.Remove(testPlan);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static bool TryNormalizeRange(DateTime? startDate, DateTime? endDate, out DateTime? normalizedStartDate, out DateTime? normalizedEndDate, out string? error)
    {
        normalizedStartDate = null;
        normalizedEndDate = null;
        error = null;

        if (!startDate.HasValue || !endDate.HasValue)
        {
            error = "Start date and end date are required.";
            return false;
        }

        normalizedStartDate = DateTime.SpecifyKind(startDate.Value.Date, DateTimeKind.Utc);
        normalizedEndDate = DateTime.SpecifyKind(endDate.Value.Date, DateTimeKind.Utc);

        if (normalizedStartDate.Value.Date > normalizedEndDate.Value.Date)
        {
            error = "Start date cannot be later than end date.";
            return false;
        }

        return true;
    }
}

public record CreateProjectDto(string Name, DateTime? StartDate, DateTime? EndDate);
public record UpdateProjectDto(string Name, DateTime? StartDate, DateTime? EndDate);
public record CreateTestPlanDto(string Name, DateTime? StartDate, DateTime? EndDate);
public record UpdateTestPlanDto(string Name, DateTime? StartDate, DateTime? EndDate);
public record CreateTestScopeDto(string Name);
public record TestScopeDto(int Id, int TestPlanId, string Name, DateTime CreatedAt);
public record TestPlanDto(int Id, int ProjectId, string Name, DateTime? StartDate, DateTime? EndDate, DateTime CreatedAt, List<TestScopeDto> TestScopes);
public record ProjectDto(int Id, string Name, DateTime? StartDate, DateTime? EndDate, DateTime CreatedAt, List<TestPlanDto> TestPlans);
