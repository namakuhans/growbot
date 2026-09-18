const { renderSidebar } = require('./sidebarView');

function renderSettingsPage(msg = '', isError = false) {
  const port = process.env.DASHBOARD_PORT || '3000';
  const host = process.env.DASHBOARD_HOST || '0.0.0.0';
  const roleId = process.env.ROLE_ID || 'Not Configured';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Growbot Dashboard - Settings</title>
  <link rel="icon" href="/favicon.png" type="image/png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/output.css">
</head>
<body class="bg-[#0b0c10] text-gray-200 min-h-screen flex font-['Plus_Jakarta_Sans']">
  <div class="flex w-full min-h-screen">
    ${renderSidebar('settings')}

    <main class="flex-1 pt-24 px-8 pb-8 max-w-[1300px] mx-auto w-full">
      <div class="text-2xl font-extrabold text-white mb-1">Environment Settings</div>
      <div class="text-xs text-gray-400 mb-7">Inspect dashboard network bindings, Discord authorization parameters, manage security credentials, and database backup tools.</div>

      ${msg ? `
        <div class="p-3.5 px-4 rounded-xl text-xs font-semibold mb-6 flex items-center gap-2.5 ${isError ? 'bg-red-500/10 border border-red-500/30 text-red-300' : 'bg-brand/10 border border-brand/30 text-brand'}">
          <span>${msg}</span>
        </div>
      ` : ''}

      <div class="bg-[#12141d]/60 border border-white/10 rounded-2xl p-7 mb-6">
        <div class="text-base font-extrabold text-white mb-4 flex items-center gap-2">🔒 Security & Credentials</div>
        <form action="/change-password" method="POST">
          <div class="mb-4">
            <label class="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Current Password</label>
            <input type="password" name="currentPassword" class="w-full bg-[#0a0b10]/80 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all" placeholder="Enter current password..." required />
          </div>
          <div class="mb-4">
            <label class="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">New Password</label>
            <input type="password" name="newPassword" class="w-full bg-[#0a0b10]/80 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all" placeholder="Enter new password..." required />
          </div>
          <div class="mb-5">
            <label class="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Confirm New Password</label>
            <input type="password" name="confirmPassword" class="w-full bg-[#0a0b10]/80 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all" placeholder="Confirm new password..." required />
          </div>
          <button type="submit" class="bg-brand hover:bg-[#32ea00] text-[#0b0c10] border-none px-6 py-3 rounded-xl text-xs font-extrabold cursor-pointer transition-all shadow-[0_4px_16px_rgba(55,255,0,0.2)]">Update Dashboard Password</button>
        </form>
      </div>

      <div class="bg-[#12141d]/60 border border-white/10 rounded-2xl p-7 mb-6">
        <div class="text-base font-extrabold text-white mb-4">Server & System Parameters</div>

        <div class="flex justify-between items-center py-3.5 border-b border-white/5">
          <div>
            <div class="text-sm font-semibold text-white">Dashboard Host</div>
            <div class="text-xs text-gray-400 mt-0.5">Network interface binding address</div>
          </div>
          <code class="font-mono bg-white/5 px-2.5 py-1 rounded-md border border-white/10 text-xs text-brand">${host}</code>
        </div>

        <div class="flex justify-between items-center py-3.5 border-b border-white/5">
          <div>
            <div class="text-sm font-semibold text-white">Dashboard Port</div>
            <div class="text-xs text-gray-400 mt-0.5">Active HTTP listening port</div>
          </div>
          <code class="font-mono bg-white/5 px-2.5 py-1 rounded-md border border-white/10 text-xs text-brand">${port}</code>
        </div>

        <div class="flex justify-between items-center py-3.5 border-b border-white/5">
          <div>
            <div class="text-sm font-semibold text-white">Whitelisted Role ID</div>
            <div class="text-xs text-gray-400 mt-0.5">Discord Role required for bot command execution</div>
          </div>
          <code class="font-mono bg-white/5 px-2.5 py-1 rounded-md border border-white/10 text-xs text-brand">${roleId}</code>
        </div>

        <div class="flex justify-between items-center py-3.5 border-b-0">
          <div>
            <div class="text-sm font-semibold text-white">Database Storage Engine</div>
            <div class="text-xs text-gray-400 mt-0.5">High-performance native SQLite storage driver</div>
          </div>
          <code class="font-mono bg-white/5 px-2.5 py-1 rounded-md border border-white/10 text-xs text-brand">node:sqlite (DatabaseSync)</code>
        </div>
      </div>

      <div class="bg-[#12141d]/60 border border-white/10 rounded-2xl p-7">
        <div class="text-base font-extrabold text-white mb-4">Database Export & Backup</div>
        <div class="flex justify-between items-center py-2">
          <div>
            <div class="text-sm font-semibold text-white">SQLite Backup Download</div>
            <div class="text-xs text-gray-400 mt-0.5">Download a complete copy of the live database.sqlite file</div>
          </div>
          <a href="/download-db" class="inline-flex items-center gap-2.5 px-5 py-3 text-xs font-bold text-[#0b0c10] bg-brand hover:bg-[#32ea00] rounded-xl transition-all shadow-[0_4px_16px_rgba(55,255,0,0.2)]">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            <span>Download Database</span>
          </a>
        </div>
      </div>
    </main>
  </div>
</body>
</html>`;
}

module.exports = { renderSettingsPage };
