using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UATSystem.API.Data;
using UATSystem.API.Models;

namespace UATSystem.API.Controllers;

[ApiController]
[Route("[controller]")]
[Authorize]
public class CategoriesController : ControllerBase
{
    private readonly UATDbContext _db;

    public CategoriesController(UATDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var categories = await _db.Categories
            .OrderBy(c => c.Name)
            .Select(c => c.Name)
            .ToListAsync();

        return Ok(categories);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create(Category request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest("Category name is required.");
        }

        var name = request.Name.Trim();
        if (await _db.Categories.AnyAsync(c => c.Name == name))
        {
            return BadRequest("Category already exists.");
        }

        var category = new Category
        {
            Name = name,
            CreatedAt = DateTime.UtcNow
        };

        _db.Categories.Add(category);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAll), null, new { name = category.Name });
    }

    [HttpDelete]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete([FromQuery] string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest("Category name is required.");
        }

        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Name == name);
        if (category == null)
        {
            return NotFound();
        }

        _db.Categories.Remove(category);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
