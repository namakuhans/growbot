const express = require('express');
const router = express.Router();
const db = require('../../database/db');
const { renderSelfbotsPage } = require('../views/selfbotsView');

router.get('/selfbots', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(renderSelfbotsPage());
});

router.get('/api/tokens', (req, res) => {
  try {
    const selfbots = db.getSelfbots();
    res.json({ selfbots });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
