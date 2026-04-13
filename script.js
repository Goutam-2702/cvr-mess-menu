/* =================================================================
   CVR MESS MENU — script.js v3
   Menu, Notices, Gallery, Special Events, Chatbot, Speed-Dial
   ================================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  getFirestore, doc, collection, onSnapshot,
  query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

/* ─── CONFIG ──────────────────────────────────────────────── */
const firebaseConfig = {
  apiKey: "AIzaSyBim0-aBLbxB4Od-V6cCwEpOTwiZUO-nEE",
  authDomain: "mess-menu-bdba5.firebaseapp.com",
  projectId: "mess-menu-bdba5",
  storageBucket: "mess-menu-bdba5.firebasestorage.app",
  messagingSenderId: "141472583379",
  appId: "1:141472583379:web:b479d1ddfff8e82c4f4e26",
  measurementId: "G-82GSXH0SB9"
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

/* ─── STATE ───────────────────────────────────────────────── */
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
let cachedMenuData   = {};
let cachedDishes     = [];
let cachedSpecial    = null;
let latestNotice     = { title:"Welcome!", content:"WELCOME TO CVR MESS — NEW MENU UPDATED", createdAt:null };
let isFirstMenu      = true;
let isFirstNotice    = true;
let chatOpen           = false;
let speedDialOpen      = false;
let currentSelectedDay = "Monday"; // updated on load + tab click

const TIMINGS = {
  weekday: { breakfast:"7:30 AM – 9:30 AM", lunch:"12:30 PM – 2:30 PM", snacks:"5:30 PM – 6:30 PM", dinner:"8:00 PM – 10:00 PM" },
  weekend: { breakfast:"8:00 AM – 10:00 AM", lunch:"1:00 PM – 3:00 PM",  snacks:"5:30 PM – 6:30 PM", dinner:"8:00 PM – 10:00 PM" }
};

/* ─── DOM READY ───────────────────────────────────────────── */
window.addEventListener("DOMContentLoaded", () => {

  // Dark mode restore
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-mode");
    const btn = document.getElementById("darkModeToggle");
    if (btn) btn.innerHTML = "☀️";
  }

  // Set today as default selected day
  const today = DAYS[new Date().getDay()];
  currentSelectedDay = today;
  const sel = document.getElementById("daySelect");
  if (sel) sel.value = today;

  buildDayTabs(today);
  listenToMenu();
  listenToNotice();
  listenToGallery();
  listenToSpecialEvent();

  if (sel) sel.addEventListener("change", () => {
    currentSelectedDay = sel.value;
    updateDisplay();
    syncTabsToSelect();
  });

  const ci = document.getElementById("chat-input");
  if (ci) ci.addEventListener("keypress", e => { if (e.key === "Enter") handleChat(); });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  // Show notification permission prompt on FIRST visit only (2s delay)
  if (!localStorage.getItem("notif_prompted")) {
    setTimeout(showNotifPrompt, 2000);
  }
});

/* ─── DAY TABS ────────────────────────────────────────────── */
function buildDayTabs(today) {
  const tabs = document.querySelectorAll(".day-tab");
  tabs.forEach(tab => {
    const day = tab.dataset.day;
    if (day === today) tab.classList.add("today-tab");
    tab.addEventListener("click", () => selectDay(day));
  });
  setActiveTab(today);
}
function selectDay(day) {
  currentSelectedDay = day;
  const sel = document.getElementById("daySelect");
  if (sel) sel.value = day;
  setActiveTab(day);
  updateDisplay();
}
function setActiveTab(day) {
  document.querySelectorAll(".day-tab").forEach(t => t.classList.toggle("active", t.dataset.day === day));
}
function syncTabsToSelect() {
  const sel = document.getElementById("daySelect");
  if (sel) setActiveTab(sel.value);
}

