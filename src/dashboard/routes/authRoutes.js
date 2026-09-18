const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const {
  generateSessionToken,
  getClientIp,
  createSession,
  destroySession,
  isIpRateLimited,
  recordFailedAttempt,
  clearFailedAttempts,
  parseCookies
} = require('../services/authService');
const { renderLoginPage } = require('../views/loginView');

function getDashboardPassword() {
  return process.env.DASHBOARD_PASSWORD || 'farkhands21';
}

function verifyPassword(inputPassword, storedPassword) {
  if (!storedPassword || !inputPassword) return false;

  // Support both bcrypt hashed password and plain-text fallback
  if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$')) {
    return bcrypt.compareSync(inputPassword, storedPassword);
  }

  // Timing-safe comparison for plain text passwords
  try {
    const inputBuf = Buffer.from(inputPassword, 'utf8');
    const storedBuf = Buffer.from(storedPassword, 'utf8');

    if (inputBuf.length !== storedBuf.length) {
      // Perform a dummy timing comparison to mitigate timing attacks
      crypto.timingSafeEqual(inputBuf, inputBuf);
      return false;
    }

    return crypto.timingSafeEqual(inputBuf, storedBuf);
  } catch (e) {
    return false;
  }
}

router.get('/login', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(renderLoginPage());
});

router.post('/login', (req, res) => {
  const clientIp = getClientIp(req);

  if (isIpRateLimited(clientIp)) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(429).send(renderLoginPage('Too many failed login attempts. Please try again after 15 minutes.'));
  }

  const pass = req.body ? req.body.password : '';
  const expectedPassword = getDashboardPassword();

  if (expectedPassword && pass && verifyPassword(pass, expectedPassword)) {
    clearFailedAttempts(clientIp);
    const newToken = generateSessionToken();
    createSession(req, newToken);

    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    const cookieFlags = [
      `growcord_session=${newToken}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Strict',
      'Max-Age=86400' // 24 hours
    ];
    if (isSecure) cookieFlags.push('Secure');

    res.setHeader('Set-Cookie', cookieFlags.join('; '));
    return res.redirect('/');
  } else {
    recordFailedAttempt(clientIp);
    res.setHeader('Content-Type', 'text/html');
    return res.status(401).send(renderLoginPage('Incorrect security password. Please try again.'));
  }
});

router.get('/logout', (req, res) => {
  const cookies = parseCookies(req);
  if (cookies.growcord_session) {
    destroySession(cookies.growcord_session);
  }
  res.setHeader('Set-Cookie', 'growcord_session=; Path=/; HttpOnly; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  res.redirect('/');
});

module.exports = router;
