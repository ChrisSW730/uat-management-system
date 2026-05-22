using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UATSystem.API.Migrations
{
    /// <inheritdoc />
    public partial class AddTestPlanToDefect : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TestPlanId",
                table: "Defects",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Defects_TestPlanId",
                table: "Defects",
                column: "TestPlanId");

            migrationBuilder.AddForeignKey(
                name: "FK_Defects_TestPlans_TestPlanId",
                table: "Defects",
                column: "TestPlanId",
                principalTable: "TestPlans",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Defects_TestPlans_TestPlanId",
                table: "Defects");

            migrationBuilder.DropIndex(
                name: "IX_Defects_TestPlanId",
                table: "Defects");

            migrationBuilder.DropColumn(
                name: "TestPlanId",
                table: "Defects");
        }
    }
}
