/* =================================================================
   NUTRITION MODULE — USDA FoodData Central + Health Score
   ================================================================= */

// USDA FoodData Central API
const USDA_API_KEY = localStorage.getItem('usda_key') || ''; // User's USDA API Key (set via localStorage for safety)
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';

// Local nutrition database for common Indian mess foods (per serving)
export const LOCAL_DB = {
  'dal': { calories: 150, protein: 9, carbs: 20, fat: 3, fiber: 5, sugar: 2, sodium: 400, serving: '1 bowl (200ml)' },
  'dal fry': { calories: 170, protein: 10, carbs: 22, fat: 5, fiber: 5, sugar: 2, sodium: 450, serving: '1 bowl (200ml)' },
  'dal tadka': { calories: 180, protein: 10, carbs: 22, fat: 6, fiber: 5, sugar: 2, sodium: 450, serving: '1 bowl (200ml)' },
  'dal makhani': { calories: 220, protein: 10, carbs: 24, fat: 10, fiber: 4, sugar: 3, sodium: 500, serving: '1 bowl (200ml)' },
  'mix dal': { calories: 165, protein: 10, carbs: 22, fat: 4, fiber: 5, sugar: 2, sodium: 420, serving: '1 bowl (200ml)' },
  'rajma': { calories: 210, protein: 12, carbs: 32, fat: 4, fiber: 8, sugar: 2, sodium: 480, serving: '1 bowl (200ml)' },
  'chole': { calories: 220, protein: 11, carbs: 30, fat: 6, fiber: 7, sugar: 3, sodium: 500, serving: '1 bowl (200ml)' },
  'kadhi': { calories: 160, protein: 6, carbs: 18, fat: 7, fiber: 2, sugar: 4, sodium: 380, serving: '1 bowl (200ml)' },
  'roti': { calories: 85, protein: 3, carbs: 18, fat: 0.5, fiber: 2, sugar: 0, sodium: 120, serving: '1 piece' },
  'plain rice': { calories: 210, protein: 4, carbs: 46, fat: 0.5, fiber: 1, sugar: 0, sodium: 5, serving: '1 plate (150g)' },
  'rice': { calories: 210, protein: 4, carbs: 46, fat: 0.5, fiber: 1, sugar: 0, sodium: 5, serving: '1 plate (150g)' },
  'jeera rice': { calories: 230, protein: 4, carbs: 44, fat: 4, fiber: 1, sugar: 0, sodium: 280, serving: '1 plate (150g)' },
  'fried rice': { calories: 260, protein: 5, carbs: 42, fat: 8, fiber: 1, sugar: 1, sodium: 450, serving: '1 plate (150g)' },
  'mix rice': { calories: 240, protein: 5, carbs: 43, fat: 5, fiber: 1, sugar: 1, sodium: 380, serving: '1 plate (150g)' },
  'paneer': { calories: 260, protein: 18, carbs: 4, fat: 20, fiber: 0, sugar: 2, sodium: 300, serving: '100g' },
  'butter paneer masala': { calories: 320, protein: 14, carbs: 12, fat: 24, fiber: 2, sugar: 4, sodium: 550, serving: '1 bowl (200ml)' },
  'kadhai paneer': { calories: 290, protein: 15, carbs: 10, fat: 22, fiber: 2, sugar: 3, sodium: 480, serving: '1 bowl (200ml)' },
  'chilli paneer': { calories: 300, protein: 15, carbs: 14, fat: 22, fiber: 2, sugar: 4, sodium: 600, serving: '1 bowl (200ml)' },
  'malai kofta': { calories: 340, protein: 10, carbs: 18, fat: 26, fiber: 2, sugar: 5, sodium: 520, serving: '1 bowl (200ml)' },
  'butter chicken': { calories: 350, protein: 22, carbs: 10, fat: 25, fiber: 1, sugar: 4, sodium: 580, serving: '1 bowl (200ml)' },
  'kadhai chicken': { calories: 280, protein: 24, carbs: 8, fat: 18, fiber: 1, sugar: 2, sodium: 500, serving: '1 bowl (200ml)' },
  'egg curry': { calories: 220, protein: 14, carbs: 8, fat: 15, fiber: 1, sugar: 2, sodium: 450, serving: '1 bowl (200ml)' },
  'chilli chicken': { calories: 290, protein: 22, carbs: 12, fat: 18, fiber: 1, sugar: 3, sodium: 650, serving: '1 bowl (200ml)' },
  'aloo paratha': { calories: 300, protein: 6, carbs: 42, fat: 12, fiber: 3, sugar: 1, sodium: 380, serving: '1 piece' },
  'poori': { calories: 120, protein: 3, carbs: 14, fat: 6, fiber: 1, sugar: 0, sodium: 180, serving: '1 piece' },
  'plain poori': { calories: 120, protein: 3, carbs: 14, fat: 6, fiber: 1, sugar: 0, sodium: 180, serving: '1 piece' },
  'palak poori': { calories: 130, protein: 4, carbs: 14, fat: 6, fiber: 2, sugar: 0, sodium: 200, serving: '1 piece' },
  'poha': { calories: 250, protein: 5, carbs: 42, fat: 7, fiber: 2, sugar: 3, sodium: 350, serving: '1 plate' },
  'samosa': { calories: 260, protein: 5, carbs: 30, fat: 14, fiber: 2, sugar: 1, sodium: 400, serving: '1 piece' },
  'uttapam': { calories: 200, protein: 5, carbs: 32, fat: 6, fiber: 2, sugar: 1, sodium: 320, serving: '1 piece' },
  'vada': { calories: 150, protein: 6, carbs: 16, fat: 8, fiber: 2, sugar: 0, sodium: 250, serving: '1 piece' },
  'masala dosa': { calories: 280, protein: 5, carbs: 38, fat: 12, fiber: 2, sugar: 1, sodium: 380, serving: '1 piece' },
  'sambar': { calories: 110, protein: 5, carbs: 16, fat: 3, fiber: 3, sugar: 2, sodium: 380, serving: '1 bowl (200ml)' },
  'chutney': { calories: 30, protein: 1, carbs: 5, fat: 1, fiber: 1, sugar: 2, sodium: 150, serving: '2 tbsp' },
  'salad': { calories: 45, protein: 2, carbs: 8, fat: 0.5, fiber: 3, sugar: 4, sodium: 20, serving: '1 bowl' },
  'pickle': { calories: 20, protein: 0.5, carbs: 3, fat: 1, fiber: 0.5, sugar: 1, sodium: 800, serving: '1 tbsp' },
  'curd': { calories: 100, protein: 5, carbs: 8, fat: 5, fiber: 0, sugar: 6, sodium: 60, serving: '1 bowl (150ml)' },
  'raita': { calories: 80, protein: 4, carbs: 6, fat: 4, fiber: 1, sugar: 4, sodium: 120, serving: '1 bowl (150ml)' },
  'boondi raita': { calories: 120, protein: 4, carbs: 12, fat: 5, fiber: 1, sugar: 4, sodium: 150, serving: '1 bowl (150ml)' },
  'papad': { calories: 55, protein: 3, carbs: 8, fat: 1, fiber: 1, sugar: 0, sodium: 480, serving: '1 piece' },
  'fryums': { calories: 80, protein: 1, carbs: 10, fat: 4, fiber: 0, sugar: 0, sodium: 300, serving: 'small bowl' },
  'mix veg': { calories: 150, protein: 4, carbs: 16, fat: 7, fiber: 4, sugar: 3, sodium: 400, serving: '1 bowl (200ml)' },
  'aloo sabzi': { calories: 180, protein: 3, carbs: 24, fat: 8, fiber: 3, sugar: 2, sodium: 380, serving: '1 bowl (200ml)' },
  'aloo curry': { calories: 180, protein: 3, carbs: 24, fat: 8, fiber: 3, sugar: 2, sodium: 380, serving: '1 bowl (200ml)' },
  'aloo bhujia': { calories: 200, protein: 4, carbs: 26, fat: 9, fiber: 3, sugar: 2, sodium: 420, serving: '1 bowl' },
  'aloo soya dal': { calories: 200, protein: 12, carbs: 24, fat: 6, fiber: 5, sugar: 2, sodium: 430, serving: '1 bowl' },
  'dum aloo': { calories: 230, protein: 4, carbs: 28, fat: 12, fiber: 3, sugar: 3, sodium: 450, serving: '1 bowl (200ml)' },
  'methi matar malai': { calories: 200, protein: 6, carbs: 14, fat: 14, fiber: 3, sugar: 4, sodium: 400, serving: '1 bowl (200ml)' },
  'sandwich': { calories: 250, protein: 8, carbs: 30, fat: 10, fiber: 2, sugar: 3, sodium: 450, serving: '1 piece' },
  'bread': { calories: 70, protein: 2.5, carbs: 13, fat: 1, fiber: 1, sugar: 1.5, sodium: 130, serving: '1 slice' },
  'butter': { calories: 72, protein: 0, carbs: 0, fat: 8, fiber: 0, sugar: 0, sodium: 60, serving: '1 pat (10g)' },
  'jam': { calories: 50, protein: 0, carbs: 13, fat: 0, fiber: 0, sugar: 10, sodium: 5, serving: '1 tbsp' },
  'tea': { calories: 35, protein: 1, carbs: 5, fat: 1, fiber: 0, sugar: 4, sodium: 10, serving: '1 cup' },
  'coffee': { calories: 40, protein: 1, carbs: 5, fat: 1.5, fiber: 0, sugar: 4, sodium: 10, serving: '1 cup' },
  'milk': { calories: 120, protein: 6, carbs: 10, fat: 6, fiber: 0, sugar: 10, sodium: 80, serving: '1 glass' },
  'boiled egg': { calories: 78, protein: 6, carbs: 0.5, fat: 5, fiber: 0, sugar: 0.5, sodium: 62, serving: '1 egg' },
  'corn flakes': { calories: 150, protein: 2, carbs: 32, fat: 0.5, fiber: 1, sugar: 4, sodium: 250, serving: '1 bowl' },
  'sprouts': { calories: 60, protein: 5, carbs: 8, fat: 0.5, fiber: 3, sugar: 1, sodium: 15, serving: '1 bowl' },
  'jalebi': { calories: 150, protein: 1, carbs: 30, fat: 4, fiber: 0, sugar: 22, sodium: 20, serving: '2 pieces' },
  'gulab jamun': { calories: 175, protein: 3, carbs: 28, fat: 6, fiber: 0, sugar: 22, sodium: 30, serving: '2 pieces' },
  'custard': { calories: 150, protein: 4, carbs: 24, fat: 4, fiber: 0, sugar: 18, sodium: 80, serving: '1 bowl' },
  'sewai kheer': { calories: 200, protein: 5, carbs: 32, fat: 6, fiber: 0, sugar: 20, sodium: 50, serving: '1 bowl' },
  'kheer': { calories: 180, protein: 5, carbs: 28, fat: 6, fiber: 0, sugar: 20, sodium: 50, serving: '1 bowl' },
  'gajar halwa': { calories: 220, protein: 4, carbs: 30, fat: 10, fiber: 2, sugar: 22, sodium: 40, serving: '1 bowl' },
  'rasgulla': { calories: 140, protein: 3, carbs: 26, fat: 2, fiber: 0, sugar: 22, sodium: 20, serving: '2 pieces' },
  'boondi': { calories: 180, protein: 3, carbs: 24, fat: 8, fiber: 1, sugar: 10, sodium: 80, serving: '1 bowl' },
  'shahi tukda': { calories: 250, protein: 5, carbs: 32, fat: 12, fiber: 0, sugar: 20, sodium: 100, serving: '1 piece' },
  'noodles': { calories: 280, protein: 6, carbs: 42, fat: 10, fiber: 2, sugar: 3, sodium: 550, serving: '1 plate' },
  'manchurian': { calories: 240, protein: 6, carbs: 26, fat: 13, fiber: 2, sugar: 4, sodium: 650, serving: '1 bowl' },
  'pasta': { calories: 300, protein: 8, carbs: 44, fat: 10, fiber: 2, sugar: 4, sodium: 500, serving: '1 plate' },
  'bhel puri': { calories: 200, protein: 4, carbs: 30, fat: 7, fiber: 3, sugar: 4, sodium: 450, serving: '1 plate' },
  'spring roll': { calories: 180, protein: 4, carbs: 22, fat: 9, fiber: 1, sugar: 2, sodium: 350, serving: '2 pieces' },
  'bread pakoda': { calories: 200, protein: 5, carbs: 24, fat: 10, fiber: 1, sugar: 1, sodium: 380, serving: '2 pieces' },
  'golgappe': { calories: 150, protein: 3, carbs: 26, fat: 4, fiber: 2, sugar: 3, sodium: 500, serving: '6 pieces' },
  'maggi': { calories: 320, protein: 7, carbs: 44, fat: 13, fiber: 2, sugar: 2, sodium: 800, serving: '1 plate' },
  'lassi': { calories: 160, protein: 5, carbs: 24, fat: 4, fiber: 0, sugar: 20, sodium: 60, serving: '1 glass' },
  'butter milk': { calories: 40, protein: 2, carbs: 4, fat: 1.5, fiber: 0, sugar: 3, sodium: 120, serving: '1 glass' },
  'chole bhature': { calories: 450, protein: 12, carbs: 52, fat: 22, fiber: 6, sugar: 3, sodium: 580, serving: '1 plate' },
  'veg biryani': { calories: 350, protein: 8, carbs: 52, fat: 12, fiber: 3, sugar: 2, sodium: 500, serving: '1 plate' },
  'ketchup': { calories: 20, protein: 0, carbs: 5, fat: 0, fiber: 0, sugar: 4, sodium: 170, serving: '1 tbsp' },
  'green chutney': { calories: 15, protein: 0.5, carbs: 2, fat: 0.5, fiber: 1, sugar: 1, sodium: 150, serving: '2 tbsp' },
  'red chutney': { calories: 20, protein: 0.5, carbs: 3, fat: 0.5, fiber: 1, sugar: 1, sodium: 200, serving: '2 tbsp' },
  'namkeen': { calories: 180, protein: 5, carbs: 20, fat: 10, fiber: 2, sugar: 1, sodium: 550, serving: '1 bowl' },
  'sev': { calories: 200, protein: 5, carbs: 22, fat: 11, fiber: 2, sugar: 1, sodium: 500, serving: '1 bowl' },
  'toast': { calories: 60, protein: 2, carbs: 12, fat: 0.5, fiber: 1, sugar: 1, sodium: 140, serving: '1 slice' },
  'seasonal fruit': { calories: 60, protein: 1, carbs: 14, fat: 0, fiber: 2, sugar: 10, sodium: 2, serving: '1 piece' },
};

