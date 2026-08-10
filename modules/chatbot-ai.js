/* =================================================================
   CHATBOT AI MODULE — Enhanced chatbot with Gemini API support
   Falls back to existing rule-based responses if Gemini unavailable
   ================================================================= */

import { getProfile, calculateTDEE, calculateProteinTarget } from './profile.js?v=8';
import nutrition from './nutrition.js?v=8';
const { analyzeMeal, LOCAL_DB } = nutrition;
import { getTrackerData } from './tracker.js?v=8';

// Gemini API configuration
const GEMINI_PROXY_URL = ''; // Set to your proxy URL
const GEMINI_DIRECT_KEY = '';

let conversationHistory = [];

function getGeminiKey() {
  return localStorage.getItem('gemini_key') || GEMINI_DIRECT_KEY;
}

function isGeminiAvailable() {
  return !!(GEMINI_PROXY_URL || getGeminiKey());
}

/* ─── ENHANCE EXISTING CHATBOT ─────────────────────────── */
export function enhanceChatbot() {
  const originalHandleChat = window.handleChat;

  window.handleChat = async function() {
    const inp = document.getElementById('chat-input');
    const cont = document.getElementById('chat-content');
    if (!inp || !cont) return;
    const raw = inp.value.trim();
    if (!raw) return;
    inp.value = '';

    cont.innerHTML += `<div class="user-msg"><span>${escHtml(raw)}</span></div>`;
    cont.scrollTop = cont.scrollHeight;

    const tid = 't-' + Date.now();
    cont.innerHTML += `<div class="bot-msg typing-indicator" id="${tid}"><div class="bot-icon">🤖</div><span><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></span></div>`;
    cont.scrollTop = cont.scrollHeight;

    const isNutritionQuery = /calorie|protein|nutrition|healthy|diet|eat|food|weight|muscle|fat|carb|fiber|sugar|score|recommend|roti|lighter|compare|macro|high.protein|low.cal/i.test(raw);

    let response;
    if (isNutritionQuery && isGeminiAvailable()) {
      try {
        response = await getGeminiResponse(raw);
      } catch (err) {
        console.warn('Gemini failed, using fallback:', err);
        response = getFallbackNutritionResponse(raw);
      }
    } else if (isNutritionQuery) {
      response = getFallbackNutritionResponse(raw);
    } else {
      response = getExistingBotResponse(raw);
    }

    document.getElementById(tid)?.remove();
    cont.innerHTML += `<div class="bot-msg"><div class="bot-icon">🤖</div><span>${response}</span></div>`;
    cont.scrollTop = cont.scrollHeight;
  };

  addNutritionQuickChips();
}

/* ─── GEMINI RESPONSE ──────────────────────────────────── */
async function getGeminiResponse(userMessage) {
  const app = window.messApp;
  const profile = getProfile();
  const tracker = getTrackerData();
  const today = app?.DAYS?.[new Date().getDay()] || 'Monday';
  const menu = app?.cachedMenuData?.[today];
  const hostel = app?.currentHostel || 'c v raman';

  const systemContext = buildContext(profile, menu, today, tracker, hostel);

  conversationHistory.push({ role: 'user', parts: [{ text: userMessage }] });
  if (conversationHistory.length > 6) {
    conversationHistory = conversationHistory.slice(-6);
  }

  let response;

  if (GEMINI_PROXY_URL) {
    const resp = await fetch(GEMINI_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: conversationHistory, context: systemContext })
    });
    if (!resp.ok) throw new Error('Proxy error');
    const data = await resp.json();
    response = data.response || data.text || 'Sorry, I could not generate a response.';
  } else {
    const key = getGeminiKey();
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemContext }] },
        contents: conversationHistory,
        generationConfig: { maxOutputTokens: 500, temperature: 0.7 }
      })
    });
    if (!resp.ok) throw new Error('Gemini API error');
    const data = await resp.json();
    response = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, could not generate a response.';
  }

  conversationHistory.push({ role: 'model', parts: [{ text: response }] });
  return formatGeminiResponse(response);
}

