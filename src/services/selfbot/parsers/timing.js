/**
 * Returns a randomized delay in milliseconds (0 - 2000ms) to simulate human reaction.
 *
 * @returns {number}
 */
function getHumanDelay() {
  return Math.floor(Math.random() * 2000);
}

module.exports = {
  getHumanDelay
};