// Nutrient cache to avoid repeat API calls
const nutrientCache = {};

/* ─── LOOKUP ───────────────────────────────────────────── */
function normalizeItemName(name) {
  return name.trim().toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[,./]+$/, '');
}

export async function lookupNutrition(itemName) {
  const key = normalizeItemName(itemName);
  
  // Check cache first
  if (nutrientCache[key]) return nutrientCache[key];

  // Check local DB
  const localMatch = findLocalMatch(key);
  if (localMatch) {
    nutrientCache[key] = localMatch;
    return localMatch;
  }

  // Query USDA API
  try {
    const resp = await fetch(`${USDA_BASE}/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(key)}&pageSize=1&dataType=Foundation,SR%20Legacy`);
    if (!resp.ok) throw new Error('USDA API error');
    const data = await resp.json();
    if (data.foods && data.foods.length > 0) {
      const food = data.foods[0];
      const result = parseUSDAFood(food, key);
      nutrientCache[key] = result;
      return result;
    }
  } catch (err) {
    console.warn('USDA lookup failed for:', key, err);
  }

  // Fallback: rough estimate
  const fallback = { calories: 150, protein: 5, carbs: 20, fat: 5, fiber: 2, sugar: 3, sodium: 300, serving: '1 serving (est.)', estimated: true };
  nutrientCache[key] = fallback;
  return fallback;
}

