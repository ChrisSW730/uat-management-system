using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Microsoft.EntityFrameworkCore;
using UATSystem.API.Data;
using UATSystem.API.Models;

namespace UATSystem.API.Controllers;

[ApiController]
[Route("[controller]")]
public class AuthController : ControllerBase
{
    private readonly UATDbContext _db;
    private readonly IConfiguration _config;

    public AuthController(UATDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var username = request.Username?.Trim();
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest("Username and password are required.");
        }

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == username);
        if (user == null || !user.IsActive)
        {
            return Unauthorized("Invalid credentials.");
        }

        var hasher = new PasswordHasher<UserAccount>();
        var verify = hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verify == PasswordVerificationResult.Failed)
        {
            return Unauthorized("Invalid credentials.");
        }

        var token = CreateToken(user, request.RememberMe);
        return Ok(new AuthResponse(
            token,
            DateTime.UtcNow.AddMinutes(GetTokenExpiryMinutes(request.RememberMe)),
            new AuthUserDto(user.Id, user.Username, user.DisplayName, user.Role, user.MustChangePassword)
        ));
    }

    [AllowAnonymous]
    [HttpGet("admin-contact")]
    public async Task<IActionResult> GetAdminContact()
    {
        var admins = await _db.Users
            .Where(u => u.IsActive && u.Role == "Admin")
            .OrderBy(u => u.Id)
            .Select(u => u.Username)
            .ToListAsync();

        if (admins.Count == 0)
        {
            return NotFound("No active admin user found.");
        }

        return Ok(new AdminContactsDto(admins));
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var username = User.Identity?.Name;
        if (string.IsNullOrWhiteSpace(username)) return Unauthorized();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == username);
        if (user == null) return Unauthorized();

        return Ok(new AuthUserDto(user.Id, user.Username, user.DisplayName, user.Role, user.MustChangePassword));
    }

    [Authorize]
    [HttpGet("mention-users")]
    public async Task<IActionResult> GetMentionUsers()
    {
        var users = await _db.Users
            .Where(u => u.IsActive)
            .OrderBy(u => u.DisplayName)
            .Select(u => new MentionUserDto(u.Id, u.DisplayName, u.Username))
            .ToListAsync();

        return Ok(users);
    }

    private int GetTokenExpiryMinutes(bool rememberMe)
    {
        var configKey = rememberMe ? "Jwt:RememberMeExpiresMinutes" : "Jwt:ExpiresMinutes";
        if (int.TryParse(_config[configKey], out var minutes) && minutes > 0)
        {
            return minutes;
        }
        if (rememberMe)
        {
            return 43200;
        }
        return 480;
    }

    private string CreateToken(UserAccount user, bool rememberMe)
    {
        var key = _config["Jwt:Key"] ?? "DEV_ONLY_SUPER_SECRET_CHANGE_ME_1234567890";
        var issuer = _config["Jwt:Issuer"] ?? "UATSystem";
        var audience = _config["Jwt:Audience"] ?? "UATSystem";

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.Role, user.Role),
            new("display_name", user.DisplayName),
        };

        var creds = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            SecurityAlgorithms.HmacSha256
        );

        var token = new JwtSecurityToken(
            issuer,
            audience,
            claims,
            expires: DateTime.UtcNow.AddMinutes(GetTokenExpiryMinutes(rememberMe)),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public record LoginRequest(string Username, string Password, bool RememberMe = false);
public record AuthUserDto(int Id, string Username, string DisplayName, string Role, bool MustChangePassword = false);
public record AuthResponse(string Token, DateTime ExpiresAtUtc, AuthUserDto User);
public record AdminContactsDto(List<string> Usernames);
public record MentionUserDto(int Id, string DisplayName, string Username);