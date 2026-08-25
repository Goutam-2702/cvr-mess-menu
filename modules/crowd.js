/* =================================================================
   CROWD MODULE — Admin-controlled crowd status
   Uses Firestore for real-time sync across all users
   ================================================================= */

import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const LAST_CROWD_TS = 'last_crowd_ts';

let crowdUnsubscribe = null;

/* ─── ICONS ────────────────────────────────────────────── */
const ICONS = {
  breakfast: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>`,
  lunch: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
  dinner: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
  users: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
};

/* ─── INIT ─────────────────────────────────────────────── */
export function initCrowd(db, hostel) {
  if (crowdUnsubscribe) crowdUnsubscribe();

  const root = document.getElementById('crowd-section-root');
  if (root) root.innerHTML = '<div class="cr-section"><div class="cr-loading">Loading live crowd data...</div></div>';
  const docRef = doc(db, 'crowd', hostel);
  
  crowdUnsubscribe = onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      const prevTs = localStorage.getItem(LAST_CROWD_TS + '_' + hostel);
      const newTs = data.updatedAt?.toMillis?.() || data.updatedAt || 0;

      renderCrowdSection(data, hostel);

      // Show notification if admin updated it
      if (data.updatedBy === 'admin' && prevTs && newTs > parseInt(prevTs)) {
        const meal = data.lastUpdatedMeal || 'mess';
        const level = data[meal] || 'medium';
        if (window.showToast) {
          window.showToast(`${capitalize(meal)} crowd updated: ${capitalize(level)}`, 'info');
        }
      }
      if (data.updatedAt) {
        localStorage.setItem(LAST_CROWD_TS + '_' + hostel, String(newTs));
      }
    } else {
      renderCrowdSection(null, hostel);
    }
  }, (err) => {
    console.warn('Crowd listener error:', err);
    renderCrowdSection(null, hostel);
  });
}

/* ─── RENDER CROWD SECTION ─────────────────────────────── */
function renderCrowdSection(data, hostel) {
  const root = document.getElementById('crowd-section-root');
  if (!root) return;

  const meals = ['breakfast', 'lunch', 'dinner'];
  const now = new Date();
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  
  const levels = {};
  for (const meal of meals) {
    if (data && data[meal]) {
      levels[meal] = data[meal];
    } else {
      levels[meal] = getHeuristicLevel(meal, isWeekend);
    }
  }

  const source = data?.updatedBy === 'admin' ? 'Live Updates' : 'Estimated';

  root.innerHTML = `
  <div class="cr-section">
    <div class="cr-header">
      <div class="cr-title-row">
        ${ICONS.users}
        <h3>Mess Crowd</h3>
      </div>
      <span class="cr-source">${source}</span>
    </div>
    <div class="cr-grid">
      ${meals.map(meal => {
        const level = levels[meal];
        const { color, label, bgColor } = getLevelDisplay(level);
        return `<div class="cr-card" style="border-color: ${color}40; background: ${bgColor}">
          <div class="cr-card-icon" style="color: var(--text)">${ICONS[meal]}</div>
          <div class="cr-card-label">${capitalize(meal)}</div>
          <div class="cr-card-level" style="color: ${color}">
            <span class="cr-dot" style="background: ${color}"></span>
            ${label}
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

/* ─── HEURISTICS ───────────────────────────────────────── */
function getHeuristicLevel(meal, isWeekend) {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const timeMin = h * 60 + m;

  if (meal === 'breakfast') {
    if (timeMin >= 450 && timeMin < 510) return 'medium'; // 7:30-8:30
    if (timeMin >= 510 && timeMin < 540) return 'high';   // 8:30-9:00
    if (timeMin >= 540 && timeMin < 570) return 'low';    // 9:00-9:30
  }
  if (meal === 'lunch') {
    if (timeMin >= 750 && timeMin < 780) return 'high';   // 12:30-13:00
    if (timeMin >= 780 && timeMin < 810) return 'medium'; // 13:00-13:30
    if (timeMin >= 810 && timeMin < 840) return 'low';    // 13:30-14:00
  }
  if (meal === 'dinner') {
    if (timeMin >= 1200 && timeMin < 1230) return 'high'; // 20:00-20:30
    if (timeMin >= 1230 && timeMin < 1260) return 'medium'; // 20:30-21:00
    if (timeMin >= 1260 && timeMin < 1320) return 'low'; // 21:00-22:00
  }
  return 'medium'; // Default
}

/* ─── HELPERS ──────────────────────────────────────────── */
function getLevelDisplay(level) {
  switch (level) {
    case 'low': return { color: 'var(--green)', label: '🟢 Low', bgColor: 'var(--green-bg)' };
    case 'high': return { color: 'var(--red)', label: '🔴 High', bgColor: 'var(--red-bg)' };
    default: return { color: 'var(--yellow)', label: '🟡 Medium', bgColor: 'var(--yellow-bg)' };
  }
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

export function cleanup() {
  if (crowdUnsubscribe) crowdUnsubscribe();
}

export default { initCrowd, cleanup };
