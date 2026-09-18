const db = require('../../database/db');
const { GAMEBOT_ID } = require('../../config/constants');
const { parseFarmableInfo, findButton, extractButtons, getHumanDelay } = require('./parsers');
const { executeAutoBuyFlow } = require('./autoBuy');

async function performThreadStartupCheck(selfClient, targetThreadId, mainClient) {
  try {
    const channel = targetThreadId ? await selfClient.channels.fetch(targetThreadId).catch(() => null) : null;
    if (!channel) {
      console.warn(`[SELFBOT STARTUP CHECK] ${selfClient.user?.tag || 'Selfbot'}: Thread <#${targetThreadId}> unavailable or empty. Triggering auto-recovery...`);
      const { triggerThreadAutoRecovery } = require('./autoRecovery');
      const allSelfbots = db.getSelfbots() || [];
      const sbData = allSelfbots.find(s => s.threadId === targetThreadId) || db.getSelfbotByToken(selfClient.token);
      const token = sbData ? sbData.token : (selfClient.token || '');
      const userId = sbData ? sbData.userId : '';
      const { activeSelfbots } = require('../selfbotService');
      triggerThreadAutoRecovery(selfClient, token, userId, mainClient, activeSelfbots, performThreadStartupCheck).catch(() => null);
      return;
    }

    let gamebotMsg = null;
    let farmableInfo = null;
    let attempts = 0;
    const maxAttempts = 5;

    // Polling loop: keep polling until a Gamebot message containing valid farmableInfo is found
    while (!farmableInfo && attempts < maxAttempts) {
      attempts++;
      console.log(`[SELFBOT STARTUP CHECK] ${selfClient.user?.tag || 'Selfbot'}: Polling thread <#${targetThreadId}> for Gamebot message with Farmable Info (Attempt ${attempts}/${maxAttempts})...`);

      const messages = await channel.messages.fetch({ limit: 15 }).catch(() => null);
      if (messages && messages.size > 0) {
        const gamebotMsgs = messages.filter(m => m.author && m.author.id === GAMEBOT_ID);
        if (gamebotMsgs.size > 0) {
          for (const msg of gamebotMsgs.values()) {
            const parsed = parseFarmableInfo(msg);
            if (parsed) {
              gamebotMsg = msg;
              farmableInfo = parsed;
              break;
            }
          }
          if (!gamebotMsg) {
            gamebotMsg = gamebotMsgs.first();
          }
        }
      }

      if (!farmableInfo && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Case A: No Gamebot message found in thread at all! Trigger Thread Auto Recovery!
    if (!gamebotMsg) {
      console.warn(`[SELFBOT STARTUP CHECK] ${selfClient.user?.tag || 'Selfbot'}: No Gamebot message found in thread <#${targetThreadId}> after ${maxAttempts} attempts. Triggering Thread Auto Recovery...`);
      const { triggerThreadAutoRecovery } = require('./autoRecovery');
      const allSelfbots = db.getSelfbots() || [];
      const sbData = allSelfbots.find(s => s.threadId === targetThreadId) || db.getSelfbotByToken(selfClient.token);
      const token = sbData ? sbData.token : (selfClient.token || '');
      const userId = sbData ? sbData.userId : '';
      const { activeSelfbots } = require('../selfbotService');
      triggerThreadAutoRecovery(selfClient, token, userId, mainClient, activeSelfbots, performThreadStartupCheck).catch(() => null);
      return;
    }

    // Case B: Gamebot message found, but farmableInfo is null (e.g. menu is stuck/outdated)
    if (!farmableInfo && gamebotMsg) {
      console.warn(`[SELFBOT STARTUP CHECK] ${selfClient.user?.tag || 'Selfbot'}: Could not parse Farmable Info from message in thread <#${targetThreadId}>. Clicking button to refresh status...`);

      const { toggleAutoFarmButton, farmButton } = extractButtons(gamebotMsg);
      const profileBtn = findButton(gamebotMsg, ['profile']);
      const changeBtn = findButton(gamebotMsg, ['change']);
      const backBtn = findButton(gamebotMsg, ['back']);

      let clickedBtn = null;

      if (toggleAutoFarmButton && !toggleAutoFarmButton.disabled) {
        clickedBtn = toggleAutoFarmButton;
      } else if (farmButton && !farmButton.disabled) {
        clickedBtn = farmButton;
      } else if (profileBtn && !profileBtn.disabled) {
        clickedBtn = profileBtn;
      } else if (changeBtn && !changeBtn.disabled) {
        clickedBtn = changeBtn;
      } else if (backBtn && !backBtn.disabled) {
        clickedBtn = backBtn;
      } else if (gamebotMsg.components && gamebotMsg.components[0]?.components[0]) {
        const first = gamebotMsg.components[0].components[0];
        if (!first.disabled) clickedBtn = first;
      }

      if (clickedBtn) {
        await new Promise(resolve => setTimeout(resolve, getHumanDelay()));
        await gamebotMsg.clickButton(clickedBtn.customId || clickedBtn.id).catch(() => null);
        console.log(`[SELFBOT STARTUP CHECK] ${selfClient.user?.tag || 'Selfbot'}: Clicked '${clickedBtn.label || clickedBtn.customId}' button to refresh Gamebot status panel.`);
      }

      console.log(`[SELFBOT STARTUP CHECK] ${selfClient.user?.tag || 'Selfbot'}: Re-checking thread <#${targetThreadId}> in 4 seconds...`);
      setTimeout(() => performThreadStartupCheck(selfClient, targetThreadId, mainClient).catch(() => null), 4000);
      return;
    }

    console.log(`[SELFBOT STARTUP] ${selfClient.user?.tag || 'Selfbot'} Farmable Info:`, farmableInfo);

    const contentLower = (gamebotMsg.content || '').toLowerCase();
    const selfUserId = selfClient.user?.id;
    const mentionsSelf = selfUserId && gamebotMsg.content && (gamebotMsg.content.includes(`<@${selfUserId}>`) || gamebotMsg.content.includes(`<@!${selfUserId}>`));
    const hasAfkText = contentLower.includes('are you still there') || contentLower.includes('afk verification') || contentLower.includes('afk check');
    const { keepFarmingButton, toggleAutoFarmButton, farmButton } = extractButtons(gamebotMsg);

    const isAfkPrompt = (hasAfkText || keepFarmingButton !== null) && (mentionsSelf || hasAfkText || keepFarmingButton !== null);

    // 1. If AFK prompt exists on startup, resolve it
    if (isAfkPrompt) {
      await new Promise(resolve => setTimeout(resolve, getHumanDelay()));
      let clicked = false;
      if (keepFarmingButton && !keepFarmingButton.disabled) {
        const res = await gamebotMsg.clickButton(keepFarmingButton.customId || keepFarmingButton.id).catch(() => null);
        if (res !== null) clicked = true;
      } else if (gamebotMsg.components && gamebotMsg.components[0]?.components[0]) {
        const firstBtn = gamebotMsg.components[0].components[0];
        if (!firstBtn.disabled) {
          const res = await gamebotMsg.clickButton(firstBtn.customId || firstBtn.id).catch(() => null);
          if (res !== null) clicked = true;
        }
      }

      if (clicked) {
        console.log(`[SELFBOT STARTUP] ${selfClient.user?.tag || 'Selfbot'} resolved AFK prompt in thread ${targetThreadId}`);
        db.incrementResolved();
        if (mainClient) {
          try {
            const { updateActivePanel, updateMainBotRPC } = require('../panelService');
            updateActivePanel(mainClient);
            updateMainBotRPC(mainClient);
          } catch (e) {}
        }
      }
    } else {
      // 2. Check blocks count for auto-buy
      if (farmableInfo && typeof farmableInfo.blockCount === 'number' && farmableInfo.blockCount < 100) {
        await executeAutoBuyFlow(selfClient, channel, gamebotMsg, farmableInfo).catch(() => null);
      } else {
        // Standard initial farm check on startup/redeploy
        const isToggleRed = toggleAutoFarmButton && (toggleAutoFarmButton.style === 4 || toggleAutoFarmButton.style === 'DANGER' || toggleAutoFarmButton.style === 'Danger');
        const isFarmDisabled = farmButton && (farmButton.disabled === true || farmButton.disabled === 'true');

        if (isToggleRed && isFarmDisabled) {
          console.log(`[SELFBOT STARTUP] ${selfClient.user?.tag || 'Selfbot'} skipped clicking 'Toggle Auto Farm' & 'Farm' (Toggle is RED and Farm is DISABLED).`);
        } else {
          const isToggleGreen = toggleAutoFarmButton && (toggleAutoFarmButton.style === 3 || toggleAutoFarmButton.style === 'SUCCESS' || toggleAutoFarmButton.style === 'Success');
          const isFarmEnabled = farmButton && !farmButton.disabled;

          if (isToggleGreen && isFarmEnabled) {
            // Click 'Toggle Auto Farm' first
            await new Promise(resolve => setTimeout(resolve, getHumanDelay()));
            await gamebotMsg.clickButton(toggleAutoFarmButton.customId || toggleAutoFarmButton.id).catch(() => null);
            console.log(`[SELFBOT STARTUP] ${selfClient.user?.tag || 'Selfbot'} clicked 'Toggle Auto Farm' (GREEN) button in thread ${targetThreadId}`);

            // Click 'Farm' second
            await new Promise(resolve => setTimeout(resolve, getHumanDelay()));
            await gamebotMsg.clickButton(farmButton.customId || farmButton.id).catch(() => null);
            console.log(`[SELFBOT STARTUP] ${selfClient.user?.tag || 'Selfbot'} clicked 'Farm' (ENABLED) button in thread ${targetThreadId}`);
          } else {
            if (toggleAutoFarmButton && !toggleAutoFarmButton.disabled && !isToggleRed) {
              await new Promise(resolve => setTimeout(resolve, getHumanDelay()));
              await gamebotMsg.clickButton(toggleAutoFarmButton.customId || toggleAutoFarmButton.id).catch(() => null);
              console.log(`[SELFBOT STARTUP] ${selfClient.user?.tag || 'Selfbot'} clicked 'Toggle Auto Farm' button in thread ${targetThreadId}`);
            }
            if (farmButton && !farmButton.disabled) {
              await new Promise(resolve => setTimeout(resolve, getHumanDelay()));
              await gamebotMsg.clickButton(farmButton.customId || farmButton.id).catch(() => null);
              console.log(`[SELFBOT STARTUP] ${selfClient.user?.tag || 'Selfbot'} clicked 'Farm' button in thread ${targetThreadId}`);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error(`[SELFBOT STARTUP CHECK ERROR] ${selfClient.user?.tag || 'Selfbot'}:`, err);
    setTimeout(() => performThreadStartupCheck(selfClient, targetThreadId, mainClient).catch(() => null), 10000);
  }
}

module.exports = {
  performThreadStartupCheck
};
