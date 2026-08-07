/* =================================================================
   DASHBOARD MODULE — Weekly charts & analytics (no AI summary)
   ================================================================= */

import { getWeeklyData } from './tracker.js?v=8';
import { getProfile, calculateTDEE, calculateProteinTarget } from './profile.js?v=8';

export function initDashboard() {
  // Add dashboard button to speed dial
  const speedMenu = document.getElementById('speedDialMenu');
  if (speedMenu && !document.getElementById('sdDashboard')) {
    const item = document.createElement('div');
    item.className = 'speed-dial-item';
    item.innerHTML = `
      <span class="speed-dial-label">Weekly Dashboard</span>
      <button class="speed-dial-btn" id="sdDashboard" style="background: linear-gradient(135deg, #10b981, #059669)" aria-label="Dashboard">📊</button>
    `;
    speedMenu.insertBefore(item, speedMenu.firstChild);
    document.getElementById('sdDashboard').addEventListener('click', () => {
      if (window.closeSpeedDial) window.closeSpeedDial();
      showDashboard();
    });
  }
}

export function showDashboard() {
  const root = document.getElementById('dashboard-root');
  if (!root) return;

  const profile = getProfile();
  const weeklyData = getWeeklyData();
  const tdee = calculateTDEE(profile);
  const proteinTarget = calculateProteinTarget(profile);

  // Calculate stats
  const daysWithData = weeklyData.filter(d => d.calories > 0);
  const avgCalories = daysWithData.length > 0
    ? Math.round(daysWithData.reduce((s, d) => s + d.calories, 0) / daysWithData.length) : 0;
  const avgProtein = daysWithData.length > 0
    ? Math.round(daysWithData.reduce((s, d) => s + d.protein, 0) / daysWithData.length) : 0;
  const totalCalories = weeklyData.reduce((s, d) => s + d.calories, 0);
  const maxCalDay = weeklyData.reduce((max, d) => d.calories > max.calories ? d : max, weeklyData[0]);

  root.innerHTML = `
  <div class="db-overlay db-show" id="dbOverlay">
    <div class="db-panel">
      <div class="db-header">
        <h3>📊 Weekly Dashboard</h3>
        <button class="db-close" id="dbClose">✕</button>
      </div>
      <div class="db-body">
        <!-- Stats Cards -->
        <div class="db-stats">
          <div class="db-stat-card">
            <div class="db-stat-val">${avgCalories}</div>
            <div class="db-stat-label">Avg Calories/Day</div>
          </div>
          <div class="db-stat-card">
            <div class="db-stat-val">${avgProtein}g</div>
            <div class="db-stat-label">Avg Protein/Day</div>
          </div>
          <div class="db-stat-card">
            <div class="db-stat-val">${totalCalories}</div>
            <div class="db-stat-label">Total This Week</div>
          </div>
          <div class="db-stat-card">
            <div class="db-stat-val">${daysWithData.length}</div>
            <div class="db-stat-label">Days Tracked</div>
          </div>
        </div>

        <!-- Calorie Chart -->
        <div class="db-chart-section">
          <h4>🔥 Calorie Intake</h4>
          <div class="db-bar-chart" id="dbCalChart">
            ${weeklyData.map(d => {
              const pct = tdee > 0 ? Math.min(100, Math.round((d.calories / tdee) * 100)) : 0;
              const color = d.calories > tdee ? '#ef4444' : d.calories > tdee * 0.8 ? '#f59e0b' : '#10b981';
              return `<div class="db-bar-col">
                <div class="db-bar-val">${d.calories > 0 ? d.calories : ''}</div>
                <div class="db-bar" style="height: ${Math.max(4, pct)}%; background: ${color}"></div>
                <div class="db-bar-label">${d.dayName}</div>
              </div>`;
            }).join('')}
          </div>
          <div class="db-goal-line">Goal: ${tdee} cal/day</div>
        </div>

        <!-- Protein Chart -->
        <div class="db-chart-section">
          <h4>🥩 Protein Intake</h4>
          <div class="db-bar-chart" id="dbProChart">
            ${weeklyData.map(d => {
              const pct = proteinTarget > 0 ? Math.min(100, Math.round((d.protein / proteinTarget) * 100)) : 0;
              const color = d.protein >= proteinTarget ? '#3b82f6' : '#8b5cf6';
              return `<div class="db-bar-col">
                <div class="db-bar-val">${d.protein > 0 ? d.protein + 'g' : ''}</div>
                <div class="db-bar" style="height: ${Math.max(4, pct)}%; background: ${color}"></div>
                <div class="db-bar-label">${d.dayName}</div>
              </div>`;
            }).join('')}
          </div>
          <div class="db-goal-line">Target: ${proteinTarget}g/day</div>
        </div>

        <!-- Macro Distribution -->
        <div class="db-chart-section">
          <h4>🥗 Average Macros</h4>
          ${daysWithData.length > 0 ? (() => {
            const avgCarbs = Math.round(daysWithData.reduce((s, d) => s + d.carbs, 0) / daysWithData.length);
            const avgFat = Math.round(daysWithData.reduce((s, d) => s + d.fat, 0) / daysWithData.length);
            const totalMacro = avgProtein * 4 + avgCarbs * 4 + avgFat * 9;
            const proPct = totalMacro > 0 ? Math.round((avgProtein * 4 / totalMacro) * 100) : 33;
            const carbPct = totalMacro > 0 ? Math.round((avgCarbs * 4 / totalMacro) * 100) : 33;
            const fatPct = totalMacro > 0 ? Math.round((avgFat * 9 / totalMacro) * 100) : 34;

            return `
            <div class="nm-macro-bar" style="margin: 12px 0">
              <div class="nm-macro-protein" style="width: ${proPct}%"></div>
              <div class="nm-macro-carbs" style="width: ${carbPct}%"></div>
              <div class="nm-macro-fat" style="width: ${fatPct}%"></div>
            </div>
            <div class="nm-macro-legend">
              <span><span class="nm-dot" style="background:#3b82f6"></span>Protein ${proPct}% (${avgProtein}g)</span>
              <span><span class="nm-dot" style="background:#f59e0b"></span>Carbs ${carbPct}% (${avgCarbs}g)</span>
              <span><span class="nm-dot" style="background:#ef4444"></span>Fat ${fatPct}% (${avgFat}g)</span>
            </div>`;
          })() : '<p class="db-no-data">Start tracking meals to see macro distribution</p>'}
        </div>

        <!-- Insights -->
        <div class="db-insights">
          <h4>💡 Insights</h4>
          ${generateInsights(weeklyData, tdee, proteinTarget, avgCalories, avgProtein)}
        </div>
      </div>
    </div>
  </div>`;

  document.getElementById('dbClose').addEventListener('click', closeDashboard);
  document.getElementById('dbOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'dbOverlay') closeDashboard();
  });
}

