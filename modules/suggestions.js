/* =================================================================
   SUGGESTIONS MODULE — AI meal recommendations based on user profile
   Uses rule-based system (no Gemini) for reliability & speed
   ================================================================= */

import { getProfile, calculateTDEE, calculateProteinTarget } from './profile.js?v=8';
import nutrition from './nutrition.js?v=8';
const LOCAL_DB = nutrition.LOCAL_DB;

const SUGGESTION_CACHE_KEY = 'suggestion_cache';

export function generateSuggestions(menu, day) {
  if (!menu) return null;

  const profile = getProfile();
  if (!profile) return null;

  // Check cache
  const cacheKey = `${day}_${profile.fitnessGoal}_${profile.hostel}`;
  const cached = getCachedSuggestion(cacheKey);
  if (cached) return cached;

  const tdee = calculateTDEE(profile);
  const proteinTarget = calculateProteinTarget(profile);
  const goal = profile.fitnessGoal;

  // Get all items from all meals
  const allItems = {};
  for (const [mealType, itemStr] of Object.entries(menu)) {
    if (!itemStr || itemStr === '—' || itemStr === '-') continue;
    const items = itemStr.split(',').map(i => i.trim()).filter(Boolean);
    allItems[mealType] = items;
  }

  const recommended = [];
  const limit = [];
  const avoid = [];
  let estimatedCals = 0;
  let estimatedProtein = 0;

  // Analyze each item
  for (const [mealType, items] of Object.entries(allItems)) {
    for (const item of items) {
      const nutrition = lookupLocal(item);
      if (!nutrition) continue;

      const analysis = analyzeItem(item, nutrition, goal, tdee);
      
      if (analysis.action === 'recommend') {
        recommended.push({ item, reason: analysis.reason, calories: nutrition.calories, protein: nutrition.protein, mealType });
        estimatedCals += nutrition.calories;
        estimatedProtein += nutrition.protein;
      } else if (analysis.action === 'limit') {
        limit.push({ item, reason: analysis.reason, calories: nutrition.calories, mealType });
        estimatedCals += Math.round(nutrition.calories * 0.5); // Half portion
        estimatedProtein += Math.round(nutrition.protein * 0.5);
      } else if (analysis.action === 'avoid') {
        avoid.push({ item, reason: analysis.reason, calories: nutrition.calories, mealType });
      }
    }
  }

  const result = {
    recommended,
    limit,
    avoid,
    estimatedCalories: estimatedCals,
    estimatedProtein,
    tdee,
    proteinTarget,
    goal,
    explanation: getGoalExplanation(goal, estimatedCals, tdee, estimatedProtein, proteinTarget)
  };

  // Cache for the day
  cacheSuggestion(cacheKey, result);
  return result;
}

function lookupLocal(itemName) {
  const key = itemName.trim().toLowerCase();
  if (LOCAL_DB[key]) return LOCAL_DB[key];
  for (const [dbKey, val] of Object.entries(LOCAL_DB)) {
    if (key.includes(dbKey) || dbKey.includes(key)) return val;
  }
  const words = key.split(' ');
  for (const [dbKey, val] of Object.entries(LOCAL_DB)) {
    if (words.some(w => w.length > 3 && dbKey.includes(w))) return val;
  }
  return null;
}

function analyzeItem(item, nutrition, goal, tdee) {
  const name = item.toLowerCase();
  
  // High protein items are always good
  if (nutrition.protein >= 10) {
    return { action: 'recommend', reason: 'High protein' };
  }

  // Weight loss logic
  if (goal === 'weight_loss') {
    if (nutrition.calories > 300) return { action: 'avoid', reason: 'High calorie' };
    if (nutrition.fat > 15) return { action: 'limit', reason: 'High fat' };
    if (nutrition.sugar > 15) return { action: 'avoid', reason: 'High sugar' };
    if (name.includes('fried') || name.includes('poori') || name.includes('bhature')) {
      return { action: 'avoid', reason: 'Fried food' };
    }
    if (name.includes('dessert') || name.includes('halwa') || name.includes('gulab') || name.includes('kheer') || name.includes('jalebi')) {
      return { action: 'avoid', reason: 'Dessert — high sugar' };
    }
    if (nutrition.fiber >= 3) return { action: 'recommend', reason: 'Good fiber content' };
    if (nutrition.calories < 200) return { action: 'recommend', reason: 'Low calorie' };
    return { action: 'limit', reason: 'Moderate portions' };
  }

  // Muscle gain logic
  if (goal === 'muscle_gain') {
    if (nutrition.protein >= 8) return { action: 'recommend', reason: 'Good protein source' };
    if (nutrition.calories > 200 && nutrition.protein < 5 && nutrition.fat > 10) {
      return { action: 'limit', reason: 'High fat, low protein' };
    }
    if (nutrition.carbs > 30) return { action: 'recommend', reason: 'Energy for workouts' };
    return { action: 'recommend', reason: 'Good for calorie surplus' };
  }

  // Weight gain logic
  if (goal === 'weight_gain') {
    if (nutrition.calories > 200) return { action: 'recommend', reason: 'Good calorie content' };
    return { action: 'recommend', reason: 'Eat generously' };
  }

  // Maintenance
  if (nutrition.calories > 350 && nutrition.fat > 20) return { action: 'limit', reason: 'High calorie' };
  if (nutrition.fiber >= 3 || nutrition.protein >= 6) return { action: 'recommend', reason: 'Balanced nutrition' };
  return { action: 'recommend', reason: 'Part of balanced diet' };
}

