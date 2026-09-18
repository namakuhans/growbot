const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { renderSettingsPage } = require('../views/settingsView');

const DB_FILE = path.join(__dirname, '..', '..', '..', 'database.sqlite');
const BACKUPS_DIR = path.join(__dirname, '..', '..', '..', 'backups');
const RESTORE_FILE = path.join(__dirname, '..', '..', '..', 'database.restore.sqlite');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

function getDashboardPassword() {
  return process.env.DASHBOARD_PASSWORD || 'farkhands21';
}

function verifyPassword(inputPassword, storedPassword) {
  if (!storedPassword) return false;
  if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$')) {
    return bcrypt.compareSync(inputPassword, storedPassword);
  }
  return inputPassword === storedPassword;
}

router.get('/settings', (req, res) => {
  const msg = req.query.msg || '';
  const isError = req.query.error === '1';
  res.setHeader('Content-Type', 'text/html');
  res.send(renderSettingsPage(msg, isError));
});

router.post('/change-password', (req, res) => {
  const currentPass = req.body ? req.body.currentPassword : '';
  const newPass = req.body ? req.body.newPassword : '';
  const confirmPass = req.body ? req.body.confirmPassword : '';

  const expectedPassword = getDashboardPassword();

  if (!verifyPassword(currentPass, expectedPassword)) {
    return res.redirect('/settings?msg=Current+password+is+incorrect.&error=1');
  }

  if (!newPass || newPass !== confirmPass) {
    return res.redirect('/settings?msg=New+passwords+do+not+match.&error=1');
  }

  // Hash new password using bcrypt
  const hashedPassword = bcrypt.hashSync(newPass, 10);
  process.env.DASHBOARD_PASSWORD = hashedPassword;

  // Persist hashedPassword to .env
  try {
    const envPath = path.resolve(__dirname, '..', '..', '..', '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf-8');
      if (/^DASHBOARD_PASSWORD=/m.test(envContent)) {
        envContent = envContent.replace(/^DASHBOARD_PASSWORD=.*$/m, `DASHBOARD_PASSWORD=${hashedPassword}`);
      } else {
        envContent += `\nDASHBOARD_PASSWORD=${hashedPassword}\n`;
      }
      fs.writeFileSync(envPath, envContent, 'utf-8');
    }
  } catch (fileErr) {
    console.error('[SETTINGS ROUTE] Failed to persist password to .env:', fileErr.message);
  }

  return res.redirect('/settings?msg=Dashboard+password+updated+and+hashed+successfully!');
});

router.get('/download-db', (req, res) => {
  if (fs.existsSync(DB_FILE)) {
    const stat = fs.statSync(DB_FILE);
    res.writeHead(200, {
      'Content-Type': 'application/x-sqlite3',
      'Content-Length': stat.size,
      'Content-Disposition': 'attachment; filename="database.sqlite"'
    });
    const readStream = fs.createReadStream(DB_FILE);
    readStream.pipe(res);
  } else {
    res.status(404).send('Database file not found.');
  }
});

router.get('/download-backup', (req, res) => {
  try {
    const backup = fs.readdirSync(BACKUPS_DIR)
      .filter(file => file.startsWith('database_backup_') && file.endsWith('.sqlite'))
      .sort()
      .pop();

    if (!backup) return res.status(404).send('No database backup found.');
    res.download(path.join(BACKUPS_DIR, backup), backup);
  } catch (err) {
    res.status(500).send('Unable to download database backup.');
  }
});

router.post('/upload-backup', upload.single('backupFile'), (req, res) => {
  if (!req.file || !req.file.buffer || req.file.buffer.subarray(0, 16).toString() !== 'SQLite format 3\0') {
    return res.redirect('/settings?msg=Invalid+SQLite+backup+file.&error=1');
  }

  try {
    fs.writeFileSync(RESTORE_FILE, req.file.buffer);
    return res.redirect('/settings?msg=Backup+uploaded.+Restart+the+application+to+apply+it.');
  } catch (err) {
    return res.redirect('/settings?msg=Failed+to+save+backup+file.&error=1');
  }
});

module.exports = router;
