const crypto = require('crypto');

const activeSessions = new Map(); // token -> { ip, userAgentHash, createdAt, lastActive }
const failedAttemptsMap = new Map();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours max session age
const SESSION_INACTIVITY_MS = 2 * 60 * 60 * 1000; // 2 hours inactivity timeout

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createUserAgentHash(req) {
  const ua = req.headers['user-agent'] || '';
  return crypto.createHash('sha256').update(ua).digest('hex');
}

function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURIComponent(parts.join('='));
    });
  }
  return list;
}

function getClientIp(req) {
  const rawIp = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : (req.socket.remoteAddress || '127.0.0.1');
  return rawIp;
}

function createSession(req, token) {
  const ip = getClientIp(req);
  const userAgentHash = createUserAgentHash(req);
  const now = Date.now();
  activeSessions.set(token, {
    ip,
    userAgentHash,
    createdAt: now,
    lastActive: now
  });
}

function validateAndTouchSession(req, token) {
  const session = activeSessions.get(token);
  if (!session) return false;

  const now = Date.now();
  // Check session absolute age & inactivity timeout
  if (now - session.createdAt > SESSION_MAX_AGE_MS || now - session.lastActive > SESSION_INACTIVITY_MS) {
    activeSessions.delete(token);
    return false;
  }

  // Validate IP binding (skip strict User-Agent hash check so desktop/mobile view toggles remain logged in)
  const currentIp = getClientIp(req);

  if (session.ip !== currentIp) {
    activeSessions.delete(token);
    return false;
  }

  session.lastActive = now;
  return true;
}

function destroySession(token) {
  activeSessions.delete(token);
}

function isIpRateLimited(ip) {
  const record = failedAttemptsMap.get(ip);
  if (!record) return false;
  if (Date.now() - record.lastAttempt > LOCKOUT_DURATION_MS) {
    failedAttemptsMap.delete(ip);
    return false;
  }
  return record.count >= MAX_FAILED_ATTEMPTS;
}

function recordFailedAttempt(ip) {
  const record = failedAttemptsMap.get(ip) || { count: 0, lastAttempt: Date.now() };
  record.count += 1;
  record.lastAttempt = Date.now();
  failedAttemptsMap.set(ip, record);
}

function clearFailedAttempts(ip) {
  failedAttemptsMap.delete(ip);
}

module.exports = {
  activeSessions,
  generateSessionToken,
  createUserAgentHash,
  parseCookies,
  getClientIp,
  createSession,
  validateAndTouchSession,
  destroySession,
  isIpRateLimited,
  recordFailedAttempt,
  clearFailedAttempts
};
