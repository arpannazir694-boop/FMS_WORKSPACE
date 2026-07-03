// =============================================================================
// FMS FORM — app.js
// =============================================================================

(function () {
'use strict';

// ---------------------------------------------------------------------------
// IMPORTANT: After deploying/redeploying Code.gs, paste the new URL here.
// ---------------------------------------------------------------------------
var GAS_URL = 'https://script.google.com/macros/s/AKfycbx99oNMmHYn-jum8NEtkUFqYmR3nV0reWfL1MYC7GDeRxQJu-BbKJq56KW1KcmUoCjRNA/exec';

// ---------------------------------------------------------------------------
// Session — read logged-in user from sessionStorage (set by login.html)
// ---------------------------------------------------------------------------
var SESSION_KEY = 'fms_user';

function getSession() {
    try { return sessionStorage.getItem(SESSION_KEY); } catch (e) { return null; }
}

function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
}

function getLoginUrl() {
    if (!/\/index\.html$/i.test(window.location.pathname)) {
    return GAS_URL;
    }
    if (window.location.search && /(?:^|[?&])page=app(?:&|$)/.test(window.location.search)) {
    return window.location.pathname + '?page=login';
    }
    return 'login.html';
}

function enforceLogin() {
    if (typeof google !== 'undefined' && google.script && google.script.run) return;
    var user = getSession();
    if (!user) {
    window.location.href = getLoginUrl();
    } else {
    var un = document.getElementById('topbar-username');
    if (un) un.textContent = user;
    }
}

function logoutUser() {
    clearSession();
    window.location.replace(getLoginUrl());
}

function initProfileMenu() {
    var userWrap = document.getElementById('topbar-user');
    var menu     = document.getElementById('profile-menu');
    if (!userWrap || !menu) return;

    var nameEl = document.getElementById('profile-menu-name');
    var topbarName = document.getElementById('topbar-username');
    var currentUser = getSession() || (topbarName ? topbarName.textContent : '') || 'User';
    if (topbarName) topbarName.textContent = currentUser;
    if (nameEl) nameEl.textContent = currentUser;

    function setOpen(open) {
        userWrap.classList.toggle('profile-open', open);
        userWrap.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    userWrap.addEventListener('click', function (e) {
        e.stopPropagation();
        setOpen(!userWrap.classList.contains('profile-open'));
    });

    userWrap.addEventListener('keydown', function (e) {
        if (e.target !== userWrap) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(!userWrap.classList.contains('profile-open'));
        } else if (e.key === 'Escape') {
            setOpen(false);
            userWrap.focus();
        }
    });

    menu.addEventListener('click', function (e) {
        e.stopPropagation();
    });

    document.addEventListener('click', function () {
        setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') setOpen(false);
    });

    var profileLogout = document.getElementById('profile-menu-logout');
    if (profileLogout) {
        profileLogout.addEventListener('click', function () {
            logoutUser();
        });
    }
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
var dropdownData = {};
var currentCuttingQty = null;   // set when a cutting-details match is found

// ---------------------------------------------------------------------------
// JSONP helper
// ---------------------------------------------------------------------------
function jsonp(params, callback) {
    var cbName = 'cb_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
    var url = GAS_URL + '?callback=' + cbName;
    Object.keys(params).forEach(function (k) {
    url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(String(params[k]));
    });

    var timeout;
    var script = document.createElement('script');

    window[cbName] = function (data) {
    clearTimeout(timeout);
    cleanup();
    callback(null, data);
    };

    function cleanup() {
    try { delete window[cbName]; } catch (e) { window[cbName] = undefined; }
    if (script.parentNode) script.parentNode.removeChild(script);
    }

    script.onerror = function () {
    clearTimeout(timeout);
    cleanup();
    callback(new Error('Network error — could not reach the server. Make sure Code.gs is deployed and GAS_URL is correct.'));
    };

    timeout = setTimeout(function () {
    cleanup();
    callback(new Error('Request timed out.'));
    }, 15000);

    script.src = url;
    document.head.appendChild(script);
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------
function showSpinner(msg) {
    var el = document.getElementById('spinner-overlay');
    if (!el) return;
    el.classList.remove('hidden');
    var txt = el.querySelector('.spinner-text');
    if (txt) txt.textContent = msg || 'Loading…';
}

function hideSpinner() {
    var el = document.getElementById('spinner-overlay');
    if (el) el.classList.add('hidden');
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
function showToast(type, title, msg) {
    var container = document.getElementById('toast-container');
    if (!container) return;
    var icons = { success: '✅', error: '❌', info: 'ℹ️' };
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + (type || 'info');
    toast.innerHTML =
    '<div class="toast-icon">' + (icons[type] || icons.info) + '</div>' +
    '<div class="toast-body">' +
        '<div class="toast-title">' + esc(title) + '</div>' +
        (msg ? '<div class="toast-msg">' + esc(msg) + '</div>' : '') +
    '</div>';
    container.appendChild(toast);
    setTimeout(function () {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    toast.style.transition = 'opacity .3s, transform .3s';
    setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 320);
    }, 5000);
}

function esc(str) {
    return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Load dropdown data
// ---------------------------------------------------------------------------
function fetchDropdowns() {
    showSpinner('Loading dropdown data…');

    if (typeof google !== 'undefined' && google.script && google.script.run) {
    google.script.run
        .withSuccessHandler(function (result) {
        hideSpinner();
        if (result && result.success) { dropdownData = result.data; initAllDropdowns(); }
        else showToast('error', 'Load Error', (result && result.error) || 'Failed to load dropdown data.');
        })
        .withFailureHandler(function (err) {
        hideSpinner();
        showToast('error', 'Load Error', err.message || 'Failed to load dropdown data.');
        })
        .getDropdownData();
    return;
    }

    jsonp({ action: 'getDropdownData' }, function (err, result) {
    hideSpinner();
    if (err) { showToast('error', 'Load Error', err.message); return; }
    if (result && result.success) { dropdownData = result.data; initAllDropdowns(); }
    else showToast('error', 'Load Error', (result && result.error) || 'Failed to load dropdown data.');
    });
}

// ---------------------------------------------------------------------------
// Searchable Dropdown component
// ---------------------------------------------------------------------------
function mountDropdown(fieldId, options, placeholder) {
    var wrapper = document.querySelector('[data-dropdown="' + fieldId + '"]');
    if (!wrapper) return;

    var trigger = wrapper.querySelector('.dropdown-trigger');
    var search  = wrapper.querySelector('.dropdown-search');
    var list    = wrapper.querySelector('.dropdown-list');
    var hidden  = document.getElementById('hidden-' + fieldId);
    var current = '';

    function render(filter) {
    list.innerHTML = '';
    var items = filter
        ? options.filter(function (o) { return o.toLowerCase().indexOf(filter.toLowerCase()) !== -1; })
        : options;
    if (!items.length) {
        var no = document.createElement('div');
        no.className = 'dropdown-option no-match';
        no.textContent = 'No results found';
        list.appendChild(no);
        return;
    }
    items.forEach(function (opt) {
        var d = document.createElement('div');
        d.className = 'dropdown-option' + (current === opt ? ' selected' : '');
        d.textContent = opt;
        d.addEventListener('click', function () {
        current = opt;
        trigger.textContent = opt;
        trigger.classList.remove('placeholder-active');
        if (hidden) { hidden.value = opt; hidden.dispatchEvent(new Event('change')); }
        close();
        clearError(fieldId);
        });
        list.appendChild(d);
    });
    }

    function open() {
    document.querySelectorAll('.dropdown-wrapper.open').forEach(function (w) {
        if (w !== wrapper) w.classList.remove('open');
    });
    wrapper.classList.add('open');
    search.value = '';
    render('');
    search.focus();
    }

    function close() { wrapper.classList.remove('open'); }

    trigger.addEventListener('click', function (e) {
    e.stopPropagation();
    wrapper.classList.contains('open') ? close() : open();
    });

    search.addEventListener('input', function () { render(search.value); });
    search.addEventListener('click', function (e) { e.stopPropagation(); });

    wrapper._dd = {
    getValue: function () { return current; },
    reset: function () {
        current = '';
        trigger.textContent = placeholder;
        trigger.classList.add('placeholder-active');
        if (hidden) hidden.value = '';
    }
    };
}

document.addEventListener('click', function () {
    document.querySelectorAll('.dropdown-wrapper.open').forEach(function (w) { w.classList.remove('open'); });
});

function initAllDropdowns() {
    var cfg = {
    batchId:                   { src: dropdownData.batchIds,                   ph: 'Select Batch ID' },
    cuttingLeatherReceiveUnit: { src: dropdownData.cuttingLeatherReceiveUnits, ph: 'Select Receive Unit' },
    season:                    { src: dropdownData.seasons,                    ph: 'Select Season' },
    floorSupervisorName:       { src: dropdownData.floorSupervisorNames,       ph: 'Select Floor Supervisor Name' },
    inLineQCName:              { src: dropdownData.inLineQCNames,              ph: 'Select In-Line QC Name' }
    };
    Object.keys(cfg).forEach(function (id) {
    mountDropdown(id, cfg[id].src || [], cfg[id].ph);
    });
}

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------
function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
function ddVal(id) { var w = document.querySelector('[data-dropdown="' + id + '"]'); return (w && w._dd) ? w._dd.getValue() : ''; }

function setError(fieldId, msg) {
    var f = document.querySelector('[data-field="' + fieldId + '"]');
    if (!f) return;
    f.classList.add('has-error');
    var e = f.querySelector('.error-msg');
    if (e) e.textContent = msg || 'This field is required.';
}

function clearError(fieldId) {
    var f = document.querySelector('[data-field="' + fieldId + '"]');
    if (f) f.classList.remove('has-error');
}

// ---------------------------------------------------------------------------
// Batch (Auto) — mirrors the selected Batch ID value
// ---------------------------------------------------------------------------
function updateBatchAuto() {
    var id  = document.getElementById('hidden-batchId');
    var out = document.getElementById('batchAuto');
    if (!out) return;
    var combined = (id && id.value) ? id.value : '';
    out.value = combined;
    if (combined) {
        validateAndLookup(combined);
    } else {
        clearCuttingMsg();
        enableFormFields();
    }
}

function disableFormFields() {
    document.querySelectorAll('#fms-form-el .field-input').forEach(function (el) {
        if (el.id !== 'batchAuto') el.disabled = true;
    });
    document.querySelectorAll('#fms-form-el .dropdown-wrapper').forEach(function (w) {
        w.classList.add('dd-disabled');
    });
    var btn = document.getElementById('submit-btn');
    if (btn) btn.disabled = true;
}

function enableFormFields() {
    document.querySelectorAll('#fms-form-el .field-input').forEach(function (el) {
        if (el.id !== 'batchAuto') el.disabled = false;
    });
    document.querySelectorAll('#fms-form-el .dropdown-wrapper').forEach(function (w) {
        w.classList.remove('dd-disabled');
    });
    var btn = document.getElementById('submit-btn');
    if (btn) btn.disabled = false;
}

function validateAndLookup(batchAuto) {
    var msgEl = document.getElementById('batch-auto-msg');
    if (msgEl) {
        msgEl.className = 'batch-auto-msg batch-auto-msg--loading';
        msgEl.textContent = 'Checking…';
    }

    function handleExists(result) {
        if (result && result.success && result.exists) {
            disableFormFields();
            if (msgEl) {
                msgEl.className = 'batch-auto-msg batch-auto-msg--exists';
                msgEl.textContent = 'This Batch already exists. Please click the Reset button to submit a new entry.';
            }
        } else {
            enableFormFields();
            lookupCuttingDetails(batchAuto);
        }
    }

    if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
            .withSuccessHandler(handleExists)
            .withFailureHandler(function () { clearCuttingMsg(); enableFormFields(); })
            .checkBatchExists(batchAuto);
        return;
    }

    jsonp({ action: 'checkBatchExists', batchAuto: batchAuto }, function (err, result) {
        if (err) { clearCuttingMsg(); enableFormFields(); return; }
        handleExists(result);
    });
}

function clearCuttingMsg() {
    currentCuttingQty = null;
    var msgEl = document.getElementById('batch-auto-msg');
    if (msgEl) { msgEl.textContent = ''; msgEl.className = 'batch-auto-msg'; }
    clearAutofillWarning();
}

function showAutofillWarning() {
    var el = document.getElementById('autofill-warning');
    if (el) el.classList.add('visible');
}

function clearAutofillWarning() {
    var el = document.getElementById('autofill-warning');
    if (el) el.classList.remove('visible');
    ['brandName', 'category', 'styleNo', 'colour', 'poAsPerBuyer'].forEach(function (id) {
        var inp = document.getElementById(id);
        if (inp) inp.classList.remove('autofilled');
    });
}

function autoFillField(id, value) {
    var inp = document.getElementById(id);
    if (!inp) return;
    var v = String(value || '').trim();
    if (v) {
        inp.value = v;
        inp.classList.add('autofilled');
        clearError(id);
    }
}

function lookupCuttingDetails(batchAuto) {
    var msgEl = document.getElementById('batch-auto-msg');
    if (!msgEl) return;
    msgEl.className = 'batch-auto-msg batch-auto-msg--loading';
    msgEl.textContent = 'Searching…';

    function handleResult(result) {
        if (!msgEl) return;
        if (result && result.success && result.found) {
            currentCuttingQty = result.quantity;
            msgEl.className = 'batch-auto-msg batch-auto-msg--found';
            msgEl.textContent = 'The cutting quantity for this batch is ' + result.quantity + '.';
            // Auto-fill fields from cutting details
            autoFillField('brandName',    result.brandName);
            autoFillField('category',     result.category);
            autoFillField('styleNo',      result.styleNo);
            autoFillField('colour',       result.colour);
            autoFillField('poAsPerBuyer', result.poAsPerBuyer);
            showAutofillWarning();
            // Re-validate quantity field live if already filled
            var qInput = document.getElementById('quantity');
            if (qInput && qInput.value) validateQuantityVsCutting(qInput.value);
        } else if (result && result.success && !result.found) {
            currentCuttingQty = null;
            clearAutofillWarning();
            msgEl.className = 'batch-auto-msg batch-auto-msg--not-found';
            msgEl.textContent = 'No matching record found in Cutting Details.';
        } else {
            currentCuttingQty = null;
            clearCuttingMsg();
        }
    }

    if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
            .withSuccessHandler(handleResult)
            .withFailureHandler(function () { clearCuttingMsg(); })
            .getCuttingDetails(batchAuto);
        return;
    }

    jsonp({ action: 'getCuttingDetails', batchAuto: batchAuto }, function (err, result) {
        if (err) { clearCuttingMsg(); return; }
        handleResult(result);
    });
}

function initBatchAuto() {
    var hiddenBatchId = document.getElementById('hidden-batchId');
    if (hiddenBatchId) hiddenBatchId.addEventListener('change', updateBatchAuto);
}

function validateQuantityVsCutting(val) {
    if (currentCuttingQty === null) { clearError('quantity'); return; }
    var entered  = parseInt(String(val).trim(), 10);
    var expected = parseInt(String(currentCuttingQty).trim(), 10);
    if (!isNaN(entered) && !isNaN(expected) && entered <= expected) {
        clearError('quantity');
    } else if (!isNaN(entered)) {
        setError('quantity', 'Quantity must be equal to or less than the cutting quantity of ' + currentCuttingQty + '.');
    }
}

function initQuantity() {
    var input = document.getElementById('quantity');
    if (!input) return;
    input.addEventListener('input', function () {
    input.value = input.value.replace(/[^0-9]/g, '');
    if (!input.value) { clearError('quantity'); return; }
    validateQuantityVsCutting(input.value);
    });
}

// ---------------------------------------------------------------------------
// Production Days — numeric-only, optional field
// ---------------------------------------------------------------------------
function initProductionDays() {
    var input = document.getElementById('productionDays');
    if (!input) return;
    input.addEventListener('input', function () {
    input.value = input.value.replace(/[^0-9]/g, '');
    });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
function validate() {
    var ok = true;

    ['batchId', 'cuttingLeatherReceiveUnit',
    'season',
    'floorSupervisorName', 'inLineQCName'].forEach(function (id) {
    if (!ddVal(id)) { setError(id, 'This field is required.'); ok = false; }
    else clearError(id);
    });

    ['leatherReceivedDate', 'fabricatorName', 'brandName', 'category',
    'sku', 'styleNo', 'colour', 'quantity', 'etd', 'poAsPerBuyer'].forEach(function (id) {
    if (!val(id)) { setError(id, 'This field is required.'); ok = false; }
    else clearError(id);
    });

    // Cutting-quantity match check (quantity must be <= cutting quantity)
    if (currentCuttingQty !== null) {
    var enteredQty  = parseInt(String(val('quantity')).trim(), 10);
    var expectedQty = parseInt(String(currentCuttingQty).trim(), 10);
    if (val('quantity') && (isNaN(enteredQty) || isNaN(expectedQty) || enteredQty > expectedQty)) {
        setError('quantity', 'Quantity must be equal to or less than the cutting quantity of ' + currentCuttingQty + '.');
        ok = false;
    }
    }

    return ok;
}

// ---------------------------------------------------------------------------
// Date format helper — converts YYYY-MM-DD → DD/MM/YYYY
// ---------------------------------------------------------------------------
function toDisplayDate(isoStr) {
    if (!isoStr) return '';
    var parts = String(isoStr).trim().split('-');
    if (parts.length !== 3) return isoStr;
    return parts[2] + '/' + parts[1] + '/' + parts[0];
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------
function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) {
    showToast('error', 'Validation Error', 'Please fill in all required fields.');
    var first = document.querySelector('.form-field.has-error');
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
    }

    var formData = {
    batchId:                   ddVal('batchId'),
    leatherReceivedDate:       toDisplayDate(val('leatherReceivedDate')),
    cuttingLeatherReceiveUnit: ddVal('cuttingLeatherReceiveUnit'),
    fabricatorName:            val('fabricatorName'),
    brandName:                 val('brandName'),
    season:                    ddVal('season'),
    category:                  val('category'),
    sku:                       val('sku'),
    styleNo:                   val('styleNo'),
    colour:                    val('colour'),
    quantity:                  val('quantity'),
    etd:                       toDisplayDate(val('etd')),
    poAsPerBuyer:              val('poAsPerBuyer'),
    floorSupervisorName:       ddVal('floorSupervisorName'),
    inLineQCName:              ddVal('inLineQCName'),
    productionDays:            val('productionDays'),
    submittedBy:               getSession() || ''
    };

    var btn = document.getElementById('submit-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="material-icons-round" style="font-size:16px;animation:spin .75s linear infinite">refresh</span> Submitting…'; }
    showSpinner('Submitting form…');

    if (typeof google !== 'undefined' && google.script && google.script.run) {
    google.script.run
        .withSuccessHandler(function (result) { afterSubmit(btn, result && result.success, result && result.error); })
        .withFailureHandler(function (err) { afterSubmit(btn, false, err.message); })
        .submitFormData(formData);
    return;
    }

    jsonp({ action: 'submitFormData', formData: JSON.stringify(formData) }, function (err, result) {
    afterSubmit(btn, !err && result && result.success, err ? err.message : (result && result.error));
    });
}

function afterSubmit(btn, success, errMsg) {
    hideSpinner();
    if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<span class="material-icons-round" style="font-size:16px;">check_circle</span> Submit';
    }
    if (success) { showToast('success', 'Submitted!', 'FMS Form submitted successfully.'); resetForm(); }
    else showToast('error', 'Submit Error', errMsg || 'Submission failed. Please try again.');
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------
function resetForm() {
    document.getElementById('fms-form-el').reset();
    document.querySelectorAll('[data-dropdown]').forEach(function (w) { if (w._dd) w._dd.reset(); });
    document.querySelectorAll('.form-field.has-error').forEach(function (f) { f.classList.remove('has-error'); });
    var ba = document.getElementById('batchAuto'); if (ba) ba.value = '';
    clearCuttingMsg();
    clearAutofillWarning();
    enableFormFields();
}

// ---------------------------------------------------------------------------
// Sidebar navigation + logout
// ---------------------------------------------------------------------------
function initNav() {
    document.querySelectorAll('.nav-item[data-page]').forEach(function (item) {
    item.addEventListener('click', function () {
        var page = item.getAttribute('data-page');
        if (!page) return;
        document.querySelectorAll('.nav-item').forEach(function (n) { n.classList.remove('active'); });
        item.classList.add('active');
        document.querySelectorAll('.page-view').forEach(function (v) { v.style.display = 'none'; });
        var target = document.getElementById('page-' + page);
        if (target) target.style.display = '';
        var titleEl = document.getElementById('topbar-title');
        if (titleEl) titleEl.textContent = item.getAttribute('data-title') || 'FMS FORM';

        // Reset reports to KPI view when navigating to Reports
        if (page === 'reports') {
        showReportsKpiView();
        }
        // Reset batch-list to KPI view when navigating to Batch List
        if (page === 'batch-list') {
        showBatchListKpiView();
        }
    });
    });

    var logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
        logoutUser();
    });
    }
}

// ===========================================================================
// REPORTS — Submitted FMS Data
// ===========================================================================

