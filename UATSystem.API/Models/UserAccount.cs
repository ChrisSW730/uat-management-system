namespace UATSystem.API.Models;

public class UserAccount
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public bool MustChangePassword { get; set; } = false;
    public string? ClickUpApiTokenEncrypted { get; set; }
    public bool ClickUpIntegrationEnabled { get; set; }
    public string ClickUpValidationStatus { get; set; } = "not-validated";
    public string? ClickUpWorkspaceId { get; set; }
    public string? ClickUpWorkspaceName { get; set; }
    public string? ClickUpSpaceId { get; set; }
    public string? ClickUpSpaceName { get; set; }
    public string? ClickUpMappingsJson { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}