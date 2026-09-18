function renderSidebar(activeTab = 'overview') {
  return `
  <header class="fixed top-0 left-0 right-0 h-[60px] bg-[#12141d]/95 backdrop-blur-md border-b border-white/10 px-5 flex items-center gap-4 z-[90]">
    <button id="drawer-toggle" class="bg-brand/10 border border-brand/25 text-brand px-3.5 py-2 rounded-lg cursor-pointer flex items-center gap-2 font-bold text-xs hover:bg-brand/20 transition-all" aria-label="Open Navigation Drawer">
      <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
      </svg>
      <span>Menu</span>
    </button>
    <div class="flex items-center gap-2.5">
      <div class="w-8 h-8 bg-brand/15 border border-brand/30 rounded-lg text-brand flex items-center justify-center">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
        </svg>
      </div>
      <div>
        <span class="text-sm font-extrabold text-white block leading-tight">Growbot Dashboard</span>
        <span class="text-[10px] text-gray-400 font-medium block">iHannsy A.K.A MasPakan</span>
      </div>
    </div>
  </header>

  <div id="drawer-overlay" class="hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[98]"></div>

  <aside id="sidebar-drawer" class="w-[270px] bg-[#12141d]/98 backdrop-blur-xl border-r border-white/10 flex flex-col p-4 fixed top-0 bottom-0 left-0 z-[100] -translate-x-full transition-transform duration-300 ease-in-out">
    <div class="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-gradient-to-br from-brand/20 to-brand/5 border border-brand/30 rounded-xl flex items-center justify-center text-brand shadow-[0_0_12px_rgba(55,255,0,0.15)]">
          <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
          </svg>
        </div>
        <div>
          <div class="text-base font-extrabold text-white tracking-tight">Growbot Dashboard</div>
          <div class="text-[11px] text-gray-400 font-medium">iHannsy A.K.A MasPakan</div>
        </div>
      </div>
      <button id="drawer-close" class="bg-transparent border-none text-gray-400 text-2xl cursor-pointer hover:text-white">&times;</button>
    </div>

    <nav class="flex-1 flex flex-col gap-1">
      <div class="text-[10px] font-extrabold text-gray-500 tracking-wider px-3 mb-2">NAVIGATION</div>

      <a href="/" class="px-3.5 py-2.5 text-xs font-semibold rounded-xl flex items-center gap-3 transition-all ${activeTab === 'overview' ? 'text-brand bg-brand/10 border border-brand/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
        </svg>
        <span>Overview</span>
      </a>

      <a href="/selfbots" class="px-3.5 py-2.5 text-xs font-semibold rounded-xl flex items-center gap-3 transition-all ${activeTab === 'selfbots' ? 'text-brand bg-brand/10 border border-brand/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
        </svg>
        <span>All Tokens</span>
      </a>

      <a href="/licenses" class="px-3.5 py-2.5 text-xs font-semibold rounded-xl flex items-center gap-3 transition-all ${activeTab === 'licenses' ? 'text-brand bg-brand/10 border border-brand/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5z"/>
        </svg>
        <span>All Licenses</span>
      </a>

      <a href="/logs" class="px-3.5 py-2.5 text-xs font-semibold rounded-xl flex items-center gap-3 transition-all ${activeTab === 'logs' ? 'text-brand bg-brand/10 border border-brand/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        <span>Console Logs</span>
      </a>

      <a href="/settings" class="px-3.5 py-2.5 text-xs font-semibold rounded-xl flex items-center gap-3 transition-all ${activeTab === 'settings' ? 'text-brand bg-brand/10 border border-brand/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
        <span>Settings</span>
      </a>
    </nav>

    <div class="border-t border-white/10 pt-4 mt-auto">
      <a href="/logout" class="w-full px-3.5 py-2.5 text-xs font-semibold text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2.5 hover:bg-red-500/20 transition-all">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
        </svg>
        <span>Logout Session</span>
      </a>
    </div>
  </aside>

  <script>
    document.addEventListener('DOMContentLoaded', () => {
      const toggleBtn = document.getElementById('drawer-toggle');
      const closeBtn = document.getElementById('drawer-close');
      const drawer = document.getElementById('sidebar-drawer');
      const overlay = document.getElementById('drawer-overlay');

      function openDrawer() {
        if (drawer) drawer.classList.remove('-translate-x-full');
        if (overlay) overlay.classList.remove('hidden');
      }

      function closeDrawer() {
        if (drawer) drawer.classList.add('-translate-x-full');
        if (overlay) overlay.classList.add('hidden');
      }

      if (toggleBtn) toggleBtn.addEventListener('click', openDrawer);
      if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
      if (overlay) overlay.addEventListener('click', closeDrawer);
    });
  </script>`;
}

module.exports = { renderSidebar };
