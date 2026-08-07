/* =================================================================
   SEARCH MODULE — Instant menu search across all days
   ================================================================= */

export function initSearch() {
  const root = document.getElementById('search-bar-root');
  if (!root) return;

  root.innerHTML = `
  <div class="sr-container">
    <div class="sr-input-wrap">
      <span class="sr-icon">🔍</span>
      <input class="sr-input" id="srInput" type="text" placeholder="Search menu items..." autocomplete="off">
      <button class="sr-clear" id="srClear" style="display:none">✕</button>
    </div>
    <div class="sr-results" id="srResults" style="display:none"></div>
  </div>`;

  const input = document.getElementById('srInput');
  const clear = document.getElementById('srClear');
  const results = document.getElementById('srResults');

  let debounce = null;

  input.addEventListener('input', () => {
    clearTimeout(debounce);
    const q = input.value.trim();
    clear.style.display = q ? 'flex' : 'none';
    
    if (q.length < 2) { results.style.display = 'none'; return; }

    debounce = setTimeout(() => search(q), 200);
  });

  clear.addEventListener('click', () => {
    input.value = '';
    clear.style.display = 'none';
    results.style.display = 'none';
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) {
      results.style.display = 'none';
    }
  });

  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 2) {
      results.style.display = 'block';
    }
  });
}

function search(query) {
  const app = window.messApp;
  if (!app?.cachedMenuData) return;

  const results = document.getElementById('srResults');
  if (!results) return;

  const q = query.toLowerCase();
  const matches = [];

  const DAYS = app.DAYS || ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  for (const day of DAYS) {
    const menu = app.cachedMenuData[day];
    if (!menu) continue;

    for (const [mealType, items] of Object.entries(menu)) {
      if (!items || items === '—' || items === '-') continue;
      const itemList = items.split(',').map(i => i.trim());

      for (const item of itemList) {
        if (item.toLowerCase().includes(q)) {
          matches.push({ day, mealType, item, fullMenu: items });
        }
      }
    }
  }

  if (matches.length === 0) {
    results.innerHTML = `<div class="sr-empty">No items found for "${escHtml(query)}"</div>`;
    results.style.display = 'block';
    return;
  }

  // Group by item
  const grouped = {};
  for (const m of matches) {
    const key = m.item.toLowerCase();
    if (!grouped[key]) grouped[key] = { item: m.item, occurrences: [] };
    grouped[key].occurrences.push({ day: m.day, mealType: m.mealType });
  }

  const mealIcons = { breakfast: '🍳', lunch: '🍱', snacks: '☕', dinner: '🍛', dessert: '🍦' };

  results.innerHTML = Object.values(grouped).slice(0, 10).map(group => `
    <div class="sr-item">
      <div class="sr-item-name">${highlightMatch(group.item, q)}</div>
      <div class="sr-item-days">
        ${group.occurrences.map(o => 
          `<span class="sr-day-chip" data-day="${o.day}">${mealIcons[o.mealType] || '🍽️'} ${o.day.slice(0,3)} ${capitalize(o.mealType)}</span>`
        ).join('')}
      </div>
    </div>
  `).join('');

  results.style.display = 'block';

  // Click on day chip to navigate
  results.querySelectorAll('.sr-day-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const day = chip.dataset.day;
      // Trigger day tab click
      const tab = document.querySelector(`.day-tab[data-day="${day}"]`);
      if (tab) tab.click();
      results.style.display = 'none';
      document.getElementById('srInput').value = '';
      document.getElementById('srClear').style.display = 'none';
    });
  });
}

function highlightMatch(text, query) {
  const idx = text.toLowerCase().indexOf(query);
  if (idx === -1) return escHtml(text);
  return escHtml(text.slice(0, idx)) + `<mark>${escHtml(text.slice(idx, idx + query.length))}</mark>` + escHtml(text.slice(idx + query.length));
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

export default { initSearch };
