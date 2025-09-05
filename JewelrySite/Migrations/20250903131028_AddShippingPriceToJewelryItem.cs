using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace JewelrySite.Migrations
{
    /// <inheritdoc />
    public partial class AddShippingPriceToJewelryItem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "ShippingPrice",
                table: "JewelryItems",
                type: "decimal(18,2)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ShippingPrice",
                table: "JewelryItems");
        }
    }
}
