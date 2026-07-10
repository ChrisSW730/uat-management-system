namespace UATSystem.API.Models;

public class Defect
{
    public int Id { get; set; }
    public string DefectNumber { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public int ProjectId { get; set; }
    public int? TestRunId { get; set; }
    public int? TestCaseId { get; set; }
    public int? TestRunEntryId { get; set; }
    public int? TestPlanId { get; set; }
    public string Source { get; set; } = "Exploratory Testing";
    public string Severity { get; set; } = "Medium";
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
    public string ClickUpTaskId { get; set; } = string.Empty;
    public string ClickUpTaskUrl { get; set; } = string.Empty;
    public string ClickUpListId { get; set; } = string.Empty;
    public string ClickUpListName { get; set; } = string.Empty;
    public string ClickUpParentTaskId { get; set; } = string.Empty;
    public string ClickUpParentTaskName { get; set; } = string.Empty;
    public string ClickUpCustomItemId { get; set; } = string.Empty;
    public string ClickUpCustomItemName { get; set; } = string.Empty;
    public DateTime? ClickUpLinkedAt { get; set; }
    public DateTime? StatusUpdatedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Project Project { get; set; } = null!;
    public TestRun? TestRun { get; set; }
    public TestCase? TestCase { get; set; }
    public TestRunEntry? TestRunEntry { get; set; }
    public TestPlan? TestPlan { get; set; }
    public ICollection<DefectAuditLog> AuditLogs { get; set; } = new List<DefectAuditLog>();
    public ICollection<DefectAttachment> Attachments { get; set; } = new List<DefectAttachment>();
    public ICollection<DefectComment> Comments { get; set; } = new List<DefectComment>();
}