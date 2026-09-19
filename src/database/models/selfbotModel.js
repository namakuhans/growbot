const { sqliteDb } = require('../connection');

function getSelfbots() {
  const rows = sqliteDb.prepare('SELECT token, thread_id as threadId, user_id as userId, display_name as displayName, updated_at as updatedAt, proxy, webhook_url as webhookUrl FROM selfbots').all();
  return rows || [];
}

function getSelfbotsByUser(userId) {
  const rows = sqliteDb.prepare('SELECT token, thread_id as threadId, user_id as userId, display_name as displayName, updated_at as updatedAt, proxy, webhook_url as webhookUrl FROM selfbots WHERE user_id = ?').all(userId);
  return rows || [];
}

function getSelfbotByToken(token) {
  const row = sqliteDb.prepare('SELECT token, thread_id as threadId, user_id as userId, display_name as displayName, updated_at as updatedAt, proxy, webhook_url as webhookUrl FROM selfbots WHERE token = ?').get(token);
  return row || null;
}

function addOrUpdateSelfbot(token, threadId, userId, displayName, proxy, webhookUrl) {
  const now = Date.now();
  // Inherit existing webhook_url for this user if not explicitly provided
  let effectiveWebhook = webhookUrl !== undefined ? webhookUrl : null;
  if (!effectiveWebhook) {
    const existing = getSelfbotsByUser(userId);
    const matchWithWebhook = existing.find(s => s.webhookUrl);
    if (matchWithWebhook) {
      effectiveWebhook = matchWithWebhook.webhookUrl;
    }
  }

  sqliteDb.prepare(`
    INSERT INTO selfbots (token, thread_id, user_id, display_name, updated_at, proxy, webhook_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(token) DO UPDATE SET
      thread_id = excluded.thread_id,
      user_id = excluded.user_id,
      display_name = excluded.display_name,
      updated_at = excluded.updated_at,
      proxy = COALESCE(excluded.proxy, selfbots.proxy),
      webhook_url = COALESCE(excluded.webhook_url, selfbots.webhook_url)
  `).run(token, threadId, userId, displayName, now, proxy || null, effectiveWebhook || null);
  return getSelfbotByToken(token);
}

function updateSelfbotThread(token, threadId) {
  const now = Date.now();
  const res = sqliteDb.prepare('UPDATE selfbots SET thread_id = ?, updated_at = ? WHERE token = ?').run(threadId, now, token);
  return res.changes > 0 ? getSelfbotByToken(token) : null;
}

function updateSelfbotProxy(token, proxy) {
  const now = Date.now();
  const res = sqliteDb.prepare('UPDATE selfbots SET proxy = ?, updated_at = ? WHERE token = ?').run(proxy || null, now, token);
  return res.changes > 0 ? getSelfbotByToken(token) : null;
}

function updateSelfbotWebhook(token, webhookUrl) {
  const now = Date.now();
  const res = sqliteDb.prepare('UPDATE selfbots SET webhook_url = ?, updated_at = ? WHERE token = ?').run(webhookUrl || null, now, token);
  return res.changes > 0 ? getSelfbotByToken(token) : null;
}

function updateUserSelfbotsWebhook(userId, webhookUrl) {
  const now = Date.now();
  const res = sqliteDb.prepare('UPDATE selfbots SET webhook_url = ?, updated_at = ? WHERE user_id = ?').run(webhookUrl || null, now, userId);
  return res.changes;
}

function removeSelfbot(token) {
  sqliteDb.prepare('DELETE FROM selfbots WHERE token = ?').run(token);
}

function resetSelfbotsTable() {
  sqliteDb.prepare('DELETE FROM selfbots').run();
}

module.exports = {
  getSelfbots,
  getSelfbotsByUser,
  getSelfbotByToken,
  addOrUpdateSelfbot,
  updateSelfbotThread,
  updateSelfbotProxy,
  updateSelfbotWebhook,
  updateUserSelfbotsWebhook,
  removeSelfbot,
  resetSelfbotsTable
};
