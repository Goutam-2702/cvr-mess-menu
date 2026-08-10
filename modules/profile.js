/* =================================================================
   PROFILE MODULE — User onboarding, hostel restriction, settings
   ================================================================= */

const PROFILE_KEY = 'user_profile';

export function getProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || null; }
  catch { return null; }
}

export function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function clearProfile() {
  localStorage.removeItem(PROFILE_KEY);
}

/* ─── HOSTEL SUGGESTION (hint only, NOT authoritative) ── */
function suggestHostel(rollNumber) {
  const rn = (rollNumber || '').trim().toLowerCase();
  // BTech 25xx → Aryabhatta (Mess-5), BTech 26xx → C.V. Raman (Mess-4)
  // But MTech, PhD, MSc with '26' can go to either mess,
  // so this is only a suggestion for common BTech cases.
  if (rn.startsWith('25')) return 'aryabhatt';
  if (rn.startsWith('26')) return 'c v raman';
  return null;
}

// Keep legacy name as alias for any code that might reference it
function detectHostel(rollNumber) {
  return suggestHostel(rollNumber);
}

/* ─── WELCOME MODAL ────────────────────────────────────── */
export function showWelcomeModal() {
  return new Promise((resolve) => {
    const root = document.getElementById('profile-modal-root');
    if (!root) { resolve(null); return; }

    root.innerHTML = `
    <div class="pm-overlay pm-show" id="pmOverlay">
      <div class="pm-modal" id="pmModal">
        <div class="pm-header">
          <div class="pm-header-icon">👋</div>
          <h2 class="pm-header-title">Welcome to Mess Menu!</h2>
          <p class="pm-header-sub">Set up your profile for a personalized experience</p>
        </div>
        <div class="pm-body">
          <div class="pm-step pm-step-active" id="pmStep1">
            <div class="pm-step-label">Your Info</div>
            <div class="pm-form-row">
              <label class="pm-label">Your Name *</label>
              <input class="pm-input" id="pmName" placeholder="e.g. Rahul Sharma" autocomplete="off">
            </div>
            <div class="pm-form-row">
              <label class="pm-label">Roll Number</label>
              <input class="pm-input" id="pmRoll" placeholder="e.g. 2501cs01 (optional)" autocomplete="off" maxlength="20">
              <div class="pm-hint" id="pmHostelHint"></div>
            </div>
            <div class="pm-form-row">
              <label class="pm-label">Your Mess *</label>
              <select class="pm-input" id="pmHostel" style="cursor: pointer;">
                <option value="">— Select your mess —</option>
                <option value="c v raman">Mess-4 — C.V. Raman</option>
                <option value="aryabhatt">Mess-5 — Aryabhatta</option>
              </select>
              <div class="pm-hint" id="pmMessHint" style="font-size: 0.72rem; color: var(--text3); margin-top: 4px; line-height: 1.4;">
                Mess-4 (CVR): BTech 26, MSc 26 Girls, MTech 26 Girls<br>
                Mess-5 (Aryabhatta): BTech 25, PhD 26 Boys, MSc 26 Boys
              </div>
            </div>
            <p style="font-size: 0.75rem; color: var(--text3); margin-bottom: 15px;">You can set your fitness profile (height, weight, etc.) later in the ⚙️ Settings panel on the dashboard.</p>
            <button class="pm-btn pm-btn-primary" id="pmFinish">Start Using App ✨</button>
          </div>
        </div>
      </div>
    </div>`;

    const rollInput = document.getElementById('pmRoll');
    const hostelSelect = document.getElementById('pmHostel');
    const hint = document.getElementById('pmHostelHint');

    // Roll number → suggest hostel (but user can override)
    rollInput.addEventListener('input', () => {
      const suggested = suggestHostel(rollInput.value);
      if (suggested && !hostelSelect.value) {
        // Auto-select only if user hasn't manually chosen yet
        hostelSelect.value = suggested;
        const label = suggested === 'aryabhatt' ? 'Aryabhatta (Mess-5)' : 'C.V. Raman (Mess-4)';
        hint.textContent = `💡 Auto-selected ${label} — change if needed`;
        hint.className = 'pm-hint pm-hint-success';
      } else if (suggested) {
        hint.textContent = '';
        hint.className = 'pm-hint';
      } else if (rollInput.value.length >= 2) {
        hint.textContent = 'Please select your mess manually below';
        hint.className = 'pm-hint pm-hint-warn';
      } else {
        hint.textContent = '';
        hint.className = 'pm-hint';
      }
    });

    document.getElementById('pmFinish').addEventListener('click', () => {
      const name = document.getElementById('pmName').value.trim();
      const roll = document.getElementById('pmRoll').value.trim();
      const hostel = hostelSelect.value;

      if (!name) { shakeInput('pmName'); return; }
      if (!hostel) {
        // Highlight the mess selector
        hostelSelect.style.borderColor = '#ef4444';
        hostelSelect.classList.add('pm-shake');
        setTimeout(() => { hostelSelect.classList.remove('pm-shake'); hostelSelect.style.borderColor = ''; }, 600);
        hostelSelect.focus();
        return;
      }

      const profile = {
        name,
        rollNumber: roll,
        hostel,
        age: 20,
        gender: 'male',
        height: 170,
        weight: 65,
        activityLevel: 'moderate',
        fitnessGoal: 'maintenance',
        createdAt: Date.now()
      };

      saveProfile(profile);
      localStorage.setItem('selectedHostel', profile.hostel);

      // Close modal with animation
      document.getElementById('pmOverlay').classList.add('pm-closing');
      setTimeout(() => { root.innerHTML = ''; resolve(profile); }, 400);
    });
  });
}

