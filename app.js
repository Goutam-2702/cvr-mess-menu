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
  });
}