/* ─── FIREBASE: MENU ──────────────────────────────────────── */
function listenToMenu() {
  const out = document.getElementById("menuOutput");
  onSnapshot(doc(db, "menu", "c v raman"), (snap) => {
    if (!snap.exists()) {
      if (out) out.innerHTML = "<div class='menu-card'><p style='text-align:center;color:var(--text3)'>❌ Menu not found</p></div>";
      return;
    }
    const d = snap.data();
    DAYS.forEach(day => {
      cachedMenuData[day] = {
        breakfast: d[`${day}_breakfast`] || d[`${day.toLowerCase()}_breakfast`] || "—",
        lunch:     d[`${day}_lunch`]     || d[`${day.toLowerCase()}_lunch`]     || "—",
        snacks:    d[`${day}_snacks`]    || d[`${day.toLowerCase()}_snacks`]    || "—",
        dinner:    d[`${day}_dinner`]    || d[`${day.toLowerCase()}_dinner`]    || "—",
        dessert:   d[`${day}_dessert`]   || d[`${day.toLowerCase()}_dessert`]   || null
      };
    });
    if (!isFirstMenu) showToast("🍽️ Menu updated live!", "success");
    isFirstMenu = false;
    updateDisplay();
  }, err => {
    console.error("Menu error:", err);
    if (out) out.innerHTML = "<div class='menu-card'><p style='text-align:center;color:var(--text3)'>⚠️ Could not load menu</p></div>";
  });
}

/* ─── FIREBASE: NOTICE ────────────────────────────────────── */
function listenToNotice() {
  onSnapshot(doc(db, "settings", "notice"), (snap) => {
    if (snap.exists()) {
      const d = snap.data();
      latestNotice = { title: d.title || "Notice", content: d.content || d.message || "No notice.", createdAt: d.updatedAt || d.createdAt || null };
    }
    renderNotice();
    if (!isFirstNotice) showToast("📢 New notice posted!", "warning");
    isFirstNotice = false;
  }, () => {
    const q = query(collection(db, "notices"), orderBy("createdAt","desc"), limit(1));
    onSnapshot(q, snap => {
      if (!snap.empty) {
        const d = snap.docs[0].data();
        latestNotice = { title: d.title || "Notice", content: d.content || "Check notice board.", createdAt: d.createdAt || null };
        if (!isFirstNotice) showToast("📢 New notice!", "warning");
        isFirstNotice = false;
        renderNotice();
      }
    });
  });
}

function renderNotice() {
  const el     = document.getElementById("committeeNotice");
  const stamp  = document.getElementById("noticeDateStamp");
  const ticker = document.getElementById("tickerText");
  if (el) el.textContent = latestNotice.content;
  if (ticker) ticker.innerHTML = `<strong>${latestNotice.title}:</strong> ${latestNotice.content.substring(0,90)}${latestNotice.content.length > 90 ? "…" : ""}`;
  if (stamp && latestNotice.createdAt) {
    try {
      const ts = latestNotice.createdAt.toDate ? latestNotice.createdAt.toDate() : new Date(latestNotice.createdAt);
      stamp.textContent = "Updated: " + ts.toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
    } catch(_) {}
  }
}

/* ─── FIREBASE: GALLERY / DISHES ─────────────────────────── */
function listenToGallery() {
  const q = query(collection(db, "dishes"), orderBy("uploadedAt","desc"));
  onSnapshot(q, (snap) => {
    cachedDishes = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    renderGallery();
  }, err => {
    console.error("Gallery error:", err);
    const grid = document.getElementById("dishGrid");
    if (grid) grid.innerHTML = "<div class='gallery-empty'>📸 No photos yet — check back soon!</div>";
  });
}

function renderGallery() {
  const grid  = document.getElementById("dishGrid");
  const count = document.getElementById("galleryCount");
  if (!grid) return;

  if (count) count.textContent = cachedDishes.length > 0 ? `${cachedDishes.length} photos` : "0 photos";

  if (cachedDishes.length === 0) {
    grid.innerHTML = "<div class='gallery-empty'>📸 No dish photos uploaded yet.<br>Admin can add them in the panel!</div>";
    return;
  }

  grid.innerHTML = cachedDishes.map((dish, i) => `
    <div class="dish-card" onclick="openLightbox(${i})" role="button" tabindex="0" aria-label="View ${dish.name}">
      <img src="${dish.url}" alt="${dish.name}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22150%22><rect width=%22200%22 height=%22150%22 fill=%22%23f0f4ff%22/><text x=%2250%25%22 y=%2250%25%22 font-size=%2230%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22>🍽️</text></svg>'">
      <div class="dish-card-name">${dish.name}</div>
      ${dish.category ? `<div class="dish-card-tag">${dish.category}</div>` : ""}
    </div>`).join("");
}

window.openLightbox = function(index) {
  const dish = cachedDishes[index];
  if (!dish) return;
  document.getElementById("lightboxImg").src  = dish.url;
  document.getElementById("lightboxName").textContent = dish.name;
  document.getElementById("lightboxTag").textContent  = dish.category || "";
  document.getElementById("lightbox").classList.add("open");
  document.body.style.overflow = "hidden";
};

