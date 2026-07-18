// Pre-Production for Store table. Kept separate from main.js intentionally.
(function () {
    'use strict';

    var STORE_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwNV3OrAeVzHWBS0DwshJHPifXdajx1xji4D0hrl8gYw2RtBQKo-hjc1-AA-ohuw_nl/exec';

    function el(id) { return document.getElementById(id); }
    function helpers() { return window.FMS || {}; }
    function escapeHtml(value) { return helpers().esc ? helpers().esc(value) : String(value == null ? '' : value); }
    function pageRange(current, total) { return helpers().paginationRange ? helpers().paginationRange(current, total) : [current]; }

    // -----------------------------------------------------------------
    // Generic data-view controller. Both Store sub-views ("Pre-Production
    // for Store" and "Pre-Production Data") share this same search / sort /
    // filter / paginate / export behaviour; only the fetch action and the
    // (optional) editable last column differ.
    //
    // opts:
    //   prefix              - DOM id prefix, e.g. 'store-preproduction-data'
    //   action               - doGet ?action= value to fetch rows
    //   editableLastColumn   - true to render the last column as the
    //                          In-Stock status <select> (Store view only)
    //   emptyMessage         - message shown when the sheet has no rows
    //   wideColumn           - { anchorPattern: RegExp, offset: number, width: '340px' }
    //                          finds the header matching anchorPattern, then widens
    //                          the header `offset` columns to its right (e.g. offset:2
    //                          = "second column to the right of Serial No.")
    // -----------------------------------------------------------------
    function createDataView(opts) {
        var prefix = opts.prefix;
        var action = opts.action;
        var editableLastColumn = !!opts.editableLastColumn;
        var emptyMessage = opts.emptyMessage || 'No data found.';
        var state = { headers: [], allRows: [], filteredRows: [], sortCol: -1, sortAsc: true, page: 1, pageSize: 25, search: '', filters: {}, wideColIndex: -1 };

        function fetchData() {
            var empty = el(prefix + '-empty'), table = el(prefix + '-table'), footer = el(prefix + '-footer');
            if (empty) { empty.querySelector('p').textContent = 'Loading data...'; empty.style.display = ''; }
            if (table) table.style.display = 'none';
            if (footer) footer.style.display = 'none';
            if (helpers().showSpinner) helpers().showSpinner('Fetching data...');

            fetch(STORE_WEB_APP_URL + '?action=' + encodeURIComponent(action) + '&_=' + Date.now())
                .then(function (response) { if (!response.ok) throw new Error('The Store server returned HTTP ' + response.status + '.'); return response.json(); })
                .then(function (result) {
                    if (!result || !result.success || !Array.isArray(result.headers) || !Array.isArray(result.rows)) throw new Error((result && result.error) || 'Redeploy Store.gs as a web app, then try again.');
                    var rowNumbers = Array.isArray(result.rowNumbers) ? result.rowNumbers : [];
                    state.headers = result.headers;
                    state.allRows = result.rows.map(function (row, i) { row.__rowNum = rowNumbers[i]; return row; });
                    state.filteredRows = state.allRows.slice();
                    state.sortCol = -1; state.sortAsc = true; state.page = 1; state.search = ''; state.filters = {};
                    state.wideColIndex = computeWideColIndex();
                    if (el(prefix + '-search')) el(prefix + '-search').value = '';
                    updateSearchClear(); buildHeaders(); renderTable(); touchLastUpdated();
                })
                .catch(function (error) {
                    if (empty) { empty.querySelector('p').textContent = 'Error: ' + error.message; empty.style.display = ''; }
                    if (helpers().showToast) helpers().showToast('error', 'Data Error', error.message);
                })
                .finally(function () { if (helpers().hideSpinner) helpers().hideSpinner(); });
        }

        function computeWideColIndex() {
            if (!opts.wideColumn) return -1;
            var anchorIdx = -1;
            for (var i = 0; i < state.headers.length; i++) {
                if (opts.wideColumn.anchorPattern.test(String(state.headers[i] || '').trim())) { anchorIdx = i; break; }
            }
            if (anchorIdx < 0) return -1;
            var target = anchorIdx + opts.wideColumn.offset;
            return (target >= 0 && target < state.headers.length) ? target : -1;
        }

        function buildHeaders() {
            var thead = el(prefix + '-thead'); thead.innerHTML = '';
            var filters = document.createElement('tr'); filters.className = 'dt-filter-row'; filters.innerHTML = '<th class="dt-filter-cell dt-filter-cell-num"></th>';
            var headings = document.createElement('tr'), number = document.createElement('th'); number.className = 'dt-th dt-th-num'; number.textContent = '#'; headings.appendChild(number);
            state.headers.forEach(function (header, column) {
                var isWide = column === state.wideColIndex;
                var filterCell = document.createElement('th'), input = document.createElement('input');
                filterCell.className = 'dt-filter-cell' + (isWide ? ' dt-col-wide' : ''); input.className = 'dt-col-filter'; input.placeholder = 'Filter...';
                if (isWide && opts.wideColumn.width) filterCell.style.minWidth = opts.wideColumn.width;
                input.addEventListener('input', function () { state.filters[column] = input.value; applyFilters(); });
                filterCell.appendChild(input); filters.appendChild(filterCell);
                var th = document.createElement('th'); th.className = 'dt-th dt-th-sortable' + (isWide ? ' dt-col-wide' : ''); th.innerHTML = escapeHtml(header) + '<span class="dt-sort-icon material-icons-round">unfold_more</span>';
                if (isWide && opts.wideColumn.width) th.style.minWidth = opts.wideColumn.width;
                th.addEventListener('click', function () { state.sortAsc = state.sortCol === column ? !state.sortAsc : true; state.sortCol = column; applyFilters(); }); headings.appendChild(th);
            });
            thead.appendChild(filters); thead.appendChild(headings);
        }

        function recomputeFilteredRows() {
            var search = state.search;
            state.filteredRows = state.allRows.filter(function (row) {
                if (search && !row.some(function (cell) { return String(cell).toLowerCase().indexOf(search) !== -1; })) return false;
                return Object.keys(state.filters).every(function (key) { var term = String(state.filters[key] || '').trim().toLowerCase(); return !term || String(row[key] || '').toLowerCase().indexOf(term) !== -1; });
            });
            if (state.sortCol >= 0) state.filteredRows.sort(function (a, b) { var av = String(a[state.sortCol] || ''), bv = String(b[state.sortCol] || ''), an = parseFloat(av), bn = parseFloat(bv), compare = !isNaN(an) && !isNaN(bn) ? an - bn : av.localeCompare(bv); return state.sortAsc ? compare : -compare; });
        }

        function applyFilters() {
            recomputeFilteredRows();
            state.page = 1; renderTable();
        }

        function renderTable() {
            var tbody = el(prefix + '-tbody'), table = el(prefix + '-table'), empty = el(prefix + '-empty'), footer = el(prefix + '-footer');
            var total = state.filteredRows.length, pages = Math.max(1, Math.ceil(total / state.pageSize)); state.page = Math.min(state.page, pages);
            var start = (state.page - 1) * state.pageSize, end = Math.min(start + state.pageSize, total); tbody.innerHTML = '';
            table.style.display = ''; empty.style.display = 'none'; footer.style.display = total ? '' : 'none';
            if (!total) { var emptyRow = document.createElement('tr'), emptyCell = document.createElement('td'); emptyCell.className = 'dt-td-empty-msg'; emptyCell.colSpan = state.headers.length + 1; emptyCell.textContent = state.allRows.length ? 'No records match the current filter.' : emptyMessage; emptyRow.appendChild(emptyCell); tbody.appendChild(emptyRow); }
            var lastColumn = state.headers.length - 1;
            var rowColorColIdx = opts.rowColor ? (opts.rowColor.column === 'last' ? lastColumn : opts.rowColor.column) : -1;
            state.filteredRows.slice(start, end).forEach(function (row, rowIndex) {
                var tr = document.createElement('tr'), num = document.createElement('td'); var rowClass = (start + rowIndex) % 2 ? 'dt-tr-odd' : 'dt-tr-even';
                if (rowColorColIdx >= 0) {
                    var statusKey = String(row[rowColorColIdx] == null ? '' : row[rowColorColIdx]).trim().toLowerCase();
                    var statusClass = opts.rowColor.map[statusKey];
                    if (statusClass) rowClass += ' dt-tr-status-' + statusClass;
                }
                tr.className = rowClass; num.className = 'dt-td dt-td-num'; num.textContent = start + rowIndex + 1; tr.appendChild(num);
                state.headers.forEach(function (_, column) {
                    var td = document.createElement('td'); td.className = 'dt-td' + (column === state.wideColIndex ? ' dt-col-wide' : '');
                    if (editableLastColumn && column === lastColumn) { td.appendChild(buildStatusSelect(row, column)); }
                    else { td.textContent = row[column] == null ? '' : row[column]; }
                    tr.appendChild(td);
                }); tbody.appendChild(tr);
            });
            el(prefix + '-count-badge').textContent = total + ' record' + (total === 1 ? '' : 's'); el(prefix + '-info').textContent = total ? 'Showing ' + (start + 1) + ' to ' + end + ' of ' + total + ' entries' : 'Showing 0 entries'; buildPagination(pages);
        }

        function buildStatusSelect(row, column) {
            var select = document.createElement('select');
            select.className = 'dt-status-select';
            var currentValue = row[column] == null ? '' : String(row[column]);
            var isInStock = currentValue === 'In-Stock';

            var blankOption = document.createElement('option');
            blankOption.value = '';
            blankOption.textContent = 'Select';
            blankOption.selected = !isInStock;
            select.appendChild(blankOption);

            var inStockOption = document.createElement('option');
            inStockOption.value = 'In-Stock';
            inStockOption.textContent = 'In-Stock';
            inStockOption.selected = isInStock;
            select.appendChild(inStockOption);

            select.addEventListener('change', function () {
                updateCell(row, column, select.value, select);
            });
            return select;
        }

        function updateCell(row, column, value, select) {
            var rowNum = row.__rowNum;
            if (!rowNum) { if (helpers().showToast) helpers().showToast('error', 'Update Error', 'Could not determine the sheet row for this record.'); return; }
            var previousValue = row[column] == null ? '' : String(row[column]);
            select.disabled = true;
            var url = STORE_WEB_APP_URL + '?action=updateStoreCell&row=' + encodeURIComponent(rowNum) +
                '&column=' + encodeURIComponent(column) + '&value=' + encodeURIComponent(value) + '&_=' + Date.now();
            fetch(url)
                .then(function (response) { if (!response.ok) throw new Error('The Store server returned HTTP ' + response.status + '.'); return response.json(); })
                .then(function (result) {
                    if (!result || !result.success) throw new Error((result && result.error) || 'Failed to update the sheet.');
                    row[column] = value;
                    if (helpers().showToast) helpers().showToast('success', 'Store Updated', value === 'In-Stock' ? 'Marked as In-Stock.' : 'Cleared.');
                    renderTable();
                })
                .catch(function (error) {
                    if (helpers().showToast) helpers().showToast('error', 'Update Error', error.message);
                    row[column] = previousValue;
                    renderTable();
                })
                .finally(function () { select.disabled = false; });
        }

        function buildPagination(totalPages) {
            var pager = el(prefix + '-pagination'); pager.innerHTML = '';
            function add(label, page, disabled, active, icon) { var button = document.createElement('button'); button.className = 'dt-page-btn' + (active ? ' dt-page-btn-active' : '') + (disabled ? ' dt-page-btn-disabled' : ''); button.disabled = disabled; button.innerHTML = icon ? '<span class="material-icons-round" style="font-size:16px;">' + label + '</span>' : label; if (!disabled) button.addEventListener('click', function () { state.page = page; renderTable(); el(prefix + '-table-wrap').scrollTop = 0; }); pager.appendChild(button); }
            add('first_page', 1, state.page <= 1, false, true); add('chevron_left', state.page - 1, state.page <= 1, false, true);
            pageRange(state.page, totalPages).forEach(function (item) { if (item === '...' || item === '…') { var dots = document.createElement('span'); dots.className = 'dt-page-ellipsis'; dots.textContent = '…'; pager.appendChild(dots); } else add(item, item, false, item === state.page, false); });
            add('chevron_right', state.page + 1, state.page >= totalPages, false, true); add('last_page', totalPages, state.page >= totalPages, false, true);
        }

        function updateSearchClear() { var search = el(prefix + '-search'), clear = el(prefix + '-search-clear'); if (search && clear) clear.style.display = search.value ? '' : 'none'; }

        function touchLastUpdated() {
            var badge = el(prefix + '-last-updated');
            if (badge) badge.textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }

        // Silent background refresh: re-fetches rows without showing the
        // loading state or disrupting the user's current search/filter/
        // sort/page — it just swaps in fresh data and re-renders in place.
        function silentRefresh() {
            if (document.hidden) return; // skip while tab is backgrounded
            fetch(STORE_WEB_APP_URL + '?action=' + encodeURIComponent(action) + '&_=' + Date.now())
                .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
                .then(function (result) {
                    if (!result || !result.success || !Array.isArray(result.headers) || !Array.isArray(result.rows)) return;
                    var rowNumbers = Array.isArray(result.rowNumbers) ? result.rowNumbers : [];
                    state.headers = result.headers;
                    state.allRows = result.rows.map(function (row, i) { row.__rowNum = rowNumbers[i]; return row; });
                    state.wideColIndex = computeWideColIndex();
                    recomputeFilteredRows();
                    renderTable();
                    touchLastUpdated();
                })
                .catch(function () { /* silent — a failed background poll shouldn't interrupt the user */ });
        }

        var autoRefreshTimer = null;
        function startAutoRefresh() {
            if (!opts.autoRefreshMs || autoRefreshTimer) return;
            autoRefreshTimer = setInterval(silentRefresh, opts.autoRefreshMs);
        }
        function stopAutoRefresh() {
            if (autoRefreshTimer) { clearInterval(autoRefreshTimer); autoRefreshTimer = null; }
        }

        function show() {
            if (!state.allRows.length) fetchData(); else { renderTable(); touchLastUpdated(); }
            startAutoRefresh();
        }

        function hide() {
            stopAutoRefresh();
        }

        function init() {
            var refreshBtn = el(opts.refreshBtnId || ('btn-refresh-' + prefix));
            if (refreshBtn) refreshBtn.addEventListener('click', fetchData);
            var downloadBtn = el(opts.downloadBtnId || ('btn-download-' + prefix + '-excel'));
            if (downloadBtn) downloadBtn.addEventListener('click', function () { if (helpers().exportRowsToXlsx) helpers().exportRowsToXlsx({ headers: state.headers, rows: state.filteredRows, sheetName: opts.sheetName || prefix, filenamePrefix: opts.filenamePrefix || prefix }); });
            var search = el(prefix + '-search');
            search.addEventListener('input', function () { state.search = search.value.trim().toLowerCase(); updateSearchClear(); applyFilters(); });
            el(prefix + '-search-clear').addEventListener('click', function () { search.value = ''; state.search = ''; updateSearchClear(); applyFilters(); });
            el(prefix + '-page-size').addEventListener('change', function (event) { state.pageSize = parseInt(event.target.value, 10) || 25; state.page = 1; renderTable(); });
        }

        return { show: show, hide: hide, fetchData: fetchData, init: init };
    }

    // -----------------------------------------------------------------
    // The two Store sub-views
    // -----------------------------------------------------------------
    var storeView = createDataView({
        prefix: 'store-preproduction-data',
        action: 'getPreProductionForStoreData',
        editableLastColumn: true,
        emptyMessage: 'No data found in STORE.',
        sheetName: 'STORE',
        filenamePrefix: 'Pre_Production_for_Store',
        refreshBtnId: 'btn-refresh-store-preproduction-data',
        downloadBtnId: 'btn-download-store-preproduction-excel',
        autoRefreshMs: 30000,
        rowColor: {
            column: 'last',
            map: {
                'in-stock': 'green'
            }
        }
    });

    var preprodDataView = createDataView({
        prefix: 'preprod-data',
        action: 'getPreProdData',
        editableLastColumn: false,
        emptyMessage: 'No data found in Pre-Prod Data.',
        sheetName: 'Pre-Prod Data',
        filenamePrefix: 'Pre_Production_Data',
        refreshBtnId: 'btn-refresh-preprod-data',
        downloadBtnId: 'btn-download-preprod-data-excel',
        wideColumn: { anchorPattern: /^itb$/i, offset: 0, width: '420px' },
        autoRefreshMs: 30000,
        rowColor: {
            column: 'last',
            map: {
                'in-stock': 'deep-green',
                'material received': 'light-green',
                'po not create': 'yellow',
                'material pending': 'orange',
                'itb mismatch': 'red'
            }
        }
    });

    // -----------------------------------------------------------------
    // Wires a KPI card -> its sub-view, toggling visibility of the Store
    // KPI grid and the requested detail view.
    // -----------------------------------------------------------------
    function wireKpiCard(cardId, backId, viewId, dataView) {
        var card = el(cardId), back = el(backId), kpi = el('store-kpi-view'), detail = el(viewId);

        function showDetail() {
            if (kpi) kpi.style.display = 'none';
            if (detail) detail.style.display = '';
            dataView.show();
        }
        function showKpi() {
            if (kpi) kpi.style.display = '';
            if (detail) detail.style.display = 'none';
            dataView.hide();
        }

        if (card) {
            card.addEventListener('click', showDetail);
            card.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showDetail(); } });
        }
        if (back) back.addEventListener('click', showKpi);
    }

    function initStorePreProduction() {
        wireKpiCard('kpi-store-ai-data', 'btn-back-store-ai-data', 'store-ai-data-view', storeView);
        wireKpiCard('kpi-preprod-data', 'btn-back-preprod-data', 'preprod-data-view', preprodDataView);
        storeView.init();
        preprodDataView.init();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initStorePreProduction); else initStorePreProduction();
})();
