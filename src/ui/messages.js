// src/ui/messages.js
// Every Persian string in one place. Zero hardcoded text in handlers.

const { PLANS, PRICE_1M, PRICE_3M, PRICE_6M } = require("../config/env");

const fa = (n) => String(n).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
const money = (n) => fa(Number(n).toLocaleString("en")) + " تومان";
const pad = (s, len = 32) => s + "─".repeat(Math.max(0, len - s.length));

// ── Decorative dividers ───────────────────────────────────────────────────────
const DIV  = "━━━━━━━━━━━━━━━━━━━━━━━━";
const DIV2 = "─────────────────────────";

// ── HOME / DASHBOARD ─────────────────────────────────────────────────────────

function home(user, sub) {
  const name = user.first_name ?? "کاربر";
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 6)  return "شب بخیر";
    if (h < 12) return "صبح بخیر";
    if (h < 18) return "روز بخیر";
    return "عصر بخیر";
  })();

  let subLine;
  if (sub && sub.expires_at) {
    const left = Math.ceil((new Date(sub.expires_at) - Date.now()) / 86400000);
    subLine = left > 0
      ? `📡 *اشتراک فعال* · ${fa(left)} روز مانده`
      : `⚠️ اشتراک شما *منقضی شده*`;
  } else {
    subLine = `📭 اشتراک فعالی ندارید`;
  }

  return (
    `╔═══════════════════════╗\n` +
    `║  🛡️  *VPN Store*  ║\n` +
    `╚═══════════════════════╝\n\n` +
    `${greeting} ${name} جان! 👋\n\n` +
    `${DIV}\n` +
    `${subLine}\n` +
    `${DIV}\n\n` +
    `از منوی زیر انتخاب کنید 👇`
  );
}

// ── SHOP ─────────────────────────────────────────────────────────────────────

function shop() {
  return (
    `🛒 *فروشگاه VPN*\n` +
    `${DIV}\n\n` +
    `پلن مورد نظر خود را انتخاب کنید:\n\n` +
    planCard("1m", PRICE_1M) + "\n" +
    planCard("3m", PRICE_3M) + "\n" +
    planCard("6m", PRICE_6M)
  );
}

function planCard(key, price) {
  const p = PLANS[key];
  const badge = p.badge ? ` 【${p.badge}】` : "";
  const features = p.features.map(f => `  ✦ ${f}`).join("\n");
  return (
    `${p.emoji} *${p.label}*${badge}\n` +
    `💰 ${money(price)}\n` +
    `${features}\n` +
    `${DIV2}`
  );
}

// ── PAYMENT FLOW ─────────────────────────────────────────────────────────────

function paymentInstruction({ plan, amount, card, owner, orderId }) {
  const p = PLANS[plan];
  return (
    `🧾 *پرداخت سفارش ${orderId}*\n` +
    `${DIV}\n\n` +
    `${p.emoji} پلن انتخابی: *${p.label}*\n\n` +
    `💳 شماره کارت:\n` +
    `\`${card}\`\n` +
    `👤 به نام: *${owner}*\n\n` +
    `💰 مبلغ قابل پرداخت:\n` +
    `*${money(amount)}*\n\n` +
    `${DIV}\n` +
    `📌 *مراحل پرداخت:*\n` +
    `۱. مبلغ فوق را به کارت واریز کنید\n` +
    `۲. تصویر یا متن رسید پرداخت را ارسال کنید\n` +
    `۳. منتظر تأیید ادمین بمانید\n\n` +
    `⚠️ شماره سفارش خود را یادداشت کنید:\n` +
    `*${orderId}*`
  );
}

function receiptReceived(orderId) {
  return (
    `✅ *رسید دریافت شد!*\n` +
    `${DIV}\n\n` +
    `🧾 شماره سفارش: *${orderId}*\n` +
    `📊 وضعیت: *در حال بررسی توسط ادمین*\n\n` +
    `⏳ پس از تأیید پرداخت، کانفیگ VPN برای شما ارسال خواهد شد.\n\n` +
    `معمولاً ظرف *۱۵ تا ۳۰ دقیقه* تأیید می‌شود.`
  );
}

function orderApproved(orderId) {
  return (
    `🎉 *پرداخت شما تأیید شد!*\n` +
    `${DIV}\n\n` +
    `🧾 سفارش: *${orderId}*\n` +
    `⚙️ در حال آماده‌سازی کانفیگ VPN...\n\n` +
    `به زودی کانفیگ شما ارسال می‌شود.`
  );
}

function orderRejected(orderId, reason) {
  return (
    `❌ *سفارش رد شد*\n` +
    `${DIV}\n\n` +
    `🧾 سفارش: *${orderId}*\n` +
    (reason ? `📝 دلیل: ${reason}\n\n` : "\n") +
    `برای رفع مشکل با پشتیبانی تماس بگیرید یا مجدداً اقدام کنید.`
  );
}

