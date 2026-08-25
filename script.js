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

/* ─── SHARED STATE (for new modules) ────────────────────── */
window.messApp = window.messApp || {};

/* ─── STATE ───────────────────────────────────────────────── */
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
let cachedMenuData   = {};
let cachedDishes     = [];
let cachedSpecial    = null;
let latestNotice     = { title:"Welcome!", content:"WELCOME TO CVR MESS — NEW MENU UPDATED", createdAt:null };
let isFirstMenu      = true;
let isFirstNotice    = true;
let isFirstSpecial   = true;
let previousMenuStr  = "";
let previousNoticeStr = "";
let previousSpecialStr = "";
let chatOpen           = false;
let speedDialOpen      = false;
let currentSelectedDay = "Monday"; // updated on load + tab click
let currentHostel      = "c v raman";
let menuUnsubscribe    = null;
let timingsUnsubscribe = null;
let galleryUnsubscribe = null;

// Timings are now loaded live from Firebase (set by admin)
// These are fallback defaults only
const TIMINGS = {
  weekday: { breakfast:"7:30 AM – 9:30 AM", lunch:"12:30 PM – 2:30 PM", snacks:"5:30 PM – 6:30 PM", dinner:"8:00 PM – 10:00 PM" },
  weekend: { breakfast:"8:00 AM – 10:00 AM", lunch:"1:00 PM – 3:00 PM",  snacks:"5:30 PM – 6:30 PM", dinner:"8:00 PM – 10:00 PM" }
};
let liveTimings = null; // Will be populated from Firebase

// Parse "7:30 AM" style time strings into { h, m } objects
function parseTimeStr(str) {
  if (!str) return null;
  const m = str.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = m[3].toUpperCase();
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return { h, m: min };
}

// Parse "7:30 AM – 9:30 AM" into { start, end } in minutes since midnight
function parseTimeRange(rangeStr) {
  if (!rangeStr) return null;
  const parts = rangeStr.split(/[–-]/);
  if (parts.length < 2) return null;
  const start = parseTimeStr(parts[0]);
  const end   = parseTimeStr(parts[1]);
  if (!start || !end) return null;
  return { start: start.h * 60 + start.m, end: end.h * 60 + end.m };
}

