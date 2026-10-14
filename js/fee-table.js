// =============================================================
// FEE TABLE MODAL — Bảng phí dịch vụ
// - 2 mode: Bảng đầy đủ / Tra cứu
// - 3 type: Giao / Lấy / Hoàn
// - Slider nonlinear + adjust buttons (auto-repeat có global catch)
// - Search + highlight + sticky table
// =============================================================

import { TABLE_4_DATA, TABLE_5_DATA, TABLE_6_DATA, WEIGHT_LABELS } from './config.js';
import { _fmt } from './utils.js';
import { showToast } from './ui.js';

// ==================== STATE ====================
let feeMode  = 'table';       // 'table' | 'calc'
let feeType  = 'del';         // 'del' | 'pick' | 'ret'
let feeValue = 0;             // số đơn (mode calc)
let searchValue = '';

const LS_KEYS = {
  mode:  'spx_fee_modal_mode',
  type:  'spx_fee_modal_type',
  value: 'spx_fee_modal_value'
};

// ==================== CONSTANTS ====================
const TYPE_LABELS = {
  del:  'Giao',
  pick: 'Lấy',
  ret:  'Hoàn'
};

// Max slider theo type — như mockup
const TYPE_MAX = {
  del:  50000,
  pick: 100000,
  ret:  100000
};

// Slider chia 4 đoạn, mỗi đoạn 250 pos (tổng 1000 pos)
const SLIDER_POS_MAX = 1000;
const SEGMENT = 250;

// ==================== HELPERS ====================
function getTableData(type) {
  if (type === 'del')  return TABLE_5_DATA;
  if (type === 'pick') return TABLE_4_DATA;
  return TABLE_6_DATA;
}

// Dải thứ tự cố định
const RANGE_KEYS = ['0_2', '2_4', '4_6', '6_8', '8_10', '10_12', '12_15', 'over_15'];

// Format số cho display (VD 1500 → "1.500" theo vi-VN)
function formatNum(n) {
  return _fmt(Math.max(0, Math.floor(Number(n) || 0)));
}

// Clamp value vào [1, maxType]. Nếu <= 0 → trả 0
function clampValue(v, type) {
  const num = Math.floor(Number(v) || 0);
  if (num <= 0) return 0;
  const max = TYPE_MAX[type] || 50000;
  return Math.min(num, max);
}

// ==================== SLIDER NONLINEAR ====================
// posToValue: nhận pos 0-1000 → trả value (đã round theo step của đoạn)
function posToValue(pos, type) {
  const p = Math.max(0, Math.min(SLIDER_POS_MAX, Number(pos) || 0));
  const max = TYPE_MAX[type] || 50000;

  let raw;
  let step;

  if (p < SEGMENT) {
    // Đoạn 1: 1 → 100, step 1
    raw = 1 + (p / SEGMENT) * 99;
    step = 1;
  } else if (p < SEGMENT * 2) {
    // Đoạn 2: 100 → 1000, step 10
    raw = 100 + ((p - SEGMENT) / SEGMENT) * 900;
    step = 10;
  } else if (p < SEGMENT * 3) {
    // Đoạn 3: 1000 → 10000, step 100
    raw = 1000 + ((p - SEGMENT * 2) / SEGMENT) * 9000;
    step = 100;
  } else {
    // Đoạn 4: 10000 → max, step 1000
    raw = 10000 + ((p - SEGMENT * 3) / SEGMENT) * (max - 10000);
    step = 1000;
  }

  const rounded = Math.round(raw / step) * step;
  return clampValue(rounded, type);
}

// valueToPos: ngược lại — value → pos 0-1000
function valueToPos(value, type) {
  const v = clampValue(value, type);
  if (v <= 0) return 0;
  const max = TYPE_MAX[type] || 50000;

  if (v < 100) {
    return ((v - 1) / 99) * SEGMENT;
  } else if (v < 1000) {
    return SEGMENT + ((v - 100) / 900) * SEGMENT;
  } else if (v < 10000) {
    return SEGMENT * 2 + ((v - 1000) / 9000) * SEGMENT;
  } else {
    return SEGMENT * 3 + ((v - 10000) / (max - 10000)) * SEGMENT;
  }
}

