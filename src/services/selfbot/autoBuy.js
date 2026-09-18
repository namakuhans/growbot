const { SnowflakeUtil } = require('discord.js-selfbot-v13');
const { GAMEBOT_ID } = require('../../config/constants');
const { parseGemsInfo, findButton, extractButtons, getHumanDelay } = require('./parsers');
const {
  clickLockBuyAndSubmitModal,
  waitForGamebotWithKeywords,
  fetchLatestGamebotMessage,
  selectFarmableDropdownOption,
  ensureReturnToMainPanel,
  isAutoBuying,
  stateMap
} = require('./autoBuyHelpers');

/**
 * Executes the auto‑buy flow for locks and farmables.
 * This function orchestrates the steps using helper utilities defined in autoBuyHelpers.js.
 */
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
    // SELALU fetch pesan terbaru sebelum klik tombol apapun untuk menghindari
    // 'Invalid Form Body' akibat mengklik tombol dari pesan yang sudah kadaluarsa.
    let shopMenuMsg = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      // Selalu ambil pesan terbaru (bukan dari cache/stale reference)
      const currentMsg = await fetchLatestGamebotMessage(channel);

      if (!currentMsg) {
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }

      // Already on Shop Menu (has Locks / Farmables buttons)
      if (findButton(currentMsg, ['locks', 'lock']) || findButton(currentMsg, ['farmable', 'farmables'])) {
        shopMenuMsg = currentMsg;
        break;
      }

      const shopBtn = findButton(currentMsg, ['shop']);
      if (shopBtn) {
        await new Promise(r => setTimeout(r, getHumanDelay()));
        const clickResult = await currentMsg.clickButton(shopBtn.customId || shopBtn.id).catch(e => e);
        if (clickResult instanceof Error || clickResult === null) {
          console.warn(`[SELFBOT AUTO-BUY] 'Shop' click failed (Attempt ${attempt + 1}): ${clickResult?.message || 'null'}. Retrying with fresh fetch...`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        console.log(`[SELFBOT AUTO-BUY] Clicked 'Shop' (Attempt ${attempt + 1})`);

        // Wait for Shop Menu to appear (contains Locks & Farmables buttons)
        shopMenuMsg = await waitForGamebotWithKeywords(channel, ['locks', 'farmables'], 8, 1000);
        if (shopMenuMsg) break;
      } else {
        console.log(`[SELFBOT AUTO-BUY] 'Shop' button not found on attempt ${attempt + 1}. Retrying in 2s...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (!shopMenuMsg) {
      console.error(`[SELFBOT AUTO-BUY] Failed to open Shop Menu after 5 attempts. Aborting.`);
      return;
    }

    // Pastikan pakai pesan terbaru sebelum klik Locks
    shopMenuMsg = await fetchLatestGamebotMessage(channel) || shopMenuMsg;


    // Step 2: Click 'Locks' → Buy BGL / DL / WL → Click 'Back'
    const locksBtn = findButton(shopMenuMsg, ['locks', 'lock']);
    if (locksBtn) {
      await new Promise(r => setTimeout(r, getHumanDelay()));
      const locksClickResult = await shopMenuMsg.clickButton(locksBtn.customId || locksBtn.id).catch(e => e);
      if (locksClickResult instanceof Error || locksClickResult === null) {
        // Retry dengan pesan terbaru jika klik gagal
        console.warn(`[SELFBOT AUTO-BUY] 'Locks' click failed: ${locksClickResult?.message || 'null'}. Retrying with fresh fetch...`);
        await new Promise(r => setTimeout(r, 1500));
        const retryMsg = await fetchLatestGamebotMessage(channel);
        const retryLocksBtn = retryMsg ? findButton(retryMsg, ['locks', 'lock']) : null;
        if (retryLocksBtn) {
          await retryMsg.clickButton(retryLocksBtn.customId || retryLocksBtn.id).catch(() => null);
        }
      }
      console.log(`[SELFBOT AUTO-BUY] Clicked 'Locks'`);


      const locksShopMsg = await waitForGamebotWithKeywords(channel, ['buy bgl', 'buy dl', 'buy wl', 'bgl', 'dl', 'wl'], 8, 1000);

      if (locksShopMsg) {
        const BGL_COST = 21500000;
        const DL_COST  = 210000;
        const WL_COST  = 2000;
        const MAX_QTY  = 100; // Maksimal pembelian per transaksi modal

        // Baca jumlah gems awal dari embed Locks Shop
        let remainingGems = parseGemsInfo(locksShopMsg);
        if (!remainingGems || remainingGems <= 0) {
          const freshLocksMsg = await fetchLatestGamebotMessage(channel);
          const parsed = parseGemsInfo(freshLocksMsg);
          if (parsed > 0) remainingGems = parsed;
        }

        console.log(`[SELFBOT AUTO-BUY] Locks Shop opened. Current Gems: ${remainingGems}`);

        /**
         * Membeli jenis lock (BGL, DL, atau WL) secara bertahap.
         * Setiap modal diisi hasil pembagian gems dengan harga lock (maksimal 100).
         * Jika panel tidak terupdate (gems unchanged), kurangi secara matematis dan LANJUT loop.
         */
        async function buyLockTier(cost, btnKeywords, typeName, maxBatches = 50) {
          let batchCount = 0;
          let consecutiveUnchanged = 0; // Batas gagal berturut-turut sebelum abort

          while (remainingGems >= cost && batchCount < maxBatches) {
            batchCount++;
            // Hitung qty: hasil pembagian gems dengan harga lock, dibatasi maksimal 100 per modal
            const qty = Math.min(Math.floor(remainingGems / cost), MAX_QTY);
            if (qty <= 0) break;

            const activeMsg = await waitForGamebotWithKeywords(channel, ['buy bgl', 'buy dl', 'buy wl', 'back'], 4, 800)
              || await fetchLatestGamebotMessage(channel);
            if (!activeMsg) {
              console.warn(`[SELFBOT AUTO-BUY] Locks panel not found for ${typeName}. Retrying...`);
              await new Promise(r => setTimeout(r, 1500));
              consecutiveUnchanged++;
              if (consecutiveUnchanged >= 3) break;
              continue;
            }

            const btn = findButton(activeMsg, btnKeywords);
            if (!btn) {
              console.warn(`[SELFBOT AUTO-BUY] Button for ${typeName} not found.`);
              break;
            }

            console.log(`[SELFBOT AUTO-BUY] Gems (${remainingGems.toLocaleString()}) → Buying ${typeName} × ${qty} (Batch ${batchCount})...`);
            await new Promise(r => setTimeout(r, getHumanDelay()));
            const ok = await clickLockBuyAndSubmitModal(selfClient, activeMsg, btn.customId || btn.id, String(qty));
            if (!ok) {
              console.warn(`[SELFBOT AUTO-BUY] Failed to submit modal for ${typeName}. Aborting tier.`);
              break;
            }

            // Tunggu Gamebot memproses pembelian & update panel
            await new Promise(r => setTimeout(r, 2500));
            const refreshed = await waitForGamebotWithKeywords(channel, ['buy bgl', 'buy dl', 'buy wl', 'back'], 4, 800)
              || await fetchLatestGamebotMessage(channel);
            const newGems = parseGemsInfo(refreshed);

            if (newGems > 0 && newGems < remainingGems) {
              // Panel berhasil terupdate → pakai nilai dari panel
              console.log(`[SELFBOT AUTO-BUY] ${typeName} ×${qty} verified. Gems: ${remainingGems.toLocaleString()} → ${newGems.toLocaleString()}`);
              remainingGems = newGems;
              consecutiveUnchanged = 0;
            } else {
              // Panel belum update / parse gagal → kurangi matematis dan TETAP LANJUT
              const deducted = qty * cost;
              const expected = Math.max(0, remainingGems - deducted);
              if (newGems >= remainingGems && newGems > 0) {
                // Coba sekali lagi dengan delay tambahan
                await new Promise(r => setTimeout(r, 1500));
                const retryMsg = await fetchLatestGamebotMessage(channel);
                const retryGems = parseGemsInfo(retryMsg);
                if (retryGems > 0 && retryGems < remainingGems) {
                  console.log(`[SELFBOT AUTO-BUY] ${typeName} verified (delayed). Gems: ${remainingGems.toLocaleString()} → ${retryGems.toLocaleString()}`);
                  remainingGems = retryGems;
                  consecutiveUnchanged = 0;
                  continue;
                }
              }
              console.log(`[SELFBOT AUTO-BUY] ${typeName} ×${qty} — panel not updated. Deducting math: ${remainingGems.toLocaleString()} - ${deducted.toLocaleString()} = ${expected.toLocaleString()}`);
              remainingGems = expected;
              consecutiveUnchanged++;
              if (consecutiveUnchanged >= 3) {
                console.warn(`[SELFBOT AUTO-BUY] ${typeName} — 3 consecutive panel-update failures. Moving to next tier.`);
                break;
              }
            }
          }
          console.log(`[SELFBOT AUTO-BUY] ${typeName} tier done after ${batchCount} batch(es). Remaining gems: ${remainingGems.toLocaleString()}`);
        }

        // Waterfall cascade: BGL → DL → WL hingga gems tidak cukup beli WL (< 2000)
        if (remainingGems >= BGL_COST) {
          await buyLockTier(BGL_COST, ['buy bgl', 'bgl'], 'BGL');
        }

        if (remainingGems >= DL_COST) {
          await buyLockTier(DL_COST, ['buy dl', 'dl'], 'DL');
        }

        if (remainingGems >= WL_COST) {
          await buyLockTier(WL_COST, ['buy wl', 'wl'], 'WL');
        }

        console.log(`[SELFBOT AUTO-BUY] Lock buying finished. Final remaining gems: ${remainingGems} (< ${WL_COST} for WL).`);

        // Click 'Back' dari Locks Shop untuk kembali ke Shop Menu
        await new Promise(r => setTimeout(r, getHumanDelay()));
        const postLocksMsg = await waitForGamebotWithKeywords(channel, ['back'], 6, 1000)
          || await fetchLatestGamebotMessage(channel);
        if (postLocksMsg) {
          const backBtn1 = findButton(postLocksMsg, ['back']);
          if (backBtn1) {
            await postLocksMsg.clickButton(backBtn1.customId || backBtn1.id).catch(() => null);
            console.log(`[SELFBOT AUTO-BUY] Clicked 'Back' from Locks Shop`);
            await new Promise(r => setTimeout(r, 1500));
          }
        }
      }
    }

    // Step 3: Open Farmables and buy max of selected farmable
    // Tunggu panel Shop Menu muncul kembali setelah klik Back dari Locks
    await new Promise(r => setTimeout(r, 2000));

    // Coba dapatkan pesan Shop Menu terbaru (berisi tombol Farmables/Locks)
    let farmablesShopMsg = await waitForGamebotWithKeywords(channel, ['farmable', 'farmables'], 8, 1200)
      || await waitForGamebotWithKeywords(channel, ['locks', 'lock', 'shop'], 5, 1000)
      || await fetchLatestGamebotMessage(channel);

    if (farmablesShopMsg) {
      // Selalu fetch versi terbaru sebelum klik tombol (hindari 'Unknown Message' error)
      farmablesShopMsg = await fetchLatestGamebotMessage(channel) || farmablesShopMsg;

      const farmablesBtn = findButton(farmablesShopMsg, ['farmable', 'farmables']);
      if (farmablesBtn) {
        await new Promise(r => setTimeout(r, getHumanDelay()));
        await farmablesShopMsg.clickButton(farmablesBtn.customId || farmablesBtn.id).catch(() => null);
        console.log(`[SELFBOT AUTO-BUY] Clicked 'Farmables'`);

        const farmablesSubMsg = await waitForGamebotWithKeywords(channel, ['buy max', 'buy_max', 'max', 'farmable', 'select'], 8, 1000);
        if (farmablesSubMsg) {
          await selectFarmableDropdownOption(farmablesSubMsg, farmableInfo.farmableName);
          console.log(`[SELFBOT AUTO-BUY] Selected farmable '${farmableInfo.farmableName}' in dropdown`);

          await new Promise(r => setTimeout(r, 1500));
          const buyMaxMsg = await waitForGamebotWithKeywords(channel, ['buy max', 'buy_max', 'max'], 6, 1000) || await fetchLatestGamebotMessage(channel) || farmablesSubMsg;
          if (buyMaxMsg) {
            const buyMaxBtn = findButton(buyMaxMsg, ['buy max', 'buy_max', 'max']);
            if (buyMaxBtn) {
              await buyMaxMsg.clickButton(buyMaxBtn.customId || buyMaxBtn.id).catch(() => null);
              console.log(`[SELFBOT AUTO-BUY] Clicked 'Buy Max'`);
              await new Promise(r => setTimeout(r, 1500));
            }
          }

          // Step 5: Return to main farming panel and resume farming
          await ensureReturnToMainPanel(channel, selfClient);
        } else {
          console.error(`[SELFBOT AUTO-BUY] Could not find Farmables sub-menu message after clicking Farmables.`);
        }
      } else {
        console.error(`[SELFBOT AUTO-BUY] Could not find 'Farmables' button on Shop Menu. Available buttons: ${farmablesShopMsg.components?.flatMap(r => r.components).map(b => b.label || b.customId).join(', ')}`);
      }
    } else {
      console.error(`[SELFBOT AUTO-BUY] Could not fetch Shop Menu message for Farmables.`);
    }


  } catch (err) {
    console.error(`[SELFBOT AUTO-BUY FLOW ERROR] ${selfClient.user?.tag || 'Selfbot'}:`, err);
  } finally {
    // Ensure we end back on the main farming panel and resume auto‑farm
    await ensureReturnToMainPanel(channel, selfClient);
    // Apply a cooldown for auto-buy only to avoid immediate re‑trigger
    stateMap.set(clientKey, Date.now() + 30000);
  }
}

module.exports = { executeAutoBuyFlow, isAutoBuying };
