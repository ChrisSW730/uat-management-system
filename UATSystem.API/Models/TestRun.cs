namespace UATSystem.API.Models;

public class TestRun
{
    public int Id { get; set; }
    public string RunNumber { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Tester { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<TestRunEntry> Entries { get; set; } = new List<TestRunEntry>();
}