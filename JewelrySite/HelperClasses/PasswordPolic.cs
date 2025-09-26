namespace JewelrySite.HelperClasses
{
	public static class PasswordPolicy
	{
		public static bool IsValid(string password)
		{
			if (string.IsNullOrWhiteSpace(password))
				return false;

			// Basic rules
			if (password.Length < 8) return false;          // minimum length
			if (!password.Any(char.IsDigit)) return false;  // at least one digit

			return true;
		}
	}
}
