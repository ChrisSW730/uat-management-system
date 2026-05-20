namespace UATSystem.API.Models;

public class DefectComment
{
    public int Id { get; set; }
    public int DefectId { get; set; }
    public string Tester { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Defect Defect { get; set; } = null!;
}
