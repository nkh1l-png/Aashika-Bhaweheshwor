# Product Requirements Document (PRD)
## Aashika-Bhaweneshwor Stock Manager ("StockFlow")

**Document version:** 1.0
**Date:** 2026-06-24
**Status:** Reflects the current implemented build (as-built PRD)

---

## 1. Overview

### 1.1 What it is
**StockFlow** is a web-based warehouse stock-management and dispatch-tracking system built for **Aashika-Bhaweneshwor**, a beverage distribution business (beer, whisky, energy drinks, soft drinks, etc.). It runs as a small self-hosted web application that staff and administrators open in a browser.

### 1.2 The problem it solves
A beverage distributor constantly moves cases and loose pieces of stock in and out of a warehouse:
- Stock arrives from suppliers (**restock**).
- Stock goes out to shops/customers (**dispatch**).
- Stock is taken to a market and partly comes back (**daily retailing**).
- Damaged goods returned by parties must be replaced from fresh stock (**leakage/breakage**).

Doing this in a paper register or spreadsheet is error-prone, hard to audit, and gives no live picture of "what do we have right now" or "who did what." StockFlow centralizes all of this into one live inventory with a full activity history.

### 1.3 Core value
- **Single source of truth** for current stock (in cases + loose pieces).
- **Every movement is logged** with timestamp and the user who did it.
- **Role-based access** (Admin vs Staff) with an admin oversight panel.
- **Zero external dependencies for daily use** — runs locally, data stored in one file.

---

## 2. Target Users & Roles

| Role | Who | What they can do |
|------|-----|------------------|
| **Admin** | Owner / manager (e.g. `admin`) | Everything Staff can do **plus** the Admin Panel: manage users (add/remove/change password), view all-user activity log, export all data, reset all data. |
| **Staff** | Warehouse / sales employees (e.g. Aashika, Bhaweheshwor, Nishan) | Log in; view dashboard & inventory; record dispatch, restock, retailing (take out / return), and leakage/breakage; view history; export data. **Cannot** see the Admin Panel. |

Seeded default accounts (defined in `server.js`):

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin |
| aashika | aashika123 | Staff |
| bhaweheshwor | bhaweheshwor123 | Staff |
| nishan | nishan123 | Staff |

> ⚠️ These are default credentials and should be changed before real use.

---

## 3. Architecture

### 3.1 High-level
StockFlow is a **vanilla-stack, server-rendered-free single-page app** with a thin Node.js backend. No frameworks, no build step, no external database.

```
┌─────────────────────────────────────────────┐
│  Browser (client)                            │
│  ┌─────────────┐  ┌──────────────┐           │
│  │ index.html  │  │  style.css   │           │
│  └─────────────┘  └──────────────┘           │
│  ┌─────────────┐  ┌──────────────┐           │
│  │  data.js    │  │   app.js     │  ← all UI │
│  │ (catalog)   │  │ (logic/state)│   + logic │
│  └─────────────┘  └──────────────┘           │
│        │  fetch() JSON over HTTP  ▲          │
└────────┼──────────────────────────┼──────────┘
         ▼                          │
┌─────────────────────────────────────────────┐
│  Node.js server (server.js)                  │
│  • Static file server (html/css/js/images)   │
│  • REST-ish JSON API (/api/*)                │
│  • Reads/writes a single JSON file           │
└────────────────────┬─────────────────────────┘
                     ▼
              ┌──────────────┐
              │   db.json    │  ← users + stock + ledger
              └──────────────┘
```

### 3.2 Technology used
| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend markup | **HTML5** (`index.html`) | Single page; all views are `<section>`s toggled via CSS classes. |
| Styling | **Plain CSS** (`style.css`) | Custom dark "glassmorphism" theme using CSS variables; responsive with a mobile sidebar/hamburger. |
| Frontend logic | **Vanilla JavaScript (ES6+)** (`app.js`) | One IIFE module; no framework, no bundler. ~1900 lines. |
| Product data | **Static JS array** (`data.js`) | `PRODUCT_CATALOG`, auto-generated from an Excel sheet. |
| Backend | **Node.js core `http` module** (`server.js`) | No Express/framework — raw HTTP server. |
| Persistence | **Single JSON file** (`db.json`) | Holds users + full app state. Created automatically on first run. |
| Data generation | **`xlsx` npm package** (`generate_data.js`) | Dev-time script to regenerate `data.js` from the stock Excel file. The **only** npm dependency. |
| Fonts | Google Fonts (Inter) | Loaded via CDN. |

