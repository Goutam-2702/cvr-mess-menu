/* =================================================================
   MANAGER.JS — Manager Dashboard Logic
   Firebase Auth, real-time booking data, QR scanning, serving controls
   ================================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot,
  collection, query, where, orderBy, getDocs, increment, Timestamp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

/* ─── CONFIG ──────────────────────────────────────────────── */
const firebaseConfig = {
  apiKey: "AIzaSyBim0-aBLbxB4Od-V6cCwEpOTwiZUO-nEE",
  authDomain: "mess-menu-bdba5.firebaseapp.com",
  projectId: "mess-menu-bdba5",
  storageBucket: "mess-menu-bdba5.firebasestorage.app",
  messagingSenderId: "141472583379",
  appId: "1:141472583379:web:b479d1ddfff8e82c4f4e26",
  measurementId: "G-82GSXH0SB9"
};
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

/* ─── STATE ───────────────────────────────────────────────── */
let todayConfig = null;
let allBookings = [];
let currentFilter = 'all';
let html5QrCode = null;
let scannedBookingDoc = null;

/* ─── HELPERS ─────────────────────────────────────────────── */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function showToast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function fmtTime(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

/* ─── DARK MODE ───────────────────────────────────────────── */
window.toggleDarkMode = function() {
  document.body.classList.toggle('dark-mode');
  const dm = document.body.classList.contains('dark-mode');
  localStorage.setItem('darkMode', dm ? '1' : '0');
  document.getElementById('darkModeToggle').textContent = dm ? '' : '';
};
if (localStorage.getItem('darkMode') === '1') {
  document.body.classList.add('dark-mode');
  document.getElementById('darkModeToggle').textContent = '';
}

/* ─── AUTH ─────────────────────────────────────────────────── */
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const pw = document.getElementById('loginPassword').value;
  const btn = document.getElementById('loginBtn');
  btn.disabled = true; btn.textContent = '⏳ Logging in…';
  try {
    await signInWithEmailAndPassword(auth, email, pw);
    showToast('Logged in!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Login failed: ' + err.message, 'error');
    btn.disabled = false; btn.textContent = ' Login';
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboardScreen').style.display = 'block';
    initDashboard();
  } else {
    document.getElementById('loginScreen').style.display = 'block';
    document.getElementById('dashboardScreen').style.display = 'none';
  }
});

window.logoutManager = function() {
  signOut(auth);
  showToast('Logged out', 'info');
};

/* ─── INIT DASHBOARD ──────────────────────────────────────── */
function initDashboard() {
  listenToConfig();
  listenToBookings();
}

/* ─── LISTEN: Today's config ──────────────────────────────── */
function listenToConfig() {
  const ref = doc(db, 'snack_configs', todayStr());
  onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      todayConfig = null;
      return;
    }
    todayConfig = snap.data();
    updateStatsUI();
    updateStatusChips();
    updatePrepSummary();
    updateCrowdUI();
    updateConfigForm();
  });
}

/* ─── LISTEN: Bookings ────────────────────────────────────── */
function listenToBookings() {
  const q = query(
    collection(db, 'snack_bookings'),
    where('date', '==', todayStr())
  );
  onSnapshot(q, (snap) => {
    allBookings = [];
    snap.forEach(d => allBookings.push({ docId: d.id, ...d.data() }));
    // Sort by createdAt desc
    allBookings.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || 0;
      const tb = b.createdAt?.toMillis?.() || 0;
      return tb - ta;
    });
    renderBookingsTable();
    renderPendingList();
    updateComputedStats();
  });
}

/* ─── UI UPDATES ──────────────────────────────────────────── */
function updateStatsUI() {
  if (!todayConfig) return;
  document.getElementById('statTotalBookings').textContent = todayConfig.totalBooked || 0;
  document.getElementById('statCollected').textContent = todayConfig.collected || 0;
  const remaining = (todayConfig.totalBooked || 0) - (todayConfig.collected || 0);
  document.getElementById('statRemaining').textContent = Math.max(0, remaining);
}

