const { SnowflakeUtil } = require('discord.js-selfbot-v13');
const { GAMEBOT_ID } = require('../../config/constants');
const { parseGemsInfo, findButton, extractButtons, getHumanDelay } = require('./parsers');

// Helper to click a lock buy button and submit calculated amount in modal instantly
async function clickLockBuyAndSubmitModal(selfClient, msg, buttonCustomId, amountStr) {
  return new Promise(async (resolve) => {
    let resolved = false;

    const cleanup = () => {
      if (selfClient.ws) selfClient.ws.removeListener('raw', rawHandler);
      selfClient.removeListener('interactionModalCreate', modalHandler);
    };

    const finish = (success) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(success);
      }
    };

    // Helper to submit raw modal interaction payload
    const handleModalPayload = async (modalData) => {
      try {
        console.log(`[SELFBOT MODAL] Intercepted modal '${modalData.id}'. Submitting amount: ${amountStr}`);

        const submitComponents = [];
        if (modalData.data && modalData.data.components) {
          for (const row of modalData.data.components) {
            if (row.components) {
              for (const comp of row.components) {
                submitComponents.push({
                  type: 1, // ACTION_ROW
                  components: [{
                    type: 4, // TEXT_INPUT
                    custom_id: comp.custom_id,
                    value: amountStr
                  }]
                });
              }
            }
          }
        }

        const nonce = SnowflakeUtil.generate();
        const responseData = {
          type: 5, // MODAL_SUBMIT
          nonce,
          guild_id: msg.guildId,
          channel_id: msg.channelId,
          application_id: msg.applicationId ?? GAMEBOT_ID,
          session_id: selfClient.sessionId,
          data: {
            id: modalData.data?.id || modalData.id,
            custom_id: modalData.data?.custom_id,
            components: submitComponents
          }
        };

        await selfClient.api.interactions.post({ data: responseData }).catch(e => console.error('[SELFBOT MODAL POST ERROR]', e.message));
        finish(true);
      } catch (mErr) {
        console.error('[SELFBOT MODAL SUBMIT ERROR]', mErr.message);
        finish(false);
      }
    };

    // 1. High-level client listener for Modal instances from discord.js-selfbot-v13
    const modalHandler = async (modal) => {
      if (!resolved && modal) {
        try {
          console.log(`[SELFBOT MODAL DIRECT] Received Modal instance. Submitting amount: ${amountStr}`);
          for (const row of (modal.components || [])) {
            if (row.components && row.components[0]) {
              const comp = row.components[0];
              if (typeof comp.setValue === 'function') {
                comp.setValue(amountStr);
              } else {
                comp.value = amountStr;
              }
            }
          }
          await modal.reply().catch(e => console.error('[SELFBOT MODAL REPLY ERROR]', e.message));
          finish(true);
        } catch (mErr) {
          console.error('[SELFBOT MODAL SUBMIT ERROR]', mErr.message);
          finish(false);
        }
      }
    };

    // 2. Raw WebSocket listener for gateway INTERACTION_CREATE type 9 (MODAL)
    const rawHandler = async (packet) => {
      if (!resolved && packet && packet.t === 'INTERACTION_CREATE' && packet.d && packet.d.type === 9) {
        await handleModalPayload(packet.d);
      }
    };

    selfClient.on('interactionModalCreate', modalHandler);
    if (selfClient.ws) selfClient.ws.on('raw', rawHandler);

    // 3. Directly send interaction API request without waiting for createPromiseInteraction (bypasses 5s timeout)
    const buttonComp = msg.resolveComponent ? msg.resolveComponent(buttonCustomId) : null;
    const resolvedCustomId = buttonComp ? buttonComp.customId : buttonCustomId;

    let flagsBitfield = msg.flags ? msg.flags.bitfield : 0;
    flagsBitfield |= 32768; // IS_COMPONENTS_V2

    const nonce = SnowflakeUtil.generate();
    const clickData = {
      type: 3, // MESSAGE_COMPONENT
      nonce,
      guild_id: msg.guildId,
      channel_id: msg.channelId,
      message_id: msg.id,
      application_id: msg.applicationId ?? GAMEBOT_ID,
      session_id: selfClient.sessionId,
      message_flags: flagsBitfield,
      data: {
        component_type: 2, // BUTTON
        custom_id: resolvedCustomId
      }
    };

    selfClient.api.interactions.post({ data: clickData }).catch(err => {
      console.error('[SELFBOT MODAL BUTTON POST ERROR]', err.message || err);
    });

    // Timeout fallback if no modal event arrives within 3 seconds
    setTimeout(() => {
      if (!resolved) {
        console.warn(`[SELFBOT MODAL TIMEOUT] No modal event received for button ${resolvedCustomId}`);
        finish(false);
      }
    }, 3000);
  });
}

