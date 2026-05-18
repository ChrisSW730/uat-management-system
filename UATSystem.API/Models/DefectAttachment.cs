namespace UATSystem.API.Models;

public class DefectAttachment
{
    public int Id { get; set; }
    public int DefectId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string StoredFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long Size { get; set; }
    public string UploadedBy { get; set; } = "Unknown";
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    public Defect Defect { get; set; } = null!;
}
