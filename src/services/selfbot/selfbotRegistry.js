const { clearProfileTimer, clearAllProfileTimers } = require('./profileScheduler');

const activeSelfbots = new Map();

/**
 * Stops a specific active selfbot client by its token.
 *
 * @param {string} token
 */
function stopSelfbot(token) {
  clearProfileTimer(token);
  if (activeSelfbots.has(token)) {
    const sbClient = activeSelfbots.get(token);
    if (sbClient && sbClient._autoBuyInterval) {
      clearInterval(sbClient._autoBuyInterval);
    }
    try {
      sbClient.destroy();
    } catch (e) {}
    activeSelfbots.delete(token);
  }
}

/**
 * Stops all running selfbot clients and clears intervals/timers.
 */
function stopAllSelfbots() {
  clearAllProfileTimers();

  for (const [token, sbClient] of activeSelfbots.entries()) {
    if (sbClient && sbClient._autoBuyInterval) {
      clearInterval(sbClient._autoBuyInterval);
    }
    try {
      sbClient.destroy();
    } catch (e) {}
  }
  activeSelfbots.clear();
}

/**
 * Validates if the thread channel still exists and is accessible by the selfbot.
 *
 * @param {string} token
 * @param {string} threadId
 * @returns {Promise<boolean>}
 */
async function isSelfbotThreadValid(token, threadId) {
  const selfClient = activeSelfbots.get(token);
  if (!selfClient || !selfClient.isReady()) return false;

  try {
    const channel = await selfClient.channels.fetch(threadId).catch(() => null);
    if (!channel) return false;
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  activeSelfbots,
  stopSelfbot,
  stopAllSelfbots,
  isSelfbotThreadValid
};
