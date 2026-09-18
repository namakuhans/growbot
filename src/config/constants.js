function getDynamicFooterText() {
  const now = new Date();
  const wibDate = new Date(now.getTime() + (7 * 60 * 60 * 1000) + (now.getTimezoneOffset() * 60 * 1000));

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const dayName = days[wibDate.getDay()];
  const monthName = months[wibDate.getMonth()];
  const dateNum = wibDate.getDate();
  const year = wibDate.getFullYear();

  const hours = String(wibDate.getHours()).padStart(2, '0');
  const minutes = String(wibDate.getMinutes()).padStart(2, '0');
  const seconds = String(wibDate.getSeconds()).padStart(2, '0');

  const formattedDate = `${dayName}, ${monthName} ${dateNum}, ${year} | ${hours}:${minutes}:${seconds} (WIB)`;
  return `-# ! iHannsy A.K.A MasPakan - Aurhelana ©\n-# Growcord Automated | Last Update - ${formattedDate}`;
}

module.exports = {
  BANNER_URL: 'https://cdn.discordapp.com/attachments/1393337962401366076/1546805425934966794/Proyek_Baru_145_6A42106.gif?ex=6aa7b5cf&is=6aa6644f&hm=6b10122b9042a37564950b4c23c02cd6e01e2f98d44fd8c9797c89bf1d881466&',
  FOOTER_TEXT: getDynamicFooterText(),
  getDynamicFooterText,
  GAMEBOT_ID: '1298187837749067776',
  APPLICATION_ID: '1427031951449260142',
  FARM_START_CHANNEL_ID: '1547102656038834296'
};
