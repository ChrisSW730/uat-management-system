using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UATSystem.API.Migrations
{
    /// <inheritdoc />
    public partial class AlignDefectDecouplingModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Defects_TestPlans_TestPlanId",
                table: "Defects");

            migrationBuilder.AlterColumn<string>(
                name: "DefectNumber",
                table: "Defects",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<int>(
                name: "ProjectId",
                table: "Defects",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Severity",
                table: "Defects",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "Defects",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TestCaseId",
                table: "Defects",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TestRunId",
                table: "Defects",
                type: "int",
                nullable: true);

            migrationBuilder.Sql(@"
UPDATE d
SET d.ProjectId = tp.ProjectId
FROM Defects d
INNER JOIN TestPlans tp ON tp.Id = d.TestPlanId
WHERE d.ProjectId IS NULL;
");

            migrationBuilder.Sql(@"
UPDATE d
SET d.ProjectId = tp.ProjectId
FROM Defects d
INNER JOIN TestRunEntries tre ON tre.Id = d.TestRunEntryId
INNER JOIN TestCases tc ON tc.Id = tre.TestCaseId
INNER JOIN TestPlans tp ON tp.Id = tc.TestPlanId
WHERE d.ProjectId IS NULL;
");

            migrationBuilder.Sql(@"
UPDATE d
SET d.TestRunId = tre.TestRunId,
    d.TestCaseId = tre.TestCaseId
FROM Defects d
INNER JOIN TestRunEntries tre ON tre.Id = d.TestRunEntryId
WHERE d.TestRunId IS NULL OR d.TestCaseId IS NULL;
");

            migrationBuilder.Sql(@"
UPDATE d
SET d.Source = 'Exploratory Testing'
FROM Defects d
WHERE d.Source IS NULL OR LTRIM(RTRIM(d.Source)) = '';
");

            migrationBuilder.Sql(@"
UPDATE d
SET d.Severity = 'Medium'
FROM Defects d
WHERE d.Severity IS NULL OR LTRIM(RTRIM(d.Severity)) = '';
");

            migrationBuilder.Sql(@"
UPDATE d
SET d.ProjectId = p.Id
FROM Defects d
CROSS JOIN (SELECT TOP 1 Id FROM Projects ORDER BY Id) p
WHERE d.ProjectId IS NULL;
");

            migrationBuilder.AlterColumn<int>(
                name: "ProjectId",
                table: "Defects",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Source",
                table: "Defects",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Severity",
                table: "Defects",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.Sql(@"
UPDATE d
SET d.DefectNumber = 'DEF-' + RIGHT(REPLICATE('0', 6) + CAST(d.Id AS varchar(20)), 6)
FROM Defects d;
");

            migrationBuilder.CreateIndex(
                name: "IX_Defects_DefectNumber",
                table: "Defects",
                column: "DefectNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Defects_ProjectId",
                table: "Defects",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_Defects_TestCaseId",
                table: "Defects",
                column: "TestCaseId");

            migrationBuilder.CreateIndex(
                name: "IX_Defects_TestRunId",
                table: "Defects",
                column: "TestRunId");

            migrationBuilder.AddForeignKey(
                name: "FK_Defects_Projects_ProjectId",
                table: "Defects",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Defects_TestCases_TestCaseId",
                table: "Defects",
                column: "TestCaseId",
                principalTable: "TestCases",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Defects_TestPlans_TestPlanId",
                table: "Defects",
                column: "TestPlanId",
                principalTable: "TestPlans",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Defects_TestRuns_TestRunId",
                table: "Defects",
                column: "TestRunId",
                principalTable: "TestRuns",
                principalColumn: "Id",
                onDelete: ReferentialAction.NoAction);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Defects_Projects_ProjectId",
                table: "Defects");

            migrationBuilder.DropForeignKey(
                name: "FK_Defects_TestCases_TestCaseId",
                table: "Defects");

            migrationBuilder.DropForeignKey(
                name: "FK_Defects_TestPlans_TestPlanId",
                table: "Defects");

            migrationBuilder.DropForeignKey(
                name: "FK_Defects_TestRuns_TestRunId",
                table: "Defects");

            migrationBuilder.DropIndex(
                name: "IX_Defects_DefectNumber",
                table: "Defects");

            migrationBuilder.DropIndex(
                name: "IX_Defects_ProjectId",
                table: "Defects");

            migrationBuilder.DropIndex(
                name: "IX_Defects_TestCaseId",
                table: "Defects");

            migrationBuilder.DropIndex(
                name: "IX_Defects_TestRunId",
                table: "Defects");

            migrationBuilder.DropColumn(
                name: "ProjectId",
                table: "Defects");

            migrationBuilder.DropColumn(
                name: "Severity",
                table: "Defects");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "Defects");

            migrationBuilder.DropColumn(
                name: "TestCaseId",
                table: "Defects");

            migrationBuilder.DropColumn(
                name: "TestRunId",
                table: "Defects");

            migrationBuilder.AlterColumn<string>(
                name: "Source",
                table: "Defects",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "Severity",
                table: "Defects",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<int>(
                name: "ProjectId",
                table: "Defects",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AlterColumn<string>(
                name: "DefectNumber",
                table: "Defects",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.AddForeignKey(
                name: "FK_Defects_TestPlans_TestPlanId",
                table: "Defects",
                column: "TestPlanId",
                principalTable: "TestPlans",
                principalColumn: "Id");
        }
    }
}
