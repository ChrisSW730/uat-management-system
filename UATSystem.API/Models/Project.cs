namespace UATSystem.API.Models;

public class Project
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<TestPlan> TestPlans { get; set; } = new List<TestPlan>();
}
