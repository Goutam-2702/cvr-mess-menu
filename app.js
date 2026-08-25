/* =================================================================
   APP.JS — Main orchestrator for all new modules
   Bridges existing script.js with new AI-powered features
   ================================================================= */

import { getProfile, showWelcomeModal, showGreeting, setupHostelRestriction } from './modules/profile.js?v=8';
import { injectMenuCheckboxes } from './modules/nutrition.js?v=8';
import { renderTrackerWidget, setupTrackerListeners } from './modules/tracker.js?v=8';
import { generateSuggestions, renderSuggestions } from './modules/suggestions.js?v=8';
import { initCrowd } from './modules/crowd.js?v=8';
import { injectRatingButtons } from './modules/ratings.js?v=8';
import { initSearch } from './modules/search.js?v=8';
import { injectFavoriteButton } from './modules/favorites.js?v=8';
import { initDashboard } from './modules/dashboard.js?v=8';
import { enhanceChatbot } from './modules/chatbot-ai.js?v=8';

/* ─── INIT ─────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', async () => {
  // Wait a tick for script.js to initialize
  await new Promise(r => setTimeout(r, 100));

  const profile = getProfile();

  // First visit → show welcome modal
  if (!profile) {
    const newProfile = await showWelcomeModal();
    if (newProfile) {
      // Set hostel in the dropdown and reload menu
      const hostelSel = document.getElementById('hostelSelect');
      if (hostelSel) {
        hostelSel.value = newProfile.hostel;
        hostelSel.dispatchEvent(new Event('change'));
      }
      showGreeting(newProfile);
      setupHostelRestriction(newProfile);
      initModules(newProfile);
    }
  } else {
    // Returning user
    showGreeting(profile);
    setupHostelRestriction(profile);
    initModules(profile);
  }

  // Fallback for stuck loading states (e.g. Firebase blocked or offline)
  setTimeout(() => {
    const ticker = document.getElementById('tickerText');
    if (ticker && ticker.textContent.includes('Loading latest')) {
      ticker.textContent = 'Welcome to Mess Menu! (Offline/Cache mode)';
    }
    const notice = document.getElementById('committeeNotice');
    if (notice && notice.textContent.includes('Loading notice')) {
      notice.textContent = 'Check back later for notices.';
    }
    const galCount = document.getElementById('galleryCount');
    if (galCount && galCount.textContent.includes('Loading')) {
      galCount.textContent = '0 photos';
      const dishGrid = document.getElementById('dishGrid');
      if (dishGrid && dishGrid.innerHTML.includes('spinner')) {
        dishGrid.innerHTML = '<div class="gallery-empty">Failed to load photos. Check connection.</div>';
      }
    }
    const menuOut = document.querySelector('#menuOutput .loading-spinner');
    if (menuOut) {
      document.getElementById('menuOutput').innerHTML = '<div class="menu-card"><p style="text-align:center;color:var(--red)"> Connection error or loading timeout.</p><button onclick="location.reload()" style="padding:8px 16px; margin: 10px auto; display: block; border-radius: 8px; border: 1px solid var(--border); background: var(--surface2); cursor: pointer; color: var(--text);">Retry Connection</button></div>';
    }
  }, 6000);
});

function initModules(profile) {
  // Initialize search
  initSearch();

  // Initialize tracker
  setupTrackerListeners();
  renderTrackerWidget();

  // Initialize dashboard
  initDashboard();

  // Enhance chatbot
  enhanceChatbot();

  // Listen for menu renders to inject new features
  document.addEventListener('menuRendered', (e) => {
    const { day, menu, hostel } = e.detail;

    // Inject checkboxes on menu items
    setTimeout(() => {
      injectMenuCheckboxes();
      injectFavoriteButton();
      injectRatingButtons();
    }, 50);

    // Generate & show AI suggestions
    if (menu && profile) {
      const suggestions = generateSuggestions(menu, day);
      if (suggestions) renderSuggestions(suggestions);
    }

    // Initialize crowd system
    const db = window.messApp?.db;
    if (db && hostel) {
      initCrowd(db, hostel);
    }
  });

  // Handle hostel change
  document.addEventListener('hostelChanged', (e) => {
    const db = window.messApp?.db;
    if (db) {
      initCrowd(db, e.detail.hostel);
    }
    if (typeof window.listenToNotice === 'function') {
      window.listenToNotice();
    }
  });

  // Export PDF click handler
  const pdfBtn = document.getElementById('downloadPdfBtn');
  if (pdfBtn) {
    pdfBtn.addEventListener('click', exportWeeklyMenuToPdf);
  }
}

/* ─── EXPORT WEEKLY MENU TO PDF ──────────────────────────── */
function exportWeeklyMenuToPdf() {
  const app = window.messApp;
  if (!app || !app.cachedMenuData) {
    if (window.showToast) window.showToast('Menu data not loaded yet', 'warning');
    return;
  }

  // Create temporary print container
  const printArea = document.createElement('div');
  printArea.id = 'weekly-print-area';

  const hostelName = app.currentHostel === 'aryabhatt' ? 'Aryabhatt Hostel' : 'C V Raman Hostel';
  
  // Create beautiful print content
  let html = `
    <div class="print-weekly-header">
      <div class="print-header-content">
        <h1> ${hostelName} - Weekly Mess Menu</h1>
        <p class="print-subtitle">Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
      </div>
    </div>
    <div class="print-weekly-grid">
  `;

  // Render cards for all 7 days in order
  const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  
  dayOrder.forEach(day => {
    const menu = app.cachedMenuData[day];
    if (!menu) return;

    html += `
      <div class="print-day-card">
        <h3>${day}</h3>
        <div class="print-meal-list">
          <div class="print-meal-item">
            <span class="print-meal-lbl"> Breakfast</span>
            <span class="print-meal-txt">${menu.breakfast || '—'}</span>
          </div>
          <div class="print-meal-item">
            <span class="print-meal-lbl"> Lunch</span>
            <span class="print-meal-txt">${menu.lunch || '—'}</span>
          </div>
          <div class="print-meal-item">
            <span class="print-meal-lbl"> Snacks</span>
            <span class="print-meal-txt">${menu.snacks || '—'}</span>
          </div>
          <div class="print-meal-item">
            <span class="print-meal-lbl"> Dinner</span>
            <span class="print-meal-txt">${menu.dinner || '—'}</span>
          </div>
    `;

    if (menu.dessert && menu.dessert !== '-' && menu.dessert !== '—') {
      html += `
          <div class="print-meal-item print-dessert-item">
            <span class="print-meal-lbl"> Dessert</span>
            <span class="print-meal-txt">${menu.dessert}</span>
          </div>
      `;
    }

    html += `
        </div>
      </div>
    `;
  });

  html += `
    </div>
    <div class="print-weekly-footer">
      <p>Please note: Menu is subject to change based on ingredients availability. Timings apply as per official notifications.</p>
    </div>
  `;

  printArea.innerHTML = html;
  document.body.appendChild(printArea);

  // Trigger print
  window.print();

  // Remove print area after print dialog closes
  setTimeout(() => {
    printArea.remove();
  }, 1000);
}