function buildContext(profile, menu, today, tracker, hostel) {
  const hostelLabel = hostel === 'aryabhatt' ? 'Aryabhatta (Mess-5)' : 'C.V. Raman (Mess-4)';
  let ctx = `You are the IIT Patna ${hostelLabel} Mess Assistant chatbot. Be helpful, concise, and friendly. Use emojis sparingly.

Today is ${today}. Current time: ${new Date().toLocaleTimeString('en-IN')}.
Hostel: ${hostelLabel}

Today's menu with approximate calories per serving:
`;

  if (menu) {
    const meals = ['breakfast', 'lunch', 'snacks', 'dinner', 'dessert'];
    for (const meal of meals) {
      const items = menu[meal];
      if (!items || items === '—' || items === '-') continue;
      ctx += `\n${meal.toUpperCase()}:\n`;
      const itemList = items.split(',').map(i => i.trim()).filter(Boolean);
      for (const item of itemList) {
        const match = findInLocalDB(item.toLowerCase());
        if (match) {
          ctx += `  - ${item}: ~${match.calories} cal, ${match.protein}g protein, ${match.carbs}g carbs, ${match.fat}g fat (per ${match.serving})\n`;
        } else {
          ctx += `  - ${item}: (nutrition data not available)\n`;
        }
      }
    }
  }

  if (profile) {
    const tdee = calculateTDEE(profile);
    ctx += `\nUser profile: ${profile.name}, ${profile.age}y, ${profile.gender}, ${profile.height}cm, ${profile.weight}kg
Activity: ${profile.activityLevel}, Goal: ${profile.fitnessGoal}
Daily calorie target: ${tdee} cal, Protein target: ${calculateProteinTarget(profile)}g
`;
  }

  if (tracker?.totals?.calories > 0) {
    ctx += `\nToday's tracked intake so far: ${tracker.totals.calories} cal, ${tracker.totals.protein}g protein
`;
  }

  ctx += `
IMPORTANT RULES:
- Only recommend dishes that are actually on today's menu. Do NOT invent dishes.
- When estimating calories, use the per-serving values provided above.
- For roti: ~85 cal per plain roti, ~150 cal per ghee roti.
- Always state that calorie values are approximate estimates.
- If asked about quantities (e.g., "4 rotis"), multiply per-piece calories accordingly.
- Keep responses under 120 words.
- If you don't have enough data, say so honestly.`;

  return ctx;
}

function formatGeminiResponse(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.*?)\*/g, '<i>$1</i>')
    .replace(/\n/g, '<br>')
    .replace(/- /g, '• ');
}

