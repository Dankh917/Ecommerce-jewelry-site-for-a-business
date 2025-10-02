using JewelrySite.BL;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text.Json.Serialization;

namespace JewelrySite.DTO
{
        public class CreateOrderRequestDto
        {
                [Required, MaxLength(100)]
                public string FullName { get; set; } = string.Empty;

                [JsonPropertyName("phoneNumber")]
                [Required, MaxLength(30)]
                public string Phone { get; set; } = string.Empty;

                [Required, MaxLength(60)]
                public string Country { get; set; } = string.Empty;

                [Required, MaxLength(60)]
                public string City { get; set; } = string.Empty;

                [Required, MaxLength(120)]
                public string Street { get; set; } = string.Empty;

                [MaxLength(20)]
                public string? PostalCode { get; set; }

                [MaxLength(32)]
                public string? PaymentMethod { get; set; }

                [MaxLength(128)]
                public string? PaymentReference { get; set; }

                [JsonPropertyName("notes")]
                [MaxLength(500)]
                public string? PaymentNotes { get; set; }

                [MaxLength(3)]
                public string? CurrencyCode { get; set; }

                [Range(0, double.MaxValue)]
                public decimal? TaxAmount { get; set; }

                [Range(0, double.MaxValue)]
                public decimal? DiscountAmount { get; set; }
        }

        public class OrderConfirmationItemDto
        {
                public int JewelryItemId { get; set; }
                public string? Name { get; set; }
                public decimal UnitPrice { get; set; }
                public int Quantity { get; set; }
                public decimal LineTotal { get; set; }
        }

        public class OrderConfirmationDto
        {
                public int OrderId { get; set; }
                public DateTime CreatedAt { get; set; }
                public OrderStatus Status { get; set; }
                public decimal Subtotal { get; set; }
                public decimal Shipping { get; set; }
                public decimal TaxVat { get; set; }
                public decimal DiscountTotal { get; set; }
                public decimal GrandTotal { get; set; }
                public string CurrencyCode { get; set; } = "ILS";
                public IEnumerable<OrderConfirmationItemDto> Items { get; set; } = Enumerable.Empty<OrderConfirmationItemDto>();
        }
}
