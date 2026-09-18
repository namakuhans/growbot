const MAX_LOGS = 500;
const logHistory = [];
const listeners = new Set();

function addLog(type, message) {
  const logEntry = {
    id: Date.now() + Math.random(),
    timestamp: new Date().toISOString(),
    type, // 'info' or 'error'
    message: String(message)
  };

  logHistory.push(logEntry);
  if (logHistory.length > MAX_LOGS) {
    logHistory.shift();
  }

  for (const listener of listeners) {
    try {
      listener(logEntry);
    } catch (e) {}
  }
}

// Intercept console.log and console.error
const originalLog = console.log;
const originalError = console.error;

console.log = function (...args) {
  originalLog.apply(console, args);
  addLog('info', args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' '));
};

console.error = function (...args) {
  originalError.apply(console, args);
  addLog('error', args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' '));
};

function getLogHistory() {
  return [...logHistory];
}

function subscribeLogs(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

module.exports = {
  getLogHistory,
  subscribeLogs
};
