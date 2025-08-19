using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace JewelrySite.BL
{
	public class OrderItem
	{
		public int Id { get; set; }

		[Required] public int OrderId { get; set; }
		[JsonIgnore] public Order? Order { get; set; }

		[Required] public int JewelryItemId { get; set; } // link back to product
		[MaxLength(160)] public string? NameSnapshot { get; set; }    // title at purchase

		[Required, Precision(18, 2)] public decimal UnitPrice { get; set; }
		[Required, Range(1, int.MaxValue)] public int Quantity { get; set; }
		[Required, Precision(18, 2)] public decimal LineTotal { get; set; } // UnitPrice * Quantity at checkout
	}
}