// Helper to poll channel messages strictly until a Gamebot message containing specified button keywords is found
async function waitForGamebotWithKeywords(channel, keywords = [], maxRetries = 10, retryDelayMs = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    const msgs = await channel.messages.fetch({ limit: 5 }).catch(() => null);
    if (msgs && msgs.size > 0) {
      const gMsg = msgs.find(m => m.author && m.author.id === GAMEBOT_ID);
      if (gMsg) {
        if (!keywords || keywords.length === 0) return gMsg;
        const btn = findButton(gMsg, keywords);
        if (btn) return gMsg;
      }
    }
    await new Promise(resolve => setTimeout(resolve, retryDelayMs));
  }
  return null;
}

// Legacy fetch helper fallback
async function fetchLatestGamebotMessage(channel, keywords = [], maxRetries = 8, retryDelayMs = 1000) {
  return (await waitForGamebotWithKeywords(channel, keywords, maxRetries, retryDelayMs)) ||
         (await channel.messages.fetch({ limit: 5 }).then(m => m?.find(msg => msg.author && msg.author.id === GAMEBOT_ID)).catch(() => null));
}

const stateMap = new Map(); // Track isAutoBuying per selfbot token or client key

async function selectFarmableDropdownOption(msg, farmableName) {
  if (!msg || !msg.selectMenu) return false;

  try {
    let selectComp = null;
    const components = msg.components || msg.data?.components || [];
    if (Array.isArray(components)) {
      for (const row of components) {
        const rowComponents = row.components || (Array.isArray(row) ? row : []);
        for (const comp of rowComponents) {
          if (comp.type === 3 || comp.type === 'SELECT_MENU' || comp.type === 'STRING_SELECT' || comp.options) {
            selectComp = comp;
            break;
          }
        }
        if (selectComp) break;
      }
    }

    if (selectComp && selectComp.options && selectComp.options.length > 0) {
      const nameLower = (farmableName || '').toLowerCase();
      let matchOpt = selectComp.options.find(opt =>
        (opt.value && opt.value.toLowerCase() === nameLower) ||
        (opt.label && opt.label.toLowerCase() === nameLower)
      );

      if (!matchOpt && nameLower) {
        matchOpt = selectComp.options.find(opt =>
          (opt.value && opt.value.toLowerCase().includes(nameLower)) ||
          (opt.label && opt.label.toLowerCase().includes(nameLower))
        );
      }

      if (!matchOpt) {
        matchOpt = selectComp.options[0];
      }

      const optValue = matchOpt.value || matchOpt.label;
      await msg.selectMenu(0, [optValue]).catch(() => null);
      return true;
    } else {
      await msg.selectMenu(0, [farmableName]).catch(() => null);
      return true;
    }
  } catch (err) {
    console.error('[SELFBOT DROPDOWN ERROR]', err.message || err);
    return false;
  }
}