// ==================== PERSIST ====================
function loadFeeState() {
  try {
    const m = localStorage.getItem(LS_KEYS.mode);
    if (m === 'table' || m === 'calc') feeMode = m;

    const t = localStorage.getItem(LS_KEYS.type);
    if (t === 'del' || t === 'pick' || t === 'ret') feeType = t;

    const v = parseInt(localStorage.getItem(LS_KEYS.value) || '0', 10);
    feeValue = Number.isFinite(v) && v > 0 ? v : 0;
    feeValue = clampValue(feeValue, feeType);
  } catch {}
}

function persistFeeState() {
  try {
    localStorage.setItem(LS_KEYS.mode, feeMode);
    localStorage.setItem(LS_KEYS.type, feeType);
    localStorage.setItem(LS_KEYS.value, String(feeValue));
  } catch {}
}

// ==================== UI SYNC ====================
function syncModeUI() {
  document.querySelectorAll('.fee-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === feeMode);
  });

  const panelTable = document.getElementById('feePanelTable');
  const panelCalc  = document.getElementById('feePanelCalc');
  if (panelTable) panelTable.hidden = feeMode !== 'table';
  if (panelCalc)  panelCalc.hidden  = feeMode !== 'calc';
}

function syncTypeUI() {
  document.querySelectorAll('.fee-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === feeType);
  });
}

function syncCalcUI() {
  const displayInput = document.getElementById('feeCalcDisplay');
  const adjInput     = document.getElementById('feeAdjInput');
  const slider       = document.getElementById('feeSlider');
  const tickMax      = document.getElementById('feeTickMax');

  // Display + adj input — cả 2 sync cùng value
  if (displayInput && document.activeElement !== displayInput) {
    displayInput.value = feeValue > 0 ? formatNum(feeValue) : '0';
  }
  if (adjInput && document.activeElement !== adjInput) {
    adjInput.value = feeValue > 0 ? String(feeValue) : '0';
  }

  // Slider position
  if (slider) {
    const pos = feeValue > 0 ? valueToPos(feeValue, feeType) : 0;
    slider.value = String(Math.round(pos));
  }

  // Tick max label theo type
  if (tickMax) {
    tickMax.textContent = feeType === 'del' ? '50k' : '100k';
  }
}

// ==================== TABLE RENDER ====================
function renderTable() {
  const thead = document.getElementById('feeTableHead');
  const tbody = document.getElementById('feeTableBody');
  if (!thead || !tbody) return;

  const data = getTableData(feeType);

  // Header
  let headHtml = '<tr><th>Số đơn</th>';
  for (let i = 0; i < 8; i++) {
    headHtml += `<th>${WEIGHT_LABELS[i].replace('>', '').replace(' kg', '')}</th>`;
  }
  headHtml += '</tr>';
  thead.innerHTML = headHtml;

  // Body
  let bodyHtml = '';
  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    bodyHtml += `<tr data-min="${row.min}" data-max="${row.max}">`;
    bodyHtml += `<td>${row.range}</td>`;
    for (let c = 0; c < 8; c++) {
      const pts = row.pts[c] || 0;
      bodyHtml += `<td>${formatNum(pts)}</td>`;
    }
    bodyHtml += '</tr>';
  }
  tbody.innerHTML = bodyHtml;
}