function findLocalMatch(key) {
  if (LOCAL_DB[key]) return { ...LOCAL_DB[key] };
  // Partial match
  for (const [dbKey, val] of Object.entries(LOCAL_DB)) {
    if (key.includes(dbKey) || dbKey.includes(key)) return { ...val };
  }
  // Word match
  const words = key.split(' ');
  for (const [dbKey, val] of Object.entries(LOCAL_DB)) {
    if (words.some(w => w.length > 3 && dbKey.includes(w))) return { ...val };
  }
  return null;
}

function parseUSDAFood(food, originalName) {
  const getNutrient = (id) => {
    const n = food.foodNutrients?.find(fn => fn.nutrientId === id || fn.nutrientNumber === String(id));
    return n ? Math.round(n.value || 0) : 0;
  };

  return {
    calories: getNutrient(1008) || getNutrient(208) || 150,
    protein: getNutrient(1003) || getNutrient(203) || 5,
    carbs: getNutrient(1005) || getNutrient(205) || 20,
    fat: getNutrient(1004) || getNutrient(204) || 5,
    fiber: getNutrient(1079) || getNutrient(291) || 2,
    sugar: getNutrient(2000) || getNutrient(269) || 3,
    sodium: getNutrient(1093) || getNutrient(307) || 300,
    serving: '1 serving (100g)',
    source: 'USDA'
  };
}