// Helper to return to the main Farming panel by clicking Back repeatedly if necessary
async function ensureReturnToMainPanel(channel) {
  for (let i = 0; i < 5; i++) {
    const latestMsg = await fetchLatestGamebotMessage(channel, [], 3, 800);
    if (!latestMsg) break;

    const { toggleAutoFarmButton, farmButton } = extractButtons(latestMsg);
    if (toggleAutoFarmButton || farmButton) {
      // We are back on the main farming panel! Click Toggle / Farm to resume
      console.log(`[SELFBOT AUTO-BUY] Back on main farming panel. Resuming farming...`);
      if (toggleAutoFarmButton && !toggleAutoFarmButton.disabled) {
        const isToggleRed = toggleAutoFarmButton.style === 4 || toggleAutoFarmButton.style === 'DANGER' || toggleAutoFarmButton.style === 'Danger';
        const isFarmDisabled = farmButton && (farmButton.disabled === true || farmButton.disabled === 'true');
        if (!(isToggleRed && isFarmDisabled)) {
          await new Promise(resolve => setTimeout(resolve, getHumanDelay()));
          await latestMsg.clickButton(toggleAutoFarmButton.customId || toggleAutoFarmButton.id).catch(() => null);
          console.log(`[SELFBOT AUTO-BUY] Clicked 'Toggle Auto Farm'`);
        }
      }
      if (farmButton && !farmButton.disabled) {
        await new Promise(resolve => setTimeout(resolve, getHumanDelay()));
        await latestMsg.clickButton(farmButton.customId || farmButton.id).catch(() => null);
        console.log(`[SELFBOT AUTO-BUY] Clicked 'Farm'`);
      }
      return true;
    }

    const backBtn = findButton(latestMsg, ['back']);
    if (backBtn && !backBtn.disabled) {
      await new Promise(resolve => setTimeout(resolve, getHumanDelay()));
      await latestMsg.clickButton(backBtn.customId || backBtn.id).catch(() => null);
      console.log(`[SELFBOT AUTO-BUY] Clicked 'Back' (${i + 1}/5) to return to main panel`);
      await new Promise(resolve => setTimeout(resolve, 1200));
    } else {
      break;
    }
  }
  return false;
}