function updateComputedStats() {
  const paidBookings = allBookings.filter(b => b.paymentStatus === 'PAID');
  const totalAmount = paidBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
  document.getElementById('statTotalAmount').textContent = `₹${totalAmount}`;
}

function updateStatusChips() {
  if (!todayConfig) return;
  const bChip = document.getElementById('bookingStatusChip');
  const sChip = document.getElementById('servingStatusChip');

  if (todayConfig.bookingStatus === 'OPEN') {
    bChip.className = 'status-chip badge-open';
    bChip.textContent = ' BOOKING OPEN';
  } else {
    bChip.className = 'status-chip badge-closed';
    bChip.textContent = ' BOOKING CLOSED';
  }

  const ss = todayConfig.servingStatus || 'WAITING';
  const servingMap = {
    WAITING: { cls: 'badge-closed', txt: '⏳ WAITING' },
    IN_PROGRESS: { cls: 'badge-open', txt: ' SERVING LIVE' },
    PAUSED: { cls: 'badge-soldout', txt: '⏸ PAUSED' },
    STOPPED: { cls: 'badge-closed', txt: ' STOPPED' },
  };
  const s = servingMap[ss] || servingMap.WAITING;
  sChip.className = 'status-chip ' + s.cls;
  sChip.textContent = s.txt;
}

function updatePrepSummary() {
  const now = new Date();
  const showPrep = now.getHours() >= 16; // After 4 PM
  const el = document.getElementById('prepSummary');
  if (!showPrep || !todayConfig) { el.style.display = 'none'; return; }
  el.style.display = 'block';

  const confirmed = allBookings.filter(b => b.paymentStatus === 'PAID').length;
  const totalQty = allBookings.filter(b => b.paymentStatus === 'PAID').reduce((s, b) => s + (b.quantity || 1), 0);
  const suggested = Math.ceil(totalQty * 1.06); // 6% buffer

  document.getElementById('prepConfirmed').textContent = confirmed;
  document.getElementById('prepQty').textContent = totalQty;
  document.getElementById('prepSuggested').textContent = suggested;
  document.getElementById('prepExpected').textContent = confirmed;
}

function updateCrowdUI() {
  if (!todayConfig) return;
  const crowd = todayConfig.currentCrowd || 0;
  const expected = (todayConfig.totalBooked || 0) - (todayConfig.collected || 0);

  document.getElementById('crowdValue').textContent = crowd;
  document.getElementById('crowdExpected').textContent = todayConfig.totalBooked || 0;
  document.getElementById('crowdRemaining').textContent = Math.max(0, expected);

  const indicator = document.getElementById('crowdIndicator');
  if (crowd <= 15) {
    indicator.className = 'crowd-indicator crowd-low';
    indicator.innerHTML = '<span> LOW CROWD</span>';
  } else if (crowd <= 40) {
    indicator.className = 'crowd-indicator crowd-medium';
    indicator.innerHTML = '<span> MEDIUM CROWD</span>';
  } else {
    indicator.className = 'crowd-indicator crowd-high';
    indicator.innerHTML = '<span> HIGH CROWD</span>';
  }
}

function updateConfigForm() {
  if (!todayConfig) return;
  document.getElementById('cfgSnackName').value = todayConfig.snackName || '';
  document.getElementById('cfgPrice').value = todayConfig.price || '';
  document.getElementById('cfgMaxQty').value = todayConfig.maxQuantity || '';
  document.getElementById('cfgDeadline').value = todayConfig.bookingDeadline || '4:00 PM';
  document.getElementById('cfgServingTime').value = todayConfig.servingTime || '5:30 PM';
}

/* ─── TABS ────────────────────────────────────────────────── */
window.switchTab = function(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.manager-tab').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tab}`).style.display = 'block';
  document.querySelector(`.manager-tab[data-tab="${tab}"]`).classList.add('active');
};

/* ─── CROWD CONTROL ───────────────────────────────────────── */
window.updateCrowd = async function(delta) {
  if (!todayConfig) return;
  const newVal = Math.max(0, (todayConfig.currentCrowd || 0) + delta);
  try {
    await updateDoc(doc(db, 'snack_configs', todayStr()), { currentCrowd: newVal });
  } catch (err) {
    showToast('Failed to update crowd', 'error');
  }
};

