using Microsoft.EntityFrameworkCore;
using UATSystem.API.Models;

namespace UATSystem.API.Data;

public class UATDbContext : DbContext
{
    public UATDbContext(DbContextOptions<UATDbContext> options) : base(options) { }

    public DbSet<TestCase> TestCases => Set<TestCase>();
    public DbSet<TestRun> TestRuns => Set<TestRun>();
    public DbSet<TestRunEntry> TestRunEntries => Set<TestRunEntry>();
    public DbSet<Defect> Defects => Set<Defect>();
    public DbSet<DefectAuditLog> DefectAuditLogs => Set<DefectAuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
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
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<DefectAuditLog>()
            .HasOne(a => a.Defect)
            .WithMany(d => d.AuditLogs)
            .HasForeignKey(a => a.DefectId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}