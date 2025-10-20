namespace JewelrySite.BL
{
	public class Cart
	{
		public int Id { get; set; }
		public required int UserId {get; set;}
		public User User { get; set; }
		public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
		public ICollection<CartItem> Items { get; set; } = new List<CartItem>();
	}
}
