using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UATSystem.API.Migrations
{
    /// <inheritdoc />
    public partial class AddDefectClickUpLinkFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ClickUpCustomItemId",
                table: "Defects",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ClickUpCustomItemName",
                table: "Defects",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "ClickUpLinkedAt",
                table: "Defects",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ClickUpListId",
                table: "Defects",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ClickUpListName",
                table: "Defects",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ClickUpParentTaskId",
                table: "Defects",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ClickUpParentTaskName",
                table: "Defects",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ClickUpTaskId",
                table: "Defects",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ClickUpTaskUrl",
                table: "Defects",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ClickUpCustomItemId",
                table: "Defects");

            migrationBuilder.DropColumn(
                name: "ClickUpCustomItemName",
                table: "Defects");

            migrationBuilder.DropColumn(
                name: "ClickUpLinkedAt",
                table: "Defects");

            migrationBuilder.DropColumn(
                name: "ClickUpListId",
                table: "Defects");

            migrationBuilder.DropColumn(
                name: "ClickUpListName",
                table: "Defects");

            migrationBuilder.DropColumn(
                name: "ClickUpParentTaskId",
                table: "Defects");

            migrationBuilder.DropColumn(
                name: "ClickUpParentTaskName",
                table: "Defects");

            migrationBuilder.DropColumn(
                name: "ClickUpTaskId",
                table: "Defects");

            migrationBuilder.DropColumn(
                name: "ClickUpTaskUrl",
                table: "Defects");
        }
    }
}
