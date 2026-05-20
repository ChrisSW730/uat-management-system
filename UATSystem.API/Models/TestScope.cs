namespace UATSystem.API.Models;

public class TestScope
{
    public int Id { get; set; }
    public int TestPlanId { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public TestPlan TestPlan { get; set; } = null!;
    public ICollection<TestCase> TestCases { get; set; } = new List<TestCase>();
}