using JewelrySite.BL;
using JewelrySite.DAL;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

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

                private bool TryResolveAuthorizedUserId(int? requestedUserId, out int userId, out ActionResult? errorResult)
                {
                        errorResult = null;
                        userId = 0;

                        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
                        if (!int.TryParse(userIdClaim, out int authenticatedUserId))
                        {
                                errorResult = Unauthorized();
                                return false;
                        }

                        bool isAdmin = User.IsInRole("Admin");

                        if (requestedUserId.HasValue)
                        {
                                if (!isAdmin && requestedUserId.Value != authenticatedUserId)
                                {
                                        errorResult = Forbid();
                                        return false;
                                }

                                userId = requestedUserId.Value;
                                return true;
                        }

                        userId = authenticatedUserId;
                        return true;
                }

                [HttpGet]
                public async Task<ActionResult<Cart>> GetCartItems(int? id)
                {
                        if (!TryResolveAuthorizedUserId(id, out int userId, out ActionResult? error))
                        {
                                return error!;
                        }

                        try
                        {
                                Cart cart = await _cartService.GetOrCreateCartByUserId(userId);
                                return cart;
                        }
                        catch (InvalidOperationException)
                        {
                                return NotFound("no such user exists");
                        }

                }

                [HttpPost]
                public async Task<ActionResult<Cart>> AddItemToCart(int? userId, int jewelryItemId, int qty)
                {
                        if (!TryResolveAuthorizedUserId(userId, out int resolvedUserId, out ActionResult? error))
                        {
                                return error!;
                        }

                        try
                        {
                                Cart cart = await _cartService.AddItemToCart(resolvedUserId, jewelryItemId, qty);
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
                public async Task<ActionResult<Cart>> RemoveItemFromCart(int? userId, int jewelryItemId)
                {
                        if (!TryResolveAuthorizedUserId(userId, out int resolvedUserId, out ActionResult? error))
                        {
                                return error!;
                        }

                        try
                        {
                                Cart cart = await _cartService.RemoveItemAsync(resolvedUserId, jewelryItemId);
                                return Ok("resource deleted successfully");
                        }
                        catch (InvalidOperationException)
                        {
                                return BadRequest("no such user or jewlry item exists");
			}
		}

	}
}
