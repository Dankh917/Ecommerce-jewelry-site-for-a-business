using JewelrySite.BL;
using Microsoft.EntityFrameworkCore;

namespace JewelrySite.DAL
{
    public class JewerlyStoreDBContext(DbContextOptions<JewerlyStoreDBContext> options) : DbContext(options)
    {
        public DbSet<JewelryItem> JewelryItems => Set<JewelryItem>();
        public DbSet<JewelryImage> JewelryImages => Set<JewelryImage>();
        public DbSet<User> Users => Set<User>();
        public DbSet<CartItem> CartItems => Set<CartItem>();
        public DbSet<Cart> Carts => Set<Cart>();
        public DbSet<Order> Orders => Set<Order>();
        public DbSet<OrderItem> OrderItems => Set<OrderItem>();
        public DbSet<PasswordResetRequest> PasswordResetRequests => Set<PasswordResetRequest>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<User>()
                .HasIndex(u => u.PublicId)
                .IsUnique();
        }
    }
}
