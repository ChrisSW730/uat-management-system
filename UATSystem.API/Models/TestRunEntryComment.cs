namespace UATSystem.API.Models;

public class TestRunEntryComment
{
    public int Id { get; set; }
    public int TestRunEntryId { get; set; }
    public string Tester { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public TestRunEntry TestRunEntry { get; set; } = null!;
}
