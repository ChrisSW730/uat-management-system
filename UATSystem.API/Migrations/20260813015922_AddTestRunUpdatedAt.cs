using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UATSystem.API.Migrations
{
    /// <inheritdoc />
    public partial class AddTestRunUpdatedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "TestRuns",
                type: "datetime2",
                nullable: false,
                defaultValueSql: "GETUTCDATE()");

            migrationBuilder.Sql("UPDATE [TestRuns] SET [UpdatedAt] = [CreatedAt]");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "TestRuns");
        }
    }
}