// ==================== CALC RESULT RENDER ====================
function renderCalcResult() {
  const resultEl = document.getElementById('feeResult');
  const emptyEl  = document.getElementById('feeEmpty');
  if (!resultEl || !emptyEl) return;

  if (feeValue <= 0) {
    resultEl.classList.remove('fee-result-show');
    resultEl.innerHTML = '';
    emptyEl.classList.add('fee-empty-show');
    return;
  }

  emptyEl.classList.remove('fee-empty-show');
  resultEl.classList.add('fee-result-show');

  const data = getTableData(feeType);

  // Tìm row chứa feeValue (fallback row cuối nếu vượt max)
  let rowData = data[data.length - 1];
  for (const row of data) {
    if (feeValue >= row.min && feeValue < row.max) {
      rowData = row;
      break;
    }
  }

  const typeLabel = TYPE_LABELS[feeType] || '';

  let html = `<div class="fee-result-head">Kết quả — <b>${typeLabel} · ${formatNum(feeValue)} đơn</b></div>`;

  let total = 0;
  for (let c = 0; c < 8; c++) {
    const pts = rowData.pts[c] || 0;
    total += pts;
    html += `<div class="fee-result-row">
      <span class="fee-result-lbl">${WEIGHT_LABELS[c]}</span>
      <span class="fee-result-val">${formatNum(pts)}</span>
    </div>`;
  }

  html += `<div class="fee-result-total">
    <span class="fee-result-total-lbl">TỔNG (8 dải)</span>
    <span class="fee-result-total-val">${formatNum(total)}</span>
  </div>`;

  resultEl.innerHTML = html;
}

// ==================== SEARCH — MODE TABLE ====================
function applySearch(rawValue) {
  const input = document.getElementById('feeSearchInput');
  const clearBtn = document.getElementById('feeSearchClear');

  // Loại ký tự không phải số
  const digitsOnly = String(rawValue || '').replace(/[^\d]/g, '');

  // Nếu user gõ chữ (không phải số)
  if (rawValue && !digitsOnly && String(rawValue).trim() !== '') {
    if (input) input.value = '';
    if (clearBtn) clearBtn.hidden = true;
    searchValue = '';
    highlightRow(null);
    showToast('⚠️ Vui lòng nhập số', 'warning', 2000);
    return;
  }

  // Sync input value về chỉ số
  if (input && input.value !== digitsOnly) input.value = digitsOnly;
  if (clearBtn) clearBtn.hidden = !digitsOnly;
  searchValue = digitsOnly;

  if (!digitsOnly) {
    highlightRow(null);
    return;
  }

  const num = parseInt(digitsOnly, 10);
  if (!Number.isFinite(num) || num <= 0) {
    highlightRow(null);
    showToast('⚠️ Số đơn phải ≥ 1', 'warning', 2000);
    return;
  }

  const data = getTableData(feeType);
  const maxRow = data[data.length - 1];
  const highestMin = maxRow.min;

  // Nếu max của row cuối là Infinity → mọi num >= min đều thuộc row cuối
  if (num >= highestMin && !Number.isFinite(maxRow.max)) {
    highlightRow(num, true);
    return;
  }

  // Nếu num vượt max của row cuối (max hữu hạn)
  if (Number.isFinite(maxRow.max) && num >= maxRow.max) {
    highlightRow(null);
    showToast(`⚠️ Số ${formatNum(num)} vượt dải cao nhất (tối đa ${formatNum(maxRow.max - 1)})`, 'warning', 3000);
    return;
  }

  // Tìm row match
  let matchIdx = -1;
  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    if (num >= row.min && num < row.max) {
      matchIdx = r;
      break;
    }
  }

  if (matchIdx === -1) {
    highlightRow(null);
    showToast(`⚠️ Số ${formatNum(num)} không nằm trong dải nào`, 'warning', 3000);
    return;
  }

  highlightRow(num, false, matchIdx);
}

