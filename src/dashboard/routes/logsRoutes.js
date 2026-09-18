const express = require('express');
const router = express.Router();
const { getLogHistory, subscribeLogs } = require('../logBuffer');
const { renderLogsPage } = require('../views/logsView');
const db = require('../../database/db');

function getSelfbotTokenMap() {
  return Object.fromEntries(
    db.getSelfbots()
      .filter(selfbot => selfbot.token && selfbot.displayName)
      .map(selfbot => [selfbot.token.substring(0, 10), selfbot.displayName])
  );
}

router.get('/logs', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(renderLogsPage(getLogHistory(), getSelfbotTokenMap()));
});

router.get('/api/logs', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const unsubscribe = subscribeLogs(logEntry => {
    res.write(`data: ${JSON.stringify(logEntry)}\n\n`);
  });

  req.on('close', () => {
    unsubscribe();
  });
});

module.exports = router;