/* ─── ANALYZE MEAL ─────────────────────────────────────── */
export async function analyzeMeal(selectedItems) {
  const results = [];
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 };

  for (const item of selectedItems) {
    const nutrition = await lookupNutrition(item);
    results.push({ name: item, ...nutrition });
    for (const key of Object.keys(totals)) {
      totals[key] += nutrition[key] || 0;
    }
  }

  const healthScore = calculateHealthScore(totals, selectedItems.length);

  return {
    items: results,
    totals,
    healthScore,
    analysis: generateAnalysis(totals, healthScore),
    suitability: getSuitability(totals)
  };
}

/* ─── HEALTH SCORE ─────────────────────────────────────── */
function calculateHealthScore(totals, itemCount) {
  let score = 5; // Start at 5/10

  // Protein bonus
  if (totals.protein > 20) score += 1;
  if (totals.protein > 35) score += 0.5;

  // Fiber bonus
  if (totals.fiber > 5) score += 0.5;
  if (totals.fiber > 10) score += 0.5;

  // Moderate calories bonus
  if (totals.calories > 200 && totals.calories < 700) score += 1;

  // Variety bonus
  if (itemCount >= 3) score += 0.5;
  if (itemCount >= 5) score += 0.5;

  // Penalties
  if (totals.fat > 40) score -= 1;
  if (totals.sodium > 1500) score -= 1;
  if (totals.sugar > 30) score -= 1;
  if (totals.calories > 1000) score -= 1;
  if (totals.calories < 100) score -= 0.5;

  // Fat ratio
  const fatCalRatio = (totals.fat * 9) / (totals.calories || 1);
  if (fatCalRatio > 0.4) score -= 0.5;

  return Math.max(1, Math.min(10, Math.round(score * 10) / 10));
}

