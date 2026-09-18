const db = require('../../database/db');
const { GAMEBOT_ID } = require('../../config/constants');

const profileTimers = new Map();

function getProfileIntervalDelay() {
  return (13 + Math.random() * 7) * 60 * 1000; // Dynamic 13 - 20 minutes
}

// Schedule automated /profile command with typing simulation
function scheduleProfileCommand(selfClient, token, targetThreadId, activeSelfbots) {
  const delay = getProfileIntervalDelay();
  console.log(`[SELFBOT PROFILE TIMER] ${selfClient.user?.tag || 'Selfbot'} next /profile scheduled in ${(delay / 60000).toFixed(2)} minutes.`);

  const timer = setTimeout(async () => {
    try {
      const currentSbData = db.getSelfbotByToken(token);
      const activeThreadId = currentSbData ? currentSbData.threadId : targetThreadId;
      const channel = await selfClient.channels.fetch(activeThreadId).catch(() => null);

      if (channel) {
        console.log(`[SELFBOT PROFILE] ${selfClient.user.tag} typing before sending /profile...`);
        await channel.sendTyping().catch(() => null);

        // Human-like typing delay (2-5 seconds) before sending slash command
        const typingDuration = 2000 + Math.floor(Math.random() * 3000);
        await new Promise(resolve => setTimeout(resolve, typingDuration));

        await channel.sendSlash(GAMEBOT_ID, 'profile').catch(err => {
          console.error(`[SELFBOT PROFILE SLASH ERROR] ${selfClient.user.tag}:`, err.message || err);
        });
        console.log(`[SELFBOT PROFILE] ${selfClient.user.tag} successfully sent /profile to Gamebot in thread ${activeThreadId}`);
      }
    } catch (err) {
      console.error(`[SELFBOT PROFILE ERROR] ${selfClient.user?.tag}:`, err.message || err);
    } finally {
      // Schedule next execution recursively
      if (activeSelfbots.has(token)) {
        scheduleProfileCommand(selfClient, token, targetThreadId, activeSelfbots);
      }
    }
  }, delay);

  profileTimers.set(token, timer);
}

function clearProfileTimer(token) {
  if (profileTimers.has(token)) {
    clearTimeout(profileTimers.get(token));
    profileTimers.delete(token);
  }
}

function clearAllProfileTimers() {
  for (const [token, timer] of profileTimers.entries()) {
    clearTimeout(timer);
  }
  profileTimers.clear();
}

module.exports = {
  profileTimers,
  scheduleProfileCommand,
  clearProfileTimer,
  clearAllProfileTimers
};
