using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace JewelrySite.DTO
{
        public class PayPalCreateOrderRequestDto
        {
                [JsonPropertyName("cart")]
                public List<PayPalCartItemDto> Cart { get; set; } = new();
        }

        public class PayPalCartItemDto
        {
                [JsonPropertyName("id")]
                public string? Id { get; set; }

                [JsonPropertyName("quantity")]
                public string? Quantity { get; set; }
        }
}
