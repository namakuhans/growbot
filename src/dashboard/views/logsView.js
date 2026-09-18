const { renderSidebar } = require('./sidebarView');

function escapeHtml(str) {
  if (typeof str !== 'string') {
    str = String(str ?? '');
  }
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatLogMessage(rawMessage) {
  let text = escapeHtml(rawMessage);

  // Replace URLs first with placeholders
  const urls = [];
  text = text.replace(/(https?:\/\/[^\s]+)/g, (match) => {
    urls.push(`<span class="text-cyan-400 font-semibold underline decoration-cyan-400/40 hover:decoration-cyan-400 transition-all">${match}</span>`);
    return `___URL_${urls.length - 1}___`;
  });

  const badges = [];
  function addBadge(badgeText, inlineStyle) {
    const uppercaseBadge = badgeText.toUpperCase();
    badges.push(`<span class="inline-block px-2 py-0.5 text-[10px] font-extrabold tracking-wide rounded select-none mr-1.5 shadow-md" style="${inlineStyle}">${uppercaseBadge}</span>`);
    return `___BADGE_${badges.length - 1}___`;
  }

  // Solid, vibrant background colors for badges via inline CSS (guarantees styling across all builds)
  function getModuleColorStyle(moduleName) {
    const mod = (moduleName || '').toUpperCase().trim();
    if (mod.includes('AUTO-BUY') || mod.includes('AUTO BUY')) return 'background-color: #c026d3; color: #ffffff; border: 1px solid rgba(240, 171, 252, 0.4);';
    if (mod.includes('AUTO-RECOVERY') || mod.includes('AUTO RECOVERY')) return 'background-color: #4f46e5; color: #ffffff; border: 1px solid rgba(165, 180, 252, 0.4);';
    if (mod.includes('STARTUP CHECK') || mod.includes('STARTUP')) return 'background-color: #0d9488; color: #ffffff; border: 1px solid rgba(94, 234, 212, 0.4);';
    if (mod.includes('RUNTIME')) return 'background-color: #0891b2; color: #ffffff; border: 1px solid rgba(103, 232, 249, 0.4);';
    if (mod.includes('PROFILE TIMER') || mod.includes('TIMER')) return 'background-color: #7c3aed; color: #ffffff; border: 1px solid rgba(196, 181, 253, 0.4);';
    if (mod.includes('PROFILE')) return 'background-color: #db2777; color: #ffffff; border: 1px solid rgba(249, 168, 212, 0.4);';
    if (mod.includes('MODAL')) return 'background-color: #65a30d; color: #ffffff; border: 1px solid rgba(190, 242, 100, 0.4);';
    if (mod.includes('PERIODIC')) return 'background-color: #d97706; color: #ffffff; border: 1px solid rgba(252, 211, 77, 0.4);';
    if (mod.includes('ERROR') || mod.includes('FAIL')) return 'background-color: #e11d48; color: #ffffff; border: 1px solid rgba(253, 164, 175, 0.4);';
    return 'background-color: #059669; color: #ffffff; border: 1px solid rgba(110, 231, 183, 0.4);';
  }

  // 1. Convert Selfbot logs with Module + Username into dynamic solid badge: [USERNAME | MODULE]
  text = text.replace(/\[SELFBOT(?:\s+([A-Z0-9_\s-]+))?\]\s+(?:Logged in as\s+)?([a-zA-Z0-9_.-]+)(?:\s*\([^)]*\))?:?/gi, (match, moduleName, username) => {
    const mod = moduleName ? moduleName.trim().replace(/-/g, ' ') : 'SELFBOT';
    const style = getModuleColorStyle(mod);
    return addBadge(`[${username} | ${mod}]`, style);
  });

  // 2. Default System Badges with Solid Vivid Backgrounds
  text = text.replace(/\[MAIN BOT\]/gi, () => addBadge('[MAIN BOT]', 'background-color: #0284c7; color: #ffffff; border: 1px solid rgba(125, 211, 252, 0.4);'));
  text = text.replace(/\[DATABASE BACKUP\]/gi, () => addBadge('[DATABASE BACKUP]', 'background-color: #9333ea; color: #ffffff; border: 1px solid rgba(216, 180, 254, 0.4);'));
  text = text.replace(/\[DATABASE\]/gi, () => addBadge('[DATABASE]', 'background-color: #d97706; color: #ffffff; border: 1px solid rgba(252, 211, 77, 0.4);'));
  text = text.replace(/\[DASHBOARD EXPRESS\]/gi, () => addBadge('[DASHBOARD EXPRESS]', 'background-color: #059669; color: #ffffff; border: 1px solid rgba(110, 231, 183, 0.4);'));

  text = text.replace(/\[(EXPRESS ROUTE ERROR|DATABASE MIGRATION ERROR|SELFBOT LOGIN FAILED|SELFBOT BUTTON CLICK ERROR|SELFBOT SELECT MENU ERROR|SELFBOT AUTO-BUY FLOW ERROR|SELFBOT STARTUP CHECK ERROR|SELFBOT MESSAGE HANDLER ERROR|SELFBOT AUTO-RECOVERY ERROR|ERROR|FAIL|FAILED)\]/gi, (m, name) =>
    addBadge(`[${name}]`, 'background-color: #e11d48; color: #ffffff; border: 1px solid rgba(253, 164, 175, 0.4);')
  );

  text = text.replace(/\[([A-Z0-9_\s-]+)\]/gi, (m, name) =>
    addBadge(`[${name}]`, 'background-color: #374151; color: #ffffff; border: 1px solid rgba(156, 163, 175, 0.4);')
  );

  // Highlight Success / Action Keywords
  text = text.replace(/\b(successfully|Logged in|listening on|ready|SUCCESS|OK|Created|Deleted|Unlinked|Intercepted|Clicked|Selected|Buying|Bought)\b/gi, '<span class="text-[#37FF00] font-bold">$1</span>');

  // Highlight Warning Keywords
  text = text.replace(/\b(ExperimentalWarning|Warning|WARN|CAUTION)\b/gi, '<span class="text-amber-300 font-bold">$1</span>');

  // Highlight Error Keywords
  text = text.replace(/\b(Error|Failed|EXCEPTION|uncaughtException|unhandledRejection)\b/gi, '<span class="text-rose-400 font-bold">$1</span>');

  // Highlight Numbers / Quantities
  text = text.replace(/(?<=\s|^)(\d+(?:\.\d+)?\s*(?:ms|seconds?|minutes?|hours?|Gems|Blocks?|WIB)?)(?=\s|[.,:;]|$)/gi, '<span class="text-emerald-300 font-semibold">$1</span>');

  // Restore Badges
  badges.forEach((b, i) => {
    text = text.replace(`___BADGE_${i}___`, b);
  });

  // Restore URLs
  urls.forEach((u, i) => {
    text = text.replace(`___URL_${i}___`, u);
  });

  return text;
}