var fmsTableData = {
    headers:       [],
    allRows:       [],
    filteredRows:  [],
    sortCol:       -1,
    sortAsc:       true,
    page:          1,
    pageSize:      25,
    searchQuery:   '',
    columnFilters: {},   // { colIndex: filterString }
    dateFrom:      '',   // YYYY-MM-DD string — filters on Created At (Timestamp)
    dateTo:        '',   // YYYY-MM-DD string — filters on Created At (Timestamp)
    period:        ''    // '' | 'fy' | 'quarter' | 'pre-quarter'
};

// ---------------------------------------------------------------------------
// Date helpers — all filtering is based on the "Timestamp" (Created At) column
// ---------------------------------------------------------------------------

/**
 * Return the column index of the "Timestamp" / "Created At" column.
 * After the virtual "Batch" column is prepended, rawHeaders[0]='Timestamp'
 * maps to fmsTableData.headers[1].
 */
function getCreatedAtColIndex() {
    var idx = -1;
    fmsTableData.headers.forEach(function (h, i) {
    var lh = h.trim().toLowerCase();
    if (lh === 'timestamp' || lh === 'created at' || lh === 'createdat') {
        idx = i;
    }
    });
    return idx;
}

/**
 * Parse a raw cell value from the Timestamp column into a Date object.
 * Handles JavaScript Date objects returned by GAS (already serialised as ISO
 * strings), DD/MM/YYYY, and any format that `new Date()` recognises.
 */
function parseCreatedAt(rawVal) {
    if (rawVal === null || rawVal === undefined || rawVal === '') return null;

    // Already a Date object (GAS returns objects sometimes)
    if (rawVal instanceof Date) {
    return isNaN(rawVal.getTime()) ? null : rawVal;
    }

    var s = String(rawVal).trim();
    if (!s) return null;

    // DD/MM/YYYY or DD/MM/YYYY HH:MM:SS
    var ddmmyyyy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (ddmmyyyy) {
    var day   = parseInt(ddmmyyyy[1], 10);
    var mon   = parseInt(ddmmyyyy[2], 10) - 1;
    var yr    = parseInt(ddmmyyyy[3], 10);
    var hr    = parseInt(ddmmyyyy[4] || '0', 10);
    var mi    = parseInt(ddmmyyyy[5] || '0', 10);
    var sc    = parseInt(ddmmyyyy[6] || '0', 10);
    var d2 = new Date(yr, mon, day, hr, mi, sc);
    return isNaN(d2.getTime()) ? null : d2;
    }

    // Try native parse after DD/MM/YYYY so sheet-formatted dates stay correct.
    var d = new Date(s);
    if (!isNaN(d.getTime())) return d;

    return null;
}

/**
 * Financial Year: April 1 (current FY year) → March 31 (following year)
 * If today is Jan–Mar, the FY started in the previous calendar year.
 */
function getCurrentFYBounds() {
    var now = new Date();
    var m = now.getMonth(); // 0 = Jan … 11 = Dec
    var y = now.getFullYear();
    var fyYear = (m >= 3) ? y : y - 1; // April or later → FY starts this year
    return {
    start: new Date(fyYear,     3,  1,  0,  0,  0,   0),   // 1 Apr
    end:   new Date(fyYear + 1, 2, 31, 23, 59, 59, 999)    // 31 Mar
    };
}

/**
 * Quarter for a given Date, based on Indian FY quarters:
 *   Q1 = Apr – Jun
 *   Q2 = Jul – Sep
 *   Q3 = Oct – Dec
 *   Q4 = Jan – Mar
 */
function getQuarterBounds(d) {
    var m = d.getMonth();
    var y = d.getFullYear();
    if (m >= 3 && m <= 5) {   // Q1: Apr–Jun
    return { start: new Date(y, 3, 1, 0, 0, 0, 0), end: new Date(y, 5, 30, 23, 59, 59, 999) };
    }
    if (m >= 6 && m <= 8) {   // Q2: Jul–Sep
    return { start: new Date(y, 6, 1, 0, 0, 0, 0), end: new Date(y, 8, 30, 23, 59, 59, 999) };
    }
    if (m >= 9 && m <= 11) {  // Q3: Oct–Dec
    return { start: new Date(y, 9, 1, 0, 0, 0, 0), end: new Date(y, 11, 31, 23, 59, 59, 999) };
    }
    // Q4: Jan–Mar
    return { start: new Date(y, 0, 1, 0, 0, 0, 0), end: new Date(y, 2, 31, 23, 59, 59, 999) };
}

/**
 * Previous quarter relative to today.
 */
function getPrevQuarterBounds() {
    var now = new Date();
    var m = now.getMonth();
    var y = now.getFullYear();

    if (m >= 3 && m <= 5) {
    // Current: Q1 (Apr–Jun) → Previous: Q4 (Jan–Mar same year)
    return { start: new Date(y, 0, 1, 0, 0, 0, 0), end: new Date(y, 2, 31, 23, 59, 59, 999) };
    }
    if (m >= 6 && m <= 8) {
    // Current: Q2 (Jul–Sep) → Previous: Q1 (Apr–Jun same year)
    return { start: new Date(y, 3, 1, 0, 0, 0, 0), end: new Date(y, 5, 30, 23, 59, 59, 999) };
    }
    if (m >= 9 && m <= 11) {
    // Current: Q3 (Oct–Dec) → Previous: Q2 (Jul–Sep same year)
    return { start: new Date(y, 6, 1, 0, 0, 0, 0), end: new Date(y, 8, 30, 23, 59, 59, 999) };
    }
    // Current: Q4 (Jan–Mar) → Previous: Q3 (Oct–Dec last year)
    return { start: new Date(y - 1, 9, 1, 0, 0, 0, 0), end: new Date(y - 1, 11, 31, 23, 59, 59, 999) };
}

/**
 * Convert a Date object to a YYYY-MM-DD string suitable for
 * assigning to an <input type="date"> .value property.
 * Uses local calendar date (not UTC) so the displayed date matches
 * the bounds shown to the user.
 */
function dateToInputValue(d) {
    var yr  = d.getFullYear();
    var mo  = d.getMonth() + 1;
    var day = d.getDate();
    return yr + '-' + (mo  < 10 ? '0' + mo  : mo)
                + '-' + (day < 10 ? '0' + day : day);
}

/**
 * Return { start, end } bounds for a period key, or null for 'any'.
 * Centralises period → bounds logic so initReports and applyFilters
 * always agree on the exact dates.
 */
function getBoundsForPeriod(periodVal) {
    if (periodVal === 'fy')          return getCurrentFYBounds();
    if (periodVal === 'quarter')     return getQuarterBounds(new Date());
    if (periodVal === 'pre-quarter') return getPrevQuarterBounds();
    return null;
}

// ---------------------------------------------------------------------------
// Show / hide reports sub-views
// ---------------------------------------------------------------------------
function showReportsKpiView() {
    var kpiView  = document.getElementById('reports-kpi-view');
    var dataView = document.getElementById('reports-fms-data-view');
    if (kpiView)  kpiView.style.display  = '';
    if (dataView) dataView.style.display = 'none';
}

function showReportsFmsDataView() {
    var kpiView  = document.getElementById('reports-kpi-view');
    var dataView = document.getElementById('reports-fms-data-view');
    if (kpiView)  kpiView.style.display  = 'none';
    if (dataView) dataView.style.display = '';

    // If we have no data yet (or a refresh was requested), fetch
    if (fmsTableData.allRows.length === 0) {
    fetchFmsDataAndRender();
    } else {
    renderFmsTable();
    }
}

// ---------------------------------------------------------------------------
// Fetch submitted data from GAS
// ---------------------------------------------------------------------------
function fetchFmsDataAndRender() {
    var emptyEl = document.getElementById('fms-data-empty');
    var tableEl = document.getElementById('fms-data-table');
    var footerEl = document.getElementById('fms-data-footer');

    if (emptyEl) { emptyEl.querySelector('p').textContent = 'Loading data…'; emptyEl.style.display = ''; }
    if (tableEl) tableEl.style.display = 'none';
    if (footerEl) footerEl.style.display = 'none';

    showSpinner('Fetching submitted data…');

    if (typeof google !== 'undefined' && google.script && google.script.run) {
    google.script.run
        .withSuccessHandler(function (result) {
        hideSpinner();
        onFmsDataLoaded(result);
        })
        .withFailureHandler(function (err) {
        hideSpinner();
        onFmsDataError(err.message || 'Failed to load data.');
        })
        .getSubmittedData();
    return;
    }

    jsonp({ action: 'getSubmittedData' }, function (err, result) {
    hideSpinner();
    if (err) { onFmsDataError(err.message); return; }
    onFmsDataLoaded(result);
    });
}

function onFmsDataLoaded(result) {
    if (!result || !result.success) {
    onFmsDataError((result && result.error) || 'Failed to load data.');
    return;
    }

    var rawHeaders = result.headers || [];
    var rawRows    = result.rows    || [];

    // ------------------------------------------------------------------
    // Locate the three columns that make up the computed "Batch" value
    // ------------------------------------------------------------------
    var batchFormatIdx = -1;
    var batchIdIdx     = -1;
    var batchYearIdx   = -1;

    rawHeaders.forEach(function (h, i) {
    var lh = h.trim().toLowerCase();
    if (lh === 'batch id format') batchFormatIdx = i;
    if (lh === 'batch id')        batchIdIdx     = i;
    if (lh === 'batch id year')   batchYearIdx   = i;
    });

    // ------------------------------------------------------------------
    // Inject a virtual "Batch" column at position 0 (before Timestamp)
    // Value = BatchIdFormat + BatchId(zero-padded 4-digit) + BatchIdYear
    // ------------------------------------------------------------------
    var headers = ['Batch'].concat(rawHeaders);

    var rows = rawRows.map(function (row) {
    var fmt    = batchFormatIdx >= 0 ? String(row[batchFormatIdx] || '') : '';
    var rawId  = batchIdIdx     >= 0 ? String(row[batchIdIdx]     || '') : '';
    var year   = batchYearIdx   >= 0 ? String(row[batchYearIdx]   || '') : '';

    // Zero-pad Batch ID to 4 digits for the combined value
    var n = parseInt(rawId, 10);
    var paddedId = (!isNaN(n) && String(n) === rawId.trim() && n >= 0)
        ? ('0000' + n).slice(-4)
        : rawId;

    var batchVal = fmt + paddedId + year;
    return [batchVal].concat(row);
    });

    fmsTableData.headers       = headers;
    fmsTableData.allRows       = rows;
    fmsTableData.filteredRows  = rows.slice();
    fmsTableData.sortCol       = -1;
    fmsTableData.sortAsc       = true;
    fmsTableData.page          = 1;
    fmsTableData.searchQuery   = '';
    fmsTableData.columnFilters = {};
    fmsTableData.dateFrom      = '';
    fmsTableData.dateTo        = '';
    fmsTableData.period        = '';

    // Reset UI controls
    var searchEl = document.getElementById('fms-data-search');
    if (searchEl) searchEl.value = '';
    updateSearchClearBtn();

    var dateFromEl = document.getElementById('fms-date-from');
    if (dateFromEl) dateFromEl.value = '';
    var dateToEl = document.getElementById('fms-date-to');
    if (dateToEl) dateToEl.value = '';
    updateDateClearBtn();

    var periodEl = document.getElementById('fms-period-filter');
    if (periodEl) periodEl.value = '';

    buildFmsTableHeaders();
    renderFmsTable();
}

function onFmsDataError(msg) {
    var emptyEl = document.getElementById('fms-data-empty');
    if (emptyEl) {
    emptyEl.querySelector('p').textContent = 'Error: ' + msg;
    emptyEl.style.display = '';
    }
    var tableEl = document.getElementById('fms-data-table');
    if (tableEl) tableEl.style.display = 'none';
    var footerEl = document.getElementById('fms-data-footer');
    if (footerEl) footerEl.style.display = 'none';
    showToast('error', 'Data Error', msg);
}

// ---------------------------------------------------------------------------
// Build table header row (once per data load)
// ---------------------------------------------------------------------------
function buildFmsTableHeaders() {
    var thead = document.getElementById('fms-data-thead');
    if (!thead) return;
    thead.innerHTML = '';

    // ── Row 1: Column labels + sort ──────────────────────────────────────────
    var trHead = document.createElement('tr');

    var thNum = document.createElement('th');
    thNum.className = 'dt-th dt-th-num';
    thNum.textContent = '#';
    trHead.appendChild(thNum);

    fmsTableData.headers.forEach(function (h, i) {
    var th = document.createElement('th');
    th.className = 'dt-th dt-th-sortable';
    th.setAttribute('data-col-index', i);
    th.innerHTML = esc(h) + '<span class="dt-sort-icon material-icons-round">unfold_more</span>';
    th.addEventListener('click', function () { onSortColumn(i); });
    trHead.appendChild(th);
    });

    // ── Row 1: Per-column filter inputs (above headers) ──────────────────────
    var trFilter = document.createElement('tr');
    trFilter.className = 'dt-filter-row';

    var thFilterNum = document.createElement('th');
    thFilterNum.className = 'dt-filter-cell dt-filter-cell-num';
    thFilterNum.innerHTML = '<span class="material-icons-round" style="font-size:12px;opacity:.45;color:#94a3b8;">filter_list</span>';
    trFilter.appendChild(thFilterNum);

    fmsTableData.headers.forEach(function (h, i) {
    var th = document.createElement('th');
    th.className = 'dt-filter-cell';

    var wrap = document.createElement('div');
    wrap.className = 'dt-col-filter-wrap';

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'dt-col-filter';
    input.placeholder = 'Filter…';
    input.setAttribute('data-col', i);
    input.value = fmsTableData.columnFilters[i] || '';

    var clearBtn = document.createElement('button');
    clearBtn.className = 'dt-col-filter-clear';
    clearBtn.title = 'Clear filter';
    clearBtn.innerHTML = '<span class="material-icons-round">close</span>';
    clearBtn.style.display = input.value ? '' : 'none';

    input.addEventListener('input', function () {
        fmsTableData.columnFilters[i] = input.value;
        clearBtn.style.display = input.value ? '' : 'none';
        applyFilters();
    });

    clearBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        input.value = '';
        fmsTableData.columnFilters[i] = '';
        clearBtn.style.display = 'none';
        applyFilters();
        input.focus();
    });

    wrap.appendChild(input);
    wrap.appendChild(clearBtn);
    th.appendChild(wrap);
    trFilter.appendChild(th);
    });

    thead.appendChild(trFilter);

    // ── Row 2: Column labels + sort (below filter row) ────────────────────────
    thead.appendChild(trHead);
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------
function onSortColumn(colIndex) {
    if (fmsTableData.sortCol === colIndex) {
    fmsTableData.sortAsc = !fmsTableData.sortAsc;
    } else {
    fmsTableData.sortCol = colIndex;
    fmsTableData.sortAsc = true;
    }
    updateSortIcons();
    applyFilters();   // re-filter + re-sort + render
}

function updateSortIcons() {
    document.querySelectorAll('.dt-th-sortable').forEach(function (th) {
    var idx = parseInt(th.getAttribute('data-col-index'), 10);
    var icon = th.querySelector('.dt-sort-icon');
    if (!icon) return;
    if (idx === fmsTableData.sortCol) {
        icon.textContent = fmsTableData.sortAsc ? 'arrow_upward' : 'arrow_downward';
        th.classList.add('dt-th-sorted');
    } else {
        icon.textContent = 'unfold_more';
        th.classList.remove('dt-th-sorted');
    }
    });
}

// ---------------------------------------------------------------------------
// Unified filter engine
// Applies: global search + per-column filters + date range + sort
//
// Period selection (FY / Quarter / Pre-Quarter) works by immediately writing
// the computed start/end dates into fmsTableData.dateFrom / .dateTo AND into
// the DOM date inputs — so the displayed dates are always the actual filter
// bounds, and a single date-range check here covers all cases.
// ---------------------------------------------------------------------------
function applyFilters() {
    var query      = fmsTableData.searchQuery;
    var colFilters = fmsTableData.columnFilters;
    var tsIdx      = getCreatedAtColIndex(); // index of the Timestamp / Created At column

    // ── Date bounds — derived entirely from dateFrom / dateTo state ───────────
    var dateFrom = fmsTableData.dateFrom
    ? new Date(fmsTableData.dateFrom + 'T00:00:00')
    : null;
    var dateTo = fmsTableData.dateTo
    ? new Date(fmsTableData.dateTo + 'T23:59:59')
    : null;

    var anyDateFilter = dateFrom || dateTo;

    fmsTableData.filteredRows = fmsTableData.allRows.filter(function (row) {

    // ── Global search bar ────────────────────────────────────────────────
    if (query) {
        var rowMatch = row.some(function (cell) {
        return String(cell).toLowerCase().indexOf(query) !== -1;
        });
        if (!rowMatch) return false;
    }

    // ── Per-column filters (all must match simultaneously) ───────────────
    var colKeys = Object.keys(colFilters);
    for (var k = 0; k < colKeys.length; k++) {
        var ci = parseInt(colKeys[k], 10);
        var f  = (colFilters[colKeys[k]] || '').trim().toLowerCase();
        if (!f) continue;
        var rawVal     = String(row[ci] !== undefined ? row[ci] : '').toLowerCase();
        var displayVal = formatCellValue(fmsTableData.headers[ci] || '', row[ci]).toLowerCase();
        if (rawVal.indexOf(f) === -1 && displayVal.indexOf(f) === -1) return false;
    }

    // ── Date range filter (uses Created At / Timestamp column) ───────────
    // When a period is selected its exact start/end are already stored in
    // fmsTableData.dateFrom / .dateTo, so no separate period-bounds check
    // is needed here — the same code path handles both manual ranges and
    // period-derived ranges identically.
    if (anyDateFilter && tsIdx >= 0) {
        var createdAt = parseCreatedAt(row[tsIdx]);
        if (!createdAt) return false; // no parseable date — exclude

        if (dateFrom && createdAt < dateFrom) return false;
        if (dateTo   && createdAt > dateTo)   return false;
    }

    return true;
    });

    // ── Sort ──────────────────────────────────────────────────────────────────
    if (fmsTableData.sortCol >= 0) {
    var sc = fmsTableData.sortCol;
    fmsTableData.filteredRows.sort(function (a, b) {
        var av = (a[sc] || '').toString().toLowerCase();
        var bv = (b[sc] || '').toString().toLowerCase();
        var numA = parseFloat(av);
        var numB = parseFloat(bv);
        var isNum = !isNaN(numA) && !isNaN(numB);
        var cmp = isNum ? (numA - numB) : av.localeCompare(bv);
        return fmsTableData.sortAsc ? cmp : -cmp;
    });
    }

    fmsTableData.page = 1;
    renderFmsTable();
}

// ---------------------------------------------------------------------------
// Global search bar — updates searchQuery then delegates to applyFilters
// ---------------------------------------------------------------------------
function applySearch(query) {
    fmsTableData.searchQuery = (query || '').trim().toLowerCase();
    applyFilters();
}

