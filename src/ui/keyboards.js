// src/ui/keyboards.js
// All Telegraf inline & reply keyboard layouts.

const { Markup } = require("telegraf");
const { PRICE_1M, PRICE_3M, PRICE_6M } = require("../config/env");
const { money } = require("./messages");

// ── HOME ──────────────────────────────────────────────────────────────────────
const homeKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback("🛒  فروشگاه VPN",   "menu:shop")],
  [Markup.button.callback("👤  پنل کاربری",     "menu:panel")],
  [Markup.button.callback("📞  پشتیبانی",       "menu:support")],
]);

// ── SHOP ─────────────────────────────────────────────────────────────────────
const shopKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback(`🔵  ۱ ماهه  ·  ${money(PRICE_1M)}`,  "buy:1m")],
  [Markup.button.callback(`🟣  ۳ ماهه  ·  ${money(PRICE_3M)}`,  "buy:3m")],
  [Markup.button.callback(`💎  ۶ ماهه  ·  ${money(PRICE_6M)}`,  "buy:6m")],
  [Markup.button.callback("🏠  بازگشت",                          "menu:home")],
]);

// ── CONFIRM ORDER ─────────────────────────────────────────────────────────────
function confirmOrderKeyboard(orderId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("✅  پرداخت کردم — ارسال رسید", `confirm:${orderId}`)],
    [Markup.button.callback("❌  انصراف",                    `cancel:${orderId}`)],
  ]);
}

// ── CANCEL WHILE AWAITING RECEIPT ─────────────────────────────────────────────
function awaitingReceiptKeyboard(orderId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("❌  لغو سفارش", `cancel:${orderId}`)],
  ]);
}

// ── USER PANEL ────────────────────────────────────────────────────────────────
function panelKeyboard(hasSub) {
  const rows = [];
  if (hasSub) {
    rows.push([Markup.button.callback("📥  دریافت مجدد کانفیگ", "panel:config")]);
    rows.push([Markup.button.callback("📲  QR کد اتصال",        "panel:qr")]);
    rows.push([Markup.button.callback("🔄  تمدید اشتراک",       "menu:shop")]);
  } else {
    rows.push([Markup.button.callback("🛒  خرید اشتراک",        "menu:shop")]);
  }
  rows.push([Markup.button.callback("📋  وضعیت سفارش‌ها",      "panel:orders")]);
  rows.push([Markup.button.callback("🏠  بازگشت",              "menu:home")]);
  return Markup.inlineKeyboard(rows);
}

// ── ADMIN: approve/reject inline ─────────────────────────────────────────────
function adminOrderKeyboard(orderId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("✅  تأیید",       `admin:approve:${orderId}`),
      Markup.button.callback("❌  رد",           `admin:reject:${orderId}`),
    ],
  ]);
}

// ── BACK BUTTON ──────────────────────────────────────────────────────────────
const backToHome = Markup.inlineKeyboard([
  [Markup.button.callback("🏠  بازگشت به خانه", "menu:home")],
]);

const backToShop = Markup.inlineKeyboard([
  [Markup.button.callback("◀️  بازگشت به فروشگاه", "menu:shop")],
  [Markup.button.callback("🏠  خانه",               "menu:home")],
]);

module.exports = {
  homeKeyboard,
  shopKeyboard,
  confirmOrderKeyboard,
  awaitingReceiptKeyboard,
  panelKeyboard,
  adminOrderKeyboard,
  backToHome,
  backToShop,
};