function highlightRow(num, isTopRow, matchIdx) {
  const tbody = document.getElementById('feeTableBody');
  const scrollWrap = document.getElementById('feeTableScroll');
  if (!tbody) return;

  // Xóa highlight cũ
  tbody.querySelectorAll('.fee-row-match').forEach(tr => {
    tr.classList.remove('fee-row-match');
  });

  if (num === null || num === undefined) return;

  const rows = tbody.querySelectorAll('tr');
  let targetRow = null;

  if (typeof matchIdx === 'number' && matchIdx >= 0 && matchIdx < rows.length) {
    targetRow = rows[matchIdx];
  } else if (isTopRow) {
    targetRow = rows[rows.length - 1];
  }

  if (!targetRow) return;

  targetRow.classList.add('fee-row-match');

  // Scroll mượt tới row
  if (scrollWrap) {
    const rowTop = targetRow.offsetTop;
    const rowHeight = targetRow.offsetHeight;
    const wrapTop = scrollWrap.scrollTop;
    const wrapHeight = scrollWrap.clientHeight;
    const headerHeight = tbody.parentElement.querySelector('thead')?.offsetHeight || 0;

    if (rowTop < wrapTop + headerHeight || rowTop + rowHeight > wrapTop + wrapHeight) {
      scrollWrap.scrollTo({
        top: Math.max(0, rowTop - headerHeight - 40),
        behavior: 'smooth'
      });
    }
  }
}
// ==================== CALC — SET VALUE ====================
function setFeeValue(newValue, sourceEl) {
  const clamped = clampValue(newValue, feeType);
  feeValue = clamped;

  const displayInput = document.getElementById('feeCalcDisplay');
  const adjInput     = document.getElementById('feeAdjInput');
  const slider       = document.getElementById('feeSlider');

  // Update input nào không phải source và không đang focus
  if (displayInput && displayInput !== sourceEl && document.activeElement !== displayInput) {
    displayInput.value = feeValue > 0 ? formatNum(feeValue) : '0';
  }
  if (adjInput && adjInput !== sourceEl && document.activeElement !== adjInput) {
    adjInput.value = feeValue > 0 ? String(feeValue) : '0';
  }

  // Update slider position
  if (slider) {
    slider.value = String(Math.round(feeValue > 0 ? valueToPos(feeValue, feeType) : 0));
  }

  // Render kết quả
  renderCalcResult();

  // Persist
  persistFeeState();
}

// ==================== ADJUST BUTTONS — AUTO-REPEAT ====================
const _adjTimers = new WeakMap();

function startAdjRepeat(btn) {
  // ⭐ CHỐNG DOUBLE-START: đang giữ rồi thì bỏ qua
  if (_adjTimers.has(btn)) return;

  const delta = parseInt(btn.dataset.delta, 10);
  if (!Number.isFinite(delta)) return;

  // Nhấn lần đầu — apply ngay
  setFeeValue(feeValue + delta);

  // State object giữ CẢ timeout + interval (tránh mất ref)
  const state = { timeout: null, interval: null };
  _adjTimers.set(btn, state);

  // Sau 500ms → auto-repeat 100ms/lần
  state.timeout = setTimeout(() => {
    state.timeout = null;
    state.interval = setInterval(() => {
      setFeeValue(feeValue + delta);
    }, 100);
  }, 500);
}

function stopAdjRepeat(btn) {
  const state = _adjTimers.get(btn);
  if (!state) return;
  if (state.timeout)  clearTimeout(state.timeout);
  if (state.interval) clearInterval(state.interval);
  _adjTimers.delete(btn);
}

// ⭐ Stop TẤT CẢ button — dùng cho global catch
function stopAllAdjRepeat() {
  document.querySelectorAll('.fee-adj-btn').forEach(btn => stopAdjRepeat(btn));
}

