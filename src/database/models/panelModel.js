const { sqliteDb } = require('../connection');

function getPanel() {
  const row = sqliteDb.prepare('SELECT channel_id, message_id FROM panel WHERE id = 1').get();
  return { channelId: row ? row.channel_id : null, messageId: row ? row.message_id : null };
}

function setPanel(channelId, messageId) {
  sqliteDb.prepare('UPDATE panel SET channel_id = ?, message_id = ? WHERE id = 1').run(channelId, messageId);
}

module.exports = {
  getPanel,
  setPanel
};
