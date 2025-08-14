namespace JewelrySite.BL
{
	public class User
	{
		public int Id { get; set; } // Primary Key
		public string Username { get; set; }
		public string PasswordHash { get; set; }
		public string Email { get; set; }
		public string Role { get; set; } = "Customer";// e.g. "Customer", "Admin"
		public DateTime CreatedAt { get; set; } = DateTime.Now;
		public DateTime? LastLogin { get; set; }
		public bool IsActive { get; set; } = true;
	}
}
 