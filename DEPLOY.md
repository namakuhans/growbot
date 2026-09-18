# 🚀 Growbot - Multi-Platform Deployment Guide

<p align="center">
  <img src="src/dashboard/public/favicon.png" width="96" height="96" alt="Growbot Deploy Logo" />
</p>

<p align="center">
  <b>Comprehensive deployment instructions for Growbot across Linux (VPS), PM2, Docker, Windows, Systemd, and Game Hosting Panels (Pterodactyl / Pelican).</b>
  <br />
  <i>Panduan lengkap penyebaran & instalasi Growbot di berbagai platform: Linux (VPS), PM2, Docker, Windows, Systemd, dan Game Hosting Panel (Pterodactyl / Pelican).</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-v20.x%2B-green?style=for-the-badge&logo=nodedotjs" alt="Node.js Version" />
  <img src="https://img.shields.io/badge/Docker-Supported-2496ED?style=for-the-badge&logo=docker" alt="Docker Supported" />
  <img src="https://img.shields.io/badge/PM2-Supported-2B037A?style=for-the-badge&logo=pm2" alt="PM2 Supported" />
  <img src="https://img.shields.io/badge/Pterodactyl-Supported-2C3E50?style=for-the-badge&logo=pterodactyl" alt="Pterodactyl Supported" />
</p>

---

## 🌐 Language Navigation / Navigasi Bahasa

