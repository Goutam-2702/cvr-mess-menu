/* =================================================================
   RATINGS MODULE — Food ratings (Taste, Quality, Quantity, Freshness)
   ================================================================= */

import { doc, setDoc, getDoc, collection, addDoc, query, where, getDocs, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const RATING_KEY_PREFIX = 'rated_';

function getRatingKey(hostel, day, mealType) {
  const date = new Date().toISOString().split('T')[0];
  return `${RATING_KEY_PREFIX}${hostel}_${day}_${mealType}_${date}`;
}

function hasRated(hostel, day, mealType) {
  return localStorage.getItem(getRatingKey(hostel, day, mealType)) === '1';
}

/* ─── INJECT RATING BUTTONS ────────────────────────────── */
export function injectRatingButtons() {
  const app = window.messApp;
  if (!app?.currentHostel || !app?.currentSelectedDay) return;

  const menuCard = document.querySelector('#menuOutput .menu-card');
  if (!menuCard) return;

  // Remove old rating section
  const old = menuCard.querySelector('.rt-section');
  if (old) old.remove();

  const mealRows = menuCard.querySelectorAll('.meal-row');
  mealRows.forEach(row => {
    const iconEl = row.querySelector('.meal-icon');
    if (!iconEl) return;
    const classes = iconEl.className;
    let mealType = null;
    if (classes.includes('breakfast')) mealType = 'breakfast';
    else if (classes.includes('lunch')) mealType = 'lunch';
    else if (classes.includes('snacks')) mealType = 'snacks';
    else if (classes.includes('dinner')) mealType = 'dinner';
    else return;

    // Don't add if already has rating button
    if (row.querySelector('.rt-inline')) return;

    const rated = hasRated(app.currentHostel, app.currentSelectedDay, mealType);
    
    const rateBtn = document.createElement('div');
    rateBtn.className = 'rt-inline';
    rateBtn.innerHTML = rated
      ? '<span class="rt-done">✅ Rated</span>'
      : `<button class="rt-rate-btn" data-meal="${mealType}">⭐ Rate</button>`;
    row.appendChild(rateBtn);

    if (!rated) {
      rateBtn.querySelector('.rt-rate-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        showRatingModal(mealType);
      });
    }
  });

  // Show aggregated ratings below menu
  showAggregatedRatings();
}

/* ─── RATING MODAL ─────────────────────────────────────── */
function showRatingModal(mealType) {
  const root = document.getElementById('nutrition-modal-root'); // Reuse modal root
  if (!root) return;

  const mealLabel = mealType.charAt(0).toUpperCase() + mealType.slice(1);
  const mealIcon = { breakfast: '🍳', lunch: '🍱', snacks: '☕', dinner: '🍛' }[mealType] || '🍽️';

  root.innerHTML = `
  <div class="nm-overlay nm-show" id="rtOverlay">
    <div class="nm-modal" style="max-width: 380px">
      <div class="nm-header" style="background: linear-gradient(135deg, #f59e0b, #d97706)">
        <h3>${mealIcon} Rate ${mealLabel}</h3>
        <button class="nm-close" id="rtClose">✕</button>
      </div>
      <div class="nm-body">
        <p class="rt-modal-desc">How was today's ${mealType}?</p>
        
        ${['Taste', 'Quality', 'Quantity', 'Freshness'].map(criterion => `
        <div class="rt-criterion">
          <div class="rt-criterion-label">${criterion}</div>
          <div class="rt-stars" data-criterion="${criterion.toLowerCase()}">
            ${[1,2,3,4,5].map(star => `
              <button class="rt-star" data-val="${star}" data-criterion="${criterion.toLowerCase()}">★</button>
            `).join('')}
          </div>
        </div>`).join('')}

        <button class="nm-log-btn" id="rtSubmit" style="background: linear-gradient(135deg, #f59e0b, #d97706)">⭐ Submit Rating</button>
      </div>
    </div>
  </div>`;

  const ratings = { taste: 0, quality: 0, quantity: 0, freshness: 0 };

  // Star click handlers
  root.querySelectorAll('.rt-star').forEach(star => {
    star.addEventListener('click', () => {
      const criterion = star.dataset.criterion;
      const val = parseInt(star.dataset.val);
      ratings[criterion] = val;

      // Visual feedback
      star.closest('.rt-stars').querySelectorAll('.rt-star').forEach(s => {
        s.classList.toggle('rt-star-active', parseInt(s.dataset.val) <= val);
      });
    });
  });

  document.getElementById('rtClose').addEventListener('click', () => root.innerHTML = '');
  document.getElementById('rtOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'rtOverlay') root.innerHTML = '';
  });

  document.getElementById('rtSubmit').addEventListener('click', async () => {
    if (Object.values(ratings).some(v => v === 0)) {
      if (window.showToast) window.showToast('Please rate all criteria', 'warning');
      return;
    }

    const app = window.messApp;
    if (!app?.db) return;

    try {
      const date = new Date().toISOString().split('T')[0];
      await addDoc(collection(app.db, 'ratings'), {
        hostel: app.currentHostel,
        day: app.currentSelectedDay,
        mealType,
        date,
        ...ratings,
        average: Math.round(((ratings.taste + ratings.quality + ratings.quantity + ratings.freshness) / 4) * 10) / 10,
        timestamp: serverTimestamp()
      });

      localStorage.setItem(getRatingKey(app.currentHostel, app.currentSelectedDay, mealType), '1');
      root.innerHTML = '';
      if (window.showToast) window.showToast('⭐ Rating submitted! Thank you.', 'success');
      injectRatingButtons(); // Refresh to show "Rated"
    } catch (err) {
      console.error('Rating submit error:', err);
      if (window.showToast) window.showToast('Could not submit rating. Try again.', 'warning');
    }
  });
}

