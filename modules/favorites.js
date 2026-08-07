/* =================================================================
   FAVORITES MODULE — Save & load favorite meal combinations
   ================================================================= */

const FAVORITES_KEY = 'favorite_meals';

function getFavorites() {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || []; }
  catch { return []; }
}

function saveFavorites(favs) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
}

/* ─── ADD FAVORITE ─────────────────────────────────────── */
export function addFavorite(name, items, mealType) {
  const favs = getFavorites();
  const id = 'fav_' + Date.now();
  favs.push({
    id,
    name: name || `${mealType || 'Meal'} — ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`,
    items, // Array of food item names
    mealType,
    createdAt: Date.now()
  });
  saveFavorites(favs);
  return id;
}

export function removeFavorite(id) {
  const favs = getFavorites().filter(f => f.id !== id);
  saveFavorites(favs);
}

/* ─── INJECT FAVORITE BUTTON ───────────────────────────── */
export function injectFavoriteButton() {
  const menuCard = document.querySelector('#menuOutput .menu-card');
  if (!menuCard || menuCard.querySelector('.fv-save-btn')) return;

  const btn = document.createElement('button');
  btn.className = 'fv-save-btn';
  btn.innerHTML = '❤️ Save as Favorite';
  btn.addEventListener('click', () => {
    const checked = document.querySelectorAll('.ni-checkbox:checked');
    let items;
    if (checked.length > 0) {
      items = Array.from(checked).map(cb => cb.value);
    } else {
      // Save all items from current menu
      const mealTexts = menuCard.querySelectorAll('.meal-text');
      items = [];
      mealTexts.forEach(mt => {
        const text = mt.textContent;
        if (text && text !== '—') {
          items.push(...text.split(',').map(i => i.trim()).filter(Boolean));
        }
      });
    }

    if (items.length === 0) {
      if (window.showToast) window.showToast('No items to save', 'warning');
      return;
    }

    const app = window.messApp;
    const day = app?.currentSelectedDay || 'Today';
    const name = prompt('Name this favorite:', `${day}'s Meal`) || `${day}'s Meal`;
    addFavorite(name, items, null);
    if (window.showToast) window.showToast('❤️ Saved to favorites!', 'success');
  });

  const actions = menuCard.querySelector('.ni-actions');
  if (actions) actions.appendChild(btn);
  else menuCard.appendChild(btn);
}

/* ─── FAVORITES LIST (in Settings) ─────────────────────── */
export function renderFavoritesList(container) {
  const favs = getFavorites();

  if (favs.length === 0) {
    container.innerHTML = '<p class="fv-empty">No favorites saved yet. Select items and tap ❤️ to save.</p>';
    return;
  }

  container.innerHTML = favs.map(fav => `
    <div class="fv-item">
      <div class="fv-item-info">
        <div class="fv-item-name">${escHtml(fav.name)}</div>
        <div class="fv-item-items">${fav.items.map(i => escHtml(i)).join(', ')}</div>
      </div>
      <div class="fv-item-actions">
        <button class="fv-load-btn" data-id="${fav.id}">📊 Analyze</button>
        <button class="fv-del-btn" data-id="${fav.id}">🗑</button>
      </div>
    </div>
  `).join('');

  // Load favorite into analyzer
  container.querySelectorAll('.fv-load-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const fav = favs.find(f => f.id === btn.dataset.id);
      if (fav) {
        // Import and trigger analysis
        import('./nutrition.js?v=8').then(mod => {
          mod.analyzeMeal(fav.items).then(result => {
            document.dispatchEvent(new CustomEvent('mealAnalyzed', { detail: result }));
            // Show result in nutrition modal
            const nmRoot = document.getElementById('nutrition-modal-root');
            if (nmRoot) {
              // Close settings first, then show analysis
              const spOverlay = document.getElementById('spOverlay');
              if (spOverlay) {
                spOverlay.classList.add('sp-closing');
                setTimeout(() => {
                  document.getElementById('settings-panel-root').innerHTML = '';
                }, 300);
              }
            }
          });
        });
      }
    });
  });

  // Delete
  container.querySelectorAll('.fv-del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      removeFavorite(btn.dataset.id);
      renderFavoritesList(container);
      if (window.showToast) window.showToast('Favorite removed', 'info');
    });
  });
}

function escHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

export default { addFavorite, removeFavorite, injectFavoriteButton, renderFavoritesList, getFavorites };
