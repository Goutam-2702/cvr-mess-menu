/* =================================================================
   SNACK.JS — Student 🍪 Snack Booking Dashboard
   Firebase real-time listeners, booking flow, QR generation
   ================================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot,
  collection, query, where, getDocs, Timestamp
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
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

/* ─── STATE ───────────────────────────────────────────────── */
let todayConfig = null;
let currentBooking = null;
let quantity = 1;
const MAX_QTY = 5;

const UPI_ID = "Q225863582@ybl";  // Change to actual UPI ID

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

function isBeforeDeadline(deadlineStr) {
  if (!deadlineStr) return false;
  const now = new Date();
  const [h, m] = deadlineStr.replace(/\s*(AM|PM)/i, ' $1').trim().split(/[:\s]+/);
  let hour = parseInt(h);
  const min = parseInt(m) || 0;
  const ampm = deadlineStr.toUpperCase().includes('PM') ? 'PM' : 'AM';
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  const deadline = new Date(now);
  deadline.setHours(hour, min, 0, 0);
  return now < deadline;
}

function generateBookingId(roll) {
  const d = todayStr().replace(/-/g, '');
  const r = roll.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-4);
  return `SNK-${d}-${r}`;
}

function docId(roll) {
  return `${roll.toUpperCase().replace(/[^A-Z0-9]/g, '')}_${todayStr()}`;
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

/* ─── INIT ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  listenToTodayConfig();
  setupFormHandlers();
  setupNotifications();
  tryLoadSavedProfile();
});

/* ─── LISTEN: Today's snack config ────────────────────────── */
function listenToTodayConfig() {
  const ref = doc(db, 'snack_configs', todayStr());
  onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      renderNoSnack();
      return;
    }
    todayConfig = snap.data();
    renderTodaySnack(todayConfig);
    updateServingBanner(todayConfig);
    // Check if student already has a booking today
    const savedRoll = localStorage.getItem('snack_roll');
    if (savedRoll) {
      listenToMyBooking(savedRoll);
    }
  });
}

function renderNoSnack() {
  document.getElementById('todaySnackCard').innerHTML = `
    <div class="snack-card-content" style="text-align:center; padding:40px 20px;">
      <div style="font-size:48px; margin-bottom:12px;"></div>
      <h2 style="margin-bottom:8px;">No Snack Today</h2>
      <p style="color:var(--text2); font-size:14px;">The manager hasn't set up today's snack yet. Check back later!</p>
    </div>
  `;
}