/* ─── AGGREGATED RATINGS ───────────────────────────────── */
let ratingsUnsubscribe = null;

async function showAggregatedRatings() {
  const app = window.messApp;
  if (!app?.db || !app?.currentHostel || !app?.currentSelectedDay) return;

  // Clean up old listener
  if (ratingsUnsubscribe) ratingsUnsubscribe();

  const date = new Date().toISOString().split('T')[0];

  try {
    const q = query(
      collection(app.db, 'ratings'),
      where('hostel', '==', app.currentHostel),
      where('day', '==', app.currentSelectedDay),
      where('date', '==', date)
    );

    ratingsUnsubscribe = onSnapshot(q, (snap) => {
      if (snap.empty) return;

      const byMeal = {};
      snap.docs.forEach(doc => {
        const d = doc.data();
        if (!byMeal[d.mealType]) byMeal[d.mealType] = [];
        byMeal[d.mealType].push(d);
      });

      // Update inline rating displays
      for (const [mealType, entries] of Object.entries(byMeal)) {
        const avg = entries.reduce((s, e) => s + (e.average || 0), 0) / entries.length;
        const count = entries.length;
        updateMealRatingDisplay(mealType, avg, count);
      }
    });
  } catch (err) {
    console.warn('Ratings fetch error:', err);
  }
}

function updateMealRatingDisplay(mealType, average, count) {
  const menuCard = document.querySelector('#menuOutput .menu-card');
  if (!menuCard) return;

  const rows = menuCard.querySelectorAll('.meal-row');
  rows.forEach(row => {
    const iconEl = row.querySelector('.meal-icon');
    if (!iconEl) return;
    if (!iconEl.className.includes(mealType)) return;

    // Remove old display
    const old = row.querySelector('.rt-avg-display');
    if (old) old.remove();

    if (average > 0) {
      const display = document.createElement('div');
      display.className = 'rt-avg-display';
      display.innerHTML = `<span class="rt-avg-stars">${getStarDisplay(average)}</span><span class="rt-avg-count">(${count})</span>`;
      const rateBtn = row.querySelector('.rt-inline');
      if (rateBtn) rateBtn.before(display);
      else row.appendChild(display);
    }
  });
}

function getStarDisplay(avg) {
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(avg)) stars += '★';
    else if (i - 0.5 <= avg) stars += '★';
    else stars += '☆';
  }
  return `${stars} ${avg.toFixed(1)}`;
}

export function cleanup() {
  if (ratingsUnsubscribe) ratingsUnsubscribe();
}

export default { injectRatingButtons, cleanup };
