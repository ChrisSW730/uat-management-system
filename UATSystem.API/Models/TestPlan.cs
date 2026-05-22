namespace UATSystem.API.Models;

public class TestPlan
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Project Project { get; set; } = null!;
    public ICollection<TestCase> TestCases { get; set; } = new List<TestCase>();
    public ICollection<TestScope> TestScopes { get; set; } = new List<TestScope>();
    public ICollection<Defect> Defects { get; set; } = new List<Defect>();
}