window.closeLightbox = function() {
  document.getElementById("lightbox").classList.remove("open");
  document.body.style.overflow = "";
};

/* ─── FIREBASE: SPECIAL EVENT ─────────────────────────────── */
function listenToSpecialEvent() {
  onSnapshot(doc(db, "settings", "specialEvent"), (snap) => {
    const banner = document.getElementById("specialEventBanner");
    if (!banner) return;

    if (!snap.exists()) { banner.classList.remove("active"); return; }

    const d = snap.data();
    if (!d.active || !d.title) { banner.classList.remove("active"); return; }

    cachedSpecial = d;
    document.getElementById("seTitle").textContent   = d.title   || "Special Event";
    document.getElementById("seDetails").textContent = d.details || "";
    document.getElementById("seTime").textContent    = d.time    ? `🕒 ${d.time}` : "🕒 Check timings";
    banner.classList.add("active");

    if (!isFirstMenu) showToast("⭐ Special dinner tonight!", "info");
  });
}

/* ─── DISPLAY MENU ────────────────────────────────────────── */
const DAY_EMOJIS = { Monday:"🌱",Tuesday:"✨",Wednesday:"🌤️",Thursday:"🍀",Friday:"🎉",Saturday:"🌟",Sunday:"☀️" };

window.updateDisplay = function() {
  const out = document.getElementById("menuOutput");
  if (!out) return;

  const day    = currentSelectedDay;
  const menu   = cachedMenuData[day];
  const isWE   = (day === "Saturday" || day === "Sunday");
  const timing = isWE ? TIMINGS.weekend : TIMINGS.weekday;

  const tt = document.getElementById("timingTitle");
  if (tt) tt.textContent = isWE ? `🕒 Weekend Timings (${day})` : "🕒 Weekday Timings (Mon – Fri)";
  ["bt","lt","st","dt"].forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.textContent = Object.values(timing)[i];
  });
  setActiveTab(day);

  if (!menu) {
    out.innerHTML = `<div class="menu-card"><p style="text-align:center;color:var(--text3);padding:20px">⏳ Menu for ${day} not set yet</p></div>`;
    return;
  }

  const cur  = getCurrentMeal();
  const emoji = DAY_EMOJIS[day] || "📋";
  const meals = [
    { key:"breakfast", label:"Breakfast", icon:"🍳", cls:"breakfast" },
    { key:"lunch",     label:"Lunch",     icon:"🍱", cls:"lunch" },
    { key:"snacks",    label:"Snacks",    icon:"☕", cls:"snacks" },
    { key:"dinner",    label:"Dinner",    icon:"🍛", cls:"dinner" },
  ];

  const rows = meals.map(m => {
    const isNow = (m.key === cur && day === DAYS[new Date().getDay()]) ? "current-meal" : "";
    return `<div class="meal-row ${isNow}">
      <div class="meal-icon ${m.cls}">${m.icon}</div>
      <div class="meal-info">
        <div class="meal-label">${m.label}${isNow ? " · Now Serving 🔴" : ""}</div>
        <div class="meal-text">${menu[m.key] || "—"}</div>
      </div>
    </div>`;
  }).join("");

  const dessert = menu.dessert && menu.dessert !== "-" && menu.dessert !== "—"
    ? `<div class="meal-row"><div class="meal-icon dessert">🍦</div><div class="meal-info"><div class="meal-label">Dessert</div><div class="meal-text">${menu.dessert}</div></div></div>`
    : "";

  out.innerHTML = `<div class="menu-card"><h2><span class="day-emoji">${emoji}</span>${day}'s Menu</h2>${rows}${dessert}</div>`;
};

function getCurrentMeal() {
  const h = new Date().getHours();
  if (h >= 7  && h < 10) return "breakfast";
  if (h >= 12 && h < 15) return "lunch";
  if (h >= 17 && h < 19) return "snacks";
  if (h >= 20 && h < 22) return "dinner";
  return null;
}

/* ─── DARK MODE ───────────────────────────────────────────── */
window.toggleDarkMode = function() {
  document.body.classList.toggle("dark-mode");
  const isDark = document.body.classList.contains("dark-mode");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  const btn = document.getElementById("darkModeToggle");
  if (btn) btn.innerHTML = isDark ? "☀️" : "🌙";
  const meta = document.getElementById("themeMetaColor");
  if (meta) meta.content = isDark ? "#09101f" : "#003366";
};

