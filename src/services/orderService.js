// src/services/orderService.js
// All order business logic. Handlers only call this service.

const db     = require("../db/database");
const env    = require("../config/env");
const logger = require("../config/logger");

/**
 * Create a new order for a user.
 * Throws if user already has an active (non-terminal) order.
 */
function startOrder(userId, plan) {
  const existing = db.getUserActiveOrder(userId);
  if (existing) throw new Error("ACTIVE_ORDER_EXISTS");

  const priceMap = { "1m": env.PRICE_1M, "3m": env.PRICE_3M, "6m": env.PRICE_6M };
  const amount   = priceMap[plan];
  if (!amount) throw new Error("INVALID_PLAN");

  const order = db.createOrder({ userId, plan, amount });
  logger.order(`Created ${order.order_id} — user ${userId}, plan=${plan}, amount=${amount}`);
  return order;
}

/**
 * Attach the receipt to the order and mark WAITING_CONFIRMATION.
 */
function submitReceipt(orderId, receiptType, receiptData) {
  db.updateOrderStatus(orderId, db.STATUS.WAITING_CONFIRMATION, { receiptType, receiptData });
  logger.order(`Receipt submitted — ${orderId}`);
  return db.getOrderById(orderId);
}

/**
 * Admin approves an order.
 * Returns the updated order, or throws if already processed.
 */
function approveOrder(orderId) {
  const order = db.getOrderById(orderId);
  if (!order)                                    throw new Error("NOT_FOUND");
  if (order.status !== db.STATUS.WAITING_CONFIRMATION) throw new Error("WRONG_STATUS:" + order.status);
  db.updateOrderStatus(orderId, db.STATUS.PROCESSING);
  logger.order(`Approved — ${orderId}`);
  return db.getOrderById(orderId);
}

/**
 * Admin rejects an order.
 */
function rejectOrder(orderId, reason = "") {
  const order = db.getOrderById(orderId);
  if (!order) throw new Error("NOT_FOUND");
  if (order.status === db.STATUS.DELIVERED || order.status === db.STATUS.REJECTED)
    throw new Error("WRONG_STATUS:" + order.status);
  db.updateOrderStatus(orderId, db.STATUS.REJECTED, { rejectReason: reason });
  logger.order(`Rejected — ${orderId}`);
  return db.getOrderById(orderId);
}

/**
 * Seller delivers config. Uses atomic lock to prevent duplicates.
 * Returns updated order or throws "DUPLICATE_DELIVERY".
 */
function deliverConfig(orderId, configLink) {
  const locked = db.acquireProcessingLock(orderId);
  if (!locked) throw new Error("DUPLICATE_DELIVERY");

  const order = db.getOrderById(orderId);
  const plan  = env.PLANS[order.plan];

  db.updateOrderStatus(orderId, db.STATUS.DELIVERED, { configLink });

  // Create subscription record
  db.createSubscription({
    userId:      order.user_id,
    orderId,
    plan:        order.plan,
    configLink,
    durationDays: plan?.duration ?? 30,
  });

  logger.order(`Delivered — ${orderId}`);
  return db.getOrderById(orderId);
}

module.exports = { startOrder, submitReceipt, approveOrder, rejectOrder, deliverConfig };
