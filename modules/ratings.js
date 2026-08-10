/* =================================================================
   RATINGS MODULE — Persistent Per-Dish Ratings with Abuse Prevention
   ================================================================= */

import { doc, setDoc, collection, query, where, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// Generate or retrieve persistent anonymous user fingerprint
function getFingerprint() {
  let fp = localStorage.getItem('user_fingerprint');
  if (!fp) {
    fp = 'usr_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    localStorage.setItem('user_fingerprint', fp);
  }
  return fp;
}

// Inject styles for dish ratings
const style = document.createElement('style');
style.textContent = `
  .rt-dish-container { display: inline-flex; align-items: center; gap: 6px; margin-left: 8px; vertical-align: middle; }
  .rt-dish-stars { display: inline-flex; gap: 2px; }
  .rt-dish-star { color: var(--border); font-size: 1.2rem; cursor: pointer; transition: color 0.2s, transform 0.2s; line-height: 1; user-select: none; padding: 4px; touch-action: manipulation; }
  .rt-dish-star:hover, .rt-dish-stars:hover .rt-dish-star { color: var(--yellow-border); }
  .rt-dish-star:hover ~ .rt-dish-star { color: var(--border) !important; }
  .rt-dish-star.active { color: var(--yellow); }
  .rt-dish-agg { font-size: 0.75rem; color: var(--text3); font-weight: 600; background: var(--surface2); padding: 4px 8px; border-radius: 12px; border: 1px solid var(--border); display: none; }
  .rt-dish-agg.show { display: inline-flex; align-items: center; gap: 2px; }
  .rt-dish-agg-star { color: var(--yellow); font-size: 0.8rem; }
`;
document.head.appendChild(style);

/* ─── INJECT RATING BUTTONS ────────────────────────────── */
export function injectRatingButtons() {
  const app = window.messApp;
  if (!app?.currentHostel || !app?.currentSelectedDay) return;

  const menuCard = document.querySelector('#menuOutput .menu-card');
  if (!menuCard) return;

  // Remove old meal-level rating buttons if any
  menuCard.querySelectorAll('.rt-inline, .rt-avg-display').forEach(el => el.remove());

  // Inject per-dish ratings
  const items = menuCard.querySelectorAll('.ni-item');
  items.forEach(itemEl => {
    // Prevent duplicate injection
    if (itemEl.querySelector('.rt-dish-container')) return;

    const input = itemEl.querySelector('.ni-checkbox');
    if (!input) return;
    
    const dishName = input.value;
    // Determine meal type by finding the closest meal-row
    const row = itemEl.closest('.meal-row');
    let mealType = 'unknown';
    if (row) {
      const iconClasses = row.querySelector('.meal-icon')?.className || '';
      if (iconClasses.includes('breakfast')) mealType = 'breakfast';
      else if (iconClasses.includes('lunch')) mealType = 'lunch';
      else if (iconClasses.includes('snacks')) mealType = 'snacks';
      else if (iconClasses.includes('dinner')) mealType = 'dinner';
      else if (iconClasses.includes('dessert')) mealType = 'dessert';
    }

    const container = document.createElement('span');
    container.className = 'rt-dish-container';
    container.dataset.dish = dishName;
    
    // Add 5 stars
    const starsDiv = document.createElement('span');
    starsDiv.className = 'rt-dish-stars';
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('span');
      star.className = 'rt-dish-star';
      star.textContent = '★';
      star.dataset.val = i;
      
      star.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation(); // prevent checking the nutrition checkbox
        submitDishRating(dishName, mealType, i, starsDiv);
      });
      starsDiv.appendChild(star);
    }
    
    // Add aggregate display
    const aggDiv = document.createElement('span');
    aggDiv.className = 'rt-dish-agg';
    aggDiv.innerHTML = `<span class="rt-dish-agg-star">★</span> <span class="rt-val"></span> (<span class="rt-cnt"></span>)`;

    container.appendChild(starsDiv);
    container.appendChild(aggDiv);
    
    // Insert after the text span, but before qty picker
    const textSpan = itemEl.querySelector('.ni-text');
    if (textSpan) {
      textSpan.after(container);
    } else {
      itemEl.appendChild(container);
    }
  });

  // Start real-time listener for current day's ratings
  showAggregatedRatings();
}