/* ─── SPEED-DIAL ──────────────────────────────────────────── */
window.toggleSpeedDial = function() {
  speedDialOpen ? closeSpeedDial() : openSpeedDial();
};
function openSpeedDial() {
  speedDialOpen = true;
  const sd  = document.getElementById("speedDial");
  const bd  = document.getElementById("sdBackdrop");
  const tr  = document.getElementById("speedDialTrigger");
  const mn  = document.getElementById("speedDialMenu");
  if (sd) sd.classList.add("open");
  if (bd) bd.classList.add("open");
  if (tr) tr.classList.add("open");
  if (mn) mn.style.pointerEvents = "all";
}
window.closeSpeedDial = function() {
  speedDialOpen = false;
  const sd = document.getElementById("speedDial");
  const bd = document.getElementById("sdBackdrop");
  const tr = document.getElementById("speedDialTrigger");
  const mn = document.getElementById("speedDialMenu");
  if (sd) sd.classList.remove("open");
  if (bd) bd.classList.remove("open");
  if (tr) tr.classList.remove("open");
  if (mn) mn.style.pointerEvents = "none";
};

/* ─── CHAT TOGGLE ─────────────────────────────────────────── */
window.openChat = function() {
  closeSpeedDial();
  const chat = document.getElementById("chat-container");
  if (!chat) return;
  chatOpen = true;
  chat.style.display = "flex";
  requestAnimationFrame(() => chat.classList.add("open"));
  document.getElementById("chat-input")?.focus();
};
window.closeChat = function() {
  chatOpen = false;
  const chat = document.getElementById("chat-container");
  if (!chat) return;
  chat.classList.remove("open");
  setTimeout(() => { chat.style.display = "none"; }, 300);
};
window.toggleChat = window.openChat;

window.scrollToGallery = function() {
  closeSpeedDial();
  document.getElementById("gallerySection")?.scrollIntoView({ behavior:"smooth", block:"start" });
};

window.sendQuick = function(text) {
  openChat();
  setTimeout(() => {
    const input = document.getElementById("chat-input");
    if (input) { input.value = text; handleChat(); }
  }, 350);
};

/* ─── TOAST ───────────────────────────────────────────────── */
window.showToast = function(msg, type = "info") {
  const c = document.getElementById("toast-container");
  if (!c) return;
  const icons = { info:"ℹ️", success:"✅", warning:"⚠️" };
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type]||"ℹ️"}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => {
    t.style.animation = "toast-out .3s ease forwards";
    setTimeout(() => t.remove(), 320);
  }, 4000);
};

/* ─── SMART CHATBOT ───────────────────────────────────────── */
window.handleChat = function() {
  const inp  = document.getElementById("chat-input");
  const cont = document.getElementById("chat-content");
  if (!inp || !cont) return;
  const raw  = inp.value.trim();
  if (!raw) return;
  const text = raw.toLowerCase();
  inp.value = "";

  cont.innerHTML += `<div class="user-msg"><span>${esc(raw)}</span></div>`;
  cont.scrollTop = cont.scrollHeight;

  const tid = "t-" + Date.now();
  cont.innerHTML += `<div class="bot-msg typing-indicator" id="${tid}"><div class="bot-icon">🤖</div><span><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></span></div>`;
  cont.scrollTop = cont.scrollHeight;

  setTimeout(() => {
    document.getElementById(tid)?.remove();
    cont.innerHTML += `<div class="bot-msg"><div class="bot-icon">🤖</div><span>${generateBotResponse(text, raw)}</span></div>`;
    cont.scrollTop = cont.scrollHeight;
  }, 600 + Math.random() * 400);
};

