const { sqliteDb } = require('../connection');

function getSelfbots() {
  const rows = sqliteDb.prepare('SELECT token, thread_id as threadId, user_id as userId, display_name as displayName, updated_at as updatedAt FROM selfbots').all();
  return rows || [];
}

function getSelfbotsByUser(userId) {
  const rows = sqliteDb.prepare('SELECT token, thread_id as threadId, user_id as userId, display_name as displayName, updated_at as updatedAt FROM selfbots WHERE user_id = ?').all(userId);
  return rows || [];
}

function getSelfbotByToken(token) {
  const row = sqliteDb.prepare('SELECT token, thread_id as threadId, user_id as userId, display_name as displayName, updated_at as updatedAt FROM selfbots WHERE token = ?').get(token);
  return row || null;
}

function addOrUpdateSelfbot(token, threadId, userId, displayName) {
  const now = Date.now();
  sqliteDb.prepare(`
    INSERT INTO selfbots (token, thread_id, user_id, display_name, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(token) DO UPDATE SET
      thread_id = excluded.thread_id,
      user_id = excluded.user_id,
      display_name = excluded.display_name,
      updated_at = excluded.updated_at
  `).run(token, threadId, userId, displayName, now);
  return { token, threadId, userId, displayName, updatedAt: now };
}

function updateSelfbotThread(token, threadId) {
  const now = Date.now();
  const res = sqliteDb.prepare('UPDATE selfbots SET thread_id = ?, updated_at = ? WHERE token = ?').run(threadId, now, token);
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
  removeSelfbot,
  resetSelfbotsTable
};
