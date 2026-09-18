const db = require('../../database/db');
const { renderSidebar } = require('./sidebarView');
const { renderStatusBadge } = require('./components/statusBadgeComponent');
const { isUserRolePermanent } = require('../../services/roleLicenseService');

async function resolveUserTag(discordClient, userId) {
  if (!userId) return 'N/A';
  if (userId === 'System' || userId === 'Admin') return `@${userId}`;
  if (!/^\d+$/.test(userId)) return userId.startsWith('@') ? userId : `@${userId}`;

  if (discordClient) {
    try {
      const u = await discordClient.users.fetch(userId);
      if (u) return `@${u.username}`;
    } catch (e) {}
  }
  return `@${userId}`;
}

function formatHMSDuration(expiresAt) {
  if (!expiresAt) return 'N/A';
  const remainingMs = expiresAt - Date.now();
  if (remainingMs <= 0) return '00:00:00';

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  return `${hh}:${mm}:${ss}`;
}

async function renderLicensesPage(discordClient) {
  const licensesMap = db.getLicenses();
  const licensesList = await Promise.all(Object.entries(licensesMap).map(async ([userId, lic]) => {
    const userTag = await resolveUserTag(discordClient, userId);
    const grantedByTag = await resolveUserTag(discordClient, lic.grantedBy || 'Admin');
    const isPermanent = await isUserRolePermanent(discordClient, userId, lic);
    return {
      userId,
      userTag,
      grantedByTag,
      isPermanent,
      ...lic
    };
  }));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Growbot Dashboard - Licenses</title>
  <link rel="icon" href="/favicon.png" type="image/png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/output.css">
</head>
<body class="bg-[#0b0c10] text-gray-200 min-h-screen flex font-['Plus_Jakarta_Sans']">
  <div class="flex w-full min-h-screen">
    ${renderSidebar('licenses')}

    <main class="flex-1 pt-24 px-8 pb-8 max-w-[1300px] mx-auto w-full">
      <div class="text-2xl font-extrabold text-white mb-1">Granted System Licenses</div>
      <div class="text-xs text-gray-400 mb-7">Directory of granted access licenses, duration, issuer, and expiration timestamps.</div>

      <div class="flex justify-between items-center mb-4">
        <div class="text-sm font-extrabold text-white flex items-center gap-2.5">
          <span>Granted Licenses Directory</span>
          <span id="licenses-count-badge" class="bg-brand/10 border border-brand/25 text-brand text-xs font-bold px-2.5 py-0.5 rounded-full">${licensesList.length}</span>
        </div>
      </div>
      <div class="bg-[#12141d]/60 border border-white/10 rounded-2xl overflow-hidden mb-8 shadow-xl">
        <div class="overflow-x-auto">
          ${licensesList.length === 0 ? '<div class="p-9 text-center text-gray-500 text-sm font-medium">No granted licenses found.</div>' : `
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-[#0a0b10]/80 text-gray-400 uppercase text-[11px] font-bold border-b border-white/10 tracking-wider">
                <th class="p-4 px-5">User</th>
                <th class="p-4 px-5">Duration</th>
                <th class="p-4 px-5">Granted By</th>
                <th class="p-4 px-5">Granted At</th>
                <th class="p-4 px-5">Expiration Date</th>
                <th class="p-4 px-5">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5">
              ${licensesList.map(lic => {
                const isPermanent = lic.isPermanent || lic.expiresAt === null || lic.durationDays === 0 || lic.grantedBy === 'AUTO_ROLE';
                const isExpired = !isPermanent && lic.expiresAt < Date.now();
                const hmsText = isPermanent ? 'Permanent' : formatHMSDuration(lic.expiresAt);
                const grantedDate = lic.grantedAt ? new Date(lic.grantedAt).toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }) + ' WIB' : 'N/A';
                const expiresDate = isPermanent ? 'Permanent' : (lic.expiresAt ? new Date(lic.expiresAt).toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }) + ' WIB' : 'N/A');
                const statusBadge = isPermanent
                  ? renderStatusBadge('Permanent', 'active')
                  : renderStatusBadge(isExpired ? 'Expired' : 'Active', isExpired ? 'expired' : 'active');
                return `
                <tr class="hover:bg-white/[0.02] transition-colors">
                  <td class="p-4 px-5"><code class="font-mono bg-brand/10 border border-brand/20 text-brand font-bold px-2 py-1 rounded text-[11px]">${lic.userTag}</code></td>
                  <td class="p-4 px-5"><strong class="${isPermanent ? 'text-brand' : 'text-white'} text-xs font-bold font-mono">${hmsText}</strong></td>
                  <td class="p-4 px-5"><code class="font-mono bg-white/5 border border-white/10 text-gray-200 px-2 py-1 rounded text-[11px]">${lic.grantedByTag}</code></td>
                  <td class="p-4 px-5 text-gray-400 text-xs font-medium">${grantedDate}</td>
                  <td class="p-4 px-5 ${isPermanent ? 'text-brand font-bold' : 'text-gray-400'} text-xs font-medium">${expiresDate}</td>
                  <td class="p-4 px-5">
                    ${statusBadge}
                  </td>
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
    function formatHMSDurationClient(expiresAt) {
      if (!expiresAt) return 'N/A';
      const remainingMs = expiresAt - Date.now();
      if (remainingMs <= 0) return '00:00:00';

      const totalSeconds = Math.floor(remainingMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      const hh = String(hours).padStart(2, '0');
      const mm = String(minutes).padStart(2, '0');
      const ss = String(seconds).padStart(2, '0');

      return hh + ':' + mm + ':' + ss;
    }

    async function updateLicensesData() {
      try {
        const res = await fetch('/api/licenses');
        if (!res.ok) return;
        const data = await res.json();

        document.getElementById('licenses-count-badge').textContent = data.licenses.length;
        const tableContainer = document.querySelector('.overflow-x-auto');
        if (tableContainer) {
          if (data.licenses.length === 0) {
            tableContainer.innerHTML = '<div class="p-9 text-center text-gray-500 text-sm font-medium">No granted licenses found.</div>';
          } else {
            const rowsHtml = data.licenses.map(lic => {
              const isPermanent = lic.isPermanent || lic.expiresAt === null || lic.durationDays === 0 || lic.grantedBy === 'AUTO_ROLE';
              const isExpired = !isPermanent && lic.expiresAt < Date.now();
              const hmsText = isPermanent ? 'Permanent' : formatHMSDurationClient(lic.expiresAt);
              const grantedDate = lic.grantedAt ? new Date(lic.grantedAt).toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }) + ' WIB' : 'N/A';
              const expiresDate = isPermanent ? 'Permanent' : (lic.expiresAt ? new Date(lic.expiresAt).toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }) + ' WIB' : 'N/A');
              const badgeClass = isPermanent
                ? 'bg-brand/10 border-brand/30 text-brand'
                : (isExpired ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-brand/10 border-brand/30 text-brand');
              const statusLabel = isPermanent ? 'Permanent' : (isExpired ? 'Expired' : 'Active');

              return \`
              <tr class="hover:bg-white/[0.02] transition-colors">
                <td class="p-4 px-5"><code class="font-mono bg-brand/10 border border-brand/20 text-brand font-bold px-2 py-1 rounded text-[11px]">\${lic.userTag || ('@' + lic.userId)}</code></td>
                <td class="p-4 px-5"><strong class="\${isPermanent ? 'text-brand' : 'text-white'} text-xs font-bold font-mono">\${hmsText}</strong></td>
                <td class="p-4 px-5"><code class="font-mono bg-white/5 border border-white/10 text-gray-200 px-2 py-1 rounded text-[11px]">\${lic.grantedByTag || ('@' + (lic.grantedBy || 'Admin'))}</code></td>
                <td class="p-4 px-5 text-gray-400 text-xs font-medium">\${grantedDate}</td>
                <td class="p-4 px-5 \${isPermanent ? 'text-brand font-bold' : 'text-gray-400'} text-xs font-medium">\${expiresDate}</td>
                <td class="p-4 px-5">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border \${badgeClass}">
                    \${statusLabel}
                  </span>
                </td>
              </tr>\`;
            }).join('');

            tableContainer.innerHTML = \`
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-[#0a0b10]/80 text-gray-400 uppercase text-[11px] font-bold border-b border-white/10 tracking-wider">
                  <th class="p-4 px-5">User</th>
                  <th class="p-4 px-5">Duration</th>
                  <th class="p-4 px-5">Granted By</th>
                  <th class="p-4 px-5">Granted At</th>
                  <th class="p-4 px-5">Expiration Date</th>
                  <th class="p-4 px-5">Status</th>
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

    setInterval(updateLicensesData, 3000);
  </script>
</body>
</html>`;
}

module.exports = { renderLicensesPage };
