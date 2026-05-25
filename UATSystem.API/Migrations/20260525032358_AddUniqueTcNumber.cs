using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UATSystem.API.Migrations
{
    /// <inheritdoc />
    public partial class AddUniqueTcNumber : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_TestCases_TcNumber",
                table: "TestCases",
                column: "TcNumber",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TestCases_TcNumber",
                table: "TestCases");
        }
    }
}