function renderTodaySnack(cfg) {
  const open = cfg.bookingStatus === 'OPEN';
  const soldOut = cfg.totalBooked >= cfg.maxQuantity;
  const beforeDeadline = isBeforeDeadline(cfg.bookingDeadline || '4:00 PM');
  const canBook = open && !soldOut && beforeDeadline;

  const pct = cfg.maxQuantity > 0 ? Math.round((cfg.totalBooked / cfg.maxQuantity) * 100) : 0;
  const barClass = pct >= 90 ? 'full' : pct >= 70 ? 'warn' : '';

  let badgeHtml = '';
  if (soldOut) {
    badgeHtml = `<span class="booking-status-badge badge-soldout"> 🔴 SOLD OUT</span>`;
  } else if (!open || !beforeDeadline) {
    badgeHtml = `<span class="booking-status-badge badge-closed"> 🔒 Booking Closed</span>`;
  } else {
    badgeHtml = `<span class="booking-status-badge badge-open"> 🟢 Booking Open</span>`;
  }

  document.getElementById('todaySnackCard').innerHTML = `
    <div class="snack-card-content">
      <div class="snack-emoji"></div>
      <div class="snack-name">${cfg.snackName || 'Snack'}</div>
      ${badgeHtml}

      <div class="snack-meta">
        <div class="meta-item">
          <div class="label">Price</div>
          <div class="value price">₹${cfg.price || 0}</div>
        </div>
        <div class="meta-item">
          <div class="label">Booking Closes</div>
          <div class="value">${cfg.bookingDeadline || '4:00 PM'}</div>
        </div>
        <div class="meta-item">
          <div class="label">Serving Time</div>
          <div class="value">${cfg.servingTime || '5:30 PM'}</div>
        </div>
        <div class="meta-item">
          <div class="label">Availability</div>
          <div class="value">${cfg.totalBooked}/${cfg.maxQuantity}</div>
        </div>
      </div>

      <div class="capacity-bar">
        <div class="capacity-bar-fill ${barClass}" style="width:${pct}%"></div>
      </div>
      <div class="capacity-text">${cfg.maxQuantity - cfg.totalBooked} slots remaining</div>

      ${canBook ? `<button class="btn-primary btn-full" style="margin-top:16px;" onclick="startBooking()"> 🍪 Book Now</button>` : ''}
      ${!beforeDeadline && !soldOut ? `<p style="color:var(--text2); font-size:14px; margin-top:16px; text-align:center;">Today's snack booking is closed. ☕ Snacks will be served at ${cfg.servingTime || '5:30 PM'}.</p>` : ''}
    </div>
  `;
}

function updateServingBanner(cfg) {
  const banner = document.getElementById('servingBanner');
  const text = document.getElementById('servingBannerText');
  if (cfg.servingStatus === 'PAUSED') {
    banner.style.display = 'block';
    text.textContent = '⏸ Snack distribution temporarily paused due to crowd.';
  } else if (cfg.servingStatus === 'STOPPED') {
    banner.style.display = 'block';
    text.textContent = ' Snack distribution has ended for today.';
  } else {
    banner.style.display = 'none';
  }
}

/* ─── NOTIFICATIONS ───────────────────────────────────────── */
function setupNotifications() {
  const banner = document.getElementById('notifBanner');
  const text = document.getElementById('notifBannerText');
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();

  if (h < 16) {
    banner.style.display = 'flex';
    text.textContent = ' Snack booking closes at 4:00 PM. Book now!';
  } else if (h === 16 && m < 5) {
    banner.style.display = 'flex';
    text.textContent = ' Snack booking is now closed.';
  } else if (h >= 17 && h < 18) {
    banner.style.display = 'flex';
    text.textContent = ' Your booked snack is ready. Collection starts at 5:30 PM.';
  }
}

/* ─── PROFILE PRE-FILL ───────────────────────────────────── */
function tryLoadSavedProfile() {
  // Try loading from the main site's profile
  try {
    const p = JSON.parse(localStorage.getItem('messProfile') || 'null');
    if (p) {
      if (p.name) document.getElementById('studentName').value = p.name;
      if (p.rollNumber) document.getElementById('rollNumber').value = p.rollNumber;
      if (p.email) document.getElementById('studentEmail').value = p.email;
      if (p.hostel) {
        const h = p.hostel.toLowerCase().includes('aryabhatt') ? 'Aryabhatt' : 'C V Raman';
        document.getElementById('studentHostel').value = h;
      }
    }
  } catch(e) { /* ignore */ }

  // Also try saved snack profile
  const name = localStorage.getItem('snack_name');
  const roll = localStorage.getItem('snack_roll');
  const email = localStorage.getItem('snack_email');
  const hostel = localStorage.getItem('snack_hostel');
  if (name) document.getElementById('studentName').value = name;
  if (roll) document.getElementById('rollNumber').value = roll;
  if (email) document.getElementById('studentEmail').value = email;
  if (hostel) document.getElementById('studentHostel').value = hostel;
}

function saveProfile() {
  localStorage.setItem('snack_name', document.getElementById('studentName').value.trim());
  localStorage.setItem('snack_roll', document.getElementById('rollNumber').value.trim().toUpperCase());
  localStorage.setItem('snack_email', document.getElementById('studentEmail').value.trim());
  localStorage.setItem('snack_hostel', document.getElementById('studentHostel').value);
}

/* ─── BOOKING FLOW ────────────────────────────────────────── */
window.startBooking = function() {
  if (!todayConfig) return;
  document.getElementById('todaySnackCard').style.display = 'none';
  document.getElementById('bookingFormSection').style.display = 'block';
  document.getElementById('summarySnackName').textContent = todayConfig.snackName;
  quantity = 1;
  updateQty();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

function updateQty() {
  document.getElementById('qtyValue').textContent = quantity;
  document.getElementById('summaryTotal').textContent = `₹${quantity * (todayConfig?.price || 0)}`;
  document.getElementById('qtyMinus').disabled = quantity <= 1;
  document.getElementById('qtyPlus').disabled = quantity >= MAX_QTY;
}

function setupFormHandlers() {
  document.getElementById('qtyMinus').addEventListener('click', () => {
    if (quantity > 1) { quantity--; updateQty(); }
  });
  document.getElementById('qtyPlus').addEventListener('click', () => {
    if (quantity < MAX_QTY) { quantity++; updateQty(); }
  });

  document.getElementById('bookingForm').addEventListener('submit', (e) => {
    e.preventDefault();
    proceedToPayment();
  });
}

function proceedToPayment() {
  if (!todayConfig) return;

  // Validate
  const name = document.getElementById('studentName').value.trim();
  const roll = document.getElementById('rollNumber').value.trim().toUpperCase();
  const email = document.getElementById('studentEmail').value.trim();
  const hostel = document.getElementById('studentHostel').value;

  if (!name || !roll || !email || !hostel) {
    showToast('Please fill all fields', 'error');
    return;
  }

  // Re-check deadline
  if (!isBeforeDeadline(todayConfig.bookingDeadline || '4:00 PM')) {
    showToast('Booking deadline has passed (4:00 PM)', 'error');
    return;
  }

  // Check capacity
  if (todayConfig.totalBooked >= todayConfig.maxQuantity) {
    showToast('Snack is sold out!', 'error');
    return;
  }

  saveProfile();

  // Show payment section
  const total = quantity * todayConfig.price;
  document.getElementById('bookingFormSection').style.display = 'none';
  document.getElementById('paymentSection').style.display = 'block';
  document.getElementById('paymentAmount').textContent = `₹${total}`;
  document.getElementById('upiIdDisplay').textContent = UPI_ID;

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.copyUpiId = function() {
  navigator.clipboard.writeText(UPI_ID).then(() => showToast('UPI ID copied!', 'success'));
};

window.cancelPayment = function() {
  document.getElementById('paymentSection').style.display = 'none';
  document.getElementById('bookingFormSection').style.display = 'block';
};

window.submitPayment = async function() {
  const utr = document.getElementById('utrInput').value.trim();
  if (!utr || utr.length < 6) {
    showToast('Please enter a valid UTR/Transaction ID', 'error');
    return;
  }

  const btn = document.getElementById('submitPaymentBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Submitting…';

  const name = document.getElementById('studentName').value.trim();
  const roll = document.getElementById('rollNumber').value.trim().toUpperCase();
  const email = document.getElementById('studentEmail').value.trim();
  const hostel = document.getElementById('studentHostel').value;
  const total = quantity * todayConfig.price;
  const bookingId = generateBookingId(roll);
  const dId = docId(roll);

  try {
    // Check if booking already exists
    const existingDoc = await getDoc(doc(db, 'snack_bookings', dId));
    if (existingDoc.exists()) {
      showToast('You already have a booking for today!', 'error');
      btn.disabled = false;
      btn.textContent = ' ✅ Submit Payment';
      // Show their existing booking
      currentBooking = existingDoc.data();
      showConfirmation(currentBooking);
      return;
    }

    // Re-check deadline
    if (!isBeforeDeadline(todayConfig.bookingDeadline || '4:00 PM')) {
      showToast('Booking deadline has passed!', 'error');
      btn.disabled = false;
      btn.textContent = ' ✅ Submit Payment';
      return;
    }

    // Create booking doc with PENDING status
    const bookingData = {
      bookingId,
      studentName: name,
      rollNumber: roll,
      email,
      hostel,
      snack: todayConfig.snackName,
      quantity,
      totalAmount: total,
      utrNumber: utr,
      paymentStatus: 'PENDING',
      collectionStatus: 'NOT_COLLECTED',
      createdAt: Timestamp.now(),
      date: todayStr()
    };

    await setDoc(doc(db, 'snack_bookings', dId), bookingData);
    currentBooking = bookingData;

    showToast('Booking submitted! Awaiting manager verification.', 'success');
    showConfirmation(bookingData);

    // Start listening for payment status updates
    listenToMyBooking(roll);

  } catch (err) {
    console.error('Booking error:', err);
    showToast('Failed to create booking. Please try again.', 'error');
    btn.disabled = false;
    btn.textContent = ' ✅ Submit Payment';
  }
};

/* ─── CONFIRMATION ────────────────────────────────────────── */
function showConfirmation(booking) {
  hideAllSections();
  document.getElementById('confirmationSection').style.display = 'block';

  const isPaid = booking.paymentStatus === 'PAID';
  const icon = isPaid ? '' : '⏳';
  const title = isPaid ? 'Booking Confirmed!' : 'Booking Submitted!';
  const sub = isPaid
    ? 'Your payment has been verified. Show the QR code at the counter.'
    : 'Your payment is being verified by the manager. You\'ll see your QR code once approved.';

  document.querySelector('.confirm-icon').textContent = icon;
  document.querySelector('.confirmation-card h2').textContent = title;
  document.getElementById('confirmStatusText').textContent = sub;

  document.getElementById('confirmDetails').innerHTML = `
    <div class="confirm-row"><span>Snack</span><span>${booking.snack}</span></div>
    <div class="confirm-row"><span>Quantity</span><span>${booking.quantity}</span></div>
    <div class="confirm-row"><span>Amount</span><span>₹${booking.totalAmount}</span></div>
    <div class="confirm-row"><span>Booking ID</span><span>${booking.bookingId}</span></div>
    <div class="confirm-row"><span>Pickup Time</span><span>${todayConfig?.servingTime || '5:30 PM'}</span></div>
    <div class="confirm-row"><span>Hostel</span><span>${booking.hostel}</span></div>
    <div class="confirm-row"><span>Payment</span><span>${isPaid ? ' Verified' : '⏳ Pending'}</span></div>
    <div class="confirm-row"><span>Collection</span><span>${booking.collectionStatus === 'COLLECTED' ? ' Collected' : 'Not Collected'}</span></div>
  `;

  const qrBox = document.getElementById('confirmQrBox');
  const qrCode = document.getElementById('confirmQrCode');
  if (isPaid) {
    qrBox.style.display = 'inline-block';
    qrCode.innerHTML = '';
    const qrData = JSON.stringify({
      id: booking.bookingId,
      roll: booking.rollNumber,
      date: todayStr()
    });
    if (typeof QRCode !== 'undefined') {
      new QRCode(qrCode, {
        text: qrData,
        width: 180,
        height: 180,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.M
      });
    }
  } else {
    qrBox.style.display = 'none';
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ─── LISTEN: My booking status ───────────────────────────── */
function listenToMyBooking(roll) {
  const dId = docId(roll);
  onSnapshot(doc(db, 'snack_bookings', dId), (snap) => {
    if (!snap.exists()) return;
    currentBooking = snap.data();
    // If we're on the confirmation screen, update it
    if (document.getElementById('confirmationSection').style.display !== 'none') {
      showConfirmation(currentBooking);
    }
  });
}

/* ─── MY BOOKINGS ─────────────────────────────────────────── */
window.goToMyBookings = async function() {
  hideAllSections();
  document.getElementById('myBookingsSection').style.display = 'block';
  setActiveNav('navBookings');

  const roll = localStorage.getItem('snack_roll');
  
  if (!roll) {
    document.getElementById('myBookingsList').innerHTML = '<div class="bookings-empty">No active bookings found on this device.</div>';
    return;
  }

  document.getElementById('myBookingsList').innerHTML = '<div class="bookings-empty">Loading bookings...</div>';

  try {
    const q = query(
      collection(db, 'snack_bookings'),
      where('rollNumber', '==', roll.toUpperCase())
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      document.getElementById('myBookingsList').innerHTML = '<div class="bookings-empty">No bookings found.</div>';
      return;
    }

    // Collect and sort client-side (avoids composite index requirement)
    const bookings = [];
    snap.forEach(d => bookings.push(d.data()));
    bookings.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || 0;
      const tb = b.createdAt?.toMillis?.() || 0;
      return tb - ta;
    });

    let html = '';
    bookings.forEach(b => {
      const isPaid = b.paymentStatus === 'PAID';
      const isCollected = b.collectionStatus === 'COLLECTED';
      const isToday = b.date === todayStr();

      html += `
        <div class="booking-item">
          <div class="booking-item-header">
            <span class="booking-id">${b.bookingId}</span>
            <span class="booking-date">${isToday ? ' Today' : b.date}</span>
          </div>
          <div class="booking-item-body">
            <span class="bi-label">Snack</span><span class="bi-value">${b.snack}</span>
            <span class="bi-label">Qty</span><span class="bi-value">${b.quantity}</span>
            <span class="bi-label">Amount</span><span class="bi-value">₹${b.totalAmount}</span>
            <span class="bi-label">Hostel</span><span class="bi-value">${b.hostel}</span>
          </div>
          <div class="booking-item-footer">
            <div>
              <span class="status-badge ${isPaid ? 'status-paid' : 'status-pending'}">${isPaid ? ' PAID' : '⏳ PENDING'}</span>
              <span class="status-badge ${isCollected ? 'status-collected' : 'status-not-collected'}">${isCollected ? ' COLLECTED' : ' NOT COLLECTED'}</span>
            </div>
            ${isPaid && !isCollected && isToday ? `<button class="show-qr-btn" onclick="showQrModal('${b.bookingId}','${b.rollNumber}')"> 📱 Show QR</button>` : ''}
          </div>
        </div>
      `;
    });

    document.getElementById('myBookingsList').innerHTML = html;
  } catch (err) {
    console.error('Fetch bookings error:', err);
    document.getElementById('myBookingsList').innerHTML = '<div class="bookings-empty">Failed to load bookings. Check console for index setup.</div>';
  }
};

window.showQrModal = function(bookingId, roll) {
  const modal = document.getElementById('qrModal');
  modal.style.display = 'flex';
  document.getElementById('qrModalId').textContent = bookingId;
  const content = document.getElementById('qrModalContent');
  content.innerHTML = '';
  const qrData = JSON.stringify({ id: bookingId, roll, date: todayStr() });
  if (typeof QRCode !== 'undefined') {
    new QRCode(content, {
      text: qrData,
      width: 220,
      height: 220,
      colorDark : "#003366",
      colorLight : "#ffffff",
      correctLevel : QRCode.CorrectLevel.H
    });
  }
};

window.closeQrModal = function() {
  document.getElementById('qrModal').style.display = 'none';
};

/* ─── NAV HELPERS ─────────────────────────────────────────── */
window.showTodaySnack = function() {
  hideAllSections();
  document.getElementById('todaySnackCard').style.display = 'block';
  if (todayConfig) renderTodaySnack(todayConfig);
  setActiveNav('navToday');
};

function hideAllSections() {
  document.getElementById('todaySnackCard').style.display = 'none';
  document.getElementById('bookingFormSection').style.display = 'none';
  document.getElementById('paymentSection').style.display = 'none';
  document.getElementById('confirmationSection').style.display = 'none';
  document.getElementById('myBookingsSection').style.display = 'none';
}

function setActiveNav(id) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}
