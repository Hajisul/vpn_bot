# 🛡️ VPN Store Bot v2 — Premium Telegram VPN Shop

A premium, fully Persian Telegram bot for selling VPN subscriptions. Designed to feel like a **mobile SaaS app** inside Telegram — inspired by MirzaBot, 3x-ui-shop, and rs8kvn_bot architecture.

---

## ✨ What's New in v2

| Feature | v1 | v2 |
|---|---|---|
| UI | Basic text messages | Premium dashboard-style panels |
| Plans | 2 plans | 3 plans (1M / 3M / 6M) |
| User Panel | None | Full panel with subscription status, QR code |
| State Machine | pending/approved/rejected/delivered | 5-state: PENDING_PAYMENT → WAITING_CONFIRMATION → PROCESSING → DELIVERED / REJECTED |
| Duplicate delivery | Not protected | Atomic DB lock prevents duplicates |
| 409 Conflicts | Possible | `deleteWebhook` on startup prevents it |
| Admin UI | Text commands only | Inline ✅/❌ buttons + text commands |
| QR Code | None | Auto-generated for config links |
| Subscriptions | Not tracked | Full subscription table with expiry |
| Code structure | Single file | Modular `/src` with `handlers/`, `services/`, `ui/`, `db/`, `config/` |

---

## 📁 Project Structure

```
vpnstore/
├── src/
│   ├── bot.js                 ← Main entry, routes all updates
│   ├── config/
│   │   ├── env.js             ← Env validation + plan metadata
│   │   └── logger.js          ← Colored console logger
│   ├── db/
│   │   └── database.js        ← SQLite schema + all queries
│   ├── handlers/
│   │   ├── userHandlers.js    ← Private chat: buy flow, panel
│   │   ├── adminHandlers.js   ← Admin group: approve/reject
│   │   └── sellerHandlers.js  ← Seller group: config delivery
│   ├── services/
│   │   ├── orderService.js    ← Order business logic
│   │   ├── qrService.js       ← QR code generation
│   │   └── session.js         ← In-memory UI state
│   └── ui/
│       ├── messages.js        ← All Persian text
│       └── keyboards.js       ← Inline keyboards
├── data/                      ← SQLite DB (auto-created)
├── package.json
├── .env.example
└── README.md
```

---

## 🔄 Order State Machine

```
                    ┌─────────────────┐
   User selects     │  PENDING_PAYMENT │
   plan & confirms  └────────┬────────┘
                             │ User sends receipt
                    ┌────────▼────────┐
                    │WAITING_CONFIRM  │ ◄── Bot notifies admin group
                    └────────┬────────┘
                  ┌──────────┴──────────┐
          Admin   │                     │ Admin
          /approve│                     │ /reject
                  ▼                     ▼
        ┌──────────────┐     ┌──────────────────┐
        │  PROCESSING  │     │    REJECTED       │
        └──────┬───────┘     └──────────────────┘
               │ Bot notifies seller group
               │ Seller replies with config
               ▼
        ┌──────────────┐
        │  DELIVERED   │  ◄── Config sent to user, subscription created
        └──────────────┘
```

---

## 🎨 UI Flow (User Experience)

```
/start
  └─▶ 🏠 HOME DASHBOARD
        ├── Active subscription status (progress bar)
        ├── [🛒 فروشگاه VPN]
        ├── [👤 پنل کاربری]
        └── [📞 پشتیبانی]

[فروشگاه VPN]
  └─▶ 🛒 SHOP PAGE
        ├── 🔵 ۱ ماهه · 150,000 تومان
        ├── 🟣 ۳ ماهه · 390,000 تومان  【محبوب】
        └── 💎 ۶ ماهه · 700,000 تومان  【بهترین ارزش】

[Select Plan]
  └─▶ 💳 PAYMENT INSTRUCTIONS
        ├── Card number
        ├── Amount
        ├── Order ID
        └── [✅ پرداخت کردم — ارسال رسید]

[Confirm]
  └─▶ 📸 RECEIPT UPLOAD (awaits photo/text)
        └── [❌ لغو سفارش]

[Receipt received]
  └─▶ ✅ WAITING CONFIRMATION screen
        └── ...admin reviews...
              ├── Approved → ⏳ PROCESSING
              └── Rejected → ❌ with reason

[Approved → Seller delivers config]
  └─▶ 🎊 CONFIG DELIVERED
        ├── Config link (copyable)
        ├── QR code available in panel
        └── Expiry date

[پنل کاربری]
  └─▶ 👤 USER PANEL
        ├── Subscription status + progress bar
        ├── [📥 دریافت مجدد کانفیگ]
        ├── [📲 QR کد اتصال]
        ├── [🔄 تمدید اشتراک]
        └── [📋 وضعیت سفارش‌ها]
```