/* ─── SERVING CONTROLS ────────────────────────────────────── */
window.setServing = async function(status) {
  try {
    await updateDoc(doc(db, 'snack_configs', todayStr()), { servingStatus: status });
    showToast(`Serving: ${status}`, 'success');
  } catch (err) {
    showToast('Failed to update serving status', 'error');
  }
};

/* ─── CONFIG FORM ─────────────────────────────────────────── */
document.getElementById('configForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    snackName: document.getElementById('cfgSnackName').value.trim(),
    price: parseInt(document.getElementById('cfgPrice').value) || 0,
    maxQuantity: parseInt(document.getElementById('cfgMaxQty').value) || 200,
    bookingDeadline: document.getElementById('cfgDeadline').value.trim(),
    servingTime: document.getElementById('cfgServingTime').value.trim(),
    bookingStatus: todayConfig?.bookingStatus || 'OPEN',
    servingStatus: todayConfig?.servingStatus || 'WAITING',
    totalBooked: todayConfig?.totalBooked || 0,
    collected: todayConfig?.collected || 0,
    currentCrowd: todayConfig?.currentCrowd || 0,
  };
  try {
    await setDoc(doc(db, 'snack_configs', todayStr()), data, { merge: true });
    showToast('Configuration saved!', 'success');
  } catch (err) {
    showToast('Failed to save config', 'error');
  }
});

window.toggleBookingStatus = async function(status) {
  try {
    await updateDoc(doc(db, 'snack_configs', todayStr()), { bookingStatus: status });
    showToast(`Booking ${status.toLowerCase()}`, 'success');
  } catch (err) {
    showToast('Failed to update', 'error');
  }
};

/* ─── PAYMENT VERIFICATION ────────────────────────────────── */
function renderPendingList() {
  const pending = allBookings.filter(b => b.paymentStatus === 'PENDING');
  const el = document.getElementById('pendingList');
  if (pending.length === 0) {
    el.innerHTML = '<div class="bookings-empty"> No pending verifications!</div>';
    return;
  }

  el.innerHTML = pending.map(b => `
    <div class="booking-item">
      <div class="booking-item-header">
        <span class="booking-id">${b.bookingId}</span>
        <span class="booking-date">${fmtTime(b.createdAt)}</span>
      </div>
      <div class="booking-item-body">
        <span class="bi-label">Student</span><span class="bi-value">${b.studentName}</span>
        <span class="bi-label">Roll</span><span class="bi-value">${b.rollNumber}</span>
        <span class="bi-label">Amount</span><span class="bi-value">₹${b.totalAmount}</span>
        <span class="bi-label">UTR</span><span class="bi-value" style="font-family:monospace; color:var(--accent);">${b.utrNumber || '—'}</span>
      </div>
      <div style="display:flex; gap:8px; margin-top:12px;">
        <button class="btn-success btn-full" onclick="verifyPayment('${b.docId}', true)" style="padding:10px;"> Approve</button>
        <button class="btn-danger btn-full" onclick="verifyPayment('${b.docId}', false)" style="padding:10px;"> Reject</button>
      </div>
    </div>
  `).join('');
}

window.verifyPayment = async function(docId, approve) {
  try {
    const newStatus = approve ? 'PAID' : 'FAILED';
    await updateDoc(doc(db, 'snack_bookings', docId), { paymentStatus: newStatus });

    if (approve) {
      // Increment totalBooked in config
      await updateDoc(doc(db, 'snack_configs', todayStr()), {
        totalBooked: increment(1)
      });
    }

    showToast(approve ? 'Payment approved ' : 'Payment rejected ', approve ? 'success' : 'warning');
  } catch (err) {
    console.error(err);
    showToast('Failed to verify payment', 'error');
  }
};

