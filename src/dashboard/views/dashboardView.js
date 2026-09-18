const db = require('../../database/db');
const { renderSidebar } = require('./sidebarView');
const { renderStatCard } = require('./components/statCardComponent');
const { renderStatusBadge } = require('./components/statusBadgeComponent');
const { isUserRolePermanent } = require('../../services/roleLicenseService');

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function renderDashboardPage(discordClient) {
  const stats = db.getStats();
  const selfbots = db.getSelfbots();
  const userDmPanelsMap = db.getUserDmPanels();
  const licensesMap = db.getLicenses();

  const allUserIdsSet = new Set();
  selfbots.forEach(sb => { if (sb.userId) allUserIdsSet.add(sb.userId); });
  Object.keys(userDmPanelsMap).forEach(uid => allUserIdsSet.add(uid));
  Object.keys(licensesMap).forEach(uid => allUserIdsSet.add(uid));
  const totalAllUsersCount = allUserIdsSet.size;

  const activeSelfbotOwnersSet = new Set();
  selfbots.forEach(sb => { if (sb.userId) activeSelfbotOwnersSet.add(sb.userId); });
  const activeSelfbotOwnersCount = activeSelfbotOwnersSet.size;

  const totalSelfbotsCount = selfbots.length;
  const totalResolvedCount = stats.totalResolved || 0;
  const totalLicensesCount = Object.keys(licensesMap).length;
  const totalUserDmPanelsCount = Object.keys(userDmPanelsMap).length;

  const userOwnersList = await Promise.all(Array.from(allUserIdsSet).map(async (userId) => {
    let username = `@${userId}`;
    if (discordClient) {
      try {
        const userObj = await discordClient.users.fetch(userId);
        if (userObj) {
          username = `@${userObj.username}`;
        }
      } catch (err) {}
    }

    const userSelfbots = selfbots.filter(s => s.userId === userId);
    const license = licensesMap[userId];
    const isPermanent = await isUserRolePermanent(discordClient, userId, license);
    const hasDmPanel = !!userDmPanelsMap[userId];

    let licenseStatusText = 'None';
    let licenseStatusType = 'inactive';
    if (isPermanent) {
      licenseStatusText = 'Permanent';
      licenseStatusType = 'active';
    } else if (license) {
      if (license.expiresAt && license.expiresAt > Date.now()) {
        licenseStatusText = `Active (${license.durationDays}d)`;
        licenseStatusType = 'active';
      } else {
        licenseStatusText = 'Expired';
        licenseStatusType = 'expired';
      }
    }

    return {
      userId,
      username,
      selfbotCount: userSelfbots.length,
      licenseStatusText,
      licenseStatusType,
      hasDmPanel
    };
  }));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Growbot Dashboard - Overview</title>
  <link rel="icon" href="/favicon.png" type="image/png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/output.css">
</head>
<body class="bg-[#0b0c10] text-gray-200 min-h-screen flex font-['Plus_Jakarta_Sans']">
  <div class="flex w-full min-h-screen">
    ${renderSidebar('overview')}

    <main class="flex-1 pt-24 px-8 pb-8 max-w-[1300px] mx-auto w-full">
      <div class="text-2xl font-extrabold text-white mb-1">System Overview</div>
      <div class="text-xs text-gray-400 mb-7">Real-time aggregate summary metrics across all users, tokens, licenses, and DM management panels.</div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        ${renderStatCard('stat-total-users', 'Total System Users', totalAllUsersCount, 'Unique users across all records', '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>')}
        ${renderStatCard('stat-active-owners', 'Running Token Owners', activeSelfbotOwnersCount, 'Users with active tokens', '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>')}
        ${renderStatCard('stat-active-tokens', 'Total Active Tokens', totalSelfbotsCount, 'Running accounts across threads', '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>')}
        ${renderStatCard('stat-prompts-solved', 'AFK Prompts Solved', totalResolvedCount, 'Successful auto-solves', '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>')}
        ${renderStatCard('stat-granted-licenses', 'Granted Licenses', totalLicensesCount, 'Active license grants', '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5z"/></svg>')}
        ${renderStatCard('stat-dm-panels', 'User DM Panels', totalUserDmPanelsCount, 'Unique user DM panels (summarized)', '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>')}
      </div>

      <div class="flex justify-between items-center mb-4 mt-9">
        <div class="text-sm font-extrabold text-white flex items-center gap-2.5">
          <span>👥 User Owners Directory</span>
          <span id="user-count-badge" class="bg-brand/10 border border-brand/25 text-brand text-xs font-bold px-2.5 py-0.5 rounded-full">${userOwnersList.length}</span>
        </div>
      </div>
      <div class="bg-[#12141d]/60 border border-white/10 rounded-2xl overflow-hidden mb-8 shadow-xl">
        <div class="overflow-x-auto">
          ${userOwnersList.length === 0 ? '<div class="p-9 text-center text-gray-500 text-sm font-medium">No registered user owners found.</div>' : `
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-[#0a0b10]/80 text-gray-400 uppercase text-[11px] font-bold border-b border-white/10 tracking-wider">
                <th class="p-4 px-5">User Details</th>
                <th class="p-4 px-5">Active Tokens</th>
                <th class="p-4 px-5">License Status</th>
                <th class="p-4 px-5">DM Management Panel</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5">
              ${userOwnersList.map(u => `
              <tr class="hover:bg-white/[0.02] transition-colors">
                <td class="p-4 px-5">
                  <div class="flex flex-col gap-0.5">
                    <span class="font-bold text-white text-sm">${escapeHtml(u.username)}</span>
                    <span class="text-[11px] text-gray-400 font-mono">ID: ${escapeHtml(u.userId)}</span>
                  </div>
                </td>
                <td class="p-4 px-5"><strong class="${u.selfbotCount > 0 ? 'text-brand' : 'text-gray-400'}">${u.selfbotCount} Token(s)</strong></td>
                <td class="p-4 px-5">${renderStatusBadge(u.licenseStatusText, u.licenseStatusType)}</td>
                <td class="p-4 px-5">
                  ${renderStatusBadge(u.hasDmPanel ? 'Active' : 'None', u.hasDmPanel ? 'active' : 'inactive')}
                </td>
              </tr>
              `).join('')}
            </tbody>
          </table>`}
        </div>
      </div>
    </main>
  </div>

  <script>
    async function updateOverviewData() {
      try {
        const res = await fetch('/api/overview');
        if (!res.ok) return;
        const data = await res.json();

        document.getElementById('stat-total-users').textContent = data.totalAllUsersCount;
        document.getElementById('stat-active-owners').textContent = data.activeSelfbotOwnersCount;
        document.getElementById('stat-active-tokens').textContent = data.totalSelfbotsCount;
        document.getElementById('stat-prompts-solved').textContent = data.totalResolvedCount;
        document.getElementById('stat-granted-licenses').textContent = data.totalLicensesCount;
        document.getElementById('stat-dm-panels').textContent = data.totalUserDmPanelsCount;
        document.getElementById('user-count-badge').textContent = data.userOwnersList.length;

        const tableContainer = document.querySelector('.overflow-x-auto');
        if (tableContainer) {
          if (data.userOwnersList.length === 0) {
            tableContainer.innerHTML = '<div class="p-9 text-center text-gray-500 text-sm font-medium">No registered user owners found.</div>';
          } else {
            const rowsHtml = data.userOwnersList.map(u => {
              const badgeClass = u.licenseStatusType === 'active'
                ? 'bg-brand/10 border-brand/30 text-brand'
                : u.licenseStatusType === 'expired'
                  ? 'bg-red-500/10 border-red-500/30 text-red-300'
                  : 'bg-gray-500/10 border-gray-500/30 text-gray-400';

              const dmBadgeClass = u.hasDmPanel
                ? 'bg-brand/10 border-brand/30 text-brand'
                : 'bg-gray-500/10 border-gray-500/30 text-gray-400';

              return \`
              <tr class="hover:bg-white/[0.02] transition-colors">
                <td class="p-4 px-5">
                  <div class="flex flex-col gap-0.5">
                    <span class="font-bold text-white text-sm">\${u.username}</span>
                    <span class="text-[11px] text-gray-400 font-mono">ID: \${u.userId}</span>
                  </div>
                </td>
                <td class="p-4 px-5"><strong class="\${u.selfbotCount > 0 ? 'text-brand' : 'text-gray-400'}">\${u.selfbotCount} Token(s)</strong></td>
                <td class="p-4 px-5">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border \${badgeClass}">
                    \${u.licenseStatusText}
                  </span>
                </td>
                <td class="p-4 px-5">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border \${dmBadgeClass}">
                    \${u.hasDmPanel ? 'Active' : 'None'}
                  </span>
                </td>
              </tr>\`;
            }).join('');

            tableContainer.innerHTML = \`
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-[#0a0b10]/80 text-gray-400 uppercase text-[11px] font-bold border-b border-white/10 tracking-wider">
                  <th class="p-4 px-5">User Details</th>
                  <th class="p-4 px-5">Active Tokens</th>
                  <th class="p-4 px-5">License Status</th>
                  <th class="p-4 px-5">DM Management Panel</th>
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

    setInterval(updateOverviewData, 3000);
  </script>
</body>
</html>`;
}

module.exports = { renderDashboardPage };
