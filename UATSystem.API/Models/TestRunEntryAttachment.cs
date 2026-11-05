namespace UATSystem.API.Models;

public class TestRunEntryAttachment
{
    public int Id { get; set; }
    public int TestRunEntryId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string StoredFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long Size { get; set; }
    public string UploadedBy { get; set; } = "Unknown";
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    public TestRunEntry TestRunEntry { get; set; } = null!;
}
