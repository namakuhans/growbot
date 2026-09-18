function renderStatCard(id, label, value, subtext, svgIcon) {
  return `
  <div class="bg-[#12141d]/60 border border-white/10 rounded-2xl p-6 flex justify-between items-start transition-all hover:border-brand/30 hover:-translate-y-0.5">
    <div class="flex flex-col">
      <div class="text-[11px] uppercase text-gray-400 font-bold tracking-wider">${label}</div>
      <div id="${id}" class="text-4xl font-extrabold text-white mt-2 tracking-tight">${value}</div>
      <div class="text-xs text-gray-500 mt-1 font-medium">${subtext}</div>
    </div>
    <div class="w-11 h-11 rounded-xl bg-brand/10 border border-brand/20 text-brand flex items-center justify-center shrink-0">
      ${svgIcon}
    </div>
  </div>`;
}

module.exports = { renderStatCard };