function configDelivered(orderId, configLink, expiresAt) {
  return (
    `🎊 *کانفیگ VPN شما آماده است!*\n` +
    `${DIV}\n\n` +
    `🧾 سفارش: *${orderId}*\n` +
    `📅 تاریخ انقضا: *${expiresAt}*\n\n` +
    `${DIV}\n` +
    `🔑 *کانفیگ V2Ray:*\n` +
    `\`\`\`\n${configLink}\n\`\`\`\n` +
    `${DIV}\n\n` +
    `📱 *راهنمای اتصال:*\n` +
    `• اندروید: V2RayNG\n` +
    `• iOS: Shadowrocket / Streisand\n` +
    `• ویندوز: V2RayN\n` +
    `• مک: FoXray\n\n` +
    `لینک را کپی کنید و در اپ ایمپورت کنید.\n\n` +
    `✨ از خرید شما سپاسگزاریم! 🙏`
  );
}

// ── USER PANEL ───────────────────────────────────────────────────────────────

function myPanel(user, sub, lastOrder) {
  const name = user.first_name ?? "کاربر";

  let subSection;
  if (sub) {
    const left = Math.ceil((new Date(sub.expires_at) - Date.now()) / 86400000);
    const bar  = progressBar(Math.max(0, left), PLANS[sub.plan]?.duration ?? 30);
    subSection =
      `📡 *وضعیت اشتراک*\n` +
      `پلن: *${PLANS[sub.plan]?.label ?? sub.plan}*\n` +
      `${bar}\n` +
      `⏳ ${fa(Math.max(0, left))} روز مانده (${sub.expires_at})\n`;
  } else {
    subSection = `📭 *اشتراک فعالی ندارید*\n`;
  }

  const orderSection = lastOrder
    ? `🧾 آخرین سفارش: *${lastOrder.order_id}* · ${statusLabel(lastOrder.status)}\n`
    : "";

  return (
    `👤 *پنل کاربری*\n` +
    `${DIV}\n\n` +
    `نام: ${name}\n` +
    `آیدی: \`${user.id}\`\n\n` +
    `${DIV}\n` +
    subSection +
    `${DIV}\n` +
    orderSection
  );
}

function progressBar(remaining, total) {
  const pct   = Math.min(1, remaining / total);
  const filled = Math.round(pct * 10);
  const empty  = 10 - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}] ${Math.round(pct * 100)}٪`;
}

function statusLabel(status) {
  const map = {
    PENDING_PAYMENT:      "⏳ انتظار پرداخت",
    WAITING_CONFIRMATION: "🔍 در حال بررسی",
    PROCESSING:           "⚙️ در حال پردازش",
    DELIVERED:            "✅ تحویل داده شد",
    REJECTED:             "❌ رد شد",
  };
  return map[status] ?? status;
}

// ── ADMIN GROUP MESSAGES ─────────────────────────────────────────────────────

function adminNewOrder({ username, userId, plan, amount, orderId }) {
  return (
    `🆕 *سفارش جدید*\n` +
    `${DIV}\n\n` +
    `👤 ${username ? "@" + username : "بدون یوزرنیم"}\n` +
    `🆔 آیدی: \`${userId}\`\n` +
    `${PLANS[plan].emoji} پلن: *${PLANS[plan].label}*\n` +
    `💰 مبلغ: *${money(amount)}*\n` +
    `🧾 سفارش: *${orderId}*\n\n` +
    `${DIV}\n` +
    `✅ تأیید: \`/approve ${orderId}\`\n` +
    `❌ رد: \`/reject ${orderId} [دلیل]\``
  );
}

function adminPanelStats(stats) {
  return (
    `📊 *پنل ادمین — آمار*\n` +
    `${DIV}\n\n` +
    `👥 کاربران: *${fa(stats.totalUsers)}*\n` +
    `📦 کل سفارش‌ها: *${fa(stats.totalOrders)}*\n` +
    `✅ تحویل داده شده: *${fa(stats.delivered)}*\n` +
    `🔍 در انتظار بررسی: *${fa(stats.pending)}*\n` +
    `💰 درآمد کل: *${money(stats.totalRevenue)}*\n`
  );
}

// ── SELLER GROUP MESSAGES ─────────────────────────────────────────────────────

function sellerConfigRequest({ orderId, plan, userId, username }) {
  return (
    `📡 *درخواست کانفیگ*\n` +
    `${DIV}\n\n` +
    `🧾 سفارش: *${orderId}*\n` +
    `${PLANS[plan].emoji} پلن: *${PLANS[plan].label}*\n` +
    `🆔 آیدی: \`${userId}\`\n` +
    `👤 ${username ? "@" + username : "—"}\n\n` +
    `${DIV}\n` +
    `⬇️ کانفیگ vmess/vless را *ریپلای* کنید.`
  );
}

// ── MISC ──────────────────────────────────────────────────────────────────────

const alreadyHasOrder =
  `⚠️ *شما یک سفارش فعال دارید*\n\n` +
  `لطفاً ابتدا سفارش جاری خود را به پایان برسانید.`;

const cancelledMsg =
  `🚫 *عملیات لغو شد*\n\n` +
  `برای شروع مجدد از منوی اصلی اقدام کنید.`;

const supportMsg = (username) =>
  username
    ? `📞 برای پشتیبانی با @${username} تماس بگیرید.`
    : `📞 لطفاً از طریق پشتیبانی اقدام کنید.`;

module.exports = {
  home,
  shop,
  planCard,
  paymentInstruction,
  receiptReceived,
  orderApproved,
  orderRejected,
  configDelivered,
  myPanel,
  statusLabel,
  adminNewOrder,
  adminPanelStats,
  sellerConfigRequest,
  alreadyHasOrder,
  cancelledMsg,
  supportMsg,
  money,
  fa,
};
