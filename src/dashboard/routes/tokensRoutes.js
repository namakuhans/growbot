const express = require('express');
const router = express.Router();
const db = require('../../database/db');
const { renderSelfbotsPage } = require('../views/selfbotsView');

async function getSelfbotsWithOwnerNames(discordClient) {
  const selfbots = db.getSelfbots();

  return Promise.all(selfbots.map(async (selfbot) => {
    const cachedUser = discordClient?.users.cache.get(selfbot.userId);
    const owner = cachedUser || await discordClient?.users.fetch(selfbot.userId).catch(() => null);

    return {
      ...selfbot,
      ownerUsername: owner?.username || 'Unknown Owner'
    };
  }));
}

router.get('/selfbots', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  getSelfbotsWithOwnerNames(req.app.locals.discordClient)
    .then(selfbots => res.send(renderSelfbotsPage(selfbots)))
    .catch(() => res.send(renderSelfbotsPage(db.getSelfbots())));
});

router.get('/api/tokens', async (req, res) => {
  try {
    const selfbots = await getSelfbotsWithOwnerNames(req.app.locals.discordClient);
    res.json({ selfbots });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