// ---------------------------------------------------------------------------
// Render table body + pagination
// ---------------------------------------------------------------------------
function renderFmsTable() {
    var tbody    = document.getElementById('fms-data-tbody');
    var tableEl  = document.getElementById('fms-data-table');
    var emptyEl  = document.getElementById('fms-data-empty');
    var footerEl = document.getElementById('fms-data-footer');
    var countBadge = document.getElementById('fms-data-count-badge');

    if (!tbody) return;

    var total     = fmsTableData.filteredRows.length;
    var pageSize  = fmsTableData.pageSize;
    var page      = fmsTableData.page;
    var totalPages = Math.ceil(total / pageSize) || 1;

    // Clamp page
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    fmsTableData.page = page;

    var start = (page - 1) * pageSize;
    var end   = Math.min(start + pageSize, total);
    var slice = fmsTableData.filteredRows.slice(start, end);

    // Count badge
    if (countBadge) {
    countBadge.textContent = total + ' record' + (total !== 1 ? 's' : '');
    }

    // Always keep the table structure visible
    if (emptyEl) emptyEl.style.display = 'none';
    if (tableEl) tableEl.style.display = '';
    if (footerEl) footerEl.style.display = (total > 0) ? '' : 'none';

    tbody.innerHTML = '';

    if (total === 0) {
    // Show a "no records" row inside the table body so headers stay visible
    var trEmpty = document.createElement('tr');
    var tdEmpty = document.createElement('td');
    tdEmpty.className = 'dt-td-empty-msg';
    tdEmpty.setAttribute('colspan', fmsTableData.headers.length + 1);

    var hasActiveFilter = Object.keys(fmsTableData.columnFilters).some(function (k) {
        return (fmsTableData.columnFilters[k] || '').trim() !== '';
    });
    var hasDateFilter = fmsTableData.dateFrom || fmsTableData.dateTo || fmsTableData.period;

    tdEmpty.innerHTML =
        '<span class="material-icons-round" style="vertical-align:middle;margin-right:6px;font-size:18px;color:#64748b;">search_off</span>' +
        (fmsTableData.searchQuery || hasActiveFilter || hasDateFilter
        ? 'No records match the current filter.'
        : (fmsTableData.allRows.length === 0 ? 'No data submitted yet.' : 'No records found.'));
    trEmpty.appendChild(tdEmpty);
    tbody.appendChild(trEmpty);

    var infoEl = document.getElementById('fms-data-info');
    if (infoEl) infoEl.textContent = 'Showing 0 entries';
    return;
    }

    // Build rows
    slice.forEach(function (row, idx) {
    var tr = document.createElement('tr');
    tr.className = (start + idx) % 2 === 0 ? 'dt-tr-even' : 'dt-tr-odd';

    // Row number
    var tdNum = document.createElement('td');
    tdNum.className = 'dt-td dt-td-num';
    tdNum.textContent = start + idx + 1;
    tr.appendChild(tdNum);

    fmsTableData.headers.forEach(function (header, ci) {
        var td = document.createElement('td');
        td.className = 'dt-td';
        var cellVal = formatCellValue(header, row[ci]);

        // Highlight search term
        if (fmsTableData.searchQuery && cellVal.toLowerCase().indexOf(fmsTableData.searchQuery) !== -1) {
        td.innerHTML = esc(cellVal).replace(
            new RegExp(escapeRegex(esc(fmsTableData.searchQuery)), 'gi'),
            '<mark class="dt-highlight">$&</mark>'
        );
        } else {
        td.textContent = cellVal;
        }
        tr.appendChild(td);
    });

    tbody.appendChild(tr);
    });

    // Info
    var infoEl = document.getElementById('fms-data-info');
    if (infoEl) {
    infoEl.textContent = 'Showing ' + (start + 1) + ' to ' + end + ' of ' + total +
        (fmsTableData.allRows.length !== total ? ' (filtered from ' + fmsTableData.allRows.length + ' total)' : '') +
        ' entries';
    }

    buildPagination(page, totalPages);
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------
function buildPagination(current, total) {
    var container = document.getElementById('fms-data-pagination');
    if (!container) return;
    container.innerHTML = '';

    function mkBtn(label, page, disabled, active, isIcon) {
    var btn = document.createElement('button');
    btn.className = 'dt-page-btn' + (active ? ' dt-page-btn-active' : '') + (disabled ? ' dt-page-btn-disabled' : '');
    if (isIcon) {
        btn.innerHTML = '<span class="material-icons-round" style="font-size:16px;">' + label + '</span>';
    } else {
        btn.textContent = label;
    }
    btn.disabled = disabled;
    if (!disabled) {
        btn.addEventListener('click', function () {
        fmsTableData.page = page;
        renderFmsTable();
        var wrap = document.getElementById('fms-data-table-wrap');
        if (wrap) wrap.scrollTop = 0;
        });
    }
    return btn;
    }

    container.appendChild(mkBtn('first_page', 1, current <= 1, false, true));
    container.appendChild(mkBtn('chevron_left', current - 1, current <= 1, false, true));

    var range = paginationRange(current, total);
    range.forEach(function (item) {
    if (item === '…') {
        var ellipsis = document.createElement('span');
        ellipsis.className = 'dt-page-ellipsis';
        ellipsis.textContent = '…';
        container.appendChild(ellipsis);
    } else {
        container.appendChild(mkBtn(item, item, false, item === current, false));
    }
    });

    container.appendChild(mkBtn('chevron_right', current + 1, current >= total, false, true));
    container.appendChild(mkBtn('last_page', total, current >= total, false, true));
}

function paginationRange(current, total) {
    if (total <= 7) {
    var arr = [];
    for (var i = 1; i <= total; i++) arr.push(i);
    return arr;
    }
    var pages = [1];
    if (current > 3) pages.push('…');
    for (var p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
    }
    if (current < total - 2) pages.push('…');
    pages.push(total);
    return pages;
}

function updateSearchClearBtn() {
    var searchEl = document.getElementById('fms-data-search');
    var clearBtn = document.getElementById('fms-data-search-clear');
    if (!searchEl || !clearBtn) return;
    clearBtn.style.display = searchEl.value ? '' : 'none';
}

function updateDateClearBtn() {
    var clearBtn = document.getElementById('fms-date-clear');
    if (!clearBtn) return;
    var hasDate = fmsTableData.dateFrom || fmsTableData.dateTo;
    clearBtn.style.display = hasDate ? '' : 'none';
}

// ---------------------------------------------------------------------------
// Excel export — SpreadsheetML (.xls) format, no external libraries
// Exports only the currently filtered records (respects all active filters)
// ---------------------------------------------------------------------------
function downloadExcel() {
    var headers = fmsTableData.headers;
    var rows    = fmsTableData.filteredRows;

    if (!headers.length && !rows.length) {
    showToast('info', 'No Data', 'There is no data to export.');
    return;
    }

    // Build SpreadsheetML XML
    var xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?mso-application progid="Excel.Sheet"?>',
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"',
    '  xmlns:o="urn:schemas-microsoft-com:office:office"',
    '  xmlns:x="urn:schemas-microsoft-com:office:excel"',
    '  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
    '  <Styles>',
    '    <Style ss:ID="Header">',
    '      <Font ss:Bold="1" ss:Color="#FFFFFF"/>',
    '      <Interior ss:Color="#1A73E8" ss:Pattern="Solid"/>',
    '      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>',
    '      <Borders>',
    '        <Border ss:Position="Top"    ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1558B0"/>',
    '        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1558B0"/>',
    '        <Border ss:Position="Left"   ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1558B0"/>',
    '        <Border ss:Position="Right"  ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1558B0"/>',
    '      </Borders>',
    '    </Style>',
    '    <Style ss:ID="RowEven">',
    '      ',
    '      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>',
    '      <Alignment ss:Vertical="Center" ss:WrapText="1"/>',
    '      <Borders>',
    '        <Border ss:Position="Top"    ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>',
    '        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>',
    '        <Border ss:Position="Left"   ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>',
    '        <Border ss:Position="Right"  ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>',
    '      </Borders>',
    '    </Style>',
    '    <Style ss:ID="RowOdd">',
    '      ',
    '      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>',
    '      <Alignment ss:Vertical="Center" ss:WrapText="1"/>',
    '      <Borders>',
    '        <Border ss:Position="Top"    ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>',
    '        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>',
    '        <Border ss:Position="Left"   ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>',
    '        <Border ss:Position="Right"  ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>',
    '      </Borders>',
    '    </Style>',
    '    <Style ss:ID="RowNum">',
    '      <Font ss:Color="#94A3B8"/>',
    '      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>',
    '      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>',
    '      <Borders>',
    '        <Border ss:Position="Top"    ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>',
    '        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>',
    '        <Border ss:Position="Left"   ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>',
    '        <Border ss:Position="Right"  ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>',
    '      </Borders>',
    '    </Style>',
    '  </Styles>',
    '  <Worksheet ss:Name="Submitted FMS Data">',
    '    <Table>'
    ];

    // Column widths
    xml.push('      <Column ss:Width="40"/>'); // # column
    headers.forEach(function () {
    xml.push('      <Column ss:Width="130"/>');
    });

    // Header row
    xml.push('      <Row ss:Height="22">');
    xml.push('        <Cell ss:StyleID="Header"><Data ss:Type="String">#</Data></Cell>');
    headers.forEach(function (h) {
    xml.push('        <Cell ss:StyleID="Header"><Data ss:Type="String">' + xmlEsc(h) + '</Data></Cell>');
    });
    xml.push('      </Row>');

    // Data rows
    rows.forEach(function (row, idx) {
    var style = idx % 2 === 0 ? 'RowEven' : 'RowOdd';
    xml.push('      <Row ss:Height="18">');
    xml.push('        <Cell ss:StyleID="RowNum"><Data ss:Type="Number">' + (idx + 1) + '</Data></Cell>');
    headers.forEach(function (header, ci) {
        var cell = formatCellValue(header, row[ci]);
        // Batch ID and other zero-padded values must stay as String to preserve leading zeros
        var h = (header || '').trim().toLowerCase();
        var forceString = (h === 'batch id');
        var num = Number(cell);
        var isNum = !forceString && cell !== '' && !isNaN(num) && isFinite(num);
        if (isNum) {
        xml.push('        <Cell ss:StyleID="' + style + '"><Data ss:Type="Number">' + num + '</Data></Cell>');
        } else {
        xml.push('        <Cell ss:StyleID="' + style + '"><Data ss:Type="String">' + xmlEsc(cell) + '</Data></Cell>');
        }
    });
    xml.push('      </Row>');
    });

    xml.push('    </Table>');
    xml.push('  </Worksheet>');
    xml.push('</Workbook>');

    var content = xml.join('\n');

    // Build filename: Submitted_FMS_Data_YYYYMMDD.xls
    var now = new Date();
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    var dateStr = now.getFullYear() + '' + pad(now.getMonth() + 1) + '' + pad(now.getDate());
    var filename = 'Submitted_FMS_Data_' + dateStr + '.xls';

    // Trigger download — works on desktop and mobile browsers
    try {
    var blob = new Blob(['\uFEFF' + content], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }, 300);
    } catch (e) {
    // Fallback for older mobile browsers: data URI
    var dataUri = 'data:application/vnd.ms-excel;charset=utf-8,' + encodeURIComponent('\uFEFF' + content);
    window.open(dataUri, '_blank');
    }

    var count = rows.length;
    showToast('success', 'Download Started', count + ' row' + (count !== 1 ? 's' : '') + ' exported to ' + filename);
}

function xmlEsc(str) {
    return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ---------------------------------------------------------------------------
// Cell display formatter — applies column-specific formatting rules
// ---------------------------------------------------------------------------
function formatCellValue(header, value) {
    var h = (header || '').trim().toLowerCase();
    var v = String(value !== undefined && value !== null ? value : '');

    // Batch ID: zero-pad to 4 digits (only when it's a pure integer 1-9999)
    if (h === 'batch id') {
    var n = parseInt(v, 10);
    if (!isNaN(n) && String(n) === v.trim() && n >= 0) {
        return ('0000' + n).slice(-4);
    }
    }

    return v;
}

// ---------------------------------------------------------------------------
// Reports — wire up all interactions
// ---------------------------------------------------------------------------
function initReports() {
    var kpiCard = document.getElementById('kpi-submitted-fms');
    if (kpiCard) {
    kpiCard.addEventListener('click', function () {
        showReportsFmsDataView();
    });
    kpiCard.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showReportsFmsDataView();
        }
    });
    }

    var backBtn = document.getElementById('btn-back-reports');
    if (backBtn) {
    backBtn.addEventListener('click', function () {
        showReportsKpiView();
    });
    }

    var excelBtn = document.getElementById('btn-download-excel');
    if (excelBtn) {
    excelBtn.addEventListener('click', function () {
        downloadExcel();
    });
    }

    var refreshBtn = document.getElementById('btn-refresh-fms-data');
    if (refreshBtn) {
    refreshBtn.addEventListener('click', function () {
        fmsTableData.allRows       = [];
        fmsTableData.columnFilters = {};
        fetchFmsDataAndRender();
    });
    }

    // ── Global search ────────────────────────────────────────────────────────
    var searchEl = document.getElementById('fms-data-search');
    if (searchEl) {
    searchEl.addEventListener('input', function () {
        updateSearchClearBtn();
        applySearch(searchEl.value);
    });
    }

    var clearSearchBtn = document.getElementById('fms-data-search-clear');
    if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', function () {
        var searchEl2 = document.getElementById('fms-data-search');
        if (searchEl2) { searchEl2.value = ''; searchEl2.focus(); }
        updateSearchClearBtn();
        applySearch('');
    });
    }

    // ── Date range — From ────────────────────────────────────────────────────
    // Manual edit → clear any active period selection so the period dropdown
    // no longer claims ownership of the date range.
    var dateFromEl = document.getElementById('fms-date-from');
    if (dateFromEl) {
    dateFromEl.addEventListener('change', function () {
        fmsTableData.dateFrom = dateFromEl.value;
        // Clear period — user is now driving the range manually
        fmsTableData.period = '';
        var periodSel = document.getElementById('fms-period-filter');
        if (periodSel) periodSel.value = '';
        updateDateClearBtn();
        applyFilters();
    });
    }

    // ── Date range — To ──────────────────────────────────────────────────────
    var dateToEl = document.getElementById('fms-date-to');
    if (dateToEl) {
    dateToEl.addEventListener('change', function () {
        fmsTableData.dateTo = dateToEl.value;
        // Clear period — user is now driving the range manually
        fmsTableData.period = '';
        var periodSel = document.getElementById('fms-period-filter');
        if (periodSel) periodSel.value = '';
        updateDateClearBtn();
        applyFilters();
    });
    }

    // ── Date clear button — resets dates AND period ───────────────────────────
    var dateClearBtn = document.getElementById('fms-date-clear');
    if (dateClearBtn) {
    dateClearBtn.addEventListener('click', function () {
        fmsTableData.dateFrom = '';
        fmsTableData.dateTo   = '';
        fmsTableData.period   = '';
        var df = document.getElementById('fms-date-from');
        var dt = document.getElementById('fms-date-to');
        var ps = document.getElementById('fms-period-filter');
        if (df) df.value = '';
        if (dt) dt.value = '';
        if (ps) ps.value = '';
        updateDateClearBtn();
        applyFilters();
    });
    }

    // ── Period filter ────────────────────────────────────────────────────────
    // When a period is chosen:
    //   • Compute its exact start/end bounds.
    //   • Write those dates into the state (dateFrom / dateTo) AND into the
    //     DOM date inputs so the user can see the actual range being used.
    //   • Show the date-clear button so the user can reset with one click.
    //   • Delegate filtering to applyFilters() which uses dateFrom / dateTo.
    //
    // When "Any Period" is chosen, clear the date inputs and state.
    var periodEl = document.getElementById('fms-period-filter');
    if (periodEl) {
    periodEl.addEventListener('change', function () {
        var chosen = periodEl.value;
        fmsTableData.period = chosen;

        var df = document.getElementById('fms-date-from');
        var dt = document.getElementById('fms-date-to');

        if (chosen) {
        // Resolve the exact date range for the selected period
        var bounds = getBoundsForPeriod(chosen);
        if (bounds) {
            fmsTableData.dateFrom = dateToInputValue(bounds.start);
            fmsTableData.dateTo   = dateToInputValue(bounds.end);
            if (df) df.value = fmsTableData.dateFrom;
            if (dt) dt.value = fmsTableData.dateTo;
        }
        } else {
        // "Any Period" selected — clear the date fields
        fmsTableData.dateFrom = '';
        fmsTableData.dateTo   = '';
        if (df) df.value = '';
        if (dt) dt.value = '';
        }

        updateDateClearBtn();
        applyFilters();
    });
    }

    // ── Page size ────────────────────────────────────────────────────────────
    var pageSizeEl = document.getElementById('fms-data-page-size');
    if (pageSizeEl) {
    pageSizeEl.addEventListener('change', function () {
        fmsTableData.pageSize = parseInt(pageSizeEl.value, 10) || 25;
        fmsTableData.page = 1;
        renderFmsTable();
    });
    }
}


// ===========================================================================
// BATCH LIST — Cutting Details
// ===========================================================================

var cuttingTableData = {
    headers:       [],
    allRows:       [],
    filteredRows:  [],
    sortCol:       -1,
    sortAsc:       true,
    page:          1,
    pageSize:      25,
    searchQuery:   '',
    columnFilters: {},
    dateFrom:      '',   // YYYY-MM-DD — filters on Cutting Date column
    dateTo:        ''    // YYYY-MM-DD — filters on Cutting Date column
};

function showBatchListKpiView() {
    var kpiView     = document.getElementById('batch-list-kpi-view');
    var cutView     = document.getElementById('batch-list-cutting-view');
    var bantalaView = document.getElementById('batch-list-bantala-view');
    var floorQcView = document.getElementById('batch-list-floor-qc-view');
    var edgePaintView = document.getElementById('batch-list-edge-paint-view');
    var preAqlView = document.getElementById('batch-list-pre-aql-view');
    if (kpiView)     kpiView.style.display     = '';
    if (cutView)     cutView.style.display     = 'none';
    if (bantalaView) bantalaView.style.display = 'none';
    if (floorQcView) floorQcView.style.display = 'none';
    if (edgePaintView) edgePaintView.style.display = 'none';
    if (preAqlView) preAqlView.style.display = 'none';
}

function showBatchListCuttingView() {
    var kpiView     = document.getElementById('batch-list-kpi-view');
    var dataView    = document.getElementById('batch-list-cutting-view');
    var bantalaView = document.getElementById('batch-list-bantala-view');
    var floorQcView = document.getElementById('batch-list-floor-qc-view');
    var edgePaintView = document.getElementById('batch-list-edge-paint-view');
    var preAqlView = document.getElementById('batch-list-pre-aql-view');
    if (kpiView)     kpiView.style.display     = 'none';
    if (bantalaView) bantalaView.style.display = 'none';
    if (floorQcView) floorQcView.style.display = 'none';
    if (edgePaintView) edgePaintView.style.display = 'none';
    if (preAqlView) preAqlView.style.display = 'none';
    if (dataView)    dataView.style.display    = '';
    if (cuttingTableData.allRows.length === 0) {
        fetchCuttingDetailsAndRender();
    } else {
        renderCuttingTable();
    }
}

function showBatchListBantalaView() {
    var kpiView     = document.getElementById('batch-list-kpi-view');
    var cutView     = document.getElementById('batch-list-cutting-view');
    var bantalaView = document.getElementById('batch-list-bantala-view');
    var floorQcView = document.getElementById('batch-list-floor-qc-view');
    var edgePaintView = document.getElementById('batch-list-edge-paint-view');
    var preAqlView = document.getElementById('batch-list-pre-aql-view');
    if (kpiView)     kpiView.style.display     = 'none';
    if (cutView)     cutView.style.display     = 'none';
    if (floorQcView) floorQcView.style.display = 'none';
    if (edgePaintView) edgePaintView.style.display = 'none';
    if (preAqlView) preAqlView.style.display = 'none';
    if (bantalaView) bantalaView.style.display = '';
    if (bantalaTableData.allRows.length === 0) {
        fetchBantalaDetailsAndRender();
    } else {
        renderBantalaTable();
    }
}

function showBatchListFloorQcView() {
    var kpiView     = document.getElementById('batch-list-kpi-view');
    var cutView     = document.getElementById('batch-list-cutting-view');
    var bantalaView = document.getElementById('batch-list-bantala-view');
    var floorQcView = document.getElementById('batch-list-floor-qc-view');
    var edgePaintView = document.getElementById('batch-list-edge-paint-view');
    var preAqlView = document.getElementById('batch-list-pre-aql-view');
    if (kpiView)     kpiView.style.display     = 'none';
    if (cutView)     cutView.style.display     = 'none';
    if (bantalaView) bantalaView.style.display = 'none';
    if (edgePaintView) edgePaintView.style.display = 'none';
    if (preAqlView) preAqlView.style.display = 'none';
    if (floorQcView) floorQcView.style.display = '';
    if (floorQcTableData.allRows.length === 0) {
        fetchFloorQcDetailsAndRender();
    } else {
        renderFloorQcTable();
    }
}

function showBatchListEdgePaintView() {
    var kpiView       = document.getElementById('batch-list-kpi-view');
    var cutView       = document.getElementById('batch-list-cutting-view');
    var bantalaView   = document.getElementById('batch-list-bantala-view');
    var floorQcView   = document.getElementById('batch-list-floor-qc-view');
    var edgePaintView = document.getElementById('batch-list-edge-paint-view');
    var preAqlView    = document.getElementById('batch-list-pre-aql-view');
    if (kpiView)       kpiView.style.display       = 'none';
    if (cutView)       cutView.style.display       = 'none';
    if (bantalaView)   bantalaView.style.display   = 'none';
    if (floorQcView)   floorQcView.style.display   = 'none';
    if (preAqlView)    preAqlView.style.display    = 'none';
    if (edgePaintView) edgePaintView.style.display = '';
    if (edgePaintTableData.allRows.length === 0) {
        fetchEdgePaintDetailsAndRender();
    } else {
        renderEdgePaintTable();
    }
}

function showBatchListPreAqlView() {
    var kpiView       = document.getElementById('batch-list-kpi-view');
    var cutView       = document.getElementById('batch-list-cutting-view');
    var bantalaView   = document.getElementById('batch-list-bantala-view');
    var floorQcView   = document.getElementById('batch-list-floor-qc-view');
    var edgePaintView = document.getElementById('batch-list-edge-paint-view');
    var preAqlView    = document.getElementById('batch-list-pre-aql-view');
    if (kpiView)       kpiView.style.display       = 'none';
    if (cutView)       cutView.style.display       = 'none';
    if (bantalaView)   bantalaView.style.display   = 'none';
    if (floorQcView)   floorQcView.style.display   = 'none';
    if (edgePaintView) edgePaintView.style.display = 'none';
    if (preAqlView)    preAqlView.style.display    = '';
    if (preAqlTableData.allRows.length === 0) {
        fetchPreAqlDetailsAndRender();
    } else {
        renderPreAqlTable();
    }
}

function fetchCuttingDetailsAndRender() {
    var emptyEl  = document.getElementById('cutting-data-empty');
    var tableEl  = document.getElementById('cutting-data-table');
    var footerEl = document.getElementById('cutting-data-footer');
    if (emptyEl)  { emptyEl.querySelector('p').textContent = 'Loading data…'; emptyEl.style.display = ''; }
    if (tableEl)  tableEl.style.display  = 'none';
    if (footerEl) footerEl.style.display = 'none';
    showSpinner('Fetching cutting details…');
    if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
            .withSuccessHandler(function (r) { hideSpinner(); onCuttingDataLoaded(r); })
            .withFailureHandler(function (e) { hideSpinner(); onCuttingDataError(e.message || 'Failed to load data.'); })
            .getCuttingDetailsData();
        return;
    }
    jsonp({ action: 'getCuttingDetailsData' }, function (err, result) {
        hideSpinner();
        if (err) { onCuttingDataError(err.message); return; }
        onCuttingDataLoaded(result);
    });
}