function shakeInput(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('pm-shake');
  el.style.borderColor = '#ef4444';
  setTimeout(() => { el.classList.remove('pm-shake'); el.style.borderColor = ''; }, 600);
  el.focus();
}

/* ─── GREETING ─────────────────────────────────────────── */
export function showGreeting(profile) {
  if (!profile?.name) return;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const hostelName = profile.hostel === 'aryabhatt' ? 'Aryabhatt' : 'CVR';

  const container = document.querySelector('.logo-container');
  if (!container) return;

  // Remove existing greeting if any
  const old = document.getElementById('userGreeting');
  if (old) old.remove();

  const greetEl = document.createElement('div');
  greetEl.id = 'userGreeting';
  greetEl.className = 'user-greeting';
  greetEl.innerHTML = `
    <span class="ug-text">${greeting}, <strong>${profile.name.split(' ')[0]}</strong>! 👋</span>
    <span class="ug-hostel">${hostelName} Hostel</span>
    <button class="ug-settings-btn" id="openSettingsBtn" aria-label="Settings">⚙️</button>
  `;
  container.after(greetEl);

  document.getElementById('openSettingsBtn').addEventListener('click', () => showSettings());
}

/* ─── HOSTEL RESTRICTION ───────────────────────────────── */
export function setupHostelRestriction(profile) {
  if (!profile?.hostel) return;

  // Set the hostel dropdown to user's hostel on initial load
  const hostelSel = document.getElementById('hostelSelect');
  if (hostelSel) {
    // Only dispatch change if it's different from the URL param so we don't double load
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.get('hostel')) {
      hostelSel.value = profile.hostel;
      hostelSel.dispatchEvent(new Event('change'));
    }
  }

  // Intercept hostel switch attempts (reads latest profile each time)
  document.addEventListener('hostelChanging', (e) => {
    const currentProfile = getProfile();
    if (!currentProfile?.hostel) return;
    const newHostel = e.detail.newHostel;
    if (newHostel !== currentProfile.hostel) {
      e.preventDefault();
      showAccessDenied(currentProfile.hostel);
    }
  });
}

function showAccessDenied(userHostel) {
  const hostelName = userHostel === 'aryabhatt' ? 'Aryabhatta' : 'C.V. Raman';
  
  if (window.showToast) {
    window.showToast(`🚫 You belong to ${hostelName} mess. Mess assignments cannot be changed.`, 'warning');
  }
}

