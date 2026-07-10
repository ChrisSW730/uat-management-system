using Microsoft.EntityFrameworkCore;
using UATSystem.API.Models;

namespace UATSystem.API.Data;

public class UATDbContext : DbContext
{
    public UATDbContext(DbContextOptions<UATDbContext> options) : base(options) { }

    public DbSet<Project> Projects => Set<Project>();
    public DbSet<TestPlan> TestPlans => Set<TestPlan>();
    public DbSet<TestScope> TestScopes => Set<TestScope>();
    public DbSet<TestCase> TestCases => Set<TestCase>();
    public DbSet<TestRun> TestRuns => Set<TestRun>();
    public DbSet<TestRunEntry> TestRunEntries => Set<TestRunEntry>();
    public DbSet<TestRunEntryComment> TestRunEntryComments => Set<TestRunEntryComment>();
    public DbSet<Defect> Defects => Set<Defect>();
    public DbSet<TestCaseDefect> TestCaseDefects => Set<TestCaseDefect>();
    public DbSet<DefectComment> DefectComments => Set<DefectComment>();
    public DbSet<DefectAuditLog> DefectAuditLogs => Set<DefectAuditLog>();
    public DbSet<DefectAttachment> DefectAttachments => Set<DefectAttachment>();
    public DbSet<TestCaseAttachment> TestCaseAttachments => Set<TestCaseAttachment>();
    public DbSet<UserAccount> Users => Set<UserAccount>();
    public DbSet<UserNotification> UserNotifications => Set<UserNotification>();
    public DbSet<Category> Categories => Set<Category>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<TestPlan>()
            .HasOne(tp => tp.Project)
            .WithMany(p => p.TestPlans)
            .HasForeignKey(tp => tp.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TestCase>()
            .HasOne(tc => tc.TestPlan)
            .WithMany(tp => tp.TestCases)
            .HasForeignKey(tc => tc.TestPlanId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<TestScope>()
            .HasOne(ts => ts.TestPlan)
            .WithMany(tp => tp.TestScopes)
            .HasForeignKey(ts => ts.TestPlanId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TestCase>()
            .HasOne(tc => tc.TestScope)
            .WithMany(ts => ts.TestCases)
            .HasForeignKey(tc => tc.TestScopeId)
            .OnDelete(DeleteBehavior.NoAction);

        modelBuilder.Entity<TestCase>()
            .HasIndex(tc => new { tc.TestPlanId, tc.TcNumber })
            .IsUnique();

        modelBuilder.Entity<TestRunEntry>()
            .HasOne(e => e.TestRun)
            .WithMany(r => r.Entries)
            .HasForeignKey(e => e.TestRunId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TestRunEntry>()
            .HasOne(e => e.TestCase)
            .WithMany(tc => tc.TestRunEntries)
            .HasForeignKey(e => e.TestCaseId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Defect>()
            .HasOne(d => d.TestRunEntry)
            .WithMany(e => e.Defects)
            .HasForeignKey(d => d.TestRunEntryId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Defect>()
            .HasOne(d => d.Project)
            .WithMany(p => p.Defects)
            .HasForeignKey(d => d.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Defect>()
            .HasOne(d => d.TestPlan)
            .WithMany(tp => tp.Defects)
            .HasForeignKey(d => d.TestPlanId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Defect>()
            .HasOne(d => d.TestRun)
            .WithMany(r => r.Defects)
            .HasForeignKey(d => d.TestRunId)
            .OnDelete(DeleteBehavior.NoAction);

        modelBuilder.Entity<Defect>()
            .HasOne(d => d.TestCase)
            .WithMany(tc => tc.Defects)
            .HasForeignKey(d => d.TestCaseId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Defect>()
            .HasIndex(d => d.DefectNumber)
            .IsUnique();

        modelBuilder.Entity<TestCaseDefect>()
            .HasOne(link => link.Defect)
            .WithMany(d => d.TestCaseDefects)
            .HasForeignKey(link => link.DefectId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TestCaseDefect>()
            .HasOne(link => link.TestCase)
            .WithMany(tc => tc.DefectLinks)
            .HasForeignKey(link => link.TestCaseId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TestCaseDefect>()
            .HasIndex(link => new { link.DefectId, link.TestCaseId })
            .IsUnique();

        modelBuilder.Entity<TestRunEntryComment>()
            .HasOne(c => c.TestRunEntry)
            .WithMany(e => e.Comments)
            .HasForeignKey(c => c.TestRunEntryId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<DefectComment>()
            .HasOne(c => c.Defect)
            .WithMany(d => d.Comments)
            .HasForeignKey(c => c.DefectId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<DefectAuditLog>()
            .HasOne(a => a.Defect)
            .WithMany(d => d.AuditLogs)
            .HasForeignKey(a => a.DefectId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<DefectAttachment>()
            .HasOne(a => a.Defect)
            .WithMany(d => d.Attachments)
            .HasForeignKey(a => a.DefectId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TestCaseAttachment>()
            .HasOne(a => a.TestCase)
            .WithMany(tc => tc.Attachments)
            .HasForeignKey(a => a.TestCaseId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserAccount>()
            .HasIndex(u => u.Username)
            .IsUnique();

        modelBuilder.Entity<UserNotification>()
            .HasOne(n => n.Recipient)
            .WithMany()
            .HasForeignKey(n => n.RecipientUserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserNotification>()
            .HasIndex(n => new { n.RecipientUserId, n.IsRead, n.CreatedAt });

        modelBuilder.Entity<Category>()
            .HasIndex(c => c.Name)
            .IsUnique();
    }
}