function attachAdjustButtons() {
  document.querySelectorAll('.fee-adj-btn').forEach(btn => {
    if (btn.dataset.adjAttached === '1') return;
    btn.dataset.adjAttached = '1';

    // Pointer events (chuẩn hơn mouse/touch riêng biệt)
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      btn.setPointerCapture?.(e.pointerId);
      startAdjRepeat(btn);
    });
    btn.addEventListener('pointerup', () => stopAdjRepeat(btn));
    btn.addEventListener('pointercancel', () => stopAdjRepeat(btn));
    btn.addEventListener('pointerleave', () => stopAdjRepeat(btn));

    // Fallback touch (một số browser cũ không fire pointer)
    btn.addEventListener('touchstart', e => {
      if (e.pointerType) return;   // đã handled bởi pointer
      e.preventDefault();
      startAdjRepeat(btn);
    }, { passive: false });
    btn.addEventListener('touchend', () => stopAdjRepeat(btn));
    btn.addEventListener('touchcancel', () => stopAdjRepeat(btn));
  });

  // ⭐ GLOBAL CATCH — attach 1 lần cho cả document
  // Xử lý các case pointer không fire trên button:
  //   - user vuốt tay ra ngoài button rồi nhả
  //   - app bị blur (chuyển tab, khoá màn hình)
  //   - pointerup miss do setPointerCapture lỗi
  if (!window.__feeAdjGlobalHooked) {
    window.__feeAdjGlobalHooked = true;

    window.addEventListener('pointerup', stopAllAdjRepeat);
    window.addEventListener('pointercancel', stopAllAdjRepeat);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopAllAdjRepeat();
    });

    window.addEventListener('blur', stopAllAdjRepeat);
  }
}

// ==================== INPUT EVENTS ====================
function attachCalcInputs() {
  const displayInput = document.getElementById('feeCalcDisplay');
  const adjInput     = document.getElementById('feeAdjInput');

  // Display input (32px, editable)
  if (displayInput && !displayInput.dataset.feeAttached) {
    displayInput.dataset.feeAttached = '1';

    displayInput.addEventListener('focus', () => {
      // Cho user gõ raw số, bỏ format dấu chấm
      displayInput.value = feeValue > 0 ? String(feeValue) : '';
    });

    displayInput.addEventListener('input', () => {
      const cleaned = displayInput.value.replace(/[^\d]/g, '');
      if (displayInput.value !== cleaned) displayInput.value = cleaned;
    });

    displayInput.addEventListener('blur', () => {
      const raw = parseInt(displayInput.value, 10);
      const newVal = Number.isFinite(raw) && raw > 0 ? raw : 0;
      setFeeValue(newVal, displayInput);
      displayInput.value = feeValue > 0 ? formatNum(feeValue) : '0';
    });

    displayInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        displayInput.blur();
      }
    });
  }

  // Adj input (nhỏ, raw number)
  if (adjInput && !adjInput.dataset.feeAttached) {
    adjInput.dataset.feeAttached = '1';

    adjInput.addEventListener('input', () => {
      const cleaned = adjInput.value.replace(/[^\d]/g, '');
      if (adjInput.value !== cleaned) adjInput.value = cleaned;
    });

    adjInput.addEventListener('blur', () => {
      const raw = parseInt(adjInput.value, 10);
      const newVal = Number.isFinite(raw) && raw > 0 ? raw : 0;
      setFeeValue(newVal, adjInput);
      adjInput.value = feeValue > 0 ? String(feeValue) : '0';
    });

    adjInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        adjInput.blur();
      }
    });
  }
}

// ==================== SLIDER EVENT ====================
function attachSlider() {
  const slider = document.getElementById('feeSlider');
  if (!slider || slider.dataset.feeAttached === '1') return;
  slider.dataset.feeAttached = '1';

  slider.addEventListener('input', () => {
    const pos = parseFloat(slider.value);
    const newVal = posToValue(pos, feeType);
    feeValue = newVal;
    setFeeValue(newVal);
  });

  slider.addEventListener('change', () => {
    persistFeeState();
  });
}

// ==================== SEARCH EVENT ====================
function attachSearch() {
  const input = document.getElementById('feeSearchInput');
  if (!input || input.dataset.feeAttached === '1') return;
  input.dataset.feeAttached = '1';

  let debounceTimer = null;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      applySearch(input.value);
    }, 250);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(debounceTimer);
      applySearch(input.value);
      input.blur();
    }
  });
}

