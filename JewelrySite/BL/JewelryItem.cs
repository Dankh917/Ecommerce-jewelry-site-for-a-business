using JewelrySite.DAL;
using System.Runtime.CompilerServices;

namespace JewelrySite.BL
{
	public class JewelryItem
	{

		public int Id { get; set; }
		public required string Name { get; set; }
		public required string Description { get; set; }
		public required string Category { get; set; }
		public string? Collection { get; set; }
		public decimal? WeightGrams { get; set; }
		public string? Color { get; set; }
		public string? SizeCM { get; set; }
		public decimal? Price { get; set; }
		public int? StockQuantity { get; set; }
		public bool? IsAvailable { get; set; }
		public string? MainImageUrl { get; set; }
		public List<JewelryImage>? GalleryImages { get; set; } = new List<JewelryImage>();
		public string? VideoUrl { get; set; }
		public string? VideoPosterUrl { get; set; }
		public int? VideoDurationSeconds { get; set; }


		public JewelryItem(int id, string name, string description, string category, string? collection, decimal? weightGrams, string? color,
			string? sizeCM, decimal? price, int? stockQuantity, bool? isAvailable, string? mainImageUrl, List<JewelryImage>? galleryImage,
			string? videoUrl, string? videoPosterUrl, int? videoDurationSeconds)
		{

			Id = id;
			Name = name;
			Description = description;
			Category = category;
			Collection = collection;
			WeightGrams = weightGrams;
			Color = color;
			SizeCM = sizeCM;
			Price = price;
			StockQuantity = stockQuantity;
			IsAvailable = isAvailable;
			MainImageUrl = mainImageUrl;
			GalleryImages = galleryImage;
			VideoUrl = videoUrl;
			VideoPosterUrl = videoPosterUrl;
			VideoDurationSeconds = videoDurationSeconds;
		}

		public JewelryItem() { }

	}

}

