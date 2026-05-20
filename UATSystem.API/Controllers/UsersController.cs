using System.Security.Claims;
using System.Net.Mail;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UATSystem.API.Data;
using UATSystem.API.Models;

namespace UATSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class UsersController : ControllerBase
{
    private readonly UATDbContext _db;

    public UsersController(UATDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var users = await _db.Users
            .OrderBy(u => u.Username)
            .Select(u => new UserDto(u.Id, u.Username, u.DisplayName, u.Role, u.IsActive, u.CreatedAt, u.UpdatedAt))
            .ToListAsync();

        return Ok(users);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateUserRequest request)
    {
        var username = request.Username?.Trim();
        var displayName = request.DisplayName?.Trim();
        var role = request.Role?.Trim();

        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(displayName) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest("Username, display name, and password are required.");
        }

        if (!IsValidEmail(username))
        {
            return BadRequest("Username must be a valid email address.");
        }

        if (!IsValidRole(role))
        {
            return BadRequest("Invalid role.");
        }

        if (await _db.Users.AnyAsync(u => u.Username == username))
        {
            return BadRequest("Username already exists.");
        }

        var user = new UserAccount
        {
            Username = username,
            DisplayName = displayName,
            Role = role!,
            IsActive = request.IsActive,
            CreatedAt = DateTime.UtcNow,
        };

        user.PasswordHash = new PasswordHasher<UserAccount>().HashPassword(user, request.Password);
        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return Ok(ToDto(user));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, UpdateUserRequest request)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound();

        var username = request.Username?.Trim();
        var displayName = request.DisplayName?.Trim();
        var role = request.Role?.Trim();

        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(displayName))
        {
            return BadRequest("Username and display name are required.");
        }

        if (!IsValidEmail(username))
        {
            return BadRequest("Username must be a valid email address.");
        }

        if (!IsValidRole(role))
        {
            return BadRequest("Invalid role.");
        }

        if (await _db.Users.AnyAsync(u => u.Username == username && u.Id != id))
        {
            return BadRequest("Username already exists.");
        }

        user.Username = username;
        user.DisplayName = displayName;
        user.Role = role!;
        user.IsActive = request.IsActive;
        user.UpdatedAt = DateTime.UtcNow;

        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            user.PasswordHash = new PasswordHasher<UserAccount>().HashPassword(user, request.Password);
        }

        await _db.SaveChangesAsync();
        return Ok(ToDto(user));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (currentUserId == id.ToString())
        {
            return BadRequest("You cannot delete your own account.");
        }

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound();

        _db.Users.Remove(user);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static bool IsValidRole(string? role) => role is "Admin" or "Test Lead" or "Tester" or "Viewer";
    private static bool IsValidEmail(string value)
    {
        try
        {
            _ = new MailAddress(value);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static UserDto ToDto(UserAccount user) => new(user.Id, user.Username, user.DisplayName, user.Role, user.IsActive, user.CreatedAt, user.UpdatedAt);
}

public record UserDto(int Id, string Username, string DisplayName, string Role, bool IsActive, DateTime CreatedAt, DateTime? UpdatedAt);
public record CreateUserRequest(string Username, string DisplayName, string Password, string Role, bool IsActive = true);
public record UpdateUserRequest(string Username, string DisplayName, string? Password, string Role, bool IsActive = true);