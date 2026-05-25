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
            migrationBuilder.AlterColumn<string>(
                name: "TcNumber",
                table: "TestCases",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            // Deduplicate TcNumber values before adding unique index.
            // For any duplicates, append -2, -3, etc. to make them unique.
            migrationBuilder.Sql(@"
                WITH Dupes AS (
                    SELECT Id, TcNumber,
                           ROW_NUMBER() OVER (PARTITION BY TcNumber ORDER BY Id) AS rn
                    FROM TestCases
                )
                UPDATE Dupes
                SET TcNumber = TcNumber + '-' + CAST(rn AS NVARCHAR(10))
                WHERE rn > 1;
            ");

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

            migrationBuilder.AlterColumn<string>(
                name: "TcNumber",
                table: "TestCases",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");
        }
    }
}
