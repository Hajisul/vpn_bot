// src/handlers/userHandlers.js
// Handles all private-chat interactions with end users.

const db           = require("../db/database");
const orderSvc     = require("../services/orderService");
const qrSvc        = require("../services/qrService");
const sessionSvc   = require("../services/session");
const msg          = require("../ui/messages");
const kb           = require("../ui/keyboards");
const env          = require("../config/env");
const logger       = require("../config/logger");

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sendHome(ctx) {
  const user = db.getUser(ctx.from.id);
  const sub  = db.getUserSubscription(ctx.from.id);
  sessionSvc.reset(ctx.from.id);

  try {
    await ctx.replyWithMarkdown(msg.home(user ?? ctx.from, sub ?? null), kb.homeKeyboard);
  } catch (_) {
    await ctx.reply(msg.home(user ?? ctx.from, sub ?? null), {
      parse_mode: "Markdown",
      ...kb.homeKeyboard,
    });
  }
}

async function safeEdit(ctx, text, extra) {
  try {
    await ctx.editMessageText(text, { parse_mode: "Markdown", ...extra });
  } catch {
    await ctx.replyWithMarkdown(text, extra);
  }
}

// ── /start ────────────────────────────────────────────────────────────────────

async function handleStart(ctx) {
  db.upsertUser(ctx.from);
  logger.info(`/start — ${ctx.from.id} @${ctx.from.username ?? "—"}`);
  await sendHome(ctx);
}

// ── MENU CALLBACKS ────────────────────────────────────────────────────────────

async function handleMenuHome(ctx) {
  await ctx.answerCbQuery();
  await sendHome(ctx);
}

async function handleMenuShop(ctx) {
  await ctx.answerCbQuery();
  await safeEdit(ctx, msg.shop(), kb.shopKeyboard);
}

async function handleMenuPanel(ctx) {
  await ctx.answerCbQuery();
  const user      = db.getUser(ctx.from.id);
  const sub       = db.getUserSubscription(ctx.from.id);
  const lastOrder = db.getUserLatestDelivered(ctx.from.id);
  await safeEdit(ctx, msg.myPanel(user ?? ctx.from, sub, lastOrder), kb.panelKeyboard(!!sub));
}

async function handleMenuSupport(ctx) {
  await ctx.answerCbQuery();
  const text = msg.supportMsg(env.SUPPORT_USERNAME);
  await safeEdit(ctx, text, kb.backToHome);
}

// ── PANEL CALLBACKS ───────────────────────────────────────────────────────────

async function handlePanelConfig(ctx) {
  await ctx.answerCbQuery();
  const sub = db.getUserSubscription(ctx.from.id);
  if (!sub?.config_link) {
    return safeEdit(ctx, "❌ کانفیگی برای ارسال یافت نشد.", kb.backToHome);
  }
  const order = db.getOrderById(sub.order_id);
  await ctx.replyWithMarkdown(msg.configDelivered(sub.order_id, sub.config_link, sub.expires_at));
}

async function handlePanelQR(ctx) {
  await ctx.answerCbQuery("در حال ساخت QR...");
  const sub = db.getUserSubscription(ctx.from.id);
  if (!sub?.config_link) {
    return ctx.replyWithMarkdown("❌ کانفیگی برای نمایش QR یافت نشد.");
  }
  try {
    const qrBuf = await qrSvc.generateQR(sub.config_link);
    await ctx.replyWithPhoto({ source: qrBuf }, {
      caption: `📲 *QR کد اتصال*\nسفارش: *${sub.order_id}*\nانقضا: ${sub.expires_at}`,
      parse_mode: "Markdown",
    });
  } catch (e) {
    logger.error("QR error:", e.message);
    await ctx.replyWithMarkdown("❌ خطا در ساخت QR کد.");
  }
}