function generateBotResponse(text, raw) {
  const day  = DAYS[new Date().getDay()];
  const hour = new Date().getHours();
  const menu = cachedMenuData[day];

  // Greetings
  if (/^(hi|hello|hey|namaste|good\s*(morning|afternoon|evening|night))/i.test(text)) {
    const g = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    return `${g}! 😊 I'm your CVR Mess Assistant. Ask me about today's menu, timings, special events, dish photos, or how to complain!`;
  }

  // Gallery / photos
  if (/photo|gallery|picture|image|dish photo|food photo/i.test(text)) {
    return cachedDishes.length > 0
      ? `📸 We have <b>${cachedDishes.length} dish photos</b> in our gallery! Tap the <b>📸 Dish Photos</b> button (bottom-right ＋ menu) or scroll down to see them!`
      : "📸 No dish photos uploaded yet. The admin can add them through the Admin Panel!";
  }

  // Special event / special dinner
  if (/special|event|special dinner|tonight|celebration/i.test(text)) {
    if (cachedSpecial && cachedSpecial.active) {
      return `⭐ <b>Special Event Tonight!</b><br>${cachedSpecial.title}<br>${cachedSpecial.details || ""}<br><b>Time:</b> ${cachedSpecial.time || "Check timings"}`;
    }
    const specials = { Friday:"Biryani or Paneer 🎉", Sunday:"Biryani & Shahi Tukda ☀️", Thursday:"Gajar Halwa / Rasgulla 🍮" };
    return specials[day]
      ? `Today (${day}) usually has ${specials[day]}! No special event is announced for tonight. Check the notice board for updates!`
      : "No special dinner is announced right now. Keep an eye on the live notice board! 👀";
  }

  // Full today's menu
  if ((text.includes("today") && text.includes("menu")) || text.includes("full menu") || text.includes("all meal")) {
    if (!menu) return "Menu is loading… try again in a moment! ⏳";
    return `📋 <b>${day}'s Full Menu:</b><br>🍳 Breakfast: ${menu.breakfast}<br>🍱 Lunch: ${menu.lunch}<br>☕ Snacks: ${menu.snacks}<br>🍛 Dinner: ${menu.dinner}${menu.dessert && menu.dessert !== "-" ? `<br>🍦 Dessert: ${menu.dessert}` : ""}`;
  }

  // Specific day
  for (const d of DAYS) {
    if (text.includes(d.toLowerCase())) {
      const dm = cachedMenuData[d];
      if (!dm) return `Menu for ${d} isn't set yet.`;
      return `📋 <b>${d}:</b><br>🍳 ${dm.breakfast}<br>🍱 ${dm.lunch}<br>☕ ${dm.snacks}<br>🍛 ${dm.dinner}${dm.dessert && dm.dessert !== "-" ? `<br>🍦 ${dm.dessert}` : ""}`;
    }
  }

  // What's serving now
  if (/now|current|serving/i.test(text)) {
    const cm = getCurrentMeal();
    if (!cm) return "The mess is between service times right now 😅. Check the timings on the main page!";
    return menu ? `Currently serving <b>${cm}</b>: ${menu[cm]} 🍽️` : "Menu is still loading ⏳";
  }

  // Per-meal
  if (text.includes("breakfast")) { const m = cachedMenuData[getDayFromText(text)||day]; return m ? `🍳 <b>Breakfast:</b> ${m.breakfast}` : "Menu loading ⏳"; }
  if (text.includes("lunch"))     { const m = cachedMenuData[getDayFromText(text)||day]; return m ? `🍱 <b>Lunch:</b> ${m.lunch}` : "Menu loading ⏳"; }
  if (/snack|tea|coffee|evening/i.test(text)) { const m = cachedMenuData[getDayFromText(text)||day]; return m ? `☕ <b>Snacks:</b> ${m.snacks}` : "Menu loading ⏳"; }
  if (/dinner|supper/i.test(text)) { const m = cachedMenuData[getDayFromText(text)||day]; return m ? `🍛 <b>Dinner:</b> ${m.dinner}` : "Menu loading ⏳"; }
  if (/dessert|sweet|mithai/i.test(text)) {
    const m = cachedMenuData[getDayFromText(text)||day];
    if (!m) return "Menu loading ⏳";
    return m.dessert && m.dessert !== "-" ? `🍦 <b>Dessert:</b> ${m.dessert}` : "No dessert listed for today 😔";
  }

  // Timings
  if (/time|timing|when|open|close|hour/i.test(text)) {
    const isWE = (day === "Saturday" || day === "Sunday");
    const t    = isWE ? TIMINGS.weekend : TIMINGS.weekday;
    return `🕒 <b>Mess Timings (${isWE?"Weekend":"Weekday"}):</b><br>🍳 ${t.breakfast}<br>🍱 ${t.lunch}<br>☕ ${t.snacks}<br>🍛 ${t.dinner}`;
  }

  // Notice
  if (/notice|announcement|update|news/i.test(text)) {
    return `📢 <b>${latestNotice.title}:</b><br>${latestNotice.content}`;
  }

  // Complaint
  if (/complain|complaint|issue|problem|bad food|hygiene/i.test(text)) {
    return `To file a complaint, tap the <b>＋</b> button at the bottom-right and select 📢 or <a href="complaint.html" style="color:var(--accent);font-weight:600">click here</a>. Your message goes directly to the Mess Committee via WhatsApp! 💪`;
  }

  // Rebate
  if (/rebate|leave|absent|refund/i.test(text)) {
    return `To apply for a mess rebate, visit <a href="http://10.15.7.7/messIITP/web/index.php" target="_blank" style="color:var(--accent);font-weight:600">the mess portal</a>. Submit your leave dates to get a refund!`;
  }

  // Veg/Non-veg
  if (/veg|non.veg|chicken|egg|paneer/i.test(text)) {
    if (!menu) return "Menu loading ⏳";
    const all = Object.values(menu).join(" ").toLowerCase();
    const items = ["chicken","egg","mutton","fish"].filter(x => all.includes(x));
    return items.length ? `Today's non-veg: <b>${items.map(x => x.charAt(0).toUpperCase()+x.slice(1)).join(", ")}</b> 🍗` : `Today looks like a veg day! 🌱`;
  }

  // Paneer days
  if (/paneer/i.test(text)) {
    const days = DAYS.filter(d => { const m = cachedMenuData[d]; return m && Object.values(m).some(v => v && v.toLowerCase().includes("paneer")); });
    return days.length ? `Paneer available on: <b>${days.join(", ")}</b> 🧀` : "Checking... try again once the menu loads fully!";
  }

  // Dark mode
  if (/dark mode|night mode|light mode/i.test(text)) {
    return "Toggle dark/light mode using the 🌙/☀️ button at the top-right corner!";
  }

  // Thanks / bye / how are you
  if (/thank|thanks/i.test(text)) return "You're welcome! 😊 Enjoy your meal! 🍽️";
  if (/bye|goodbye/i.test(text))  return "Bye! Have a great day! 😄 Let me know if you need anything.";
  if (/how are you/i.test(text))  return "I'm doing great, always ready to help! 😄 Ask me anything about the mess.";
  if (/who made|creator|developer/i.test(text)) return "I was created by <b>Goutam (G.K.G)</b> to make mess life easier for CVR students! 🚀";

  // Fallback
  const tips = ["Try: 'Today's menu', 'Monday dinner', 'What time is lunch?' 🍽️", "I can help with menu, timings, notices, special events, dish photos & complaints!", "Ask me: 'Any special tonight?' or 'Show dish photos' 📸"];
  return `I'm not sure about "<i>${esc(raw.substring(0,40))}</i>".<br><br>${tips[Math.floor(Math.random()*tips.length)]}`;
}