function generateAnalysis(totals, healthScore) {
  const benefits = [];
  const drawbacks = [];
  const suggestions = [];

  if (totals.protein > 20) benefits.push('Good protein content for muscle repair');
  if (totals.fiber > 5) benefits.push('Good fiber content for digestion');
  if (totals.calories < 600 && totals.calories > 200) benefits.push('Reasonable calorie count');
  if (totals.fat < 20) benefits.push('Low fat content');

  if (totals.sodium > 1200) drawbacks.push('High sodium — may cause water retention');
  if (totals.fat > 35) drawbacks.push('High fat content');
  if (totals.sugar > 25) drawbacks.push('High sugar — watch for blood sugar spikes');
  if (totals.calories > 800) drawbacks.push('High calorie meal');
  if (totals.protein < 10) drawbacks.push('Low protein — consider adding dal or paneer');

  if (totals.protein < 15) suggestions.push('Add dal, paneer, or egg for more protein');
  if (totals.fiber < 5) suggestions.push('Add salad or sprouts for fiber');
  if (totals.fat > 30) suggestions.push('Reduce fried items to lower fat intake');
  if (totals.sodium > 1000) suggestions.push('Reduce pickle and papad to lower sodium');

  return { benefits, drawbacks, suggestions, healthScore };
}

