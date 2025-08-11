namespace JewelrySite.BL
{
	public class JewelryImage
	{
		public int Id { get; set; }
		public int JewelryItemId { get; set; }           // FK
		public string Url { get; set; } = default!;
		public int SortOrder { get; set; }               // 0,1,2… for gallery order
	}
}
