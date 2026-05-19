using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UATSystem.API.Data;
using UATSystem.API.Models;

namespace UATSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
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
            .OrderBy(p => p.Name)
            .ToListAsync();

        return Ok(projects.Select(p => new ProjectDto(
            p.Id,
            p.Name,
            p.CreatedAt,
            p.TestPlans
                .OrderBy(tp => tp.Name)
                .Select(tp => new TestPlanDto(tp.Id, tp.ProjectId, tp.Name, tp.CreatedAt))
                .ToList()
        )));
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateProjectDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Project name is required.");

        var project = new Project
        {
            Name = dto.Name.Trim(),
            CreatedAt = DateTime.UtcNow,
        };

        _db.Projects.Add(project);
        await _db.SaveChangesAsync();

        return Ok(new ProjectDto(project.Id, project.Name, project.CreatedAt, new List<TestPlanDto>()));
    }

    [HttpPost("{projectId}/testplans")]
    public async Task<IActionResult> CreateTestPlan(int projectId, CreateTestPlanDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Test plan name is required.");

        var projectExists = await _db.Projects.AnyAsync(p => p.Id == projectId);
        if (!projectExists) return NotFound();

        var testPlan = new TestPlan
        {
            ProjectId = projectId,
            Name = dto.Name.Trim(),
            CreatedAt = DateTime.UtcNow,
        };

        _db.TestPlans.Add(testPlan);
        await _db.SaveChangesAsync();

        return Ok(new TestPlanDto(testPlan.Id, testPlan.ProjectId, testPlan.Name, testPlan.CreatedAt));
    }
}

public record CreateProjectDto(string Name);
public record CreateTestPlanDto(string Name);
public record TestPlanDto(int Id, int ProjectId, string Name, DateTime CreatedAt);
public record ProjectDto(int Id, string Name, DateTime CreatedAt, List<TestPlanDto> TestPlans);
