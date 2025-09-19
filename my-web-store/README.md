# My Web Store

This is a simple virtual store project that allows users to browse and purchase products online.

## Project Structure

```
my-web-store
├── src
│   ├── index.html        # Main HTML document for the web store
│   ├── app.js           # Main JavaScript file for application logic
│   ├── styles
│   │   └── main.css     # Styles for the web store
│   └── components
│       └── product-list.js # Component for displaying product list
├── package.json         # Configuration file for npm
└── README.md            # Documentation for the project
```

## Features

- User-friendly interface for browsing products
- Responsive design for mobile and desktop
- Dynamic product listing
- Simple and clean layout

## Setup Instructions

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

2. Navigate to the project directory:
   ```
   cd my-web-store
   ```

3. Install dependencies:
   ```
   npm install
   ```

4. Start the server (serves the frontend from `src/` and exposes API routes under `/api`):
   ```
   npm start
   ```

5. Open http://localhost:3000 in your browser.

## Usage

- Browse through the product list displayed on the main page.
- Click on products for more details (if implemented).
- Add products to the cart and proceed to checkout (if implemented).

## Payments — Wompi Checkout

This project includes a basic integration with Wompi's Widget Checkout.

What it does:
- Calculates the order total in the frontend.
- Requests an integrity signature from the backend (`/api/wompi/signature`).
- Opens the Wompi Widget with your Public Key, amount, reference, and redirect URL.
- After payment, Wompi redirects back to `checkout.html` and we show a basic status message from URL params.

Environment variables needed:
- `WOMPI_PUBLIC_KEY` — Your Wompi public key (test or production)
- `WOMPI_INTEGRITY_SECRET` — Integrity secret provided by Wompi (test or production)
- Optional: `PORT` — defaults to 3000

How to run locally (PowerShell):

```powershell
cd "C:\Users\oscaro\KX Web\kxweb\my-web-store"
npm install
$env:WOMPI_PUBLIC_KEY="pub_test_xxx"
$env:WOMPI_INTEGRITY_SECRET="test_integrity_xxx"
npm start
```

Then visit: http://localhost:3000/checkout.html

Notes:
- Make sure your Wompi dashboard allows the redirect URL you will use in development (e.g., http://localhost:3000/checkout.html).
- Amount is sent in cents and rounded to the nearest integer.
- The minimal post-payment status display uses URL parameters. For a robust confirmation, implement a server-side verification using Wompi's Transactions API (next step).

## Optional: PayU stub

There's a placeholder endpoint for PayU (`/api/create-payu-order`). To use it in dev without integrating PayU yet, leave `PAYU_ENABLED` unset and it will return a mock redirect URL.

## Contributing

Feel free to submit issues or pull requests for improvements or bug fixes.