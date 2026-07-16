// Pre-Production for Store table. Kept separate from main.js intentionally.
(function () {
    'use strict';

    var STORE_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwNV3OrAeVzHWBS0DwshJHPifXdajx1xji4D0hrl8gYw2RtBQKo-hjc1-AA-ohuw_nl/exec';
    var prefix = 'store-preproduction-data';
    var state = { headers: [], allRows: [], filteredRows: [], sortCol: -1, sortAsc: true, page: 1, pageSize: 25, search: '', filters: {} };

    function el(id) { return document.getElementById(id); }
    function helpers() { return window.FMS || {}; }
    function escapeHtml(value) { return helpers().esc ? helpers().esc(value) : String(value == null ? '' : value); }
    function pageRange(current, total) { return helpers().paginationRange ? helpers().paginationRange(current, total) : [current]; }

    function showStoreDetail() {
        var kpi = el('store-kpi-view'), detail = el('store-ai-data-view');
        if (kpi) kpi.style.display = 'none';
        if (detail) detail.style.display = '';
        if (!state.allRows.length) fetchStoreData(); else renderStoreTable();
    }

    function fetchStoreData() {
        var empty = el(prefix + '-empty'), table = el(prefix + '-table'), footer = el(prefix + '-footer');
        if (empty) { empty.querySelector('p').textContent = 'Loading data...'; empty.style.display = ''; }
        if (table) table.style.display = 'none';
        if (footer) footer.style.display = 'none';
        if (helpers().showSpinner) helpers().showSpinner('Fetching Pre-Production for Store data...');

        fetch(STORE_WEB_APP_URL + '?action=getPreProductionForStoreData&_=' + Date.now())
            .then(function (response) { if (!response.ok) throw new Error('The Store server returned HTTP ' + response.status + '.'); return response.json(); })
            .then(function (result) {
                if (!result || !result.success || !Array.isArray(result.headers) || !Array.isArray(result.rows)) throw new Error((result && result.error) || 'Redeploy Store.gs as a web app, then try again.');
                var rowNumbers = Array.isArray(result.rowNumbers) ? result.rowNumbers : [];
                state.headers = result.headers;
                state.allRows = result.rows.map(function (row, i) { row.__rowNum = rowNumbers[i]; return row; });
                state.filteredRows = state.allRows.slice();
                state.sortCol = -1; state.sortAsc = true; state.page = 1; state.search = ''; state.filters = {};
                el(prefix + '-search').value = ''; updateSearchClear(); buildStoreHeaders(); renderStoreTable();
            })
            .catch(function (error) {
                if (empty) { empty.querySelector('p').textContent = 'Error: ' + error.message; empty.style.display = ''; }
                if (helpers().showToast) helpers().showToast('error', 'Store Data Error', error.message);
            })
            .finally(function () { if (helpers().hideSpinner) helpers().hideSpinner(); });
    }

    function buildStoreHeaders() {
        var thead = el(prefix + '-thead'); thead.innerHTML = '';
        var filters = document.createElement('tr'); filters.className = 'dt-filter-row'; filters.innerHTML = '<th class="dt-filter-cell dt-filter-cell-num"></th>';
        var headings = document.createElement('tr'), number = document.createElement('th'); number.className = 'dt-th dt-th-num'; number.textContent = '#'; headings.appendChild(number);
        state.headers.forEach(function (header, column) {
            var filterCell = document.createElement('th'), input = document.createElement('input');
            filterCell.className = 'dt-filter-cell'; input.className = 'dt-col-filter'; input.placeholder = 'Filter...';
            input.addEventListener('input', function () { state.filters[column] = input.value; applyFilters(); });
            filterCell.appendChild(input); filters.appendChild(filterCell);
            var th = document.createElement('th'); th.className = 'dt-th dt-th-sortable'; th.innerHTML = escapeHtml(header) + '<span class="dt-sort-icon material-icons-round">unfold_more</span>';
            th.addEventListener('click', function () { state.sortAsc = state.sortCol === column ? !state.sortAsc : true; state.sortCol = column; applyFilters(); }); headings.appendChild(th);
        });
        thead.appendChild(filters); thead.appendChild(headings);
    }

    function applyFilters() {
        var search = state.search;
        state.filteredRows = state.allRows.filter(function (row) {
            if (search && !row.some(function (cell) { return String(cell).toLowerCase().indexOf(search) !== -1; })) return false;
            return Object.keys(state.filters).every(function (key) { var term = String(state.filters[key] || '').trim().toLowerCase(); return !term || String(row[key] || '').toLowerCase().indexOf(term) !== -1; });
        });
        if (state.sortCol >= 0) state.filteredRows.sort(function (a, b) { var av = String(a[state.sortCol] || ''), bv = String(b[state.sortCol] || ''), an = parseFloat(av), bn = parseFloat(bv), compare = !isNaN(an) && !isNaN(bn) ? an - bn : av.localeCompare(bv); return state.sortAsc ? compare : -compare; });
        state.page = 1; renderStoreTable();
    }

    function renderStoreTable() {
        var tbody = el(prefix + '-tbody'), table = el(prefix + '-table'), empty = el(prefix + '-empty'), footer = el(prefix + '-footer');
        var total = state.filteredRows.length, pages = Math.max(1, Math.ceil(total / state.pageSize)); state.page = Math.min(state.page, pages);
        var start = (state.page - 1) * state.pageSize, end = Math.min(start + state.pageSize, total); tbody.innerHTML = '';
        table.style.display = ''; empty.style.display = 'none'; footer.style.display = total ? '' : 'none';
        if (!total) { var emptyRow = document.createElement('tr'), emptyCell = document.createElement('td'); emptyCell.className = 'dt-td-empty-msg'; emptyCell.colSpan = state.headers.length + 1; emptyCell.textContent = state.allRows.length ? 'No records match the current filter.' : 'No data found in STORE.'; emptyRow.appendChild(emptyCell); tbody.appendChild(emptyRow); }
        state.filteredRows.slice(start, end).forEach(function (row, rowIndex) {
            var tr = document.createElement('tr'), num = document.createElement('td'); tr.className = (start + rowIndex) % 2 ? 'dt-tr-odd' : 'dt-tr-even'; num.className = 'dt-td dt-td-num'; num.textContent = start + rowIndex + 1; tr.appendChild(num);
            var lastColumn = state.headers.length - 1;
            state.headers.forEach(function (_, column) {
                var td = document.createElement('td'); td.className = 'dt-td';
                if (column === lastColumn) { td.appendChild(buildStoreStatusSelect(row, column)); }
                else { td.textContent = row[column] == null ? '' : row[column]; }
                tr.appendChild(td);
            }); tbody.appendChild(tr);
        });
        el(prefix + '-count-badge').textContent = total + ' record' + (total === 1 ? '' : 's'); el(prefix + '-info').textContent = total ? 'Showing ' + (start + 1) + ' to ' + end + ' of ' + total + ' entries' : 'Showing 0 entries'; buildPagination(pages);
    }

    function buildStoreStatusSelect(row, column) {
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
            updateStoreCell(row, column, select.value, select);
        });
        return select;
    }

    function updateStoreCell(row, column, value, select) {
        var rowNum = row.__rowNum;
        if (!rowNum) { if (helpers().showToast) helpers().showToast('error', 'Store Update Error', 'Could not determine the sheet row for this record.'); return; }
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
            })
            .catch(function (error) {
                if (helpers().showToast) helpers().showToast('error', 'Store Update Error', error.message);
                row[column] = previousValue;
                renderStoreTable();
            })
            .finally(function () { select.disabled = false; });
    }

    function buildPagination(totalPages) {
        var pager = el(prefix + '-pagination'); pager.innerHTML = '';
        function add(label, page, disabled, active, icon) { var button = document.createElement('button'); button.className = 'dt-page-btn' + (active ? ' dt-page-btn-active' : '') + (disabled ? ' dt-page-btn-disabled' : ''); button.disabled = disabled; button.innerHTML = icon ? '<span class="material-icons-round" style="font-size:16px;">' + label + '</span>' : label; if (!disabled) button.addEventListener('click', function () { state.page = page; renderStoreTable(); el(prefix + '-table-wrap').scrollTop = 0; }); pager.appendChild(button); }
        add('first_page', 1, state.page <= 1, false, true); add('chevron_left', state.page - 1, state.page <= 1, false, true);
        pageRange(state.page, totalPages).forEach(function (item) { if (item === '...' || item === '…') { var dots = document.createElement('span'); dots.className = 'dt-page-ellipsis'; dots.textContent = '…'; pager.appendChild(dots); } else add(item, item, false, item === state.page, false); });
        add('chevron_right', state.page + 1, state.page >= totalPages, false, true); add('last_page', totalPages, state.page >= totalPages, false, true);
    }

    function updateSearchClear() { var search = el(prefix + '-search'), clear = el(prefix + '-search-clear'); clear.style.display = search.value ? '' : 'none'; }
    function initStorePreProduction() {
        var card = el('kpi-store-ai-data'), back = el('btn-back-store-ai-data');
        if (card) { card.addEventListener('click', showStoreDetail); card.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showStoreDetail(); } }); }
        if (back) back.addEventListener('click', function () { var kpi = el('store-kpi-view'), detail = el('store-ai-data-view'); if (kpi) kpi.style.display = ''; if (detail) detail.style.display = 'none'; });
        el('btn-refresh-store-preproduction-data').addEventListener('click', fetchStoreData);
        el('btn-download-store-preproduction-excel').addEventListener('click', function () { if (helpers().exportRowsToXlsx) helpers().exportRowsToXlsx({ headers: state.headers, rows: state.filteredRows, sheetName: 'STORE', filenamePrefix: 'Pre_Production_for_Store' }); });
        var search = el(prefix + '-search'); search.addEventListener('input', function () { state.search = search.value.trim().toLowerCase(); updateSearchClear(); applyFilters(); }); el(prefix + '-search-clear').addEventListener('click', function () { search.value = ''; state.search = ''; updateSearchClear(); applyFilters(); });
        el(prefix + '-page-size').addEventListener('change', function (event) { state.pageSize = parseInt(event.target.value, 10) || 25; state.page = 1; renderStoreTable(); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initStorePreProduction); else initStorePreProduction();
})();
