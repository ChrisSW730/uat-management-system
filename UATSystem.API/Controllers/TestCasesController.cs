using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UATSystem.API.Data;
using UATSystem.API.Models;

namespace UATSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TestCasesController : ControllerBase
{
    private readonly UATDbContext _db;
    public TestCasesController(UATDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await _db.TestCases.OrderBy(t => t.TcNumber).ToListAsync());

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(int id)
    {
        var tc = await _db.TestCases.FindAsync(id);
        return tc == null ? NotFound() : Ok(tc);
    }

    [HttpPost]
    public async Task<IActionResult> Create(TestCase tc)
    {
        var count = await _db.TestCases.CountAsync();
        tc.TcNumber = $"TC-{(count + 1):D3}";
        tc.CreatedAt = DateTime.UtcNow;
        _db.TestCases.Add(tc);
        await _db.SaveChangesAsync();
        return Ok(tc);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, TestCase updated)
    {
        var tc = await _db.TestCases.FindAsync(id);
        if (tc == null) return NotFound();
        tc.Name = updated.Name;
        tc.Description = updated.Description;
        tc.Steps = updated.Steps;
        tc.ExpectedResult = updated.ExpectedResult;
        tc.Priority = updated.Priority;
        tc.Category = updated.Category;
        tc.Remarks = updated.Remarks;
        await _db.SaveChangesAsync();
        return Ok(tc);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var tc = await _db.TestCases.FindAsync(id);
        if (tc == null) return NotFound();
        _db.TestCases.Remove(tc);
        await _db.SaveChangesAsync();
        return Ok();
    }
}