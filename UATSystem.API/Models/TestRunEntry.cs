namespace UATSystem.API.Models;

public class TestRunEntry
{
    public int Id { get; set; }
    public int TestRunId { get; set; }
    public int TestCaseId { get; set; }
    public string ExecStatus { get; set; } = "Not Run";
    public string Comment { get; set; } = string.Empty;

    public TestRun TestRun { get; set; } = null!;
    public TestCase TestCase { get; set; } = null!;
    public ICollection<Defect> Defects { get; set; } = new List<Defect>();
    public ICollection<TestRunEntryComment> Comments { get; set; } = new List<TestRunEntryComment>();
}