function onCuttingDataLoaded(result) {
    if (!result || !result.success) {
        onCuttingDataError((result && result.error) || 'Failed to load data.');
        return;
    }
    cuttingTableData.headers       = result.headers || [];
    cuttingTableData.allRows       = result.rows    || [];
    cuttingTableData.filteredRows  = cuttingTableData.allRows.slice();
    cuttingTableData.sortCol       = -1;
    cuttingTableData.sortAsc       = true;
    cuttingTableData.page          = 1;
    cuttingTableData.searchQuery   = '';
    cuttingTableData.columnFilters = {};
    cuttingTableData.dateFrom      = '';
    cuttingTableData.dateTo        = '';
    var searchEl = document.getElementById('cutting-data-search');
    if (searchEl) searchEl.value = '';
    updateCuttingSearchClearBtn();
    var cdf = document.getElementById('cutting-date-from');
    var cdt = document.getElementById('cutting-date-to');
    if (cdf) cdf.value = '';
    if (cdt) cdt.value = '';
    updateCuttingDateClearBtn();
    buildCuttingTableHeaders();
    renderCuttingTable();
}

function onCuttingDataError(msg) {
    var emptyEl = document.getElementById('cutting-data-empty');
    if (emptyEl) { emptyEl.querySelector('p').textContent = 'Error: ' + msg; emptyEl.style.display = ''; }
    var tableEl = document.getElementById('cutting-data-table');
    if (tableEl) tableEl.style.display = 'none';
    var footerEl = document.getElementById('cutting-data-footer');
    if (footerEl) footerEl.style.display = 'none';
    showToast('error', 'Data Error', msg);
}

function buildCuttingTableHeaders() {
    var thead = document.getElementById('cutting-data-thead');
    if (!thead) return;
    thead.innerHTML = '';

    // Label row
    var trHead = document.createElement('tr');
    var thNum  = document.createElement('th');
    thNum.className = 'dt-th dt-th-num';
    thNum.textContent = '#';
    trHead.appendChild(thNum);
    cuttingTableData.headers.forEach(function (h, i) {
        var th = document.createElement('th');
        th.className = 'dt-th dt-th-sortable';
        th.setAttribute('data-cutting-col', i);
        th.innerHTML = esc(h) + '<span class="dt-sort-icon material-icons-round">unfold_more</span>';
        th.addEventListener('click', function () { onCuttingSortColumn(i); });
        trHead.appendChild(th);
    });

    // Per-column filter row
    var trFilter    = document.createElement('tr');
    trFilter.className = 'dt-filter-row';
    var thFilterNum = document.createElement('th');
    thFilterNum.className = 'dt-filter-cell dt-filter-cell-num';
    thFilterNum.innerHTML = '<span class="material-icons-round" style="font-size:12px;opacity:.45;color:#94a3b8;">filter_list</span>';
    trFilter.appendChild(thFilterNum);
    cuttingTableData.headers.forEach(function (h, i) {
        var th       = document.createElement('th');
        th.className = 'dt-filter-cell';
        var wrap     = document.createElement('div');
        wrap.className = 'dt-col-filter-wrap';
        var input    = document.createElement('input');
        input.type        = 'text';
        input.className   = 'dt-col-filter';
        input.placeholder = 'Filter…';
        input.value       = cuttingTableData.columnFilters[i] || '';
        var clearBtn = document.createElement('button');
        clearBtn.className    = 'dt-col-filter-clear';
        clearBtn.title        = 'Clear filter';
        clearBtn.innerHTML    = '<span class="material-icons-round">close</span>';
        clearBtn.style.display = input.value ? '' : 'none';
        input.addEventListener('input', function () {
            cuttingTableData.columnFilters[i] = input.value;
            clearBtn.style.display = input.value ? '' : 'none';
            applyCuttingFilters();
        });
        clearBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            input.value = '';
            cuttingTableData.columnFilters[i] = '';
            clearBtn.style.display = 'none';
            applyCuttingFilters();
            input.focus();
        });
        wrap.appendChild(input);
        wrap.appendChild(clearBtn);
        th.appendChild(wrap);
        trFilter.appendChild(th);
    });

    thead.appendChild(trFilter);
    thead.appendChild(trHead);
}

function onCuttingSortColumn(colIndex) {
    if (cuttingTableData.sortCol === colIndex) {
        cuttingTableData.sortAsc = !cuttingTableData.sortAsc;
    } else {
        cuttingTableData.sortCol = colIndex;
        cuttingTableData.sortAsc = true;
    }
    updateCuttingSortIcons();
    applyCuttingFilters();
}

function updateCuttingSortIcons() {
    document.querySelectorAll('[data-cutting-col]').forEach(function (th) {
        var idx  = parseInt(th.getAttribute('data-cutting-col'), 10);
        var icon = th.querySelector('.dt-sort-icon');
        if (!icon) return;
        if (idx === cuttingTableData.sortCol) {
            icon.textContent = cuttingTableData.sortAsc ? 'arrow_upward' : 'arrow_downward';
            th.classList.add('dt-th-sorted');
        } else {
            icon.textContent = 'unfold_more';
            th.classList.remove('dt-th-sorted');
        }
    });
}

function getCuttingDateColIndex() {
    var idx = -1;
    cuttingTableData.headers.forEach(function (h, i) {
        if (h.trim().toLowerCase() === 'cutting date') idx = i;
    });
    return idx;
}

function updateCuttingDateClearBtn() {
    var clearBtn = document.getElementById('cutting-date-clear');
    if (!clearBtn) return;
    clearBtn.style.display = (cuttingTableData.dateFrom || cuttingTableData.dateTo) ? '' : 'none';
}

function applyCuttingFilters() {
    var query      = cuttingTableData.searchQuery;
    var colFilters = cuttingTableData.columnFilters;
    var cdIdx      = getCuttingDateColIndex();

    // Date bounds from state
    var dateFrom = cuttingTableData.dateFrom
        ? new Date(cuttingTableData.dateFrom + 'T00:00:00')
        : null;
    var dateTo = cuttingTableData.dateTo
        ? new Date(cuttingTableData.dateTo + 'T23:59:59')
        : null;
    var anyDateFilter = dateFrom || dateTo;

    cuttingTableData.filteredRows = cuttingTableData.allRows.filter(function (row) {
        if (query) {
            var rowMatch = row.some(function (cell) {
                return String(cell).toLowerCase().indexOf(query) !== -1;
            });
            if (!rowMatch) return false;
        }
        var colKeys = Object.keys(colFilters);
        for (var k = 0; k < colKeys.length; k++) {
            var ci = parseInt(colKeys[k], 10);
            var f  = (colFilters[colKeys[k]] || '').trim().toLowerCase();
            if (!f) continue;
            var cellVal = String(row[ci] !== undefined ? row[ci] : '').toLowerCase();
            if (cellVal.indexOf(f) === -1) return false;
        }
        // Date range filter on Cutting Date column
        if (anyDateFilter && cdIdx >= 0) {
            var rawDate = row[cdIdx];
            var parsed  = parseCreatedAt(rawDate);   // reuse existing parser (DD/MM/YYYY aware)
            if (!parsed) return false;
            if (dateFrom && parsed < dateFrom) return false;
            if (dateTo   && parsed > dateTo)   return false;
        }
        return true;
    });
    if (cuttingTableData.sortCol >= 0) {
        var sc = cuttingTableData.sortCol;
        cuttingTableData.filteredRows.sort(function (a, b) {
            var av = (a[sc] || '').toString().toLowerCase();
            var bv = (b[sc] || '').toString().toLowerCase();
            var numA = parseFloat(av), numB = parseFloat(bv);
            var isNum = !isNaN(numA) && !isNaN(numB);
            var cmp = isNum ? (numA - numB) : av.localeCompare(bv);
            return cuttingTableData.sortAsc ? cmp : -cmp;
        });
    }
    cuttingTableData.page = 1;
    renderCuttingTable();
}

function applyCuttingSearch(query) {
    cuttingTableData.searchQuery = (query || '').trim().toLowerCase();
    applyCuttingFilters();
}

function renderCuttingTable() {
    var tbody      = document.getElementById('cutting-data-tbody');
    var tableEl    = document.getElementById('cutting-data-table');
    var emptyEl    = document.getElementById('cutting-data-empty');
    var footerEl   = document.getElementById('cutting-data-footer');
    var countBadge = document.getElementById('cutting-data-count-badge');
    if (!tbody) return;

    var total      = cuttingTableData.filteredRows.length;
    var pageSize   = cuttingTableData.pageSize;
    var page       = cuttingTableData.page;
    var totalPages = Math.ceil(total / pageSize) || 1;
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    cuttingTableData.page = page;

    var start = (page - 1) * pageSize;
    var end   = Math.min(start + pageSize, total);
    var slice = cuttingTableData.filteredRows.slice(start, end);

    if (countBadge) countBadge.textContent = total + ' record' + (total !== 1 ? 's' : '');
    if (emptyEl)  emptyEl.style.display  = 'none';
    if (tableEl)  tableEl.style.display  = '';
    if (footerEl) footerEl.style.display = total > 0 ? '' : 'none';
    tbody.innerHTML = '';

    if (total === 0) {
        var trEmpty = document.createElement('tr');
        var tdEmpty = document.createElement('td');
        tdEmpty.className = 'dt-td-empty-msg';
        tdEmpty.setAttribute('colspan', cuttingTableData.headers.length + 1);
        var hasFilter = Object.keys(cuttingTableData.columnFilters).some(function (k) {
            return (cuttingTableData.columnFilters[k] || '').trim() !== '';
        });
        tdEmpty.innerHTML = '<span class="material-icons-round" style="vertical-align:middle;margin-right:6px;font-size:18px;color:#64748b;">search_off</span>' +
            (cuttingTableData.searchQuery || hasFilter
                ? 'No records match the current filter.'
                : (cuttingTableData.allRows.length === 0 ? 'No data found in Cutting Details.' : 'No records found.'));
        trEmpty.appendChild(tdEmpty);
        tbody.appendChild(trEmpty);
        var infoEl2 = document.getElementById('cutting-data-info');
        if (infoEl2) infoEl2.textContent = 'Showing 0 entries';
        return;
    }

    slice.forEach(function (row, idx) {
        var tr = document.createElement('tr');
        tr.className = (start + idx) % 2 === 0 ? 'dt-tr-even' : 'dt-tr-odd';
        var tdNum = document.createElement('td');
        tdNum.className = 'dt-td dt-td-num';
        tdNum.textContent = start + idx + 1;
        tr.appendChild(tdNum);
        cuttingTableData.headers.forEach(function (header, ci) {
            var td  = document.createElement('td');
            td.className = 'dt-td';
            var cellVal  = String(row[ci] !== undefined && row[ci] !== null ? row[ci] : '');
            if (cuttingTableData.searchQuery && cellVal.toLowerCase().indexOf(cuttingTableData.searchQuery) !== -1) {
                td.innerHTML = esc(cellVal).replace(
                    new RegExp(escapeRegex(esc(cuttingTableData.searchQuery)), 'gi'),
                    '<mark class="dt-highlight">$&</mark>'
                );
            } else {
                td.textContent = cellVal;
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    var infoEl = document.getElementById('cutting-data-info');
    if (infoEl) {
        infoEl.textContent = 'Showing ' + (start + 1) + ' to ' + end + ' of ' + total +
            (cuttingTableData.allRows.length !== total ? ' (filtered from ' + cuttingTableData.allRows.length + ' total)' : '') +
            ' entries';
    }
    buildCuttingPagination(page, totalPages);
}

function buildCuttingPagination(current, total) {
    var container = document.getElementById('cutting-data-pagination');
    if (!container) return;
    container.innerHTML = '';
    function mkBtn(label, page, disabled, active, isIcon) {
        var btn = document.createElement('button');
        btn.className = 'dt-page-btn' + (active ? ' dt-page-btn-active' : '') + (disabled ? ' dt-page-btn-disabled' : '');
        btn.innerHTML = isIcon ? '<span class="material-icons-round" style="font-size:16px;">' + label + '</span>' : label;
        btn.disabled  = disabled;
        if (!disabled) {
            btn.addEventListener('click', function () {
                cuttingTableData.page = page;
                renderCuttingTable();
                var wrap = document.getElementById('cutting-data-table-wrap');
                if (wrap) wrap.scrollTop = 0;
            });
        }
        return btn;
    }
    container.appendChild(mkBtn('first_page',   1,           current <= 1,      false, true));
    container.appendChild(mkBtn('chevron_left', current - 1, current <= 1,      false, true));
    paginationRange(current, total).forEach(function (item) {
        if (item === '…') {
            var el = document.createElement('span');
            el.className   = 'dt-page-ellipsis';
            el.textContent = '…';
            container.appendChild(el);
        } else {
            container.appendChild(mkBtn(item, item, false, item === current, false));
        }
    });
    container.appendChild(mkBtn('chevron_right', current + 1, current >= total, false, true));
    container.appendChild(mkBtn('last_page',     total,       current >= total, false, true));
}

function updateCuttingSearchClearBtn() {
    var searchEl = document.getElementById('cutting-data-search');
    var clearBtn = document.getElementById('cutting-data-search-clear');
    if (!searchEl || !clearBtn) return;
    clearBtn.style.display = searchEl.value ? '' : 'none';
}

function downloadCuttingExcel() {
    var headers = cuttingTableData.headers;
    var rows    = cuttingTableData.filteredRows;
    if (!headers.length && !rows.length) { showToast('info', 'No Data', 'There is no data to export.'); return; }
    var xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<?mso-application progid="Excel.Sheet"?>',
        '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"',
        '  xmlns:o="urn:schemas-microsoft-com:office:office"',
        '  xmlns:x="urn:schemas-microsoft-com:office:excel"',
        '  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
        '  <Styles>',
        '    <Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1A73E8" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1558B0"/><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1558B0"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1558B0"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1558B0"/></Borders></Style>',
        '    <Style ss:ID="RowEven"><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/></Borders></Style>',
        '    <Style ss:ID="RowOdd"><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/></Borders></Style>',
        '    <Style ss:ID="RowNum"><Font ss:Color="#94A3B8"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/></Borders></Style>',
        '  </Styles>',
        '  <Worksheet ss:Name="Batch Cutting Details">',
        '    <Table>'
    ];
    xml.push('      <Column ss:Width="40"/>');
    headers.forEach(function () { xml.push('      <Column ss:Width="130"/>'); });
    xml.push('      <Row ss:Height="22">');
    xml.push('        <Cell ss:StyleID="Header"><Data ss:Type="String">#</Data></Cell>');
    headers.forEach(function (h) { xml.push('        <Cell ss:StyleID="Header"><Data ss:Type="String">' + xmlEsc(h) + '</Data></Cell>'); });
    xml.push('      </Row>');
    rows.forEach(function (row, idx) {
        var style = idx % 2 === 0 ? 'RowEven' : 'RowOdd';
        xml.push('      <Row ss:Height="18">');
        xml.push('        <Cell ss:StyleID="RowNum"><Data ss:Type="Number">' + (idx + 1) + '</Data></Cell>');
        headers.forEach(function (header, ci) {
            var cell  = String(row[ci] !== undefined && row[ci] !== null ? row[ci] : '');
            var num   = Number(cell);
            var isNum = cell !== '' && !isNaN(num) && isFinite(num);
            if (isNum) {
                xml.push('        <Cell ss:StyleID="' + style + '"><Data ss:Type="Number">' + num + '</Data></Cell>');
            } else {
                xml.push('        <Cell ss:StyleID="' + style + '"><Data ss:Type="String">' + xmlEsc(cell) + '</Data></Cell>');
            }
        });
        xml.push('      </Row>');
    });
    xml.push('    </Table></Worksheet></Workbook>');
    var content  = xml.join('\n');
    var now      = new Date();
    var pad      = function (n) { return n < 10 ? '0' + n : '' + n; };
    var dateStr  = now.getFullYear() + '' + pad(now.getMonth() + 1) + '' + pad(now.getDate());
    var filename = 'Batch_Cutting_Details_' + dateStr + '.xls';
    try {
        var blob = new Blob(['\uFEFF' + content], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href = url; a.download = filename; a.style.display = 'none';
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(url); document.body.removeChild(a); }, 300);
    } catch (e) {
        window.open('data:application/vnd.ms-excel;charset=utf-8,' + encodeURIComponent('\uFEFF' + content), '_blank');
    }
    showToast('success', 'Download Started', rows.length + ' row' + (rows.length !== 1 ? 's' : '') + ' exported to ' + filename);
}

// ---------------------------------------------------------------------------
// Batch List — wire up all interactions
// ---------------------------------------------------------------------------
// ===========================================================================
// BATCH LIST - Floor Supervisor & In-Line QC Details
// ===========================================================================

var floorQcTableData = {
    headers:       [],
    headerGroups:  [],
    allRows:       [],
    filteredRows:  [],
    sortCol:       -1,
    sortAsc:       true,
    page:          1,
    pageSize:      25,
    searchQuery:   '',
    columnFilters: {},
    dateFrom:      '',
    dateTo:        ''
};

// The Google Sheet table starts at column B, so FMS Upload Timestamp is index 0.
function getFloorQcDateColIndex() { return 0; }

function updateFloorQcDateClearBtn() {
    var btn = document.getElementById('floor-qc-date-clear');
    if (btn) btn.style.display = (floorQcTableData.dateFrom || floorQcTableData.dateTo) ? '' : 'none';
}

function updateFloorQcSearchClearBtn() {
    var s = document.getElementById('floor-qc-data-search');
    var b = document.getElementById('floor-qc-data-search-clear');
    if (s && b) b.style.display = s.value ? '' : 'none';
}

function fetchFloorQcDetailsAndRender() {
    var emptyEl  = document.getElementById('floor-qc-data-empty');
    var tableEl  = document.getElementById('floor-qc-data-table');
    var footerEl = document.getElementById('floor-qc-data-footer');
    if (emptyEl)  { emptyEl.querySelector('p').textContent = 'Loading data...'; emptyEl.style.display = ''; }
    if (tableEl)  tableEl.style.display  = 'none';
    if (footerEl) footerEl.style.display = 'none';
    showSpinner('Fetching Floor Supervisor & In-Line QC details...');
    if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
            .withSuccessHandler(function (r) { hideSpinner(); onFloorQcDataLoaded(r); })
            .withFailureHandler(function (e) { hideSpinner(); onFloorQcDataError(e.message || 'Failed to load data.'); })
            .getFloorQcDetailsData();
        return;
    }
    jsonp({ action: 'getFloorQcDetailsData' }, function (err, result) {
        hideSpinner();
        if (err) { onFloorQcDataError(err.message); return; }
        onFloorQcDataLoaded(result);
    });
}

function onFloorQcDataLoaded(result) {
    if (!result || !result.success) {
        onFloorQcDataError((result && result.error) || 'Failed to load data.');
        return;
    }
    floorQcTableData.headers       = result.headers      || [];
    floorQcTableData.headerGroups  = result.headerGroups || [];
    floorQcTableData.allRows       = result.rows         || [];
    floorQcTableData.filteredRows  = floorQcTableData.allRows.slice();
    floorQcTableData.sortCol       = -1;
    floorQcTableData.sortAsc       = true;
    floorQcTableData.page          = 1;
    floorQcTableData.searchQuery   = '';
    floorQcTableData.columnFilters = {};
    floorQcTableData.dateFrom      = '';
    floorQcTableData.dateTo        = '';

    var s = document.getElementById('floor-qc-data-search');
    if (s) s.value = '';
    updateFloorQcSearchClearBtn();

    var df = document.getElementById('floor-qc-date-from');
    var dt = document.getElementById('floor-qc-date-to');
    if (df) df.value = '';
    if (dt) dt.value = '';
    updateFloorQcDateClearBtn();

    var labelEl = document.getElementById('floor-qc-date-col-label');
    var dateCol = getFloorQcDateColIndex();
    if (labelEl && floorQcTableData.headers[dateCol]) {
        labelEl.textContent = floorQcTableData.headers[dateCol];
    }

    buildFloorQcTableHeaders();
    renderFloorQcTable();
}

function onFloorQcDataError(msg) {
    var emptyEl = document.getElementById('floor-qc-data-empty');
    if (emptyEl) { emptyEl.querySelector('p').textContent = 'Error: ' + msg; emptyEl.style.display = ''; }
    var tableEl = document.getElementById('floor-qc-data-table');
    if (tableEl) tableEl.style.display = 'none';
    var footerEl = document.getElementById('floor-qc-data-footer');
    if (footerEl) footerEl.style.display = 'none';
    showToast('error', 'Data Error', msg);
}

function buildFloorQcTableHeaders() {
    var thead = document.getElementById('floor-qc-data-thead');
    if (!thead) return;
    thead.innerHTML = '';

    (floorQcTableData.headerGroups || []).forEach(function (groupRow, rowIndex) {
        var trGroup = document.createElement('tr');
        trGroup.className = 'dt-group-row dt-group-row-' + rowIndex;

        var thGroupNum = document.createElement('th');
        thGroupNum.className = 'dt-group-th dt-group-th-num';
        thGroupNum.textContent = rowIndex === 0 ? '#' : '';
        trGroup.appendChild(thGroupNum);

        groupRow.forEach(function (group) {
            var th = document.createElement('th');
            th.className = 'dt-group-th';
            th.colSpan = Math.max(parseInt(group.colspan, 10) || 1, 1);
            th.textContent = group.label || '';
            trGroup.appendChild(th);
        });

        thead.appendChild(trGroup);
    });

    var trHead = document.createElement('tr');
    var thNum  = document.createElement('th');
    thNum.className   = 'dt-th dt-th-num';
    thNum.textContent = '#';
    trHead.appendChild(thNum);
    floorQcTableData.headers.forEach(function (h, i) {
        var th = document.createElement('th');
        th.className = 'dt-th dt-th-sortable';
        th.setAttribute('data-floor-qc-col', i);
        th.innerHTML = esc(h) + '<span class="dt-sort-icon material-icons-round">unfold_more</span>';
        th.addEventListener('click', function () { onFloorQcSortColumn(i); });
        trHead.appendChild(th);
    });

    var trFilter = document.createElement('tr');
    trFilter.className = 'dt-filter-row';
    var thFilterNum = document.createElement('th');
    thFilterNum.className = 'dt-filter-cell dt-filter-cell-num';
    thFilterNum.innerHTML = '<span class="material-icons-round" style="font-size:12px;opacity:.45;color:#94a3b8;">filter_list</span>';
    trFilter.appendChild(thFilterNum);

    floorQcTableData.headers.forEach(function (h, i) {
        var th = document.createElement('th');
        th.className = 'dt-filter-cell';
        var wrap = document.createElement('div');
        wrap.className = 'dt-col-filter-wrap';
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'dt-col-filter';
        input.placeholder = 'Filter...';
        input.value = floorQcTableData.columnFilters[i] || '';
        var clearBtn = document.createElement('button');
        clearBtn.className = 'dt-col-filter-clear';
        clearBtn.title = 'Clear filter';
        clearBtn.innerHTML = '<span class="material-icons-round">close</span>';
        clearBtn.style.display = input.value ? '' : 'none';
        input.addEventListener('input', function () {
            floorQcTableData.columnFilters[i] = input.value;
            clearBtn.style.display = input.value ? '' : 'none';
            applyFloorQcFilters();
        });
        clearBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            input.value = '';
            floorQcTableData.columnFilters[i] = '';
            clearBtn.style.display = 'none';
            applyFloorQcFilters();
            input.focus();
        });
        wrap.appendChild(input);
        wrap.appendChild(clearBtn);
        th.appendChild(wrap);
        trFilter.appendChild(th);
    });

    thead.appendChild(trHead);
    thead.appendChild(trFilter);
}