function getDayFromText(text) {
  return DAYS.find(d => text.toLowerCase().includes(d.toLowerCase())) || null;
}
function esc(s) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/* ─── NOTIFICATION PROMPT ─────────────────────────────────── */
function showNotifPrompt() {
  const overlay = document.getElementById("notifOverlay");
  if (!overlay) return;
  // Show the custom bottom sheet
  overlay.style.display = "flex";
  // Trigger animation next frame
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add("show")));
}

function hideNotifPrompt() {
  const overlay = document.getElementById("notifOverlay");
  if (!overlay) return;
  overlay.classList.remove("show");
  setTimeout(() => { overlay.style.display = "none"; }, 400);
}

window.allowNotifications = async function() {
  localStorage.setItem("notif_prompted", "1");
  hideNotifPrompt();
  try {
    // Ask for browser notification permission
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      showToast("🔔 Notifications enabled! You'll be notified of menu updates.", "success");
      // Also trigger OneSignal native prompt if available
      if (window._OneSignal) {
        try { await window._OneSignal.Slidedown.promptPush(); } catch(_) {}
      }
    } else {
      showToast("Notifications blocked. You can enable them in browser settings.", "warning");
    }
  } catch(e) {
    console.warn("Notification permission error:", e);
    showToast("Could not enable notifications in this browser.", "warning");
  }
};

window.skipNotifications = function() {
  localStorage.setItem("notif_prompted", "1");
  hideNotifPrompt();
  showToast("You can enable notifications anytime from browser settings.", "info");
};
