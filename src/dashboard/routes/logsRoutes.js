const express = require('express');
const router = express.Router();
const { getLogHistory, subscribeLogs } = require('../logBuffer');
const { renderLogsPage } = require('../views/logsView');

router.get('/logs', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(renderLogsPage(getLogHistory()));
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