function getSuitability(totals) {
  const result = {};

  // Weight Loss
  if (totals.calories < 500 && totals.protein > 15 && totals.fat < 20) {
    result.weightLoss = { suitable: true, label: '✅ Good for weight loss' };
  } else if (totals.calories < 650) {
    result.weightLoss = { suitable: 'partial', label: '⚠ Moderate for weight loss' };
  } else {
    result.weightLoss = { suitable: false, label: '❌ Not ideal for weight loss' };
  }

  // Muscle Gain
  if (totals.protein > 25 && totals.calories > 400) {
    result.muscleGain = { suitable: true, label: '✅ Good for muscle gain' };
  } else if (totals.protein > 15) {
    result.muscleGain = { suitable: 'partial', label: '⚠ Could use more protein' };
  } else {
    result.muscleGain = { suitable: false, label: '❌ Insufficient protein for muscle gain' };
  }

  // Maintenance
  if (totals.calories > 300 && totals.calories < 800) {
    result.maintenance = { suitable: true, label: '✅ Good for maintenance' };
  } else {
    result.maintenance = { suitable: 'partial', label: '⚠ Adjust portions for maintenance' };
  }

  return result;
}

/* ─── INJECT CHECKBOXES INTO MENU ──────────────────────── */
export function injectMenuCheckboxes() {
  const menuCard = document.querySelector('#menuOutput .menu-card');
  if (!menuCard) return;

  // Don't re-inject if already present
  if (menuCard.querySelector('.ni-checkbox')) return;

  const mealRows = menuCard.querySelectorAll('.meal-row');
  mealRows.forEach(row => {
    const mealText = row.querySelector('.meal-text');
    if (!mealText) return;

    const originalText = mealText.textContent;
    if (!originalText || originalText === '—') return;

    const items = originalText.split(',').map(i => i.trim()).filter(i => i && i !== '—');
    if (items.length === 0) return;

    mealText.innerHTML = items.map((item, idx) => {
      const id = `ni-${row.querySelector('.meal-icon')?.className.replace(/\s+/g, '-')}-${idx}`;
      const key = item.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      let dbMatch = null;
      if (LOCAL_DB[key]) {
        dbMatch = LOCAL_DB[key];
      } else {
        for (const [dbKey, val] of Object.entries(LOCAL_DB)) {
          if (key.includes(dbKey) || dbKey.includes(key)) { dbMatch = val; break; }
        }
      }
      const calInfo = dbMatch ? `<span style="font-size: 0.7rem; color: var(--text3); font-weight: normal; margin-left: 4px;">(${dbMatch.calories} cal / ${dbMatch.serving})</span>` : '';
      return `<label class="ni-item">
        <input type="checkbox" class="ni-checkbox" id="${id}" data-food="${item}" value="${item}">
        <span class="ni-text">${item}${calInfo}</span>
      </label>`;
    }).join('');
  });

  // Add Analyze button if not present
  if (!menuCard.querySelector('.ni-analyze-btn')) {
    const analyzeDiv = document.createElement('div');
    analyzeDiv.className = 'ni-actions';
    analyzeDiv.innerHTML = `
      <button class="ni-analyze-btn" id="niAnalyzeBtn">
        <span class="ni-analyze-icon">🔬</span>
        <span>Analyze Meal</span>
      </button>
      <button class="ni-select-all-btn" id="niSelectAllBtn">Select All</button>
    `;
    menuCard.appendChild(analyzeDiv);

    document.getElementById('niAnalyzeBtn').addEventListener('click', handleAnalyze);
    document.getElementById('niSelectAllBtn').addEventListener('click', () => {
      const cbs = menuCard.querySelectorAll('.ni-checkbox');
      const allChecked = Array.from(cbs).every(cb => cb.checked);
      cbs.forEach(cb => cb.checked = !allChecked);
      document.getElementById('niSelectAllBtn').textContent = allChecked ? 'Select All' : 'Deselect All';
    });
  }
}

