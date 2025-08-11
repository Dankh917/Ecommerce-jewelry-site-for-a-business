using System.Runtime.CompilerServices;

namespace JewelrySite.BL
{
	public class JewelryItem
	{
		
		public int Id { get; set; }// myb rm
		public required string Name { get; set; }
		public required string Description { get; set; }
		public  required string Category { get; set; }
		public string? Collection { get; set; }
		public decimal? WeightGrams { get; set; }
		public string? Color { get; set; }
		public string? SizeCM { get; set; }
		public decimal? Price { get; set; }
		public int? StockQuantity { get; set; }
		public bool? IsAvailable { get; set; }
		public string? MainImageUrl { get; set; } 
		public List<string>? GalleryImageUrls { get; set; } = new List<string>();
		public string? VideoUrl { get; set; }              
		public string? VideoPosterUrl { get; set; }        
		public int? VideoDurationSeconds { get; set; }

		private static List<JewelryItem> items = new List<JewelryItem>{
				new JewelryItem { Id=1,Name ="d",Description ="Description", Category="ring" },
				new JewelryItem { Id=2,Name ="f",Description ="Description2", Category="necklece" }

		};
		
		public JewelryItem(int id, string name, string description, string category, string? collection, decimal? weightGrams, string? color,
			string? sizeCM, decimal? price, int? stockQuantity, bool? isAvailable, string? mainImageUrl, List<string>? galleryImageUrls,
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
			GalleryImageUrls = galleryImageUrls;
			VideoUrl = videoUrl;
			VideoPosterUrl = videoPosterUrl;
			VideoDurationSeconds = videoDurationSeconds;
		}

		public JewelryItem() { }

		public static List<JewelryItem> GetJewelryItems()
		{
			return items;
		}
		
		public static JewelryItem GetJewelryItemById(int id)
		{
			return items.Find(i => i.Id == id);
		}

		public static JewelryItem AddJewelryItem(JewelryItem j)
		{
			items.Add(j);
			return j;
		}

		public static JewelryItem? UpdateJewelryItem(int id, JewelryItem updatedJewelry)
		{
			JewelryItem existing = items.Find(x => x.Id == id);

			if (existing == null) { return null; }

			existing.Name = updatedJewelry.Name;
			existing.Description = updatedJewelry.Description;
			existing.Category = updatedJewelry.Category;
			existing.Collection = updatedJewelry.Collection;
			existing.WeightGrams = updatedJewelry.WeightGrams;
			existing.Color = updatedJewelry.Color;
			existing.SizeCM = updatedJewelry.SizeCM;
			existing.Price = updatedJewelry.Price;
			existing.StockQuantity = updatedJewelry.StockQuantity;
			existing.IsAvailable = updatedJewelry.IsAvailable;
			existing.MainImageUrl = updatedJewelry.MainImageUrl;
			existing.GalleryImageUrls = updatedJewelry.GalleryImageUrls ?? new List<string>();
			existing.VideoUrl = updatedJewelry.VideoUrl;
			existing.VideoPosterUrl = updatedJewelry.VideoPosterUrl;
			existing.VideoDurationSeconds = updatedJewelry.VideoDurationSeconds;

			return existing;
		}
		
		public static bool DeleteJewelryItem(int id)
		{
			JewelryItem jToDel = items.Find(x => x.Id == id);
			if (jToDel != null) {return(items.Remove(jToDel));}
			else return false;
		}

	}

}

