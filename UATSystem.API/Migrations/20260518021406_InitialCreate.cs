using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UATSystem.API.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TestCases",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TcNumber = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Steps = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ExpectedResult = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Priority = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Category = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Remarks = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TestCases", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TestRuns",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RunNumber = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Tester = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TestRuns", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TestRunEntries",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TestRunId = table.Column<int>(type: "int", nullable: false),
                    TestCaseId = table.Column<int>(type: "int", nullable: false),
                    ExecStatus = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Comment = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TestRunEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TestRunEntries_TestCases_TestCaseId",
                        column: x => x.TestCaseId,
                        principalTable: "TestCases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TestRunEntries_TestRuns_TestRunId",
                        column: x => x.TestRunId,
                        principalTable: "TestRuns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Defects",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DefectNumber = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TestRunEntryId = table.Column<int>(type: "int", nullable: false),
                    RunNumber = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TcNumber = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Market = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IssueType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ExpectedResult = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ActualResult = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Priority = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    RaisedBy = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    AssignedTo = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DateRaised = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TargetFixDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Remarks = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Defects", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Defects_TestRunEntries_TestRunEntryId",
                        column: x => x.TestRunEntryId,
                        principalTable: "TestRunEntries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Defects_TestRunEntryId",
                table: "Defects",
                column: "TestRunEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_TestRunEntries_TestCaseId",
                table: "TestRunEntries",
                column: "TestCaseId");

            migrationBuilder.CreateIndex(
                name: "IX_TestRunEntries_TestRunId",
                table: "TestRunEntries",
                column: "TestRunId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Defects");

            migrationBuilder.DropTable(
                name: "TestRunEntries");

            migrationBuilder.DropTable(
                name: "TestCases");

            migrationBuilder.DropTable(
                name: "TestRuns");
        }
    }
}