/* ─── FALLBACK NUTRITION RESPONSES ─────────────────────── */
function getFallbackNutritionResponse(raw) {
  const text = raw.toLowerCase();
  const app = window.messApp;
  const today = app?.DAYS?.[new Date().getDay()] || 'Monday';
  const menu = app?.cachedMenuData?.[today];
  const profile = getProfile();
  const tracker = getTrackerData();

  // "How many calories in X rotis and Y"
  const rotiMatch = text.match(/(\d+)\s*(roti|chapati|phulka)/i);
  if (rotiMatch) {
    const qty = parseInt(rotiMatch[1]);
    const calPer = 85;
    const rotiCal = calPer * qty;
    let totalCal = rotiCal;
    const parts = [`${qty} roti: ~${rotiCal} cal`];

    // Check for other items mentioned
    const otherItems = text.replace(/\d+\s*(roti|chapati|phulka)/i, '').replace(/and|with|plus/gi, ',').split(',').map(s => s.trim()).filter(s => s.length > 2);
    for (const item of otherItems) {
      const match = findInLocalDB(item);
      if (match) {
        totalCal += match.calories;
        parts.push(`${item}: ~${match.calories} cal`);
      }
    }
    return `🔬 <b>Calorie Estimate:</b><br>${parts.join('<br>')}<br><br><b>Total: ~${totalCal} cal</b><br><br><i>⚠ These are approximate estimates. Actual values depend on size, flour quantity, and oil/butter/ghee used.</i>`;
  }

  // "What should I eat today?" / "Recommend" / "Suggest"
  if (/what should i eat|recommend|suggest/i.test(text)) {
    if (!menu) return 'Menu is loading... try again shortly! ⏳';
    const goal = profile?.fitnessGoal || 'maintenance';
    const allItems = getAllMenuItems(menu);
    const ranked = rankByGoal(allItems, goal);
    if (ranked.length === 0) return 'Could not find matching items. Try using the Analyze Meal feature!';
    
    const topItems = ranked.slice(0, 4);
    const goalLabel = { weight_loss: 'Weight Loss', muscle_gain: 'Muscle Gain', weight_gain: 'Weight Gain', maintenance: 'Balanced' }[goal] || 'Balanced';
    return `🎯 <b>Best picks for ${goalLabel}:</b><br>${topItems.map(i => `• ${i.name} (~${i.cal} cal, ${i.pro}g protein)`).join('<br>')}<br><br><i>⚠ These are approximate estimates based on standard servings.</i>`;
  }

  // "Highest protein" / "Most protein" / "High protein meal"
  if (/highest protein|most protein|protein rich|high.protein/i.test(text)) {
    if (!menu) return 'Menu loading ⏳';
    const allItems = getAllMenuItems(menu);
    const sorted = allItems.sort((a, b) => b.pro - a.pro);
    const top = sorted.slice(0, 5);
    if (top.length === 0) return 'Check the menu items — dal, paneer, and eggs are usually the best protein sources!';
    return `🥩 <b>Highest protein items today:</b><br>${top.map(i => `• ${i.name}: ~${i.pro}g protein (${i.cal} cal)`).join('<br>')}<br><br><i>⚠ Values are approximate estimates.</i>`;
  }

  // "Compare lunch and dinner" / "Compare today's meals"
  if (/compare.*lunch.*dinner|compare.*dinner.*lunch|compare.*meals/i.test(text)) {
    if (!menu) return 'Menu loading ⏳';
    const lunchItems = (menu.lunch || '').split(',').map(i => i.trim()).filter(Boolean);
    const dinnerItems = (menu.dinner || '').split(',').map(i => i.trim()).filter(Boolean);
    let lunchCal = 0, lunchPro = 0, dinnerCal = 0, dinnerPro = 0;
    for (const item of lunchItems) { const m = findInLocalDB(item.toLowerCase()); if (m) { lunchCal += m.calories; lunchPro += m.protein; } }
    for (const item of dinnerItems) { const m = findInLocalDB(item.toLowerCase()); if (m) { dinnerCal += m.calories; dinnerPro += m.protein; } }
    return `📊 <b>Lunch vs Dinner:</b><br><br>🍱 <b>Lunch:</b> ${menu.lunch}<br>~${lunchCal} cal, ~${lunchPro}g protein<br><br>🍛 <b>Dinner:</b> ${menu.dinner}<br>~${dinnerCal} cal, ~${dinnerPro}g protein<br><br>${lunchCal > dinnerCal ? 'Lunch is heavier today.' : 'Dinner is heavier today.'}<br><i>⚠ Approximate estimates.</i>`;
  }

  // "Is today's meal high in carbs/protein/fat?"
  if (/is.*high.*in|is.*low.*in|macro|carb.*heavy|protein.*heavy|fat.*heavy/i.test(text)) {
    if (!menu) return 'Menu loading ⏳';
    const allItems = getAllMenuItems(menu);
    let totCal = 0, totPro = 0, totCarb = 0, totFat = 0;
    allItems.forEach(i => { totCal += i.cal; totPro += i.pro; totCarb += i.carb; totFat += i.fat; });
    const totalMacroCal = totPro * 4 + totCarb * 4 + totFat * 9;
    const proPct = totalMacroCal > 0 ? Math.round((totPro * 4 / totalMacroCal) * 100) : 0;
    const carbPct = totalMacroCal > 0 ? Math.round((totCarb * 4 / totalMacroCal) * 100) : 0;
    const fatPct = totalMacroCal > 0 ? Math.round((totFat * 9 / totalMacroCal) * 100) : 0;
    
    let verdict = '';
    if (carbPct > 55) verdict = "Today's menu is <b>carb-heavy</b>. Consider limiting rice/roti portions.";
    else if (fatPct > 35) verdict = "Today's menu is <b>high in fat</b>. Consider skipping fried items.";
    else if (proPct > 25) verdict = "Today's menu has <b>good protein</b>! Great for muscle building.";
    else verdict = "Today's menu has a <b>moderate macro balance</b>.";

    return `📊 <b>Today's Macro Breakdown (all meals):</b><br>🥩 Protein: ~${totPro}g (${proPct}%)<br>🍞 Carbs: ~${totCarb}g (${carbPct}%)<br>🧈 Fat: ~${totFat}g (${fatPct}%)<br>🔥 Total: ~${totCal} cal<br><br>${verdict}<br><i>⚠ Approximate estimates based on standard servings.</i>`;
  }

  // "Lighter dinner" / "Light meal"
  if (/lighter|light meal|low cal|fewer cal/i.test(text)) {
    if (!menu) return 'Menu loading ⏳';
    let mealType = 'dinner';
    if (/lunch/i.test(text)) mealType = 'lunch';
    if (/breakfast/i.test(text)) mealType = 'breakfast';
    const items = (menu[mealType] || '').split(',').map(i => i.trim()).filter(Boolean);
    const analyzed = items.map(item => {
      const m = findInLocalDB(item.toLowerCase());
      return m ? { name: item, cal: m.calories } : null;
    }).filter(Boolean).sort((a, b) => a.cal - b.cal);
    if (analyzed.length === 0) return 'Could not analyze the menu items. Try the Analyze Meal feature!';
    const lighter = analyzed.slice(0, 3);
    return `🥗 <b>Lighter options for ${mealType}:</b><br>${lighter.map(i => `• ${i.name}: ~${i.cal} cal`).join('<br>')}<br><br>💡 Skip fried items and limit roti to 1-2. Add salad for fiber!<br><i>⚠ Approximate estimates.</i>`;
  }

  // "Healthiest option today"
  if (/healthiest|most healthy|best option/i.test(text)) {
    if (!menu) return 'Menu loading ⏳';
    const allItems = getAllMenuItems(menu);
    // Score: high protein + fiber, low fat + sugar
    const scored = allItems.map(i => ({
      ...i,
      score: (i.pro * 2) + (i.fiber || 0) * 1.5 - (i.fat * 0.5) - (i.sugar || 0)
    })).sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 4);
    return `🥗 <b>Healthiest options today:</b><br>${top.map(i => `• ${i.name}: ~${i.cal} cal, ${i.pro}g protein`).join('<br>')}<br><br>💡 Combine these with salad and curd for a balanced meal!<br><i>⚠ Approximate estimates.</i>`;
  }

  // Calorie breakdown
  if (/calorie.*break|how many cal|calorie.*today|calorie.*lunch|calorie.*dinner|calorie.*breakfast/i.test(text)) {
    if (!menu) return 'Menu loading ⏳';
    let mealType = 'lunch';
    if (/breakfast/i.test(text)) mealType = 'breakfast';
    else if (/dinner/i.test(text)) mealType = 'dinner';
    else if (/snack/i.test(text)) mealType = 'snacks';

    const items = (menu[mealType] || '').split(',').map(i => i.trim()).filter(Boolean);
    let totalCal = 0;
    const breakdown = [];
    for (const item of items) {
      const match = findInLocalDB(item.toLowerCase());
      if (match) {
        totalCal += match.calories;
        breakdown.push(`${item}: ~${match.calories} cal`);
      }
    }
    if (breakdown.length > 0) {
      return `🔬 <b>${capitalize(mealType)} Calories (est.):</b><br>${breakdown.join('<br>')}<br><br><b>Total: ~${totalCal} cal</b><br><i>⚠ Approximate estimates. Actual values depend on serving size and preparation.</i>`;
    }
    return `I can estimate calories! Use the ✅ checkboxes on menu items and tap <b>Analyze Meal</b> for detailed nutrition info.`;
  }

  // Can I eat dessert?
  if (/dessert.*diet|dessert.*weight|can i.*dessert/i.test(text)) {
    const goal = profile?.fitnessGoal;
    if (goal === 'weight_loss') {
      return `🍦 Desserts are usually 150-250 cal with lots of sugar. For weight loss, <b>skip dessert</b> or have just a tiny taste. Your body will thank you! 💪`;
    }
    return `🍦 Desserts are fine in moderation! Today's dessert is ${menu?.dessert || 'not listed'}. One serving is usually 150-250 cal.`;
  }

  // Today's tracker
  if (/how much.*eaten|tracker|intake|consumed/i.test(text)) {
    if (tracker?.totals?.calories > 0) {
      const tdee = calculateTDEE(profile);
      const remaining = Math.max(0, tdee - tracker.totals.calories);
      return `📊 <b>Today's Intake:</b><br>🔥 ${tracker.totals.calories} cal consumed<br>🥩 ${tracker.totals.protein}g protein<br><br>⏳ ${remaining} cal remaining (of ${tdee} goal)`;
    }
    return `📊 You haven't tracked any meals today. Select items from the menu and tap <b>Analyze Meal</b> to start tracking!`;
  }

  // Healthy?
  if (/is.*healthy|healthy.*today/i.test(text)) {
    if (!menu) return 'Menu loading ⏳';
    return `🥗 Today's menu is ${hasHighProteinItem(menu) ? 'reasonably healthy' : 'moderate'}! Best picks: dal, salad, and curd for nutrition. ${menu.dessert && menu.dessert !== '-' ? `Watch the dessert (${menu.dessert}).` : ''} Use <b>Analyze Meal</b> for a detailed health score!<br><i>⚠ This is a general assessment, not medical advice.</i>`;
  }

  // Default
  return `I can help with nutrition! Try asking:<br>• "How many calories in 4 rotis and dal?"<br>• "What's the healthiest option today?"<br>• "Suggest a high-protein meal"<br>• "Compare today's lunch and dinner"<br>• "Is today's meal high in carbs?"<br>• "Suggest a lighter dinner"<br><br>Or select items and tap <b>🔬 Analyze Meal</b> for full nutrition facts!`;
}

