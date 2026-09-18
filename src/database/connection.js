const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_FILE = path.join(__dirname, '..', '..', 'database.sqlite');
const BACKUPS_DIR = path.join(__dirname, '..', '..', 'backups');

const sqliteDb = new DatabaseSync(DB_FILE);

// Enable WAL mode
try {
  sqliteDb.exec('PRAGMA journal_mode = WAL;');
} catch (e) {}

// Initialize SQLite Schema
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS panel (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    channel_id TEXT,
    message_id TEXT
  );

  CREATE TABLE IF NOT EXISTS stats (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    total_resolved INTEGER DEFAULT 0,
    last_resolve INTEGER
  );

  CREATE TABLE IF NOT EXISTS user_dm_panels (
    user_id TEXT PRIMARY KEY,
    channel_id TEXT,
    message_id TEXT
  );

  CREATE TABLE IF NOT EXISTS licenses (
    user_id TEXT PRIMARY KEY,
    expires_at INTEGER,
    granted_at INTEGER,
    granted_by TEXT,
    duration_days INTEGER
  );

  CREATE TABLE IF NOT EXISTS selfbots (
    token TEXT PRIMARY KEY,
    thread_id TEXT,
    user_id TEXT,
    display_name TEXT,
    updated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS whitelisted_users (
    user_id TEXT PRIMARY KEY,
    added_at INTEGER,
    added_by TEXT
  );
`);

sqliteDb.prepare(`INSERT OR IGNORE INTO panel (id, channel_id, message_id) VALUES (1, NULL, NULL)`).run();
sqliteDb.prepare(`INSERT OR IGNORE INTO stats (id, total_resolved, last_resolve) VALUES (1, 0, NULL)`).run();

// Schema migrations — idempotent, safe to run on every startup
try { sqliteDb.exec('ALTER TABLE selfbots ADD COLUMN proxy TEXT'); } catch (e) { /* column already exists */ }

console.log('[DATABASE] Strictly using native node:sqlite (DatabaseSync) storage driver.');



// 12-Hour Automated SQLite Backup Function (Retaining ONLY the single latest backup)
async function performBackup() {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }

    // Clean up all old backup files in backups directory before creating the new one
    const files = fs.readdirSync(BACKUPS_DIR);
    for (const file of files) {
      if (file.startsWith('database_backup_') && file.endsWith('.sqlite')) {
        const filePath = path.join(BACKUPS_DIR, file);
        try {
          fs.unlinkSync(filePath);
          console.log(`[DATABASE BACKUP] Deleted older backup: ${file}`);
        } catch (e) {}
      }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUPS_DIR, `database_backup_${timestamp}.sqlite`);

    // Flush WAL changes to main DB file before copying
    try {
      sqliteDb.exec('PRAGMA wal_checkpoint(PASSIVE);');
    } catch (e) {}

    // Copy main DB file
    fs.copyFileSync(DB_FILE, backupFile);
    console.log(`[DATABASE BACKUP] Created latest 12h recovery backup: ${backupFile}`);
  } catch (err) {
    console.error('[DATABASE BACKUP ERROR]', err.message);
  }
}

// Schedule automated backups every 12 hours (12 * 60 * 60 * 1000 ms)
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const backupTimer = setInterval(performBackup, TWELVE_HOURS_MS);
if (backupTimer.unref) backupTimer.unref();

// Perform initial backup on startup
performBackup();

async function ensureDb() {
  return true;
}

module.exports = {
  sqliteDb,
  performBackup,
  ensureDb
};
