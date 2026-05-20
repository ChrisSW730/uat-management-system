using Microsoft.EntityFrameworkCore;
using UATSystem.API.Models;

namespace UATSystem.API.Data;

public class UATDbContext : DbContext
{
    public UATDbContext(DbContextOptions<UATDbContext> options) : base(options) { }

    public DbSet<Project> Projects => Set<Project>();
    public DbSet<TestPlan> TestPlans => Set<TestPlan>();
    public DbSet<TestCase> TestCases => Set<TestCase>();
    public DbSet<TestRun> TestRuns => Set<TestRun>();
    public DbSet<TestRunEntry> TestRunEntries => Set<TestRunEntry>();
    public DbSet<TestRunEntryComment> TestRunEntryComments => Set<TestRunEntryComment>();
    public DbSet<Defect> Defects => Set<Defect>();
    public DbSet<DefectComment> DefectComments => Set<DefectComment>();
    public DbSet<DefectAuditLog> DefectAuditLogs => Set<DefectAuditLog>();
    public DbSet<DefectAttachment> DefectAttachments => Set<DefectAttachment>();
    public DbSet<TestCaseAttachment> TestCaseAttachments => Set<TestCaseAttachment>();
    public DbSet<UserAccount> Users => Set<UserAccount>();

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
    }
}