function getActiveTimings(day) {
  const isWE = (day === "Saturday" || day === "Sunday");
  if (liveTimings) {
    return isWE ? {
      breakfast: liveTimings.weekend_breakfast || TIMINGS.weekend.breakfast,
      lunch:     liveTimings.weekend_lunch     || TIMINGS.weekend.lunch,
      snacks:    liveTimings.weekend_snacks    || TIMINGS.weekend.snacks,
      dinner:    liveTimings.weekend_dinner    || TIMINGS.weekend.dinner,
    } : {
      breakfast: liveTimings.weekday_breakfast || TIMINGS.weekday.breakfast,
      lunch:     liveTimings.weekday_lunch     || TIMINGS.weekday.lunch,
      snacks:    liveTimings.weekday_snacks    || TIMINGS.weekday.snacks,
      dinner:    liveTimings.weekday_dinner    || TIMINGS.weekday.dinner,
    };
  }
  return isWE ? TIMINGS.weekend : TIMINGS.weekday;
}

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

  // Handle Hostel Selection
  function normalizeHostel(val) {
    if (!val) return null;
    const v = val.toLowerCase().replace(/[^a-z]/g, '');
    if (v.includes('raman') || v.includes('cvr')) return 'c v raman';
    if (v.includes('arya')) return 'aryabhatt';
    return null;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const urlHostel = normalizeHostel(urlParams.get('hostel'));
  const storedHostel = normalizeHostel(localStorage.getItem("selectedHostel"));
  
  if (urlHostel) {
    currentHostel = urlHostel;
    localStorage.setItem("selectedHostel", currentHostel);
    
    // Update URL to clean format without reloading
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('hostel', currentHostel);
    window.history.replaceState({}, '', newUrl);
  } else if (storedHostel) {
    currentHostel = storedHostel;
  } else {
    currentHostel = "c v raman"; // Fallback
  }
  
  const hostelSel = document.getElementById("hostelSelect");
  if (hostelSel) {
    hostelSel.value = currentHostel;
    updateHostelUI();
    hostelSel.addEventListener("change", (e) => {
      const evt = new CustomEvent('hostelChanging', { detail: { newHostel: hostelSel.value, oldHostel: currentHostel }, cancelable: true });
      const allowed = document.dispatchEvent(evt);
      if (!allowed) { hostelSel.value = currentHostel; return; }
      currentHostel = hostelSel.value;
      localStorage.setItem("selectedHostel", currentHostel);
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('hostel', currentHostel);
      window.history.pushState({}, '', newUrl);
      updateHostelUI();
      listenToMenu();
      listenToTimings();
      listenToGallery();
      document.dispatchEvent(new CustomEvent('hostelChanged', { detail: { hostel: currentHostel } }));
    });
  }

  buildDayTabs(today);
  listenToMenu();
  listenToNotice();
  listenToGallery();
  listenToSpecialEvent();
  listenToTimings();

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
  if (menuUnsubscribe) menuUnsubscribe();
  
  // Show loading indicator when switching hostels
  if (out) out.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><span>Loading menu...</span></div>';

  menuUnsubscribe = onSnapshot(doc(db, "menu", currentHostel), (snap) => {
    if (!snap.exists()) {
      if (out) out.innerHTML = "<div class='menu-card'><p style='text-align:center;color:var(--text3)'> Menu not found</p></div>";
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
    
    const currentMenuStr = JSON.stringify(cachedMenuData);
    if (!isFirstMenu && previousMenuStr && previousMenuStr !== currentMenuStr) {
      showToast(" Menu updated live!", "success");
    }
    previousMenuStr = currentMenuStr;
    isFirstMenu = false;
    
    updateDisplay();
  }, err => {
    console.error("Menu error:", err);
    if (out) out.innerHTML = "<div class='menu-card'><p style='text-align:center;color:var(--text3)'> Could not load menu</p></div>";
  });
}

function updateHostelUI() {
  document.title = currentHostel === "aryabhatt" ? "Aryabhatt Mess Menu" : "CVR Mess Menu";
}

let noticeUnsubscribe = null;
function listenToNotice() {
  if (noticeUnsubscribe) noticeUnsubscribe();
  
  // Need to import query, where from firestore if not already imported, but script.js uses a global import block.
  // Actually, wait, let's just use the query. script.js already has `query, where`?
  // Yes, it imports them at the top.
  
  const q = query(
    collection(db, "notices"),
    orderBy("createdAt", "desc"),
    limit(10)
  );
  
  noticeUnsubscribe = onSnapshot(q, (snap) => {
    let found = false;
    if (!snap.empty) {
      for (const doc of snap.docs) {
        const d = doc.data();
        if (d.hostel === currentHostel || d.hostel === "all") {
          latestNotice = { title: d.title || "Notice", content: d.content || "Check notice board.", createdAt: d.createdAt || null };
          found = true;
          break;
        }
      }
    }
    if (!found) {
      latestNotice = { title: "Notice Board", content: "No new notices.", createdAt: null };
    }
    renderNotice();
    
    const currentNoticeStr = latestNotice.title + latestNotice.content;
    if (!isFirstNotice && previousNoticeStr && previousNoticeStr !== currentNoticeStr) {
      showToast(" New notice posted!", "warning");
    }
    previousNoticeStr = currentNoticeStr;
    isFirstNotice = false;
  }, (err) => {
    console.warn("Notice fetch error:", err);
  });
}

function renderNotice() {
  const el     = document.getElementById("committeeNotice");
  const stamp  = document.getElementById("noticeDateStamp");
  const ticker = document.getElementById("tickerText");
  const wrap   = document.getElementById("noticeBoardWrap");

  let isExpired = false;
  if (latestNotice.createdAt) {
    const ts = latestNotice.createdAt.toDate ? latestNotice.createdAt.toDate() : new Date(latestNotice.createdAt);
    if (new Date() - ts > 48 * 60 * 60 * 1000) {
      isExpired = true; // Auto-hide notices older than 48 hours
    }
  }

  if (isExpired) {
    if (wrap) wrap.style.display = "none";
    if (ticker) ticker.innerHTML = "<strong>No new notices at this time.</strong>";
    return;
  } else {
    if (wrap) wrap.style.display = "block";
  }

  if (el) el.textContent = latestNotice.content;
  if (ticker) ticker.innerHTML = `<strong>${latestNotice.title}:</strong> ${latestNotice.content.substring(0,90)}${latestNotice.content.length > 90 ? "…" : ""}`;
  if (stamp && latestNotice.createdAt) {
    try {
      const ts = latestNotice.createdAt.toDate ? latestNotice.createdAt.toDate() : new Date(latestNotice.createdAt);
      stamp.textContent = "Updated: " + ts.toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
    } catch(_) {}
  }
}

/* ─── FIREBASE: TIMINGS ───────────────────────────────────── */
function listenToTimings() {
  if (timingsUnsubscribe) timingsUnsubscribe();
  timingsUnsubscribe = onSnapshot(doc(db, "settings", "timings_" + currentHostel), (snap) => {
    if (snap.exists()) {
      liveTimings = snap.data();
      // Re-render timings display for the current day
      updateDisplay();
    } else {
      liveTimings = null;
      updateDisplay();
    }
  }, err => {
    console.warn("Timings listen error (using defaults):", err);
  });
}

/* ─── FIREBASE: GALLERY / DISHES ─────────────────────────── */
function listenToGallery() {
  if (galleryUnsubscribe) galleryUnsubscribe();
  
  // Try ordered query first; fall back to unordered if index missing
  const q = query(collection(db, "dishes_" + currentHostel), orderBy("uploadedAt","desc"));
  galleryUnsubscribe = onSnapshot(q, (snap) => {
    cachedDishes = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    renderGallery();
  }, err => {
    console.warn("Gallery ordered query failed, trying unordered:", err);
    // Fallback: listen without ordering
    galleryUnsubscribe = onSnapshot(collection(db, "dishes_" + currentHostel), (snap) => {
      cachedDishes = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      renderGallery();
    }, err2 => {
      console.error("Gallery error:", err2);
      const grid = document.getElementById("dishGrid");
      if (grid) grid.innerHTML = "<div class='gallery-empty'> No photos yet — check back soon!</div>";
    });
  });
}

function renderGallery() {
  const grid  = document.getElementById("dishGrid");
  const count = document.getElementById("galleryCount");
  if (!grid) return;

  if (count) count.textContent = cachedDishes.length > 0 ? `${cachedDishes.length} photos` : "0 photos";

  if (cachedDishes.length === 0) {
    grid.innerHTML = "<div class='gallery-empty'> No dish photos uploaded yet.<br>Admin can add them in the panel!</div>";
    return;
  }

  grid.innerHTML = cachedDishes.map((dish, i) => {
    const safeName = (dish.name || "").replace(/"/g, "&quot;");
    return `<div class="dish-card" onclick="openLightbox(${i})" role="button" tabindex="0" aria-label="View ${safeName}">
      <img src="${dish.url}" alt="${safeName}" loading="lazy" onerror="this.style.background='#f0f4ff';this.style.minHeight='120px';this.alt='Image not available'">
      <div class="dish-card-name">${dish.name || "Dish"}</div>
      ${dish.category ? `<div class="dish-card-tag">${dish.category}</div>` : ""}
    </div>`;
  }).join("");
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
    
    // Auto-hide if the scheduled date is strictly in the past
    if (d.date) {
      const today = new Date();
      today.setHours(0,0,0,0);
      const eventDate = new Date(d.date);
      eventDate.setHours(0,0,0,0);
      if (today.getTime() > eventDate.getTime()) {
        banner.classList.remove("active"); 
        return; 
      }
    }

    cachedSpecial = d;
    document.getElementById("seTitle").textContent   = d.title   || "Special Event";
    document.getElementById("seDetails").textContent = d.details || "";
    document.getElementById("seTime").textContent    = d.time    ? ` ${d.time}` : " Check timings";
    banner.classList.add("active");

    const currentSpecialStr = d.title + (d.details || "");
    if (!isFirstSpecial && previousSpecialStr && previousSpecialStr !== currentSpecialStr) {
      showToast("⭐ Special dinner tonight!", "info");
    }
    previousSpecialStr = currentSpecialStr;
    isFirstSpecial = false;
  });
}

