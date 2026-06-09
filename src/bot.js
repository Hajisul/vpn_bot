// src/bot.js
// Entry point. Assembles all handlers. Exports `bot` for cross-module access.
// Single polling instance — Railway-safe.

const { Telegraf } = require("telegraf");
const env          = require("./config/env");
const logger       = require("./config/logger");
const db           = require("./db/database");

const userH   = require("./handlers/userHandlers");
const adminH  = require("./handlers/adminHandlers");
const sellerH = require("./handlers/sellerHandlers");

// ── Create bot (singleton export) ────────────────────────────────────────────
const bot = new Telegraf(env.BOT_TOKEN);
module.exports = { bot }; // exported early so handlers can import without circular issues

// ── Middleware: track users ───────────────────────────────────────────────────
bot.use(async (ctx, next) => {
  if (ctx.from && ctx.chat?.type === "private") {
    db.upsertUser(ctx.from);
  }
  return next();
});

// ── Route helper ──────────────────────────────────────────────────────────────
const isPrivate      = (ctx) => ctx.chat?.type === "private";
const isAdminGroup   = (ctx) => String(ctx.chat?.id) === env.ADMIN_GROUP_ID;
const isSellerGroup  = (ctx) => String(ctx.chat?.id) === env.SELLER_GROUP_ID;

// ── PRIVATE CHAT COMMANDS ─────────────────────────────────────────────────────
bot.command("start", (ctx) => isPrivate(ctx) && userH.handleStart(ctx));

// ── MENU NAVIGATION (inline buttons) ─────────────────────────────────────────
bot.action("menu:home",    userH.handleMenuHome);
bot.action("menu:shop",    userH.handleMenuShop);
bot.action("menu:panel",   userH.handleMenuPanel);
bot.action("menu:support", userH.handleMenuSupport);

// ── PANEL ACTIONS ─────────────────────────────────────────────────────────────
bot.action("panel:config", userH.handlePanelConfig);
bot.action("panel:qr",     userH.handlePanelQR);
bot.action("panel:orders", userH.handlePanelOrders);

// ── BUY PLAN ──────────────────────────────────────────────────────────────────
bot.action("buy:1m", (ctx) => userH.handleBuyPlan(ctx, "1m"));
bot.action("buy:3m", (ctx) => userH.handleBuyPlan(ctx, "3m"));
bot.action("buy:6m", (ctx) => userH.handleBuyPlan(ctx, "6m"));

// ── CONFIRM / CANCEL (dynamic orderId in action data) ─────────────────────────
bot.action(/^confirm:(.+)$/, (ctx) => {
  const orderId = ctx.match[1];
  return isPrivate(ctx) ? userH.handleConfirmPayment(ctx, orderId) : undefined;
});

bot.action(/^cancel:(.+)$/, (ctx) => {
  const orderId = ctx.match[1];
  return isPrivate(ctx) ? userH.handleCancel(ctx, orderId) : undefined;
});

// ── ADMIN INLINE BUTTONS (from admin group messages) ─────────────────────────
bot.action(/^admin:approve:(.+)$/, (ctx) => {
  const orderId = ctx.match[1];
  return isAdminGroup(ctx) ? adminH.handleInlineApprove(ctx, orderId) : undefined;
});

bot.action(/^admin:reject:(.+)$/, (ctx) => {
  const orderId = ctx.match[1];
  return isAdminGroup(ctx) ? adminH.handleInlineReject(ctx, orderId) : undefined;
});

// ── ADMIN GROUP TEXT COMMANDS ─────────────────────────────────────────────────
bot.command("approve", adminH.handleApprove);
bot.command("reject",  adminH.handleReject);
bot.command("stats",   adminH.handleStats);
bot.command("pending", adminH.handlePending);

// ── SELLER GROUP: VPN config replies ─────────────────────────────────────────
bot.on("message", async (ctx, next) => {
  if (isSellerGroup(ctx)) {
    return sellerH.handleSellerMessage(ctx);
  }
  if (isPrivate(ctx)) {
    return userH.handleIncomingMessage(ctx);
  }
  return next();
});

// ── GLOBAL ERROR HANDLER ──────────────────────────────────────────────────────
bot.catch((err, ctx) => {
  logger.error(`Update ${ctx?.updateType} error:`, err?.message ?? err);
  if (isPrivate(ctx)) {
    ctx.reply("⚠️ خطایی رخ داده. لطفاً دوباره تلاش کنید.").catch(() => {});
  }
});

// ── LAUNCH ────────────────────────────────────────────────────────────────────
(async () => {
  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  logger.info("  VPN Store Bot — starting up...");
  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Delete any stale webhook to avoid 409 conflicts
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    logger.info("Webhook cleared (prevents 409 conflicts)");
  } catch (e) {
    logger.warn("Could not clear webhook:", e.message);
  }

  process.once("SIGINT",  () => { logger.info("SIGINT — graceful stop"); bot.stop("SIGINT"); });
  process.once("SIGTERM", () => { logger.info("SIGTERM — graceful stop"); bot.stop("SIGTERM"); });

  await bot.launch({ allowedUpdates: ["message", "callback_query"] });

  const me = await bot.telegram.getMe();
  logger.ok(`Bot is live: @${me.username} (id=${me.id})`);
  logger.info(`Admin group  : ${env.ADMIN_GROUP_ID}`);
  logger.info(`Seller group : ${env.SELLER_GROUP_ID}`);
  logger.info(`Plans        : 1M=${env.PRICE_1M}T  3M=${env.PRICE_3M}T  6M=${env.PRICE_6M}T`);
  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
})();