async function executeAutoBuyFlow(selfClient, channel, gamebotMsg, farmableInfo) {
  const clientKey = selfClient.user?.id || selfClient.token || 'default';
  if (isAutoBuying(clientKey)) {
    console.log(`[SELFBOT AUTO-BUY] Auto-buy flow already running or on cooldown for ${selfClient.user?.tag || clientKey}`);
    return;
  }

  stateMap.set(clientKey, { active: true, startTime: Date.now() });

  try {
    console.log(`[SELFBOT AUTO-BUY] ${selfClient.user?.tag || 'Selfbot'} block count is ${farmableInfo.blockCount} (< 100). Executing Locks & Farmables auto-buy flow for '${farmableInfo.farmableName}'...`);

    // Step 1: Open Shop Menu by clicking 'Shop'
    let shopMenuMsg = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const currentMsg = await waitForGamebotWithKeywords(channel, [], 3, 500) || gamebotMsg;
      if (!currentMsg) break;

      // Check if already on Shop Menu
      if (findButton(currentMsg, ['locks', 'lock']) || findButton(currentMsg, ['farmable', 'farmables'])) {
        shopMenuMsg = currentMsg;
        break;
      }

      const shopBtn = findButton(currentMsg, ['shop']);
      if (shopBtn) {
        await new Promise(resolve => setTimeout(resolve, getHumanDelay()));
        await currentMsg.clickButton(shopBtn.customId || shopBtn.id).catch(() => null);
        console.log(`[SELFBOT AUTO-BUY] Clicked 'Shop' (Attempt ${attempt + 1})`);
      }

      shopMenuMsg = await waitForGamebotWithKeywords(channel, ['locks', 'farmables', 'farmable'], 6, 1000);
      if (shopMenuMsg) break;
    }

    if (!shopMenuMsg) {
      console.error(`[SELFBOT AUTO-BUY] Failed to open Shop Menu.`);
      return;
    }

    // Step 2: Click 'Locks' -> Buy BGL / DL / WL -> Click 'Back'
    const locksBtn = findButton(shopMenuMsg, ['locks', 'lock']);
    if (locksBtn) {
      await new Promise(resolve => setTimeout(resolve, getHumanDelay()));
      await shopMenuMsg.clickButton(locksBtn.customId || locksBtn.id).catch(() => null);
      console.log(`[SELFBOT AUTO-BUY] Clicked 'Locks'`);

      const locksShopMsg = await waitForGamebotWithKeywords(channel, ['buy bgl', 'buy dl', 'buy wl', 'bgl', 'dl', 'wl'], 8, 1000);

      if (locksShopMsg) {
        const BGL_COST = 21500000;
        const DL_COST = 210000;
        const WL_COST = 2000;
        let lockLoopCount = 0;
        const MAX_LOCK_LOOPS = 50;

        while (lockLoopCount < MAX_LOCK_LOOPS) {
          lockLoopCount++;
          await new Promise(resolve => setTimeout(resolve, getHumanDelay()));

          const activeLocksMsg = await waitForGamebotWithKeywords(channel, ['buy bgl', 'buy dl', 'buy wl', 'back', 'lock'], 6, 1000);
          if (!activeLocksMsg) break;

          const currentGems = parseGemsInfo(activeLocksMsg);
          console.log(`[SELFBOT AUTO-BUY] Locks Shop Gems: ${currentGems}`);

          if (currentGems >= BGL_COST) {
            const buyBglBtn = findButton(activeLocksMsg, ['buy bgl', 'bgl']);
            if (buyBglBtn) {
              const bglQty = Math.min(Math.floor(currentGems / BGL_COST), 100);
              console.log(`[SELFBOT AUTO-BUY] Gems (${currentGems}) >= BGL Cost (${BGL_COST}). Buying BGL (Amount: ${bglQty})...`);
              const ok = await clickLockBuyAndSubmitModal(selfClient, activeLocksMsg, buyBglBtn.customId || buyBglBtn.id, String(bglQty));
              if (!ok) break;
              await new Promise(resolve => setTimeout(resolve, 1500));
              continue;
            }
          }

          if (currentGems >= DL_COST) {
            const buyDlBtn = findButton(activeLocksMsg, ['buy dl', 'dl']);
            if (buyDlBtn) {
              const dlQty = Math.min(Math.floor(currentGems / DL_COST), 100);
              console.log(`[SELFBOT AUTO-BUY] Gems (${currentGems}) >= DL Cost (${DL_COST}). Buying DL (Amount: ${dlQty})...`);
              const ok = await clickLockBuyAndSubmitModal(selfClient, activeLocksMsg, buyDlBtn.customId || buyDlBtn.id, String(dlQty));
              if (!ok) break;
              await new Promise(resolve => setTimeout(resolve, 1500));
              continue;
            }
          }

          if (currentGems >= WL_COST) {
            const buyWlBtn = findButton(activeLocksMsg, ['buy wl', 'wl']);
            if (buyWlBtn) {
              const wlQty = Math.min(Math.floor(currentGems / WL_COST), 100);
              console.log(`[SELFBOT AUTO-BUY] Gems (${currentGems}) >= WL Cost (${WL_COST}). Buying WL (Amount: ${wlQty})...`);
              const ok = await clickLockBuyAndSubmitModal(selfClient, activeLocksMsg, buyWlBtn.customId || buyWlBtn.id, String(wlQty));
              if (!ok) break;
              await new Promise(resolve => setTimeout(resolve, 1500));
              continue;
            }
          }

          console.log(`[SELFBOT AUTO-BUY] Gems (${currentGems}) insufficient to buy any lock (< ${WL_COST}). Exiting Locks Shop.`);
          break;
        }

        // Click 'Back' from Locks Shop to return to Shop Main Menu
        await new Promise(resolve => setTimeout(resolve, getHumanDelay()));
        const postLocksMsg = await waitForGamebotWithKeywords(channel, ['back'], 6, 1000);
        if (postLocksMsg) {
          const backBtn1 = findButton(postLocksMsg, ['back']);
          if (backBtn1) {
            await postLocksMsg.clickButton(backBtn1.customId || backBtn1.id).catch(() => null);
            console.log(`[SELFBOT AUTO-BUY] Clicked 'Back' from Locks Shop`);
          }
        }
      }
    }

    // Step 3: Wait for Shop Menu and Click 'Farmables'
    const farmablesShopMsg = await waitForGamebotWithKeywords(channel, ['farmable', 'farmables'], 8, 1000);

    if (farmablesShopMsg) {
      const farmablesBtn = findButton(farmablesShopMsg, ['farmable', 'farmables']);
      if (farmablesBtn) {
        await new Promise(resolve => setTimeout(resolve, getHumanDelay()));
        await farmablesShopMsg.clickButton(farmablesBtn.customId || farmablesBtn.id).catch(() => null);
        console.log(`[SELFBOT AUTO-BUY] Clicked 'Farmables'`);

        // Step 4: Wait for Farmables Sub-Menu, Select Item & Click 'Buy Max'
        const farmablesSubMsg = await waitForGamebotWithKeywords(channel, ['buy max', 'buy_max', 'max'], 8, 1000);

        if (farmablesSubMsg) {
          await selectFarmableDropdownOption(farmablesSubMsg, farmableInfo.farmableName);
          console.log(`[SELFBOT AUTO-BUY] Selected farmable '${farmableInfo.farmableName}' in dropdown`);

          await new Promise(resolve => setTimeout(resolve, getHumanDelay()));
          const buyMaxMsg = await waitForGamebotWithKeywords(channel, ['buy max', 'buy_max', 'max'], 6, 1000);

          if (buyMaxMsg) {
            const buyMaxBtn = findButton(buyMaxMsg, ['buy max', 'buy_max', 'max']);
            if (buyMaxBtn) {
              await buyMaxMsg.clickButton(buyMaxBtn.customId || buyMaxBtn.id).catch(() => null);
              console.log(`[SELFBOT AUTO-BUY] Clicked 'Buy Max'`);
            }
          }

          // Step 5: Click 'Back' from Farmables Sub-Menu
          await new Promise(resolve => setTimeout(resolve, getHumanDelay()));
          const backFromFarmablesMsg = await waitForGamebotWithKeywords(channel, ['back'], 6, 1000);
          if (backFromFarmablesMsg) {
            const backBtn2 = findButton(backFromFarmablesMsg, ['back']);
            if (backBtn2) {
              await backFromFarmablesMsg.clickButton(backBtn2.customId || backBtn2.id).catch(() => null);
              console.log(`[SELFBOT AUTO-BUY] Clicked 'Back' (1/2) from Farmables Sub-Menu`);
            }
          }

          // Click 'Back' from Shop Main Menu to Main Farming Panel
          await new Promise(resolve => setTimeout(resolve, getHumanDelay()));
          const backFromShopMsg = await waitForGamebotWithKeywords(channel, ['back'], 6, 1000);
          if (backFromShopMsg) {
            const backBtn3 = findButton(backFromShopMsg, ['back']);
            if (backBtn3) {
              await backFromShopMsg.clickButton(backBtn3.customId || backBtn3.id).catch(() => null);
              console.log(`[SELFBOT AUTO-BUY] Clicked 'Back' (2/2) from Shop Main Menu`);
            }
          }
        }
      } else {
        console.error(`[SELFBOT AUTO-BUY] Could not find 'Farmables' button on Shop Menu.`);
      }
    } else {
      console.error(`[SELFBOT AUTO-BUY] Could not fetch Shop Menu message for Farmables.`);
    }

  } catch (err) {
    console.error(`[SELFBOT AUTO-BUY FLOW ERROR] ${selfClient.user?.tag || 'Selfbot'}:`, err);
  } finally {
    // ALWAYS ensure returning to the main panel and resuming farming!
    await ensureReturnToMainPanel(channel);
    // Apply 45-second cooldown on stateMap to prevent re-triggering auto-buy repeatedly on lingering messages
    stateMap.set(clientKey, Date.now() + 45000);
  }
}

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
  clickLockBuyAndSubmitModal,
  waitForGamebotWithKeywords,
  fetchLatestGamebotMessage,
  executeAutoBuyFlow,
  isAutoBuying
};