/* ─── DISPLAY MENU ────────────────────────────────────────── */
const DAY_EMOJIS = { Monday:"",Tuesday:"",Wednesday:"",Thursday:"",Friday:"",Saturday:"",Sunday:"" };

window.updateDisplay = function() {
  const out = document.getElementById("menuOutput");
  if (!out) return;

  const day    = currentSelectedDay;
  const menu   = cachedMenuData[day];
  const isWE   = (day === "Saturday" || day === "Sunday");
  const timing = getActiveTimings(day);  // Uses live Firebase timings if available

  const tt = document.getElementById("timingTitle");
  if (tt) tt.textContent = isWE ? ` Weekend Timings (${day})` : " Weekday Timings (Mon – Fri)";
  const timingIds = ["bt", "lt", "st", "dt"];
  const timingKeys = ["breakfast", "lunch", "snacks", "dinner"];
  timingIds.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.textContent = timing[timingKeys[i]] || "";
  });
  setActiveTab(day);

  if (!menu) {
    out.innerHTML = `<div class="menu-card"><p style="text-align:center;color:var(--text3);padding:20px">⏳ Menu for ${day} not set yet</p></div>`;
    return;
  }

  const cur  = getCurrentMeal();
  const emoji = DAY_EMOJIS[day] || "";
  const meals = [
    { key:"breakfast", label:"🍳 Breakfast", icon:"", cls:"breakfast" },
    { key:"lunch",     label:"🍱 Lunch",     icon:"", cls:"lunch" },
    { key:"snacks",    label:"☕ Snacks",    icon:"", cls:"snacks" },
    { key:"dinner",    label:"🍛 Dinner",    icon:"", cls:"dinner" },
  ];

  const rows = meals.map(m => {
    const isNow = (m.key === cur && day === DAYS[new Date().getDay()]) ? "current-meal" : "";
    return `<div class="meal-row ${isNow}">
      <div class="meal-icon ${m.cls}">${m.icon}</div>
      <div class="meal-info">
        <div class="meal-label">${m.label}${isNow ? " · Now Serving " : ""}</div>
        <div class="meal-text">${menu[m.key] || "—"}</div>
      </div>
    </div>`;
  }).join("");

  const dessert = menu.dessert && menu.dessert !== "-" && menu.dessert !== "—"
    ? `<div class="meal-row"><div class="meal-icon dessert"></div><div class="meal-info"><div class="meal-label">🍦 Dessert</div><div class="meal-text">${menu.dessert}</div></div></div>`
    : "";

  out.innerHTML = `<div class="menu-card"><h2><span class="day-emoji">${emoji}</span>${day}'s Menu</h2>${rows}${dessert}</div>`;

  // Publish state for new modules
  window.messApp.cachedMenuData = cachedMenuData;
  window.messApp.currentSelectedDay = currentSelectedDay;
  window.messApp.currentHostel = currentHostel;
  window.messApp.DAYS = DAYS;
  window.messApp.getCurrentMeal = getCurrentMeal;
  window.messApp.getActiveTimings = getActiveTimings;
  window.messApp.cachedDishes = cachedDishes;
  window.messApp.db = db;
  document.dispatchEvent(new CustomEvent('menuRendered', { detail: { day, menu, hostel: currentHostel } }));
};