### 3.3 File structure
```
Aashika-Bhaweheshwor/
├── server.js          # Node HTTP server: static serving + API + db.json I/O
├── app.js             # All client logic: state, auth, rendering, events
├── data.js            # PRODUCT_CATALOG (generated from Excel)
├── generate_data.js   # Dev script: Excel → data.js (uses xlsx)
├── index.html         # Single-page UI (all views + login + modals)
├── style.css          # Theme & layout
├── package.json       # Metadata + xlsx dependency
├── db.json            # Runtime database (gitignored, auto-created)
├── *.png / *.jpg      # Product images (one per product)
└── Aashika_..._Stock Book.xlsx  # Source spreadsheet for the catalog
```

### 3.4 Data flow
1. On load, `app.js` checks `sessionStorage` for a logged-in user.
2. Login POSTs to `/api/login`; on success the user object is cached in `sessionStorage`.
3. App state (stock + transactions) is fetched from `/api/state`; if the server is unreachable, it falls back to `localStorage`.
4. Every action (dispatch/restock/etc.) updates the in-memory `state`, then calls `saveState()` which **POSTs the entire state** back to `/api/state` (and mirrors to `localStorage` as backup).
5. The server writes the whole object to `db.json`.

---

## 4. Data Models

### 4.1 Product (static, from `data.js`)
```js
{
  id: "prod_1",
  name: "Red Bull",
  volume: "250ml",
  piecesPerCase: 24,
  image: "Redbull 250ml.png",
  initialStockCases: 8,
  initialStockPieces: 13
}
```
The catalog is fixed in `data.js`. Products are **not** editable through the UI — they are regenerated from the Excel file via `generate_data.js`.

### 4.2 Stock (per product, in `state.stock`)
```js
state.stock["prod_1"] = { cases: 8, pieces: 13 }
```
Total pieces = `cases × piecesPerCase + pieces`. The app always re-normalizes loose pieces back into full cases after each operation.

### 4.3 Transaction / "dispatch" record (in `state.dispatches[]`)
Every movement — of any type — is stored in one array as an append-only ledger:
```js
{
  id: "txn_1718800000000_ab12cd",
  productId: "prod_1",
  cases: 2,
  pieces: 0,
  totalPieces: 48,
  notes: "Delivered to XYZ shop",
  timestamp: "2026-06-24T10:15:00.000Z",  // ISO / UTC
  type: "dispatch",                        // see types below
  user: "aashika"
}
```

**Transaction types:**
| Type | Effect on stock | Meaning |
|------|-----------------|---------|
| `dispatch` | − deduct | Sent out to a customer/shop |
| `restock` | + add | Received from supplier |
| `retail-takeout` | − deduct | Taken to market for the day |
| `retail-return` | + add | Unsold goods returned to inventory |
| `leakage` | − deduct | Damaged (leaked) goods replaced from fresh stock |
| `breakage` | − deduct | Damaged (broken) goods replaced from fresh stock |

### 4.4 User (in `db.json` → `users[]`)
```js
{ username: "admin", password: "admin123", role: "admin", displayName: "Admin" }
```

### 4.5 db.json shape
```js
{
  "users": [ ...user objects... ],
  "stock": { "prod_1": { "cases": 8, "pieces": 13 }, ... },
  "dispatches": [ ...transaction objects... ],
  "initialized": true
}
```

---

## 5. Functional Requirements (Features by View)

### 5.1 Login
- Username + password form; calls `/api/login`.
- On success, session is stored and the app loads.
- Session persists for the browser tab (`sessionStorage`) — closing the tab logs out.

### 5.2 Dashboard
- **Stat cards:** Total Products, Total Cases, Today's Dispatches, Low-Stock Alerts, Leakage/Breakage today (animated counters).
- **Product overview grid:** every product as a card with image, current stock, and a colored status badge (In Stock / Low Stock / Out of Stock).
- Filters by **brand** and **status**; global search box (searches name + volume).
- Clicking a card opens a **product detail modal** with stock breakdown, quick Dispatch/Restock buttons, and that product's last 5 transactions.

### 5.3 Inventory
- Full table: product, volume, pieces/case, cases, loose pieces, total pieces, status, and quick **Dispatch / Restock** action buttons per row.
- Sortable (name A–Z/Z–A, stock low→high/high→low) and brand-filterable.

### 5.4 Dispatch
- Form: choose product → live stock preview → enter cases/pieces + optional note → submit.
- Validates quantity > 0 and **not more than available**; deducts stock and logs a `dispatch` transaction.
- Right panel shows **today's dispatches** with a running total (items + product count).

### 5.5 Restock
- Same pattern, but **adds** stock and logs a `restock` transaction.
- Shows the 20 most recent restocks.

### 5.6 Daily Retailing (3-step workflow)
1. **Take Out** — deduct stock to take to market (`retail-takeout`).
2. **Return Unsold** — add returned goods back (`retail-return`).
3. **Daily Summary** — for a chosen date: total Taken, Returned, and **Sold (= taken − returned)**, plus a product-wise breakdown with sold/returned bars, and a recent-transactions list.

