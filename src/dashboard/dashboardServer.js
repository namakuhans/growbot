const express = require('express');
const path = require('path');
const { securityHeadersMiddleware } = require('./middleware/securityHeadersMiddleware');
const { rateLimiterMiddleware } = require('./middleware/rateLimiterMiddleware');
const { authMiddleware } = require('./middleware/authMiddleware');

const authRoutes = require('./routes/authRoutes');
const overviewRoutes = require('./routes/overviewRoutes');
const tokensRoutes = require('./routes/tokensRoutes');
const licensesRoutes = require('./routes/licensesRoutes');
const logsRoutes = require('./routes/logsRoutes');
const settingsRoutes = require('./routes/settingsRoutes');

const PORT = parseInt(process.env.DASHBOARD_PORT || '3000', 10);
const HOST = process.env.DASHBOARD_HOST || '0.0.0.0';

function startDashboardServer(discordClient) {
  const app = express();

  if (discordClient) {
    app.locals.discordClient = discordClient;
  }

  // Serve compiled static assets from public directory
  app.use(express.static(path.join(__dirname, 'public')));

  // Express middleware setup
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(securityHeadersMiddleware);
  app.use(rateLimiterMiddleware);
  app.use(authMiddleware);

  // Mount modular routes
  app.use('/', authRoutes);
  app.use('/', overviewRoutes);
  app.use('/', tokensRoutes);
  app.use('/', licensesRoutes);
  app.use('/', logsRoutes);
  app.use('/', settingsRoutes);

  const server = app.listen(PORT, HOST, () => {
    console.log(`[DASHBOARD EXPRESS] Modular web management hub listening on http://${HOST}:${PORT}`);
  });

  return server;
}

module.exports = { startDashboardServer };
