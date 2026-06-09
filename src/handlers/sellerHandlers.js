// src/handlers/sellerHandlers.js
// Detects VPN config links replied in the seller group and delivers to users.

const db        = require("../db/database");
const orderSvc  = require("../services/orderService");
const msg       = require("../ui/messages");
const env       = require("../config/env");
const logger    = require("../config/logger");

const CONFIG_PREFIXES = ["vmess://", "vless://", "trojan://", "ss://"];

function isSellerGroup(ctx) {
  return String(ctx.chat?.id) === env.SELLER_GROUP_ID;
}

function isVpnConfig(text) {
  return CONFIG_PREFIXES.some(p => text?.startsWith(p));
}

async function handleSellerMessage(ctx) {
  if (!isSellerGroup(ctx)) return;

  const replyTo = ctx.message?.reply_to_message;
  if (!replyTo) return; // must be a reply

  const rawText = ctx.message?.text?.trim() ?? ctx.message?.caption?.trim() ?? "";
  if (!isVpnConfig(rawText)) return; // not a config link

  // Find order by the bot's original seller-group message
  const order = db.getOrderBySellerMsg(replyTo.message_id);
  if (!order) {
    logger.warn(`Seller reply to unknown msg_id=${replyTo.message_id}`);
    return ctx.reply("⚠️ سفارشی با این پیام پیدا نشد.");
  }

  // Prevent duplicate delivery with atomic lock
  let updatedOrder;
  try {
    updatedOrder = orderSvc.deliverConfig(order.order_id, rawText);
  } catch (e) {
    if (e.message === "DUPLICATE_DELIVERY") {
      return ctx.reply(`⚠️ کانفیگ سفارش *${order.order_id}* قبلاً ارسال شده است.`,
        { parse_mode: "Markdown" });
    }
    logger.error("deliverConfig error:", e.message);
    return ctx.reply("❌ خطای سیستمی هنگام ثبت کانفیگ.");
  }

  // Calculate expiry for display
  const plan      = env.PLANS[order.plan];
  const expiresAt = new Date(Date.now() + (plan?.duration ?? 30) * 86400000)
    .toISOString().slice(0, 10);

  // Deliver to user
  const { bot } = require("../bot");
  try {
    await bot.telegram.sendMessage(
      order.user_id,
      msg.configDelivered(order.order_id, rawText, expiresAt),
      { parse_mode: "Markdown" }
    );
    await ctx.reply(
      `✅ کانفیگ سفارش *${order.order_id}* با موفقیت به کاربر ارسال شد.`,
      { parse_mode: "Markdown" }
    );
    logger.ok(`Config delivered — ${order.order_id} → user ${order.user_id}`);
  } catch (e) {
    logger.error(`Delivery to user ${order.user_id} failed:`, e.message);
    await ctx.reply(
      `❌ خطا در ارسال به کاربر.\nآیدی: \`${order.user_id}\`\nسفارش: *${order.order_id}*\n\nلطفاً دستی ارسال کنید.`,
      { parse_mode: "Markdown" }
    );
  }
}

module.exports = { handleSellerMessage };