/* ─── SETTINGS PANEL ───────────────────────────────────── */
export function showSettings() {
  const profile = getProfile();
  if (!profile) return;

  const root = document.getElementById('settings-panel-root');
  if (!root) return;

  const goalLabels = {
    weight_loss: '🔥 Weight Loss',
    maintenance: '⚖️ Maintenance',
    muscle_gain: '💪 Muscle Gain',
    weight_gain: '📈 Weight Gain'
  };

  root.innerHTML = `
  <div class="sp-overlay sp-show" id="spOverlay">
    <div class="sp-panel" id="spPanel">
      <div class="sp-header">
        <h3>⚙️ Settings</h3>
        <button class="sp-close" id="spClose">✕</button>
      </div>
      <div class="sp-body">
        <div class="sp-section">
          <div class="sp-section-title">👤 Profile</div>
          <div class="sp-form-row">
            <label class="sp-label">Name</label>
            <input class="sp-input" id="spName" value="${profile.name || ''}">
          </div>
          <div class="sp-form-row">
            <label class="sp-label">Roll Number</label>
            <input class="sp-input" id="spRoll" value="${profile.rollNumber || ''}" disabled>
            <div class="sp-disabled-hint">Roll number cannot be changed</div>
          </div>
          <div class="sp-form-row">
            <label class="sp-label">Your Mess</label>
            <select class="sp-input" id="spHostel" disabled>
              <option value="c v raman" ${profile.hostel === 'c v raman' ? 'selected' : ''}>Mess-4 — C.V. Raman</option>
              <option value="aryabhatt" ${profile.hostel === 'aryabhatt' ? 'selected' : ''}>Mess-5 — Aryabhatta</option>
            </select>
            <div class="sp-disabled-hint">Mess assignment cannot be changed</div>
          </div>
        </div>
        <div class="sp-section">
          <div class="sp-section-title">🏋️ Fitness</div>
          <div class="sp-form-grid">
            <div class="sp-form-row">
              <label class="sp-label">Age</label>
              <input class="sp-input" id="spAge" type="number" value="${profile.age || ''}">
            </div>
            <div class="sp-form-row">
              <label class="sp-label">Gender</label>
              <select class="sp-input" id="spGender">
                <option value="male" ${profile.gender === 'male' ? 'selected' : ''}>Male</option>
                <option value="female" ${profile.gender === 'female' ? 'selected' : ''}>Female</option>
                <option value="other" ${profile.gender === 'other' ? 'selected' : ''}>Other</option>
              </select>
            </div>
          </div>
          <div class="sp-form-grid">
            <div class="sp-form-row">
              <label class="sp-label">Height (cm)</label>
              <input class="sp-input" id="spHeight" type="number" value="${profile.height || ''}">
            </div>
            <div class="sp-form-row">
              <label class="sp-label">Weight (kg)</label>
              <input class="sp-input" id="spWeight" type="number" value="${profile.weight || ''}">
            </div>
          </div>
          <div class="sp-form-row">
            <label class="sp-label">Activity Level</label>
            <select class="sp-input" id="spActivity">
              <option value="sedentary" ${profile.activityLevel === 'sedentary' ? 'selected' : ''}>Sedentary</option>
              <option value="light" ${profile.activityLevel === 'light' ? 'selected' : ''}>Light</option>
              <option value="moderate" ${profile.activityLevel === 'moderate' ? 'selected' : ''}>Moderate</option>
              <option value="active" ${profile.activityLevel === 'active' ? 'selected' : ''}>Active</option>
              <option value="very_active" ${profile.activityLevel === 'very_active' ? 'selected' : ''}>Very Active</option>
            </select>
          </div>
          <div class="sp-form-row">
            <label class="sp-label">Fitness Goal</label>
            <select class="sp-input" id="spGoal">
              <option value="weight_loss" ${profile.fitnessGoal === 'weight_loss' ? 'selected' : ''}>🔥 Weight Loss</option>
              <option value="maintenance" ${profile.fitnessGoal === 'maintenance' ? 'selected' : ''}>⚖️ Maintenance</option>
              <option value="muscle_gain" ${profile.fitnessGoal === 'muscle_gain' ? 'selected' : ''}>💪 Muscle Gain</option>
              <option value="weight_gain" ${profile.fitnessGoal === 'weight_gain' ? 'selected' : ''}>📈 Weight Gain</option>
            </select>
          </div>
        </div>
        <button class="sp-btn sp-btn-save" id="spSave">💾 Save Changes</button>
        <div class="sp-divider"></div>
        <button class="sp-btn sp-btn-danger" id="spReset">🗑 Reset App (Clear All Data)</button>
      </div>
    </div>
  </div>`;

  document.getElementById('spClose').addEventListener('click', closeSettings);
  document.getElementById('spOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'spOverlay') closeSettings();
  });

  document.getElementById('spSave').addEventListener('click', () => {
    const newHostel = document.getElementById('spHostel').value;
    const hostelChanged = newHostel !== profile.hostel;

    const updated = {
      ...profile,
      name: document.getElementById('spName').value.trim() || profile.name,
      hostel: newHostel,
      age: parseInt(document.getElementById('spAge').value) || profile.age,
      gender: document.getElementById('spGender').value,
      height: parseInt(document.getElementById('spHeight').value) || profile.height,
      weight: parseInt(document.getElementById('spWeight').value) || profile.weight,
      activityLevel: document.getElementById('spActivity').value,
      fitnessGoal: document.getElementById('spGoal').value,
    };
    saveProfile(updated);
    closeSettings();
    showGreeting(updated);

    // If mess changed, update the main hostel selector and trigger reload
    if (hostelChanged) {
      localStorage.setItem('selectedHostel', newHostel);
      const hostelSel = document.getElementById('hostelSelect');
      if (hostelSel) {
        hostelSel.value = newHostel;
        hostelSel.dispatchEvent(new Event('change'));
      }
      if (window.showToast) window.showToast('✅ Profile updated! Mess changed — reloading menu.', 'success');
    } else {
      if (window.showToast) window.showToast('✅ Profile updated!', 'success');
    }
  });

  document.getElementById('spReset').addEventListener('click', () => {
    if (confirm('This will clear ALL your data including profile, tracked meals, favorites, and ratings. Continue?')) {
      localStorage.clear();
      location.reload();
    }
  });
}

