# PayPal configuration

The application requires valid PayPal credentials to prepare and finalize checkout sessions.  
The backend now loads its settings from the standard `PayPal` section in `appsettings*.json` **or** from environment variables.

## Supported environment variables

| Variable | Purpose |
| --- | --- |
| `PAYPAL_CLIENT_ID` | PayPal REST client id |
| `PAYPAL_SECRET` | PayPal REST client secret |
| `PAYPAL_BASE_URL` | Base REST API URL, e.g. `https://api-m.sandbox.paypal.com` |
| `PAYPAL_RETURN_URL` | URL customers are redirected to after approving payment |
| `PAYPAL_CANCEL_URL` | URL customers are redirected to when they cancel payment |
| `APP_BASE_URL` | (Optional) Used to automatically populate the return and cancel URLs when they are not provided |

If both configuration files and environment variables provide a value, the configuration file wins.  
Unset values fall back to the environment variable, and the return/cancel URLs can be derived from
`APP_BASE_URL` (for example `https://localhost:51600`).

Configure these variables in your hosting environment to ensure "PayPal checkout is available" during checkout.
