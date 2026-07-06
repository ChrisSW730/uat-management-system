namespace UATSystem.API.Models;

public class Project
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<TestPlan> TestPlans { get; set; } = new List<TestPlan>();
    public ICollection<Defect> Defects { get; set; } = new List<Defect>();
}
