using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UATSystem.API.Data;

namespace UATSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly UATDbContext _db;

    public NotificationsController(UATDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetMyNotifications([FromQuery] bool unreadOnly = false)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userId, out var uid)) return Unauthorized();

        var query = _db.UserNotifications
            .Where(n => n.RecipientUserId == uid)
            .OrderByDescending(n => n.CreatedAt)
            .AsQueryable();

        if (unreadOnly)
        {
            query = query.Where(n => !n.IsRead);
        }

        var notifications = await query
            .Take(50)
            .Select(n => new NotificationDto(n.Id, n.Message, n.Link, n.IsRead, n.CreatedAt))
            .ToListAsync();

        return Ok(notifications);
    }

    [HttpPost("{id}/read")]
    public async Task<IActionResult> MarkAsRead(int id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userId, out var uid)) return Unauthorized();

        var notification = await _db.UserNotifications
            .FirstOrDefaultAsync(n => n.Id == id && n.RecipientUserId == uid);
        if (notification == null) return NotFound();

        notification.IsRead = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userId, out var uid)) return Unauthorized();

        var unread = await _db.UserNotifications
            .Where(n => n.RecipientUserId == uid && !n.IsRead)
            .ToListAsync();

        if (unread.Count == 0) return NoContent();

        foreach (var n in unread)
        {
            n.IsRead = true;
        }

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteNotification(int id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userId, out var uid)) return Unauthorized();

        var notification = await _db.UserNotifications
            .FirstOrDefaultAsync(n => n.Id == id && n.RecipientUserId == uid);
        if (notification == null) return NotFound();

        _db.UserNotifications.Remove(notification);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("clear-all")]
    public async Task<IActionResult> ClearAllNotifications()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userId, out var uid)) return Unauthorized();

        var notifications = await _db.UserNotifications
            .Where(n => n.RecipientUserId == uid)
            .ToListAsync();

        if (notifications.Count == 0) return NoContent();

        _db.UserNotifications.RemoveRange(notifications);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public record NotificationDto(int Id, string Message, string Link, bool IsRead, DateTime CreatedAt);