function closeSettings() {
  const overlay = document.getElementById('spOverlay');
  if (!overlay) return;
  overlay.classList.add('sp-closing');
  setTimeout(() => {
    const root = document.getElementById('settings-panel-root');
    if (root) root.innerHTML = '';
  }, 350);
}

/* ─── TDEE CALCULATOR ──────────────────────────────────── */
export function calculateTDEE(profile) {
  if (!profile) return 2000;
  const { weight, height, age, gender, activityLevel, fitnessGoal } = profile;

  // Mifflin-St Jeor BMR
  let bmr;
  if (gender === 'female') {
    bmr = 10 * (weight || 65) + 6.25 * (height || 160) - 5 * (age || 20) - 161;
  } else {
    bmr = 10 * (weight || 70) + 6.25 * (height || 175) - 5 * (age || 20) + 5;
  }

  const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
  let tdee = bmr * (multipliers[activityLevel] || 1.55);

  // Adjust for goal
  if (fitnessGoal === 'weight_loss') tdee *= 0.8;
  else if (fitnessGoal === 'muscle_gain') tdee *= 1.1;
  else if (fitnessGoal === 'weight_gain') tdee *= 1.2;

  return Math.round(tdee);
}

export function calculateProteinTarget(profile) {
  if (!profile) return 60;
  const weight = profile.weight || 65;
  const goal = profile.fitnessGoal;
  if (goal === 'muscle_gain') return Math.round(weight * 1.8);
  if (goal === 'weight_loss') return Math.round(weight * 1.5);
  return Math.round(weight * 1.2);
}

export default { getProfile, saveProfile, clearProfile, showWelcomeModal, showGreeting, setupHostelRestriction, showSettings, calculateTDEE, calculateProteinTarget };