/* ─── HELPER FUNCTIONS ─────────────────────────────────── */
function findInLocalDB(key) {
  if (LOCAL_DB[key]) return LOCAL_DB[key];
  for (const [dbKey, val] of Object.entries(LOCAL_DB)) {
    if (key.includes(dbKey) || dbKey.includes(key)) return val;
  }
  return null;
}

function getAllMenuItems(menu) {
  const result = [];
  for (const [mealType, items] of Object.entries(menu)) {
    if (!items || items === '—' || items === '-') continue;
    const itemList = items.split(',').map(i => i.trim()).filter(Boolean);
    for (const item of itemList) {
      const match = findInLocalDB(item.toLowerCase());
      if (match) {
        result.push({
          name: item,
          mealType,
          cal: match.calories,
          pro: match.protein,
          carb: match.carbs,
          fat: match.fat,
          fiber: match.fiber || 0,
          sugar: match.sugar || 0
        });
      }
    }
  }
  return result;
}

function rankByGoal(items, goal) {
  return items.sort((a, b) => {
    if (goal === 'weight_loss') {
      return (a.cal - a.pro * 3) - (b.cal - b.pro * 3); // Low cal, high protein
    } else if (goal === 'muscle_gain') {
      return b.pro - a.pro; // High protein first
    } else if (goal === 'weight_gain') {
      return b.cal - a.cal; // High cal first
    }
    return (b.pro + (b.fiber || 0)) - (a.pro + (a.fiber || 0)); // Balanced
  });
}

