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
}
