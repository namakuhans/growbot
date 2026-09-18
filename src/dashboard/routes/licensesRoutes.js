const express = require('express');
const router = express.Router();
const db = require('../../database/db');
const { renderLicensesPage } = require('../views/licensesView');

async function resolveUserTag(discordClient, userId) {
  if (!userId) return 'N/A';
  if (userId === 'System' || userId === 'Admin') return `@${userId}`;
  if (!/^\d+$/.test(userId)) return userId.startsWith('@') ? userId : `@${userId}`;

  if (discordClient) {
    try {
      const u = await discordClient.users.fetch(userId);
      if (u) return `@${u.username}`;
    } catch (e) {}
  }
  return `@${userId}`;
}

router.get('/licenses', async (req, res) => {
  try {
    const discordClient = req.app.locals.discordClient;
    const html = await renderLicensesPage(discordClient);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('[EXPRESS ROUTE ERROR]', err.message);
    res.status(500).send('Error rendering licenses page');
  }
});

router.get('/api/licenses', async (req, res) => {
  try {
    const discordClient = req.app.locals.discordClient;
    const licensesMap = db.getLicenses();
    const licensesList = await Promise.all(Object.entries(licensesMap).map(async ([userId, lic]) => {
      const userTag = await resolveUserTag(discordClient, userId);
      const grantedByTag = await resolveUserTag(discordClient, lic.grantedBy || 'Admin');
      return {
        userId,
        userTag,
        grantedByTag,
        ...lic
      };
    }));
    res.json({ licenses: licensesList });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
