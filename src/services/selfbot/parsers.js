/**
 * Facade module re-exporting parser utilities.
 * Keeps existing imports working while delegating to modular parsers.
 */

const { extractComponentTexts, getAllButtons } = require('./parsers/componentText');
const { findButton, extractButtons } = require('./parsers/buttonParser');
const { parseFarmableInfo, parseGemsInfo } = require('./parsers/farmableParser');
const { getHumanDelay } = require('./parsers/timing');

module.exports = {
  extractComponentTexts,
  getAllButtons,
  parseFarmableInfo,
  parseGemsInfo,
  findButton,
  extractButtons,
  getHumanDelay
};