// ==================== MODE SWITCH + TYPE TABS ====================
function attachModeSwitch() {
  document.querySelectorAll('.fee-mode-btn').forEach(btn => {
    if (btn.dataset.feeAttached === '1') return;
    btn.dataset.feeAttached = '1';
    btn.addEventListener('click', () => setFeeMode(btn.dataset.mode));
  });
}

function attachTypeTabs() {
  document.querySelectorAll('.fee-type-btn').forEach(btn => {
    if (btn.dataset.feeAttached === '1') return;
    btn.dataset.feeAttached = '1';
    btn.addEventListener('click', () => setFeeType(btn.dataset.type));
  });
}

// ==================== PUBLIC API ====================
export function openFeeTableModal() {
  loadFeeState();

  // Sync UI
  syncModeUI();
  syncTypeUI();
  syncCalcUI();

  // Render
  if (feeMode === 'table') {
    renderTable();
    // Nếu có search cũ → apply lại
    const input = document.getElementById('feeSearchInput');
    if (input) {
      input.value = searchValue || '';
      if (searchValue) applySearch(searchValue);
    }
  } else {
    renderCalcResult();
  }

  // Attach events (idempotent — có check dataset.feeAttached)
  attachSlider();
  attachAdjustButtons();
  attachCalcInputs();
  attachSearch();
  attachModeSwitch();
  attachTypeTabs();

  // Mở modal
  const modal = document.getElementById('feeTableModal');
  if (modal) modal.classList.add('active');
}

export function closeFeeTableModal() {
  const modal = document.getElementById('feeTableModal');
  if (modal) modal.classList.remove('active');

  // Stop mọi auto-repeat còn sót
  stopAllAdjRepeat();

  // Persist
  persistFeeState();
}

export function setFeeMode(mode) {
  if (mode !== 'table' && mode !== 'calc') return;
  if (feeMode === mode) return;

  feeMode = mode;
  syncModeUI();
  persistFeeState();

  if (mode === 'table') {
    renderTable();
    const input = document.getElementById('feeSearchInput');
    if (input && input.value) applySearch(input.value);
  } else {
    syncCalcUI();
    renderCalcResult();
  }
}

export function setFeeType(type) {
  if (type !== 'del' && type !== 'pick' && type !== 'ret') return;
  if (feeType === type) return;

  feeType = type;
  // Clamp lại value theo max mới
  feeValue = clampValue(feeValue, type);

  syncTypeUI();
  persistFeeState();

  if (feeMode === 'table') {
    renderTable();
    // Xóa search khi đổi type (vì data khác)
    const input = document.getElementById('feeSearchInput');
    if (input) input.value = '';
    searchValue = '';
    const clearBtn = document.getElementById('feeSearchClear');
    if (clearBtn) clearBtn.hidden = true;
  } else {
    syncCalcUI();
    renderCalcResult();
  }
}

export function clearFeeSearch() {
  const input = document.getElementById('feeSearchInput');
  if (input) input.value = '';
  searchValue = '';
  const clearBtn = document.getElementById('feeSearchClear');
  if (clearBtn) clearBtn.hidden = true;
  highlightRow(null);
  input?.focus();
}

// ==================== INIT ====================
let _feeInited = false;

export function initFeeTable() {
  if (_feeInited) return;
  _feeInited = true;

  loadFeeState();
  attachModeSwitch();
  attachTypeTabs();
  attachSlider();
  attachAdjustButtons();
  attachCalcInputs();
  attachSearch();

  // Đóng khi ESC
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const modal = document.getElementById('feeTableModal');
    if (modal && modal.classList.contains('active')) {
      closeFeeTableModal();
    }
  });

  // Đóng khi click backdrop (không đóng khi click vào modal-box)
  const modal = document.getElementById('feeTableModal');
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) closeFeeTableModal();
    });
  }

  console.log('[FeeTable] Đã khởi tạo');
}