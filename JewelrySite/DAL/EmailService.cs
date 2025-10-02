using System;
using JewelrySite.BL;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using MimeKit;
using System.Globalization;
using System.Net;
using System.Net.Mail;
using System.Text;
using System.Threading.Tasks;

public static class EmailService
{
	private static string Email;
	private static string AppPassword;

	public static void Init(IConfiguration config)
	{
		Email = config["Gmail:Email"];
		AppPassword = config["Gmail:Password"];
	}

        public static async Task SendAsync(string to, string subject, string htmlBody)
        {
                try
                {
                        var message = new MimeMessage();
			message.From.Add(new MailboxAddress("EDTArt", Email));
			message.To.Add(MailboxAddress.Parse(to));
			message.Subject = subject;

			var bodyBuilder = new BodyBuilder { HtmlBody = htmlBody };
			message.Body = bodyBuilder.ToMessageBody();

			using var client = new MailKit.Net.Smtp.SmtpClient();
			await client.ConnectAsync("smtp.gmail.com", 587, SecureSocketOptions.StartTls);
			await client.AuthenticateAsync(Email, AppPassword);
			await client.SendAsync(message);
			await client.DisconnectAsync(true);
		}
		catch (Exception ex)
		{
			
			throw new InvalidOperationException("Failed to send email.", ex);
                }
        }

        public static Task SendCheckoutNoticeAsync(string to, Order order)
        {
                if (order is null)
                {
                        throw new ArgumentNullException(nameof(order));
                }

                if (string.IsNullOrWhiteSpace(to))
                {
                        throw new ArgumentException("Recipient email address is required.", nameof(to));
                }

                var currencyCode = string.IsNullOrWhiteSpace(order.CurrencyCode) ? "USD" : order.CurrencyCode.Trim();
                string FormatAmount(decimal amount) => string.Format(CultureInfo.InvariantCulture, "{0} {1:N2}", currencyCode, amount);

                var builder = new StringBuilder();
                builder.Append("<div style=\"font-family:Arial,sans-serif;font-size:14px;color:#333;\">");
                builder.AppendFormat(
                        CultureInfo.InvariantCulture,
                        "<p>Hi {0},</p>",
                        WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(order.FullName) ? "there" : order.FullName));
                builder.Append("<p>Thank you for your purchase! We've received your order and the details are below.</p>");

                builder.Append("<h3 style=\"margin-top:24px;margin-bottom:8px;\">Order summary</h3>");
                builder.Append("<table style=\"width:100%;border-collapse:collapse;\"><thead><tr>" +
                        "<th align=\"left\" style=\"padding:8px;border-bottom:1px solid #ddd;\">Item</th>" +
                        "<th align=\"right\" style=\"padding:8px;border-bottom:1px solid #ddd;\">Qty</th>" +
                        "<th align=\"right\" style=\"padding:8px;border-bottom:1px solid #ddd;\">Total</th>" +
                        "</tr></thead><tbody>");

                foreach (var item in order.Items)
                {
                        var name = WebUtility.HtmlEncode(item.NameSnapshot ?? $"Item #{item.JewelryItemId}");
                        builder.AppendFormat(
                                CultureInfo.InvariantCulture,
                                "<tr><td style=\"padding:8px;border-bottom:1px solid #eee;\">{0}</td><td align=\"right\" style=\"padding:8px;border-bottom:1px solid #eee;\">{1}</td><td align=\"right\" style=\"padding:8px;border-bottom:1px solid #eee;\">{2}</td></tr>",
                                name,
                                item.Quantity,
                                FormatAmount(item.LineTotal));
                }

                builder.Append("</tbody></table>");

                builder.Append("<table style=\"width:100%;margin-top:16px;border-collapse:collapse;\"><tbody>");
                builder.AppendFormat(
                        CultureInfo.InvariantCulture,
                        "<tr><td style=\"padding:6px 8px;\">Subtotal</td><td align=\"right\" style=\"padding:6px 8px;\">{0}</td></tr>",
                        FormatAmount(order.Subtotal));

                if (order.Shipping > 0)
                {
                        builder.AppendFormat(
                                CultureInfo.InvariantCulture,
                                "<tr><td style=\"padding:6px 8px;\">Shipping</td><td align=\"right\" style=\"padding:6px 8px;\">{0}</td></tr>",
                                FormatAmount(order.Shipping));
                }
                else
                {
                        builder.Append("<tr><td style=\"padding:6px 8px;\">Shipping</td><td align=\"right\" style=\"padding:6px 8px;\">Free</td></tr>");
                }

                if (order.TaxVat > 0)
                {
                        builder.AppendFormat(
                                CultureInfo.InvariantCulture,
                                "<tr><td style=\"padding:6px 8px;\">Tax / VAT</td><td align=\"right\" style=\"padding:6px 8px;\">{0}</td></tr>",
                                FormatAmount(order.TaxVat));
                }

                if (order.DiscountTotal > 0)
                {
                        builder.AppendFormat(
                                CultureInfo.InvariantCulture,
                                "<tr><td style=\"padding:6px 8px;\">Discount</td><td align=\"right\" style=\"padding:6px 8px;\">-{0}</td></tr>",
                                FormatAmount(order.DiscountTotal));
                }

                builder.AppendFormat(
                        CultureInfo.InvariantCulture,
                        "<tr><td style=\"padding:6px 8px;border-top:1px solid #ddd;font-weight:bold;\">Grand total</td><td align=\"right\" style=\"padding:6px 8px;border-top:1px solid #ddd;font-weight:bold;\">{0}</td></tr>",
                        FormatAmount(order.GrandTotal));
                builder.Append("</tbody></table>");

                builder.Append("<h3 style=\"margin-top:24px;margin-bottom:8px;\">Shipping details</h3>");
                builder.Append("<p style=\"margin:0 0 8px 0;\">");
                builder.AppendFormat(
                        CultureInfo.InvariantCulture,
                        "{0}<br/>{1}<br/>{2}, {3} {4}</p>",
                        WebUtility.HtmlEncode(order.FullName ?? string.Empty),
                        WebUtility.HtmlEncode(order.Street ?? string.Empty),
                        WebUtility.HtmlEncode(order.City ?? string.Empty),
                        WebUtility.HtmlEncode(order.Country ?? string.Empty),
                        WebUtility.HtmlEncode(order.PostalCode ?? string.Empty));

                if (!string.IsNullOrWhiteSpace(order.Phone))
                {
                        builder.AppendFormat(
                                CultureInfo.InvariantCulture,
                                "<p style=\"margin:0 0 8px 0;\"><strong>Phone:</strong> {0}</p>",
                                WebUtility.HtmlEncode(order.Phone));
                }

                if (!string.IsNullOrWhiteSpace(order.Notes))
                {
                        builder.AppendFormat(
                                CultureInfo.InvariantCulture,
                                "<p style=\"margin:0 0 8px 0;\"><strong>Notes:</strong> {0}</p>",
                                WebUtility.HtmlEncode(order.Notes));
                }

                builder.Append("<p style=\"margin-top:24px;\">If you have any questions, reply to this email and we'll be happy to help.</p>");
                builder.Append("<p style=\"margin-top:16px;\">Warm regards,<br/>EDTArt Team</p>");
                builder.Append("</div>");

                var subject = string.Format(CultureInfo.InvariantCulture, "Order confirmation #{0}", order.Id);
                return SendAsync(to, subject, builder.ToString());
        }
}
