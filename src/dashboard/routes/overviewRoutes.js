const express = require('express');
const router = express.Router();
const db = require('../../database/db');
const { renderDashboardPage } = require('../views/dashboardView');
const { isUserRolePermanent } = require('../../services/roleLicenseService');

router.get('/', async (req, res) => {
  try {
    const discordClient = req.app.locals.discordClient;
    const html = await renderDashboardPage(discordClient);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('[EXPRESS ROUTE ERROR]', err.message);
    res.status(500).send('Error rendering overview dashboard page');
  }
});

router.get('/api/overview', async (req, res) => {
  try {
    const discordClient = req.app.locals.discordClient;
    const stats = db.getStats();
    const selfbots = db.getSelfbots();
    const userDmPanelsMap = db.getUserDmPanels();
    const licensesMap = db.getLicenses();

    const allUserIdsSet = new Set();
    selfbots.forEach(sb => { if (sb.userId) allUserIdsSet.add(sb.userId); });
    Object.keys(userDmPanelsMap).forEach(uid => allUserIdsSet.add(uid));
    Object.keys(licensesMap).forEach(uid => allUserIdsSet.add(uid));

    const activeSelfbotOwnersSet = new Set();
    selfbots.forEach(sb => { if (sb.userId) activeSelfbotOwnersSet.add(sb.userId); });

    const userOwnersList = await Promise.all(Array.from(allUserIdsSet).map(async (userId) => {
      let username = `@${userId}`;
      if (discordClient) {
        try {
          const userObj = await discordClient.users.fetch(userId);
          if (userObj) {
            username = `@${userObj.username}`;
          }
        } catch (err) {}
      }

      const userSelfbots = selfbots.filter(s => s.userId === userId);
      const license = licensesMap[userId];
      const isPermanent = await isUserRolePermanent(discordClient, userId, license);
      const hasDmPanel = !!userDmPanelsMap[userId];

      let licenseStatusText = 'None';
      let licenseStatusType = 'inactive';
      if (isPermanent) {
        licenseStatusText = 'Permanent';
        licenseStatusType = 'active';
      } else if (license) {
        if (license.expiresAt && license.expiresAt > Date.now()) {
          licenseStatusText = `Active (${license.durationDays}d)`;
          licenseStatusType = 'active';
        } else {
          licenseStatusText = 'Expired';
          licenseStatusType = 'expired';
        }
      }

      return {
        userId,
        username,
        selfbotCount: userSelfbots.length,
        licenseStatusText,
        licenseStatusType,
        hasDmPanel
      };
    }));

    res.json({
      totalAllUsersCount: allUserIdsSet.size,
      activeSelfbotOwnersCount: activeSelfbotOwnersSet.size,
      totalSelfbotsCount: selfbots.length,
      totalResolvedCount: stats.totalResolved || 0,
      totalLicensesCount: Object.keys(licensesMap).length,
      totalUserDmPanelsCount: Object.keys(userDmPanelsMap).length,
      userOwnersList
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
