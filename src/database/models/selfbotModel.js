const { sqliteDb } = require('../connection');

function getSelfbots() {
  const rows = sqliteDb.prepare('SELECT token, thread_id as threadId, user_id as userId, display_name as displayName, updated_at as updatedAt, proxy FROM selfbots').all();
  return rows || [];
}

function getSelfbotsByUser(userId) {
  const rows = sqliteDb.prepare('SELECT token, thread_id as threadId, user_id as userId, display_name as displayName, updated_at as updatedAt, proxy FROM selfbots WHERE user_id = ?').all(userId);
  return rows || [];
}

function getSelfbotByToken(token) {
  const row = sqliteDb.prepare('SELECT token, thread_id as threadId, user_id as userId, display_name as displayName, updated_at as updatedAt, proxy FROM selfbots WHERE token = ?').get(token);
  return row || null;
}

function addOrUpdateSelfbot(token, threadId, userId, displayName, proxy) {
  const now = Date.now();
  sqliteDb.prepare(`
    INSERT INTO selfbots (token, thread_id, user_id, display_name, updated_at, proxy)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(token) DO UPDATE SET
      thread_id = excluded.thread_id,
      user_id = excluded.user_id,
      display_name = excluded.display_name,
      updated_at = excluded.updated_at,
      proxy = COALESCE(excluded.proxy, selfbots.proxy)
  `).run(token, threadId, userId, displayName, now, proxy || null);
  return { token, threadId, userId, displayName, updatedAt: now, proxy: proxy || null };
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
  removeSelfbot,
  resetSelfbotsTable
};
