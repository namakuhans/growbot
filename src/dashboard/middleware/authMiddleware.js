const { validateAndTouchSession, parseCookies } = require('../services/authService');

function verifyCsrfOrigin(req) {
  // Only check state-changing HTTP methods
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const origin = req.headers['origin'];
    const referer = req.headers['referer'];
    const host = req.headers['host'];

    if (!host) return false;

    if (origin) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) return false;
      } catch (e) {
        return false;
      }
    } else if (referer) {
      try {
        const refererHost = new URL(referer).host;
        if (refererHost !== host) return false;
      } catch (e) {
        return false;
      }
    }
  }
  return true;
}

function authMiddleware(req, res, next) {
  const cookies = parseCookies(req);
  const sessionToken = cookies.growcord_session;

  if (sessionToken && validateAndTouchSession(req, sessionToken)) {
    if (!verifyCsrfOrigin(req)) {
      return res.status(403).json({ error: 'CSRF security check failed' });
    }
    req.isAuthenticated = true;
    return next();
  }

  req.isAuthenticated = false;
  if (req.path === '/login' || req.path === '/favicon.ico') {
    return next();
  }

  // Redirect unauthenticated requests to login view or render login page
  if (req.method === 'GET') {
    const { renderLoginPage } = require('../views/loginView');
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(renderLoginPage());
  }

  return res.status(401).json({ error: 'Unauthorized session' });
}

module.exports = { authMiddleware };
