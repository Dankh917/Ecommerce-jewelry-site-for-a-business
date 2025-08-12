using JewelrySite.BL;
using Microsoft.EntityFrameworkCore;

namespace JewelrySite.DAL
{
	public class JewerlyStoreDBContext(DbContextOptions<JewerlyStoreDBContext> options) : DbContext(options)
	{
		public DbSet<JewelryItem> JewelryItems => Set<JewelryItem>();
		public DbSet<JewelryImage> JewelryImages => Set<JewelryImage>();
	}
}
