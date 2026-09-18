const { Message, SnowflakeUtil, Constants } = require('discord.js-selfbot-v13');
const { InteractionTypes, MessageComponentTypes } = Constants;
const { GAMEBOT_ID } = require('../../config/constants');

function applyPatches() {
  // Patch Message.prototype.clickButton to post interaction directly without hanging on createPromiseInteraction
  if (Message.prototype.clickButton) {
    Message.prototype.clickButton = async function (buttonid) {
      try {
        let resolvedCustomId = null;
        let isDisabled = false;

        // Try standard resolveComponent
        if (typeof this.resolveComponent === 'function') {
          const res = this.resolveComponent(buttonid);
          if (res) {
            resolvedCustomId = res.customId || res.custom_id;
            isDisabled = res.disabled === true || res.disabled === 'true';
          }
        }

        // Fallback: search across all components/data.components recursively (including .items and .components)
        if (!resolvedCustomId) {
          const findInComp = (components) => {
            if (!Array.isArray(components)) return null;
            for (const comp of components) {
              if (!comp) continue;
              const cId = comp.customId || comp.custom_id || comp.id;
              const labelLower = (comp.label || '').toLowerCase();
              const reqLower = String(buttonid).toLowerCase();

              if (cId === buttonid || (labelLower && labelLower.includes(reqLower))) {
                if (comp.disabled === true || comp.disabled === 'true') isDisabled = true;
                return cId;
              }

              if (comp.components) {
                const sub = findInComp(comp.components);
                if (sub) return sub;
              }
              if (comp.items) {
                const sub = findInComp(comp.items);
                if (sub) return sub;
              }
            }
            return null;
          };

          const rawComponents = this.components || this.data?.components || [];
          resolvedCustomId = findInComp(rawComponents);
        }

        if (!resolvedCustomId) resolvedCustomId = buttonid;
        if (isDisabled) return false;

        const nonce = SnowflakeUtil.generate();
        let flagsBitfield = this.flags ? (typeof this.flags.bitfield === 'number' ? this.flags.bitfield : this.flags) : 0;
        flagsBitfield |= 32768; // IS_COMPONENTS_V2

        const sessionId = this.client.sessionId ||
          this.client._cachedSessionId ||
          this.client.ws?.shards?.first()?.sessionId ||
          this.client.ws?.sessionId ||
          '';

        const data = {
          type: InteractionTypes.MESSAGE_COMPONENT || 3,
          nonce,
          guild_id: this.guildId,
          channel_id: this.channelId,
          message_id: this.id,
          application_id: this.applicationId ?? GAMEBOT_ID,
          session_id: sessionId,
          message_flags: flagsBitfield,
          data: {
            component_type: MessageComponentTypes.BUTTON || 2,
            custom_id: resolvedCustomId,
          },
        };

        await this.client.api.interactions.post({ data }).catch(err => {
          console.error(`[SELFBOT INTERACTION POST ERROR] Button ${resolvedCustomId}:`, err.message || err);
        });

        return true;
      } catch (err) {
        if (err.message && (err.message.includes('BUTTON_CANNOT_CLICK') || err.message.includes('BUTTON_NOT_FOUND'))) {
          return false;
        }
        console.error(`[SELFBOT BUTTON CLICK ERROR] Failed to click button ${buttonid} on message ${this.id}:`, err.message || err);
        return false;
      }
    };
  }

  // Patch Message.prototype.selectMenu to handle component flag validation and post interaction directly
  Message.prototype.selectMenu = async function (menu, values = []) {
    try {
      let selectMenuComp = null;
      const components = this.components || this.data?.components || [];

      const findSelect = (comps) => {
        if (!Array.isArray(comps)) return null;
        for (const comp of comps) {
          if (!comp) continue;
          if (['STRING_SELECT', 'USER_SELECT', 'ROLE_SELECT', 'MENTIONABLE_SELECT', 'CHANNEL_SELECT', 'SELECT_MENU', 3, 5, 6, 7, 8].includes(comp.type) || comp.options) {
            if (typeof menu === 'number') return comp;
            if (typeof menu === 'string' && (comp.customId === menu || comp.custom_id === menu || comp.id === menu)) return comp;
          }
          if (comp.components) {
            const res = findSelect(comp.components);
            if (res) return res;
          }
          if (comp.items) {
            const res = findSelect(comp.items);
            if (res) return res;
          }
        }
        return null;
      };

      selectMenuComp = findSelect(components);

      if (!selectMenuComp) {
        // Fallback: find any select menu
        const findAnySelect = (comps) => {
          if (!Array.isArray(comps)) return null;
          for (const comp of comps) {
            if (!comp) continue;
            if (['STRING_SELECT', 'USER_SELECT', 'ROLE_SELECT', 'MENTIONABLE_SELECT', 'CHANNEL_SELECT', 'SELECT_MENU', 3, 5, 6, 7, 8].includes(comp.type) || comp.options) {
              return comp;
            }
            if (comp.components) {
              const res = findAnySelect(comp.components);
              if (res) return res;
            }
            if (comp.items) {
              const res = findAnySelect(comp.items);
              if (res) return res;
            }
          }
          return null;
        };
        selectMenuComp = findAnySelect(components);
      }

      if (!selectMenuComp) throw new TypeError('SELECT_MENU_NOT_FOUND');

      const mappedValues = values.map(val => {
        if (selectMenuComp.options) {
          const matchedOpt = selectMenuComp.options.find(obj => {
            if (!obj) return false;
            const cleanVal = (val || '').toLowerCase().replace(/[*_~`#]/g, '').trim();
            const cleanLabel = (obj.label || '').toLowerCase().replace(/[*_~`#]/g, '').trim();
            const cleanValue = (obj.value || '').toLowerCase().replace(/[*_~`#]/g, '').trim();
            return cleanValue === cleanVal || cleanLabel === cleanVal || cleanLabel.includes(cleanVal) || cleanVal.includes(cleanLabel);
          });
          if (matchedOpt) return matchedOpt.value;
        }
        return val;
      });

      const nonce = SnowflakeUtil.generate();
      let flagsBitfield = this.flags ? (typeof this.flags.bitfield === 'number' ? this.flags.bitfield : this.flags) : 0;
      flagsBitfield |= 32768;

      let compType = MessageComponentTypes[selectMenuComp.type];
      if (typeof compType === 'string') {
        compType = MessageComponentTypes[compType];
      }
      if (typeof compType !== 'number') {
        compType = MessageComponentTypes.STRING_SELECT || 3;
      }

      const sessionId = this.client.sessionId ||
        this.client._cachedSessionId ||
        this.client.ws?.shards?.first()?.sessionId ||
        this.client.ws?.sessionId ||
        '';

      const data = {
        type: InteractionTypes.MESSAGE_COMPONENT || 3,
        guild_id: this.guildId,
        channel_id: this.channelId,
        message_id: this.id,
        application_id: this.applicationId ?? GAMEBOT_ID,
        session_id: sessionId,
        message_flags: flagsBitfield,
        data: {
          component_type: compType,
          custom_id: selectMenuComp.customId || selectMenuComp.custom_id,
          type: compType,
          values: mappedValues,
        },
        nonce,
      };

      await this.client.api.interactions.post({ data }).catch(err => {
        console.error(`[SELFBOT INTERACTION POST ERROR] Select menu:`, err.message || err);
      });

      return true;
    } catch (err) {
      console.error(`[SELFBOT SELECT MENU ERROR] Failed to select menu on message ${this.id}:`, err.message || err);
      return false;
    }
  };
}

module.exports = { applyPatches };
