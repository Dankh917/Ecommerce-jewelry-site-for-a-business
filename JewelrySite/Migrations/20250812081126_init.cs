using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace JewelrySite.Migrations
{
    /// <inheritdoc />
    public partial class init : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "JewelryItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1000, 1"),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Category = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Collection = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    WeightGrams = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Color = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SizeCM = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Price = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    StockQuantity = table.Column<int>(type: "int", nullable: true),
                    IsAvailable = table.Column<bool>(type: "bit", nullable: true),
                    MainImageUrl = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    VideoUrl = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    VideoPosterUrl = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    VideoDurationSeconds = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_JewelryItems", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "JewelryImage",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    JewelryItemId = table.Column<int>(type: "int", nullable: false),
                    Url = table.Column<string>(type: "nvarchar(500)", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_JewelryImage", x => x.Id);
                    table.ForeignKey(
                        name: "FK_JewelryImage_JewelryItems_JewelryItemId",
                        column: x => x.JewelryItemId,
                        principalTable: "JewelryItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_JewelryImage_JewelryItemId",
                table: "JewelryImage",
                column: "JewelryItemId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "JewelryImage");

            migrationBuilder.DropTable(
                name: "JewelryItems");
        }
    }
}