function renderLogsPage(initialLogs = []) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Growbot Dashboard - Console Logs</title>
  <link rel="icon" href="/favicon.png" type="image/png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/output.css">
  <style>
    /* Fixed SVG icon constraint to prevent unstyled layout overflow */
    svg {
      width: 1rem;
      height: 1rem;
      max-width: 100%;
      display: inline-block;
      vertical-align: middle;
    }
    #log-search-input::placeholder {
      color: #2ae813 !important;
      opacity: 0.9;
    }
  </style>
</head>
<body class="bg-[#0b0c10] text-gray-200 h-screen h-[100dvh] overflow-hidden flex font-['Plus_Jakarta_Sans']">
  <div class="flex w-full h-full overflow-hidden">
    ${renderSidebar('logs')}

    <main class="flex-1 pt-14 md:pt-20 px-3 md:px-8 pb-16 sm:pb-20 md:pb-6 max-w-[1300px] mx-auto w-full flex flex-col h-full min-h-0">
      <div class="mb-2 sm:mb-3 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
        <div>
          <div class="text-2xl font-extrabold text-white mb-1">Live Terminal Logs</div>
          <div class="text-xs text-gray-400">Real-time colorful console output streaming from system processes via Server-Sent Events (SSE).</div>
        </div>

        <!-- Capsule Pill Search Box matching design image (Proyek Baru 151) -->
        <div class="w-full sm:w-72 shrink-0 flex items-center gap-3 rounded-full px-4 py-2 transition-all shadow-lg" style="background-color: #0d1912; border: 2.5px solid #10e80a; box-shadow: 0 0 10px rgba(16, 232, 10, 0.15);">
          <svg class="w-5 h-5 shrink-0" style="width:20px; height:20px; min-width:20px; color: #2ae813;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.8" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          <input type="text" id="log-search-input" placeholder="Search Logs" class="w-full bg-transparent border-none outline-none text-sm font-medium p-0 focus:outline-none focus:ring-0" style="color: #2ae813;">
        </div>
      </div>

      <div class="bg-[#0d1117] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex-1 min-h-0 flex flex-col mb-4 md:mb-1">
        <div class="bg-[#161b22]/90 px-5 py-3 border-b border-white/10 flex justify-between items-center shrink-0">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
            <div class="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
            <div class="w-3 h-3 rounded-full bg-[#27c93f]"></div>
            <span class="ml-2 text-xs font-mono text-gray-400">bash • stdout / stderr</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand/10 text-brand border border-brand/20">
              <span class="w-1.5 h-1.5 rounded-full bg-brand animate-pulse"></span> Live Stream
            </span>
            <span class="text-xs font-mono text-[#8b949e]">growbot-system.log</span>
          </div>
        </div>

        <div id="terminal-body" class="p-3 sm:p-5 pb-12 md:pb-16 flex-1 min-h-0 overflow-y-auto font-['JetBrains_Mono'] text-xs leading-relaxed text-[#c9d1d9] bg-[#0b0e14] selection:bg-brand/30 selection:text-white space-y-1">
          ${initialLogs.map(log => `
            <div class="log-entry flex items-start gap-2 py-0.5 border-b border-white/[0.02]" data-raw="${escapeHtml(log.message)}">
              <span class="text-gray-500 font-mono text-[11px] shrink-0 select-none">[${log.timestamp}]</span>
              <span class="${log.type === 'error' || log.type === 'stderr' ? 'text-rose-400' : 'text-gray-200'} font-mono leading-normal break-all">${formatLogMessage(log.message)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </main>
  </div>

  <script>
    function escapeHtml(str) {
      if (typeof str !== 'string') str = String(str ?? '');
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function formatLogMessage(rawMessage) {
      let text = escapeHtml(rawMessage);

      const urls = [];
      text = text.replace(/(https?:\\\/\\\/[^\\s]+)/g, (match) => {
        urls.push('<span class="text-cyan-400 font-semibold underline decoration-cyan-400/40 hover:decoration-cyan-400 transition-all">' + match + '</span>');
        return '___URL_' + (urls.length - 1) + '___';
      });

      const badges = [];
      function addBadge(badgeText, inlineStyle) {
        const uppercaseBadge = badgeText.toUpperCase();
        badges.push('<span class="inline-block px-2 py-0.5 text-[10px] font-extrabold tracking-wide rounded select-none mr-1.5 shadow-md" style="' + inlineStyle + '">' + uppercaseBadge + '</span>');
        return '___BADGE_' + (badges.length - 1) + '___';
      }

      function getModuleColorStyle(moduleName) {
        const mod = (moduleName || '').toUpperCase().trim();
        if (mod.indexOf('AUTO-BUY') !== -1 || mod.indexOf('AUTO BUY') !== -1) return 'background-color: #c026d3; color: #ffffff; border: 1px solid rgba(240, 171, 252, 0.4);';
        if (mod.indexOf('AUTO-RECOVERY') !== -1 || mod.indexOf('AUTO RECOVERY') !== -1) return 'background-color: #4f46e5; color: #ffffff; border: 1px solid rgba(165, 180, 252, 0.4);';
        if (mod.indexOf('STARTUP CHECK') !== -1 || mod.indexOf('STARTUP') !== -1) return 'background-color: #0d9488; color: #ffffff; border: 1px solid rgba(94, 234, 212, 0.4);';
        if (mod.indexOf('RUNTIME') !== -1) return 'background-color: #0891b2; color: #ffffff; border: 1px solid rgba(103, 232, 249, 0.4);';
        if (mod.indexOf('PROFILE TIMER') !== -1 || mod.indexOf('TIMER') !== -1) return 'background-color: #7c3aed; color: #ffffff; border: 1px solid rgba(196, 181, 253, 0.4);';
        if (mod.indexOf('PROFILE') !== -1) return 'background-color: #db2777; color: #ffffff; border: 1px solid rgba(249, 168, 212, 0.4);';
        if (mod.indexOf('MODAL') !== -1) return 'background-color: #65a30d; color: #ffffff; border: 1px solid rgba(190, 242, 100, 0.4);';
        if (mod.indexOf('PERIODIC') !== -1) return 'background-color: #d97706; color: #ffffff; border: 1px solid rgba(252, 211, 77, 0.4);';
        if (mod.indexOf('ERROR') !== -1 || mod.indexOf('FAIL') !== -1) return 'background-color: #e11d48; color: #ffffff; border: 1px solid rgba(253, 164, 175, 0.4);';
        return 'background-color: #059669; color: #ffffff; border: 1px solid rgba(110, 231, 183, 0.4);';
      }

      // Convert Selfbot logs with Module + Username into dynamic solid badge: [USERNAME | MODULE]
      text = text.replace(/\\[SELFBOT(?:\\s+([A-Z0-9_\\s-]+))?\\]\\s+(?:Logged in as\\s+)?([a-zA-Z0-9_.-]+)(?:\\s*\\([^)]*\\))?:?/gi, function(match, moduleName, username) {
        const mod = moduleName ? moduleName.trim().replace(/-/g, ' ') : 'SELFBOT';
        const style = getModuleColorStyle(mod);
        return addBadge('[' + username + ' | ' + mod + ']', style);
      });

      text = text.replace(/\\[MAIN BOT\\]/gi, function() { return addBadge('[MAIN BOT]', 'background-color: #0284c7; color: #ffffff; border: 1px solid rgba(125, 211, 252, 0.4);'); });
      text = text.replace(/\\[DATABASE BACKUP\\]/gi, function() { return addBadge('[DATABASE BACKUP]', 'background-color: #9333ea; color: #ffffff; border: 1px solid rgba(216, 180, 254, 0.4);'); });
      text = text.replace(/\\[DATABASE\\]/gi, function() { return addBadge('[DATABASE]', 'background-color: #d97706; color: #ffffff; border: 1px solid rgba(252, 211, 77, 0.4);'); });
      text = text.replace(/\\[DASHBOARD EXPRESS\\]/gi, function() { return addBadge('[DASHBOARD EXPRESS]', 'background-color: #059669; color: #ffffff; border: 1px solid rgba(110, 231, 183, 0.4);'); });

      text = text.replace(/\\[(EXPRESS ROUTE ERROR|DATABASE MIGRATION ERROR|SELFBOT LOGIN FAILED|SELFBOT BUTTON CLICK ERROR|SELFBOT SELECT MENU ERROR|SELFBOT AUTO-BUY FLOW ERROR|SELFBOT STARTUP CHECK ERROR|SELFBOT MESSAGE HANDLER ERROR|SELFBOT AUTO-RECOVERY ERROR|ERROR|FAIL|FAILED)\\]/gi, function(m, name) {
        return addBadge('[' + name + ']', 'background-color: #e11d48; color: #ffffff; border: 1px solid rgba(253, 164, 175, 0.4);');
      });

      text = text.replace(/\\[([A-Z0-9_\\s-]+)\\]/gi, function(m, name) {
        return addBadge('[' + name + ']', 'background-color: #374151; color: #ffffff; border: 1px solid rgba(156, 163, 175, 0.4);');
      });

      text = text.replace(/\\b(successfully|Logged in|listening on|ready|SUCCESS|OK|Created|Deleted|Unlinked|Intercepted|Clicked|Selected|Buying|Bought)\\b/gi, '<span class="text-[#37FF00] font-bold">$1</span>');
      text = text.replace(/\\b(ExperimentalWarning|Warning|WARN|CAUTION)\\b/gi, '<span class="text-amber-300 font-bold">$1</span>');
      text = text.replace(/\\b(Error|Failed|EXCEPTION|uncaughtException|unhandledRejection)\\b/gi, '<span class="text-rose-400 font-bold">$1</span>');
      text = text.replace(/(?<=\\s|^)(\\d+(?:\\.\\d+)?\\s*(?:ms|seconds?|minutes?|hours?|Gems|Blocks?|WIB)?)(?=\\s|[.,:;]|$)/gi, '<span class="text-emerald-300 font-semibold">$1</span>');

      badges.forEach(function(b, i) {
        text = text.replace('___BADGE_' + i + '___', b);
      });

      urls.forEach(function(u, i) {
        text = text.replace('___URL_' + i + '___', u);
      });

      return text;
    }

    const terminalBody = document.getElementById('terminal-body');
    if (terminalBody) terminalBody.scrollTop = terminalBody.scrollHeight;

    // Search filter logic
    const searchInput = document.getElementById('log-search-input');
    let currentFilter = '';

    function applyFilter() {
      if (!terminalBody) return;
      const entries = terminalBody.getElementsByClassName('log-entry');
      const query = currentFilter.toLowerCase().trim();

      for (let i = 0; i < entries.length; i++) {
        const el = entries[i];
        const rawText = (el.getAttribute('data-raw') || el.textContent || '').toLowerCase();
        if (!query || rawText.includes(query)) {
          el.style.display = 'flex';
        } else {
          el.style.display = 'none';
        }
      }
    }

    if (searchInput) {
      searchInput.addEventListener('input', function(e) {
        currentFilter = e.target.value || '';
        applyFilter();
      });
    }

    const eventSource = new EventSource('/api/logs');
    eventSource.onmessage = (event) => {
      try {
        const log = JSON.parse(event.data);
        const div = document.createElement('div');
        div.className = 'log-entry flex items-start gap-2 py-0.5 border-b border-white/[0.02]';
        div.setAttribute('data-raw', log.message || '');

        const colorClass = (log.type === 'error' || log.type === 'stderr') ? 'text-rose-400' : 'text-gray-200';
        div.innerHTML = '<span class="text-gray-500 font-mono text-[11px] shrink-0 select-none">[' + log.timestamp + ']</span><span class="' + colorClass + ' font-mono leading-normal break-all">' + formatLogMessage(log.message) + '</span>';

        if (currentFilter) {
          const query = currentFilter.toLowerCase().trim();
          const rawText = (log.message || '').toLowerCase();
          if (!rawText.includes(query)) {
            div.style.display = 'none';
          }
        }

        if (terminalBody) {
          terminalBody.appendChild(div);
          terminalBody.scrollTop = terminalBody.scrollHeight;
        }
      } catch (e) {}
    };
  </script>
</body>
</html>`;
}

module.exports = { renderLogsPage };