function closeDashboard() {
  const overlay = document.getElementById('dbOverlay');
  if (overlay) {
    overlay.classList.add('db-closing');
    setTimeout(() => {
      const root = document.getElementById('dashboard-root');
      if (root) root.innerHTML = '';
    }, 350);
  }
}

function generateInsights(weeklyData, tdee, proteinTarget, avgCalories, avgProtein) {
  const insights = [];
  const daysTracked = weeklyData.filter(d => d.calories > 0).length;

  if (daysTracked === 0) {
    return '<p class="db-no-data">Start tracking meals to get personalized insights!</p>';
  }

  if (avgCalories > tdee * 1.1) {
    insights.push({ icon: '⚠️', text: `You're averaging ${avgCalories - tdee} cal above your daily goal. Consider reducing portions.`, type: 'warn' });
  } else if (avgCalories < tdee * 0.7) {
    insights.push({ icon: '⚠️', text: `You're eating significantly below your goal. Make sure you're eating enough!`, type: 'warn' });
  } else {
    insights.push({ icon: '✅', text: `Your calorie intake is on track with your ${tdee} cal/day goal.`, type: 'good' });
  }

  if (avgProtein < proteinTarget * 0.7) {
    insights.push({ icon: '🥩', text: `Protein intake is low (${avgProtein}g vs ${proteinTarget}g target). Add more dal, paneer, or eggs.`, type: 'warn' });
  } else if (avgProtein >= proteinTarget) {
    insights.push({ icon: '💪', text: `Great protein intake! You're meeting your ${proteinTarget}g daily target.`, type: 'good' });
  }

  if (daysTracked < 4) {
    insights.push({ icon: '📊', text: `Track more days for better insights. You've tracked ${daysTracked} of 7 days.`, type: 'info' });
  }

  return insights.map(i => `<div class="db-insight db-insight-${i.type}"><span>${i.icon}</span><span>${i.text}</span></div>`).join('');
}

export default { initDashboard, showDashboard };
