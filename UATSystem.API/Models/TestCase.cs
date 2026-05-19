namespace UATSystem.API.Models;

public class TestCase
{
    public int Id { get; set; }
    public int? TestPlanId { get; set; }
    public string TcNumber { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Steps { get; set; } = string.Empty;
    public string ExpectedResult { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Remarks { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public TestPlan? TestPlan { get; set; }
    public ICollection<TestRunEntry> TestRunEntries { get; set; } = new List<TestRunEntry>();
    public ICollection<TestCaseAttachment> Attachments { get; set; } = new List<TestCaseAttachment>();
}