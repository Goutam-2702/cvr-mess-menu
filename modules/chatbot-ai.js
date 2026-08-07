/* =================================================================
   CHATBOT AI MODULE — Enhanced chatbot with Gemini API support
   Falls back to existing rule-based responses if Gemini unavailable
   ================================================================= */

import { getProfile, calculateTDEE, calculateProteinTarget } from './profile.js?v=8';
import nutrition from './nutrition.js?v=8';
const { analyzeMeal, LOCAL_DB } = nutrition;
import { getTrackerData } from './tracker.js?v=8';

// Gemini API configuration
// In production, use a Cloudflare Worker proxy
const GEMINI_PROXY_URL = ''; // Set to your proxy URL, e.g., 'https://your-worker.workers.dev/api/chat'
const GEMINI_DIRECT_KEY = ''; // For development only — set via localStorage: localStorage.setItem('gemini_key', 'YOUR_KEY')

let conversationHistory = [];

function getGeminiKey() {
  return localStorage.getItem('gemini_key') || GEMINI_DIRECT_KEY;
}

function isGeminiAvailable() {
  return !!(GEMINI_PROXY_URL || getGeminiKey());
}

/* ─── ENHANCE EXISTING CHATBOT ─────────────────────────── */
export function enhanceChatbot() {
  // Override the existing handleChat function
  const originalHandleChat = window.handleChat;

  window.handleChat = async function() {
    const inp = document.getElementById('chat-input');
    const cont = document.getElementById('chat-content');
    if (!inp || !cont) return;
    const raw = inp.value.trim();
    if (!raw) return;
    inp.value = '';

    // Add user message
    cont.innerHTML += `<div class="user-msg"><span>${escHtml(raw)}</span></div>`;
    cont.scrollTop = cont.scrollHeight;

    // Show typing indicator
    const tid = 't-' + Date.now();
    cont.innerHTML += `<div class="bot-msg typing-indicator" id="${tid}"><div class="bot-icon">🤖</div><span><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></span></div>`;
    cont.scrollTop = cont.scrollHeight;

    // Check if this is a nutrition/AI query
    const isNutritionQuery = /calorie|protein|nutrition|healthy|diet|eat|food|weight|muscle|fat|carb|fiber|sugar|score|recommend/i.test(raw);

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
      // Use existing chatbot logic for non-nutrition queries
      response = getExistingBotResponse(raw);
    }

    // Remove typing indicator and show response
    document.getElementById(tid)?.remove();
    cont.innerHTML += `<div class="bot-msg"><div class="bot-icon">🤖</div><span>${response}</span></div>`;
    cont.scrollTop = cont.scrollHeight;
  };

  // Add new quick chips
  addNutritionQuickChips();
}

/* ─── GEMINI RESPONSE ──────────────────────────────────── */
async function getGeminiResponse(userMessage) {
  const app = window.messApp;
  const profile = getProfile();
  const tracker = getTrackerData();
  const today = app?.DAYS?.[new Date().getDay()] || 'Monday';
  const menu = app?.cachedMenuData?.[today];

  const systemContext = buildContext(profile, menu, today, tracker);

  conversationHistory.push({ role: 'user', parts: [{ text: userMessage }] });

  // Keep conversation short (last 6 messages)
  if (conversationHistory.length > 6) {
    conversationHistory = conversationHistory.slice(-6);
  }

  let response;

  if (GEMINI_PROXY_URL) {
    // Use proxy
    const resp = await fetch(GEMINI_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: conversationHistory,
        context: systemContext
      })
    });
    if (!resp.ok) throw new Error('Proxy error');
    const data = await resp.json();
    response = data.response || data.text || 'Sorry, I could not generate a response.';
  } else {
    // Direct Gemini API (dev only)
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

  // Format for HTML
  return formatGeminiResponse(response);
}

function buildContext(profile, menu, today, tracker) {
  let ctx = `You are the IIT Patna Mess Assistant chatbot. Be helpful, concise, and friendly. Use emojis sparingly.

Today is ${today}. Current time: ${new Date().toLocaleTimeString('en-IN')}.

Today's menu:
`;

  if (menu) {
    ctx += `- Breakfast: ${menu.breakfast || '—'}
- Lunch: ${menu.lunch || '—'}
- Snacks: ${menu.snacks || '—'}
- Dinner: ${menu.dinner || '—'}
- Dessert: ${menu.dessert || '—'}
`;
  }

  if (profile) {
    const tdee = calculateTDEE(profile);
    ctx += `
User profile: ${profile.name}, ${profile.age}y, ${profile.gender}, ${profile.height}cm, ${profile.weight}kg
Activity: ${profile.activityLevel}, Goal: ${profile.fitnessGoal}
Daily calorie target: ${tdee} cal, Protein target: ${calculateProteinTarget(profile)}g
`;
  }

  if (tracker?.totals?.calories > 0) {
    ctx += `
Today's tracked intake so far: ${tracker.totals.calories} cal, ${tracker.totals.protein}g protein
`;
  }

  ctx += `
Answer nutrition questions about the mess menu. If asked about calories, estimate using standard Indian food portions. Keep responses under 100 words.`;

  return ctx;
}

