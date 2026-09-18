const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { renderSettingsPage } = require('../views/settingsView');

const DB_FILE = path.join(__dirname, '..', '..', '..', 'database.sqlite');

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

module.exports = router;
