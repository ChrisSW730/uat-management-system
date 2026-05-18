namespace UATSystem.API.Models;

public class DefectAuditLog
{
    public int Id { get; set; }
    public int DefectId { get; set; }
    public string FieldName { get; set; } = string.Empty;
    public string OldValue { get; set; } = string.Empty;
    public string NewValue { get; set; } = string.Empty;
    public string ChangedBy { get; set; } = string.Empty;
    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;

    public Defect Defect { get; set; } = null!;
}