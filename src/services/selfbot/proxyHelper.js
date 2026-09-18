const { HttpsProxyAgent } = require('https-proxy-agent');

/**
 * Parses and validates a proxy URL string.
 * Supported formats:
 *   http://host:port
 *   http://user:pass@host:port
 *   https://host:port
 *
 * @param {string|null|undefined} proxyString
 * @returns {{ valid: boolean, url: string|null, masked: string|null, error: string|null }}
 */
function parseProxyUrl(proxyString) {
  if (!proxyString || typeof proxyString !== 'string') {
    return { valid: false, url: null, masked: null, error: null };
  }

  const trimmed = proxyString.trim();
  if (!trimmed) {
    return { valid: false, url: null, masked: null, error: null };
  }

  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol;

    if (!['http:', 'https:'].includes(protocol)) {
      return {
        valid: false,
        url: null,
        masked: null,
        error: `Protocol "${protocol}" tidak didukung. Gunakan http:// atau https://`
      };
    }

    if (!parsed.hostname) {
      return { valid: false, url: null, masked: null, error: 'Proxy URL tidak memiliki hostname yang valid.' };
    }

    // Mask password for logging: http://user:***@host:port
    let masked = `${protocol}//${parsed.hostname}`;
    if (parsed.port) masked += `:${parsed.port}`;
    if (parsed.username) masked = `${protocol}//${parsed.username}:***@${parsed.hostname}${parsed.port ? ':' + parsed.port : ''}`;

    return { valid: true, url: trimmed, masked, error: null };
  } catch (err) {
    return { valid: false, url: null, masked: null, error: `Format proxy tidak valid: ${err.message}` };
  }
}

/**
 * Creates the WebSocket proxy agent object required by discord.js-selfbot-v13.
 * The library checks: `object.httpAgent instanceof Agent && object.httpsAgent instanceof Agent`
 *
 * @param {string} proxyUrl - Full proxy URL string
 * @returns {{ httpAgent: HttpsProxyAgent, httpsAgent: HttpsProxyAgent }}
 */
function createWsProxyAgent(proxyUrl) {
  const agent = new HttpsProxyAgent(proxyUrl);
  return { httpAgent: agent, httpsAgent: agent };
}

/**
 * Applies a proxy to a discord.js-selfbot-v13 Client instance.
 * - Sets ws.agent for WebSocket Gateway connections (per-client, works correctly)
 * - Sets http.agent for REST API calls (requires REST singleton reset — see resetRestAgentSingleton)
 *
 * Must be called BEFORE client.login().
 *
 * @param {import('discord.js-selfbot-v13').Client} selfClient
 * @param {string} proxyUrl
 */
function applyProxyToClient(selfClient, proxyUrl) {
  // WebSocket agent — per-client, fully isolated
  selfClient.options.ws.agent = createWsProxyAgent(proxyUrl);
  // REST agent URL — will be consumed by APIRequest.js on next request
  selfClient.options.http.agent = proxyUrl;
}

/**
 * Resets the module-level REST agent singleton inside discord.js-selfbot-v13's APIRequest.js.
 * This MUST be called before each selfbot.login() when using a different proxy per selfbot,
 * so that the next APIRequest instance creates a fresh ProxyAgent with the new proxy URL.
 */
function resetRestAgentSingleton() {
  try {
    const apiRequestPath = require.resolve('discord.js-selfbot-v13/src/rest/APIRequest');
    if (require.cache[apiRequestPath]) {
      delete require.cache[apiRequestPath];
    }
  } catch (e) {
    // If resolve fails, skip silently — REST will still use the previously cached agent
  }
}

/**
 * Formats a proxy URL for display in DM panels.
 * Shows: 🟢 http://***@host:port  or  🔴 Tidak ada proxy
 *
 * @param {string|null} proxy
 * @returns {string}
 */
function formatProxyDisplay(proxy) {
  if (!proxy) {
    return '🔴 Tidak ada proxy *(risiko ban!)*';
  }
  const { valid, masked, error } = parseProxyUrl(proxy);
  if (!valid) return `🔴 Proxy tidak valid: ${error}`;
  return `🟢 \`${masked}\``;
}

module.exports = {
  parseProxyUrl,
  createWsProxyAgent,
  applyProxyToClient,
  resetRestAgentSingleton,
  formatProxyDisplay
};
