namespace UATSystem.API.Models;

public class UserNotification
{
    public int Id { get; set; }
    public int RecipientUserId { get; set; }
    public UserAccount? Recipient { get; set; }
    public string Message { get; set; } = string.Empty;
    public string Link { get; set; } = string.Empty;
    public bool IsRead { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
