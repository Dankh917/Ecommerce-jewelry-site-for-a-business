using System.Collections.Generic;

namespace JewelrySite.DTO
{
    public record JewelryItemCatalogDto(
        int Id,
        string Name,
        string? Description,
        string Category,
        string Collection,
        decimal? Price,
        int? StockQuantity,
        bool? IsAvailable,
        string MainImageUrl,
        string? Color,
        string? SizeCM,
        decimal? ShippingPrice
    );

    public class JewelryImageDetailDto
    {
        public int Id { get; init; }
        public int JewelryItemId { get; init; }
        public string Url { get; init; } = string.Empty;
        public int SortOrder { get; init; }
    }

    public class JewelryItemDetailDto
    {
        public int Id { get; init; }
        public string Name { get; init; } = string.Empty;
        public string Description { get; init; } = string.Empty;
        public string Category { get; init; } = string.Empty;
        public string? Collection { get; init; }
        public decimal? WeightGrams { get; init; }
        public string? Color { get; init; }
        public string? SizeCM { get; init; }
        public decimal? Price { get; init; }
        public int? StockQuantity { get; init; }
        public bool? IsAvailable { get; init; }
        public string? MainImageUrl { get; init; }
        public decimal ShippingPrice { get; init; }
        public string? VideoUrl { get; init; }
        public string? VideoPosterUrl { get; init; }
        public int? VideoDurationSeconds { get; init; }
        public List<JewelryImageDetailDto> GalleryImages { get; init; } = new();
    }
}
