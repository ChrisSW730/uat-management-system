namespace UATSystem.API.Models;

public class TestCaseDefect
{
    public int Id { get; set; }
    public int TestCaseId { get; set; }
    public int DefectId { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

    public TestCase TestCase { get; set; } = null!;
    public Defect Defect { get; set; } = null!;
}