---

## ⚙️ Environment Variables

| Variable | Description | Example |
|---|---|---|
| `BOT_TOKEN` | From @BotFather | `123456:ABC...` |
| `ADMIN_GROUP_ID` | Admin group ID (negative) | `-1001234567890` |
| `SELLER_GROUP_ID` | Seller group ID (negative) | `-1009876543210` |
| `BANK_CARD_NUMBER` | Card shown to users | `6037-9975-1234-5678` |
| `BANK_OWNER_NAME` | Card owner name | `علی محمدی` |
| `PRICE_1M` | 1-month price (Tomans) | `150000` |
| `PRICE_3M` | 3-month price (Tomans) | `390000` |
| `PRICE_6M` | 6-month price (Tomans) | `700000` |
| `SUPPORT_USERNAME` | Support Telegram username (no @) | `YourUsername` |

---

## 🚀 Railway Deployment

### Step 1 — Prepare Bot & Groups

1. `@BotFather` → `/newbot` → copy token
2. Create **Admin Group** and **Seller Group** in Telegram
3. Add your bot to both groups as **admin** (needs "Send Messages" permission)
4. Get group IDs: Add `@userinfobot` to each group → it shows the chat ID

### Step 2 — Push to GitHub

```bash
git init
git add .
git commit -m "VPN Store Bot v2"
git remote add origin https://github.com/YOUR_USERNAME/vpn-store-bot
git push -u origin main
```

### Step 3 — Deploy on Railway

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
2. Select your repo
3. Go to **Variables** tab → add all env variables from the table above
4. Railway auto-detects Node.js and runs `npm start`

### Step 4 — Verify

```
/start → should see Persian welcome dashboard
```

### Important: Persistent Storage on Railway

Railway's free plan uses ephemeral storage. For the SQLite DB to survive redeploys:
- Add a **Volume** in Railway: Settings → Volumes → Mount at `/app/data`
- Or upgrade to Railway's Hobby plan for persistent disk

---

## 🛠️ Admin Commands (inside Admin Group)

| Command | Effect |
|---|---|
| `/approve #1001` | Approve order, notify user, request config from seller |
| `/reject #1001 دلیل` | Reject with optional reason, notify user |
| `/pending` | List all orders waiting for review |
| `/stats` | Show revenue and order statistics |
| Inline ✅ button | Same as `/approve` |
| Inline ❌ button | Same as `/reject` |

---

## 📡 Seller Instructions

1. Watch the **Seller Group** for config request messages
2. **Reply directly** to the bot's request message with the VPN link
3. Supported formats: `vmess://`, `vless://`, `trojan://`, `ss://`
4. The bot automatically delivers to the correct user and prevents duplicate sends

---

## 🗄️ Database Tables

**users** — Telegram user registry  
**orders** — Full order lifecycle with status, receipt, config  
**subscriptions** — Active subscription records with expiry dates  

---

## 🔒 Security

- All secrets in `.env` (never committed)
- Admin commands only work in the designated admin group
- Seller config detection only works via reply to bot messages
- Atomic DB lock prevents duplicate config delivery
- `deleteWebhook` on startup prevents Telegram 409 conflicts

---

## 📦 Local Dev

```bash
npm install
cp .env.example .env
# fill in .env
npm start
# or
npm run dev   # auto-restart on file change
```