function onFloorQcSortColumn(colIndex) {
    if (floorQcTableData.sortCol === colIndex) {
        floorQcTableData.sortAsc = !floorQcTableData.sortAsc;
    } else {
        floorQcTableData.sortCol = colIndex;
        floorQcTableData.sortAsc = true;
    }
    updateFloorQcSortIcons();
    applyFloorQcFilters();
}

function updateFloorQcSortIcons() {
    document.querySelectorAll('[data-floor-qc-col]').forEach(function (th) {
        var idx  = parseInt(th.getAttribute('data-floor-qc-col'), 10);
        var icon = th.querySelector('.dt-sort-icon');
        if (!icon) return;
        if (idx === floorQcTableData.sortCol) {
            icon.textContent = floorQcTableData.sortAsc ? 'arrow_upward' : 'arrow_downward';
            th.classList.add('dt-th-sorted');
        } else {
            icon.textContent = 'unfold_more';
            th.classList.remove('dt-th-sorted');
        }
    });
}

function applyFloorQcFilters() {
    var query      = floorQcTableData.searchQuery;
    var colFilters = floorQcTableData.columnFilters;
    var dateColIdx = getFloorQcDateColIndex();
    var dateFrom = floorQcTableData.dateFrom ? new Date(floorQcTableData.dateFrom + 'T00:00:00') : null;
    var dateTo = floorQcTableData.dateTo ? new Date(floorQcTableData.dateTo + 'T23:59:59') : null;
    var anyDateFilter = dateFrom || dateTo;

    floorQcTableData.filteredRows = floorQcTableData.allRows.filter(function (row) {
        if (query) {
            var rowMatch = row.some(function (cell) {
                return String(cell).toLowerCase().indexOf(query) !== -1;
            });
            if (!rowMatch) return false;
        }
        var colKeys = Object.keys(colFilters);
        for (var k = 0; k < colKeys.length; k++) {
            var ci = parseInt(colKeys[k], 10);
            var f  = (colFilters[colKeys[k]] || '').trim().toLowerCase();
            if (!f) continue;
            var cellVal = String(row[ci] !== undefined ? row[ci] : '').toLowerCase();
            if (cellVal.indexOf(f) === -1) return false;
        }
        if (anyDateFilter && dateColIdx >= 0 && dateColIdx < row.length) {
            var parsed = parseCreatedAt(row[dateColIdx]);
            if (!parsed) return false;
            if (dateFrom && parsed < dateFrom) return false;
            if (dateTo   && parsed > dateTo)   return false;
        }
        return true;
    });

    if (floorQcTableData.sortCol >= 0) {
        var sc = floorQcTableData.sortCol;
        floorQcTableData.filteredRows.sort(function (a, b) {
            var av = (a[sc] || '').toString().toLowerCase();
            var bv = (b[sc] || '').toString().toLowerCase();
            var numA = parseFloat(av), numB = parseFloat(bv);
            var isNum = !isNaN(numA) && !isNaN(numB);
            var cmp = isNum ? (numA - numB) : av.localeCompare(bv);
            return floorQcTableData.sortAsc ? cmp : -cmp;
        });
    }

    floorQcTableData.page = 1;
    renderFloorQcTable();
}

function applyFloorQcSearch(query) {
    floorQcTableData.searchQuery = (query || '').trim().toLowerCase();
    applyFloorQcFilters();
}

function renderFloorQcTable() {
    var tbody      = document.getElementById('floor-qc-data-tbody');
    var tableEl    = document.getElementById('floor-qc-data-table');
    var emptyEl    = document.getElementById('floor-qc-data-empty');
    var footerEl   = document.getElementById('floor-qc-data-footer');
    var countBadge = document.getElementById('floor-qc-data-count-badge');
    if (!tbody) return;

    var total      = floorQcTableData.filteredRows.length;
    var pageSize   = floorQcTableData.pageSize;
    var page       = floorQcTableData.page;
    var totalPages = Math.ceil(total / pageSize) || 1;
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    floorQcTableData.page = page;

    var start = (page - 1) * pageSize;
    var end   = Math.min(start + pageSize, total);
    var slice = floorQcTableData.filteredRows.slice(start, end);

    if (countBadge) countBadge.textContent = total + ' record' + (total !== 1 ? 's' : '');
    if (emptyEl)  emptyEl.style.display  = 'none';
    if (tableEl)  tableEl.style.display  = '';
    if (footerEl) footerEl.style.display = total > 0 ? '' : 'none';
    tbody.innerHTML = '';

    if (total === 0) {
        var trEmpty = document.createElement('tr');
        var tdEmpty = document.createElement('td');
        tdEmpty.className = 'dt-td-empty-msg';
        tdEmpty.setAttribute('colspan', floorQcTableData.headers.length + 1);
        var hasFilter = Object.keys(floorQcTableData.columnFilters).some(function (k) {
            return (floorQcTableData.columnFilters[k] || '').trim() !== '';
        });
        var hasDate = floorQcTableData.dateFrom || floorQcTableData.dateTo;
        tdEmpty.innerHTML =
            '<span class="material-icons-round" style="vertical-align:middle;margin-right:6px;font-size:18px;color:#64748b;">search_off</span>' +
            (floorQcTableData.searchQuery || hasFilter || hasDate
                ? 'No records match the current filter.'
                : (floorQcTableData.allRows.length === 0 ? 'No data found in Floor Supervisor & In-Line QC Details.' : 'No records found.'));
        trEmpty.appendChild(tdEmpty);
        tbody.appendChild(trEmpty);
        var infoEl2 = document.getElementById('floor-qc-data-info');
        if (infoEl2) infoEl2.textContent = 'Showing 0 entries';
        return;
    }

    slice.forEach(function (row, idx) {
        var tr = document.createElement('tr');
        tr.className = (start + idx) % 2 === 0 ? 'dt-tr-even' : 'dt-tr-odd';
        var tdNum = document.createElement('td');
        tdNum.className = 'dt-td dt-td-num';
        tdNum.textContent = start + idx + 1;
        tr.appendChild(tdNum);
        floorQcTableData.headers.forEach(function (header, ci) {
            var td = document.createElement('td');
            td.className = 'dt-td';
            var cellVal = String(row[ci] !== undefined && row[ci] !== null ? row[ci] : '');
            if (floorQcTableData.searchQuery && cellVal.toLowerCase().indexOf(floorQcTableData.searchQuery) !== -1) {
                td.innerHTML = esc(cellVal).replace(
                    new RegExp(escapeRegex(esc(floorQcTableData.searchQuery)), 'gi'),
                    '<mark class="dt-highlight">$&</mark>'
                );
            } else {
                td.textContent = cellVal;
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    var infoEl = document.getElementById('floor-qc-data-info');
    if (infoEl) {
        infoEl.textContent = 'Showing ' + (start + 1) + ' to ' + end + ' of ' + total +
            (floorQcTableData.allRows.length !== total ? ' (filtered from ' + floorQcTableData.allRows.length + ' total)' : '') +
            ' entries';
    }
    buildFloorQcPagination(page, totalPages);
}

function buildFloorQcPagination(current, total) {
    var container = document.getElementById('floor-qc-data-pagination');
    if (!container) return;
    container.innerHTML = '';
    function mkBtn(label, page, disabled, active, isIcon) {
        var btn = document.createElement('button');
        btn.className = 'dt-page-btn' + (active ? ' dt-page-btn-active' : '') + (disabled ? ' dt-page-btn-disabled' : '');
        btn.innerHTML = isIcon ? '<span class="material-icons-round" style="font-size:16px;">' + label + '</span>' : label;
        btn.disabled  = disabled;
        if (!disabled) {
            btn.addEventListener('click', function () {
                floorQcTableData.page = page;
                renderFloorQcTable();
                var wrap = document.getElementById('floor-qc-data-table-wrap');
                if (wrap) wrap.scrollTop = 0;
            });
        }
        return btn;
    }
    container.appendChild(mkBtn('first_page',   1,           current <= 1,      false, true));
    container.appendChild(mkBtn('chevron_left', current - 1, current <= 1,      false, true));
    paginationRange(current, total).forEach(function (item) {
        if (item === '...' || item === 'â€¦') {
            var el = document.createElement('span');
            el.className = 'dt-page-ellipsis';
            el.textContent = '...';
            container.appendChild(el);
        } else {
            container.appendChild(mkBtn(item, item, false, item === current, false));
        }
    });
    container.appendChild(mkBtn('chevron_right', current + 1, current >= total, false, true));
    container.appendChild(mkBtn('last_page',     total,       current >= total, false, true));
}

function downloadFloorQcExcel() {
    var headers = floorQcTableData.headers;
    var rows    = floorQcTableData.filteredRows;
    if (!headers.length && !rows.length) { showToast('info', 'No Data', 'There is no data to export.'); return; }
    var xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<?mso-application progid="Excel.Sheet"?>',
        '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"',
        '  xmlns:o="urn:schemas-microsoft-com:office:office"',
        '  xmlns:x="urn:schemas-microsoft-com:office:excel"',
        '  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
        '  <Styles>',
        '    <Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1A73E8" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1558B0"/><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1558B0"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1558B0"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1558B0"/></Borders></Style>',
        '    <Style ss:ID="Group0"><Font ss:Bold="1" ss:Color="#1E3A5F"/><Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/></Borders></Style>',
        '    <Style ss:ID="Group1"><Font ss:Bold="1" ss:Color="#1E3A5F"/><Interior ss:Color="#E0F2FE" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/></Borders></Style>',
        '    <Style ss:ID="Group2"><Font ss:Bold="1" ss:Color="#1E3A5F"/><Interior ss:Color="#ECFDF5" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/></Borders></Style>',
        '    <Style ss:ID="RowEven"><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/></Borders></Style>',
        '    <Style ss:ID="RowOdd"><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/></Borders></Style>',
        '    <Style ss:ID="RowNum"><Font ss:Color="#94A3B8"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/></Borders></Style>',
        '  </Styles>',
        '  <Worksheet ss:Name="Floor Supervisor QC">',
        '    <Table>'
    ];
    xml.push('      <Column ss:Width="40"/>');
    headers.forEach(function () { xml.push('      <Column ss:Width="130"/>'); });
    (floorQcTableData.headerGroups || []).forEach(function (groupRow, rowIndex) {
        var groupStyle = 'Group' + Math.min(rowIndex, 2);
        xml.push('      <Row ss:Height="28">');
        xml.push('        <Cell ss:StyleID="' + groupStyle + '"><Data ss:Type="String">' + (rowIndex === 0 ? '#' : '') + '</Data></Cell>');
        groupRow.forEach(function (group) {
            var span = Math.max(parseInt(group.colspan, 10) || 1, 1);
            xml.push('        <Cell ss:StyleID="' + groupStyle + '" ss:MergeAcross="' + (span - 1) + '"><Data ss:Type="String">' + xmlEsc(group.label || '') + '</Data></Cell>');
        });
        xml.push('      </Row>');
    });
    xml.push('      <Row ss:Height="22">');
    xml.push('        <Cell ss:StyleID="Header"><Data ss:Type="String">#</Data></Cell>');
    headers.forEach(function (h) { xml.push('        <Cell ss:StyleID="Header"><Data ss:Type="String">' + xmlEsc(h) + '</Data></Cell>'); });
    xml.push('      </Row>');
    rows.forEach(function (row, idx) {
        var style = idx % 2 === 0 ? 'RowEven' : 'RowOdd';
        xml.push('      <Row ss:Height="18">');
        xml.push('        <Cell ss:StyleID="RowNum"><Data ss:Type="Number">' + (idx + 1) + '</Data></Cell>');
        headers.forEach(function (header, ci) {
            var cell  = String(row[ci] !== undefined && row[ci] !== null ? row[ci] : '');
            var num   = Number(cell);
            var isNum = cell !== '' && !isNaN(num) && isFinite(num);
            if (isNum) {
                xml.push('        <Cell ss:StyleID="' + style + '"><Data ss:Type="Number">' + num + '</Data></Cell>');
            } else {
                xml.push('        <Cell ss:StyleID="' + style + '"><Data ss:Type="String">' + xmlEsc(cell) + '</Data></Cell>');
            }
        });
        xml.push('      </Row>');
    });
    xml.push('    </Table></Worksheet></Workbook>');
    var content  = xml.join('\n');
    var now      = new Date();
    var pad      = function (n) { return n < 10 ? '0' + n : '' + n; };
    var dateStr  = now.getFullYear() + '' + pad(now.getMonth() + 1) + '' + pad(now.getDate());
    var filename = 'Floor_Supervisor_In_Line_QC_Details_' + dateStr + '.xls';
    try {
        var blob = new Blob(['\uFEFF' + content], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href = url; a.download = filename; a.style.display = 'none';
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(url); document.body.removeChild(a); }, 300);
    } catch (e) {
        window.open('data:application/vnd.ms-excel;charset=utf-8,' + encodeURIComponent('\uFEFF' + content), '_blank');
    }
    showToast('success', 'Download Started', rows.length + ' row' + (rows.length !== 1 ? 's' : '') + ' exported to ' + filename);
}

// ===========================================================================
// BATCH LIST - Edge Paint Details
// ===========================================================================

var edgePaintTableData = {
    headers:       [],
    allRows:       [],
    filteredRows:  [],
    sortCol:       -1,
    sortAsc:       true,
    page:          1,
    pageSize:      25,
    searchQuery:   '',
    columnFilters: {},
    dateFrom:      '',
    dateTo:        ''
};

// The Google Sheet table starts at column B, so FMS Upload Timestamp is index 0.
function getEdgePaintDateColIndex() { return 0; }

function updateEdgePaintDateClearBtn() {
    var btn = document.getElementById('edge-paint-date-clear');
    if (btn) btn.style.display = (edgePaintTableData.dateFrom || edgePaintTableData.dateTo) ? '' : 'none';
}

function updateEdgePaintSearchClearBtn() {
    var s = document.getElementById('edge-paint-data-search');
    var b = document.getElementById('edge-paint-data-search-clear');
    if (s && b) b.style.display = s.value ? '' : 'none';
}

function fetchEdgePaintDetailsAndRender() {
    var emptyEl  = document.getElementById('edge-paint-data-empty');
    var tableEl  = document.getElementById('edge-paint-data-table');
    var footerEl = document.getElementById('edge-paint-data-footer');
    if (emptyEl)  { emptyEl.querySelector('p').textContent = 'Loading data...'; emptyEl.style.display = ''; }
    if (tableEl)  tableEl.style.display  = 'none';
    if (footerEl) footerEl.style.display = 'none';
    showSpinner('Fetching Edge Paint details...');
    if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
            .withSuccessHandler(function (r) { hideSpinner(); onEdgePaintDataLoaded(r); })
            .withFailureHandler(function (e) { hideSpinner(); onEdgePaintDataError(e.message || 'Failed to load data.'); })
            .getEdgePaintDetailsData();
        return;
    }
    jsonp({ action: 'getEdgePaintDetailsData' }, function (err, result) {
        hideSpinner();
        if (err) { onEdgePaintDataError(err.message); return; }
        onEdgePaintDataLoaded(result);
    });
}

function onEdgePaintDataLoaded(result) {
    if (!result || !result.success) {
        onEdgePaintDataError((result && result.error) || 'Failed to load data.');
        return;
    }
    edgePaintTableData.headers       = result.headers || [];
    edgePaintTableData.allRows       = result.rows    || [];
    edgePaintTableData.filteredRows  = edgePaintTableData.allRows.slice();
    edgePaintTableData.sortCol       = -1;
    edgePaintTableData.sortAsc       = true;
    edgePaintTableData.page          = 1;
    edgePaintTableData.searchQuery   = '';
    edgePaintTableData.columnFilters = {};
    edgePaintTableData.dateFrom      = '';
    edgePaintTableData.dateTo        = '';

    var s = document.getElementById('edge-paint-data-search');
    if (s) s.value = '';
    updateEdgePaintSearchClearBtn();

    var df = document.getElementById('edge-paint-date-from');
    var dt = document.getElementById('edge-paint-date-to');
    if (df) df.value = '';
    if (dt) dt.value = '';
    updateEdgePaintDateClearBtn();

    var labelEl = document.getElementById('edge-paint-date-col-label');
    var dateCol = getEdgePaintDateColIndex();
    if (labelEl && edgePaintTableData.headers[dateCol]) {
        labelEl.textContent = edgePaintTableData.headers[dateCol];
    }

    buildEdgePaintTableHeaders();
    renderEdgePaintTable();
}

function onEdgePaintDataError(msg) {
    var emptyEl = document.getElementById('edge-paint-data-empty');
    if (emptyEl) { emptyEl.querySelector('p').textContent = 'Error: ' + msg; emptyEl.style.display = ''; }
    var tableEl = document.getElementById('edge-paint-data-table');
    if (tableEl) tableEl.style.display = 'none';
    var footerEl = document.getElementById('edge-paint-data-footer');
    if (footerEl) footerEl.style.display = 'none';
    showToast('error', 'Data Error', msg);
}

function buildEdgePaintTableHeaders() {
    var thead = document.getElementById('edge-paint-data-thead');
    if (!thead) return;
    thead.innerHTML = '';

    var trHead = document.createElement('tr');
    var thNum  = document.createElement('th');
    thNum.className = 'dt-th dt-th-num';
    thNum.textContent = '#';
    trHead.appendChild(thNum);
    edgePaintTableData.headers.forEach(function (h, i) {
        var th = document.createElement('th');
        th.className = 'dt-th dt-th-sortable';
        th.setAttribute('data-edge-paint-col', i);
        th.innerHTML = esc(h) + '<span class="dt-sort-icon material-icons-round">unfold_more</span>';
        th.addEventListener('click', function () { onEdgePaintSortColumn(i); });
        trHead.appendChild(th);
    });

    var trFilter = document.createElement('tr');
    trFilter.className = 'dt-filter-row';
    var thFilterNum = document.createElement('th');
    thFilterNum.className = 'dt-filter-cell dt-filter-cell-num';
    thFilterNum.innerHTML = '<span class="material-icons-round" style="font-size:12px;opacity:.45;color:#94a3b8;">filter_list</span>';
    trFilter.appendChild(thFilterNum);

    edgePaintTableData.headers.forEach(function (h, i) {
        var th    = document.createElement('th');
        th.className = 'dt-filter-cell';
        var wrap  = document.createElement('div');
        wrap.className = 'dt-col-filter-wrap';
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'dt-col-filter';
        input.placeholder = 'Filter...';
        input.value = edgePaintTableData.columnFilters[i] || '';
        var clearBtn = document.createElement('button');
        clearBtn.className = 'dt-col-filter-clear';
        clearBtn.title = 'Clear filter';
        clearBtn.innerHTML = '<span class="material-icons-round">close</span>';
        clearBtn.style.display = input.value ? '' : 'none';
        input.addEventListener('input', function () {
            edgePaintTableData.columnFilters[i] = input.value;
            clearBtn.style.display = input.value ? '' : 'none';
            applyEdgePaintFilters();
        });
        clearBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            input.value = '';
            edgePaintTableData.columnFilters[i] = '';
            clearBtn.style.display = 'none';
            applyEdgePaintFilters();
            input.focus();
        });
        wrap.appendChild(input);
        wrap.appendChild(clearBtn);
        th.appendChild(wrap);
        trFilter.appendChild(th);
    });

    thead.appendChild(trFilter);
    thead.appendChild(trHead);
}

