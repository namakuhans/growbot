/**
 * Tracks auto-buy state and cooldowns per selfbot user ID or client key.
 */

const stateMap = new Map();

/**
 * Returns true if auto-buy is currently active or on cooldown for the given key.
 * Auto-clears stale "active" states older than 60 seconds.
 *
 * @param {string|Object} keyOrClient
 * @returns {boolean}
 */
function isAutoBuying(keyOrClient) {
  if (!keyOrClient) return false;
  const key = typeof keyOrClient === 'string' ? keyOrClient : (keyOrClient.user?.id || keyOrClient.token || 'default');
  const val = stateMap.get(key);
  if (!val) return false;

  if (typeof val === 'number') {
    if (Date.now() < val) return true;
    stateMap.delete(key);
    return false;
  }

  if (typeof val === 'object' && val.active) {
    if (Date.now() - val.startTime > 60000) {
      console.warn(`[SELFBOT AUTO-BUY SAFETY RESET] Execution exceeded 60s for client ${key}. Resetting state.`);
      stateMap.delete(key);
      return false;
    }
    return true;
  }

  return false;
}

module.exports = {
  stateMap,
  isAutoBuying
};
