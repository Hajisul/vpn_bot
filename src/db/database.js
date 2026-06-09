// src/db/database.js
// SQLite layer — all DB access goes through this module.

const Database = require("better-sqlite3");
const path     = require("path");
const fs       = require("fs");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const DB_PATH  = path.join(DATA_DIR, "store.db");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── Schema ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY,
    username      TEXT,
    first_name    TEXT,
    phone         TEXT,
    is_banned     INTEGER DEFAULT 0,
    created_at    TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    order_id      TEXT    NOT NULL,
    plan          TEXT    NOT NULL,
    config_link   TEXT,
    expires_at    TEXT,
    is_active     INTEGER DEFAULT 1,
    created_at    TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id        TEXT UNIQUE NOT NULL,
    user_id         INTEGER NOT NULL,
    plan            TEXT NOT NULL,
    amount          INTEGER NOT NULL,
    status          TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
    receipt_type    TEXT,
    receipt_data    TEXT,
    admin_msg_id    INTEGER,
    seller_msg_id   INTEGER,
    config_link     TEXT,
    reject_reason   TEXT,
    processing_lock INTEGER DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_orders_user    ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_orderid ON orders(order_id);
`);

// ── Order status enum ─────────────────────────────────────────────────────────
const STATUS = {
  PENDING_PAYMENT:      "PENDING_PAYMENT",
  WAITING_CONFIRMATION: "WAITING_CONFIRMATION",
  PROCESSING:           "PROCESSING",
  DELIVERED:            "DELIVERED",
  REJECTED:             "REJECTED",
};

// ── Counter ───────────────────────────────────────────────────────────────────
function nextOrderId() {
  const row = db.prepare("SELECT MAX(id) AS m FROM orders").get();
  return `#${(row.m ?? 1000) + 1}`;
}

// ── Users ─────────────────────────────────────────────────────────────────────
const _upsertUser = db.prepare(`
  INSERT INTO users (id, username, first_name)
  VALUES (@id, @username, @first_name)
  ON CONFLICT(id) DO UPDATE SET
    username   = excluded.username,
    first_name = excluded.first_name
`);

function upsertUser(from) {
  _upsertUser.run({ id: from.id, username: from.username ?? null, first_name: from.first_name ?? null });
}

function getUser(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

function getAllUsers() {
  return db.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
}

// ── Orders ────────────────────────────────────────────────────────────────────
function createOrder({ userId, plan, amount }) {
  const orderId = nextOrderId();
  db.prepare(`
    INSERT INTO orders (order_id, user_id, plan, amount, status)
    VALUES (@orderId, @userId, @plan, @amount, 'PENDING_PAYMENT')
  `).run({ orderId, userId, plan, amount });
  return getOrderById(orderId);
}

function getOrderById(orderId) {
  return db.prepare("SELECT * FROM orders WHERE order_id = ?").get(orderId);
}

function getOrderByAdminMsg(msgId) {
  return db.prepare("SELECT * FROM orders WHERE admin_msg_id = ?").get(msgId);
}

function getOrderBySellerMsg(msgId) {
  return db.prepare("SELECT * FROM orders WHERE seller_msg_id = ?").get(msgId);
}

function getUserActiveOrder(userId) {
  return db.prepare(`
    SELECT * FROM orders
    WHERE user_id = ? AND status NOT IN ('DELIVERED','REJECTED')
    ORDER BY id DESC LIMIT 1
  `).get(userId);
}

function getUserLatestDelivered(userId) {
  return db.prepare(`
    SELECT * FROM orders
    WHERE user_id = ? AND status = 'DELIVERED'
    ORDER BY id DESC LIMIT 1
  `).get(userId);
}

function getPendingOrders() {
  return db.prepare(`
    SELECT o.*, u.username, u.first_name
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    WHERE o.status = 'WAITING_CONFIRMATION'
    ORDER BY o.id ASC
  `).all();
}

function updateOrderStatus(orderId, status, extra = {}) {
  const fields = ["status = @status", "updated_at = datetime('now')"];
  const params = { orderId, status };

  if (extra.receiptType)  { fields.push("receipt_type = @receiptType");   params.receiptType  = extra.receiptType; }
  if (extra.receiptData)  { fields.push("receipt_data = @receiptData");   params.receiptData  = extra.receiptData; }
  if (extra.adminMsgId)   { fields.push("admin_msg_id = @adminMsgId");    params.adminMsgId   = extra.adminMsgId; }
  if (extra.sellerMsgId)  { fields.push("seller_msg_id = @sellerMsgId");  params.sellerMsgId  = extra.sellerMsgId; }
  if (extra.configLink)   { fields.push("config_link = @configLink");     params.configLink   = extra.configLink; }
  if (extra.rejectReason) { fields.push("reject_reason = @rejectReason"); params.rejectReason = extra.rejectReason; }

  db.prepare(`UPDATE orders SET ${fields.join(", ")} WHERE order_id = @orderId`).run(params);
}

/**
 * Atomic lock to prevent duplicate delivery.
 * Returns true if we successfully acquired the lock.
 */
function acquireProcessingLock(orderId) {
  const res = db.prepare(`
    UPDATE orders
    SET processing_lock = 1, status = 'PROCESSING', updated_at = datetime('now')
    WHERE order_id = ? AND processing_lock = 0 AND status IN ('WAITING_CONFIRMATION','PROCESSING')
  `).run(orderId);
  return res.changes === 1;
}

// ── Subscriptions ─────────────────────────────────────────────────────────────
function createSubscription({ userId, orderId, plan, configLink, durationDays }) {
  const expiresAt = new Date(Date.now() + durationDays * 86400000).toISOString().slice(0, 10);
  db.prepare(`
    INSERT INTO subscriptions (user_id, order_id, plan, config_link, expires_at)
    VALUES (@userId, @orderId, @plan, @configLink, @expiresAt)
  `).run({ userId, orderId, plan, configLink, expiresAt });
}

function getUserSubscription(userId) {
  return db.prepare(`
    SELECT * FROM subscriptions
    WHERE user_id = ? AND is_active = 1
    ORDER BY id DESC LIMIT 1
  `).get(userId);
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function getStats() {
  return {
    totalUsers:    db.prepare("SELECT COUNT(*) AS c FROM users").get().c,
    totalOrders:   db.prepare("SELECT COUNT(*) AS c FROM orders").get().c,
    delivered:     db.prepare("SELECT COUNT(*) AS c FROM orders WHERE status='DELIVERED'").get().c,
    pending:       db.prepare("SELECT COUNT(*) AS c FROM orders WHERE status='WAITING_CONFIRMATION'").get().c,
    totalRevenue:  db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM orders WHERE status='DELIVERED'").get().s,
  };
}

module.exports = {
  STATUS,
  upsertUser, getUser, getAllUsers,
  createOrder, getOrderById, getOrderByAdminMsg, getOrderBySellerMsg,
  getUserActiveOrder, getUserLatestDelivered, getPendingOrders,
  updateOrderStatus, acquireProcessingLock,
  createSubscription, getUserSubscription,
  getStats,
};
