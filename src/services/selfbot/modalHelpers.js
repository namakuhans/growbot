const { SnowflakeUtil } = require('discord.js-selfbot-v13');
const { GAMEBOT_ID } = require('../../config/constants');
const { getHumanDelay } = require('./parsers');

/**
 * Clicks a lock-buy button and submits the calculated amount in the modal.
 * Handles both the high-level discord.js-selfbot-v13 Modal event and raw
 * gateway INTERACTION_CREATE type 9 payloads.
 *
 * @param {SelfClient} selfClient
 * @param {Message}    msg
 * @param {string}     buttonCustomId
 * @param {string}     amountStr
 * @returns {Promise<boolean>}
 */
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

    // Handler 1: Raw WebSocket listener for gateway INTERACTION_CREATE type 9 (MODAL)
    const rawHandler = async (packet) => {
      if (!resolved && packet && packet.t === 'INTERACTION_CREATE' && packet.d && packet.d.type === 9) {
        try {
          console.log(`[SELFBOT MODAL RAW] Intercepted modal '${packet.d.id}'. Submitting amount: ${amountStr}`);
          const submitComponents = [];
          const rows = packet.d.data?.components || packet.d.components || [];
          for (const row of rows) {
            const rowComps = row.components || row.items || [];
            for (const comp of rowComps) {
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

          const nonce = SnowflakeUtil.generate();
          const responseData = {
            type: 5, // MODAL_SUBMIT
            nonce,
            guild_id: msg.guildId,
            channel_id: msg.channelId,
            application_id: msg.applicationId ?? GAMEBOT_ID,
            session_id: selfClient.sessionId,
            data: {
              id: packet.d.data?.id || packet.d.id,
              custom_id: packet.d.data?.custom_id || packet.d.custom_id,
              components: submitComponents
            }
          };

          await selfClient.api.interactions.post({ data: responseData }).catch(e => {
            console.error('[SELFBOT MODAL POST ERROR]', e.message);
          });
          finish(true);
        } catch (mErr) {
          console.error('[SELFBOT MODAL SUBMIT ERROR]', mErr.message);
          finish(false);
        }
      }
    };

    // Handler 2: High-level client listener for Modal instances from discord.js-selfbot-v13
    const modalHandler = async (modal) => {
      if (!resolved && modal) {
        try {
          console.log(`[SELFBOT MODAL DIRECT] Received Modal instance. Submitting amount: ${amountStr}`);
          for (const row of (modal.components || [])) {
            const comp = row.components?.[0] || row.items?.[0];
            if (comp) {
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

    selfClient.on('interactionModalCreate', modalHandler);
    if (selfClient.ws) selfClient.ws.on('raw', rawHandler);

    // Send interaction button click to open modal
    const buttonComp = msg.resolveComponent ? msg.resolveComponent(buttonCustomId) : null;
    const resolvedCustomId = buttonComp ? buttonComp.customId : buttonCustomId;

    let flagsBitfield = msg.flags
      ? (typeof msg.flags.bitfield === 'number' ? msg.flags.bitfield : msg.flags)
      : 0;
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

    await selfClient.api.interactions.post({ data: clickData }).catch(err => {
      console.error('[SELFBOT MODAL BUTTON POST ERROR]', err.message || err);
    });

    // Timeout fallback if no modal event arrives within 4 seconds
    setTimeout(() => {
      if (!resolved) {
        console.warn(`[SELFBOT MODAL TIMEOUT] No modal event received for button ${resolvedCustomId}`);
        finish(false);
      }
    }, 4000);
  });
}

/**
 * Selects the given farmable name from the dropdown select menu in `msg`.
 * Inspects options to find the best match for `farmableName`.
 *
 * @param {Message} msg
 * @param {string}  farmableName
 * @returns {Promise<boolean>}
 */
async function selectFarmableDropdownOption(msg, farmableName) {
  if (!msg || !msg.selectMenu) return false;

  try {
    let selectComp = null;
    const components = msg.components || msg.data?.components || [];
    if (Array.isArray(components)) {
      for (const row of components) {
        const rowComponents = row.components || row.items || (Array.isArray(row) ? row : []);
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
      await new Promise(r => setTimeout(r, getHumanDelay()));
      await msg.selectMenu(0, [optValue]).catch(() => null);
      return true;
    } else {
      await new Promise(r => setTimeout(r, getHumanDelay()));
      await msg.selectMenu(0, [farmableName]).catch(() => null);
      return true;
    }
  } catch (err) {
    console.error('[SELFBOT DROPDOWN ERROR]', err.message || err);
    return false;
  }
}

module.exports = {
  clickLockBuyAndSubmitModal,
  selectFarmableDropdownOption
};