### 5.7 Leakage / Breakage
- Record damaged goods returned by a named **party**, choosing type (leakage/breakage).
- Deducts fresh replacement stock and logs the transaction with the party name baked into the note.
- Shows recent records and all-time leakage/breakage totals.

### 5.8 History
- Full transaction timeline, **grouped by date**, newest first.
- Filter by **date** and **product**; clear-filters button.
- Color-coded icons and +/− quantities per transaction type, with the acting user shown.

### 5.9 Admin Panel (Admin only)
- **Stats:** total users, total transactions, today's transactions.
- **User Activity grid:** per-user change counts.
- **User Management:** add user, remove user (cannot remove yourself or the last admin), change any user's password.
- **Activity Log:** all transactions filterable by user / type / date (up to 100 shown).
- **System Actions:** Export All Data (JSON), Reset All Data (restores initial stock & clears history — irreversible, confirmation required).

### 5.10 Cross-cutting
- **Export Data** (sidebar) — downloads a JSON snapshot of catalog + current stock + all transactions.
- **Toast notifications** for every action outcome.
- **Confirmation dialogs** for destructive actions.
- **Responsive** layout with collapsible sidebar for mobile.

---

## 6. API Reference (server.js)

| Method | Path | Purpose | Auth enforced on server? |
|--------|------|---------|--------------------------|
| POST | `/api/login` | Validate credentials, return user (no password) | n/a |
| GET | `/api/users` | List users (without passwords) | ❌ No |
| POST | `/api/users/add` | Add a user | ❌ No |
| POST | `/api/users/remove` | Remove a user (protects last admin) | ❌ No |
| POST | `/api/users/change-password` | Change a user's password (min 4 chars) | ❌ No |
| GET | `/api/state` | Get stock + transactions (users stripped out) | ❌ No |
| POST | `/api/state` | Overwrite stock + transactions (users preserved) | ❌ No |
| (any) | `/*` | Serve static files (html/css/js/images) | n/a |

> ⚠️ **Important:** role checks exist only in the browser. The server does **not** verify identity or role on any endpoint. See §8.

---

## 7. Non-Functional Requirements

- **Deployment:** single Node process, no build step. `npm install` then `node server.js` on port **3000**.
- **Persistence:** one `db.json` file on local disk; requires a host with a persistent filesystem (not serverless/ephemeral).
- **Performance:** in-memory state, instant client rendering; suitable for one warehouse / small team. The full ledger is loaded into memory and re-saved in full each write.
- **Browser support:** modern evergreen browsers (uses `fetch`, ES6, CSS variables).
- **Offline behavior:** if the server is unreachable, the client falls back to `localStorage` (per-device, not synced).
- **Footprint:** ~1 npm dependency (`xlsx`, dev-only); tiny disk/RAM needs.

---

## 8. Known Limitations & Risks (as-built)

These are documented honestly so future work can address them. (See the separate code-review for detail.)

1. **No server-side authentication/authorization** — all `/api/*` endpoints are open; anyone who can reach the server can read users, create an admin, change passwords, or overwrite all stock data. Safe on a private LAN; unsafe on the public internet without fixes.
2. **Whole-state overwrite → concurrent edits clobber each other** — two users acting at once can overwrite each other's transactions (data loss risk).
3. **Timezone mismatch** — timestamps are stored in UTC but "today" is computed in local time, so daily counts/filters are wrong for part of each day (notably in Nepal, UTC+5:45).
4. **Stored XSS** — free-text fields (notes, party, names) are inserted via `innerHTML` without escaping.
5. **Plaintext passwords** — stored in `db.json` and sent over plain HTTP.
6. **Negative-quantity validation gap** — a negative value in restock/return can subtract stock.
7. **No edit/undo of a transaction** — only full reset, which erases everything.
8. **No backups** — single file; corruption or accidental reset loses all data.
9. **Low-stock logic** uses only `cases < 3`, ignoring loose pieces.

---

## 9. Future Enhancements (Roadmap ideas)

- Real server-side auth with session tokens + hashed passwords + HTTPS.
- Append-only transaction API (per-transaction endpoints) to fix concurrency.
- Edit/correct/undo individual transactions.
- Automatic daily backups of `db.json`.
- Pricing per product → revenue/sales reporting; monthly summaries.
- Export to Excel/PDF for accounting.
- Low-stock reorder report (single screen of everything to restock).
- Editable product catalog from the UI (instead of regenerating from Excel).
- "Remember me" persistent login; per-user self-service password change.

---

## 10. Setup & Run (quick reference)

```bash
# 1. Install the one dependency
npm install

# 2. Start the server
node server.js

# 3. Open in a browser
http://localhost:3000

# Log in with a default account (e.g. admin / admin123)
```

To regenerate the product catalog after editing the Excel file:
```bash
node generate_data.js   # rewrites data.js from the .xlsx
```

---

*End of document.*