function formatGeminiResponse(text) {
  // Convert markdown-ish to HTML
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

  // "What should I eat today?"
  if (/what should i eat|recommend|suggest/i.test(text)) {
    if (!menu) return 'Menu is loading... try again shortly! ⏳';
    const goal = profile?.fitnessGoal || 'maintenance';
    if (goal === 'weight_loss') {
      return `🔥 <b>For Weight Loss:</b> Focus on dal/protein + salad + 1-2 roti. Skip dessert and fried items. Today's lunch has ${menu.lunch || 'good options'} — pick wisely!`;
    }
    if (goal === 'muscle_gain') {
      return `💪 <b>For Muscle Gain:</b> Eat full portions! Priority: dal, paneer, eggs, curd with rice & roti. Today's dinner: ${menu.dinner || 'looks good'} — load up on protein!`;
    }
    return `⚖️ <b>Balanced Meal:</b> Have a mix of everything in moderate portions. Today: ${menu.lunch || 'Check the menu!'} for lunch looks great!`;
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
      const key = item.toLowerCase();
      const match = findInLocalDB(key);
      if (match) {
        totalCal += match.calories;
        breakdown.push(`${item}: ~${match.calories} cal`);
      }
    }
    if (breakdown.length > 0) {
      return `🔬 <b>${capitalize(mealType)} Calories (est.):</b><br>${breakdown.join('<br>')}<br><br><b>Total: ~${totalCal} cal</b>`;
    }
    return `I can estimate calories! Use the ✅ checkboxes on menu items and tap <b>Analyze Meal</b> for detailed nutrition info.`;
  }

  // Highest protein
  if (/highest protein|most protein|protein rich/i.test(text)) {
    if (!menu) return 'Menu loading ⏳';
    const all = Object.values(menu).join(',').split(',').map(i => i.trim()).filter(Boolean);
    let best = null, bestPro = 0;
    for (const item of all) {
      const match = findInLocalDB(item.toLowerCase());
      if (match && match.protein > bestPro) { best = item; bestPro = match.protein; }
    }
    return best ? `🥩 Highest protein today: <b>${best}</b> (~${bestPro}g protein per serving)` : 'Check the menu items — dal, paneer, and eggs are usually the best protein sources!';
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
    return `🥗 Today's menu is ${hasHighProteinItem(menu) ? 'reasonably healthy' : 'moderate'}! Best picks: dal, salad, and curd for nutrition. ${menu.dessert && menu.dessert !== '-' ? `Watch the dessert (${menu.dessert}).` : ''} Use <b>Analyze Meal</b> for a detailed health score!`;
  }

  // Default nutrition response
  return `I can help with nutrition! Try asking:<br>• "Calorie breakdown of today's lunch"<br>• "What should I eat today?"<br>• "Which item has the highest protein?"<br>• "Can I eat dessert while dieting?"<br><br>Or select items and tap <b>🔬 Analyze Meal</b> for full nutrition facts!`;
}

function findInLocalDB(key) {
  if (LOCAL_DB[key]) return LOCAL_DB[key];
  for (const [dbKey, val] of Object.entries(LOCAL_DB)) {
    if (key.includes(dbKey) || dbKey.includes(key)) return val;
  }
  return null;
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

  // Don't duplicate
  if (quickReplies.querySelector('[data-ai-chip]')) return;

  const chips = [
    { text: 'What should I eat?', query: 'What should I eat today based on my fitness goal?' },
    { text: 'Calorie breakdown', query: "Calorie breakdown of today's lunch" },
    { text: 'Highest protein?', query: 'Which item today has the highest protein?' },
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
  // This calls the original generateBotResponse if available
  // We patched handleChat but the original function is in script.js scope
  // For messages that aren't nutrition-related, we provide basic responses
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
  return `I can help with menu, timings, and nutrition! Try:<br>• "Today's menu"<br>• "What should I eat?"<br>• "Calorie breakdown"<br>• "Highest protein item?"`;
}

function escHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

export default { enhanceChatbot };
