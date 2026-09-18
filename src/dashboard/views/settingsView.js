const { renderSidebar } = require('./sidebarView');

function renderSettingsPage(msg = '', isError = false) {
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

      <div class="bg-[#12141d]/60 border border-white/10 rounded-2xl p-7 shadow-xl">
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-4">
              <div class="w-11 h-11 rounded-xl bg-brand/10 border border-brand/20 text-brand flex items-center justify-center shrink-0">
                <svg width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="14" rx="1.5"/><path stroke-linecap="round" d="M8 21h8M12 18v3"/>
                </svg>
              </div>
              <div>
                <div class="text-lg font-extrabold text-white">Local Mode</div>
                <div class="text-sm text-gray-400">Running on your machine</div>
              </div>
            </div>
          </div>

          <div class="rounded-xl bg-[#0a0b10]/80 border border-white/10 px-4 py-4">
            <div class="text-sm font-bold text-white">Database Location</div>
            <code class="block mt-1.5 font-mono text-xs text-gray-400">~/growbot/database.sqlite</code>
          </div>

          <form action="/upload-backup" method="POST" enctype="multipart/form-data" class="flex flex-row flex-wrap gap-3 pt-4 border-t border-white/10">
            <a href="/download-backup" class="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-extrabold text-[#0b0c10] bg-brand hover:bg-[#32ea00] border border-brand rounded-lg transition-all shadow-[0_4px_16px_rgba(55,255,0,0.18)]">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              <span>Download Backup</span>
            </a>
            <label class="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-extrabold text-brand bg-brand/10 hover:bg-brand/20 border border-brand/35 rounded-lg transition-all cursor-pointer">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M5 16v1a3 3 0 003 3h8a3 3 0 003-3v-1"/>
              </svg>
              <span>Import Backup</span>
              <input type="file" name="backupFile" accept=".sqlite,.db,application/x-sqlite3" required class="hidden" onchange="this.form.submit()" />
            </label>
          </form>
          <div class="text-xs text-gray-400">Imported backups are applied after the application is restarted.</div>
        </div>
      </div>
    </main>
  </div>
</body>
</html>`;
}

module.exports = { renderSettingsPage };
