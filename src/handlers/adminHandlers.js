// src/handlers/adminHandlers.js
// Handles commands and callbacks from the admin review group.

const db        = require("../db/database");
const orderSvc  = require("../services/orderService");
const msg       = require("../ui/messages");
const env       = require("../config/env");
const logger    = require("../config/logger");

function isAdminGroup(ctx) {
  return String(ctx.chat?.id) === env.ADMIN_GROUP_ID;
}

// ── /approve #XXXX ────────────────────────────────────────────────────────────

async function handleApprove(ctx) {
  if (!isAdminGroup(ctx)) return;

  const parts   = ctx.message.text.trim().split(/\s+/);
  const orderId = parts[1];
  if (!orderId) return ctx.reply("استفاده: /approve #1001");

  let order;
  try {
    order = orderSvc.approveOrder(orderId);
  } catch (e) {
    return ctx.reply(`❌ ${e.message === "NOT_FOUND" ? "سفارش یافت نشد" : "وضعیت سفارش: " + e.message.split(":")[1]}`);
  }

  await ctx.reply(`✅ سفارش *${orderId}* تأیید شد.`, { parse_mode: "Markdown" });

  // Notify user
  const { bot } = require("../bot");
  try {
    await bot.telegram.sendMessage(order.user_id, msg.orderApproved(orderId), { parse_mode: "Markdown" });
  } catch (e) { logger.warn("User notify failed:", e.message); }

  // Notify seller group
  await notifySellerGroup(order);
  logger.ok(`Approve — ${orderId}`);
}

// ── /reject #XXXX [reason] ────────────────────────────────────────────────────

async function handleReject(ctx) {
  if (!isAdminGroup(ctx)) return;

  const parts   = ctx.message.text.trim().split(/\s+/);
  const orderId = parts[1];
  const reason  = parts.slice(2).join(" ") || "";
  if (!orderId) return ctx.reply("استفاده: /reject #1001 [دلیل]");

  let order;
  try {
    order = orderSvc.rejectOrder(orderId, reason);
  } catch (e) {
    return ctx.reply(`❌ ${e.message === "NOT_FOUND" ? "سفارش یافت نشد" : e.message}`);
  }

  await ctx.reply(`❌ سفارش *${orderId}* رد شد.`, { parse_mode: "Markdown" });

  const { bot } = require("../bot");
  try {
    await bot.telegram.sendMessage(order.user_id, msg.orderRejected(orderId, reason), { parse_mode: "Markdown" });
  } catch (e) { logger.warn("User notify failed:", e.message); }

  logger.ok(`Reject — ${orderId}`);
}

// ── Inline approve/reject buttons ────────────────────────────────────────────

async function handleInlineApprove(ctx, orderId) {
  await ctx.answerCbQuery("در حال پردازش...");

  let order;
  try {
    order = orderSvc.approveOrder(orderId);
  } catch (e) {
    return ctx.answerCbQuery(
      e.message === "NOT_FOUND" ? "سفارش یافت نشد" : "وضعیت نادرست: " + e.message,
      { show_alert: true }
    );
  }

  try {
    await ctx.editMessageCaption
      ? await ctx.editMessageCaption(`✅ تأیید شد توسط: @${ctx.from.username ?? ctx.from.id}`, { parse_mode: "Markdown" })
      : await ctx.editMessageText(`✅ تأیید شد — ${orderId}`);
  } catch (_) {}

  const { bot } = require("../bot");
  try {
    await bot.telegram.sendMessage(order.user_id, msg.orderApproved(orderId), { parse_mode: "Markdown" });
  } catch (e) { logger.warn("User notify:", e.message); }

  await notifySellerGroup(order);
  logger.ok(`Inline Approve — ${orderId}`);
}

async function handleInlineReject(ctx, orderId) {
  await ctx.answerCbQuery("رد شد");

  let order;
  try {
    order = orderSvc.rejectOrder(orderId, "رد توسط ادمین");
  } catch (e) {
    return ctx.answerCbQuery("خطا: " + e.message, { show_alert: true });
  }

  try {
    await ctx.editMessageCaption
      ? await ctx.editMessageCaption(`❌ رد شد توسط: @${ctx.from.username ?? ctx.from.id}`, { parse_mode: "Markdown" })
      : await ctx.editMessageText(`❌ رد شد — ${orderId}`);
  } catch (_) {}

  const { bot } = require("../bot");
  try {
    await bot.telegram.sendMessage(order.user_id, msg.orderRejected(orderId, ""), { parse_mode: "Markdown" });
  } catch (e) { logger.warn("User notify:", e.message); }

  logger.ok(`Inline Reject — ${orderId}`);
}

// ── /stats ────────────────────────────────────────────────────────────────────

async function handleStats(ctx) {
  if (!isAdminGroup(ctx)) return;
  const stats = db.getStats();
  await ctx.replyWithMarkdown(msg.adminPanelStats(stats));
}

// ── /pending ──────────────────────────────────────────────────────────────────

async function handlePending(ctx) {
  if (!isAdminGroup(ctx)) return;
  const orders = db.getPendingOrders();
  if (!orders.length) return ctx.reply("✅ هیچ سفارش در انتظاری وجود ندارد.");

  for (const o of orders.slice(0, 10)) {
    const line =
      `🧾 *${o.order_id}*\n` +
      `👤 ${o.username ? "@" + o.username : o.first_name ?? "—"}  (${o.user_id})\n` +
      `${env.PLANS[o.plan]?.emoji} ${env.PLANS[o.plan]?.label}  ·  ${msg.money(o.amount)}\n` +
      `📅 ${o.created_at?.slice(0, 16)}\n` +
      `\`/approve ${o.order_id}\`  |  \`/reject ${o.order_id}\``;
    await ctx.replyWithMarkdown(line);
  }
}

// ── Notify Seller Group ───────────────────────────────────────────────────────

async function notifySellerGroup(order) {
  const { bot } = require("../bot");
  const user = db.getUser(order.user_id);

  const text = msg.sellerConfigRequest({
    orderId:  order.order_id,
    plan:     order.plan,
    userId:   order.user_id,
    username: user?.username,
  });

  try {
    const sellerMsg = await bot.telegram.sendMessage(env.SELLER_GROUP_ID, text, { parse_mode: "Markdown" });
    db.updateOrderStatus(order.order_id, db.STATUS.PROCESSING, { sellerMsgId: sellerMsg.message_id });
    logger.ok(`Seller notified — ${order.order_id}, msg=${sellerMsg.message_id}`);
  } catch (e) {
    logger.error("Seller notify failed:", e.message);
  }
}

module.exports = {
  handleApprove,
  handleReject,
  handleInlineApprove,
  handleInlineReject,
  handleStats,
  handlePending,
};
