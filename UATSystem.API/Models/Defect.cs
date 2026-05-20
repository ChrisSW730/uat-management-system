namespace UATSystem.API.Models;

public class Defect
{
    public int Id { get; set; }
    public string DefectNumber { get; set; } = string.Empty;
    public int? TestRunEntryId { get; set; }
    public string RunNumber { get; set; } = string.Empty;
    public string TcNumber { get; set; } = string.Empty;
    public string Market { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string IssueType { get; set; } = string.Empty;
    public string ExpectedResult { get; set; } = string.Empty;
    public string ActualResult { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public string Status { get; set; } = "New";
    public string RaisedBy { get; set; } = string.Empty;
    public string AssignedTo { get; set; } = string.Empty;
    public DateTime DateRaised { get; set; } = DateTime.UtcNow;
    public DateTime OpenDateTime { get; set; } = DateTime.UtcNow;
    public DateTime? CloseDateTime { get; set; }
    public DateTime? TargetFixDate { get; set; }
    public string Remarks { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public TestRunEntry? TestRunEntry { get; set; }
    public ICollection<DefectAuditLog> AuditLogs { get; set; } = new List<DefectAuditLog>();
    public ICollection<DefectAttachment> Attachments { get; set; } = new List<DefectAttachment>();
    public ICollection<DefectComment> Comments { get; set; } = new List<DefectComment>();
}