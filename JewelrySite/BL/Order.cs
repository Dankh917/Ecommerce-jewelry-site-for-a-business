using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace JewelrySite.BL
{
	public enum OrderStatus
	{
		Pending = 0,
		Paid = 1,
		Cancelled = 2,
		Fulfilled = 3
	}

	public class Order
	{
		public int Id { get; set; }

		// who bought
		[Required]
		public int UserId { get; set; }
		[JsonIgnore] public User? User { get; set; }

		// lifecycle
		[Required] public OrderStatus Status { get; set; } = OrderStatus.Pending;
		[Required] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
		public DateTime? PaidAt { get; set; }

		// money
		[Required, Precision(18, 2)] public decimal Subtotal { get; set; }
		[Required, Precision(18, 2)] public decimal Shipping { get; set; }
		[Required, Precision(18, 2)] public decimal TaxVat { get; set; }
		[Required, Precision(18, 2)] public decimal DiscountTotal { get; set; }
		[Required, Precision(18, 2)] public decimal GrandTotal { get; set; }

		// currency / payment (MVP inline)
                [Required, MaxLength(3)] public string CurrencyCode { get; set; } = "USD";
		[MaxLength(32)] public string? PaymentProvider { get; set; } // e.g. "Manual", "Stripe"
		[MaxLength(128)] public string? PaymentRef { get; set; }     // provider intent/id

		
		[Required, MaxLength(100)] public string FullName { get; set; } = "";
		[Required, MaxLength(30)] public string Phone { get; set; } = "";
		[Required, MaxLength(60)] public string Country { get; set; } = "";
		[Required, MaxLength(60)] public string City { get; set; } = "";
		[Required, MaxLength(120)] public string Street { get; set; } = "";
		[MaxLength(20)] public string? PostalCode { get; set; }

		[MaxLength(500)]
		public string? Notes { get; set; }

		public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
	}

	
}