function onEdgePaintSortColumn(colIndex) {
    if (edgePaintTableData.sortCol === colIndex) {
        edgePaintTableData.sortAsc = !edgePaintTableData.sortAsc;
    } else {
        edgePaintTableData.sortCol = colIndex;
        edgePaintTableData.sortAsc = true;
    }
    updateEdgePaintSortIcons();
    applyEdgePaintFilters();
}

function updateEdgePaintSortIcons() {
    document.querySelectorAll('[data-edge-paint-col]').forEach(function (th) {
        var idx  = parseInt(th.getAttribute('data-edge-paint-col'), 10);
        var icon = th.querySelector('.dt-sort-icon');
        if (!icon) return;
        if (idx === edgePaintTableData.sortCol) {
            icon.textContent = edgePaintTableData.sortAsc ? 'arrow_upward' : 'arrow_downward';
            th.classList.add('dt-th-sorted');
        } else {
            icon.textContent = 'unfold_more';
            th.classList.remove('dt-th-sorted');
        }
    });
}

function applyEdgePaintFilters() {
    var query      = edgePaintTableData.searchQuery;
    var colFilters = edgePaintTableData.columnFilters;
    var dateColIdx = getEdgePaintDateColIndex();
    var dateFrom = edgePaintTableData.dateFrom ? new Date(edgePaintTableData.dateFrom + 'T00:00:00') : null;
    var dateTo = edgePaintTableData.dateTo ? new Date(edgePaintTableData.dateTo + 'T23:59:59') : null;
    var anyDateFilter = dateFrom || dateTo;

    edgePaintTableData.filteredRows = edgePaintTableData.allRows.filter(function (row) {
        if (query) {
            var rowMatch = row.some(function (cell) {
                return String(cell).toLowerCase().indexOf(query) !== -1;
            });
            if (!rowMatch) return false;
        }
        var colKeys = Object.keys(colFilters);
        for (var k = 0; k < colKeys.length; k++) {
            var ci = parseInt(colKeys[k], 10);
            var f  = (colFilters[colKeys[k]] || '').trim().toLowerCase();
            if (!f) continue;
            var cellVal = String(row[ci] !== undefined ? row[ci] : '').toLowerCase();
            if (cellVal.indexOf(f) === -1) return false;
        }
        if (anyDateFilter && dateColIdx >= 0 && dateColIdx < row.length) {
            var parsed = parseCreatedAt(row[dateColIdx]);
            if (!parsed) return false;
            if (dateFrom && parsed < dateFrom) return false;
            if (dateTo   && parsed > dateTo)   return false;
        }
        return true;
    });

    if (edgePaintTableData.sortCol >= 0) {
        var sc = edgePaintTableData.sortCol;
        edgePaintTableData.filteredRows.sort(function (a, b) {
            var av = (a[sc] || '').toString().toLowerCase();
            var bv = (b[sc] || '').toString().toLowerCase();
            var numA = parseFloat(av), numB = parseFloat(bv);
            var isNum = !isNaN(numA) && !isNaN(numB);
            var cmp = isNum ? (numA - numB) : av.localeCompare(bv);
            return edgePaintTableData.sortAsc ? cmp : -cmp;
        });
    }

    edgePaintTableData.page = 1;
    renderEdgePaintTable();
}

function applyEdgePaintSearch(query) {
    edgePaintTableData.searchQuery = (query || '').trim().toLowerCase();
    applyEdgePaintFilters();
}

function renderEdgePaintTable() {
    var tbody      = document.getElementById('edge-paint-data-tbody');
    var tableEl    = document.getElementById('edge-paint-data-table');
    var emptyEl    = document.getElementById('edge-paint-data-empty');
    var footerEl   = document.getElementById('edge-paint-data-footer');
    var countBadge = document.getElementById('edge-paint-data-count-badge');
    if (!tbody) return;

    var total      = edgePaintTableData.filteredRows.length;
    var pageSize   = edgePaintTableData.pageSize;
    var page       = edgePaintTableData.page;
    var totalPages = Math.ceil(total / pageSize) || 1;
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    edgePaintTableData.page = page;

    var start = (page - 1) * pageSize;
    var end   = Math.min(start + pageSize, total);
    var slice = edgePaintTableData.filteredRows.slice(start, end);

    if (countBadge) countBadge.textContent = total + ' record' + (total !== 1 ? 's' : '');
    if (emptyEl)  emptyEl.style.display  = 'none';
    if (tableEl)  tableEl.style.display  = '';
    if (footerEl) footerEl.style.display = total > 0 ? '' : 'none';
    tbody.innerHTML = '';

    if (total === 0) {
        var trEmpty = document.createElement('tr');
        var tdEmpty = document.createElement('td');
        tdEmpty.className = 'dt-td-empty-msg';
        tdEmpty.setAttribute('colspan', edgePaintTableData.headers.length + 1);
        var hasFilter = Object.keys(edgePaintTableData.columnFilters).some(function (k) {
            return (edgePaintTableData.columnFilters[k] || '').trim() !== '';
        });
        var hasDate = edgePaintTableData.dateFrom || edgePaintTableData.dateTo;
        tdEmpty.innerHTML =
            '<span class="material-icons-round" style="vertical-align:middle;margin-right:6px;font-size:18px;color:#64748b;">search_off</span>' +
            (edgePaintTableData.searchQuery || hasFilter || hasDate
                ? 'No records match the current filter.'
                : (edgePaintTableData.allRows.length === 0 ? 'No data found in Edge Paint Details.' : 'No records found.'));
        trEmpty.appendChild(tdEmpty);
        tbody.appendChild(trEmpty);
        var infoEl2 = document.getElementById('edge-paint-data-info');
        if (infoEl2) infoEl2.textContent = 'Showing 0 entries';
        return;
    }

    slice.forEach(function (row, idx) {
        var tr = document.createElement('tr');
        tr.className = (start + idx) % 2 === 0 ? 'dt-tr-even' : 'dt-tr-odd';
        var tdNum = document.createElement('td');
        tdNum.className = 'dt-td dt-td-num';
        tdNum.textContent = start + idx + 1;
        tr.appendChild(tdNum);
        edgePaintTableData.headers.forEach(function (header, ci) {
            var td = document.createElement('td');
            td.className = 'dt-td';
            var cellVal = String(row[ci] !== undefined && row[ci] !== null ? row[ci] : '');
            if (edgePaintTableData.searchQuery && cellVal.toLowerCase().indexOf(edgePaintTableData.searchQuery) !== -1) {
                td.innerHTML = esc(cellVal).replace(
                    new RegExp(escapeRegex(esc(edgePaintTableData.searchQuery)), 'gi'),
                    '<mark class="dt-highlight">$&</mark>'
                );
            } else {
                td.textContent = cellVal;
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    var infoEl = document.getElementById('edge-paint-data-info');
    if (infoEl) {
        infoEl.textContent = 'Showing ' + (start + 1) + ' to ' + end + ' of ' + total +
            (edgePaintTableData.allRows.length !== total ? ' (filtered from ' + edgePaintTableData.allRows.length + ' total)' : '') +
            ' entries';
    }
    buildEdgePaintPagination(page, totalPages);
}

function buildEdgePaintPagination(current, total) {
    var container = document.getElementById('edge-paint-data-pagination');
    if (!container) return;
    container.innerHTML = '';
    function mkBtn(label, page, disabled, active, isIcon) {
        var btn = document.createElement('button');
        btn.className = 'dt-page-btn' + (active ? ' dt-page-btn-active' : '') + (disabled ? ' dt-page-btn-disabled' : '');
        btn.innerHTML = isIcon ? '<span class="material-icons-round" style="font-size:16px;">' + label + '</span>' : label;
        btn.disabled  = disabled;
        if (!disabled) {
            btn.addEventListener('click', function () {
                edgePaintTableData.page = page;
                renderEdgePaintTable();
                var wrap = document.getElementById('edge-paint-data-table-wrap');
                if (wrap) wrap.scrollTop = 0;
            });
        }
        return btn;
    }
    container.appendChild(mkBtn('first_page',   1,           current <= 1,      false, true));
    container.appendChild(mkBtn('chevron_left', current - 1, current <= 1,      false, true));
    paginationRange(current, total).forEach(function (item) {
        if (item === '...' || item === 'â€¦') {
            var el = document.createElement('span');
            el.className = 'dt-page-ellipsis';
            el.textContent = '...';
            container.appendChild(el);
        } else {
            container.appendChild(mkBtn(item, item, false, item === current, false));
        }
    });
    container.appendChild(mkBtn('chevron_right', current + 1, current >= total, false, true));
    container.appendChild(mkBtn('last_page',     total,       current >= total, false, true));
}

function downloadEdgePaintExcel() {
    var headers = edgePaintTableData.headers;
    var rows    = edgePaintTableData.filteredRows;
    if (!headers.length && !rows.length) { showToast('info', 'No Data', 'There is no data to export.'); return; }
    var xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<?mso-application progid="Excel.Sheet"?>',
        '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"',
        '  xmlns:o="urn:schemas-microsoft-com:office:office"',
        '  xmlns:x="urn:schemas-microsoft-com:office:excel"',
        '  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
        '  <Styles>',
        '    <Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1A73E8" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1558B0"/><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1558B0"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1558B0"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1558B0"/></Borders></Style>',
        '    <Style ss:ID="RowEven"><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/></Borders></Style>',
        '    <Style ss:ID="RowOdd"><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/></Borders></Style>',
        '    <Style ss:ID="RowNum"><Font ss:Color="#94A3B8"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/></Borders></Style>',
        '  </Styles>',
        '  <Worksheet ss:Name="Edge Paint Details">',
        '    <Table>'
    ];
    xml.push('      <Column ss:Width="40"/>');
    headers.forEach(function () { xml.push('      <Column ss:Width="130"/>'); });
    xml.push('      <Row ss:Height="22">');
    xml.push('        <Cell ss:StyleID="Header"><Data ss:Type="String">#</Data></Cell>');
    headers.forEach(function (h) { xml.push('        <Cell ss:StyleID="Header"><Data ss:Type="String">' + xmlEsc(h) + '</Data></Cell>'); });
    xml.push('      </Row>');
    rows.forEach(function (row, idx) {
        var style = idx % 2 === 0 ? 'RowEven' : 'RowOdd';
        xml.push('      <Row ss:Height="18">');
        xml.push('        <Cell ss:StyleID="RowNum"><Data ss:Type="Number">' + (idx + 1) + '</Data></Cell>');
        headers.forEach(function (header, ci) {
            var cell  = String(row[ci] !== undefined && row[ci] !== null ? row[ci] : '');
            var num   = Number(cell);
            var isNum = cell !== '' && !isNaN(num) && isFinite(num);
            if (isNum) {
                xml.push('        <Cell ss:StyleID="' + style + '"><Data ss:Type="Number">' + num + '</Data></Cell>');
            } else {
                xml.push('        <Cell ss:StyleID="' + style + '"><Data ss:Type="String">' + xmlEsc(cell) + '</Data></Cell>');
            }
        });
        xml.push('      </Row>');
    });
    xml.push('    </Table></Worksheet></Workbook>');
    var content  = xml.join('\n');
    var now      = new Date();
    var pad      = function (n) { return n < 10 ? '0' + n : '' + n; };
    var dateStr  = now.getFullYear() + '' + pad(now.getMonth() + 1) + '' + pad(now.getDate());
    var filename = 'Edge_Paint_Details_' + dateStr + '.xls';
    try {
        var blob = new Blob(['\uFEFF' + content], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href = url; a.download = filename; a.style.display = 'none';
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(url); document.body.removeChild(a); }, 300);
    } catch (e) {
        window.open('data:application/vnd.ms-excel;charset=utf-8,' + encodeURIComponent('\uFEFF' + content), '_blank');
    }
    showToast('success', 'Download Started', rows.length + ' row' + (rows.length !== 1 ? 's' : '') + ' exported to ' + filename);
}

// ===========================================================================
// BATCH LIST - Pre-AQL Details
// ===========================================================================

var preAqlTableData = {
    headers:       [],
    allRows:       [],
    filteredRows:  [],
    sortCol:       -1,
    sortAsc:       true,
    page:          1,
    pageSize:      25,
    searchQuery:   '',
    columnFilters: {},
    dateFrom:      '',
    dateTo:        ''
};

// The Google Sheet table starts at column B, so FMS Upload Timestamp is index 0.
function getPreAqlDateColIndex() { return 0; }

function updatePreAqlDateClearBtn() {
    var btn = document.getElementById('pre-aql-date-clear');
    if (btn) btn.style.display = (preAqlTableData.dateFrom || preAqlTableData.dateTo) ? '' : 'none';
}

function updatePreAqlSearchClearBtn() {
    var s = document.getElementById('pre-aql-data-search');
    var b = document.getElementById('pre-aql-data-search-clear');
    if (s && b) b.style.display = s.value ? '' : 'none';
}

function fetchPreAqlDetailsAndRender() {
    var emptyEl  = document.getElementById('pre-aql-data-empty');
    var tableEl  = document.getElementById('pre-aql-data-table');
    var footerEl = document.getElementById('pre-aql-data-footer');
    if (emptyEl)  { emptyEl.querySelector('p').textContent = 'Loading data...'; emptyEl.style.display = ''; }
    if (tableEl)  tableEl.style.display  = 'none';
    if (footerEl) footerEl.style.display = 'none';
    showSpinner('Fetching Pre-AQL details...');
    if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
            .withSuccessHandler(function (r) { hideSpinner(); onPreAqlDataLoaded(r); })
            .withFailureHandler(function (e) { hideSpinner(); onPreAqlDataError(e.message || 'Failed to load data.'); })
            .getPreAqlDetailsData();
        return;
    }
    jsonp({ action: 'getPreAqlDetailsData' }, function (err, result) {
        hideSpinner();
        if (err) { onPreAqlDataError(err.message); return; }
        onPreAqlDataLoaded(result);
    });
}

function onPreAqlDataLoaded(result) {
    if (!result || !result.success) {
        onPreAqlDataError((result && result.error) || 'Failed to load data.');
        return;
    }
    preAqlTableData.headers       = result.headers || [];
    preAqlTableData.allRows       = result.rows    || [];
    preAqlTableData.filteredRows  = preAqlTableData.allRows.slice();
    preAqlTableData.sortCol       = -1;
    preAqlTableData.sortAsc       = true;
    preAqlTableData.page          = 1;
    preAqlTableData.searchQuery   = '';
    preAqlTableData.columnFilters = {};
    preAqlTableData.dateFrom      = '';
    preAqlTableData.dateTo        = '';

    var s = document.getElementById('pre-aql-data-search');
    if (s) s.value = '';
    updatePreAqlSearchClearBtn();

    var df = document.getElementById('pre-aql-date-from');
    var dt = document.getElementById('pre-aql-date-to');
    if (df) df.value = '';
    if (dt) dt.value = '';
    updatePreAqlDateClearBtn();

    var labelEl = document.getElementById('pre-aql-date-col-label');
    var dateCol = getPreAqlDateColIndex();
    if (labelEl && preAqlTableData.headers[dateCol]) {
        labelEl.textContent = preAqlTableData.headers[dateCol];
    }

    buildPreAqlTableHeaders();
    renderPreAqlTable();
}

function onPreAqlDataError(msg) {
    var emptyEl = document.getElementById('pre-aql-data-empty');
    if (emptyEl) { emptyEl.querySelector('p').textContent = 'Error: ' + msg; emptyEl.style.display = ''; }
    var tableEl = document.getElementById('pre-aql-data-table');
    if (tableEl) tableEl.style.display = 'none';
    var footerEl = document.getElementById('pre-aql-data-footer');
    if (footerEl) footerEl.style.display = 'none';
    showToast('error', 'Data Error', msg);
}

function buildPreAqlTableHeaders() {
    var thead = document.getElementById('pre-aql-data-thead');
    if (!thead) return;
    thead.innerHTML = '';

    var trHead = document.createElement('tr');
    var thNum  = document.createElement('th');
    thNum.className = 'dt-th dt-th-num';
    thNum.textContent = '#';
    trHead.appendChild(thNum);
    preAqlTableData.headers.forEach(function (h, i) {
        var th = document.createElement('th');
        th.className = 'dt-th dt-th-sortable';
        th.setAttribute('data-pre-aql-col', i);
        th.innerHTML = esc(h) + '<span class="dt-sort-icon material-icons-round">unfold_more</span>';
        th.addEventListener('click', function () { onPreAqlSortColumn(i); });
        trHead.appendChild(th);
    });

    var trFilter = document.createElement('tr');
    trFilter.className = 'dt-filter-row';
    var thFilterNum = document.createElement('th');
    thFilterNum.className = 'dt-filter-cell dt-filter-cell-num';
    thFilterNum.innerHTML = '<span class="material-icons-round" style="font-size:12px;opacity:.45;color:#94a3b8;">filter_list</span>';
    trFilter.appendChild(thFilterNum);

    preAqlTableData.headers.forEach(function (h, i) {
        var th    = document.createElement('th');
        th.className = 'dt-filter-cell';
        var wrap  = document.createElement('div');
        wrap.className = 'dt-col-filter-wrap';
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'dt-col-filter';
        input.placeholder = 'Filter...';
        input.value = preAqlTableData.columnFilters[i] || '';
        var clearBtn = document.createElement('button');
        clearBtn.className = 'dt-col-filter-clear';
        clearBtn.title = 'Clear filter';
        clearBtn.innerHTML = '<span class="material-icons-round">close</span>';
        clearBtn.style.display = input.value ? '' : 'none';
        input.addEventListener('input', function () {
            preAqlTableData.columnFilters[i] = input.value;
            clearBtn.style.display = input.value ? '' : 'none';
            applyPreAqlFilters();
        });
        clearBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            input.value = '';
            preAqlTableData.columnFilters[i] = '';
            clearBtn.style.display = 'none';
            applyPreAqlFilters();
            input.focus();
        });
        wrap.appendChild(input);
        wrap.appendChild(clearBtn);
        th.appendChild(wrap);
        trFilter.appendChild(th);
    });

    thead.appendChild(trFilter);
    thead.appendChild(trHead);
}

function onPreAqlSortColumn(colIndex) {
    if (preAqlTableData.sortCol === colIndex) {
        preAqlTableData.sortAsc = !preAqlTableData.sortAsc;
    } else {
        preAqlTableData.sortCol = colIndex;
        preAqlTableData.sortAsc = true;
    }
    updatePreAqlSortIcons();
    applyPreAqlFilters();
}

function updatePreAqlSortIcons() {
    document.querySelectorAll('[data-pre-aql-col]').forEach(function (th) {
        var idx  = parseInt(th.getAttribute('data-pre-aql-col'), 10);
        var icon = th.querySelector('.dt-sort-icon');
        if (!icon) return;
        if (idx === preAqlTableData.sortCol) {
            icon.textContent = preAqlTableData.sortAsc ? 'arrow_upward' : 'arrow_downward';
            th.classList.add('dt-th-sorted');
        } else {
            icon.textContent = 'unfold_more';
            th.classList.remove('dt-th-sorted');
        }
    });
}

function applyPreAqlFilters() {
    var query      = preAqlTableData.searchQuery;
    var colFilters = preAqlTableData.columnFilters;
    var dateColIdx = getPreAqlDateColIndex();
    var dateFrom = preAqlTableData.dateFrom ? new Date(preAqlTableData.dateFrom + 'T00:00:00') : null;
    var dateTo = preAqlTableData.dateTo ? new Date(preAqlTableData.dateTo + 'T23:59:59') : null;
    var anyDateFilter = dateFrom || dateTo;

    preAqlTableData.filteredRows = preAqlTableData.allRows.filter(function (row) {
        if (query) {
            var rowMatch = row.some(function (cell) {
                return String(cell).toLowerCase().indexOf(query) !== -1;
            });
            if (!rowMatch) return false;
        }
        var colKeys = Object.keys(colFilters);
        for (var k = 0; k < colKeys.length; k++) {
            var ci = parseInt(colKeys[k], 10);
            var f  = (colFilters[colKeys[k]] || '').trim().toLowerCase();
            if (!f) continue;
            var cellVal = String(row[ci] !== undefined ? row[ci] : '').toLowerCase();
            if (cellVal.indexOf(f) === -1) return false;
        }
        if (anyDateFilter && dateColIdx >= 0 && dateColIdx < row.length) {
            var parsed = parseCreatedAt(row[dateColIdx]);
            if (!parsed) return false;
            if (dateFrom && parsed < dateFrom) return false;
            if (dateTo   && parsed > dateTo)   return false;
        }
        return true;
    });

    if (preAqlTableData.sortCol >= 0) {
        var sc = preAqlTableData.sortCol;
        preAqlTableData.filteredRows.sort(function (a, b) {
            var av = (a[sc] || '').toString().toLowerCase();
            var bv = (b[sc] || '').toString().toLowerCase();
            var numA = parseFloat(av), numB = parseFloat(bv);
            var isNum = !isNaN(numA) && !isNaN(numB);
            var cmp = isNum ? (numA - numB) : av.localeCompare(bv);
            return preAqlTableData.sortAsc ? cmp : -cmp;
        });
    }

    preAqlTableData.page = 1;
    renderPreAqlTable();
}

