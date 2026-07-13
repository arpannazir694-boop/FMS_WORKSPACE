// =============================================================================
// FMS FORM — main.js
// =============================================================================
// This file holds NEW feature code only. app.js is kept as-is; from now on,
// new features are added here instead of growing app.js further.
//
// It relies on a small set of helpers that app.js exposes on window.FMS
// (jsonp, showSpinner/hideSpinner, showToast, esc, escapeRegex,
// parseCreatedAt, paginationRange, exportRowsToXlsx, showBatchListKpiView) —
// see the bottom of app.js. Load this file AFTER app.js.
// =============================================================================

(function () {
'use strict';

var FMS = window.FMS || {};
var jsonp            = FMS.jsonp;
var showSpinner       = FMS.showSpinner;
var hideSpinner        = FMS.hideSpinner;
var showToast          = FMS.showToast;
var esc                = FMS.esc;
var escapeRegex        = FMS.escapeRegex;
var parseCreatedAt     = FMS.parseCreatedAt;
var paginationRange    = FMS.paginationRange;
var exportRowsToXlsx   = FMS.exportRowsToXlsx;
var showBatchListKpiView = FMS.showBatchListKpiView;

if (!jsonp || !exportRowsToXlsx || !showBatchListKpiView) {
    // app.js didn't expose window.FMS (e.g. an old cached app.js) — bail out
    // quietly instead of throwing errors all over the console.
    console.warn('main.js: window.FMS helpers not found — is app.js up to date?');
    return;
}

// ---------------------------------------------------------------------------
// End-Line QC Details — table state
// ---------------------------------------------------------------------------
var endLineQcTableData = {
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

// The Google Sheet table is assumed to start at column B, so the first
// column (FMS Upload Timestamp / date column) is index 0 — same convention
// used by the other Production Data subviews in app.js.
function getEndLineQcDateColIndex() { return 0; }

// ---------------------------------------------------------------------------
// POST-AQL Details — table state
// ---------------------------------------------------------------------------
var postAqlTableData = {
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

// Same convention as the other Production Data subviews: the Google Sheet
// table starts at column B, so the first column (FMS Upload Timestamp /
// date column) is index 0.
function getPostAqlDateColIndex() { return 0; }

// ---------------------------------------------------------------------------
// WAREHOUSE-FMS Details — table state
// ---------------------------------------------------------------------------
var warehouseFmsTableData = {
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

// Same convention as the other Production Data subviews: the Google Sheet
// table starts at column B, so the first column (FMS Upload Timestamp /
// date column) is index 0.
function getWarehouseFmsDateColIndex() { return 0; }

// ---------------------------------------------------------------------------
// Shipment Details — table state
// ---------------------------------------------------------------------------
var shipmentTableData = {
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

// Same convention as the other Production Data subviews: the Google Sheet
// table starts at column B, so the first column (FMS Upload Timestamp /
// date column) is index 0.
function getShipmentDateColIndex() { return 0; }

// ---------------------------------------------------------------------------
// View switching
// ---------------------------------------------------------------------------
var OTHER_BATCH_LIST_VIEW_IDS = [
    'batch-list-kpi-view',
    'batch-list-cutting-view',
    'batch-list-bantala-view',
    'batch-list-floor-qc-view',
    'batch-list-edge-paint-view',
    'batch-list-pre-aql-view',
    'batch-list-endline-qc-view',
    'batch-list-post-aql-view',
    'batch-list-warehouse-fms-view',
    'batch-list-shipment-view'
];

function showBatchListEndLineQcView() {
    OTHER_BATCH_LIST_VIEW_IDS.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    var view = document.getElementById('batch-list-endline-qc-view');
    if (view) view.style.display = '';
    if (endLineQcTableData.allRows.length === 0) {
        fetchEndLineQcDetailsAndRender();
    } else {
        renderEndLineQcTable();
    }
}

function backToBatchListKpiView() {
    var view = document.getElementById('batch-list-endline-qc-view');
    if (view) view.style.display = 'none';
    showBatchListKpiView();
}

function showBatchListPostAqlView() {
    OTHER_BATCH_LIST_VIEW_IDS.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    var view = document.getElementById('batch-list-post-aql-view');
    if (view) view.style.display = '';
    if (postAqlTableData.allRows.length === 0) {
        fetchPostAqlDetailsAndRender();
    } else {
        renderPostAqlTable();
    }
}

function backToBatchListKpiViewFromPostAql() {
    var view = document.getElementById('batch-list-post-aql-view');
    if (view) view.style.display = 'none';
    showBatchListKpiView();
}

function showBatchListWarehouseFmsView() {
    OTHER_BATCH_LIST_VIEW_IDS.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    var view = document.getElementById('batch-list-warehouse-fms-view');
    if (view) view.style.display = '';
    if (warehouseFmsTableData.allRows.length === 0) {
        fetchWarehouseFmsDetailsAndRender();
    } else {
        renderWarehouseFmsTable();
    }
}

function backToBatchListKpiViewFromWarehouseFms() {
    var view = document.getElementById('batch-list-warehouse-fms-view');
    if (view) view.style.display = 'none';
    showBatchListKpiView();
}

function showBatchListShipmentView() {
    OTHER_BATCH_LIST_VIEW_IDS.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    var view = document.getElementById('batch-list-shipment-view');
    if (view) view.style.display = '';
    if (shipmentTableData.allRows.length === 0) {
        fetchShipmentDetailsAndRender();
    } else {
        renderShipmentTable();
    }
}

function backToBatchListKpiViewFromShipment() {
    var view = document.getElementById('batch-list-shipment-view');
    if (view) view.style.display = 'none';
    showBatchListKpiView();
}

// ---------------------------------------------------------------------------
// Fetch + render
// ---------------------------------------------------------------------------
function updateEndLineQcDateClearBtn() {
    var btn = document.getElementById('endline-qc-date-clear');
    if (btn) btn.style.display = (endLineQcTableData.dateFrom || endLineQcTableData.dateTo) ? '' : 'none';
}

function updateEndLineQcSearchClearBtn() {
    var s = document.getElementById('endline-qc-data-search');
    var b = document.getElementById('endline-qc-data-search-clear');
    if (s && b) b.style.display = s.value ? '' : 'none';
}

function fetchEndLineQcDetailsAndRender() {
    var emptyEl  = document.getElementById('endline-qc-data-empty');
    var tableEl  = document.getElementById('endline-qc-data-table');
    var footerEl = document.getElementById('endline-qc-data-footer');
    if (emptyEl)  { emptyEl.querySelector('p').textContent = 'Loading data...'; emptyEl.style.display = ''; }
    if (tableEl)  tableEl.style.display  = 'none';
    if (footerEl) footerEl.style.display = 'none';
    showSpinner('Fetching End-Line QC details...');
    if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
            .withSuccessHandler(function (r) { hideSpinner(); onEndLineQcDataLoaded(r); })
            .withFailureHandler(function (e) { hideSpinner(); onEndLineQcDataError(e.message || 'Failed to load data.'); })
            .getEndLineQcDetailsData();
        return;
    }
    jsonp({ action: 'getEndLineQcDetailsData' }, function (err, result) {
        hideSpinner();
        if (err) { onEndLineQcDataError(err.message); return; }
        onEndLineQcDataLoaded(result);
    });
}

function onEndLineQcDataLoaded(result) {
    if (!result || !result.success) {
        onEndLineQcDataError((result && result.error) || 'Failed to load data.');
        return;
    }
    endLineQcTableData.headers       = result.headers || [];
    endLineQcTableData.allRows       = result.rows    || [];
    endLineQcTableData.filteredRows  = endLineQcTableData.allRows.slice();
    endLineQcTableData.sortCol       = -1;
    endLineQcTableData.sortAsc       = true;
    endLineQcTableData.page          = 1;
    endLineQcTableData.searchQuery   = '';
    endLineQcTableData.columnFilters = {};
    endLineQcTableData.dateFrom      = '';
    endLineQcTableData.dateTo        = '';

    var s = document.getElementById('endline-qc-data-search');
    if (s) s.value = '';
    updateEndLineQcSearchClearBtn();

    var df = document.getElementById('endline-qc-date-from');
    var dt = document.getElementById('endline-qc-date-to');
    if (df) df.value = '';
    if (dt) dt.value = '';
    updateEndLineQcDateClearBtn();

    var labelEl = document.getElementById('endline-qc-date-col-label');
    var dateCol = getEndLineQcDateColIndex();
    if (labelEl && endLineQcTableData.headers[dateCol]) {
        labelEl.textContent = endLineQcTableData.headers[dateCol];
    }

    buildEndLineQcTableHeaders();
    renderEndLineQcTable();
}

function onEndLineQcDataError(msg) {
    var emptyEl = document.getElementById('endline-qc-data-empty');
    if (emptyEl) { emptyEl.querySelector('p').textContent = 'Error: ' + msg; emptyEl.style.display = ''; }
    var tableEl = document.getElementById('endline-qc-data-table');
    if (tableEl) tableEl.style.display = 'none';
    var footerEl = document.getElementById('endline-qc-data-footer');
    if (footerEl) footerEl.style.display = 'none';
    showToast('error', 'Data Error', msg);
}

function buildEndLineQcTableHeaders() {
    var thead = document.getElementById('endline-qc-data-thead');
    if (!thead) return;
    thead.innerHTML = '';

    var trHead = document.createElement('tr');
    var thNum  = document.createElement('th');
    thNum.className = 'dt-th dt-th-num';
    thNum.textContent = '#';
    trHead.appendChild(thNum);
    endLineQcTableData.headers.forEach(function (h, i) {
        var th = document.createElement('th');
        th.className = 'dt-th dt-th-sortable';
        th.setAttribute('data-endline-qc-col', i);
        th.innerHTML = esc(h) + '<span class="dt-sort-icon material-icons-round">unfold_more</span>';
        th.addEventListener('click', function () { onEndLineQcSortColumn(i); });
        trHead.appendChild(th);
    });

    var trFilter = document.createElement('tr');
    trFilter.className = 'dt-filter-row';
    var thFilterNum = document.createElement('th');
    thFilterNum.className = 'dt-filter-cell dt-filter-cell-num';
    thFilterNum.innerHTML = '<span class="material-icons-round" style="font-size:12px;opacity:.45;color:#94a3b8;">filter_list</span>';
    trFilter.appendChild(thFilterNum);

    endLineQcTableData.headers.forEach(function (h, i) {
        var th    = document.createElement('th');
        th.className = 'dt-filter-cell';
        var wrap  = document.createElement('div');
        wrap.className = 'dt-col-filter-wrap';
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'dt-col-filter';
        input.placeholder = 'Filter...';
        input.value = endLineQcTableData.columnFilters[i] || '';
        var clearBtn = document.createElement('button');
        clearBtn.className = 'dt-col-filter-clear';
        clearBtn.title = 'Clear filter';
        clearBtn.innerHTML = '<span class="material-icons-round">close</span>';
        clearBtn.style.display = input.value ? '' : 'none';
        input.addEventListener('input', function () {
            endLineQcTableData.columnFilters[i] = input.value;
            clearBtn.style.display = input.value ? '' : 'none';
            applyEndLineQcFilters();
        });
        clearBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            input.value = '';
            endLineQcTableData.columnFilters[i] = '';
            clearBtn.style.display = 'none';
            applyEndLineQcFilters();
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

function onEndLineQcSortColumn(colIndex) {
    if (endLineQcTableData.sortCol === colIndex) {
        endLineQcTableData.sortAsc = !endLineQcTableData.sortAsc;
    } else {
        endLineQcTableData.sortCol = colIndex;
        endLineQcTableData.sortAsc = true;
    }
    updateEndLineQcSortIcons();
    applyEndLineQcFilters();
}

function updateEndLineQcSortIcons() {
    document.querySelectorAll('[data-endline-qc-col]').forEach(function (th) {
        var idx  = parseInt(th.getAttribute('data-endline-qc-col'), 10);
        var icon = th.querySelector('.dt-sort-icon');
        if (!icon) return;
        if (idx === endLineQcTableData.sortCol) {
            icon.textContent = endLineQcTableData.sortAsc ? 'arrow_upward' : 'arrow_downward';
            th.classList.add('dt-th-sorted');
        } else {
            icon.textContent = 'unfold_more';
            th.classList.remove('dt-th-sorted');
        }
    });
}

function applyEndLineQcFilters() {
    var query      = endLineQcTableData.searchQuery;
    var colFilters = endLineQcTableData.columnFilters;
    var dateColIdx = getEndLineQcDateColIndex();
    var dateFrom = endLineQcTableData.dateFrom ? new Date(endLineQcTableData.dateFrom + 'T00:00:00') : null;
    var dateTo = endLineQcTableData.dateTo ? new Date(endLineQcTableData.dateTo + 'T23:59:59') : null;
    var anyDateFilter = dateFrom || dateTo;

    endLineQcTableData.filteredRows = endLineQcTableData.allRows.filter(function (row) {
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

    if (endLineQcTableData.sortCol >= 0) {
        var sc = endLineQcTableData.sortCol;
        endLineQcTableData.filteredRows.sort(function (a, b) {
            var av = (a[sc] || '').toString().toLowerCase();
            var bv = (b[sc] || '').toString().toLowerCase();
            var numA = parseFloat(av), numB = parseFloat(bv);
            var isNum = !isNaN(numA) && !isNaN(numB);
            var cmp = isNum ? (numA - numB) : av.localeCompare(bv);
            return endLineQcTableData.sortAsc ? cmp : -cmp;
        });
    }

    endLineQcTableData.page = 1;
    renderEndLineQcTable();
}

function applyEndLineQcSearch(query) {
    endLineQcTableData.searchQuery = (query || '').trim().toLowerCase();
    applyEndLineQcFilters();
}

function renderEndLineQcTable() {
    var tbody      = document.getElementById('endline-qc-data-tbody');
    var tableEl    = document.getElementById('endline-qc-data-table');
    var emptyEl    = document.getElementById('endline-qc-data-empty');
    var footerEl   = document.getElementById('endline-qc-data-footer');
    var countBadge = document.getElementById('endline-qc-data-count-badge');
    if (!tbody) return;

    var total      = endLineQcTableData.filteredRows.length;
    var pageSize   = endLineQcTableData.pageSize;
    var page       = endLineQcTableData.page;
    var totalPages = Math.ceil(total / pageSize) || 1;
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    endLineQcTableData.page = page;

    var start = (page - 1) * pageSize;
    var end   = Math.min(start + pageSize, total);
    var slice = endLineQcTableData.filteredRows.slice(start, end);

    if (countBadge) countBadge.textContent = total + ' record' + (total !== 1 ? 's' : '');
    if (emptyEl)  emptyEl.style.display  = 'none';
    if (tableEl)  tableEl.style.display  = '';
    if (footerEl) footerEl.style.display = total > 0 ? '' : 'none';
    tbody.innerHTML = '';

    if (total === 0) {
        var trEmpty = document.createElement('tr');
        var tdEmpty = document.createElement('td');
        tdEmpty.className = 'dt-td-empty-msg';
        tdEmpty.setAttribute('colspan', endLineQcTableData.headers.length + 1);
        var hasFilter = Object.keys(endLineQcTableData.columnFilters).some(function (k) {
            return (endLineQcTableData.columnFilters[k] || '').trim() !== '';
        });
        var hasDate = endLineQcTableData.dateFrom || endLineQcTableData.dateTo;
        tdEmpty.innerHTML =
            '<span class="material-icons-round" style="vertical-align:middle;margin-right:6px;font-size:18px;color:#64748b;">search_off</span>' +
            (endLineQcTableData.searchQuery || hasFilter || hasDate
                ? 'No records match the current filter.'
                : (endLineQcTableData.allRows.length === 0 ? 'No data found in End-Line QC Details.' : 'No records found.'));
        trEmpty.appendChild(tdEmpty);
        tbody.appendChild(trEmpty);
        var infoEl2 = document.getElementById('endline-qc-data-info');
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
        endLineQcTableData.headers.forEach(function (header, ci) {
            var td = document.createElement('td');
            td.className = 'dt-td';
            var cellVal = String(row[ci] !== undefined && row[ci] !== null ? row[ci] : '');
            if (endLineQcTableData.searchQuery && cellVal.toLowerCase().indexOf(endLineQcTableData.searchQuery) !== -1) {
                td.innerHTML = esc(cellVal).replace(
                    new RegExp(escapeRegex(esc(endLineQcTableData.searchQuery)), 'gi'),
                    '<mark class="dt-highlight">$&</mark>'
                );
            } else {
                td.textContent = cellVal;
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    var infoEl = document.getElementById('endline-qc-data-info');
    if (infoEl) {
        infoEl.textContent = 'Showing ' + (start + 1) + ' to ' + end + ' of ' + total +
            (endLineQcTableData.allRows.length !== total ? ' (filtered from ' + endLineQcTableData.allRows.length + ' total)' : '') +
            ' entries';
    }
    buildEndLineQcPagination(page, totalPages);
}

function buildEndLineQcPagination(current, total) {
    var container = document.getElementById('endline-qc-data-pagination');
    if (!container) return;
    container.innerHTML = '';
    function mkBtn(label, page, disabled, active, isIcon) {
        var btn = document.createElement('button');
        btn.className = 'dt-page-btn' + (active ? ' dt-page-btn-active' : '') + (disabled ? ' dt-page-btn-disabled' : '');
        btn.innerHTML = isIcon ? '<span class="material-icons-round" style="font-size:16px;">' + label + '</span>' : label;
        btn.disabled  = disabled;
        if (!disabled) {
            btn.addEventListener('click', function () {
                endLineQcTableData.page = page;
                renderEndLineQcTable();
                var wrap = document.getElementById('endline-qc-data-table-wrap');
                if (wrap) wrap.scrollTop = 0;
            });
        }
        return btn;
    }
    container.appendChild(mkBtn('first_page',   1,           current <= 1,      false, true));
    container.appendChild(mkBtn('chevron_left', current - 1, current <= 1,      false, true));
    paginationRange(current, total).forEach(function (item) {
        if (item === '...' || item === '\u2026') {
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

function downloadEndLineQcExcel() {
    var headers = endLineQcTableData.headers;
    var rows    = endLineQcTableData.filteredRows;
    exportRowsToXlsx({
        headers: headers,
        rows: rows,
        sheetName: 'End-Line QC Details',
        filenamePrefix: 'End_Line_QC_Details'
    });
}

// ---------------------------------------------------------------------------
// POST-AQL Details — fetch + render
// ---------------------------------------------------------------------------
function updatePostAqlDateClearBtn() {
    var btn = document.getElementById('post-aql-date-clear');
    if (btn) btn.style.display = (postAqlTableData.dateFrom || postAqlTableData.dateTo) ? '' : 'none';
}

function updatePostAqlSearchClearBtn() {
    var s = document.getElementById('post-aql-data-search');
    var b = document.getElementById('post-aql-data-search-clear');
    if (s && b) b.style.display = s.value ? '' : 'none';
}

function fetchPostAqlDetailsAndRender() {
    var emptyEl  = document.getElementById('post-aql-data-empty');
    var tableEl  = document.getElementById('post-aql-data-table');
    var footerEl = document.getElementById('post-aql-data-footer');
    if (emptyEl)  { emptyEl.querySelector('p').textContent = 'Loading data...'; emptyEl.style.display = ''; }
    if (tableEl)  tableEl.style.display  = 'none';
    if (footerEl) footerEl.style.display = 'none';
    showSpinner('Fetching POST-AQL details...');
    if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
            .withSuccessHandler(function (r) { hideSpinner(); onPostAqlDataLoaded(r); })
            .withFailureHandler(function (e) { hideSpinner(); onPostAqlDataError(e.message || 'Failed to load data.'); })
            .getPostAqlDetailsData();
        return;
    }
    jsonp({ action: 'getPostAqlDetailsData' }, function (err, result) {
        hideSpinner();
        if (err) { onPostAqlDataError(err.message); return; }
        onPostAqlDataLoaded(result);
    });
}

function onPostAqlDataLoaded(result) {
    if (!result || !result.success) {
        onPostAqlDataError((result && result.error) || 'Failed to load data.');
        return;
    }
    postAqlTableData.headers       = result.headers || [];
    postAqlTableData.allRows       = result.rows    || [];
    postAqlTableData.filteredRows  = postAqlTableData.allRows.slice();
    postAqlTableData.sortCol       = -1;
    postAqlTableData.sortAsc       = true;
    postAqlTableData.page          = 1;
    postAqlTableData.searchQuery   = '';
    postAqlTableData.columnFilters = {};
    postAqlTableData.dateFrom      = '';
    postAqlTableData.dateTo        = '';

    var s = document.getElementById('post-aql-data-search');
    if (s) s.value = '';
    updatePostAqlSearchClearBtn();

    var df = document.getElementById('post-aql-date-from');
    var dt = document.getElementById('post-aql-date-to');
    if (df) df.value = '';
    if (dt) dt.value = '';
    updatePostAqlDateClearBtn();

    var labelEl = document.getElementById('post-aql-date-col-label');
    var dateCol = getPostAqlDateColIndex();
    if (labelEl && postAqlTableData.headers[dateCol]) {
        labelEl.textContent = postAqlTableData.headers[dateCol];
    }

    buildPostAqlTableHeaders();
    renderPostAqlTable();
}

function onPostAqlDataError(msg) {
    var emptyEl = document.getElementById('post-aql-data-empty');
    if (emptyEl) { emptyEl.querySelector('p').textContent = 'Error: ' + msg; emptyEl.style.display = ''; }
    var tableEl = document.getElementById('post-aql-data-table');
    if (tableEl) tableEl.style.display = 'none';
    var footerEl = document.getElementById('post-aql-data-footer');
    if (footerEl) footerEl.style.display = 'none';
    showToast('error', 'Data Error', msg);
}

function buildPostAqlTableHeaders() {
    var thead = document.getElementById('post-aql-data-thead');
    if (!thead) return;
    thead.innerHTML = '';

    var trHead = document.createElement('tr');
    var thNum  = document.createElement('th');
    thNum.className = 'dt-th dt-th-num';
    thNum.textContent = '#';
    trHead.appendChild(thNum);
    postAqlTableData.headers.forEach(function (h, i) {
        var th = document.createElement('th');
        th.className = 'dt-th dt-th-sortable';
        th.setAttribute('data-post-aql-col', i);
        th.innerHTML = esc(h) + '<span class="dt-sort-icon material-icons-round">unfold_more</span>';
        th.addEventListener('click', function () { onPostAqlSortColumn(i); });
        trHead.appendChild(th);
    });

    var trFilter = document.createElement('tr');
    trFilter.className = 'dt-filter-row';
    var thFilterNum = document.createElement('th');
    thFilterNum.className = 'dt-filter-cell dt-filter-cell-num';
    thFilterNum.innerHTML = '<span class="material-icons-round" style="font-size:12px;opacity:.45;color:#94a3b8;">filter_list</span>';
    trFilter.appendChild(thFilterNum);

    postAqlTableData.headers.forEach(function (h, i) {
        var th    = document.createElement('th');
        th.className = 'dt-filter-cell';
        var wrap  = document.createElement('div');
        wrap.className = 'dt-col-filter-wrap';
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'dt-col-filter';
        input.placeholder = 'Filter...';
        input.value = postAqlTableData.columnFilters[i] || '';
        var clearBtn = document.createElement('button');
        clearBtn.className = 'dt-col-filter-clear';
        clearBtn.title = 'Clear filter';
        clearBtn.innerHTML = '<span class="material-icons-round">close</span>';
        clearBtn.style.display = input.value ? '' : 'none';
        input.addEventListener('input', function () {
            postAqlTableData.columnFilters[i] = input.value;
            clearBtn.style.display = input.value ? '' : 'none';
            applyPostAqlFilters();
        });
        clearBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            input.value = '';
            postAqlTableData.columnFilters[i] = '';
            clearBtn.style.display = 'none';
            applyPostAqlFilters();
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

function onPostAqlSortColumn(colIndex) {
    if (postAqlTableData.sortCol === colIndex) {
        postAqlTableData.sortAsc = !postAqlTableData.sortAsc;
    } else {
        postAqlTableData.sortCol = colIndex;
        postAqlTableData.sortAsc = true;
    }
    updatePostAqlSortIcons();
    applyPostAqlFilters();
}

function updatePostAqlSortIcons() {
    document.querySelectorAll('[data-post-aql-col]').forEach(function (th) {
        var idx  = parseInt(th.getAttribute('data-post-aql-col'), 10);
        var icon = th.querySelector('.dt-sort-icon');
        if (!icon) return;
        if (idx === postAqlTableData.sortCol) {
            icon.textContent = postAqlTableData.sortAsc ? 'arrow_upward' : 'arrow_downward';
            th.classList.add('dt-th-sorted');
        } else {
            icon.textContent = 'unfold_more';
            th.classList.remove('dt-th-sorted');
        }
    });
}

function applyPostAqlFilters() {
    var query      = postAqlTableData.searchQuery;
    var colFilters = postAqlTableData.columnFilters;
    var dateColIdx = getPostAqlDateColIndex();
    var dateFrom = postAqlTableData.dateFrom ? new Date(postAqlTableData.dateFrom + 'T00:00:00') : null;
    var dateTo = postAqlTableData.dateTo ? new Date(postAqlTableData.dateTo + 'T23:59:59') : null;
    var anyDateFilter = dateFrom || dateTo;

    postAqlTableData.filteredRows = postAqlTableData.allRows.filter(function (row) {
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

    if (postAqlTableData.sortCol >= 0) {
        var sc = postAqlTableData.sortCol;
        postAqlTableData.filteredRows.sort(function (a, b) {
            var av = (a[sc] || '').toString().toLowerCase();
            var bv = (b[sc] || '').toString().toLowerCase();
            var numA = parseFloat(av), numB = parseFloat(bv);
            var isNum = !isNaN(numA) && !isNaN(numB);
            var cmp = isNum ? (numA - numB) : av.localeCompare(bv);
            return postAqlTableData.sortAsc ? cmp : -cmp;
        });
    }

    postAqlTableData.page = 1;
    renderPostAqlTable();
}

function applyPostAqlSearch(query) {
    postAqlTableData.searchQuery = (query || '').trim().toLowerCase();
    applyPostAqlFilters();
}

function renderPostAqlTable() {
    var tbody      = document.getElementById('post-aql-data-tbody');
    var tableEl    = document.getElementById('post-aql-data-table');
    var emptyEl    = document.getElementById('post-aql-data-empty');
    var footerEl   = document.getElementById('post-aql-data-footer');
    var countBadge = document.getElementById('post-aql-data-count-badge');
    if (!tbody) return;

    var total      = postAqlTableData.filteredRows.length;
    var pageSize   = postAqlTableData.pageSize;
    var page       = postAqlTableData.page;
    var totalPages = Math.ceil(total / pageSize) || 1;
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    postAqlTableData.page = page;

    var start = (page - 1) * pageSize;
    var end   = Math.min(start + pageSize, total);
    var slice = postAqlTableData.filteredRows.slice(start, end);

    if (countBadge) countBadge.textContent = total + ' record' + (total !== 1 ? 's' : '');
    if (emptyEl)  emptyEl.style.display  = 'none';
    if (tableEl)  tableEl.style.display  = '';
    if (footerEl) footerEl.style.display = total > 0 ? '' : 'none';
    tbody.innerHTML = '';

    if (total === 0) {
        var trEmpty = document.createElement('tr');
        var tdEmpty = document.createElement('td');
        tdEmpty.className = 'dt-td-empty-msg';
        tdEmpty.setAttribute('colspan', postAqlTableData.headers.length + 1);
        var hasFilter = Object.keys(postAqlTableData.columnFilters).some(function (k) {
            return (postAqlTableData.columnFilters[k] || '').trim() !== '';
        });
        var hasDate = postAqlTableData.dateFrom || postAqlTableData.dateTo;
        tdEmpty.innerHTML =
            '<span class="material-icons-round" style="vertical-align:middle;margin-right:6px;font-size:18px;color:#64748b;">search_off</span>' +
            (postAqlTableData.searchQuery || hasFilter || hasDate
                ? 'No records match the current filter.'
                : (postAqlTableData.allRows.length === 0 ? 'No data found in POST-AQL Details.' : 'No records found.'));
        trEmpty.appendChild(tdEmpty);
        tbody.appendChild(trEmpty);
        var infoEl2 = document.getElementById('post-aql-data-info');
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
        postAqlTableData.headers.forEach(function (header, ci) {
            var td = document.createElement('td');
            td.className = 'dt-td';
            var cellVal = String(row[ci] !== undefined && row[ci] !== null ? row[ci] : '');
            if (postAqlTableData.searchQuery && cellVal.toLowerCase().indexOf(postAqlTableData.searchQuery) !== -1) {
                td.innerHTML = esc(cellVal).replace(
                    new RegExp(escapeRegex(esc(postAqlTableData.searchQuery)), 'gi'),
                    '<mark class="dt-highlight">$&</mark>'
                );
            } else {
                td.textContent = cellVal;
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    var infoEl = document.getElementById('post-aql-data-info');
    if (infoEl) {
        infoEl.textContent = 'Showing ' + (start + 1) + ' to ' + end + ' of ' + total +
            (postAqlTableData.allRows.length !== total ? ' (filtered from ' + postAqlTableData.allRows.length + ' total)' : '') +
            ' entries';
    }
    buildPostAqlPagination(page, totalPages);
}

function buildPostAqlPagination(current, total) {
    var container = document.getElementById('post-aql-data-pagination');
    if (!container) return;
    container.innerHTML = '';
    function mkBtn(label, page, disabled, active, isIcon) {
        var btn = document.createElement('button');
        btn.className = 'dt-page-btn' + (active ? ' dt-page-btn-active' : '') + (disabled ? ' dt-page-btn-disabled' : '');
        btn.innerHTML = isIcon ? '<span class="material-icons-round" style="font-size:16px;">' + label + '</span>' : label;
        btn.disabled  = disabled;
        if (!disabled) {
            btn.addEventListener('click', function () {
                postAqlTableData.page = page;
                renderPostAqlTable();
                var wrap = document.getElementById('post-aql-data-table-wrap');
                if (wrap) wrap.scrollTop = 0;
            });
        }
        return btn;
    }
    container.appendChild(mkBtn('first_page',   1,           current <= 1,      false, true));
    container.appendChild(mkBtn('chevron_left', current - 1, current <= 1,      false, true));
    paginationRange(current, total).forEach(function (item) {
        if (item === '...' || item === '\u2026') {
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

function downloadPostAqlExcel() {
    var headers = postAqlTableData.headers;
    var rows    = postAqlTableData.filteredRows;
    exportRowsToXlsx({
        headers: headers,
        rows: rows,
        sheetName: 'POST-AQL Details',
        filenamePrefix: 'POST_AQL_Details'
    });
}

// ---------------------------------------------------------------------------
// WAREHOUSE-FMS Details — fetch + render
// ---------------------------------------------------------------------------
function updateWarehouseFmsDateClearBtn() {
    var btn = document.getElementById('warehouse-fms-date-clear');
    if (btn) btn.style.display = (warehouseFmsTableData.dateFrom || warehouseFmsTableData.dateTo) ? '' : 'none';
}

function updateWarehouseFmsSearchClearBtn() {
    var s = document.getElementById('warehouse-fms-data-search');
    var b = document.getElementById('warehouse-fms-data-search-clear');
    if (s && b) b.style.display = s.value ? '' : 'none';
}

function fetchWarehouseFmsDetailsAndRender() {
    var emptyEl  = document.getElementById('warehouse-fms-data-empty');
    var tableEl  = document.getElementById('warehouse-fms-data-table');
    var footerEl = document.getElementById('warehouse-fms-data-footer');
    if (emptyEl)  { emptyEl.querySelector('p').textContent = 'Loading data...'; emptyEl.style.display = ''; }
    if (tableEl)  tableEl.style.display  = 'none';
    if (footerEl) footerEl.style.display = 'none';
    showSpinner('Fetching WAREHOUSE-FMS details...');
    if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
            .withSuccessHandler(function (r) { hideSpinner(); onWarehouseFmsDataLoaded(r); })
            .withFailureHandler(function (e) { hideSpinner(); onWarehouseFmsDataError(e.message || 'Failed to load data.'); })
            .getWarehouseFmsDetailsData();
        return;
    }
    jsonp({ action: 'getWarehouseFmsDetailsData' }, function (err, result) {
        hideSpinner();
        if (err) { onWarehouseFmsDataError(err.message); return; }
        onWarehouseFmsDataLoaded(result);
    });
}

function onWarehouseFmsDataLoaded(result) {
    if (!result || !result.success) {
        onWarehouseFmsDataError((result && result.error) || 'Failed to load data.');
        return;
    }
    warehouseFmsTableData.headers       = result.headers || [];
    warehouseFmsTableData.allRows       = result.rows    || [];
    warehouseFmsTableData.filteredRows  = warehouseFmsTableData.allRows.slice();
    warehouseFmsTableData.sortCol       = -1;
    warehouseFmsTableData.sortAsc       = true;
    warehouseFmsTableData.page          = 1;
    warehouseFmsTableData.searchQuery   = '';
    warehouseFmsTableData.columnFilters = {};
    warehouseFmsTableData.dateFrom      = '';
    warehouseFmsTableData.dateTo        = '';

    var s = document.getElementById('warehouse-fms-data-search');
    if (s) s.value = '';
    updateWarehouseFmsSearchClearBtn();

    var df = document.getElementById('warehouse-fms-date-from');
    var dt = document.getElementById('warehouse-fms-date-to');
    if (df) df.value = '';
    if (dt) dt.value = '';
    updateWarehouseFmsDateClearBtn();

    var labelEl = document.getElementById('warehouse-fms-date-col-label');
    var dateCol = getWarehouseFmsDateColIndex();
    if (labelEl && warehouseFmsTableData.headers[dateCol]) {
        labelEl.textContent = warehouseFmsTableData.headers[dateCol];
    }

    buildWarehouseFmsTableHeaders();
    renderWarehouseFmsTable();
}

function onWarehouseFmsDataError(msg) {
    var emptyEl = document.getElementById('warehouse-fms-data-empty');
    if (emptyEl) { emptyEl.querySelector('p').textContent = 'Error: ' + msg; emptyEl.style.display = ''; }
    var tableEl = document.getElementById('warehouse-fms-data-table');
    if (tableEl) tableEl.style.display = 'none';
    var footerEl = document.getElementById('warehouse-fms-data-footer');
    if (footerEl) footerEl.style.display = 'none';
    showToast('error', 'Data Error', msg);
}

function buildWarehouseFmsTableHeaders() {
    var thead = document.getElementById('warehouse-fms-data-thead');
    if (!thead) return;
    thead.innerHTML = '';

    var trHead = document.createElement('tr');
    var thNum  = document.createElement('th');
    thNum.className = 'dt-th dt-th-num';
    thNum.textContent = '#';
    trHead.appendChild(thNum);
    warehouseFmsTableData.headers.forEach(function (h, i) {
        var th = document.createElement('th');
        th.className = 'dt-th dt-th-sortable';
        th.setAttribute('data-warehouse-fms-col', i);
        th.innerHTML = esc(h) + '<span class="dt-sort-icon material-icons-round">unfold_more</span>';
        th.addEventListener('click', function () { onWarehouseFmsSortColumn(i); });
        trHead.appendChild(th);
    });

    var trFilter = document.createElement('tr');
    trFilter.className = 'dt-filter-row';
    var thFilterNum = document.createElement('th');
    thFilterNum.className = 'dt-filter-cell dt-filter-cell-num';
    thFilterNum.innerHTML = '<span class="material-icons-round" style="font-size:12px;opacity:.45;color:#94a3b8;">filter_list</span>';
    trFilter.appendChild(thFilterNum);

    warehouseFmsTableData.headers.forEach(function (h, i) {
        var th    = document.createElement('th');
        th.className = 'dt-filter-cell';
        var wrap  = document.createElement('div');
        wrap.className = 'dt-col-filter-wrap';
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'dt-col-filter';
        input.placeholder = 'Filter...';
        input.value = warehouseFmsTableData.columnFilters[i] || '';
        var clearBtn = document.createElement('button');
        clearBtn.className = 'dt-col-filter-clear';
        clearBtn.title = 'Clear filter';
        clearBtn.innerHTML = '<span class="material-icons-round">close</span>';
        clearBtn.style.display = input.value ? '' : 'none';
        input.addEventListener('input', function () {
            warehouseFmsTableData.columnFilters[i] = input.value;
            clearBtn.style.display = input.value ? '' : 'none';
            applyWarehouseFmsFilters();
        });
        clearBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            input.value = '';
            warehouseFmsTableData.columnFilters[i] = '';
            clearBtn.style.display = 'none';
            applyWarehouseFmsFilters();
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

function onWarehouseFmsSortColumn(colIndex) {
    if (warehouseFmsTableData.sortCol === colIndex) {
        warehouseFmsTableData.sortAsc = !warehouseFmsTableData.sortAsc;
    } else {
        warehouseFmsTableData.sortCol = colIndex;
        warehouseFmsTableData.sortAsc = true;
    }
    updateWarehouseFmsSortIcons();
    applyWarehouseFmsFilters();
}

function updateWarehouseFmsSortIcons() {
    document.querySelectorAll('[data-warehouse-fms-col]').forEach(function (th) {
        var idx  = parseInt(th.getAttribute('data-warehouse-fms-col'), 10);
        var icon = th.querySelector('.dt-sort-icon');
        if (!icon) return;
        if (idx === warehouseFmsTableData.sortCol) {
            icon.textContent = warehouseFmsTableData.sortAsc ? 'arrow_upward' : 'arrow_downward';
            th.classList.add('dt-th-sorted');
        } else {
            icon.textContent = 'unfold_more';
            th.classList.remove('dt-th-sorted');
        }
    });
}

function applyWarehouseFmsFilters() {
    var query      = warehouseFmsTableData.searchQuery;
    var colFilters = warehouseFmsTableData.columnFilters;
    var dateColIdx = getWarehouseFmsDateColIndex();
    var dateFrom = warehouseFmsTableData.dateFrom ? new Date(warehouseFmsTableData.dateFrom + 'T00:00:00') : null;
    var dateTo = warehouseFmsTableData.dateTo ? new Date(warehouseFmsTableData.dateTo + 'T23:59:59') : null;
    var anyDateFilter = dateFrom || dateTo;

    warehouseFmsTableData.filteredRows = warehouseFmsTableData.allRows.filter(function (row) {
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

    if (warehouseFmsTableData.sortCol >= 0) {
        var sc = warehouseFmsTableData.sortCol;
        warehouseFmsTableData.filteredRows.sort(function (a, b) {
            var av = (a[sc] || '').toString().toLowerCase();
            var bv = (b[sc] || '').toString().toLowerCase();
            var numA = parseFloat(av), numB = parseFloat(bv);
            var isNum = !isNaN(numA) && !isNaN(numB);
            var cmp = isNum ? (numA - numB) : av.localeCompare(bv);
            return warehouseFmsTableData.sortAsc ? cmp : -cmp;
        });
    }

    warehouseFmsTableData.page = 1;
    renderWarehouseFmsTable();
}

function applyWarehouseFmsSearch(query) {
    warehouseFmsTableData.searchQuery = (query || '').trim().toLowerCase();
    applyWarehouseFmsFilters();
}

function renderWarehouseFmsTable() {
    var tbody      = document.getElementById('warehouse-fms-data-tbody');
    var tableEl    = document.getElementById('warehouse-fms-data-table');
    var emptyEl    = document.getElementById('warehouse-fms-data-empty');
    var footerEl   = document.getElementById('warehouse-fms-data-footer');
    var countBadge = document.getElementById('warehouse-fms-data-count-badge');
    if (!tbody) return;

    var total      = warehouseFmsTableData.filteredRows.length;
    var pageSize   = warehouseFmsTableData.pageSize;
    var page       = warehouseFmsTableData.page;
    var totalPages = Math.ceil(total / pageSize) || 1;
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    warehouseFmsTableData.page = page;

    var start = (page - 1) * pageSize;
    var end   = Math.min(start + pageSize, total);
    var slice = warehouseFmsTableData.filteredRows.slice(start, end);

    if (countBadge) countBadge.textContent = total + ' record' + (total !== 1 ? 's' : '');
    if (emptyEl)  emptyEl.style.display  = 'none';
    if (tableEl)  tableEl.style.display  = '';
    if (footerEl) footerEl.style.display = total > 0 ? '' : 'none';
    tbody.innerHTML = '';

    if (total === 0) {
        var trEmpty = document.createElement('tr');
        var tdEmpty = document.createElement('td');
        tdEmpty.className = 'dt-td-empty-msg';
        tdEmpty.setAttribute('colspan', warehouseFmsTableData.headers.length + 1);
        var hasFilter = Object.keys(warehouseFmsTableData.columnFilters).some(function (k) {
            return (warehouseFmsTableData.columnFilters[k] || '').trim() !== '';
        });
        var hasDate = warehouseFmsTableData.dateFrom || warehouseFmsTableData.dateTo;
        tdEmpty.innerHTML =
            '<span class="material-icons-round" style="vertical-align:middle;margin-right:6px;font-size:18px;color:#64748b;">search_off</span>' +
            (warehouseFmsTableData.searchQuery || hasFilter || hasDate
                ? 'No records match the current filter.'
                : (warehouseFmsTableData.allRows.length === 0 ? 'No data found in WAREHOUSE-FMS Details.' : 'No records found.'));
        trEmpty.appendChild(tdEmpty);
        tbody.appendChild(trEmpty);
        var infoEl2 = document.getElementById('warehouse-fms-data-info');
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
        warehouseFmsTableData.headers.forEach(function (header, ci) {
            var td = document.createElement('td');
            td.className = 'dt-td';
            var cellVal = String(row[ci] !== undefined && row[ci] !== null ? row[ci] : '');
            if (warehouseFmsTableData.searchQuery && cellVal.toLowerCase().indexOf(warehouseFmsTableData.searchQuery) !== -1) {
                td.innerHTML = esc(cellVal).replace(
                    new RegExp(escapeRegex(esc(warehouseFmsTableData.searchQuery)), 'gi'),
                    '<mark class="dt-highlight">$&</mark>'
                );
            } else {
                td.textContent = cellVal;
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    var infoEl = document.getElementById('warehouse-fms-data-info');
    if (infoEl) {
        infoEl.textContent = 'Showing ' + (start + 1) + ' to ' + end + ' of ' + total +
            (warehouseFmsTableData.allRows.length !== total ? ' (filtered from ' + warehouseFmsTableData.allRows.length + ' total)' : '') +
            ' entries';
    }
    buildWarehouseFmsPagination(page, totalPages);
}

function buildWarehouseFmsPagination(current, total) {
    var container = document.getElementById('warehouse-fms-data-pagination');
    if (!container) return;
    container.innerHTML = '';
    function mkBtn(label, page, disabled, active, isIcon) {
        var btn = document.createElement('button');
        btn.className = 'dt-page-btn' + (active ? ' dt-page-btn-active' : '') + (disabled ? ' dt-page-btn-disabled' : '');
        btn.innerHTML = isIcon ? '<span class="material-icons-round" style="font-size:16px;">' + label + '</span>' : label;
        btn.disabled  = disabled;
        if (!disabled) {
            btn.addEventListener('click', function () {
                warehouseFmsTableData.page = page;
                renderWarehouseFmsTable();
                var wrap = document.getElementById('warehouse-fms-data-table-wrap');
                if (wrap) wrap.scrollTop = 0;
            });
        }
        return btn;
    }
    container.appendChild(mkBtn('first_page',   1,           current <= 1,      false, true));
    container.appendChild(mkBtn('chevron_left', current - 1, current <= 1,      false, true));
    paginationRange(current, total).forEach(function (item) {
        if (item === '...' || item === '\u2026') {
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

function downloadWarehouseFmsExcel() {
    var headers = warehouseFmsTableData.headers;
    var rows    = warehouseFmsTableData.filteredRows;
    exportRowsToXlsx({
        headers: headers,
        rows: rows,
        sheetName: 'WAREHOUSE-FMS Details',
        filenamePrefix: 'WAREHOUSE_FMS_Details'
    });
}

// ---------------------------------------------------------------------------
// Shipment Details — fetch + render
// ---------------------------------------------------------------------------
function updateShipmentDateClearBtn() {
    var btn = document.getElementById('shipment-date-clear');
    if (btn) btn.style.display = (shipmentTableData.dateFrom || shipmentTableData.dateTo) ? '' : 'none';
}

function updateShipmentSearchClearBtn() {
    var s = document.getElementById('shipment-data-search');
    var b = document.getElementById('shipment-data-search-clear');
    if (s && b) b.style.display = s.value ? '' : 'none';
}

function fetchShipmentDetailsAndRender() {
    var emptyEl  = document.getElementById('shipment-data-empty');
    var tableEl  = document.getElementById('shipment-data-table');
    var footerEl = document.getElementById('shipment-data-footer');
    if (emptyEl)  { emptyEl.querySelector('p').textContent = 'Loading data...'; emptyEl.style.display = ''; }
    if (tableEl)  tableEl.style.display  = 'none';
    if (footerEl) footerEl.style.display = 'none';
    showSpinner('Fetching Shipment details...');
    if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
            .withSuccessHandler(function (r) { hideSpinner(); onShipmentDataLoaded(r); })
            .withFailureHandler(function (e) { hideSpinner(); onShipmentDataError(e.message || 'Failed to load data.'); })
            .getShipmentDetailsData();
        return;
    }
    jsonp({ action: 'getShipmentDetailsData' }, function (err, result) {
        hideSpinner();
        if (err) { onShipmentDataError(err.message); return; }
        onShipmentDataLoaded(result);
    });
}

function onShipmentDataLoaded(result) {
    if (!result || !result.success) {
        onShipmentDataError((result && result.error) || 'Failed to load data.');
        return;
    }
    shipmentTableData.headers       = result.headers || [];
    shipmentTableData.allRows       = result.rows    || [];
    shipmentTableData.filteredRows  = shipmentTableData.allRows.slice();
    shipmentTableData.sortCol       = -1;
    shipmentTableData.sortAsc       = true;
    shipmentTableData.page          = 1;
    shipmentTableData.searchQuery   = '';
    shipmentTableData.columnFilters = {};
    shipmentTableData.dateFrom      = '';
    shipmentTableData.dateTo        = '';

    var s = document.getElementById('shipment-data-search');
    if (s) s.value = '';
    updateShipmentSearchClearBtn();

    var df = document.getElementById('shipment-date-from');
    var dt = document.getElementById('shipment-date-to');
    if (df) df.value = '';
    if (dt) dt.value = '';
    updateShipmentDateClearBtn();

    var labelEl = document.getElementById('shipment-date-col-label');
    var dateCol = getShipmentDateColIndex();
    if (labelEl && shipmentTableData.headers[dateCol]) {
        labelEl.textContent = shipmentTableData.headers[dateCol];
    }

    buildShipmentTableHeaders();
    renderShipmentTable();
}

function onShipmentDataError(msg) {
    var emptyEl = document.getElementById('shipment-data-empty');
    if (emptyEl) { emptyEl.querySelector('p').textContent = 'Error: ' + msg; emptyEl.style.display = ''; }
    var tableEl = document.getElementById('shipment-data-table');
    if (tableEl) tableEl.style.display = 'none';
    var footerEl = document.getElementById('shipment-data-footer');
    if (footerEl) footerEl.style.display = 'none';
    showToast('error', 'Data Error', msg);
}

function buildShipmentTableHeaders() {
    var thead = document.getElementById('shipment-data-thead');
    if (!thead) return;
    thead.innerHTML = '';

    var trHead = document.createElement('tr');
    var thNum  = document.createElement('th');
    thNum.className = 'dt-th dt-th-num';
    thNum.textContent = '#';
    trHead.appendChild(thNum);
    shipmentTableData.headers.forEach(function (h, i) {
        var th = document.createElement('th');
        th.className = 'dt-th dt-th-sortable';
        th.setAttribute('data-shipment-col', i);
        th.innerHTML = esc(h) + '<span class="dt-sort-icon material-icons-round">unfold_more</span>';
        th.addEventListener('click', function () { onShipmentSortColumn(i); });
        trHead.appendChild(th);
    });

    var trFilter = document.createElement('tr');
    trFilter.className = 'dt-filter-row';
    var thFilterNum = document.createElement('th');
    thFilterNum.className = 'dt-filter-cell dt-filter-cell-num';
    thFilterNum.innerHTML = '<span class="material-icons-round" style="font-size:12px;opacity:.45;color:#94a3b8;">filter_list</span>';
    trFilter.appendChild(thFilterNum);

    shipmentTableData.headers.forEach(function (h, i) {
        var th    = document.createElement('th');
        th.className = 'dt-filter-cell';
        var wrap  = document.createElement('div');
        wrap.className = 'dt-col-filter-wrap';
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'dt-col-filter';
        input.placeholder = 'Filter...';
        input.value = shipmentTableData.columnFilters[i] || '';
        var clearBtn = document.createElement('button');
        clearBtn.className = 'dt-col-filter-clear';
        clearBtn.title = 'Clear filter';
        clearBtn.innerHTML = '<span class="material-icons-round">close</span>';
        clearBtn.style.display = input.value ? '' : 'none';
        input.addEventListener('input', function () {
            shipmentTableData.columnFilters[i] = input.value;
            clearBtn.style.display = input.value ? '' : 'none';
            applyShipmentFilters();
        });
        clearBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            input.value = '';
            shipmentTableData.columnFilters[i] = '';
            clearBtn.style.display = 'none';
            applyShipmentFilters();
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

function onShipmentSortColumn(colIndex) {
    if (shipmentTableData.sortCol === colIndex) {
        shipmentTableData.sortAsc = !shipmentTableData.sortAsc;
    } else {
        shipmentTableData.sortCol = colIndex;
        shipmentTableData.sortAsc = true;
    }
    updateShipmentSortIcons();
    applyShipmentFilters();
}

function updateShipmentSortIcons() {
    document.querySelectorAll('[data-shipment-col]').forEach(function (th) {
        var idx  = parseInt(th.getAttribute('data-shipment-col'), 10);
        var icon = th.querySelector('.dt-sort-icon');
        if (!icon) return;
        if (idx === shipmentTableData.sortCol) {
            icon.textContent = shipmentTableData.sortAsc ? 'arrow_upward' : 'arrow_downward';
            th.classList.add('dt-th-sorted');
        } else {
            icon.textContent = 'unfold_more';
            th.classList.remove('dt-th-sorted');
        }
    });
}

function applyShipmentFilters() {
    var query      = shipmentTableData.searchQuery;
    var colFilters = shipmentTableData.columnFilters;
    var dateColIdx = getShipmentDateColIndex();
    var dateFrom = shipmentTableData.dateFrom ? new Date(shipmentTableData.dateFrom + 'T00:00:00') : null;
    var dateTo = shipmentTableData.dateTo ? new Date(shipmentTableData.dateTo + 'T23:59:59') : null;
    var anyDateFilter = dateFrom || dateTo;

    shipmentTableData.filteredRows = shipmentTableData.allRows.filter(function (row) {
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

    if (shipmentTableData.sortCol >= 0) {
        var sc = shipmentTableData.sortCol;
        shipmentTableData.filteredRows.sort(function (a, b) {
            var av = (a[sc] || '').toString().toLowerCase();
            var bv = (b[sc] || '').toString().toLowerCase();
            var numA = parseFloat(av), numB = parseFloat(bv);
            var isNum = !isNaN(numA) && !isNaN(numB);
            var cmp = isNum ? (numA - numB) : av.localeCompare(bv);
            return shipmentTableData.sortAsc ? cmp : -cmp;
        });
    }

    shipmentTableData.page = 1;
    renderShipmentTable();
}

function applyShipmentSearch(query) {
    shipmentTableData.searchQuery = (query || '').trim().toLowerCase();
    applyShipmentFilters();
}

function renderShipmentTable() {
    var tbody      = document.getElementById('shipment-data-tbody');
    var tableEl    = document.getElementById('shipment-data-table');
    var emptyEl    = document.getElementById('shipment-data-empty');
    var footerEl   = document.getElementById('shipment-data-footer');
    var countBadge = document.getElementById('shipment-data-count-badge');
    if (!tbody) return;

    var total      = shipmentTableData.filteredRows.length;
    var pageSize   = shipmentTableData.pageSize;
    var page       = shipmentTableData.page;
    var totalPages = Math.ceil(total / pageSize) || 1;
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    shipmentTableData.page = page;

    var start = (page - 1) * pageSize;
    var end   = Math.min(start + pageSize, total);
    var slice = shipmentTableData.filteredRows.slice(start, end);

    if (countBadge) countBadge.textContent = total + ' record' + (total !== 1 ? 's' : '');
    if (emptyEl)  emptyEl.style.display  = 'none';
    if (tableEl)  tableEl.style.display  = '';
    if (footerEl) footerEl.style.display = total > 0 ? '' : 'none';
    tbody.innerHTML = '';

    if (total === 0) {
        var trEmpty = document.createElement('tr');
        var tdEmpty = document.createElement('td');
        tdEmpty.className = 'dt-td-empty-msg';
        tdEmpty.setAttribute('colspan', shipmentTableData.headers.length + 1);
        var hasFilter = Object.keys(shipmentTableData.columnFilters).some(function (k) {
            return (shipmentTableData.columnFilters[k] || '').trim() !== '';
        });
        var hasDate = shipmentTableData.dateFrom || shipmentTableData.dateTo;
        tdEmpty.innerHTML =
            '<span class="material-icons-round" style="vertical-align:middle;margin-right:6px;font-size:18px;color:#64748b;">search_off</span>' +
            (shipmentTableData.searchQuery || hasFilter || hasDate
                ? 'No records match the current filter.'
                : (shipmentTableData.allRows.length === 0 ? 'No data found in Shipment Details.' : 'No records found.'));
        trEmpty.appendChild(tdEmpty);
        tbody.appendChild(trEmpty);
        var infoEl2 = document.getElementById('shipment-data-info');
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
        shipmentTableData.headers.forEach(function (header, ci) {
            var td = document.createElement('td');
            td.className = 'dt-td';
            var cellVal = String(row[ci] !== undefined && row[ci] !== null ? row[ci] : '');
            if (shipmentTableData.searchQuery && cellVal.toLowerCase().indexOf(shipmentTableData.searchQuery) !== -1) {
                td.innerHTML = esc(cellVal).replace(
                    new RegExp(escapeRegex(esc(shipmentTableData.searchQuery)), 'gi'),
                    '<mark class="dt-highlight">$&</mark>'
                );
            } else {
                td.textContent = cellVal;
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    var infoEl = document.getElementById('shipment-data-info');
    if (infoEl) {
        infoEl.textContent = 'Showing ' + (start + 1) + ' to ' + end + ' of ' + total +
            (shipmentTableData.allRows.length !== total ? ' (filtered from ' + shipmentTableData.allRows.length + ' total)' : '') +
            ' entries';
    }
    buildShipmentPagination(page, totalPages);
}

function buildShipmentPagination(current, total) {
    var container = document.getElementById('shipment-data-pagination');
    if (!container) return;
    container.innerHTML = '';
    function mkBtn(label, page, disabled, active, isIcon) {
        var btn = document.createElement('button');
        btn.className = 'dt-page-btn' + (active ? ' dt-page-btn-active' : '') + (disabled ? ' dt-page-btn-disabled' : '');
        btn.innerHTML = isIcon ? '<span class="material-icons-round" style="font-size:16px;">' + label + '</span>' : label;
        btn.disabled  = disabled;
        if (!disabled) {
            btn.addEventListener('click', function () {
                shipmentTableData.page = page;
                renderShipmentTable();
                var wrap = document.getElementById('shipment-data-table-wrap');
                if (wrap) wrap.scrollTop = 0;
            });
        }
        return btn;
    }
    container.appendChild(mkBtn('first_page',   1,           current <= 1,      false, true));
    container.appendChild(mkBtn('chevron_left', current - 1, current <= 1,      false, true));
    paginationRange(current, total).forEach(function (item) {
        if (item === '...' || item === '\u2026') {
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

function downloadShipmentExcel() {
    var headers = shipmentTableData.headers;
    var rows    = shipmentTableData.filteredRows;
    exportRowsToXlsx({
        headers: headers,
        rows: rows,
        sheetName: 'Shipment Details',
        filenamePrefix: 'Shipment_Details'
    });
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------
function initEndLineQc() {
    var kpiCard = document.getElementById('kpi-endline-qc-details');
    if (kpiCard) {
        kpiCard.addEventListener('click', function () { showBatchListEndLineQcView(); });
        kpiCard.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showBatchListEndLineQcView(); }
        });
    }

    var backBtn = document.getElementById('btn-back-endline-qc');
    if (backBtn) backBtn.addEventListener('click', function () { backToBatchListKpiView(); });

    var excelBtn = document.getElementById('btn-download-endline-qc-excel');
    if (excelBtn) excelBtn.addEventListener('click', function () { downloadEndLineQcExcel(); });

    var refreshBtn = document.getElementById('btn-refresh-endline-qc-data');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function () {
            endLineQcTableData.allRows       = [];
            endLineQcTableData.columnFilters = {};
            fetchEndLineQcDetailsAndRender();
        });
    }

    var searchEl = document.getElementById('endline-qc-data-search');
    if (searchEl) {
        searchEl.addEventListener('input', function () {
            updateEndLineQcSearchClearBtn();
            applyEndLineQcSearch(searchEl.value);
        });
    }
    var clearSearch = document.getElementById('endline-qc-data-search-clear');
    if (clearSearch) {
        clearSearch.addEventListener('click', function () {
            var s = document.getElementById('endline-qc-data-search');
            if (s) { s.value = ''; s.focus(); }
            updateEndLineQcSearchClearBtn();
            applyEndLineQcSearch('');
        });
    }

    var dateFrom = document.getElementById('endline-qc-date-from');
    if (dateFrom) {
        dateFrom.addEventListener('change', function () {
            endLineQcTableData.dateFrom = dateFrom.value;
            updateEndLineQcDateClearBtn();
            applyEndLineQcFilters();
        });
    }
    var dateTo = document.getElementById('endline-qc-date-to');
    if (dateTo) {
        dateTo.addEventListener('change', function () {
            endLineQcTableData.dateTo = dateTo.value;
            updateEndLineQcDateClearBtn();
            applyEndLineQcFilters();
        });
    }
    var dateClear = document.getElementById('endline-qc-date-clear');
    if (dateClear) {
        dateClear.addEventListener('click', function () {
            endLineQcTableData.dateFrom = '';
            endLineQcTableData.dateTo   = '';
            var f = document.getElementById('endline-qc-date-from');
            var t = document.getElementById('endline-qc-date-to');
            if (f) f.value = '';
            if (t) t.value = '';
            updateEndLineQcDateClearBtn();
            applyEndLineQcFilters();
        });
    }

    var pageSize = document.getElementById('endline-qc-data-page-size');
    if (pageSize) {
        pageSize.addEventListener('change', function () {
            endLineQcTableData.pageSize = parseInt(pageSize.value, 10) || 25;
            endLineQcTableData.page = 1;
            renderEndLineQcTable();
        });
    }
}

function initPostAql() {
    var kpiCard = document.getElementById('kpi-post-aql-details');
    if (kpiCard) {
        kpiCard.addEventListener('click', function () { showBatchListPostAqlView(); });
        kpiCard.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showBatchListPostAqlView(); }
        });
    }

    var backBtn = document.getElementById('btn-back-post-aql');
    if (backBtn) backBtn.addEventListener('click', function () { backToBatchListKpiViewFromPostAql(); });

    var excelBtn = document.getElementById('btn-download-post-aql-excel');
    if (excelBtn) excelBtn.addEventListener('click', function () { downloadPostAqlExcel(); });

    var refreshBtn = document.getElementById('btn-refresh-post-aql-data');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function () {
            postAqlTableData.allRows       = [];
            postAqlTableData.columnFilters = {};
            fetchPostAqlDetailsAndRender();
        });
    }

    var searchEl = document.getElementById('post-aql-data-search');
    if (searchEl) {
        searchEl.addEventListener('input', function () {
            updatePostAqlSearchClearBtn();
            applyPostAqlSearch(searchEl.value);
        });
    }
    var clearSearch = document.getElementById('post-aql-data-search-clear');
    if (clearSearch) {
        clearSearch.addEventListener('click', function () {
            var s = document.getElementById('post-aql-data-search');
            if (s) { s.value = ''; s.focus(); }
            updatePostAqlSearchClearBtn();
            applyPostAqlSearch('');
        });
    }

    var dateFrom = document.getElementById('post-aql-date-from');
    if (dateFrom) {
        dateFrom.addEventListener('change', function () {
            postAqlTableData.dateFrom = dateFrom.value;
            updatePostAqlDateClearBtn();
            applyPostAqlFilters();
        });
    }
    var dateTo = document.getElementById('post-aql-date-to');
    if (dateTo) {
        dateTo.addEventListener('change', function () {
            postAqlTableData.dateTo = dateTo.value;
            updatePostAqlDateClearBtn();
            applyPostAqlFilters();
        });
    }
    var dateClear = document.getElementById('post-aql-date-clear');
    if (dateClear) {
        dateClear.addEventListener('click', function () {
            postAqlTableData.dateFrom = '';
            postAqlTableData.dateTo   = '';
            var f = document.getElementById('post-aql-date-from');
            var t = document.getElementById('post-aql-date-to');
            if (f) f.value = '';
            if (t) t.value = '';
            updatePostAqlDateClearBtn();
            applyPostAqlFilters();
        });
    }

    var pageSize = document.getElementById('post-aql-data-page-size');
    if (pageSize) {
        pageSize.addEventListener('change', function () {
            postAqlTableData.pageSize = parseInt(pageSize.value, 10) || 25;
            postAqlTableData.page = 1;
            renderPostAqlTable();
        });
    }
}

function initWarehouseFms() {
    var kpiCard = document.getElementById('kpi-warehouse-fms-details');
    if (kpiCard) {
        kpiCard.addEventListener('click', function () { showBatchListWarehouseFmsView(); });
        kpiCard.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showBatchListWarehouseFmsView(); }
        });
    }

    var backBtn = document.getElementById('btn-back-warehouse-fms');
    if (backBtn) backBtn.addEventListener('click', function () { backToBatchListKpiViewFromWarehouseFms(); });

    var excelBtn = document.getElementById('btn-download-warehouse-fms-excel');
    if (excelBtn) excelBtn.addEventListener('click', function () { downloadWarehouseFmsExcel(); });

    var refreshBtn = document.getElementById('btn-refresh-warehouse-fms-data');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function () {
            warehouseFmsTableData.allRows       = [];
            warehouseFmsTableData.columnFilters = {};
            fetchWarehouseFmsDetailsAndRender();
        });
    }

    var searchEl = document.getElementById('warehouse-fms-data-search');
    if (searchEl) {
        searchEl.addEventListener('input', function () {
            updateWarehouseFmsSearchClearBtn();
            applyWarehouseFmsSearch(searchEl.value);
        });
    }
    var clearSearch = document.getElementById('warehouse-fms-data-search-clear');
    if (clearSearch) {
        clearSearch.addEventListener('click', function () {
            var s = document.getElementById('warehouse-fms-data-search');
            if (s) { s.value = ''; s.focus(); }
            updateWarehouseFmsSearchClearBtn();
            applyWarehouseFmsSearch('');
        });
    }

    var dateFrom = document.getElementById('warehouse-fms-date-from');
    if (dateFrom) {
        dateFrom.addEventListener('change', function () {
            warehouseFmsTableData.dateFrom = dateFrom.value;
            updateWarehouseFmsDateClearBtn();
            applyWarehouseFmsFilters();
        });
    }
    var dateTo = document.getElementById('warehouse-fms-date-to');
    if (dateTo) {
        dateTo.addEventListener('change', function () {
            warehouseFmsTableData.dateTo = dateTo.value;
            updateWarehouseFmsDateClearBtn();
            applyWarehouseFmsFilters();
        });
    }
    var dateClear = document.getElementById('warehouse-fms-date-clear');
    if (dateClear) {
        dateClear.addEventListener('click', function () {
            warehouseFmsTableData.dateFrom = '';
            warehouseFmsTableData.dateTo   = '';
            var f = document.getElementById('warehouse-fms-date-from');
            var t = document.getElementById('warehouse-fms-date-to');
            if (f) f.value = '';
            if (t) t.value = '';
            updateWarehouseFmsDateClearBtn();
            applyWarehouseFmsFilters();
        });
    }

    var pageSize = document.getElementById('warehouse-fms-data-page-size');
    if (pageSize) {
        pageSize.addEventListener('change', function () {
            warehouseFmsTableData.pageSize = parseInt(pageSize.value, 10) || 25;
            warehouseFmsTableData.page = 1;
            renderWarehouseFmsTable();
        });
    }
}

function initShipment() {
    var kpiCard = document.getElementById('kpi-shipment-details');
    if (kpiCard) {
        kpiCard.addEventListener('click', function () { showBatchListShipmentView(); });
        kpiCard.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showBatchListShipmentView(); }
        });
    }

    var backBtn = document.getElementById('btn-back-shipment');
    if (backBtn) backBtn.addEventListener('click', function () { backToBatchListKpiViewFromShipment(); });

    var excelBtn = document.getElementById('btn-download-shipment-excel');
    if (excelBtn) excelBtn.addEventListener('click', function () { downloadShipmentExcel(); });

    var refreshBtn = document.getElementById('btn-refresh-shipment-data');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function () {
            shipmentTableData.allRows       = [];
            shipmentTableData.columnFilters = {};
            fetchShipmentDetailsAndRender();
        });
    }

    var searchEl = document.getElementById('shipment-data-search');
    if (searchEl) {
        searchEl.addEventListener('input', function () {
            updateShipmentSearchClearBtn();
            applyShipmentSearch(searchEl.value);
        });
    }
    var clearSearch = document.getElementById('shipment-data-search-clear');
    if (clearSearch) {
        clearSearch.addEventListener('click', function () {
            var s = document.getElementById('shipment-data-search');
            if (s) { s.value = ''; s.focus(); }
            updateShipmentSearchClearBtn();
            applyShipmentSearch('');
        });
    }

    var dateFrom = document.getElementById('shipment-date-from');
    if (dateFrom) {
        dateFrom.addEventListener('change', function () {
            shipmentTableData.dateFrom = dateFrom.value;
            updateShipmentDateClearBtn();
            applyShipmentFilters();
        });
    }
    var dateTo = document.getElementById('shipment-date-to');
    if (dateTo) {
        dateTo.addEventListener('change', function () {
            shipmentTableData.dateTo = dateTo.value;
            updateShipmentDateClearBtn();
            applyShipmentFilters();
        });
    }
    var dateClear = document.getElementById('shipment-date-clear');
    if (dateClear) {
        dateClear.addEventListener('click', function () {
            shipmentTableData.dateFrom = '';
            shipmentTableData.dateTo   = '';
            var f = document.getElementById('shipment-date-from');
            var t = document.getElementById('shipment-date-to');
            if (f) f.value = '';
            if (t) t.value = '';
            updateShipmentDateClearBtn();
            applyShipmentFilters();
        });
    }

    var pageSize = document.getElementById('shipment-data-page-size');
    if (pageSize) {
        pageSize.addEventListener('change', function () {
            shipmentTableData.pageSize = parseInt(pageSize.value, 10) || 25;
            shipmentTableData.page = 1;
            renderShipmentTable();
        });
    }
}

// =============================================================================
// OT & LEAVE — OT Details / Leave Details / OT & Leave Analysis
// =============================================================================
// Unlike the Production Data sub-views above, this data lives in a SEPARATE
// Google Sheet powered by its own standalone Apps Script Web App (OT.gs —
// see that file for setup instructions), so we talk to it with a plain
// fetch() call — the same technique app.js already uses for the DICE_FORMA
// web app — instead of the shared jsonp()/GAS_URL helper.
//
// After deploying OT.gs as its own Web App, paste the resulting /exec URL
// below (it is already pre-filled with the URL supplied when this feature
// was built).
// =============================================================================

var OT_LEAVE_URL = 'https://script.google.com/macros/s/AKfycbxsJ1vRxzXNO-vQ2LG2PYGFy73SDCM2VxEo-cznzKYku_hbJ8B7uaFwCOPwMX3LPLsefw/exec';

// One config-driven implementation shared by all three sub-views — same
// approach app.js uses for the Dice/Forma "tracker summary" sub-views.
var otLeaveTableStates = {
    'ot-details': {
        headers: [], allRows: [], filteredRows: [], sortCol: -1, sortAsc: true,
        page: 1, pageSize: 25, searchQuery: '', columnFilters: {}, dateFrom: '', dateTo: ''
    },
    'leave-details': {
        headers: [], allRows: [], filteredRows: [], sortCol: -1, sortAsc: true,
        page: 1, pageSize: 25, searchQuery: '', columnFilters: {}, dateFrom: '', dateTo: ''
    },
    'ot-leave-analysis': {
        headers: [], allRows: [], filteredRows: [], sortCol: -1, sortAsc: true,
        page: 1, pageSize: 25, searchQuery: '', columnFilters: {}, dateFrom: '', dateTo: ''
    }
};

function getOtLeaveState(type) { return otLeaveTableStates[type]; }

// `type` doubles as the DOM id prefix used throughout ot-details-view /
// leave-details-view / ot-leave-analysis-view in index.html.
function getOtLeaveConfig(type) {
    if (type === 'ot-details') {
        return {
            prefix: 'ot-details', viewId: 'ot-details-view', action: 'getOtDetailsData',
            label: 'OT Details', emptyLabel: 'OT Details',
            excelSheetName: 'OT Details', excelFilePrefix: 'OT_Details'
        };
    }
    if (type === 'leave-details') {
        return {
            prefix: 'leave-details', viewId: 'leave-details-view', action: 'getLeaveDetailsData',
            label: 'Leave Details', emptyLabel: 'Leave Details',
            excelSheetName: 'Leave Details', excelFilePrefix: 'Leave_Details'
        };
    }
    return {
        prefix: 'ot-leave-analysis', viewId: 'ot-leave-analysis-view', action: 'getOtLeaveAnalysisData',
        label: 'OT & Leave Analysis', emptyLabel: 'OT & Leave Analysis',
        excelSheetName: 'OT & Leave Analysis', excelFilePrefix: 'OT_Leave_Analysis'
    };
}

// Column B of the source sheet (index 0 of the loaded range) is assumed to
// be the date column for the "From/To" date-range filter, same convention
// used across the rest of the app.
function getOtLeaveDateColIndex() { return 0; }

function showOtLeaveKpiView() {
    var kpiView = document.getElementById('ot-leave-kpi-view');
    if (kpiView) kpiView.style.display = '';
    ['ot-details', 'leave-details', 'ot-leave-analysis'].forEach(function (type) {
        var view = document.getElementById(getOtLeaveConfig(type).viewId);
        if (view) view.style.display = 'none';
    });
}

function showOtLeaveDetailView(type) {
    var config  = getOtLeaveConfig(type);
    var kpiView = document.getElementById('ot-leave-kpi-view');
    var view    = document.getElementById(config.viewId);
    if (kpiView) kpiView.style.display = 'none';
    ['ot-details', 'leave-details', 'ot-leave-analysis'].forEach(function (t) {
        var v = document.getElementById(getOtLeaveConfig(t).viewId);
        if (v) v.style.display = (t === type) ? '' : 'none';
    });
    if (view) view.style.display = '';

    var state = getOtLeaveState(type);
    if (state.allRows.length === 0) {
        fetchOtLeaveData(type);
    } else {
        renderOtLeaveTable(type);
    }
}

function fetchOtLeaveData(type) {
    var config   = getOtLeaveConfig(type);
    var prefix   = config.prefix;
    var emptyEl  = document.getElementById(prefix + '-data-empty');
    var tableEl  = document.getElementById(prefix + '-data-table');
    var footerEl = document.getElementById(prefix + '-data-footer');
    if (emptyEl)  { emptyEl.querySelector('p').textContent = 'Loading data…'; emptyEl.style.display = ''; }
    if (tableEl)  tableEl.style.display  = 'none';
    if (footerEl) footerEl.style.display = 'none';
    showSpinner('Fetching ' + config.label + ' data…');

    fetch(OT_LEAVE_URL + '?action=' + encodeURIComponent(config.action) + '&_=' + Date.now())
        .then(function (response) {
            if (!response.ok) throw new Error('The OT & Leave server returned HTTP ' + response.status + '.');
            return response.json();
        })
        .then(function (result) {
            hideSpinner();
            if (!result || !result.success) throw new Error((result && result.error) || 'Could not load data.');
            if (!Array.isArray(result.headers) || !Array.isArray(result.rows)) {
                throw new Error('The OT & Leave web app needs to be redeployed with the latest OT.gs code.');
            }
            onOtLeaveDataLoaded(type, result);
        })
        .catch(function (err) {
            hideSpinner();
            onOtLeaveDataError(type, err.message || 'Could not load data.');
        });
}

function onOtLeaveDataLoaded(type, result) {
    var config = getOtLeaveConfig(type);
    var prefix = config.prefix;
    var state  = getOtLeaveState(type);

    state.headers       = result.headers || [];
    state.allRows       = result.rows    || [];
    state.filteredRows  = state.allRows.slice();
    state.sortCol       = -1;
    state.sortAsc       = true;
    state.page          = 1;
    state.searchQuery    = '';
    state.columnFilters = {};
    state.dateFrom       = '';
    state.dateTo         = '';

    var searchEl = document.getElementById(prefix + '-data-search');
    if (searchEl) searchEl.value = '';
    updateOtLeaveSearchClearBtn(type);

    var dFrom = document.getElementById(prefix + '-date-from');
    var dTo   = document.getElementById(prefix + '-date-to');
    if (dFrom) dFrom.value = '';
    if (dTo)   dTo.value   = '';
    updateOtLeaveDateClearBtn(type);

    var labelEl = document.getElementById(prefix + '-date-col-label');
    if (labelEl && state.headers[getOtLeaveDateColIndex()]) {
        labelEl.textContent = state.headers[getOtLeaveDateColIndex()];
    }

    buildOtLeaveTableHeaders(type);
    renderOtLeaveTable(type);
}

function onOtLeaveDataError(type, msg) {
    var config  = getOtLeaveConfig(type);
    var prefix  = config.prefix;
    var emptyEl = document.getElementById(prefix + '-data-empty');
    if (emptyEl) { emptyEl.querySelector('p').textContent = 'Error: ' + msg; emptyEl.style.display = ''; }
    var tableEl = document.getElementById(prefix + '-data-table');
    if (tableEl) tableEl.style.display = 'none';
    var footerEl = document.getElementById(prefix + '-data-footer');
    if (footerEl) footerEl.style.display = 'none';
    showToast('error', config.label + ' Data Error', msg);
}

function buildOtLeaveTableHeaders(type) {
    var config = getOtLeaveConfig(type);
    var prefix = config.prefix;
    var state  = getOtLeaveState(type);
    var thead  = document.getElementById(prefix + '-data-thead');
    if (!thead) return;
    thead.innerHTML = '';

    var trHead = document.createElement('tr');
    var thNum  = document.createElement('th');
    thNum.className = 'dt-th dt-th-num';
    thNum.textContent = '#';
    trHead.appendChild(thNum);
    state.headers.forEach(function (h, i) {
        var th = document.createElement('th');
        th.className = 'dt-th dt-th-sortable';
        th.setAttribute('data-' + prefix + '-col', i);
        th.innerHTML = esc(h) + '<span class="dt-sort-icon material-icons-round">unfold_more</span>';
        th.addEventListener('click', function () { onOtLeaveSortColumn(type, i); });
        trHead.appendChild(th);
    });

    var trFilter    = document.createElement('tr');
    trFilter.className = 'dt-filter-row';
    var thFilterNum = document.createElement('th');
    thFilterNum.className = 'dt-filter-cell dt-filter-cell-num';
    thFilterNum.innerHTML = '<span class="material-icons-round" style="font-size:12px;opacity:.45;color:#94a3b8;">filter_list</span>';
    trFilter.appendChild(thFilterNum);
    state.headers.forEach(function (h, i) {
        var th   = document.createElement('th');
        th.className = 'dt-filter-cell';
        var wrap = document.createElement('div');
        wrap.className = 'dt-col-filter-wrap';
        var input = document.createElement('input');
        input.type        = 'text';
        input.className   = 'dt-col-filter';
        input.placeholder = 'Filter…';
        input.value       = state.columnFilters[i] || '';
        var clearBtn = document.createElement('button');
        clearBtn.className     = 'dt-col-filter-clear';
        clearBtn.title         = 'Clear filter';
        clearBtn.innerHTML     = '<span class="material-icons-round">close</span>';
        clearBtn.style.display = input.value ? '' : 'none';
        input.addEventListener('input', function () {
            state.columnFilters[i] = input.value;
            clearBtn.style.display = input.value ? '' : 'none';
            applyOtLeaveFilters(type);
        });
        clearBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            input.value = '';
            state.columnFilters[i] = '';
            clearBtn.style.display = 'none';
            applyOtLeaveFilters(type);
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

function onOtLeaveSortColumn(type, colIndex) {
    var state = getOtLeaveState(type);
    if (state.sortCol === colIndex) {
        state.sortAsc = !state.sortAsc;
    } else {
        state.sortCol = colIndex;
        state.sortAsc = true;
    }
    updateOtLeaveSortIcons(type);
    applyOtLeaveFilters(type);
}

function updateOtLeaveSortIcons(type) {
    var config = getOtLeaveConfig(type);
    var state  = getOtLeaveState(type);
    document.querySelectorAll('[data-' + config.prefix + '-col]').forEach(function (th) {
        var idx  = parseInt(th.getAttribute('data-' + config.prefix + '-col'), 10);
        var icon = th.querySelector('.dt-sort-icon');
        if (!icon) return;
        if (idx === state.sortCol) {
            icon.textContent = state.sortAsc ? 'arrow_upward' : 'arrow_downward';
            th.classList.add('dt-th-sorted');
        } else {
            icon.textContent = 'unfold_more';
            th.classList.remove('dt-th-sorted');
        }
    });
}

function updateOtLeaveDateClearBtn(type) {
    var config   = getOtLeaveConfig(type);
    var state    = getOtLeaveState(type);
    var clearBtn = document.getElementById(config.prefix + '-date-clear');
    if (!clearBtn) return;
    clearBtn.style.display = (state.dateFrom || state.dateTo) ? '' : 'none';
}

function updateOtLeaveSearchClearBtn(type) {
    var config   = getOtLeaveConfig(type);
    var searchEl = document.getElementById(config.prefix + '-data-search');
    var clearBtn = document.getElementById(config.prefix + '-data-search-clear');
    if (!searchEl || !clearBtn) return;
    clearBtn.style.display = searchEl.value ? '' : 'none';
}

function applyOtLeaveFilters(type) {
    var state      = getOtLeaveState(type);
    var query      = state.searchQuery;
    var colFilters = state.columnFilters;
    var dateColIdx = getOtLeaveDateColIndex();

    var dateFrom = state.dateFrom ? new Date(state.dateFrom + 'T00:00:00') : null;
    var dateTo   = state.dateTo   ? new Date(state.dateTo   + 'T23:59:59') : null;
    var anyDateFilter = dateFrom || dateTo;

    state.filteredRows = state.allRows.filter(function (row) {
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
        if (anyDateFilter && dateColIdx >= 0) {
            var rawDate = row[dateColIdx];
            var parsed  = parseCreatedAt(rawDate);
            if (!parsed) return false;
            if (dateFrom && parsed < dateFrom) return false;
            if (dateTo   && parsed > dateTo)   return false;
        }
        return true;
    });

    if (state.sortCol >= 0) {
        var sc = state.sortCol;
        state.filteredRows.sort(function (a, b) {
            var av = (a[sc] || '').toString().toLowerCase();
            var bv = (b[sc] || '').toString().toLowerCase();
            var numA = parseFloat(av), numB = parseFloat(bv);
            var isNum = !isNaN(numA) && !isNaN(numB);
            var cmp = isNum ? (numA - numB) : av.localeCompare(bv);
            return state.sortAsc ? cmp : -cmp;
        });
    }
    state.page = 1;
    renderOtLeaveTable(type);
}

function applyOtLeaveSearch(type, query) {
    var state = getOtLeaveState(type);
    state.searchQuery = (query || '').trim().toLowerCase();
    applyOtLeaveFilters(type);
}

function renderOtLeaveTable(type) {
    var config = getOtLeaveConfig(type);
    var prefix = config.prefix;
    var state  = getOtLeaveState(type);

    var tbody      = document.getElementById(prefix + '-data-tbody');
    var tableEl    = document.getElementById(prefix + '-data-table');
    var emptyEl    = document.getElementById(prefix + '-data-empty');
    var footerEl   = document.getElementById(prefix + '-data-footer');
    var countBadge = document.getElementById(prefix + '-data-count-badge');
    if (!tbody) return;

    var total      = state.filteredRows.length;
    var pageSize   = state.pageSize;
    var page       = state.page;
    var totalPages = Math.ceil(total / pageSize) || 1;
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    state.page = page;

    var start = (page - 1) * pageSize;
    var end   = Math.min(start + pageSize, total);
    var slice = state.filteredRows.slice(start, end);

    if (countBadge) countBadge.textContent = total + ' record' + (total !== 1 ? 's' : '');
    if (emptyEl)  emptyEl.style.display  = 'none';
    if (tableEl)  tableEl.style.display  = '';
    if (footerEl) footerEl.style.display = total > 0 ? '' : 'none';
    tbody.innerHTML = '';

    if (total === 0) {
        var trEmpty = document.createElement('tr');
        var tdEmpty = document.createElement('td');
        tdEmpty.className = 'dt-td-empty-msg';
        tdEmpty.setAttribute('colspan', state.headers.length + 1);
        var hasFilter = Object.keys(state.columnFilters).some(function (k) {
            return (state.columnFilters[k] || '').trim() !== '';
        });
        var hasDate = state.dateFrom || state.dateTo;
        tdEmpty.innerHTML = '<span class="material-icons-round" style="vertical-align:middle;margin-right:6px;font-size:18px;color:#64748b;">search_off</span>' +
            (state.searchQuery || hasFilter || hasDate
                ? 'No records match the current filter.'
                : (state.allRows.length === 0 ? 'No data found in ' + config.emptyLabel + '.' : 'No records found.'));
        trEmpty.appendChild(tdEmpty);
        tbody.appendChild(trEmpty);
        var infoEl2 = document.getElementById(prefix + '-data-info');
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
        state.headers.forEach(function (header, ci) {
            var td = document.createElement('td');
            td.className = 'dt-td';
            var cellVal = String(row[ci] !== undefined && row[ci] !== null ? row[ci] : '');
            if (state.searchQuery && cellVal.toLowerCase().indexOf(state.searchQuery) !== -1) {
                td.innerHTML = esc(cellVal).replace(
                    new RegExp(escapeRegex(esc(state.searchQuery)), 'gi'),
                    '<mark class="dt-highlight">$&</mark>'
                );
            } else {
                td.textContent = cellVal;
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    var infoEl = document.getElementById(prefix + '-data-info');
    if (infoEl) {
        infoEl.textContent = 'Showing ' + (start + 1) + ' to ' + end + ' of ' + total +
            (state.allRows.length !== total ? ' (filtered from ' + state.allRows.length + ' total)' : '') +
            ' entries';
    }
    buildOtLeavePagination(type, page, totalPages);
}

function buildOtLeavePagination(type, current, total) {
    var config    = getOtLeaveConfig(type);
    var state     = getOtLeaveState(type);
    var container = document.getElementById(config.prefix + '-data-pagination');
    if (!container) return;
    container.innerHTML = '';
    function mkBtn(label, page, disabled, active, isIcon) {
        var btn = document.createElement('button');
        btn.className = 'dt-page-btn' + (active ? ' dt-page-btn-active' : '') + (disabled ? ' dt-page-btn-disabled' : '');
        btn.innerHTML = isIcon ? '<span class="material-icons-round" style="font-size:16px;">' + label + '</span>' : label;
        btn.disabled  = disabled;
        if (!disabled) {
            btn.addEventListener('click', function () {
                state.page = page;
                renderOtLeaveTable(type);
                var wrap = document.getElementById(config.prefix + '-data-table-wrap');
                if (wrap) wrap.scrollTop = 0;
            });
        }
        return btn;
    }
    container.appendChild(mkBtn('first_page',   1,           current <= 1,      false, true));
    container.appendChild(mkBtn('chevron_left', current - 1, current <= 1,      false, true));
    paginationRange(current, total).forEach(function (item) {
        if (item === '…' || item === '...') {
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

function downloadOtLeaveExcel(type) {
    var config  = getOtLeaveConfig(type);
    var state   = getOtLeaveState(type);
    exportRowsToXlsx({
        headers: state.headers,
        rows: state.filteredRows,
        sheetName: config.excelSheetName,
        filenamePrefix: config.excelFilePrefix
    });
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------
function initOtLeave() {
    ['ot-details', 'leave-details', 'ot-leave-analysis'].forEach(function (type) {
        var config  = getOtLeaveConfig(type);
        var prefix  = config.prefix;
        var kpiId   = 'kpi-' + type;
        var kpiCard = document.getElementById(kpiId);
        if (kpiCard) {
            kpiCard.addEventListener('click', function () { showOtLeaveDetailView(type); });
            kpiCard.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showOtLeaveDetailView(type); }
            });
        }

        var backBtn = document.getElementById('btn-back-' + prefix);
        if (backBtn) backBtn.addEventListener('click', function () { showOtLeaveKpiView(); });

        var excelBtn = document.getElementById('btn-download-' + prefix + '-excel');
        if (excelBtn) excelBtn.addEventListener('click', function () { downloadOtLeaveExcel(type); });

        var refreshBtn = document.getElementById('btn-refresh-' + prefix + '-data');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function () {
                var state = getOtLeaveState(type);
                state.allRows       = [];
                state.columnFilters = {};
                fetchOtLeaveData(type);
            });
        }

        var searchEl = document.getElementById(prefix + '-data-search');
        if (searchEl) {
            searchEl.addEventListener('input', function () {
                updateOtLeaveSearchClearBtn(type);
                applyOtLeaveSearch(type, searchEl.value);
            });
        }
        var clearSearch = document.getElementById(prefix + '-data-search-clear');
        if (clearSearch) {
            clearSearch.addEventListener('click', function () {
                var s = document.getElementById(prefix + '-data-search');
                if (s) { s.value = ''; s.focus(); }
                updateOtLeaveSearchClearBtn(type);
                applyOtLeaveSearch(type, '');
            });
        }

        var dateFrom = document.getElementById(prefix + '-date-from');
        if (dateFrom) {
            dateFrom.addEventListener('change', function () {
                getOtLeaveState(type).dateFrom = dateFrom.value;
                updateOtLeaveDateClearBtn(type);
                applyOtLeaveFilters(type);
            });
        }
        var dateTo = document.getElementById(prefix + '-date-to');
        if (dateTo) {
            dateTo.addEventListener('change', function () {
                getOtLeaveState(type).dateTo = dateTo.value;
                updateOtLeaveDateClearBtn(type);
                applyOtLeaveFilters(type);
            });
        }
        var dateClear = document.getElementById(prefix + '-date-clear');
        if (dateClear) {
            dateClear.addEventListener('click', function () {
                var state = getOtLeaveState(type);
                state.dateFrom = '';
                state.dateTo   = '';
                var f = document.getElementById(prefix + '-date-from');
                var t = document.getElementById(prefix + '-date-to');
                if (f) f.value = '';
                if (t) t.value = '';
                updateOtLeaveDateClearBtn(type);
                applyOtLeaveFilters(type);
            });
        }

        var pageSize = document.getElementById(prefix + '-data-page-size');
        if (pageSize) {
            pageSize.addEventListener('change', function () {
                var state = getOtLeaveState(type);
                state.pageSize = parseInt(pageSize.value, 10) || 25;
                state.page = 1;
                renderOtLeaveTable(type);
            });
        }
    });

    // Reset to the KPI card grid every time the "OT & Leave" sidebar item is
    // opened, same behaviour as Reports / Production Data / PDF. Added here
    // (rather than in app.js) as an extra listener on the existing nav item.
    document.querySelectorAll('.nav-item[data-page="ot-leave"]').forEach(function (item) {
        item.addEventListener('click', function () { showOtLeaveKpiView(); });
    });
}

// =============================================================================
// WAREHOUSE — Checking Details / Warehouse Received Details
// =============================================================================
// Like the OT & Leave sub-views above, this data lives in a SEPARATE Google
// Sheet powered by its own standalone Apps Script Web App (Warehouse.gs — see
// that file for setup instructions), so we talk to it with a plain fetch()
// call instead of the shared jsonp()/GAS_URL helper.
//
// After deploying Warehouse.gs as its own Web App, paste the resulting /exec
// URL below (it is already pre-filled with the URL supplied when this
// feature was built).
// =============================================================================

var WAREHOUSE_SECTION_URL = 'https://script.google.com/macros/s/AKfycbyfhDI6Yl4wI2N5n5IfaVuc6qu03VQdGIPtcjoGwfKQ_xpBKVlkaMw7PFnY0sZ8JWL5/exec';

// One config-driven implementation shared by both sub-views — same approach
// used above for the OT & Leave sub-views.
var warehouseSectionTableStates = {
    'checking-details': {
        headers: [], allRows: [], filteredRows: [], sortCol: -1, sortAsc: true,
        page: 1, pageSize: 25, searchQuery: '', columnFilters: {}, dateFrom: '', dateTo: ''
    },
    'warehouse-received-details': {
        headers: [], allRows: [], filteredRows: [], sortCol: -1, sortAsc: true,
        page: 1, pageSize: 25, searchQuery: '', columnFilters: {}, dateFrom: '', dateTo: ''
    }
};

function getWarehouseSectionState(type) { return warehouseSectionTableStates[type]; }

// `type` doubles as the DOM id prefix used throughout checking-details-view /
// warehouse-received-details-view in index.html.
function getWarehouseSectionConfig(type) {
    if (type === 'checking-details') {
        return {
            prefix: 'checking-details', viewId: 'checking-details-view', action: 'getCheckingDetailsData',
            label: 'Checking Details', emptyLabel: 'Checking Details',
            excelSheetName: 'Checking Details', excelFilePrefix: 'Checking_Details'
        };
    }
    return {
        prefix: 'warehouse-received-details', viewId: 'warehouse-received-details-view', action: 'getWarehouseReceivedDetailsData',
        label: 'Warehouse Received Details', emptyLabel: 'Warehouse Received Details',
        excelSheetName: 'Warehouse Received Details', excelFilePrefix: 'Warehouse_Received_Details'
    };
}

// Column A of the source sheet (index 0 of the loaded range) is assumed to
// be the date column for the "From/To" date-range filter, same convention
// used across the rest of the app.
function getWarehouseSectionDateColIndex() { return 0; }

function showWarehouseSectionKpiView() {
    var kpiView = document.getElementById('warehouse-section-kpi-view');
    if (kpiView) kpiView.style.display = '';
    ['checking-details', 'warehouse-received-details'].forEach(function (type) {
        var view = document.getElementById(getWarehouseSectionConfig(type).viewId);
        if (view) view.style.display = 'none';
    });
}

function showWarehouseSectionDetailView(type) {
    var config  = getWarehouseSectionConfig(type);
    var kpiView = document.getElementById('warehouse-section-kpi-view');
    var view    = document.getElementById(config.viewId);
    if (kpiView) kpiView.style.display = 'none';
    ['checking-details', 'warehouse-received-details'].forEach(function (t) {
        var v = document.getElementById(getWarehouseSectionConfig(t).viewId);
        if (v) v.style.display = (t === type) ? '' : 'none';
    });
    if (view) view.style.display = '';

    var state = getWarehouseSectionState(type);
    if (state.allRows.length === 0) {
        fetchWarehouseSectionData(type);
    } else {
        renderWarehouseSectionTable(type);
    }
}

function fetchWarehouseSectionData(type) {
    var config   = getWarehouseSectionConfig(type);
    var prefix   = config.prefix;
    var emptyEl  = document.getElementById(prefix + '-data-empty');
    var tableEl  = document.getElementById(prefix + '-data-table');
    var footerEl = document.getElementById(prefix + '-data-footer');
    if (emptyEl)  { emptyEl.querySelector('p').textContent = 'Loading data…'; emptyEl.style.display = ''; }
    if (tableEl)  tableEl.style.display  = 'none';
    if (footerEl) footerEl.style.display = 'none';
    showSpinner('Fetching ' + config.label + ' data…');

    fetch(WAREHOUSE_SECTION_URL + '?action=' + encodeURIComponent(config.action) + '&_=' + Date.now())
        .then(function (response) {
            if (!response.ok) throw new Error('The Warehouse server returned HTTP ' + response.status + '.');
            return response.json();
        })
        .then(function (result) {
            hideSpinner();
            if (!result || !result.success) throw new Error((result && result.error) || 'Could not load data.');
            if (!Array.isArray(result.headers) || !Array.isArray(result.rows)) {
                throw new Error('The Warehouse web app needs to be redeployed with the latest Warehouse.gs code.');
            }
            onWarehouseSectionDataLoaded(type, result);
        })
        .catch(function (err) {
            hideSpinner();
            onWarehouseSectionDataError(type, err.message || 'Could not load data.');
        });
}

function onWarehouseSectionDataLoaded(type, result) {
    var config = getWarehouseSectionConfig(type);
    var prefix = config.prefix;
    var state  = getWarehouseSectionState(type);

    state.headers       = result.headers || [];
    state.allRows       = result.rows    || [];
    state.filteredRows  = state.allRows.slice();
    state.sortCol       = -1;
    state.sortAsc       = true;
    state.page          = 1;
    state.searchQuery    = '';
    state.columnFilters = {};
    state.dateFrom       = '';
    state.dateTo         = '';

    var searchEl = document.getElementById(prefix + '-data-search');
    if (searchEl) searchEl.value = '';
    updateWarehouseSectionSearchClearBtn(type);

    var dFrom = document.getElementById(prefix + '-date-from');
    var dTo   = document.getElementById(prefix + '-date-to');
    if (dFrom) dFrom.value = '';
    if (dTo)   dTo.value   = '';
    updateWarehouseSectionDateClearBtn(type);

    var labelEl = document.getElementById(prefix + '-date-col-label');
    if (labelEl && state.headers[getWarehouseSectionDateColIndex()]) {
        labelEl.textContent = state.headers[getWarehouseSectionDateColIndex()];
    }

    buildWarehouseSectionTableHeaders(type);
    renderWarehouseSectionTable(type);
}

function onWarehouseSectionDataError(type, msg) {
    var config  = getWarehouseSectionConfig(type);
    var prefix  = config.prefix;
    var emptyEl = document.getElementById(prefix + '-data-empty');
    if (emptyEl) { emptyEl.querySelector('p').textContent = 'Error: ' + msg; emptyEl.style.display = ''; }
    var tableEl = document.getElementById(prefix + '-data-table');
    if (tableEl) tableEl.style.display = 'none';
    var footerEl = document.getElementById(prefix + '-data-footer');
    if (footerEl) footerEl.style.display = 'none';
    showToast('error', config.label + ' Data Error', msg);
}

function buildWarehouseSectionTableHeaders(type) {
    var config = getWarehouseSectionConfig(type);
    var prefix = config.prefix;
    var state  = getWarehouseSectionState(type);
    var thead  = document.getElementById(prefix + '-data-thead');
    if (!thead) return;
    thead.innerHTML = '';

    var trHead = document.createElement('tr');
    var thNum  = document.createElement('th');
    thNum.className = 'dt-th dt-th-num';
    thNum.textContent = '#';
    trHead.appendChild(thNum);
    state.headers.forEach(function (h, i) {
        var th = document.createElement('th');
        th.className = 'dt-th dt-th-sortable';
        th.setAttribute('data-' + prefix + '-col', i);
        th.innerHTML = esc(h) + '<span class="dt-sort-icon material-icons-round">unfold_more</span>';
        th.addEventListener('click', function () { onWarehouseSectionSortColumn(type, i); });
        trHead.appendChild(th);
    });

    var trFilter    = document.createElement('tr');
    trFilter.className = 'dt-filter-row';
    var thFilterNum = document.createElement('th');
    thFilterNum.className = 'dt-filter-cell dt-filter-cell-num';
    thFilterNum.innerHTML = '<span class="material-icons-round" style="font-size:12px;opacity:.45;color:#94a3b8;">filter_list</span>';
    trFilter.appendChild(thFilterNum);
    state.headers.forEach(function (h, i) {
        var th   = document.createElement('th');
        th.className = 'dt-filter-cell';
        var wrap = document.createElement('div');
        wrap.className = 'dt-col-filter-wrap';
        var input = document.createElement('input');
        input.type        = 'text';
        input.className   = 'dt-col-filter';
        input.placeholder = 'Filter…';
        input.value       = state.columnFilters[i] || '';
        var clearBtn = document.createElement('button');
        clearBtn.className     = 'dt-col-filter-clear';
        clearBtn.title         = 'Clear filter';
        clearBtn.innerHTML     = '<span class="material-icons-round">close</span>';
        clearBtn.style.display = input.value ? '' : 'none';
        input.addEventListener('input', function () {
            state.columnFilters[i] = input.value;
            clearBtn.style.display = input.value ? '' : 'none';
            applyWarehouseSectionFilters(type);
        });
        clearBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            input.value = '';
            state.columnFilters[i] = '';
            clearBtn.style.display = 'none';
            applyWarehouseSectionFilters(type);
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

function onWarehouseSectionSortColumn(type, colIndex) {
    var state = getWarehouseSectionState(type);
    if (state.sortCol === colIndex) {
        state.sortAsc = !state.sortAsc;
    } else {
        state.sortCol = colIndex;
        state.sortAsc = true;
    }
    updateWarehouseSectionSortIcons(type);
    applyWarehouseSectionFilters(type);
}

function updateWarehouseSectionSortIcons(type) {
    var config = getWarehouseSectionConfig(type);
    var state  = getWarehouseSectionState(type);
    document.querySelectorAll('[data-' + config.prefix + '-col]').forEach(function (th) {
        var idx  = parseInt(th.getAttribute('data-' + config.prefix + '-col'), 10);
        var icon = th.querySelector('.dt-sort-icon');
        if (!icon) return;
        if (idx === state.sortCol) {
            icon.textContent = state.sortAsc ? 'arrow_upward' : 'arrow_downward';
            th.classList.add('dt-th-sorted');
        } else {
            icon.textContent = 'unfold_more';
            th.classList.remove('dt-th-sorted');
        }
    });
}

function updateWarehouseSectionDateClearBtn(type) {
    var config   = getWarehouseSectionConfig(type);
    var state    = getWarehouseSectionState(type);
    var clearBtn = document.getElementById(config.prefix + '-date-clear');
    if (!clearBtn) return;
    clearBtn.style.display = (state.dateFrom || state.dateTo) ? '' : 'none';
}

function updateWarehouseSectionSearchClearBtn(type) {
    var config   = getWarehouseSectionConfig(type);
    var searchEl = document.getElementById(config.prefix + '-data-search');
    var clearBtn = document.getElementById(config.prefix + '-data-search-clear');
    if (!searchEl || !clearBtn) return;
    clearBtn.style.display = searchEl.value ? '' : 'none';
}

function applyWarehouseSectionFilters(type) {
    var state      = getWarehouseSectionState(type);
    var query      = state.searchQuery;
    var colFilters = state.columnFilters;
    var dateColIdx = getWarehouseSectionDateColIndex();

    var dateFrom = state.dateFrom ? new Date(state.dateFrom + 'T00:00:00') : null;
    var dateTo   = state.dateTo   ? new Date(state.dateTo   + 'T23:59:59') : null;
    var anyDateFilter = dateFrom || dateTo;

    state.filteredRows = state.allRows.filter(function (row) {
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
        if (anyDateFilter && dateColIdx >= 0) {
            var rawDate = row[dateColIdx];
            var parsed  = parseCreatedAt(rawDate);
            if (!parsed) return false;
            if (dateFrom && parsed < dateFrom) return false;
            if (dateTo   && parsed > dateTo)   return false;
        }
        return true;
    });

    if (state.sortCol >= 0) {
        var sc = state.sortCol;
        state.filteredRows.sort(function (a, b) {
            var av = (a[sc] || '').toString().toLowerCase();
            var bv = (b[sc] || '').toString().toLowerCase();
            var numA = parseFloat(av), numB = parseFloat(bv);
            var isNum = !isNaN(numA) && !isNaN(numB);
            var cmp = isNum ? (numA - numB) : av.localeCompare(bv);
            return state.sortAsc ? cmp : -cmp;
        });
    }
    state.page = 1;
    renderWarehouseSectionTable(type);
}

function applyWarehouseSectionSearch(type, query) {
    var state = getWarehouseSectionState(type);
    state.searchQuery = (query || '').trim().toLowerCase();
    applyWarehouseSectionFilters(type);
}

function renderWarehouseSectionTable(type) {
    var config = getWarehouseSectionConfig(type);
    var prefix = config.prefix;
    var state  = getWarehouseSectionState(type);

    var tbody      = document.getElementById(prefix + '-data-tbody');
    var tableEl    = document.getElementById(prefix + '-data-table');
    var emptyEl    = document.getElementById(prefix + '-data-empty');
    var footerEl   = document.getElementById(prefix + '-data-footer');
    var countBadge = document.getElementById(prefix + '-data-count-badge');
    if (!tbody) return;

    var total      = state.filteredRows.length;
    var pageSize   = state.pageSize;
    var page       = state.page;
    var totalPages = Math.ceil(total / pageSize) || 1;
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    state.page = page;

    var start = (page - 1) * pageSize;
    var end   = Math.min(start + pageSize, total);
    var slice = state.filteredRows.slice(start, end);

    if (countBadge) countBadge.textContent = total + ' record' + (total !== 1 ? 's' : '');
    if (emptyEl)  emptyEl.style.display  = 'none';
    if (tableEl)  tableEl.style.display  = '';
    if (footerEl) footerEl.style.display = total > 0 ? '' : 'none';
    tbody.innerHTML = '';

    if (total === 0) {
        var trEmpty = document.createElement('tr');
        var tdEmpty = document.createElement('td');
        tdEmpty.className = 'dt-td-empty-msg';
        tdEmpty.setAttribute('colspan', state.headers.length + 1);
        var hasFilter = Object.keys(state.columnFilters).some(function (k) {
            return (state.columnFilters[k] || '').trim() !== '';
        });
        var hasDate = state.dateFrom || state.dateTo;
        tdEmpty.innerHTML = '<span class="material-icons-round" style="vertical-align:middle;margin-right:6px;font-size:18px;color:#64748b;">search_off</span>' +
            (state.searchQuery || hasFilter || hasDate
                ? 'No records match the current filter.'
                : (state.allRows.length === 0 ? 'No data found in ' + config.emptyLabel + '.' : 'No records found.'));
        trEmpty.appendChild(tdEmpty);
        tbody.appendChild(trEmpty);
        var infoEl2 = document.getElementById(prefix + '-data-info');
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
        state.headers.forEach(function (header, ci) {
            var td = document.createElement('td');
            td.className = 'dt-td';
            var cellVal = String(row[ci] !== undefined && row[ci] !== null ? row[ci] : '');
            if (state.searchQuery && cellVal.toLowerCase().indexOf(state.searchQuery) !== -1) {
                td.innerHTML = esc(cellVal).replace(
                    new RegExp(escapeRegex(esc(state.searchQuery)), 'gi'),
                    '<mark class="dt-highlight">$&</mark>'
                );
            } else {
                td.textContent = cellVal;
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    var infoEl = document.getElementById(prefix + '-data-info');
    if (infoEl) {
        infoEl.textContent = 'Showing ' + (start + 1) + ' to ' + end + ' of ' + total +
            (state.allRows.length !== total ? ' (filtered from ' + state.allRows.length + ' total)' : '') +
            ' entries';
    }
    buildWarehouseSectionPagination(type, page, totalPages);
}

function buildWarehouseSectionPagination(type, current, total) {
    var config    = getWarehouseSectionConfig(type);
    var state     = getWarehouseSectionState(type);
    var container = document.getElementById(config.prefix + '-data-pagination');
    if (!container) return;
    container.innerHTML = '';
    function mkBtn(label, page, disabled, active, isIcon) {
        var btn = document.createElement('button');
        btn.className = 'dt-page-btn' + (active ? ' dt-page-btn-active' : '') + (disabled ? ' dt-page-btn-disabled' : '');
        btn.innerHTML = isIcon ? '<span class="material-icons-round" style="font-size:16px;">' + label + '</span>' : label;
        btn.disabled  = disabled;
        if (!disabled) {
            btn.addEventListener('click', function () {
                state.page = page;
                renderWarehouseSectionTable(type);
                var wrap = document.getElementById(config.prefix + '-data-table-wrap');
                if (wrap) wrap.scrollTop = 0;
            });
        }
        return btn;
    }
    container.appendChild(mkBtn('first_page',   1,           current <= 1,      false, true));
    container.appendChild(mkBtn('chevron_left', current - 1, current <= 1,      false, true));
    paginationRange(current, total).forEach(function (item) {
        if (item === '…' || item === '...') {
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

function downloadWarehouseSectionExcel(type) {
    var config  = getWarehouseSectionConfig(type);
    var state   = getWarehouseSectionState(type);
    exportRowsToXlsx({
        headers: state.headers,
        rows: state.filteredRows,
        sheetName: config.excelSheetName,
        filenamePrefix: config.excelFilePrefix
    });
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------
function initWarehouseSection() {
    ['checking-details', 'warehouse-received-details'].forEach(function (type) {
        var config  = getWarehouseSectionConfig(type);
        var prefix  = config.prefix;
        var kpiId   = 'kpi-' + type;
        var kpiCard = document.getElementById(kpiId);
        if (kpiCard) {
            kpiCard.addEventListener('click', function () { showWarehouseSectionDetailView(type); });
            kpiCard.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showWarehouseSectionDetailView(type); }
            });
        }

        var backBtn = document.getElementById('btn-back-' + prefix);
        if (backBtn) backBtn.addEventListener('click', function () { showWarehouseSectionKpiView(); });

        var excelBtn = document.getElementById('btn-download-' + prefix + '-excel');
        if (excelBtn) excelBtn.addEventListener('click', function () { downloadWarehouseSectionExcel(type); });

        var refreshBtn = document.getElementById('btn-refresh-' + prefix + '-data');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function () {
                var state = getWarehouseSectionState(type);
                state.allRows       = [];
                state.columnFilters = {};
                fetchWarehouseSectionData(type);
            });
        }

        var searchEl = document.getElementById(prefix + '-data-search');
        if (searchEl) {
            searchEl.addEventListener('input', function () {
                updateWarehouseSectionSearchClearBtn(type);
                applyWarehouseSectionSearch(type, searchEl.value);
            });
        }
        var clearSearch = document.getElementById(prefix + '-data-search-clear');
        if (clearSearch) {
            clearSearch.addEventListener('click', function () {
                var s = document.getElementById(prefix + '-data-search');
                if (s) { s.value = ''; s.focus(); }
                updateWarehouseSectionSearchClearBtn(type);
                applyWarehouseSectionSearch(type, '');
            });
        }

        var dateFrom = document.getElementById(prefix + '-date-from');
        if (dateFrom) {
            dateFrom.addEventListener('change', function () {
                getWarehouseSectionState(type).dateFrom = dateFrom.value;
                updateWarehouseSectionDateClearBtn(type);
                applyWarehouseSectionFilters(type);
            });
        }
        var dateTo = document.getElementById(prefix + '-date-to');
        if (dateTo) {
            dateTo.addEventListener('change', function () {
                getWarehouseSectionState(type).dateTo = dateTo.value;
                updateWarehouseSectionDateClearBtn(type);
                applyWarehouseSectionFilters(type);
            });
        }
        var dateClear = document.getElementById(prefix + '-date-clear');
        if (dateClear) {
            dateClear.addEventListener('click', function () {
                var state = getWarehouseSectionState(type);
                state.dateFrom = '';
                state.dateTo   = '';
                var f = document.getElementById(prefix + '-date-from');
                var t = document.getElementById(prefix + '-date-to');
                if (f) f.value = '';
                if (t) t.value = '';
                updateWarehouseSectionDateClearBtn(type);
                applyWarehouseSectionFilters(type);
            });
        }

        var pageSize = document.getElementById(prefix + '-data-page-size');
        if (pageSize) {
            pageSize.addEventListener('change', function () {
                var state = getWarehouseSectionState(type);
                state.pageSize = parseInt(pageSize.value, 10) || 25;
                state.page = 1;
                renderWarehouseSectionTable(type);
            });
        }
    });

    // Reset to the KPI card grid every time the "Warehouse" sidebar item is
    // opened, same behaviour as Reports / Production Data / OT & Leave.
    // Added here (rather than in app.js) as an extra listener on the
    // existing nav item.
    document.querySelectorAll('.nav-item[data-page="warehouse"]').forEach(function (item) {
        item.addEventListener('click', function () { showWarehouseSectionKpiView(); });
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEndLineQc);
    document.addEventListener('DOMContentLoaded', initPostAql);
    document.addEventListener('DOMContentLoaded', initWarehouseFms);
    document.addEventListener('DOMContentLoaded', initShipment);
    document.addEventListener('DOMContentLoaded', initOtLeave);
    document.addEventListener('DOMContentLoaded', initWarehouseSection);
} else {
    initEndLineQc();
    initPostAql();
    initWarehouseFms();
    initShipment();
    initOtLeave();
    initWarehouseSection();
}

})();
