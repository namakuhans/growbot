const db = require('../../database/db');
const { renderSidebar } = require('./sidebarView');

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderSelfbotsPage() {
  const selfbots = db.getSelfbots();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Growbot Dashboard - Tokens</title>
  <link rel="icon" href="/favicon.png" type="image/png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/output.css">
</head>
<body class="bg-[#0b0c10] text-gray-200 min-h-screen flex font-['Plus_Jakarta_Sans']">
  <div class="flex w-full min-h-screen">
    ${renderSidebar('selfbots')}

    <main class="flex-1 pt-24 px-8 pb-8 max-w-[1300px] mx-auto w-full">
      <div class="text-2xl font-extrabold text-white mb-1">All Active Tokens</div>
      <div class="text-xs text-gray-400 mb-7">Detailed directory of all registered token accounts, thread IDs, and owner user accounts.</div>

      <div class="flex justify-between items-center mb-4">
        <div class="text-sm font-extrabold text-white flex items-center gap-2.5">
          <span>🤖 Active Registered Tokens Directory</span>
          <span id="tokens-count-badge" class="bg-brand/10 border border-brand/25 text-brand text-xs font-bold px-2.5 py-0.5 rounded-full">${selfbots.length}</span>
        </div>
      </div>
      <div class="bg-[#12141d]/60 border border-white/10 rounded-2xl overflow-hidden mb-8 shadow-xl">
        <div class="overflow-x-auto">
          ${selfbots.length === 0 ? '<div class="p-9 text-center text-gray-500 text-sm font-medium">No active tokens registered yet.</div>' : `
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-[#0a0b10]/80 text-gray-400 uppercase text-[11px] font-bold border-b border-white/10 tracking-wider">
                <th class="p-4 px-5">Account Display Name</th>
                <th class="p-4 px-5">Owner User ID</th>
                <th class="p-4 px-5">Assigned Thread ID</th>
                <th class="p-4 px-5">Masked Token</th>
                <th class="p-4 px-5">Last Updated</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5">
              ${selfbots.map(sb => {
                const maskedToken = sb.token ? `${sb.token.substring(0, 10)}...${sb.token.substring(sb.token.length - 6)}` : 'N/A';
                const formattedDate = sb.updatedAt ? new Date(sb.updatedAt).toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }) + ' WIB' : 'N/A';
                return `
                <tr class="hover:bg-white/[0.02] transition-colors">
                  <td class="p-4 px-5"><strong class="text-white text-sm font-bold">${escapeHtml(sb.displayName || 'Unknown Account')}</strong></td>
                  <td class="p-4 px-5"><code class="font-mono bg-white/5 border border-white/10 text-gray-200 px-2 py-1 rounded text-[11px]">${escapeHtml(sb.userId || 'N/A')}</code></td>
                  <td class="p-4 px-5"><code class="font-mono bg-white/5 border border-white/10 text-gray-200 px-2 py-1 rounded text-[11px]">${escapeHtml(sb.threadId ? '#' + sb.threadId : 'N/A')}</code></td>
                  <td class="p-4 px-5"><code class="font-mono bg-white/5 border border-white/10 text-gray-200 px-2 py-1 rounded text-[11px]">${escapeHtml(maskedToken)}</code></td>
                  <td class="p-4 px-5 text-gray-400 text-xs font-medium">${formattedDate}</td>
                </tr>
                `;
              }).join('')}
            </tbody>
          </table>`}
        </div>
      </div>
    </main>
  </div>

  <script>
    async function updateTokensData() {
      try {
        const res = await fetch('/api/tokens');
        if (!res.ok) return;
        const data = await res.json();

        document.getElementById('tokens-count-badge').textContent = data.selfbots.length;
        const tableContainer = document.querySelector('.overflow-x-auto');
        if (tableContainer) {
          if (data.selfbots.length === 0) {
            tableContainer.innerHTML = '<div class="p-9 text-center text-gray-500 text-sm font-medium">No active tokens registered yet.</div>';
          } else {
            const rowsHtml = data.selfbots.map(sb => {
              const maskedToken = sb.token ? \`\${sb.token.substring(0, 10)}...\${sb.token.substring(sb.token.length - 6)}\` : 'N/A';
              const formattedDate = sb.updatedAt ? new Date(sb.updatedAt).toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }) + ' WIB' : 'N/A';
              return \`
              <tr class="hover:bg-white/[0.02] transition-colors">
                <td class="p-4 px-5"><strong class="text-white text-sm font-bold">\${sb.displayName || 'Unknown Account'}</strong></td>
                <td class="p-4 px-5"><code class="font-mono bg-white/5 border border-white/10 text-gray-200 px-2 py-1 rounded text-[11px]">\${sb.userId || 'N/A'}</code></td>
                <td class="p-4 px-5"><code class="font-mono bg-white/5 border border-white/10 text-gray-200 px-2 py-1 rounded text-[11px]">\${sb.threadId ? '#' + sb.threadId : 'N/A'}</code></td>
                <td class="p-4 px-5"><code class="font-mono bg-white/5 border border-white/10 text-gray-200 px-2 py-1 rounded text-[11px]">\${maskedToken}</code></td>
                <td class="p-4 px-5 text-gray-400 text-xs font-medium">\${formattedDate}</td>
              </tr>\`;
            }).join('');

            tableContainer.innerHTML = \`
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-[#0a0b10]/80 text-gray-400 uppercase text-[11px] font-bold border-b border-white/10 tracking-wider">
                  <th class="p-4 px-5">Account Display Name</th>
                  <th class="p-4 px-5">Owner User ID</th>
                  <th class="p-4 px-5">Assigned Thread ID</th>
                  <th class="p-4 px-5">Masked Token</th>
                  <th class="p-4 px-5">Last Updated</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5">
                \${rowsHtml}
              </tbody>
            </table>\`;
          }
        }
      } catch (e) {}
    }

    setInterval(updateTokensData, 3000);
  </script>
</body>
</html>`;
}

module.exports = { renderSelfbotsPage };