function applyPreAqlSearch(query) {
    preAqlTableData.searchQuery = (query || '').trim().toLowerCase();
    applyPreAqlFilters();
}

function renderPreAqlTable() {
    var tbody      = document.getElementById('pre-aql-data-tbody');
    var tableEl    = document.getElementById('pre-aql-data-table');
    var emptyEl    = document.getElementById('pre-aql-data-empty');
    var footerEl   = document.getElementById('pre-aql-data-footer');
    var countBadge = document.getElementById('pre-aql-data-count-badge');
    if (!tbody) return;

    var total      = preAqlTableData.filteredRows.length;
    var pageSize   = preAqlTableData.pageSize;
    var page       = preAqlTableData.page;
    var totalPages = Math.ceil(total / pageSize) || 1;
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    preAqlTableData.page = page;

    var start = (page - 1) * pageSize;
    var end   = Math.min(start + pageSize, total);
    var slice = preAqlTableData.filteredRows.slice(start, end);

    if (countBadge) countBadge.textContent = total + ' record' + (total !== 1 ? 's' : '');
    if (emptyEl)  emptyEl.style.display  = 'none';
    if (tableEl)  tableEl.style.display  = '';
    if (footerEl) footerEl.style.display = total > 0 ? '' : 'none';
    tbody.innerHTML = '';

    if (total === 0) {
        var trEmpty = document.createElement('tr');
        var tdEmpty = document.createElement('td');
        tdEmpty.className = 'dt-td-empty-msg';
        tdEmpty.setAttribute('colspan', preAqlTableData.headers.length + 1);
        var hasFilter = Object.keys(preAqlTableData.columnFilters).some(function (k) {
            return (preAqlTableData.columnFilters[k] || '').trim() !== '';
        });
        var hasDate = preAqlTableData.dateFrom || preAqlTableData.dateTo;
        tdEmpty.innerHTML =
            '<span class="material-icons-round" style="vertical-align:middle;margin-right:6px;font-size:18px;color:#64748b;">search_off</span>' +
            (preAqlTableData.searchQuery || hasFilter || hasDate
                ? 'No records match the current filter.'
                : (preAqlTableData.allRows.length === 0 ? 'No data found in Pre-AQL Details.' : 'No records found.'));
        trEmpty.appendChild(tdEmpty);
        tbody.appendChild(trEmpty);
        var infoEl2 = document.getElementById('pre-aql-data-info');
        if (infoEl2) infoEl2.textContent = 'Showing 0 entries';
        return;
    }

    slice.forEach(function (row, idx) {
        var tr = document.createElement('tr');
        tr.className = (start + idx) % 2 === 0 ? 'dt-tr-even' : 'dt-tr-odd';
        var tdNum = document.createElement('td');
        tdNum.className = 'dt-td dt-td-num';
        tdNum.textContent = start + idx + 1;
        tr.appendChild(tdNum);
        preAqlTableData.headers.forEach(function (header, ci) {
            var td = document.createElement('td');
            td.className = 'dt-td';
            var cellVal = String(row[ci] !== undefined && row[ci] !== null ? row[ci] : '');
            if (preAqlTableData.searchQuery && cellVal.toLowerCase().indexOf(preAqlTableData.searchQuery) !== -1) {
                td.innerHTML = esc(cellVal).replace(
                    new RegExp(escapeRegex(esc(preAqlTableData.searchQuery)), 'gi'),
                    '<mark class="dt-highlight">$&</mark>'
                );
            } else {
                td.textContent = cellVal;
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    var infoEl = document.getElementById('pre-aql-data-info');
    if (infoEl) {
        infoEl.textContent = 'Showing ' + (start + 1) + ' to ' + end + ' of ' + total +
            (preAqlTableData.allRows.length !== total ? ' (filtered from ' + preAqlTableData.allRows.length + ' total)' : '') +
            ' entries';
    }
    buildPreAqlPagination(page, totalPages);
}

function buildPreAqlPagination(current, total) {
    var container = document.getElementById('pre-aql-data-pagination');
    if (!container) return;
    container.innerHTML = '';
    function mkBtn(label, page, disabled, active, isIcon) {
        var btn = document.createElement('button');
        btn.className = 'dt-page-btn' + (active ? ' dt-page-btn-active' : '') + (disabled ? ' dt-page-btn-disabled' : '');
        btn.innerHTML = isIcon ? '<span class="material-icons-round" style="font-size:16px;">' + label + '</span>' : label;
        btn.disabled  = disabled;
        if (!disabled) {
            btn.addEventListener('click', function () {
                preAqlTableData.page = page;
                renderPreAqlTable();
                var wrap = document.getElementById('pre-aql-data-table-wrap');
                if (wrap) wrap.scrollTop = 0;
            });
        }
        return btn;
    }
    container.appendChild(mkBtn('first_page',   1,           current <= 1,      false, true));
    container.appendChild(mkBtn('chevron_left', current - 1, current <= 1,      false, true));
    paginationRange(current, total).forEach(function (item) {
        if (item === '...' || item === 'â€¦') {
            var el = document.createElement('span');
            el.className = 'dt-page-ellipsis';
            el.textContent = '...';
            container.appendChild(el);
        } else {
            container.appendChild(mkBtn(item, item, false, item === current, false));
        }
    });
    container.appendChild(mkBtn('chevron_right', current + 1, current >= total, false, true));
    container.appendChild(mkBtn('last_page',     total,       current >= total, false, true));
}

function downloadPreAqlExcel() {
    var headers = preAqlTableData.headers;
    var rows    = preAqlTableData.filteredRows;
    if (!headers.length && !rows.length) { showToast('info', 'No Data', 'There is no data to export.'); return; }
    var xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<?mso-application progid="Excel.Sheet"?>',
        '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"',
        '  xmlns:o="urn:schemas-microsoft-com:office:office"',
        '  xmlns:x="urn:schemas-microsoft-com:office:excel"',
        '  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
        '  <Styles>',
        '    <Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1A73E8" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1558B0"/><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1558B0"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1558B0"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1558B0"/></Borders></Style>',
        '    <Style ss:ID="RowEven"><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/></Borders></Style>',
        '    <Style ss:ID="RowOdd"><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/></Borders></Style>',
        '    <Style ss:ID="RowNum"><Font ss:Color="#94A3B8"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/></Borders></Style>',
        '  </Styles>',
        '  <Worksheet ss:Name="Pre-AQL Details">',
        '    <Table>'
    ];
    xml.push('      <Column ss:Width="40"/>');
    headers.forEach(function () { xml.push('      <Column ss:Width="130"/>'); });
    xml.push('      <Row ss:Height="22">');
    xml.push('        <Cell ss:StyleID="Header"><Data ss:Type="String">#</Data></Cell>');
    headers.forEach(function (h) { xml.push('        <Cell ss:StyleID="Header"><Data ss:Type="String">' + xmlEsc(h) + '</Data></Cell>'); });
    xml.push('      </Row>');
    rows.forEach(function (row, idx) {
        var style = idx % 2 === 0 ? 'RowEven' : 'RowOdd';
        xml.push('      <Row ss:Height="18">');
        xml.push('        <Cell ss:StyleID="RowNum"><Data ss:Type="Number">' + (idx + 1) + '</Data></Cell>');
        headers.forEach(function (header, ci) {
            var cell  = String(row[ci] !== undefined && row[ci] !== null ? row[ci] : '');
            var num   = Number(cell);
            var isNum = cell !== '' && !isNaN(num) && isFinite(num);
            if (isNum) {
                xml.push('        <Cell ss:StyleID="' + style + '"><Data ss:Type="Number">' + num + '</Data></Cell>');
            } else {
                xml.push('        <Cell ss:StyleID="' + style + '"><Data ss:Type="String">' + xmlEsc(cell) + '</Data></Cell>');
            }
        });
        xml.push('      </Row>');
    });
    xml.push('    </Table></Worksheet></Workbook>');
    var content  = xml.join('\n');
    var now      = new Date();
    var pad      = function (n) { return n < 10 ? '0' + n : '' + n; };
    var dateStr  = now.getFullYear() + '' + pad(now.getMonth() + 1) + '' + pad(now.getDate());
    var filename = 'Pre_AQL_Details_' + dateStr + '.xls';
    try {
        var blob = new Blob(['\uFEFF' + content], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href = url; a.download = filename; a.style.display = 'none';
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(url); document.body.removeChild(a); }, 300);
    } catch (e) {
        window.open('data:application/vnd.ms-excel;charset=utf-8,' + encodeURIComponent('\uFEFF' + content), '_blank');
    }
    showToast('success', 'Download Started', rows.length + ' row' + (rows.length !== 1 ? 's' : '') + ' exported to ' + filename);
}


function initBatchList() {
    var kpiCard = document.getElementById('kpi-cutting-details');
    if (kpiCard) {
        kpiCard.addEventListener('click', function () { showBatchListCuttingView(); });
        kpiCard.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showBatchListCuttingView(); }
        });
    }
    var backBtn = document.getElementById('btn-back-batch-list');
    if (backBtn) backBtn.addEventListener('click', function () { showBatchListKpiView(); });

    var excelBtn = document.getElementById('btn-download-cutting-excel');
    if (excelBtn) excelBtn.addEventListener('click', function () { downloadCuttingExcel(); });

    var refreshBtn = document.getElementById('btn-refresh-cutting-data');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function () {
            cuttingTableData.allRows       = [];
            cuttingTableData.columnFilters = {};
            fetchCuttingDetailsAndRender();
        });
    }

    // ── Bantala KPI card ────────────────────────────────────────────────────
    var bantalaCard = document.getElementById('kpi-bantala-details');
    if (bantalaCard) {
        bantalaCard.addEventListener('click', function () { showBatchListBantalaView(); });
        bantalaCard.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showBatchListBantalaView(); }
        });
    }

    var bantalaBackBtn = document.getElementById('btn-back-bantala');
    if (bantalaBackBtn) bantalaBackBtn.addEventListener('click', function () { showBatchListKpiView(); });

    var bantalaExcelBtn = document.getElementById('btn-download-bantala-excel');
    if (bantalaExcelBtn) bantalaExcelBtn.addEventListener('click', function () { downloadBantalaExcel(); });

    var bantalaRefreshBtn = document.getElementById('btn-refresh-bantala-data');
    if (bantalaRefreshBtn) {
        bantalaRefreshBtn.addEventListener('click', function () {
            bantalaTableData.allRows       = [];
            bantalaTableData.columnFilters = {};
            fetchBantalaDetailsAndRender();
        });
    }

    var floorQcCard = document.getElementById('kpi-floor-qc-details');
    if (floorQcCard) {
        floorQcCard.addEventListener('click', function () { showBatchListFloorQcView(); });
        floorQcCard.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showBatchListFloorQcView(); }
        });
    }

    var floorQcBackBtn = document.getElementById('btn-back-floor-qc');
    if (floorQcBackBtn) floorQcBackBtn.addEventListener('click', function () { showBatchListKpiView(); });

    var floorQcExcelBtn = document.getElementById('btn-download-floor-qc-excel');
    if (floorQcExcelBtn) floorQcExcelBtn.addEventListener('click', function () { downloadFloorQcExcel(); });

    var floorQcRefreshBtn = document.getElementById('btn-refresh-floor-qc-data');
    if (floorQcRefreshBtn) {
        floorQcRefreshBtn.addEventListener('click', function () {
            floorQcTableData.allRows       = [];
            floorQcTableData.columnFilters = {};
            fetchFloorQcDetailsAndRender();
        });
    }

    var floorQcSearchEl = document.getElementById('floor-qc-data-search');
    if (floorQcSearchEl) {
        floorQcSearchEl.addEventListener('input', function () {
            updateFloorQcSearchClearBtn();
            applyFloorQcSearch(floorQcSearchEl.value);
        });
    }
    var floorQcClearSearch = document.getElementById('floor-qc-data-search-clear');
    if (floorQcClearSearch) {
        floorQcClearSearch.addEventListener('click', function () {
            var s = document.getElementById('floor-qc-data-search');
            if (s) { s.value = ''; s.focus(); }
            updateFloorQcSearchClearBtn();
            applyFloorQcSearch('');
        });
    }

    var floorQcDateFrom = document.getElementById('floor-qc-date-from');
    if (floorQcDateFrom) {
        floorQcDateFrom.addEventListener('change', function () {
            floorQcTableData.dateFrom = floorQcDateFrom.value;
            updateFloorQcDateClearBtn();
            applyFloorQcFilters();
        });
    }
    var floorQcDateTo = document.getElementById('floor-qc-date-to');
    if (floorQcDateTo) {
        floorQcDateTo.addEventListener('change', function () {
            floorQcTableData.dateTo = floorQcDateTo.value;
            updateFloorQcDateClearBtn();
            applyFloorQcFilters();
        });
    }
    var floorQcDateClear = document.getElementById('floor-qc-date-clear');
    if (floorQcDateClear) {
        floorQcDateClear.addEventListener('click', function () {
            floorQcTableData.dateFrom = '';
            floorQcTableData.dateTo   = '';
            var f = document.getElementById('floor-qc-date-from');
            var t = document.getElementById('floor-qc-date-to');
            if (f) f.value = '';
            if (t) t.value = '';
            updateFloorQcDateClearBtn();
            applyFloorQcFilters();
        });
    }

    var floorQcPageSize = document.getElementById('floor-qc-data-page-size');
    if (floorQcPageSize) {
        floorQcPageSize.addEventListener('change', function () {
            floorQcTableData.pageSize = parseInt(floorQcPageSize.value, 10) || 25;
            floorQcTableData.page = 1;
            renderFloorQcTable();
        });
    }

    var edgePaintCard = document.getElementById('kpi-edge-paint-details');
    if (edgePaintCard) {
        edgePaintCard.addEventListener('click', function () { showBatchListEdgePaintView(); });
        edgePaintCard.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showBatchListEdgePaintView(); }
        });
    }

    var edgePaintBackBtn = document.getElementById('btn-back-edge-paint');
    if (edgePaintBackBtn) edgePaintBackBtn.addEventListener('click', function () { showBatchListKpiView(); });

    var edgePaintExcelBtn = document.getElementById('btn-download-edge-paint-excel');
    if (edgePaintExcelBtn) edgePaintExcelBtn.addEventListener('click', function () { downloadEdgePaintExcel(); });

    var edgePaintRefreshBtn = document.getElementById('btn-refresh-edge-paint-data');
    if (edgePaintRefreshBtn) {
        edgePaintRefreshBtn.addEventListener('click', function () {
            edgePaintTableData.allRows       = [];
            edgePaintTableData.columnFilters = {};
            fetchEdgePaintDetailsAndRender();
        });
    }

    var edgePaintSearchEl = document.getElementById('edge-paint-data-search');
    if (edgePaintSearchEl) {
        edgePaintSearchEl.addEventListener('input', function () {
            updateEdgePaintSearchClearBtn();
            applyEdgePaintSearch(edgePaintSearchEl.value);
        });
    }
    var edgePaintClearSearch = document.getElementById('edge-paint-data-search-clear');
    if (edgePaintClearSearch) {
        edgePaintClearSearch.addEventListener('click', function () {
            var s = document.getElementById('edge-paint-data-search');
            if (s) { s.value = ''; s.focus(); }
            updateEdgePaintSearchClearBtn();
            applyEdgePaintSearch('');
        });
    }

    var edgePaintDateFrom = document.getElementById('edge-paint-date-from');
    if (edgePaintDateFrom) {
        edgePaintDateFrom.addEventListener('change', function () {
            edgePaintTableData.dateFrom = edgePaintDateFrom.value;
            updateEdgePaintDateClearBtn();
            applyEdgePaintFilters();
        });
    }
    var edgePaintDateTo = document.getElementById('edge-paint-date-to');
    if (edgePaintDateTo) {
        edgePaintDateTo.addEventListener('change', function () {
            edgePaintTableData.dateTo = edgePaintDateTo.value;
            updateEdgePaintDateClearBtn();
            applyEdgePaintFilters();
        });
    }
    var edgePaintDateClear = document.getElementById('edge-paint-date-clear');
    if (edgePaintDateClear) {
        edgePaintDateClear.addEventListener('click', function () {
            edgePaintTableData.dateFrom = '';
            edgePaintTableData.dateTo   = '';
            var f = document.getElementById('edge-paint-date-from');
            var t = document.getElementById('edge-paint-date-to');
            if (f) f.value = '';
            if (t) t.value = '';
            updateEdgePaintDateClearBtn();
            applyEdgePaintFilters();
        });
    }

    var edgePaintPageSize = document.getElementById('edge-paint-data-page-size');
    if (edgePaintPageSize) {
        edgePaintPageSize.addEventListener('change', function () {
            edgePaintTableData.pageSize = parseInt(edgePaintPageSize.value, 10) || 25;
            edgePaintTableData.page = 1;
            renderEdgePaintTable();
        });
    }

    var preAqlCard = document.getElementById('kpi-pre-aql-details');
    if (preAqlCard) {
        preAqlCard.addEventListener('click', function () { showBatchListPreAqlView(); });
        preAqlCard.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showBatchListPreAqlView(); }
        });
    }

    var preAqlBackBtn = document.getElementById('btn-back-pre-aql');
    if (preAqlBackBtn) preAqlBackBtn.addEventListener('click', function () { showBatchListKpiView(); });

    var preAqlExcelBtn = document.getElementById('btn-download-pre-aql-excel');
    if (preAqlExcelBtn) preAqlExcelBtn.addEventListener('click', function () { downloadPreAqlExcel(); });

    var preAqlRefreshBtn = document.getElementById('btn-refresh-pre-aql-data');
    if (preAqlRefreshBtn) {
        preAqlRefreshBtn.addEventListener('click', function () {
            preAqlTableData.allRows       = [];
            preAqlTableData.columnFilters = {};
            fetchPreAqlDetailsAndRender();
        });
    }

    var preAqlSearchEl = document.getElementById('pre-aql-data-search');
    if (preAqlSearchEl) {
        preAqlSearchEl.addEventListener('input', function () {
            updatePreAqlSearchClearBtn();
            applyPreAqlSearch(preAqlSearchEl.value);
        });
    }
    var preAqlClearSearch = document.getElementById('pre-aql-data-search-clear');
    if (preAqlClearSearch) {
        preAqlClearSearch.addEventListener('click', function () {
            var s = document.getElementById('pre-aql-data-search');
            if (s) { s.value = ''; s.focus(); }
            updatePreAqlSearchClearBtn();
            applyPreAqlSearch('');
        });
    }

    var preAqlDateFrom = document.getElementById('pre-aql-date-from');
    if (preAqlDateFrom) {
        preAqlDateFrom.addEventListener('change', function () {
            preAqlTableData.dateFrom = preAqlDateFrom.value;
            updatePreAqlDateClearBtn();
            applyPreAqlFilters();
        });
    }
    var preAqlDateTo = document.getElementById('pre-aql-date-to');
    if (preAqlDateTo) {
        preAqlDateTo.addEventListener('change', function () {
            preAqlTableData.dateTo = preAqlDateTo.value;
            updatePreAqlDateClearBtn();
            applyPreAqlFilters();
        });
    }
    var preAqlDateClear = document.getElementById('pre-aql-date-clear');
    if (preAqlDateClear) {
        preAqlDateClear.addEventListener('click', function () {
            preAqlTableData.dateFrom = '';
            preAqlTableData.dateTo   = '';
            var f = document.getElementById('pre-aql-date-from');
            var t = document.getElementById('pre-aql-date-to');
            if (f) f.value = '';
            if (t) t.value = '';
            updatePreAqlDateClearBtn();
            applyPreAqlFilters();
        });
    }

    var preAqlPageSize = document.getElementById('pre-aql-data-page-size');
    if (preAqlPageSize) {
        preAqlPageSize.addEventListener('change', function () {
            preAqlTableData.pageSize = parseInt(preAqlPageSize.value, 10) || 25;
            preAqlTableData.page = 1;
            renderPreAqlTable();
        });
    }

    var bantalaSearchEl = document.getElementById('bantala-data-search');
    if (bantalaSearchEl) {
        bantalaSearchEl.addEventListener('input', function () {
            updateBantalaSearchClearBtn();
            applyBantalaSearch(bantalaSearchEl.value);
        });
    }
    var bantalaClearSearch = document.getElementById('bantala-data-search-clear');
    if (bantalaClearSearch) {
        bantalaClearSearch.addEventListener('click', function () {
            var s = document.getElementById('bantala-data-search');
            if (s) { s.value = ''; s.focus(); }
            updateBantalaSearchClearBtn();
            applyBantalaSearch('');
        });
    }

    var bantalaDateFrom = document.getElementById('bantala-date-from');
    if (bantalaDateFrom) {
        bantalaDateFrom.addEventListener('change', function () {
            bantalaTableData.dateFrom = bantalaDateFrom.value;
            updateBantalaDateClearBtn();
            applyBantalaFilters();
        });
    }
    var bantalaDateTo = document.getElementById('bantala-date-to');
    if (bantalaDateTo) {
        bantalaDateTo.addEventListener('change', function () {
            bantalaTableData.dateTo = bantalaDateTo.value;
            updateBantalaDateClearBtn();
            applyBantalaFilters();
        });
    }
    var bantalaDateClear = document.getElementById('bantala-date-clear');
    if (bantalaDateClear) {
        bantalaDateClear.addEventListener('click', function () {
            bantalaTableData.dateFrom = '';
            bantalaTableData.dateTo   = '';
            var f = document.getElementById('bantala-date-from');
            var t = document.getElementById('bantala-date-to');
            if (f) f.value = '';
            if (t) t.value = '';
            updateBantalaDateClearBtn();
            applyBantalaFilters();
        });
    }

    var bantalaPageSize = document.getElementById('bantala-data-page-size');
    if (bantalaPageSize) {
        bantalaPageSize.addEventListener('change', function () {
            bantalaTableData.pageSize = parseInt(bantalaPageSize.value, 10) || 25;
            bantalaTableData.page = 1;
            renderBantalaTable();
        });
    }
    var searchEl = document.getElementById('cutting-data-search');
    if (searchEl) {
        searchEl.addEventListener('input', function () {
            updateCuttingSearchClearBtn();
            applyCuttingSearch(searchEl.value);
        });
    }
    var clearSearchBtn = document.getElementById('cutting-data-search-clear');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function () {
            var s = document.getElementById('cutting-data-search');
            if (s) { s.value = ''; s.focus(); }
            updateCuttingSearchClearBtn();
            applyCuttingSearch('');
        });
    }

    // Date range — From
    var cdfEl = document.getElementById('cutting-date-from');
    if (cdfEl) {
        cdfEl.addEventListener('change', function () {
            cuttingTableData.dateFrom = cdfEl.value;
            updateCuttingDateClearBtn();
            applyCuttingFilters();
        });
    }

    // Date range — To
    var cdtEl = document.getElementById('cutting-date-to');
    if (cdtEl) {
        cdtEl.addEventListener('change', function () {
            cuttingTableData.dateTo = cdtEl.value;
            updateCuttingDateClearBtn();
            applyCuttingFilters();
        });
    }

    // Date clear
    var cdClearBtn = document.getElementById('cutting-date-clear');
    if (cdClearBtn) {
        cdClearBtn.addEventListener('click', function () {
            cuttingTableData.dateFrom = '';
            cuttingTableData.dateTo   = '';
            var f = document.getElementById('cutting-date-from');
            var t = document.getElementById('cutting-date-to');
            if (f) f.value = '';
            if (t) t.value = '';
            updateCuttingDateClearBtn();
            applyCuttingFilters();
        });
    }

    var pageSizeEl = document.getElementById('cutting-data-page-size');
    if (pageSizeEl) {
        pageSizeEl.addEventListener('change', function () {
            cuttingTableData.pageSize = parseInt(pageSizeEl.value, 10) || 25;
            cuttingTableData.page = 1;
            renderCuttingTable();
        });
    }
}


