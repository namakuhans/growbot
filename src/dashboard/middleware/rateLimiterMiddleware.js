const { getClientIp, isIpRateLimited } = require('../services/authService');

function rateLimiterMiddleware(req, res, next) {
  const clientIp = getClientIp(req);
  if (isIpRateLimited(clientIp)) {
    const { renderLoginPage } = require('../views/loginView');
    res.setHeader('Content-Type', 'text/html');
    return res.status(429).send(renderLoginPage('Too many failed login attempts. Locked out for 15 minutes.'));
  }
  next();
}

module.exports = { rateLimiterMiddleware };
