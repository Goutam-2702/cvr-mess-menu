# 🍽️ CVR Mess Menu

> Real-time mess menu, notices, dish gallery & admin panel for **C V Raman Hostel · IIT Patna**

[![Live Site](https://img.shields.io/badge/Live-GitHub%20Pages-blue?style=flat-square)](https://goutam-2702.github.io/cvr-mess-menu/)
[![Firebase](https://img.shields.io/badge/Backend-Firebase-orange?style=flat-square)](https://firebase.google.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

---

## ✨ Features

### 👨‍🎓 Student View
- **7-Day Menu** — browse any day's full menu (Breakfast, Lunch, Snacks, Dinner, Dessert) with one tap on the day tabs
- **Live Ticker** — scrolling notice headline with a pulsing LIVE badge
- **Now Serving 🔴** — highlights the current meal based on real time
- **Special Dinner Banner** — purple event banner when admin announces a special meal
- **📸 Dish Gallery** — photo grid of mess dishes with lightbox viewer
- **Mess Timings** — weekday & weekend timings, automatically shown for the selected day
- **Everyday Essentials** — fixed items served every day (bread, salad, etc.)
- **💬 Ask Mess Bot** — AI chatbot with 20+ intents (menu queries, timings, complaints, rebate, special events, dish photos, etc.)
- **📢 File Complaint** — structured complaint form sent directly to the Mess Committee via WhatsApp (category, severity, photo, message)
- **🔔 Notification Permission Prompt** — beautiful bottom-sheet shown on first visit; remembers choice
- **Speed-Dial FAB** — expandable ＋ button with Chat, Dish Photos, and Complaint shortcuts
- **Dark Mode** — full dark mode toggle with persistence via `localStorage`
- **PWA** — installable as an app on Android/iOS

### 🔧 Admin Panel (`/admin.html`)
| Tab | Capability |
|---|---|
| 🍽️ Menu | Edit any of the 7 days' meals, live preview, publish instantly |
| 📢 Notices | Post live notice (shown on ticker + notice board) or save to history, delete old notices |
| 📸 Dish Gallery | Upload dish photos (drag & drop, progress bar), assign category, delete photos |
| ⭐ Special Dinner | Toggle special event banner on/off, set title, details, date, timing |
| 🕒 Timings | Update weekday & weekend timings; reflected live on student page |

All changes via the admin panel go **live in real time** — no deployment needed.

---

## 🛠️ Tech Stack

| Layer | Tech |
|---|---|
| Frontend | HTML5, Vanilla CSS, ES Modules (JavaScript) |
| Font | [Inter](https://fonts.google.com/specimen/Inter) – Google Fonts |
| Database | [Firebase Firestore](https://firebase.google.com/products/firestore) (real-time) |
| Storage | [Firebase Storage](https://firebase.google.com/products/storage) (dish photos) |
| Auth | [Firebase Authentication](https://firebase.google.com/products/auth) (admin login) |
| Push Notifications | [OneSignal](https://onesignal.com/) |
| Hosting | GitHub Pages / Firebase Hosting |

---

## 📁 Project Structure

```
cvr-mess-menu/
├── index.html            # Main student-facing page
├── admin.html            # Admin dashboard (auth-gated)
├── complaint.html        # Complaint form → WhatsApp
├── script.js             # All logic: Firebase, chatbot, gallery, FAB
├── style.css             # Complete design system (light + dark)
├── manifest.json         # PWA manifest
├── OneSignalSDKWorker.js # Push notification service worker
├── logo.jpeg             # Hostel logo
└── README.md
```

---

## 🚀 Running Locally

```bash
# Clone the repo
git clone https://github.com/Goutam-2702/cvr-mess-menu.git
cd cvr-mess-menu

# Start a local server (no build step needed)
python -m http.server 7788

# Open in browser
# http://localhost:7788
# http://localhost:7788/admin.html
```

> Firebase config is already embedded in `script.js`. No `.env` setup required.

---

## 🔐 Admin Access

The admin panel (`/admin.html`) requires **Firebase Authentication**.  
Admin credentials are managed via the Firebase Console — ask the mess committee for access.

**Firestore Security Rules** — ensure only authenticated admins can write:
```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

---

## 📸 Screenshots

| Main Page | Admin Panel | Complaint Page |
|---|---|---|
| Live menu, day tabs, ticker | 5-tab dashboard, dish upload | Category pills, severity, WhatsApp |

---

## 🤖 Chatbot Intents

The built-in Mess Bot handles:
`today's menu` · `Monday dinner` · `what time is lunch?` · `any special dinner?` · `show dish photos` · `how to complain?` · `rebate info` · `any paneer today?` · `is it veg today?` · `who made this?` · and 15+ more

---

## 👨‍💻 Author

**Goutam (G.K.G)**  
C V Raman Hostel, IIT Patna  
Made with ❤️ to make mess life easier for students.

---

*© 2024 CVR Mess Menu. Open source under MIT License.*