- 🇺🇸 [English Deployment Guide](#-english-deployment-guide)
- 🇮🇩 [Panduan Deployment Bahasa Indonesia](#-panduan-deployment-bahasa-indonesia)

---

<a name="-english-deployment-guide"></a>
## 🇺🇸 English Deployment Guide

### 📋 Prerequisites

- **Node.js**: `v20.0.0` or higher (Node 22 LTS recommended for native `node:sqlite` support).
- **npm**: `v9.x` or higher.
- **Git**: Installed on server.

---

### 🖥️ Option 1: Deploy on Linux VPS with PM2 (Recommended)

1. **Install Node.js 22 LTS & PM2**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs git
   sudo npm install -g pm2
   ```

2. **Clone Repository & Install Dependencies**:
   ```bash
   git clone https://github.com/your-username/growbot.git
   cd growbot
   npm install
   ```

3. **Set Up `.env` Configuration**:
   ```bash
   cp .env.example .env
   nano .env
   ```
   Fill in your `DISCORD_TOKEN`, `CLIENT_ID`, `DASHBOARD_PORT`, and `DASHBOARD_PASSWORD`.

4. **Start Application with PM2**:
   ```bash
   pm2 start src/index.js --name "growbot"
   pm2 save
   pm2 startup
   ```

5. **Monitor Logs**:
   ```bash
   pm2 logs growbot
   ```

---

### 🐳 Option 2: Deploy with Docker & Docker Compose

1. **Create `Dockerfile`** (if not already present):
   ```dockerfile
   FROM node:22-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm install --production
   COPY . .
   EXPOSE 3000
   CMD ["node", "src/index.js"]
   ```

2. **Create `docker-compose.yml`**:
   ```yaml
   version: '3.8'
   services:
     growbot:
       build: .
       container_name: growbot
       restart: always
       env_file:
         - .env
       ports:
         - "3000:3000"
       volumes:
         - ./database.sqlite:/app/database.sqlite
         - ./backups:/app/backups
   ```

3. **Build & Run Container**:
   ```bash
   docker compose up -d --build
   ```

---

### ⚙️ Option 3: Deploy as a Systemd Service (Linux)

1. Create a service file `/etc/systemd/system/growbot.service`:
   ```ini
   [Unit]
   Description=Growbot Discord Selfbot AFK Resolver
   After=network.target

   [Service]
   Type=simple
   User=root
   WorkingDirectory=/var/www/growbot
   ExecStart=/usr/bin/node src/index.js
   Restart=always
   RestartSec=10
   Environment=NODE_ENV=production

   [Install]
   WantedBy=multi-user.target
   ```

2. Enable and start the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable growbot
   sudo systemctl start growbot
   ```

---

### 🎮 Option 4: Deploy on Pterodactyl / Pelican Panel

1. Select a **Node.js 20 or 22 Egg**.
2. Set Startup Command to:
   ```bash
   node src/index.js
   ```
3. Upload project files or clone directly into the container terminal.
4. Run `npm install` in the Panel terminal console.
5. Configure environment variables in the Panel Settings tab.
6. Press **Start**.

---

### 🪟 Option 5: Deploy on Windows Server / PC

1. Download and install **Node.js v22 LTS** from [nodejs.org](https://nodejs.org).
2. Open Command Prompt (cmd) or PowerShell as Administrator:
   ```cmd
   git clone https://github.com/your-username/growbot.git
   cd growbot
   npm install
   ```
3. Copy `.env.example` to `.env` and configure credentials.
4. Start the application:
   ```cmd
   node src/index.js
   ```

---

### 🛡️ Firewall & Port Configuration

Ensure the HTTP Dashboard port (default `3000`) is open:
```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 3000/tcp

# FirewallCMD (CentOS/RHEL)
sudo firewall-cmd --zone=public --add-port=3000/tcp --permanent
sudo firewall-cmd --reload
```

---

<a name="-panduan-deployment-bahasa-indonesia"></a>
## 🇮🇩 Panduan Deployment Bahasa Indonesia

### 📋 Prasyarat Sistem

- **Node.js**: Versi `v20.0.0` atau lebih baru (Disarankan Node 22 LTS untuk kompatibilitas penuh `node:sqlite`).
- **npm**: Versi `v9.x` atau lebih baru.
- **Git**: Terinstal pada server/vps.

---

### 🖥️ Opsi 1: Deployment di VPS Linux Menggunakan PM2 (Sangat Direkomendasikan)

1. **Instalasi Node.js 22 LTS & PM2**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs git
   sudo npm install -g pm2
   ```

2. **Clone Repositori & Install Dependensi**:
   ```bash
   git clone https://github.com/username-anda/growbot.git
   cd growbot
   npm install
   ```

3. **Konfigurasi File `.env`**:
   ```bash
   cp .env.example .env
   nano .env
   ```
   Isi `DISCORD_TOKEN`, `CLIENT_ID`, `DASHBOARD_PORT`, dan `DASHBOARD_PASSWORD`.

4. **Jalankan Aplikasi dengan PM2**:
   ```bash
   pm2 start src/index.js --name "growbot"
   pm2 save
   pm2 startup
   ```

5. **Cek Log Aplikasi**:
   ```bash
   pm2 logs growbot
   ```

---

### 🎮 Opsi 2: Deployment di Pterodactyl / Pelican Panel

1. Pilih Egg **Node.js 20 atau 22**.
2. Atur perintah startup ke:
   ```bash
   node src/index.js
   ```
3. Unggah berkas proyek atau clone langsung di konsol terminal panel.
4. Jalankan `npm install` di konsol panel.
5. Konfigurasikan variabel lingkungan di tab variabel panel.
6. Klik **Start / Mulai**.

---

### 💾 Backup Otomatis & Pemulihan Database

Growbot dilengkapi dengan mekanisme **Backup Otomatis 12-Jam** bawaan:
- Berkas cadangan SQLite secara otomatis disimpan di folder `backups/`.
- Sistem secara otomatis menghapus cadangan lama dan hanya menyimpan **1 berkas cadangan terbaru** untuk menghemat penyimpanan server.
- Jika database utama terhapus, Anda cukup menyalin berkas dari `backups/database_backup_*.sqlite` kembali ke `database.sqlite`.

---

## ❓ Troubleshooting & Pertanyaan Umum

- **Error `MODULE_NOT_FOUND`**: Pastikan Anda telah menjalankan `npm install`.
- **Port Dashboard Terpakai**: Ubah `DASHBOARD_PORT` di berkas `.env` ke port lain (misal `8080`).
- **Selfbot Tidak Responsif**: Pastikan token selfbot valid dan tidak terkena verifikasi captcha Discord.
