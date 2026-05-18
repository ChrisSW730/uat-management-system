using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UATSystem.API.Migrations
{
    /// <inheritdoc />
    public partial class MakeDefectRunEntryOptional : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Defects_TestRunEntries_TestRunEntryId",
                table: "Defects");

            migrationBuilder.AlterColumn<int>(
                name: "TestRunEntryId",
                table: "Defects",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddForeignKey(
                name: "FK_Defects_TestRunEntries_TestRunEntryId",
                table: "Defects",
                column: "TestRunEntryId",
                principalTable: "TestRunEntries",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Defects_TestRunEntries_TestRunEntryId",
                table: "Defects");

            migrationBuilder.AlterColumn<int>(
                name: "TestRunEntryId",
                table: "Defects",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Defects_TestRunEntries_TestRunEntryId",
                table: "Defects",
                column: "TestRunEntryId",
                principalTable: "TestRunEntries",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
