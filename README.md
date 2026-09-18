# 🤖 Growbot - Discord Selfbot AFK Resolver & Dashboard

<p align="center">
  <img src="src/dashboard/public/favicon.png" width="128" height="128" alt="Growbot Logo" />
</p>

<p align="center">
  <b>A high-performance, modular, and automated Discord Selfbot AFK Verification Resolver, Auto-Buy System, and Management Web Dashboard built with Node.js & SQLite.</b>
  <br />
  <i>Sistem Otomasi Selfbot Resolusi AFK Discord, Auto-Buy, dan Web Dashboard Manajemen Berkinerja Tinggi & Modular.</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-v20%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord.js" />
  <img src="https://img.shields.io/badge/SQLite-node%3Asqlite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/Express.js-v5-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" />
</p>

---

## 🌐 Language / Bahasa

- 🇺🇸 [English Documentation](#-english-documentation)
- 🇮🇩 [Dokumentasi Bahasa Indonesia](#-dokumentasi-bahasa-indonesia)

---

<a name="-english-documentation"></a>
## 🇺🇸 English Documentation

### 🌟 Key Features

- ⚡ **Auto AFK Verification Resolver**: Automatically detects and solves Gamebot AFK prompts in real-time (`IS_COMPONENTS_V2` flag compliant).
- 🛒 **Smart Auto-Buy Locks & Farmables**: Automatically buys BGL, DL, or WL via modal inputs when block count drops below 100, then buys max farmables and resumes auto-farming.
- 🕒 **Human-like Typing & Periodic Slash Commands**: Simulates human typing before executing `/profile` slash commands every 13–20 minutes randomly.
- 📊 **Real-time Web Management Dashboard**: Built-in Express & Tailwind CSS web dashboard (`http://localhost:3000`) featuring:
  - Client-side live auto-polling (3s refresh) for stats and status.
  - Token and User DM Panel management.
  - License management and system settings.
  - Live SSE console logs with syntax-highlighted terminal output.
- 🔑 **Licensing & Whitelist System**:
  - Expiration-based user licenses (`/license <user> <days>`).
  - Automatic purging of expired tokens and DM panel interfaces.
  - Permanent whitelist status for administrators or role holders (`/whitelist`).
- 📁 **Modular Architecture & Native SQLite Persistence**: Uses Node.js native `node:sqlite` (`DatabaseSync`) with 12-hour automated single-latest recovery backups.

---

### 🧱 Project Architecture

```
growbot/
├── 📂 backups/                    # Automated 12-hour SQLite backups
├── 📂 src/
│   ├── 📂 commands/               # Discord Slash Commands (/set, /license, etc.)
│   ├── 📂 config/                 # Application Constants & Environment Setup
│   ├── 📂 dashboard/              # Web Dashboard Express Server
│   │   ├── 📂 middleware/         # Security Headers, Auth & Rate Limiting
│   │   ├── 📂 routes/             # API & Page View Routes
│   │   ├── 📂 services/           # Authentication & Log Buffer Services
│   │   └── 📂 views/              # SSR Views & UI Components
│   ├── 📂 database/               # Native SQLite Database Engine
│   │   ├── 📂 models/             # Modular Data Access Repositories
│   │   ├── 📄 connection.js       # SQLite Connection & Backup Engine
│   │   └── 📄 db.js               # Main Database Facade
│   ├── 📂 handlers/               # Discord Button, Modal & Select Handlers
│   ├── 📂 services/               # Core Services
│   │   ├── 📂 selfbot/            # Modular Selfbot Logic (Patches, Parsers, AutoBuy, Scheduler)
│   │   ├── 📄 selfbotService.js   # Selfbot Facade & Lifecycle Manager
│   │   ├── 📄 panelService.js     # Control Panel Updater
│   │   └── 📄 dmService.js        # DM Panel Updater
│   └── 📄 index.js                # Main Bot Entrypoint
├── 📄 database.sqlite             # Primary SQLite Storage
├── 📄 DEPLOY.md                   # Multi-Platform Deployment Guide
└── 📄 README.md                   # Project Documentation
```

---

### ⚙️ Environment Configuration (`.env`)

Create a `.env` file in the root directory:

```env
# Discord Main Bot Credentials
DISCORD_TOKEN=your_main_discord_bot_token_here
CLIENT_ID=your_discord_bot_client_id_here
ROLE_ID=optional_admin_role_id_here
WHITELISTED_USERS=user_id_1,user_id_2

# Dashboard Web Configuration
DASHBOARD_PORT=3000
DASHBOARD_PASSWORD=your_secure_dashboard_password
```

---

### 📜 Bot Slash Commands

| Command | Usage | Description |
|---|---|---|
| `/set` | `/set <channel>` | Sets the active main control panel channel. |
| `/reset` | `/reset` | Clears active selfbots and DM panels while retaining stats and licenses. |
| `/license` | `/license <user> <days>` | Grants a timed selfbot access license to a target user. |
| `/unlicense` | `/unlicense <user>` | Revokes a user license, stopping their running selfbots. |
| `/whitelist` | `/whitelist <user>` | Permanently whitelists a user. |
| `/unwhitelist` | `/unwhitelist <user>` | Removes a user from the permanent whitelist. |

---

<a name="-dokumentasi-bahasa-indonesia"></a>
## 🇮🇩 Dokumentasi Bahasa Indonesia

### 🌟 Fitur Utama

- ⚡ **Penyelesai Verifikasi AFK Otomatis**: Mendeteksi dan menyelesaikan prompt AFK Gamebot secara real-time (kompatibel dengan flag `IS_COMPONENTS_V2`).
- 🛒 **Auto-Buy Locks & Farmables Cerdas**: Otomatis membeli BGL, DL, atau WL melalui dialog modal ketika jumlah block di bawah 100, lalu membeli farmable maksimal dan melanjutkan auto-farming.
- 🕒 **Pengetikan Manusiawi & Perintah Slash Periodik**: Mensimulasikan pengetikan alami sebelum mengirim perintah slash `/profile` setiap 13–20 menit secara acak.
- 📊 **Web Dashboard Manajemen Real-time**: Dashboard web bawaan Express & Tailwind CSS (`http://localhost:3000`) dengan fitur:
  - Auto-polling statistik live client-side (setiap 3 detik).
  - Manajemen Token Selfbot & Panel DM Pengguna.
  - Manajemen Lisensi Pengguna & Pengaturan Sistem.
  - Console logs SSE live dengan tampilan terminal berwarna.
- 🔑 **Sistem Lisensi & Whitelist**:
  - Lisensi pengguna berbasis durasi hari (`/license <user> <days>`).
  - Pembersihan otomatis token dan panel DM pengguna yang lisensinya kadaluarsa.
  - Status Whitelist permanen untuk administrator atau pemegang peran (`/whitelist`).
- 📁 **Arsitektur Modular & Database SQLite**: Menggunakan `node:sqlite` (`DatabaseSync`) bawaan Node.js dengan backup otomatis recovery 12 jam (menjimpan 1 file backup terbaru).

---

### 🚀 Cara Memulai Cepat

1. **Clone & Install Dependencies**:
   ```bash
   git clone https://github.com/your-repo/growbot.git
   cd growbot
   npm install
   ```

2. **Konfigurasi `.env`**:
   Salin `.env.example` ke `.env` dan isi token bot Anda.

3. **Jalankan Aplikasi**:
   ```bash
   npm start
   ```

---

## 📄 License

This project is licensed under the **MIT License**.