function getGoalExplanation(goal, estimatedCals, tdee, estimatedProtein, proteinTarget) {
  const goalLabels = {
    weight_loss: 'Weight Loss',
    maintenance: 'Maintenance',
    muscle_gain: 'Muscle Gain',
    weight_gain: 'Weight Gain'
  };

  let explanation = `Based on your ${goalLabels[goal]} goal (${tdee} cal/day target): `;

  if (goal === 'weight_loss') {
    explanation += `Focus on high-protein, high-fiber items. Skip desserts and fried foods. Aim for ~${Math.round(tdee * 0.25)} cal per meal.`;
  } else if (goal === 'muscle_gain') {
    explanation += `Prioritize protein-rich items like dal, paneer, and eggs. Don't skip carbs — you need energy for muscle building.`;
  } else if (goal === 'weight_gain') {
    explanation += `Eat full portions of everything. Add extra roti and rice. Don't skip any meal or dessert.`;
  } else {
    explanation += `Eat a balanced mix of all items. Watch portion sizes to stay within ${tdee} cal/day.`;
  }

  if (estimatedProtein < proteinTarget * 0.7) {
    explanation += ` ⚠ Today's menu is lower in protein. Consider asking for extra dal or eggs.`;
  }

  return explanation;
}

/* ─── RENDER SUGGESTIONS ───────────────────────────────── */
export function renderSuggestions(suggestions) {
  if (!suggestions) return;

  const menuOutput = document.getElementById('menuOutput');
  if (!menuOutput) return;

  // Remove old suggestion card
  const old = document.getElementById('suggestionCard');
  if (old) old.remove();

  const goalEmojis = {
    weight_loss: '🔥', maintenance: '⚖️', muscle_gain: '💪', weight_gain: '📈'
  };

  const card = document.createElement('div');
  card.id = 'suggestionCard';
  card.className = 'sg-card';
  card.innerHTML = `
    <div class="sg-header">
      <span class="sg-header-icon">${goalEmojis[suggestions.goal] || '🎯'}</span>
      <div>
        <h3 class="sg-title">AI Meal Suggestion</h3>
        <p class="sg-subtitle">Personalized for your goal</p>
      </div>
      <button class="sg-toggle" id="sgToggle">▼</button>
    </div>
    <div class="sg-body" id="sgBody">
      ${suggestions.recommended.length > 0 ? `
      <div class="sg-group sg-recommended">
        <div class="sg-group-label">✅ Recommended</div>
        ${suggestions.recommended.slice(0, 6).map(r => `
          <div class="sg-item"><span class="sg-item-name">${r.item}</span><span class="sg-item-reason">${r.reason}</span></div>
        `).join('')}
      </div>` : ''}

      ${suggestions.limit.length > 0 ? `
      <div class="sg-group sg-limit">
        <div class="sg-group-label">⚠ Limit Portions</div>
        ${suggestions.limit.map(r => `
          <div class="sg-item"><span class="sg-item-name">${r.item}</span><span class="sg-item-reason">${r.reason}</span></div>
        `).join('')}
      </div>` : ''}

      ${suggestions.avoid.length > 0 ? `
      <div class="sg-group sg-avoid">
        <div class="sg-group-label">❌ Avoid</div>
        ${suggestions.avoid.map(r => `
          <div class="sg-item"><span class="sg-item-name">${r.item}</span><span class="sg-item-reason">${r.reason}</span></div>
        `).join('')}
      </div>` : ''}

      <div class="sg-summary">
        <span>~${suggestions.estimatedCalories} cal</span>
        <span>~${suggestions.estimatedProtein}g protein</span>
      </div>
      <p class="sg-explanation">${suggestions.explanation}</p>
    </div>
  `;
  menuOutput.after(card);

  // Toggle
  const toggle = document.getElementById('sgToggle');
  const body = document.getElementById('sgBody');
  toggle.addEventListener('click', () => {
    const hidden = body.style.display === 'none';
    body.style.display = hidden ? 'block' : 'none';
    toggle.textContent = hidden ? '▼' : '▶';
  });
}

/* ─── CACHE ────────────────────────────────────────────── */
function getCachedSuggestion(key) {
  try {
    const cache = JSON.parse(localStorage.getItem(SUGGESTION_CACHE_KEY) || '{}');
    const today = new Date().toISOString().split('T')[0];
    if (cache.date === today && cache.key === key) return cache.data;
  } catch {}
  return null;
}

function cacheSuggestion(key, data) {
  localStorage.setItem(SUGGESTION_CACHE_KEY, JSON.stringify({
    date: new Date().toISOString().split('T')[0],
    key,
    data
  }));
}

export default { generateSuggestions, renderSuggestions };
