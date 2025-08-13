using JewelrySite.BL;
using Microsoft.EntityFrameworkCore;
using System.Text;

namespace JewelrySite.DAL
{
	public class JewelryItemService
	{
		private readonly JewerlyStoreDBContext _db;

		public JewelryItemService(JewerlyStoreDBContext db)
		{
			_db = db;
		}

		public async Task<List<JewelryItem>> GetAllJewelryItems()
		{
			return await _db.JewelryItems
				.AsNoTracking()
				.Include(j=>j.GalleryImages)
				.ToListAsync();
		}
		
		public async Task<JewelryItem> GetJewelryItemById(int id)
		{
			return await _db.JewelryItems
			.AsNoTracking()                       
			.Include(j => j.GalleryImages)       
			.FirstOrDefaultAsync(j => j.Id == id);
		}
		
		public async Task<JewelryItem> AddJewelryItem(JewelryItem jewelryItem)
		{
			_db.JewelryItems.Add(jewelryItem);
			await _db.SaveChangesAsync();
			return jewelryItem;
		}

		public async Task<JewelryItem> UpdateJewelryItem(int id, JewelryItem incomingJewelryItem)
		{
			// Load the item + its current images
			JewelryItem item = await _db.JewelryItems
				.Include(j => j.GalleryImages)
				.FirstOrDefaultAsync(j => j.Id == id);

			if (item is null) return null;

			// 1) Overwrite scalar fields (keep Id)
			item.Name = incomingJewelryItem.Name;
			item.Description = incomingJewelryItem.Description;
			item.Category = incomingJewelryItem.Category;
			item.Collection = incomingJewelryItem.Collection;
			item.WeightGrams = incomingJewelryItem.WeightGrams;
			item.Color =incomingJewelryItem.Color;
			item.Price = incomingJewelryItem.Price;
			item.StockQuantity = incomingJewelryItem.StockQuantity;
			item.IsAvailable = incomingJewelryItem.IsAvailable;
			item.MainImageUrl = incomingJewelryItem.MainImageUrl;
			item.VideoUrl = incomingJewelryItem.VideoUrl;
			item.VideoPosterUrl = incomingJewelryItem.VideoPosterUrl;
			item.VideoDurationSeconds = incomingJewelryItem.VideoDurationSeconds;

			// 2) Delete ALL existing images
			_db.JewelryImages.RemoveRange(item.GalleryImages);
			item.GalleryImages.Clear();

			// 3) Add the new images from request
			foreach (JewelryImage g in incomingJewelryItem.GalleryImages ?? Enumerable.Empty<JewelryImage>())
			{
				item.GalleryImages.Add(new JewelryImage
				{
					Url = g.Url,
					SortOrder = g.SortOrder
					// JewelryItemId set automatically
				});
			}

			await _db.SaveChangesAsync(); // one transaction
			return item;

		}

		public async Task<JewelryItem>? DeleteJewelryItem(int id)
		{
			JewelryItem item = await _db.JewelryItems.FindAsync(id);
			if (item == null) { return null; }

			_db.JewelryItems.Remove(item);
			await _db.SaveChangesAsync();

			return item;
		}
	}
}