/* ─── SUBMIT RATING ────────────────────────────────────── */
async function submitDishRating(dishName, mealType, ratingVal, starsDiv) {
  const app = window.messApp;
  if (!app?.db) {
    if (window.showToast) window.showToast('Database not connected', 'warning');
    return;
  }

  const fingerprint = getFingerprint();
  const date = new Date().toISOString().split('T')[0];
  const hostel = app.currentHostel;

  // Custom document ID to enforce one rating per user per dish per day
  const cleanDish = dishName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const docId = `${fingerprint}_${hostel}_${date}_${cleanDish}`;

  try {
    // Optimistic UI update
    updateStarsUI(starsDiv, ratingVal);

    await setDoc(doc(app.db, 'dish_ratings', docId), {
      fingerprint,
      hostel,
      date,
      mealType,
      dishName,
      rating: ratingVal,
      timestamp: serverTimestamp()
    });

    if (window.showToast) window.showToast(`⭐ Rated ${dishName} ${ratingVal} stars!`, 'success');
  } catch (err) {
    console.error('Rating submit error:', err);
    if (window.showToast) window.showToast('Failed to submit rating.', 'warning');
  }
}

function updateStarsUI(starsDiv, val) {
  starsDiv.querySelectorAll('.rt-dish-star').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.val) <= val);
  });
}

/* ─── REALTIME AGGREGATION ─────────────────────────────── */
let ratingsUnsubscribe = null;

async function showAggregatedRatings() {
  const app = window.messApp;
  if (!app?.db || !app?.currentHostel || !app?.currentSelectedDay) return;

  if (ratingsUnsubscribe) {
    ratingsUnsubscribe();
    ratingsUnsubscribe = null;
  }

  const date = new Date().toISOString().split('T')[0];
  const fp = getFingerprint();

  try {
    const q = query(
      collection(app.db, 'dish_ratings'),
      where('hostel', '==', app.currentHostel),
      where('date', '==', date)
    );

    ratingsUnsubscribe = onSnapshot(q, (snap) => {
      const stats = {}; // dishName -> { total: 0, count: 0, userRating: 0 }
      
      snap.docs.forEach(doc => {
        const d = doc.data();
        if (!stats[d.dishName]) stats[d.dishName] = { total: 0, count: 0, userRating: 0 };
        
        stats[d.dishName].total += d.rating;
        stats[d.dishName].count += 1;
        
        if (d.fingerprint === fp) {
          stats[d.dishName].userRating = d.rating;
        }
      });

      // Update UI
      const menuCard = document.querySelector('#menuOutput .menu-card');
      if (!menuCard) return;

      Object.keys(stats).forEach(dish => {
        const containers = menuCard.querySelectorAll(`.rt-dish-container[data-dish="${dish}"]`);
        containers.forEach(container => {
          const s = stats[dish];
          
          // Update user's stars if they rated on another device or previous load
          if (s.userRating > 0) {
            updateStarsUI(container.querySelector('.rt-dish-stars'), s.userRating);
          }

          // Update aggregate display
          if (s.count > 0) {
            const agg = container.querySelector('.rt-dish-agg');
            const avg = (s.total / s.count).toFixed(1);
            agg.querySelector('.rt-val').textContent = avg;
            agg.querySelector('.rt-cnt').textContent = s.count;
            agg.classList.add('show');
          }
        });
      });
    });
  } catch (err) {
    console.warn('Ratings fetch error:', err);
  }
}

// Automatically re-fetch ratings if hostel changes
document.addEventListener('hostelChanged', () => {
  showAggregatedRatings();
});

export function cleanup() {
  if (ratingsUnsubscribe) {
    ratingsUnsubscribe();
    ratingsUnsubscribe = null;
  }
}

export default { injectRatingButtons, cleanup };
