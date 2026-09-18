function renderLoginPage(errorMessage = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Growbot Dashboard - Authentication</title>
  <link rel="icon" href="/favicon.png" type="image/png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/output.css">
</head>
<body class="bg-[#0b0c10] text-gray-200 min-h-screen flex items-center justify-center p-5 font-['Plus_Jakarta_Sans']">
  <div class="bg-[#12141d]/70 border border-white/10 rounded-2xl p-8 w-full max-w-[420px] shadow-2xl backdrop-blur-xl">
    <div class="w-14 h-14 bg-gradient-to-br from-brand/20 to-brand/5 border border-brand/30 rounded-xl flex items-center justify-center text-brand mx-auto mb-5 shadow-[0_0_16px_rgba(55,255,0,0.15)]">
      <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
      </svg>
    </div>

    <div class="text-2xl font-extrabold text-white text-center mb-1 tracking-tight">Growbot Dashboard</div>
    <div class="text-xs text-gray-400 text-center mb-7">iHannsy A.K.A MasPakan</div>

    ${errorMessage ? `
      <div class="bg-red-500/10 border border-red-500/25 text-red-300 p-3 rounded-xl text-xs mb-5 flex items-center gap-2.5">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>${errorMessage}</span>
      </div>
    ` : ''}

    <form action="/login" method="POST">
      <div class="mb-6">
        <label class="block text-[11px] font-bold uppercase text-gray-400 mb-2 tracking-wider" for="password">Security Password</label>
        <input type="password" id="password" name="password" class="w-full bg-[#0a0b10]/60 border border-white/10 rounded-xl p-3.5 text-white text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all" placeholder="Enter dashboard password..." required autofocus />
      </div>

      <button type="submit" class="w-full bg-brand hover:bg-[#32ea00] text-[#0b0c10] font-extrabold rounded-xl py-3.5 text-sm transition-all shadow-[0_4px_16px_rgba(55,255,0,0.25)] cursor-pointer">Authenticate Session</button>
    </form>

    <div class="text-center text-[11px] text-gray-500 mt-6">
      Protected Web Hub • Licensed System Session
    </div>
  </div>
</body>
</html>`;
}

module.exports = { renderLoginPage };
