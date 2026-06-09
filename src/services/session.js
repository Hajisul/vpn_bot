// src/services/session.js
// In-memory session store for user UI state.
// Telegraf's built-in session middleware persists within a process restart;
// for Railway we use the database for order state and this for ephemeral UI state.

const sessions = new Map();

const DEFAULT = () => ({
  step: "idle",         // idle | awaiting_receipt
  pendingOrderId: null, // current order being processed
});

function get(userId) {
  if (!sessions.has(userId)) sessions.set(userId, DEFAULT());
  return sessions.get(userId);
}

function set(userId, partial) {
  const current = get(userId);
  sessions.set(userId, { ...current, ...partial });
}

function reset(userId) {
  sessions.set(userId, DEFAULT());
}

module.exports = { get, set, reset };
