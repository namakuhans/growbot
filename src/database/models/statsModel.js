const { sqliteDb } = require('../connection');

function getStats() {
  const row = sqliteDb.prepare('SELECT total_resolved, last_resolve FROM stats WHERE id = 1').get();
  return { totalResolved: row ? row.total_resolved : 0, lastResolve: row ? row.last_resolve : null };
}

function incrementResolved() {
  const lastResolve = Math.floor(Date.now() / 1000);
  sqliteDb.prepare('UPDATE stats SET total_resolved = total_resolved + 1, last_resolve = ? WHERE id = 1').run(lastResolve);
  return getStats();
}

module.exports = {
  getStats,
  incrementResolved
};
