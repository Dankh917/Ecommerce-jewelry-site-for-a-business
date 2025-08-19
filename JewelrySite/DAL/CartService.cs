using JewelrySite.BL;
using Microsoft.EntityFrameworkCore;
using System;

namespace JewelrySite.DAL
{
	public class CartService
	{
		private readonly JewerlyStoreDBContext _db;

		public CartService(JewerlyStoreDBContext db)
		{
			_db = db;
		}

		public async Task<Cart> GetOrCreateCartByUserId(int userId)
		{
			var userExists = await _db.Users.AnyAsync(u => u.Id == userId);
			if (!userExists) {throw new InvalidOperationException($"User with id {userId} does not exist."); }
				


			Cart? cart = await _db.Carts
				.Include(c => c.Items)
				.ThenInclude(i => i.jewelryItem)
				.FirstOrDefaultAsync(c => c.UserId == userId);

			// If a cart already exists for the user, return it
			if (cart != null) { return cart; }

			// If no cart exists for the user, create a new one
			cart = new Cart
			{
				UserId = userId,
				CreatedAt = DateTime.UtcNow
			};

			_db.Carts.Add(cart);
			await _db.SaveChangesAsync();

			return cart;
		}

		public async Task<Cart> AddItemToCart(int userId, int jewelryItemId, int qty)
		{

			var userExists = await _db.Users.AnyAsync(u => u.Id == userId);
			if (!userExists) { throw new InvalidOperationException($"User with id {userId} does not exist."); }

			if (qty < 1)
			{
				throw new ArgumentOutOfRangeException("Quantity must be at least 1.", nameof(qty));
			}

			var cart = await GetOrCreateCartByUserId(userId);

			var existing = cart.Items
				.FirstOrDefault(ci => ci.jewelryItemId == jewelryItemId);

			if (existing == null)
			{
				var jewelryItem = await _db.JewelryItems.FirstOrDefaultAsync(j => j.Id == jewelryItemId);
				if (jewelryItem == null || jewelryItem.IsAvailable == false)
				{
					throw new InvalidOperationException("Jewelry item not found or not available.");
				}
				
				var itemToAdd = new CartItem
				{
					cartId = cart.Id,
					jewelryItemId = jewelryItemId,
					quantity = qty,
					priceAtAddTime = (decimal)jewelryItem.Price
				};

				_db.CartItems.Add(itemToAdd);
				
			}
			else
			{
				existing.quantity += qty;
			}

			await _db.SaveChangesAsync();

			return await _db.Carts
			.Include(c => c.Items)
			.ThenInclude(i => i.jewelryItem)
			.FirstAsync(c => c.Id == cart.Id);

		}

		public async Task<Cart> RemoveItemAsync(int userId, int jewelryItemId)
		{
			var userExists = await _db.Users.AnyAsync(u => u.Id == userId);
			if (!userExists) { throw new InvalidOperationException($"User with id {userId} does not exist."); }

			var cart = await _db.Carts
				.Include(c => c.Items)
				.FirstOrDefaultAsync(c => c.UserId == userId);

			if (cart == null) {throw new InvalidOperationException("Cart not found");}

			var item = cart.Items.FirstOrDefault(i => i.jewelryItemId == jewelryItemId);
			if (item == null) { throw new InvalidOperationException("Item not found in cart"); }

			_db.CartItems.Remove(item);
			await _db.SaveChangesAsync();

			return await _db.Carts
				.Include(c => c.Items)
				.ThenInclude(i => i.jewelryItem)
				.FirstAsync(c => c.Id == cart.Id);
		}
	}
}