async function handlePanelOrders(ctx) {
  await ctx.answerCbQuery();
  const active = db.getUserActiveOrder(ctx.from.id);
  const last   = db.getUserLatestDelivered(ctx.from.id);

  let text = `📋 *وضعیت سفارش‌ها*\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  if (active) {
    text += `🔄 *سفارش فعال:*\n🧾 ${active.order_id}\n📊 ${msg.statusLabel(active.status)}\n\n`;
  }
  if (last) {
    text += `✅ *آخرین تحویل:*\n🧾 ${last.order_id}\n📅 ${last.updated_at?.slice(0,10)}\n`;
  }
  if (!active && !last) {
    text += `هیچ سفارشی یافت نشد.\n`;
  }
  await safeEdit(ctx, text, kb.backToHome);
}

// ── BUY FLOW ──────────────────────────────────────────────────────────────────

async function handleBuyPlan(ctx, plan) {
  await ctx.answerCbQuery();

  // Block if active order
  const existing = db.getUserActiveOrder(ctx.from.id);
  if (existing) {
    return safeEdit(ctx, msg.alreadyHasOrder, kb.backToHome);
  }

  let order;
  try {
    order = orderSvc.startOrder(ctx.from.id, plan);
  } catch (e) {
    if (e.message === "ACTIVE_ORDER_EXISTS") {
      return safeEdit(ctx, msg.alreadyHasOrder, kb.backToHome);
    }
    logger.error("startOrder failed:", e.message);
    return safeEdit(ctx, "❌ خطای سیستمی. لطفاً دوباره تلاش کنید.", kb.backToHome);
  }

  const priceMap = { "1m": env.PRICE_1M, "3m": env.PRICE_3M, "6m": env.PRICE_6M };
  const text = msg.paymentInstruction({
    plan,
    amount: priceMap[plan],
    card:   env.BANK_CARD,
    owner:  env.BANK_OWNER,
    orderId: order.order_id,
  });

  await safeEdit(ctx, text, kb.confirmOrderKeyboard(order.order_id));
}

// ── CONFIRM (user clicked "I paid") ─────────────────────────────────────────

async function handleConfirmPayment(ctx, orderId) {
  await ctx.answerCbQuery();
  const order = db.getOrderById(orderId);
  if (!order || order.user_id !== ctx.from.id) return;
  if (order.status !== db.STATUS.PENDING_PAYMENT) {
    return safeEdit(ctx, "⚠️ این سفارش قبلاً پردازش شده.", kb.backToHome);
  }

  sessionSvc.set(ctx.from.id, { step: "awaiting_receipt", pendingOrderId: orderId });
  await safeEdit(
    ctx,
    `📸 *ارسال رسید پرداخت*\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🧾 سفارش: *${orderId}*\n\n` +
    `تصویر یا متن رسید واریز را ارسال کنید:`,
    kb.awaitingReceiptKeyboard(orderId)
  );
}

// ── RECEIVE RECEIPT ───────────────────────────────────────────────────────────

async function handleIncomingMessage(ctx) {
  const session = sessionSvc.get(ctx.from.id);

  if (session.step !== "awaiting_receipt" || !session.pendingOrderId) {
    // Not in receipt flow — ignore or show home
    return sendHome(ctx);
  }

  const orderId = session.pendingOrderId;
  const order   = db.getOrderById(orderId);

  if (!order || order.user_id !== ctx.from.id || order.status !== db.STATUS.PENDING_PAYMENT) {
    sessionSvc.reset(ctx.from.id);
    return sendHome(ctx);
  }

  let receiptType, receiptData;

  if (ctx.message?.photo) {
    receiptType = "photo";
    receiptData = ctx.message.photo.at(-1).file_id;
  } else if (ctx.message?.text) {
    receiptType = "text";
    receiptData = ctx.message.text.trim();
  } else {
    return ctx.replyWithMarkdown("⚠️ لطفاً تصویر یا متن رسید را ارسال کنید.");
  }

  // Update order
  const updated = orderSvc.submitReceipt(orderId, receiptType, receiptData);
  sessionSvc.reset(ctx.from.id);

  // Confirm to user
  await ctx.replyWithMarkdown(msg.receiptReceived(orderId), kb.backToHome);

  // Notify admin group
  await notifyAdminGroup(ctx, updated);
}

// ── CANCEL ────────────────────────────────────────────────────────────────────

async function handleCancel(ctx, orderId) {
  await ctx.answerCbQuery("لغو شد");
  const order = db.getOrderById(orderId);
  if (order && order.user_id === ctx.from.id && order.status === db.STATUS.PENDING_PAYMENT) {
    db.updateOrderStatus(orderId, db.STATUS.REJECTED, { rejectReason: "لغو توسط کاربر" });
  }
  sessionSvc.reset(ctx.from.id);
  await safeEdit(ctx, msg.cancelledMsg, kb.homeKeyboard);
}

// ── NOTIFY ADMIN GROUP ────────────────────────────────────────────────────────

async function notifyAdminGroup(ctx, order) {
  const { bot } = require("../bot");
  const user = db.getUser(order.user_id) ?? ctx.from;

  const caption = msg.adminNewOrder({
    username: user.username,
    userId:   order.user_id,
    plan:     order.plan,
    amount:   order.amount,
    orderId:  order.order_id,
  });

  try {
    let adminMsg;
    if (order.receipt_type === "photo") {
      adminMsg = await bot.telegram.sendPhoto(env.ADMIN_GROUP_ID, order.receipt_data, {
        caption,
        parse_mode: "Markdown",
        ...kb.adminOrderKeyboard(order.order_id),
      });
    } else {
      await bot.telegram.sendMessage(env.ADMIN_GROUP_ID,
        `📄 *رسید متنی:*\n\`\`\`\n${order.receipt_data}\n\`\`\``, { parse_mode: "Markdown" });
      adminMsg = await bot.telegram.sendMessage(env.ADMIN_GROUP_ID, caption, {
        parse_mode: "Markdown",
        ...kb.adminOrderKeyboard(order.order_id),
      });
    }
    db.updateOrderStatus(order.order_id, db.STATUS.WAITING_CONFIRMATION, {
      adminMsgId: adminMsg.message_id,
    });
    logger.ok(`Admin notified — ${order.order_id}, msg_id=${adminMsg.message_id}`);
  } catch (e) {
    logger.error("Admin notify failed:", e.message);
  }
}

module.exports = {
  handleStart,
  handleMenuHome,
  handleMenuShop,
  handleMenuPanel,
  handleMenuSupport,
  handlePanelConfig,
  handlePanelQR,
  handlePanelOrders,
  handleBuyPlan,
  handleConfirmPayment,
  handleIncomingMessage,
  handleCancel,
};