function getCurrentMeal() {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const today = DAYS[now.getDay()];
  const timing = getActiveTimings(today);

  // Check each meal using parsed time ranges from live timings
  const meals = [
    { key: "breakfast", range: timing.breakfast },
    { key: "lunch",     range: timing.lunch },
    { key: "snacks",    range: timing.snacks },
    { key: "dinner",    range: timing.dinner },
  ];

  for (const meal of meals) {
    const r = parseTimeRange(meal.range);
    if (r && nowMin >= r.start && nowMin < r.end) return meal.key;
  }
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
  const icons = { info:"ℹ", success:"", warning:"" };
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type]||"ℹ"}</span><span>${msg}</span>`;
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
  cont.innerHTML += `<div class="bot-msg typing-indicator" id="${tid}"><div class="bot-icon"></div><span><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></span></div>`;
  cont.scrollTop = cont.scrollHeight;

  setTimeout(() => {
    document.getElementById(tid)?.remove();
    cont.innerHTML += `<div class="bot-msg"><div class="bot-icon"></div><span>${generateBotResponse(text, raw)}</span></div>`;
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
    return `${g}!  I'm your CVR Mess Assistant. Ask me about today's menu, timings, special events, dish photos, or how to complain!`;
  }

  // Gallery / photos
  if (/photo|gallery|picture|image|dish photo|food photo/i.test(text)) {
    return cachedDishes.length > 0
      ? ` We have <b>${cachedDishes.length} dish photos</b> in our gallery! Tap the <b> Dish Photos</b> button (bottom-right ＋ menu) or scroll down to see them!`
      : " No dish photos uploaded yet. The admin can add them through the Admin Panel!";
  }

  // Special event / special dinner
  if (/special|event|special dinner|tonight|celebration/i.test(text)) {
    if (cachedSpecial && cachedSpecial.active) {
      return `⭐ <b>Special Event Tonight!</b><br>${cachedSpecial.title}<br>${cachedSpecial.details || ""}<br><b>Time:</b> ${cachedSpecial.time || "Check timings"}`;
    }
    const specials = { Friday:"Biryani or Paneer ", Sunday:"Biryani & Shahi Tukda ", Thursday:"Gajar Halwa / Rasgulla " };
    return specials[day]
      ? `Today (${day}) usually has ${specials[day]}! No special event is announced for tonight. Check the notice board for updates!`
      : "No special dinner is announced right now. Keep an eye on the live notice board! ";
  }

  // Full today's menu
  if ((text.includes("today") && text.includes("menu")) || text.includes("full menu") || text.includes("all meal")) {
    if (!menu) return "Menu is loading… try again in a moment! ⏳";
    return ` <b>${day}'s Full Menu:</b><br> 🍳 Breakfast: ${menu.breakfast}<br> 🍱 Lunch: ${menu.lunch}<br> ☕ Snacks: ${menu.snacks}<br> 🍛 Dinner: ${menu.dinner}${menu.dessert && menu.dessert !== "-" ? `<br> 🍦 Dessert: ${menu.dessert}` : ""}`;
  }

  // Specific day
  for (const d of DAYS) {
    if (text.includes(d.toLowerCase())) {
      const dm = cachedMenuData[d];
      if (!dm) return `Menu for ${d} isn't set yet.`;
      return ` <b>${d}:</b><br> ${dm.breakfast}<br> ${dm.lunch}<br> ${dm.snacks}<br> ${dm.dinner}${dm.dessert && dm.dessert !== "-" ? `<br> ${dm.dessert}` : ""}`;
    }
  }

  // What's serving now
  if (/now|current|serving/i.test(text)) {
    const cm = getCurrentMeal();
    if (!cm) return "The mess is between service times right now . Check the timings on the main page!";
    return menu ? `Currently serving <b>${cm}</b>: ${menu[cm]} ` : "Menu is still loading ⏳";
  }

  // Per-meal
  if (text.includes("breakfast")) { const m = cachedMenuData[getDayFromText(text)||day]; return m ? ` <b>🍳 Breakfast:</b> ${m.breakfast}` : "Menu loading ⏳"; }
  if (text.includes("lunch"))     { const m = cachedMenuData[getDayFromText(text)||day]; return m ? ` <b>🍱 Lunch:</b> ${m.lunch}` : "Menu loading ⏳"; }
  if (/snack|tea|coffee|evening/i.test(text)) { const m = cachedMenuData[getDayFromText(text)||day]; return m ? ` <b>☕ Snacks:</b> ${m.snacks}` : "Menu loading ⏳"; }
  if (/dinner|supper/i.test(text)) { const m = cachedMenuData[getDayFromText(text)||day]; return m ? ` <b>🍛 Dinner:</b> ${m.dinner}` : "Menu loading ⏳"; }
  if (/dessert|sweet|mithai/i.test(text)) {
    const m = cachedMenuData[getDayFromText(text)||day];
    if (!m) return "Menu loading ⏳";
    return m.dessert && m.dessert !== "-" ? ` <b>🍦 Dessert:</b> ${m.dessert}` : "No dessert listed for today ";
  }

  // Timings
  if (/time|timing|when|open|close|hour/i.test(text)) {
    const isWE = (day === "Saturday" || day === "Sunday");
    const t    = getActiveTimings(day);
    return ` <b>Mess Timings (${isWE?"Weekend":"Weekday"}):</b><br> ${t.breakfast}<br> ${t.lunch}<br> ${t.snacks}<br> ${t.dinner}`;
  }

  // Notice
  if (/notice|announcement|update|news/i.test(text)) {
    return ` <b>${latestNotice.title}:</b><br>${latestNotice.content}`;
  }

  // Complaint
  if (/complain|complaint|issue|problem|bad food|hygiene/i.test(text)) {
    return `To file a complaint, tap the <b>＋</b> button at the bottom-right and select  or <a href="complaint.html" style="color:var(--accent);font-weight:600">click here</a>. Your message goes directly to the Mess Committee via WhatsApp! `;
  }

  // Rebate
  if (/rebate|leave|absent|refund/i.test(text)) {
    return `To apply for a mess rebate, visit <a href="http://10.15.7.7/messIITP/web/index.php" target="_blank" style="color:var(--accent);font-weight:600">the mess portal</a>. ✅ Submit your leave dates to get a refund!`;
  }

  // Veg/Non-veg
  if (/veg|non.veg|chicken|egg|paneer/i.test(text)) {
    if (!menu) return "Menu loading ⏳";
    const all = Object.values(menu).join(" ").toLowerCase();
    const items = ["chicken","egg","mutton","fish"].filter(x => all.includes(x));
    return items.length ? `Today's non-veg: <b>${items.map(x => x.charAt(0).toUpperCase()+x.slice(1)).join(", ")}</b> ` : `Today looks like a veg day! `;
  }

  // Paneer days
  if (/paneer/i.test(text)) {
    const days = DAYS.filter(d => { const m = cachedMenuData[d]; return m && Object.values(m).some(v => v && v.toLowerCase().includes("paneer")); });
    return days.length ? `Paneer available on: <b>${days.join(", ")}</b> ` : "Checking... try again once the menu loads fully!";
  }

  // Dark mode
  if (/dark mode|night mode|light mode/i.test(text)) {
    return "Toggle dark/light mode using the / button at the top-right corner!";
  }

  // Thanks / bye / how are you
  if (/thank|thanks/i.test(text)) return "You're welcome!  Enjoy your meal! ";
  if (/bye|goodbye/i.test(text))  return "Bye! Have a great day!  Let me know if you need anything.";
  if (/how are you/i.test(text))  return "I'm doing great, always ready to help!  Ask me anything about the mess.";
  if (/who made|creator|developer/i.test(text)) return "I was created by <b>Goutam (G.K.G)</b> to make mess life easier for CVR students! ";

  // Fallback
  const tips = ["Try: 'Today's menu', 'Monday dinner', 'What time is lunch?' ", "I can help with menu, timings, notices, special events, dish photos & complaints!", "Ask me: 'Any special tonight?' or 'Show dish photos' "];
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
      showToast(" Notifications enabled! You'll be notified of menu updates.", "success");
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
