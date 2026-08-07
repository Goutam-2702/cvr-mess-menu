/* =================================================================
   CROWD MODULE — Crowd prediction, user reporting, admin controls
   Uses Firestore for real-time sync across all users
   ================================================================= */

import { doc, onSnapshot, setDoc, getDoc, collection, addDoc, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const COOLDOWN_KEY = 'crowd_cooldown';
const LAST_CROWD_TS = 'last_crowd_ts';
const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

// Time-based crowd estimates (fallback when no data)
const CROWD_HEURISTICS = {
  weekday: {
    breakfast: { '7:30-8:30': 'medium', '8:30-9:00': 'high', '9:00-9:30': 'low' },
    lunch: { '12:30-13:00': 'high', '13:00-13:30': 'medium', '13:30-14:00': 'low' },
    dinner: { '20:00-20:30': 'high', '20:30-21:00': 'medium', '21:00-22:00': 'low' }
  },
  weekend: {
    breakfast: { '8:00-9:00': 'low', '9:00-9:30': 'medium', '9:30-10:00': 'low' },
    lunch: { '13:00-13:30': 'medium', '13:30-14:00': 'high', '14:00-15:00': 'low' },
    dinner: { '20:00-20:30': 'medium', '20:30-21:30': 'high', '21:30-22:00': 'low' }
  }
};

let crowdUnsubscribe = null;
let currentCrowdData = {};

/* ─── INIT ─────────────────────────────────────────────── */
export function initCrowd(db, hostel) {
  if (crowdUnsubscribe) crowdUnsubscribe();

  const root = document.getElementById('crowd-section-root');
  if (root) root.innerHTML = '<div class="cr-section" style="text-align: center; padding: 20px; color: var(--text3);">Loading live crowd data...</div>';
  const docRef = doc(db, 'crowd', hostel);
  
  crowdUnsubscribe = onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      const prevTs = localStorage.getItem(LAST_CROWD_TS + '_' + hostel);
      const newTs = data.updatedAt?.toMillis?.() || data.updatedAt || 0;

      currentCrowdData = data;
      renderCrowdSection(data, hostel);

      // Show notification only if admin updated (not user reports) and it's a new update
      if (data.updatedBy === 'admin' && prevTs && newTs > parseInt(prevTs)) {
        const meal = data.lastUpdatedMeal || 'mess';
        const level = data[meal] || 'medium';
        const emoji = level === 'low' ? '🟢' : level === 'high' ? '🔴' : '🟡';
        if (window.showToast) {
          window.showToast(`${emoji} ${capitalize(meal)} crowd updated: ${capitalize(level)}`, 'info');
        }
      }
      if (data.updatedAt) {
        localStorage.setItem(LAST_CROWD_TS + '_' + hostel, String(newTs));
      }
    } else {
      // No crowd data — show heuristic estimates
      renderCrowdSection(null, hostel);
    }
  }, (err) => {
    console.warn('Crowd listener error:', err);
    renderCrowdSection(null, hostel);
  });

  // Also render admin controls if admin
  renderAdminControls(db, hostel);
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
      levels[meal] = data[meal]; // Admin or reported level
    } else {
      levels[meal] = getHeuristicLevel(meal, isWeekend);
    }
  }

  const isDataFresh = data?.updatedAt && (Date.now() - (data.updatedAt?.toMillis?.() || data.updatedAt || 0) < 3600000);
  const source = data?.updatedBy === 'admin' ? 'Admin reported' : isDataFresh ? 'User reported' : 'Estimated';

  root.innerHTML = `
  <div class="cr-section">
    <div class="cr-header">
      <h3>👥 Mess Crowd</h3>
      <span class="cr-source">${source}</span>
    </div>
    <div class="cr-grid">
      ${meals.map(meal => {
        const level = levels[meal];
        const { emoji, color, label, bgColor } = getLevelDisplay(level);
        return `<div class="cr-card" style="border-color: ${color}20; background: ${bgColor}">
          <div class="cr-card-icon">${getMealIcon(meal)}</div>
          <div class="cr-card-label">${capitalize(meal)}</div>
          <div class="cr-card-level" style="color: ${color}">
            <span class="cr-dot" style="background: ${color}"></span>
            ${emoji} ${label}
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="cr-actions">
      <button class="cr-btn cr-btn-going" id="crGoing" ${isCooldown() ? 'disabled' : ''}>
        🚶 I'm Going
      </button>
      <button class="cr-btn cr-btn-here" id="crHere" ${isCooldown() ? 'disabled' : ''}>
        📍 I'm Here
      </button>
      <button class="cr-btn cr-btn-leaving" id="crLeaving" ${isCooldown() ? 'disabled' : ''}>
        👋 I'm Leaving
      </button>
    </div>
    ${isCooldown() ? `<div class="cr-cooldown">⏳ You can report again in ${getCooldownRemaining()}</div>` : ''}
  </div>`;

  // Event listeners for crowd reporting
  setupReportButtons(hostel);
}

/* ─── USER REPORTING ───────────────────────────────────── */
function setupReportButtons(hostel) {
  ['crGoing', 'crHere', 'crLeaving'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn && !btn.disabled) {
      btn.addEventListener('click', () => reportCrowd(id.replace('cr', '').toLowerCase(), hostel));
    }
  });
}

async function reportCrowd(action, hostel) {
  if (isCooldown()) return;

  const db = window.messApp?.db;
  if (!db) return;

  try {
    // Write anonymous report
    await addDoc(collection(db, 'crowd_reports'), {
      hostel,
      action, // 'going', 'here', 'leaving'
      timestamp: serverTimestamp(),
      date: new Date().toISOString().split('T')[0]
    });

    // Set cooldown
    localStorage.setItem(COOLDOWN_KEY, String(Date.now()));

    if (window.showToast) {
      const msgs = { going: '🚶 Thanks! Noted that you\'re heading to mess.', here: '📍 Got it! You\'re at the mess.', leaving: '👋 Thanks for the update!' };
      window.showToast(msgs[action] || 'Reported!', 'success');
    }

    // Re-render to show cooldown
    renderCrowdSection(currentCrowdData, hostel);
  } catch (err) {
    console.error('Report error:', err);
    if (window.showToast) window.showToast('Could not submit report. Try again.', 'warning');
  }
}

function isCooldown() {
  const last = parseInt(localStorage.getItem(COOLDOWN_KEY) || '0');
  return Date.now() - last < COOLDOWN_MS;
}

function getCooldownRemaining() {
  const last = parseInt(localStorage.getItem(COOLDOWN_KEY) || '0');
  const remaining = COOLDOWN_MS - (Date.now() - last);
  if (remaining <= 0) return '';
  const mins = Math.ceil(remaining / 60000);
  return `${mins} min`;
}

/* ─── ADMIN CONTROLS ───────────────────────────────────── */
function renderAdminControls(db, hostel) {
  const isAdmin = (hostel === 'aryabhatt' && localStorage.getItem('admin_aryabhatta') === 'true') ||
                  (hostel === 'c v raman' && localStorage.getItem('admin_cvr') === 'true');

  const root = document.getElementById('admin-toolbar-root');
  if (!root) return;

  if (!isAdmin) { root.innerHTML = ''; return; }

  root.innerHTML = `
  <div class="at-container">
    <div class="at-header">
      <span class="at-badge">ADMIN</span>
      <span class="at-title">Crowd Control</span>
    </div>
    <div class="at-controls">
      ${['breakfast', 'lunch', 'dinner'].map(meal => `
      <div class="at-meal">
        <span class="at-meal-label">${getMealIcon(meal)} ${capitalize(meal)}</span>
        <div class="at-level-btns">
          <button class="at-lvl at-low ${currentCrowdData[meal] === 'low' ? 'at-active' : ''}" data-meal="${meal}" data-level="low">🟢 Low</button>
          <button class="at-lvl at-med ${currentCrowdData[meal] === 'medium' ? 'at-active' : ''}" data-meal="${meal}" data-level="medium">🟡 Medium</button>
          <button class="at-lvl at-high ${currentCrowdData[meal] === 'high' ? 'at-active' : ''}" data-meal="${meal}" data-level="high">🔴 High</button>
        </div>
      </div>`).join('')}
    </div>
  </div>`;

  // Debounced admin updates
  let debounceTimer = null;
  root.querySelectorAll('.at-lvl').forEach(btn => {
    btn.addEventListener('click', () => {
      const meal = btn.dataset.meal;
      const level = btn.dataset.level;

      // Visual feedback immediately
      btn.closest('.at-level-btns').querySelectorAll('.at-lvl').forEach(b => b.classList.remove('at-active'));
      btn.classList.add('at-active');

      // Debounce the Firestore write
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          await setDoc(doc(db, 'crowd', hostel), {
            [meal]: level,
            updatedBy: 'admin',
            lastUpdatedMeal: meal,
            updatedAt: serverTimestamp()
          }, { merge: true });
          if (window.showToast) window.showToast(`✅ ${capitalize(meal)} crowd set to ${capitalize(level)}`, 'success');
        } catch (err) {
          console.error('Admin crowd update error:', err);
          if (window.showToast) window.showToast('Failed to update crowd level', 'warning');
        }
      }, 500); // 500ms debounce
    });
  });
}

/* ─── HEURISTICS ───────────────────────────────────────── */
function getHeuristicLevel(meal, isWeekend) {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const timeMin = h * 60 + m;

  // Simple time-based heuristics
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
    case 'low': return { emoji: '🟢', color: '#10b981', label: 'Low', bgColor: '#ecfdf510' };
    case 'high': return { emoji: '🔴', color: '#ef4444', label: 'High', bgColor: '#fef2f210' };
    default: return { emoji: '🟡', color: '#f59e0b', label: 'Medium', bgColor: '#fffbeb10' };
  }
}

function getMealIcon(meal) {
  return { breakfast: '🍳', lunch: '🍱', dinner: '🍛' }[meal] || '🍽️';
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

export function cleanup() {
  if (crowdUnsubscribe) crowdUnsubscribe();
}

export default { initCrowd, cleanup };
