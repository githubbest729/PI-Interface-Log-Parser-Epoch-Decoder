# 🛰️ PI Interface Log Parser & Epoch Decoder

[![Deploy to GitHub Pages](https://github.com/githubbest729/PI-Interface-Log-Parser-Epoch-Decoder/actions/workflows/deploy.yml/badge.svg)](https://github.com/githubbest729/PI-Interface-Log-Parser-Epoch-Decoder/actions/workflows/deploy.yml)
![Version](https://img.shields.io/badge/version-1.0.0-38bdf8)
![PWA](https://img.shields.io/badge/PWA-installable-5a0fc8)
![Offline](https://img.shields.io/badge/works-offline-10b981)
![No backend](https://img.shields.io/badge/backend-none-64748b)
![React](https://img.shields.io/badge/React-19-149eca)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8)

**Paste a messy PI interface log. Get plain-English answers in milliseconds. Everything runs in your browser.**

### 👉 [Open the live app](https://githubbest729.github.io/PI-Interface-Log-Parser-Epoch-Decoder/)

<!-- Add a screenshot: upload it to a docs/ folder, then replace this comment with:
![App screenshot](docs/screenshot.png)
-->

---

## 😩 The problem

When a PI interface stops sending data, the first step is reading `pipc.log` or the OPC interface message log.

These logs are huge walls of text full of cryptic error codes like `-10722` and raw Unix timestamps like `1769329005` that are impossible to read at a glance.

## ✅ The solution

Paste the log into this app. It instantly:

- highlights the errors that matter,
- explains each error code in plain English with a suggested fix,
- turns raw timestamps into readable dates,
- hides the noise so you only see errors and warnings.

No install, no server, no uploads.

---

## ✨ Features (v1.0, 2026)

| Feature | What it does |
| --- | --- |
| 📋 **Paste any log** | Drop in text from `pipc.log` or OPC interface logs. Big logs stay responsive. |
| 🔴 **Instant error translation** | Known PI, OPC/COM and Winsock error codes are highlighted in red with a plain-English meaning and a suggested fix, right under the line. |
| 🧾 **Detected error codes panel** | A summary of every known code found, how many times it appeared, and the first line where it showed up. |
| 🕒 **Timestamp conversion** | Unix epoch values (10-digit seconds and 13-digit milliseconds) are decoded next to the original number. Switch between your local time zone and UTC. |
| 🧮 **Epoch decoder** | A quick box to convert any single epoch value, with a Now button. |
| 🎚️ **Log filtering** | One click to show **All**, **Errors + Warnings**, or **Errors only**. Info and debug lines are hidden when you want them gone. |
| 📊 **Live line counts** | See errors, warnings, info and debug totals at a glance. |
| 📲 **Share button** | Uses your device's native share sheet (WhatsApp, Messenger, email and more). Falls back to copying the link. |
| 📴 **Works offline** | Installable as an app. After the first load it runs with no network connection. |
| 🌙 **Dark mode UI** | Easy on the eyes in control rooms and on tablets. |

---

## ⏱️ Try it in 30 seconds

1. Open the [live app](https://githubbest729.github.io/PI-Interface-Log-Parser-Epoch-Decoder/).
2. Click **Load sample**.
3. Look at the red highlights and the **Detected error codes** panel.
4. Click **Errors + Warnings** to hide the noise.
5. Click the clock button to flip timestamps between local time and UTC.

### Before and after

```text
BEFORE
1769329005 opcint1> [-10722] PINET: Timeout on PI RPC or system call

AFTER
1769329005 → 25 Jan 2026, 08:16:45 UTC
[-10722]  PINET: Timeout on PI RPC or system call
  Meaning: the request to the PI Data Archive got no reply in time.
  Fix: check latency, firewall rules for TCP 5450, and PI server load.
```

---

## 📖 Built-in error dictionary

| Family | Codes |
| --- | --- |
| **PI** | `-10722` (PINET timeout), `-10401` (no read access), `-10402` (no write access) |
| **OPC / COM / DCOM** | `0x800706BA` (RPC server unavailable), `0x800706BE` (RPC call failed), `0x80070005` (access denied), `0x80040154` (class not registered), `0x80080005` (server execution failed), `0xC0040001`, `0xC0040004`, `0xC0040006`, `0xC0040007`, `0xC0040008` (OPC DA item and handle errors) |
| **Winsock** | `10048`, `10051`, `10053`, `10054` (connection reset), `10060` (timed out), `10061` (refused), `10065` |

> The dictionary is a starting set. Always confirm critical codes against the official AVEVA documentation.

### ➕ Add your own error codes

Open `src/piErrors.js`, add an entry, and commit. The site rebuilds automatically.

```js
'-10xxx': {
  label: '-10xxx',
  title: 'Short name of the error',
  severity: 'error',
  meaning: 'What it means in plain English.',
  fix: 'What to check first.',
},
```

---

## 📲 Install it as an app

- **Chrome or Edge (Windows, Android):** click the install icon in the address bar, or menu → Install app.
- **iPad or iPhone (Safari):** Share → Add to Home Screen.

Once installed, it opens like a normal app and works offline.

> For locked-down plant networks: open the app once on a machine that can reach the site, or host the built files on an internal web server. After that first load, no internet is needed.

---

## 🔒 Privacy and security

- **No backend.** There is no server, database or API.
- **Your logs never leave the browser.** Parsing is done locally with JavaScript and regular expressions.
- **No trackers, no analytics, no external fonts or scripts.**
- The service worker only caches files from this app's own address.

---

## 🚀 Deploy your own copy

1. Fork or copy this repository.
2. In `vite.config.js`, set `base` to your repository name, for example `'/my-repo-name/'`.
3. In `index.html`, replace the repository URL in the canonical, Open Graph, Twitter and JSON-LD tags.
4. Go to **Settings → Pages** and set **Source** to **GitHub Actions**.
5. Commit to `main`. The workflow in `.github/workflows/deploy.yml` builds and publishes the site.

## 🧰 Tech stack

React · Vite · Tailwind CSS · lucide-react · Service Worker · GitHub Actions · GitHub Pages

## 🗂️ Project structure

```text
├── .github/workflows/deploy.yml   Build and deploy to GitHub Pages
├── public/                        manifest.json, sw.js, icons
├── src/
│   ├── App.jsx                    UI, parsing, filtering, timestamps
│   ├── piErrors.js                Error code dictionary
│   ├── main.jsx                   App entry and service worker registration
│   └── index.css                  Tailwind import
├── index.html                     SEO, Open Graph, JSON-LD
└── vite.config.js                 Vite config (base path)
```

## 💡 Ideas for future versions

- Import a custom error dictionary from a file
- Export the filtered log as a text or CSV file
- Support more PI timestamp formats
- More PI, OPC UA and buffer subsystem error codes

---

## ⚠️ Disclaimer

This is an independent tool and is not affiliated with or endorsed by AVEVA or OSIsoft. PI System, AVEVA and OSIsoft are trademarks of their respective owners. Error explanations are provided as guidance only.

## 👤 Author

Built by **[ChrisTechVA](https://christechva.netlify.app)**, an AI workflow automation specialist.

If this saved you time on a troubleshooting call, hit the **Share** button in the app and pass it on. ⭐