function hasHighProteinItem(menu) {
  const all = Object.values(menu).join(' ').toLowerCase();
  return /paneer|chicken|egg|dal|chole|rajma|curd/i.test(all);
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

/* ─── QUICK CHIPS ──────────────────────────────────────── */
function addNutritionQuickChips() {
  const quickReplies = document.getElementById('quickReplies');
  if (!quickReplies) return;
  if (quickReplies.querySelector('[data-ai-chip]')) return;

  const chips = [
    { text: 'Healthiest option?', query: "What's the healthiest option today?" },
    { text: 'Calories in 4 rotis?', query: 'How many calories in 4 rotis and dal?' },
    { text: 'High protein meal?', query: 'Suggest a high-protein meal from today\'s menu' },
    { text: 'Compare lunch & dinner', query: "Compare today's lunch and dinner" },
  ];

  chips.forEach(chip => {
    const btn = document.createElement('button');
    btn.className = 'quick-chip';
    btn.dataset.aiChip = '1';
    btn.textContent = chip.text;
    btn.addEventListener('click', () => {
      if (window.openChat) window.openChat();
      setTimeout(() => {
        const input = document.getElementById('chat-input');
        if (input) { input.value = chip.query; window.handleChat(); }
      }, 350);
    });
    quickReplies.appendChild(btn);
  });
}

/* ─── EXISTING BOT RESPONSE (from original script.js) ─── */
function getExistingBotResponse(raw) {
  const text = raw.toLowerCase();
  const app = window.messApp;
  const DAYS = app?.DAYS || ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today = DAYS[new Date().getDay()];
  const menu = app?.cachedMenuData?.[today];

  if (/^(hi|hello|hey)/i.test(text)) {
    const profile = getProfile();
    const name = profile?.name ? `, ${profile.name.split(' ')[0]}` : '';
    const hour = new Date().getHours();
    const g = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    return `${g}${name}! 😊 I'm your AI Mess Assistant. Ask me about today's menu, nutrition, or what to eat!`;
  }

  if (/thank/i.test(text)) return "You're welcome! Enjoy your meal! 🍽️";
  if (/bye/i.test(text)) return "Bye! Have a great day! 😄";

  if ((text.includes('today') && text.includes('menu')) || text.includes('full menu')) {
    if (!menu) return 'Menu is loading… ⏳';
    return `📋 <b>${today}'s Menu:</b><br>🍳 ${menu.breakfast}<br>🍱 ${menu.lunch}<br>☕ ${menu.snacks}<br>🍛 ${menu.dinner}${menu.dessert && menu.dessert !== '-' ? `<br>🍦 ${menu.dessert}` : ''}`;
  }

  if (/time|timing/i.test(text)) {
    const timing = app?.getActiveTimings?.(today);
    if (timing) {
      return `🕒 <b>Mess Timings:</b><br>🍳 ${timing.breakfast}<br>🍱 ${timing.lunch}<br>☕ ${timing.snacks}<br>🍛 ${timing.dinner}`;
    }
  }

  if (/complain/i.test(text)) {
    return `To file a complaint, tap the <b>＋</b> button and select 📢 or <a href="complaint.html" style="color:var(--accent)">click here</a>.`;
  }

  // Fallback
  return `I can help with menu, timings, and nutrition! Try:<br>• "Today's menu"<br>• "How many calories in 4 rotis?"<br>• "Suggest a high-protein meal"<br>• "Compare lunch & dinner"`;
}

function escHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

export default { enhanceChatbot };
