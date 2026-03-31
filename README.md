# Vendor Purchase Order Widget

A Zoho CRM embedded widget that allows users to create **Purchase Orders in Zoho Books** directly from a Vendor record in CRM — without leaving the CRM interface.

## Features

- Create Purchase Orders from the Vendor detail page in Zoho CRM
- Searchable item selection from Zoho Books inventory
- Tax calculation with Zoho Books tax configurations
- Discount support (percentage or flat amount)
- Auto-generated PO numbers from Zoho Books
- PO is created in both **Zoho Books** and **Zoho CRM** simultaneously
- Draft and Send workflows with proper status sync
- Form validation and error handling
- Success confirmation modal with auto-reload

## Tech Stack

- **React 19** + **Vite 8**
- **shadcn/ui** (Base UI) for components
- **Tailwind CSS 4** for styling
- **Zoho CRM JS SDK** for widget integration
- **Zoho Books API v3** via CRM Connection

## Prerequisites

- Zoho CRM account with widget support
- Zoho Books account linked to CRM
- A CRM Connection named `zoho_book_conn_test` with access to Zoho Books
- Vendors in CRM must have a `Books_Contact_ID` field mapped to their Zoho Books vendor ID

## Setup

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Zoho CRM Widget Setup

1. Go to **Zoho CRM** > **Setup** > **Developer Hub** > **Widgets**
2. Create a new widget and set the hosting URL to your build output
3. Add a **button** on the **Vendors** module (detail page)
4. Set button type to **Widget** and link to the widget

For development, point the widget URL to your local dev server (e.g. `http://localhost:5173`).

## Configuration

Key configuration values are in `src/services/zohoService.js`:

| Config | Description |
|--------|-------------|
| `BOOKS_ORG_ID` | Your Zoho Books Organization ID |
| `CONNECTION_NAME` | CRM Connection name for Books API |

## How It Works

1. User clicks the PO button on a Vendor record in CRM
2. Widget loads and fetches vendor data, items, taxes, and next PO number in parallel
3. User fills the form — selects items, sets quantities, rates, tax, discount
4. On submit:
   - **Step 1:** Creates PO in Zoho Books (draft or open based on action)
   - **Step 2:** Creates PO in Zoho CRM and links it to the Vendor
5. Success modal appears, then widget closes and reloads the CRM page

## Project Structure

```
src/
  main.jsx                    # Zoho SDK init & React mount
  App.jsx                     # Main orchestrator, state management
  components/
    PurchaseOrderForm.jsx     # Form UI with validation
    ItemTable.jsx             # Line items table with searchable dropdown
    ui/                       # shadcn/ui components
  services/
    zohoService.js            # All Zoho Books & CRM API calls
  lib/
    utils.js                  # Utility functions
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
