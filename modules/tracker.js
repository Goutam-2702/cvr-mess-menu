/* =================================================================
   TRACKER MODULE — Daily calorie + protein tracker
   ================================================================= */

import { getProfile, calculateTDEE, calculateProteinTarget } from './profile.js?v=8';

const TRACKER_PREFIX = 'tracker_';

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getTrackerKey(date) {
  return TRACKER_PREFIX + (date || getToday());
}

export function getTrackerData(date) {
  try {
    return JSON.parse(localStorage.getItem(getTrackerKey(date))) || createEmptyTracker();
  } catch { return createEmptyTracker(); }
}

function createEmptyTracker() {
  return {
    date: getToday(),
    meals: { breakfast: null, lunch: null, snacks: null, dinner: null },
    totals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  };
}

export function saveTrackerData(data, date) {
  localStorage.setItem(getTrackerKey(date), JSON.stringify(data));
}

export function logMeal(mealType, nutritionResult) {
  const data = getTrackerData();
  const type = detectMealType(mealType);
  
  data.meals[type] = {
    items: nutritionResult.items?.map(i => i.name) || [],
    calories: nutritionResult.totals?.calories || 0,
    protein: nutritionResult.totals?.protein || 0,
    carbs: nutritionResult.totals?.carbs || 0,
    fat: nutritionResult.totals?.fat || 0,
    fiber: nutritionResult.totals?.fiber || 0,
    loggedAt: Date.now()
  };

  // Recalculate totals
  data.totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const meal of Object.values(data.meals)) {
    if (!meal) continue;
    data.totals.calories += meal.calories || 0;
    data.totals.protein += meal.protein || 0;
    data.totals.carbs += meal.carbs || 0;
    data.totals.fat += meal.fat || 0;
    data.totals.fiber += meal.fiber || 0;
  }
  data.date = getToday();

  saveTrackerData(data);
  renderTrackerWidget();
  return data;
}

function detectMealType(type) {
  const hour = new Date().getHours();
  if (type) return type;
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 18) return 'snacks';
  return 'dinner';
}

/* ─── TRACKER WIDGET ───────────────────────────────────── */
export function renderTrackerWidget() {
  const root = document.getElementById('tracker-widget-root');
  if (!root) return;

  const profile = getProfile();
  const data = getTrackerData();
  const tdee = calculateTDEE(profile);
  const proteinTarget = calculateProteinTarget(profile);

  const calPct = Math.min(100, Math.round((data.totals.calories / tdee) * 100));
  const proPct = Math.min(100, Math.round((data.totals.protein / proteinTarget) * 100));
  const remaining = Math.max(0, tdee - data.totals.calories);
  const proRemaining = Math.max(0, proteinTarget - data.totals.protein);

  const calColor = calPct > 100 ? '#ef4444' : calPct > 75 ? '#f59e0b' : '#10b981';
  const proColor = proPct > 100 ? '#ef4444' : proPct > 75 ? '#3b82f6' : '#8b5cf6';

  root.innerHTML = `
  <div class="tw-container" id="trackerWidget">
    <div class="tw-header" id="twToggle">
      <span class="tw-title">📊 Daily Tracker</span>
      <span class="tw-cal-quick">${data.totals.calories} / ${tdee} cal</span>
      <span class="tw-toggle-icon" id="twIcon">▼</span>
    </div>
    <div class="tw-body" id="twBody">
      <div class="tw-rings">
        <div class="tw-ring-wrap">
          <svg class="tw-ring" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" class="tw-ring-bg"/>
            <circle cx="50" cy="50" r="42" class="tw-ring-fill" style="stroke: ${calColor}; stroke-dasharray: ${calPct * 2.64} 264"/>
          </svg>
          <div class="tw-ring-label">
            <div class="tw-ring-val">${data.totals.calories}</div>
            <div class="tw-ring-unit">cal</div>
          </div>
        </div>
        <div class="tw-ring-wrap tw-ring-sm">
          <svg class="tw-ring" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" class="tw-ring-bg"/>
            <circle cx="50" cy="50" r="42" class="tw-ring-fill" style="stroke: ${proColor}; stroke-dasharray: ${proPct * 2.64} 264"/>
          </svg>
          <div class="tw-ring-label">
            <div class="tw-ring-val">${data.totals.protein}g</div>
            <div class="tw-ring-unit">protein</div>
          </div>
        </div>
      </div>
      <div class="tw-stats">
        <div class="tw-stat">
          <span class="tw-stat-label">🔥 Remaining</span>
          <span class="tw-stat-val" style="color:${calColor}">${remaining} cal</span>
        </div>
        <div class="tw-stat">
          <span class="tw-stat-label">🥩 Protein left</span>
          <span class="tw-stat-val" style="color:${proColor}">${proRemaining}g</span>
        </div>
        <div class="tw-stat">
          <span class="tw-stat-label">🍞 Carbs</span>
          <span class="tw-stat-val">${data.totals.carbs}g</span>
        </div>
        <div class="tw-stat">
          <span class="tw-stat-label">🧈 Fat</span>
          <span class="tw-stat-val">${data.totals.fat}g</span>
        </div>
      </div>
      <div class="tw-meals">
        ${['breakfast', 'lunch', 'snacks', 'dinner'].map(type => {
          const meal = data.meals[type];
          const icon = { breakfast: '🍳', lunch: '🍱', snacks: '☕', dinner: '🍛' }[type];
          const label = type.charAt(0).toUpperCase() + type.slice(1);
          return `<div class="tw-meal ${meal ? 'tw-meal-logged' : ''}">
            <span class="tw-meal-icon">${icon}</span>
            <span class="tw-meal-label">${label}</span>
            <span class="tw-meal-val">${meal ? meal.calories + ' cal' : '—'}</span>
          </div>`;
        }).join('')}
      </div>
      <div class="tw-footer">
        <span class="tw-goal">Goal: ${tdee} cal • ${proteinTarget}g protein</span>
      </div>
    </div>
  </div>`;

  // Toggle expand/collapse
  const toggle = document.getElementById('twToggle');
  const body = document.getElementById('twBody');
  const icon = document.getElementById('twIcon');
  const isCollapsed = localStorage.getItem('tw_collapsed') === '1';
  if (isCollapsed) { body.style.display = 'none'; icon.textContent = '▶'; }

  toggle.addEventListener('click', () => {
    const hidden = body.style.display === 'none';
    body.style.display = hidden ? 'block' : 'none';
    icon.textContent = hidden ? '▼' : '▶';
    localStorage.setItem('tw_collapsed', hidden ? '0' : '1');
  });
}

/* ─── GET WEEKLY DATA ──────────────────────────────────── */
export function getWeeklyData() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const data = getTrackerData(key);
    days.push({
      date: key,
      dayName: d.toLocaleDateString('en', { weekday: 'short' }),
      ...data.totals
    });
  }
  return days;
}

/* ─── SETUP EVENT LISTENERS ────────────────────────────── */
export function setupTrackerListeners() {
  // Listen for meal analysis events
  document.addEventListener('logMealRequest', (e) => {
    const result = e.detail;
    logMeal(null, result);
  });

  document.addEventListener('mealAnalyzed', (e) => {
    // Auto-refresh tracker when a meal is analyzed (but don't auto-log)
  });
}

export default { getTrackerData, logMeal, renderTrackerWidget, getWeeklyData, setupTrackerListeners };