/* ─── HANDLE ANALYZE ───────────────────────────────────── */
async function handleAnalyze() {
  const checked = document.querySelectorAll('.ni-checkbox:checked');
  if (checked.length === 0) {
    if (window.showToast) window.showToast('Select at least one food item to analyze', 'warning');
    return;
  }

  const items = Array.from(checked).map(cb => cb.value);
  showNutritionModal(null, true); // Show loading state

  try {
    const result = await analyzeMeal(items);
    showNutritionModal(result, false);
    
    // Dispatch event for tracker to pick up
    document.dispatchEvent(new CustomEvent('mealAnalyzed', { detail: result }));
  } catch (err) {
    console.error('Analysis error:', err);
    if (window.showToast) window.showToast('Failed to analyze meal. Try again.', 'warning');
    closeNutritionModal();
  }
}

/* ─── NUTRITION MODAL ──────────────────────────────────── */
function showNutritionModal(result, loading) {
  const root = document.getElementById('nutrition-modal-root');
  if (!root) return;

  if (loading) {
    root.innerHTML = `
    <div class="nm-overlay nm-show">
      <div class="nm-modal">
        <div class="nm-loading">
          <div class="spinner"></div>
          <p>Analyzing your meal...</p>
        </div>
      </div>
    </div>`;
    return;
  }

  const { items, totals, healthScore, analysis, suitability } = result;

  const scoreColor = healthScore >= 7 ? '#10b981' : healthScore >= 4 ? '#f59e0b' : '#ef4444';
  const scoreLabel = healthScore >= 7 ? 'Healthy' : healthScore >= 4 ? 'Moderate' : 'Needs Improvement';

  root.innerHTML = `
  <div class="nm-overlay nm-show" id="nmOverlay">
    <div class="nm-modal">
      <div class="nm-header">
        <h3>🔬 Nutrition Analysis</h3>
        <button class="nm-close" id="nmClose">✕</button>
      </div>
      <div class="nm-body">
        <!-- Health Score -->
        <div class="nm-score-section">
          <div class="nm-score-ring" style="--score-color: ${scoreColor}; --score-pct: ${healthScore * 10}%">
            <div class="nm-score-inner">
              <span class="nm-score-val">${healthScore}</span>
              <span class="nm-score-max">/10</span>
            </div>
          </div>
          <div class="nm-score-label" style="color: ${scoreColor}">${scoreLabel}</div>
        </div>

        <!-- Totals -->
        <div class="nm-totals">
          <div class="nm-total-item nm-cal">
            <div class="nm-total-val">${totals.calories}</div>
            <div class="nm-total-label">Calories</div>
          </div>
          <div class="nm-total-item">
            <div class="nm-total-val">${totals.protein}g</div>
            <div class="nm-total-label">Protein</div>
          </div>
          <div class="nm-total-item">
            <div class="nm-total-val">${totals.carbs}g</div>
            <div class="nm-total-label">Carbs</div>
          </div>
          <div class="nm-total-item">
            <div class="nm-total-val">${totals.fat}g</div>
            <div class="nm-total-label">Fat</div>
          </div>
        </div>

        <!-- Macro bar -->
        <div class="nm-macro-bar">
          <div class="nm-macro-protein" style="width: ${getMacroPct(totals, 'protein')}%" title="Protein"></div>
          <div class="nm-macro-carbs" style="width: ${getMacroPct(totals, 'carbs')}%" title="Carbs"></div>
          <div class="nm-macro-fat" style="width: ${getMacroPct(totals, 'fat')}%" title="Fat"></div>
        </div>
        <div class="nm-macro-legend">
          <span><span class="nm-dot" style="background:#3b82f6"></span>Protein ${getMacroPct(totals, 'protein')}%</span>
          <span><span class="nm-dot" style="background:#f59e0b"></span>Carbs ${getMacroPct(totals, 'carbs')}%</span>
          <span><span class="nm-dot" style="background:#ef4444"></span>Fat ${getMacroPct(totals, 'fat')}%</span>
        </div>

        <!-- Additional nutrients -->
        <div class="nm-extra-row">
          <div class="nm-extra"><strong>Fiber:</strong> ${totals.fiber}g</div>
          <div class="nm-extra"><strong>Sugar:</strong> ${totals.sugar}g</div>
          <div class="nm-extra"><strong>Sodium:</strong> ${totals.sodium}mg</div>
        </div>

        <!-- Item breakdown -->
        <div class="nm-items-section">
          <h4>📋 Item Breakdown</h4>
          <div class="nm-items-list">
            ${items.map(it => `
            <div class="nm-item-row">
              <span class="nm-item-name">${it.name}${it.estimated ? ' *' : ''}</span>
              <span class="nm-item-cal">${it.calories} cal</span>
              <span class="nm-item-serving">${it.serving || '1 serving'}</span>
            </div>`).join('')}
          </div>
          ${items.some(i => i.estimated) ? '<div class="nm-estimated-note">* Estimated values</div>' : ''}
        </div>

        <!-- Suitability -->
        <div class="nm-suit-section">
          <h4>🎯 Goal Suitability</h4>
          <div class="nm-suit-grid">
            <div class="nm-suit-item">${suitability.weightLoss?.label || ''}</div>
            <div class="nm-suit-item">${suitability.muscleGain?.label || ''}</div>
            <div class="nm-suit-item">${suitability.maintenance?.label || ''}</div>
          </div>
        </div>

        <!-- Benefits / Drawbacks -->
        ${analysis.benefits.length > 0 ? `<div class="nm-analysis-section nm-benefits"><h4>✅ Benefits</h4><ul>${analysis.benefits.map(b => `<li>${b}</li>`).join('')}</ul></div>` : ''}
        ${analysis.drawbacks.length > 0 ? `<div class="nm-analysis-section nm-drawbacks"><h4>⚠️ Watch Out</h4><ul>${analysis.drawbacks.map(d => `<li>${d}</li>`).join('')}</ul></div>` : ''}
        ${analysis.suggestions.length > 0 ? `<div class="nm-analysis-section nm-suggestions"><h4>💡 Suggestions</h4><ul>${analysis.suggestions.map(s => `<li>${s}</li>`).join('')}</ul></div>` : ''}

        <!-- Log button -->
        <button class="nm-log-btn" id="nmLogBtn">📊 Log This Meal to Tracker</button>
      </div>
    </div>
  </div>`;

  document.getElementById('nmClose').addEventListener('click', closeNutritionModal);
  document.getElementById('nmOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'nmOverlay') closeNutritionModal();
  });
  document.getElementById('nmLogBtn').addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('logMealRequest', { detail: result }));
    closeNutritionModal();
    if (window.showToast) window.showToast('📊 Meal logged to tracker!', 'success');
  });
}

function closeNutritionModal() {
  const root = document.getElementById('nutrition-modal-root');
  if (root) root.innerHTML = '';
}

function getMacroPct(totals, macro) {
  const cals = { protein: totals.protein * 4, carbs: totals.carbs * 4, fat: totals.fat * 9 };
  const total = cals.protein + cals.carbs + cals.fat;
  if (total === 0) return 33;
  return Math.round((cals[macro] / total) * 100);
}

export default { analyzeMeal, injectMenuCheckboxes, lookupNutrition, LOCAL_DB };
