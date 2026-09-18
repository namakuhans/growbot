const { startDashboardServer } = require('../dashboard/dashboardServer');

module.exports = {
  startDashboardServer: (client) => startDashboardServer(client)
};
