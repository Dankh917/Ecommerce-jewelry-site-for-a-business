using System.ComponentModel.DataAnnotations.Schema;

namespace JewelrySite.BL
{
	
	public class JewelryImage
	{
		public int Id { get; set; }
		public int JewelryItemId { get; set; }           
		public string Url { get; set; } = default!;
		public int SortOrder { get; set; }               //myb rm
	}
}
