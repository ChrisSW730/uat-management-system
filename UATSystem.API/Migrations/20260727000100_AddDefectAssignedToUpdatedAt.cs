using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using UATSystem.API.Data;

#nullable disable

namespace UATSystem.API.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(UATDbContext))]
    [Migration("20260727000100_AddDefectAssignedToUpdatedAt")]
    public partial class AddDefectAssignedToUpdatedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "AssignedToUpdatedAt",
                table: "Defects",
                type: "datetime2",
                nullable: true);

            migrationBuilder.Sql(@"
                UPDATE [Defects]
                SET [AssignedToUpdatedAt] = COALESCE([StatusUpdatedAt], [CreatedAt], [OpenDateTime], [DateRaised])
                WHERE [AssignedToUpdatedAt] IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AssignedToUpdatedAt",
                table: "Defects");
        }
    }
}