/* ─── BOOKINGS TABLE ──────────────────────────────────────── */
function renderBookingsTable() {
  const tbody = document.getElementById('bookingsTableBody');
  const filtered = getFilteredBookings();

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:20px; color:var(--text3);">No bookings found</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(b => {
    const paidClass = b.paymentStatus === 'PAID' ? 'status-paid' : 'status-pending';
    const collectClass = b.collectionStatus === 'COLLECTED' ? 'status-collected' : 'status-not-collected';
    return `
      <tr>
        <td style="font-family:monospace; font-weight:600; font-size:12px;">${b.bookingId}</td>
        <td>${b.studentName}</td>
        <td>${b.rollNumber}</td>
        <td>${b.hostel}</td>
        <td>${b.snack}</td>
        <td>${b.quantity}</td>
        <td>₹${b.totalAmount}</td>
        <td><span class="status-badge ${paidClass}">${b.paymentStatus === 'PAID' ? '' : '⏳'} ${b.paymentStatus}</span></td>
        <td><span class="status-badge ${collectClass}">${b.collectionStatus === 'COLLECTED' ? '' : ''} ${b.collectionStatus}</span></td>
        <td>${fmtTime(b.createdAt)}</td>
      </tr>
    `;
  }).join('');
}

function getFilteredBookings() {
  const search = (document.getElementById('searchInput')?.value || '').toLowerCase();
  return allBookings.filter(b => {
    // Filter
    if (currentFilter === 'paid' && b.paymentStatus !== 'PAID') return false;
    if (currentFilter === 'pending' && b.paymentStatus !== 'PENDING') return false;
    if (currentFilter === 'collected' && b.collectionStatus !== 'COLLECTED') return false;
    if (currentFilter === 'not_collected' && b.collectionStatus !== 'NOT_COLLECTED') return false;

    // Search
    if (search) {
      const hay = `${b.studentName} ${b.rollNumber} ${b.bookingId} ${b.hostel}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

window.filterBookings = function() { renderBookingsTable(); };

window.setFilter = function(f) {
  currentFilter = f;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  document.querySelector(`.filter-chip[data-filter="${f}"]`).classList.add('active');
  renderBookingsTable();
};

/* ─── QR SCANNER ──────────────────────────────────────────── */
window.startScanner = function() {
  const reader = document.getElementById('qr-reader');
  reader.innerHTML = '';
  html5QrCode = new Html5Qrcode("qr-reader");

  html5QrCode.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    (decodedText) => {
      handleScanResult(decodedText);
      stopScanner();
    },
    () => {}
  ).then(() => {
    document.getElementById('startScanBtn').style.display = 'none';
    document.getElementById('stopScanBtn').style.display = 'block';
  }).catch(err => {
    showToast('Camera error: ' + err, 'error');
  });
};

window.stopScanner = function() {
  if (html5QrCode) {
    html5QrCode.stop().catch(() => {});
    html5QrCode = null;
  }
  document.getElementById('startScanBtn').style.display = 'block';
  document.getElementById('stopScanBtn').style.display = 'none';
};

window.manualLookup = function() {
  const val = document.getElementById('manualBookingId').value.trim();
  if (!val) { showToast('Enter a booking ID', 'warning'); return; }
  // Search allBookings for it
  const found = allBookings.find(b =>
    b.bookingId === val || b.docId === val || b.rollNumber === val.toUpperCase()
  );
  if (found) {
    displayScanResult(found);
  } else {
    showToast('Booking not found', 'error');
  }
};

async function handleScanResult(text) {
  try {
    const data = JSON.parse(text);
    // Expected: { id, roll, date }
    const dId = `${data.roll}_${data.date}`;
    const snap = await getDoc(doc(db, 'snack_bookings', dId));
    if (!snap.exists()) {
      showScanError(' Booking not found in database.');
      return;
    }
    displayScanResult({ docId: snap.id, ...snap.data() });
  } catch (e) {
    // Try as plain booking ID
    const found = allBookings.find(b => b.bookingId === text);
    if (found) {
      displayScanResult(found);
    } else {
      showScanError(' Invalid QR code.');
    }
  }
}

function displayScanResult(booking) {
  scannedBookingDoc = booking;
  const el = document.getElementById('scanResult');
  const content = document.getElementById('scanResultContent');
  const giveBtn = document.getElementById('giveSnackBtn');
  const errorEl = document.getElementById('scanError');

  el.style.display = 'block';
  errorEl.style.display = 'none';

  // Check for already collected
  if (booking.collectionStatus === 'COLLECTED') {
    content.innerHTML = `
      <div class="sr-row"><span class="sr-label">Student</span><span class="sr-value">${booking.studentName}</span></div>
      <div class="sr-row"><span class="sr-label">Roll</span><span class="sr-value">${booking.rollNumber}</span></div>
    `;
    giveBtn.style.display = 'none';
    errorEl.style.display = 'block';
    errorEl.innerHTML = `<div style="font-size:36px; margin-bottom:8px;"></div>ALREADY COLLECTED<br><span style="font-size:13px; font-weight:400; color:var(--text3);">This booking has already been redeemed.</span>`;
    return;
  }

  // Check for unpaid
  if (booking.paymentStatus !== 'PAID') {
    content.innerHTML = `
      <div class="sr-row"><span class="sr-label">Student</span><span class="sr-value">${booking.studentName}</span></div>
      <div class="sr-row"><span class="sr-label">Payment</span><span class="sr-value" style="color:var(--red);"> NOT PAID</span></div>
    `;
    giveBtn.style.display = 'none';
    errorEl.style.display = 'block';
    errorEl.innerHTML = `<div style="font-size:36px; margin-bottom:8px;"></div>PAYMENT NOT VERIFIED<br><span style="font-size:13px; font-weight:400;">Verify the payment first before giving the snack.</span>`;
    return;
  }

  // Valid booking
  content.innerHTML = `
    <div class="sr-row"><span class="sr-label">Student</span><span class="sr-value">${booking.studentName}</span></div>
    <div class="sr-row"><span class="sr-label">Roll</span><span class="sr-value">${booking.rollNumber}</span></div>
    <div class="sr-row"><span class="sr-label">Hostel</span><span class="sr-value">${booking.hostel}</span></div>
    <div class="sr-row"><span class="sr-label">Snack</span><span class="sr-value">${booking.snack}</span></div>
    <div class="sr-row"><span class="sr-label">Quantity</span><span class="sr-value">${booking.quantity}</span></div>
    <div class="sr-row"><span class="sr-label">Payment</span><span class="sr-value" style="color:var(--green);"> PAID</span></div>
    <div class="sr-row"><span class="sr-label">Booking</span><span class="sr-value" style="color:var(--green);"> VALID</span></div>
    <div class="sr-row"><span class="sr-label">Collection</span><span class="sr-value">NOT COLLECTED</span></div>
  `;
  giveBtn.style.display = 'block';
}

function showScanError(msg) {
  const el = document.getElementById('scanResult');
  const content = document.getElementById('scanResultContent');
  const giveBtn = document.getElementById('giveSnackBtn');
  const errorEl = document.getElementById('scanError');
  el.style.display = 'block';
  content.innerHTML = '';
  giveBtn.style.display = 'none';
  errorEl.style.display = 'block';
  errorEl.textContent = msg;
}

window.giveSnack = async function() {
  if (!scannedBookingDoc) return;
  try {
    await updateDoc(doc(db, 'snack_bookings', scannedBookingDoc.docId), {
      collectionStatus: 'COLLECTED'
    });
    await updateDoc(doc(db, 'snack_configs', todayStr()), {
      collected: increment(1)
    });

    showToast('Snack given! ', 'success');

    // Update the scan result UI
    const giveBtn = document.getElementById('giveSnackBtn');
    giveBtn.style.display = 'none';
    const errorEl = document.getElementById('scanError');
    errorEl.style.display = 'block';
    errorEl.innerHTML = `<div style="font-size:36px; margin-bottom:8px;"></div><span style="color:var(--green);">COLLECTED</span><br><span style="font-size:13px; font-weight:400; color:var(--text3);">Snack has been given to ${scannedBookingDoc.studentName}.</span>`;

    scannedBookingDoc = null;
  } catch (err) {
    showToast('Failed to mark as collected', 'error');
  }
};
