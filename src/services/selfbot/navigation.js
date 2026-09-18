const { fetchLatestGamebotMessage } = require('./messageHelpers');
const { findButton, extractButtons, getHumanDelay, parseFarmableInfo } = require('./parsers');

/**
 * Starts or confirms farming is active on the main panel message.
 * Handles:
 *   1. Already active (Toggle is RED and Farm is DISABLED) -> no action needed
 *   2. Toggle is GREEN -> click Toggle Auto Farm, wait for Gamebot update, then click Farm
 *   3. Toggle is RED but Farm is ENABLED -> click Farm, wait for Gamebot update
 *   4. Verifies final state and re-clicks if needed
 *
 * @param {TextChannel} channel
 * @param {Message} panelMsg
 * @param {string} [clientTag='Selfbot']
 * @returns {Promise<boolean>}
 */
async function startFarmingOnMainPanel(channel, panelMsg, clientTag = 'Selfbot') {
  try {
    let currentMsg = panelMsg || await fetchLatestGamebotMessage(channel);
    if (!currentMsg) return false;

    let { toggleAutoFarmButton, farmButton } = extractButtons(currentMsg);

    let isToggleRed = toggleAutoFarmButton && (
      toggleAutoFarmButton.style === 4 ||
      toggleAutoFarmButton.style === 'DANGER' ||
      toggleAutoFarmButton.style === 'Danger'
    );
    let isFarmDisabled = farmButton && (farmButton.disabled === true || farmButton.disabled === 'true');

    // Case 1: Already active!
    if (isToggleRed && isFarmDisabled) {
      console.log(`[SELFBOT FARMING] ${clientTag}: Farming is already active (Toggle RED, Farm DISABLED).`);
      return true;
    }

    const isToggleGreen = toggleAutoFarmButton && (
      toggleAutoFarmButton.style === 3 ||
      toggleAutoFarmButton.style === 'SUCCESS' ||
      toggleAutoFarmButton.style === 'Success'
    );

    // Case 2: Toggle is GREEN (Auto Farm is OFF) -> Turn it ON
    if (isToggleGreen || (toggleAutoFarmButton && !isToggleRed)) {
      await new Promise(resolve => setTimeout(resolve, getHumanDelay()));
      await currentMsg.clickButton(toggleAutoFarmButton.customId || toggleAutoFarmButton.id).catch(() => null);
      console.log(`[SELFBOT FARMING] ${clientTag}: Clicked 'Toggle Auto Farm' (GREEN -> ON).`);

      // Wait for Gamebot to update the panel message
      await new Promise(resolve => setTimeout(resolve, 2000));
      const refreshedMsg = await fetchLatestGamebotMessage(channel);
      if (refreshedMsg) {
        currentMsg = refreshedMsg;
        const refreshedButtons = extractButtons(currentMsg);
        toggleAutoFarmButton = refreshedButtons.toggleAutoFarmButton;
        farmButton = refreshedButtons.farmButton;
        isToggleRed = toggleAutoFarmButton && (
          toggleAutoFarmButton.style === 4 ||
          toggleAutoFarmButton.style === 'DANGER' ||
          toggleAutoFarmButton.style === 'Danger'
        );
        isFarmDisabled = farmButton && (farmButton.disabled === true || farmButton.disabled === 'true');
      }
    }

    // Check if farming became active immediately after toggling
    if (isToggleRed && isFarmDisabled) {
      console.log(`[SELFBOT FARMING] ${clientTag}: Farming became active after toggle.`);
      return true;
    }

    // Case 3: Click 'Farm' button
    if (farmButton && !farmButton.disabled) {
      await new Promise(resolve => setTimeout(resolve, getHumanDelay()));
      await currentMsg.clickButton(farmButton.customId || farmButton.id).catch(() => null);
      console.log(`[SELFBOT FARMING] ${clientTag}: Clicked 'Farm' button to start farming.`);

      // Wait and verify final state
      await new Promise(resolve => setTimeout(resolve, 2000));
      const verifyMsg = await fetchLatestGamebotMessage(channel);
      if (verifyMsg) {
        const verifyButtons = extractButtons(verifyMsg);
        if (verifyButtons.farmButton && !verifyButtons.farmButton.disabled) {
          // If Farm button is still enabled, retry click once
          console.log(`[SELFBOT FARMING] ${clientTag}: Farm button still enabled. Retrying click...`);
          await new Promise(resolve => setTimeout(resolve, getHumanDelay()));
          await verifyMsg.clickButton(verifyButtons.farmButton.customId || verifyButtons.farmButton.id).catch(() => null);
        }
      }
      console.log(`[SELFBOT FARMING] ${clientTag}: Auto-farm successfully resumed and running!`);
      return true;
    }

    return true;
  } catch (err) {
    console.error(`[SELFBOT FARMING] startFarmingOnMainPanel error for ${clientTag}:`, err.message || err);
    return false;
  }
}

