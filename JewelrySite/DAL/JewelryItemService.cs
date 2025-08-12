using JewelrySite.BL;
using Microsoft.EntityFrameworkCore;

namespace JewelrySite.DAL
{
	public class JewelryItemService
	{
		private readonly JewerlyStoreDBContext _db;

		public JewelryItemService(JewerlyStoreDBContext db)
		{
			_db = db;
		}

		public async Task<List<JewelryItem>> GetAllJewelry()
		{
			return await _db.JewelryItems.ToListAsync();
		}
		
		public async Task<JewelryItem> GetJewelryById(int id)
		{
			return await _db.JewelryItems.FindAsync(id);
		}
		
		public async Task<JewelryItem> AddJewelry(JewelryItem jewelryItem)
		{
			_db.JewelryItems.Add(jewelryItem);
			await _db.SaveChangesAsync();
			return jewelryItem;
		}
	}
}
