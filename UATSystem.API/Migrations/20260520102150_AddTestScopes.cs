using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UATSystem.API.Migrations
{
    /// <inheritdoc />
    public partial class AddTestScopes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TestScopeId",
                table: "TestCases",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TestScopes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TestPlanId = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TestScopes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TestScopes_TestPlans_TestPlanId",
                        column: x => x.TestPlanId,
                        principalTable: "TestPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TestCases_TestScopeId",
                table: "TestCases",
                column: "TestScopeId");

            migrationBuilder.CreateIndex(
                name: "IX_TestScopes_TestPlanId",
                table: "TestScopes",
                column: "TestPlanId");

            migrationBuilder.AddForeignKey(
                name: "FK_TestCases_TestScopes_TestScopeId",
                table: "TestCases",
                column: "TestScopeId",
                principalTable: "TestScopes",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TestCases_TestScopes_TestScopeId",
                table: "TestCases");

            migrationBuilder.DropTable(
                name: "TestScopes");

            migrationBuilder.DropIndex(
                name: "IX_TestCases_TestScopeId",
                table: "TestCases");

            migrationBuilder.DropColumn(
                name: "TestScopeId",
                table: "TestCases");
        }
    }
}
