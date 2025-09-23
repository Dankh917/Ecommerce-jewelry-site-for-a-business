using JewelrySite.BL;
using JewelrySite.DAL;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace JewelrySite.Controllers
{
	[Route("api/[controller]")]
	[ApiController]
        [Authorize(Roles = "Customer,Admin")]
	public class CartController : ControllerBase
	{

		private readonly CartService _cartService;

		public CartController(CartService cartService)
		{
			_cartService = cartService;
		}

		[HttpGet]
		public async Task<ActionResult<Cart>> GetCartItems(int id)
		{
			try
			{
				Cart cart = await _cartService.GetOrCreateCartByUserId(id);
				return cart;
			}
			catch (InvalidOperationException)
			{
				return NotFound("no such user exists");
			}
		
		}

		[HttpPost]
		public async Task<ActionResult<Cart>> AddItemToCart(int userId, int jewelryItemId, int qty)
		{
			try
			{
				Cart cart = await _cartService.AddItemToCart(userId, jewelryItemId, qty);
				return CreatedAtAction(nameof(AddItemToCart),cart.Items.Where(i=> i.Id == jewelryItemId));
			}
			catch (ArgumentOutOfRangeException)
			{
				return BadRequest("quantity of an item cannot be a negetive value");
			}
			catch (InvalidOperationException)
			{
				return BadRequest("no such user or jewlry item exists");
			}
		}

		[HttpDelete]
		public async Task<ActionResult<Cart>> RemoveItemFromCart(int userId, int jewelryItemId)
		{
			try
			{
				Cart cart = await _cartService.RemoveItemAsync(userId, jewelryItemId);
				return Ok("resource deleted successfully");
			}
			catch (InvalidOperationException)
			{
				return BadRequest("no such user or jewlry item exists");
			}
		}

	}
}