// ===========================================================================
// BATCH LIST — Bantala Details
// ===========================================================================

var bantalaTableData = {
    headers:       [],
    allRows:       [],
    filteredRows:  [],
    sortCol:       -1,
    sortAsc:       true,
    page:          1,
    pageSize:      25,
    searchQuery:   '',
    columnFilters: {},
    dateFrom:      '',   // YYYY-MM-DD — filters on Column C (date column)
    dateTo:        ''    // YYYY-MM-DD — filters on Column C (date column)
};

// Column C (index 2) is always the date column per the sheet layout
function getBantalaDateColIndex() { return 2; }

function updateBantalaDateClearBtn() {
    var btn = document.getElementById('bantala-date-clear');
    if (btn) btn.style.display = (bantalaTableData.dateFrom || bantalaTableData.dateTo) ? '' : 'none';
}

function updateBantalaSearchClearBtn() {
    var s = document.getElementById('bantala-data-search');
    var b = document.getElementById('bantala-data-search-clear');
    if (s && b) b.style.display = s.value ? '' : 'none';
}

function fetchBantalaDetailsAndRender() {
    var emptyEl  = document.getElementById('bantala-data-empty');
    var tableEl  = document.getElementById('bantala-data-table');
    var footerEl = document.getElementById('bantala-data-footer');
    if (emptyEl)  { emptyEl.querySelector('p').textContent = 'Loading data…'; emptyEl.style.display = ''; }
    if (tableEl)  tableEl.style.display  = 'none';
    if (footerEl) footerEl.style.display = 'none';
    showSpinner('Fetching Bantala details…');
    if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
            .withSuccessHandler(function (r) { hideSpinner(); onBantalaDataLoaded(r); })
            .withFailureHandler(function (e) { hideSpinner(); onBantalaDataError(e.message || 'Failed to load data.'); })
            .getBantalaDetailsData();
        return;
    }
    jsonp({ action: 'getBantalaDetailsData' }, function (err, result) {
        hideSpinner();
        if (err) { onBantalaDataError(err.message); return; }
        onBantalaDataLoaded(result);
    });
}

function onBantalaDataLoaded(result) {
    if (!result || !result.success) {
        onBantalaDataError((result && result.error) || 'Failed to load data.');
        return;
    }
    bantalaTableData.headers       = result.headers || [];
    bantalaTableData.allRows       = result.rows    || [];
    bantalaTableData.filteredRows  = bantalaTableData.allRows.slice();
    bantalaTableData.sortCol       = -1;
    bantalaTableData.sortAsc       = true;
    bantalaTableData.page          = 1;
    bantalaTableData.searchQuery   = '';
    bantalaTableData.columnFilters = {};
    bantalaTableData.dateFrom      = '';
    bantalaTableData.dateTo        = '';

    var s = document.getElementById('bantala-data-search');
    if (s) s.value = '';
    updateBantalaSearchClearBtn();

    var df = document.getElementById('bantala-date-from');
    var dt = document.getElementById('bantala-date-to');
    if (df) df.value = '';
    if (dt) dt.value = '';
    updateBantalaDateClearBtn();

    // Update date label to reflect actual column C header (if available)
    var labelEl = document.getElementById('bantala-date-col-label');
    if (labelEl && bantalaTableData.headers[2]) {
        labelEl.textContent = bantalaTableData.headers[2];
    }

    buildBantalaTableHeaders();
    renderBantalaTable();
}

function onBantalaDataError(msg) {
    var emptyEl = document.getElementById('bantala-data-empty');
    if (emptyEl) { emptyEl.querySelector('p').textContent = 'Error: ' + msg; emptyEl.style.display = ''; }
    var tableEl = document.getElementById('bantala-data-table');
    if (tableEl) tableEl.style.display = 'none';
    var footerEl = document.getElementById('bantala-data-footer');
    if (footerEl) footerEl.style.display = 'none';
    showToast('error', 'Data Error', msg);
}

function buildBantalaTableHeaders() {
    var thead = document.getElementById('bantala-data-thead');
    if (!thead) return;
    thead.innerHTML = '';

    var trHead = document.createElement('tr');
    var thNum  = document.createElement('th');
    thNum.className   = 'dt-th dt-th-num';
    thNum.textContent = '#';
    trHead.appendChild(thNum);
    bantalaTableData.headers.forEach(function (h, i) {
        var th = document.createElement('th');
        th.className = 'dt-th dt-th-sortable';
        th.setAttribute('data-bantala-col', i);
        th.innerHTML = esc(h) + '<span class="dt-sort-icon material-icons-round">unfold_more</span>';
        th.addEventListener('click', function () { onBantalaSortColumn(i); });
        trHead.appendChild(th);
    });

    var trFilter    = document.createElement('tr');
    trFilter.className = 'dt-filter-row';
    var thFilterNum = document.createElement('th');
    thFilterNum.className = 'dt-filter-cell dt-filter-cell-num';
    thFilterNum.innerHTML = '<span class="material-icons-round" style="font-size:12px;opacity:.45;color:#94a3b8;">filter_list</span>';
    trFilter.appendChild(thFilterNum);

    bantalaTableData.headers.forEach(function (h, i) {
        var th    = document.createElement('th');
        th.className = 'dt-filter-cell';
        var wrap  = document.createElement('div');
        wrap.className = 'dt-col-filter-wrap';
        var input = document.createElement('input');
        input.type = 'text'; input.className = 'dt-col-filter';
        input.placeholder = 'Filter…';
        input.value = bantalaTableData.columnFilters[i] || '';
        var clearBtn = document.createElement('button');
        clearBtn.className = 'dt-col-filter-clear'; clearBtn.title = 'Clear filter';
        clearBtn.innerHTML = '<span class="material-icons-round">close</span>';
        clearBtn.style.display = input.value ? '' : 'none';
        input.addEventListener('input', function () {
            bantalaTableData.columnFilters[i] = input.value;
            clearBtn.style.display = input.value ? '' : 'none';
            applyBantalaFilters();
        });
        clearBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            input.value = ''; bantalaTableData.columnFilters[i] = '';
            clearBtn.style.display = 'none'; applyBantalaFilters(); input.focus();
        });
        wrap.appendChild(input); wrap.appendChild(clearBtn);
        th.appendChild(wrap); trFilter.appendChild(th);
    });

    thead.appendChild(trFilter);
    thead.appendChild(trHead);
}

function onBantalaSortColumn(colIndex) {
    if (bantalaTableData.sortCol === colIndex) {
        bantalaTableData.sortAsc = !bantalaTableData.sortAsc;
    } else {
        bantalaTableData.sortCol = colIndex;
        bantalaTableData.sortAsc = true;
    }
    updateBantalaSortIcons();
    applyBantalaFilters();
}

function updateBantalaSortIcons() {
    document.querySelectorAll('[data-bantala-col]').forEach(function (th) {
        var idx  = parseInt(th.getAttribute('data-bantala-col'), 10);
        var icon = th.querySelector('.dt-sort-icon');
        if (!icon) return;
        if (idx === bantalaTableData.sortCol) {
            icon.textContent = bantalaTableData.sortAsc ? 'arrow_upward' : 'arrow_downward';
            th.classList.add('dt-th-sorted');
        } else {
            icon.textContent = 'unfold_more';
            th.classList.remove('dt-th-sorted');
        }
    });
}

function applyBantalaFilters() {
    var query      = bantalaTableData.searchQuery;
    var colFilters = bantalaTableData.columnFilters;
    var dateColIdx = getBantalaDateColIndex(); // Column C = index 2

    var dateFrom = bantalaTableData.dateFrom
        ? new Date(bantalaTableData.dateFrom + 'T00:00:00')
        : null;
    var dateTo = bantalaTableData.dateTo
        ? new Date(bantalaTableData.dateTo + 'T23:59:59')
        : null;
    var anyDateFilter = dateFrom || dateTo;

    bantalaTableData.filteredRows = bantalaTableData.allRows.filter(function (row) {
        if (query) {
            var rowMatch = row.some(function (cell) {
                return String(cell).toLowerCase().indexOf(query) !== -1;
            });
            if (!rowMatch) return false;
        }
        var colKeys = Object.keys(colFilters);
        for (var k = 0; k < colKeys.length; k++) {
            var ci = parseInt(colKeys[k], 10);
            var f  = (colFilters[colKeys[k]] || '').trim().toLowerCase();
            if (!f) continue;
            var cellVal = String(row[ci] !== undefined ? row[ci] : '').toLowerCase();
            if (cellVal.indexOf(f) === -1) return false;
        }
        if (anyDateFilter && dateColIdx >= 0 && dateColIdx < row.length) {
            var parsed = parseCreatedAt(row[dateColIdx]);
            if (!parsed) return false;
            if (dateFrom && parsed < dateFrom) return false;
            if (dateTo   && parsed > dateTo)   return false;
        }
        return true;
    });

    if (bantalaTableData.sortCol >= 0) {
        var sc = bantalaTableData.sortCol;
        bantalaTableData.filteredRows.sort(function (a, b) {
            var av = (a[sc] || '').toString().toLowerCase();
            var bv = (b[sc] || '').toString().toLowerCase();
            var numA = parseFloat(av), numB = parseFloat(bv);
            var isNum = !isNaN(numA) && !isNaN(numB);
            var cmp = isNum ? (numA - numB) : av.localeCompare(bv);
            return bantalaTableData.sortAsc ? cmp : -cmp;
        });
    }

    bantalaTableData.page = 1;
    renderBantalaTable();
}

function applyBantalaSearch(query) {
    bantalaTableData.searchQuery = (query || '').trim().toLowerCase();
    applyBantalaFilters();
}

function renderBantalaTable() {
    var tbody      = document.getElementById('bantala-data-tbody');
    var tableEl    = document.getElementById('bantala-data-table');
    var emptyEl    = document.getElementById('bantala-data-empty');
    var footerEl   = document.getElementById('bantala-data-footer');
    var countBadge = document.getElementById('bantala-data-count-badge');
    if (!tbody) return;

    var total      = bantalaTableData.filteredRows.length;
    var pageSize   = bantalaTableData.pageSize;
    var page       = bantalaTableData.page;
    var totalPages = Math.ceil(total / pageSize) || 1;
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    bantalaTableData.page = page;

    var start = (page - 1) * pageSize;
    var end   = Math.min(start + pageSize, total);
    var slice = bantalaTableData.filteredRows.slice(start, end);

    if (countBadge) countBadge.textContent = total + ' record' + (total !== 1 ? 's' : '');
    if (emptyEl)  emptyEl.style.display  = 'none';
    if (tableEl)  tableEl.style.display  = '';
    if (footerEl) footerEl.style.display = total > 0 ? '' : 'none';
    tbody.innerHTML = '';

    if (total === 0) {
        var trEmpty = document.createElement('tr');
        var tdEmpty = document.createElement('td');
        tdEmpty.className = 'dt-td-empty-msg';
        tdEmpty.setAttribute('colspan', bantalaTableData.headers.length + 1);
        var hasFilter = Object.keys(bantalaTableData.columnFilters).some(function (k) {
            return (bantalaTableData.columnFilters[k] || '').trim() !== '';
        });
        var hasDate = bantalaTableData.dateFrom || bantalaTableData.dateTo;
        tdEmpty.innerHTML =
            '<span class="material-icons-round" style="vertical-align:middle;margin-right:6px;font-size:18px;color:#64748b;">search_off</span>' +
            (bantalaTableData.searchQuery || hasFilter || hasDate
                ? 'No records match the current filter.'
                : (bantalaTableData.allRows.length === 0 ? 'No data found in Bantala Details.' : 'No records found.'));
        trEmpty.appendChild(tdEmpty);
        tbody.appendChild(trEmpty);
        var infoEl2 = document.getElementById('bantala-data-info');
        if (infoEl2) infoEl2.textContent = 'Showing 0 entries';
        return;
    }

    slice.forEach(function (row, idx) {
        var tr = document.createElement('tr');
        tr.className = (start + idx) % 2 === 0 ? 'dt-tr-even' : 'dt-tr-odd';
        var tdNum = document.createElement('td');
        tdNum.className = 'dt-td dt-td-num';
        tdNum.textContent = start + idx + 1;
        tr.appendChild(tdNum);
        bantalaTableData.headers.forEach(function (header, ci) {
            var td = document.createElement('td');
            td.className = 'dt-td';
            var cellVal = String(row[ci] !== undefined && row[ci] !== null ? row[ci] : '');
            if (bantalaTableData.searchQuery && cellVal.toLowerCase().indexOf(bantalaTableData.searchQuery) !== -1) {
                td.innerHTML = esc(cellVal).replace(
                    new RegExp(escapeRegex(esc(bantalaTableData.searchQuery)), 'gi'),
                    '<mark class="dt-highlight">$&</mark>'
                );
            } else {
                td.textContent = cellVal;
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    var infoEl = document.getElementById('bantala-data-info');
    if (infoEl) {
        infoEl.textContent = 'Showing ' + (start + 1) + ' to ' + end + ' of ' + total +
            (bantalaTableData.allRows.length !== total ? ' (filtered from ' + bantalaTableData.allRows.length + ' total)' : '') +
            ' entries';
    }
    buildBantalaPagination(page, totalPages);
}

function buildBantalaPagination(current, total) {
    var container = document.getElementById('bantala-data-pagination');
    if (!container) return;
    container.innerHTML = '';
    function mkBtn(label, page, disabled, active, isIcon) {
        var btn = document.createElement('button');
        btn.className = 'dt-page-btn' + (active ? ' dt-page-btn-active' : '') + (disabled ? ' dt-page-btn-disabled' : '');
        btn.innerHTML = isIcon ? '<span class="material-icons-round" style="font-size:16px;">' + label + '</span>' : label;
        btn.disabled  = disabled;
        if (!disabled) {
            btn.addEventListener('click', function () {
                bantalaTableData.page = page;
                renderBantalaTable();
                var wrap = document.getElementById('bantala-data-table-wrap');
                if (wrap) wrap.scrollTop = 0;
            });
        }
        return btn;
    }
    container.appendChild(mkBtn('first_page',   1,           current <= 1,      false, true));
    container.appendChild(mkBtn('chevron_left', current - 1, current <= 1,      false, true));
    paginationRange(current, total).forEach(function (item) {
        if (item === '…') {
            var el = document.createElement('span');
            el.className = 'dt-page-ellipsis'; el.textContent = '…';
            container.appendChild(el);
        } else {
            container.appendChild(mkBtn(item, item, false, item === current, false));
        }
    });
    container.appendChild(mkBtn('chevron_right', current + 1, current >= total, false, true));
    container.appendChild(mkBtn('last_page',     total,       current >= total, false, true));
}

function downloadBantalaExcel() {
    var headers = bantalaTableData.headers;
    var rows    = bantalaTableData.filteredRows;
    if (!headers.length && !rows.length) { showToast('info', 'No Data', 'There is no data to export.'); return; }
    var xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<?mso-application progid="Excel.Sheet"?>',
        '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"',
        '  xmlns:o="urn:schemas-microsoft-com:office:office"',
        '  xmlns:x="urn:schemas-microsoft-com:office:excel"',
        '  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
        '  <Styles>',
        '    <Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1A73E8" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1558B0"/><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1558B0"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1558B0"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1558B0"/></Borders></Style>',
        '    <Style ss:ID="RowEven"><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/></Borders></Style>',
        '    <Style ss:ID="RowOdd"><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/></Borders></Style>',
        '    <Style ss:ID="RowNum"><Font ss:Color="#94A3B8"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/></Borders></Style>',
        '  </Styles>',
        '  <Worksheet ss:Name="Bantala Details">',
        '    <Table>'
    ];
    xml.push('      <Column ss:Width="40"/>');
    headers.forEach(function () { xml.push('      <Column ss:Width="130"/>'); });
    xml.push('      <Row ss:Height="22">');
    xml.push('        <Cell ss:StyleID="Header"><Data ss:Type="String">#</Data></Cell>');
    headers.forEach(function (h) { xml.push('        <Cell ss:StyleID="Header"><Data ss:Type="String">' + xmlEsc(h) + '</Data></Cell>'); });
    xml.push('      </Row>');
    rows.forEach(function (row, idx) {
        var style = idx % 2 === 0 ? 'RowEven' : 'RowOdd';
        xml.push('      <Row ss:Height="18">');
        xml.push('        <Cell ss:StyleID="RowNum"><Data ss:Type="Number">' + (idx + 1) + '</Data></Cell>');
        headers.forEach(function (header, ci) {
            var cell  = String(row[ci] !== undefined && row[ci] !== null ? row[ci] : '');
            var num   = Number(cell);
            var isNum = cell !== '' && !isNaN(num) && isFinite(num);
            if (isNum) {
                xml.push('        <Cell ss:StyleID="' + style + '"><Data ss:Type="Number">' + num + '</Data></Cell>');
            } else {
                xml.push('        <Cell ss:StyleID="' + style + '"><Data ss:Type="String">' + xmlEsc(cell) + '</Data></Cell>');
            }
        });
        xml.push('      </Row>');
    });
    xml.push('    </Table></Worksheet></Workbook>');
    var content  = xml.join('\n');
    var now      = new Date();
    var pad      = function (n) { return n < 10 ? '0' + n : '' + n; };
    var dateStr  = now.getFullYear() + '' + pad(now.getMonth() + 1) + '' + pad(now.getDate());
    var filename = 'Bantala_Details_' + dateStr + '.xls';
    try {
        var blob = new Blob(['\uFEFF' + content], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href = url; a.download = filename; a.style.display = 'none';
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(url); document.body.removeChild(a); }, 300);
    } catch (e) {
        window.open('data:application/vnd.ms-excel;charset=utf-8,' + encodeURIComponent('\uFEFF' + content), '_blank');
    }
    showToast('success', 'Download Started', rows.length + ' row' + (rows.length !== 1 ? 's' : '') + ' exported to ' + filename);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
function init() {
    enforceLogin();
    initProfileMenu();
    initNav();
    initQuantity();
    initProductionDays();
    initBatchAuto();
    initReports();
    initBatchList();

    var form = document.getElementById('fms-form-el');
    if (form) form.addEventListener('submit', handleSubmit);

    var resetBtn = document.getElementById('reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', function (e) { e.preventDefault(); resetForm(); });

    fetchDropdowns();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

})();
