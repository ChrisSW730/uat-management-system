using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UATSystem.API.Migrations
{
    /// <inheritdoc />
    public partial class AddClickUpIntegrationSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ClickUpApiTokenEncrypted",
                table: "Users",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ClickUpIntegrationEnabled",
                table: "Users",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ClickUpMappingsJson",
                table: "Users",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ClickUpSpaceId",
                table: "Users",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ClickUpSpaceName",
                table: "Users",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ClickUpValidationStatus",
                table: "Users",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ClickUpWorkspaceId",
                table: "Users",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ClickUpWorkspaceName",
                table: "Users",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ClickUpApiTokenEncrypted",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ClickUpIntegrationEnabled",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ClickUpMappingsJson",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ClickUpSpaceId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ClickUpSpaceName",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ClickUpValidationStatus",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ClickUpWorkspaceId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ClickUpWorkspaceName",
                table: "Users");
        }
    }
}
