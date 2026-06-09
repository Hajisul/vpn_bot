// src/config/env.js
// Loads and validates all environment variables at startup.

require("dotenv").config();

const required = [
  "BOT_TOKEN",
  "ADMIN_GROUP_ID",
  "SELLER_GROUP_ID",
  "BANK_CARD_NUMBER",
  "BANK_OWNER_NAME",
  "PRICE_1M",
  "PRICE_3M",
  "PRICE_6M",
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing required env variable: ${key}`);
    process.exit(1);
  }
}

module.exports = {
  BOT_TOKEN:        process.env.BOT_TOKEN,
  ADMIN_GROUP_ID:   String(process.env.ADMIN_GROUP_ID),
  SELLER_GROUP_ID:  String(process.env.SELLER_GROUP_ID),
  BANK_CARD:        process.env.BANK_CARD_NUMBER,
  BANK_OWNER:       process.env.BANK_OWNER_NAME,
  SUPPORT_USERNAME: process.env.SUPPORT_USERNAME || "",
  PRICE_1M:         Number(process.env.PRICE_1M),
  PRICE_3M:         Number(process.env.PRICE_3M),
  PRICE_6M:         Number(process.env.PRICE_6M),

  // Plan metadata (used across UI)
  PLANS: {
    "1m": {
      key: "1m",
      label: "۱ ماهه",
      duration: 30,
      emoji: "🔵",
      features: ["سرعت بالا", "پروتکل V2Ray/Xray", "پشتیبانی ۲۴/۷"],
    },
    "3m": {
      key: "3m",
      label: "۳ ماهه",
      duration: 90,
      emoji: "🟣",
      features: ["سرعت بالا", "پروتکل V2Ray/Xray", "پشتیبانی ۲۴/۷", "۱۵٪ تخفیف"],
      badge: "محبوب",
    },
    "6m": {
      key: "6m",
      label: "۶ ماهه",
      duration: 180,
      emoji: "💎",
      features: ["سرعت بالا", "پروتکل V2Ray/Xray", "پشتیبانی ۲۴/۷", "۲۵٪ تخفیف", "اولویت پشتیبانی"],
      badge: "بهترین ارزش",
    },
  },
};
