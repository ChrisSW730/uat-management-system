using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UATSystem.API.Migrations
{
    /// <inheritdoc />
    public partial class FixTestCaseUniqueIndex2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TestCases_TcNumber",
                table: "TestCases");

            migrationBuilder.CreateIndex(
                name: "IX_TestCases_TestPlanId_TcNumber",
                table: "TestCases",
                columns: new[] { "TestPlanId", "TcNumber" },
                unique: true,
                filter: "[TestPlanId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TestCases_TestPlanId_TcNumber",
                table: "TestCases");

            migrationBuilder.CreateIndex(
                name: "IX_TestCases_TcNumber",
                table: "TestCases",
                column: "TcNumber",
                unique: true);
        }
    }
}
