using System.ComponentModel.DataAnnotations;

namespace JewelrySite.BL
{
	public class CartItem
	{
	    public  int Id { get; set; }
		public required int cartId { get; set; }
		public  Cart cart { get; set; }
		public required int jewelryItemId { get; set; }
		public JewelryItem jewelryItem { get; set; } //not a col in db but a van property
		
		[Range(1, int.MaxValue, ErrorMessage = "Quantity must be at least 1.")]
		public required int quantity { get; set; } = 1; //default to 1	
		
		[Range(0.01, double.MaxValue, ErrorMessage = "Price must be greater than 0.")]
		public required decimal priceAtAddTime { get; set; }
	}
}