/**
 * Navigates from ANY Gamebot sub-panel/menu (Shop, Locks, Farmables, Profile,
 * Change Farmable, Settings, AFK Prompt, etc.) back to the Main Farming Menu
 * by unwinding navigation via Back/Cancel/Close/Return/Home buttons.
 *
 * @param {TextChannel} channel
 * @param {Client} [selfClient]
 * @param {number} [maxUnwindSteps=6]
 * @returns {Promise<{ onFarmingMenu: boolean, message: Message|null, farmableInfo: Object|null }>}
 */
async function navigateToFarmingMenu(channel, selfClient, maxUnwindSteps = 6) {
  const clientTag = selfClient?.user?.tag || 'Selfbot';

  for (let step = 0; step < maxUnwindSteps; step++) {
    const latestMsg = await fetchLatestGamebotMessage(channel);
    if (!latestMsg) {
      await new Promise(r => setTimeout(r, 1500));
      continue;
    }

    // 1. Check if AFK verification prompt is active
    const contentLower = (latestMsg.content || '').toLowerCase();
    const { keepFarmingButton } = extractButtons(latestMsg);
    const hasAfkText = contentLower.includes('are you still there') || contentLower.includes('afk verification') || contentLower.includes('afk check');

    if (keepFarmingButton && !keepFarmingButton.disabled) {
      console.log(`[SELFBOT MENU NAVIGATION] ${clientTag}: Detected AFK prompt. Clicking 'Keep Farming'...`);
      await new Promise(r => setTimeout(r, getHumanDelay()));
      await latestMsg.clickButton(keepFarmingButton.customId || keepFarmingButton.id).catch(() => null);
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    // 2. Check if we are already on the Main Farming Menu
    const farmableInfo = parseFarmableInfo(latestMsg);
    const { toggleAutoFarmButton, farmButton } = extractButtons(latestMsg);
    const isFarmingPanel = (farmableInfo && typeof farmableInfo.blockCount === 'number') || (toggleAutoFarmButton && farmButton);

    if (isFarmingPanel) {
      console.log(`[SELFBOT MENU NAVIGATION] ${clientTag}: On Main Farming Menu (Blocks: ${farmableInfo?.blockCount ?? 'Unknown'}).`);
      return { onFarmingMenu: true, message: latestMsg, farmableInfo };
    }

    // 3. Panel is on a Sub-Menu (Shop, Locks, Farmables, Profile, Change, Settings, etc.)
    // Look for return/back navigation buttons — prioritize strict 'back' first
    // then broader keywords, to avoid accidentally clicking 'Buy BGL/DL/WL' buttons
    const returnBtn = findButton(latestMsg, ['back', 'kembali', 'return', 'home', 'main'])
      || findButton(latestMsg, ['cancel', 'batal', 'close', 'tutup', 'exit', 'keluar']);

    if (returnBtn && !returnBtn.disabled) {
      console.log(`[SELFBOT MENU NAVIGATION] ${clientTag}: Panel on sub-menu. Clicking '${returnBtn.label || returnBtn.customId}' (unwind step ${step + 1}/${maxUnwindSteps})...`);
      await new Promise(r => setTimeout(r, getHumanDelay()));
      await latestMsg.clickButton(returnBtn.customId || returnBtn.id).catch(() => null);
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    // 4. Fallback A: try 'shop' button (naik ke Shop Menu dari Locks/Farmables sub-panel)
    const shopBtn = findButton(latestMsg, ['shop']);
    if (shopBtn && !shopBtn.disabled) {
      console.log(`[SELFBOT MENU NAVIGATION] ${clientTag}: No back button. Clicking 'Shop' to ascend (unwind step ${step + 1}/${maxUnwindSteps})...`);
      await new Promise(r => setTimeout(r, getHumanDelay()));
      await latestMsg.clickButton(shopBtn.customId || shopBtn.id).catch(() => null);
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    // 4. Fallback B: try 'farming' button (direct return to farming panel)
    const farmingBtn = findButton(latestMsg, ['farming', 'farm']);
    // Only use if it's NOT the main farm panel's 'Farm' button (which would be recognized above)
    if (farmingBtn && !farmingBtn.disabled) {
      console.log(`[SELFBOT MENU NAVIGATION] ${clientTag}: No back button. Clicking 'Farming/Farm' to return (unwind step ${step + 1}/${maxUnwindSteps})...`);
      await new Promise(r => setTimeout(r, getHumanDelay()));
      await latestMsg.clickButton(farmingBtn.customId || farmingBtn.id).catch(() => null);
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    // 5. Fallback C: try clicking Profile button to reset to a known panel
    const profileBtn = findButton(latestMsg, ['profile']);
    if (profileBtn && !profileBtn.disabled) {
      console.log(`[SELFBOT MENU NAVIGATION] ${clientTag}: No return/shop button. Clicking 'Profile' to reset (unwind step ${step + 1}/${maxUnwindSteps})...`);
      await new Promise(r => setTimeout(r, getHumanDelay()));
      await latestMsg.clickButton(profileBtn.customId || profileBtn.id).catch(() => null);
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    // 6. Last resort: wait and retry (panel may be transitioning)
    console.warn(`[SELFBOT MENU NAVIGATION] ${clientTag}: No navigable button found on step ${step + 1}. Waiting 3s...`);
    await new Promise(r => setTimeout(r, 3000));
  }

  // Final check after loop
  const finalMsg = await fetchLatestGamebotMessage(channel);
  if (finalMsg) {
    const farmableInfo = parseFarmableInfo(finalMsg);
    const { toggleAutoFarmButton, farmButton } = extractButtons(finalMsg);
    if ((farmableInfo && typeof farmableInfo.blockCount === 'number') || (toggleAutoFarmButton && farmButton)) {
      return { onFarmingMenu: true, message: finalMsg, farmableInfo };
    }
  }

  console.warn(`[SELFBOT MENU NAVIGATION] ${clientTag}: Could not navigate to Main Farming Menu after ${maxUnwindSteps} steps.`);
  return { onFarmingMenu: false, message: finalMsg, farmableInfo: null };
}

/**
 * Ensures the selfbot returns to the main Farming panel by unwinding navigation,
 * then starts/resumes auto-farming properly.
 *
 * @param {TextChannel} channel
 * @param {Client} [selfClient]
 * @returns {Promise<boolean>}
 */
async function ensureReturnToMainPanel(channel, selfClient) {
  try {
    const clientTag = selfClient?.user?.tag || 'Selfbot';
    console.log(`[SELFBOT AUTO-BUY] Navigating back to main farming panel for ${clientTag}...`);

    const navRes = await navigateToFarmingMenu(channel, selfClient, 6);
    if (navRes.onFarmingMenu && navRes.message) {
      console.log(`[SELFBOT AUTO-BUY] Reached main farming panel. Resuming farming...`);
      return await startFarmingOnMainPanel(channel, navRes.message, clientTag);
    }

    console.warn(`[SELFBOT AUTO-BUY] ${clientTag}: Could not locate main panel message after returning.`);
    return false;
  } catch (err) {
    console.error(`[SELFBOT AUTO-BUY] ensureReturnToMainPanel error:`, err.message || err);
    return false;
  }
}

module.exports = {
  startFarmingOnMainPanel,
  navigateToFarmingMenu,
  ensureReturnToMainPanel
};
