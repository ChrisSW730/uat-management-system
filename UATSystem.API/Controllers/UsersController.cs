using System.Security.Claims;
using System.Net.Mail;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using UATSystem.API.Data;
using UATSystem.API.Models;
using UATSystem.API.Services;

namespace UATSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly UATDbContext _db;
    private readonly SmtpSettings _smtpSettings;

    public UsersController(UATDbContext db, IOptions<SmtpSettings> smtpSettings)
    {
        _db = db;
        _smtpSettings = smtpSettings.Value;
    }

    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAll()
    {
        var users = await _db.Users
            .OrderBy(u => u.Username)
            .Select(u => new UserDto(u.Id, u.Username, u.DisplayName, u.Role, u.IsActive, u.MustChangePassword, u.CreatedAt, u.UpdatedAt))
            .ToListAsync();

        return Ok(users);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create(CreateUserRequest request)
    {
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

        var initialPassword = GenerateInitialPassword();
        user.PasswordHash = new PasswordHasher<UserAccount>().HashPassword(user, initialPassword);
        user.MustChangePassword = true;
        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return Ok(new CreateUserResponse(ToDto(user), initialPassword));
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
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
    [Authorize(Roles = "Admin")]
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

    private static bool IsValidRole(string? role) => role is "Admin" or "Test Lead" or "Tester" or "Developer" or "Viewer";
    private static string GenerateInitialPassword(int length = 12)
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*?";
        var bytes = RandomNumberGenerator.GetBytes(length);
        var result = new char[length];

        for (var i = 0; i < length; i++)
        {
            result[i] = chars[bytes[i] % chars.Length];
        }

        return new string(result);
    }

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

    private static UserDto ToDto(UserAccount user) => new(user.Id, user.Username, user.DisplayName, user.Role, user.IsActive, user.MustChangePassword, user.CreatedAt, user.UpdatedAt);

    [HttpPost("{id}/send-initial-password")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SendInitialPassword(int id, SendInitialPasswordRequest request)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound();

        try
        {
            using (var client = new SmtpClient(_smtpSettings.Host, _smtpSettings.Port))
            {
                client.EnableSsl = _smtpSettings.EnableSsl;
                client.Credentials = new System.Net.NetworkCredential(_smtpSettings.Username, _smtpSettings.Password);

                var subject = "Test Management System - Initial Password";
                var body = $@"
Dear {user.DisplayName},

Welcome to the Test Management System! Your account has been created by {request.CreatedBy}.

Your initial login credentials:
Username (Email): {request.Email}
Password: {request.InitialPassword}

Please log in with these credentials and update your password immediately for security purposes.

Best regards,
Test Management System
";

                var message = new MailMessage(_smtpSettings.FromAddress, request.Email, subject, body);
                await client.SendMailAsync(message);
            }

            return Ok(new { message = "Initial password email sent successfully" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Failed to send email: {ex.Message}");
        }
    }

    [HttpPost("{id}/change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword(int id, ChangePasswordRequest request)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound();

        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (user.Id.ToString() != currentUserId && !User.IsInRole("Admin"))
        {
            return Forbid();
        }

        var hasher = new PasswordHasher<UserAccount>();
        var verificationResult = hasher.VerifyHashedPassword(user, user.PasswordHash, request.OldPassword);

        if (verificationResult == PasswordVerificationResult.Failed)
        {
            return BadRequest("Current password is incorrect.");
        }

        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
        {
            return BadRequest("New password must be at least 6 characters.");
        }

        user.PasswordHash = hasher.HashPassword(user, request.NewPassword);
        user.MustChangePassword = false;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ToDto(user));
    }
}

public record UserDto(int Id, string Username, string DisplayName, string Role, bool IsActive, bool MustChangePassword, DateTime CreatedAt, DateTime? UpdatedAt);
public record CreateUserRequest(string Username, string DisplayName, string Role, bool IsActive = true);
public record CreateUserResponse(UserDto User, string InitialPassword);
public record UpdateUserRequest(string Username, string DisplayName, string? Password, string Role, bool IsActive = true);
public record SendInitialPasswordRequest(string Email, string InitialPassword, string CreatedBy);
public record ChangePasswordRequest(string OldPassword, string NewPassword);