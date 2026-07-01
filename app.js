// ================================================
// Compounding Calculator — Personal Edition
// Google Sheets sync + Daily Checklist
// ================================================

(function () {
    'use strict';

    // ---- DOM Elements ----
    const dom = {
        // Settings modal
        settingsModal: document.getElementById('settings-modal'),
        settingsClose: document.getElementById('settings-close'),
        btnSettings: document.getElementById('btn-settings'),
        btnSaveSettings: document.getElementById('btn-save-settings'),
        initialBalance: document.getElementById('initial-balance'),
        monthlyExpense: document.getElementById('monthly-expense'),
        profitTarget: document.getElementById('profit-target'),
        planPeriod: document.getElementById('plan-period'),
        planYear: document.getElementById('plan-year'),
        riskReward: document.getElementById('risk-reward'),
        apiUrl: document.getElementById('api-url'),

        // Summary display
        sumBalance: document.getElementById('sum-balance'),
        sumExpense: document.getElementById('sum-expense'),
        sumProfit: document.getElementById('sum-profit'),
        sumRR: document.getElementById('sum-rr'),
        sumYear: document.getElementById('sum-year'),
        badgePeriod: document.getElementById('badge-period'),

        // Results
        resFinalBalance: document.getElementById('res-final-balance'),
        resTotalProfit: document.getElementById('res-total-profit'),
        resPercentage: document.getElementById('res-percentage'),
        resTotalDays: document.getElementById('res-total-days'),
        resAvgMonthly: document.getElementById('res-avg-monthly'),

        // Tables
        tableBody: document.querySelector('#monthly-table tbody'),

        // Daily Modal
        dailyModal: document.getElementById('daily-modal'),
        modalClose: document.getElementById('modal-close'),
        modalTitle: document.getElementById('modal-title'),
        modalSubtitle: document.getElementById('modal-subtitle'),
        dailyTableBody: document.querySelector('#daily-table tbody'),

        // Sync & Toast
        syncStatus: document.getElementById('sync-status'),
        toast: document.getElementById('toast')
    };

    const MONTH_NAMES = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const DAYS_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

    // ---- State ----
    let appState = {
        monthlyData: [],
        dailyResults: {},  // { "2026-01-06": { actual: 150000, checked: true } }
        settings: {
            initialBalance: 10000000,
            monthlyExpense: 0,
            profitTarget: 3,
            planPeriod: 'h1',
            planYear: new Date().getFullYear(),
            riskReward: '1:2',
            apiUrl: ''
        }
    };

    // ---- Utility Functions ----
    function parseNumber(str) {
        if (!str) return 0;
        return parseFloat(String(str).replace(/,/g, '')) || 0;
    }

    function formatIDR(num) {
        if (isNaN(num) || !isFinite(num)) return 'Rp 0';
        return 'Rp ' + Math.round(num).toLocaleString('id-ID');
    }

    function formatNumber(num, fractionDigits = 2) {
        if (isNaN(num)) return '0';
        return num.toLocaleString('en-US', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
    }

    function formatInputWithCommas(input) {
        const cursorPos = input.selectionStart;
        const oldVal = input.value;
        const oldLen = oldVal.length;
        let raw = oldVal.replace(/[^0-9.]/g, '');
        const parts = raw.split('.');
        let intPart = parts[0].replace(/^0+/, '') || '0';
        let decPart = parts.length > 1 ? '.' + parts[1] : '';
        intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        const newVal = intPart + decPart;
        if (newVal !== oldVal) {
            input.value = newVal;
            const diff = newVal.length - oldLen;
            input.setSelectionRange(cursorPos + diff, cursorPos + diff);
        }
    }

    function toDateKey(year, month, day) {
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    function showToast(msg, type = 'success') {
        dom.toast.textContent = msg;
        dom.toast.className = 'toast show ' + type;
        setTimeout(() => { dom.toast.className = 'toast'; }, 3000);
    }

    // ---- LocalStorage ----
    function saveLocal() {
        localStorage.setItem('cp_settings', JSON.stringify(appState.settings));
        localStorage.setItem('cp_dailyResults', JSON.stringify(appState.dailyResults));
    }

    function loadLocal() {
        try {
            const s = localStorage.getItem('cp_settings');
            if (s) appState.settings = { ...appState.settings, ...JSON.parse(s) };
            const d = localStorage.getItem('cp_dailyResults');
            if (d) appState.dailyResults = JSON.parse(d);
        } catch (e) { /* ignore */ }
    }

    // ---- Google Sheets API ----
    function setSyncStatus(status) {
        dom.syncStatus.className = 'sync-status ' + status;
        const textEl = dom.syncStatus.querySelector('.sync-text');
        if (status === 'online') textEl.textContent = 'Synced';
        else if (status === 'syncing') textEl.textContent = 'Syncing...';
        else textEl.textContent = 'Offline';
    }

    async function apiCall(method, params) {
        const url = appState.settings.apiUrl;
        if (!url) return null;

        setSyncStatus('syncing');
        try {
            let response;
            if (method === 'GET') {
                const queryStr = new URLSearchParams(params).toString();
                response = await fetch(url + '?' + queryStr, { method: 'GET' });
            } else {
                response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify(params)
                });
            }
            const data = await response.json();
            setSyncStatus('online');
            return data;
        } catch (err) {
            console.error('API Error:', err);
            setSyncStatus('');
            return null;
        }
    }

    async function syncSettingsToCloud() {
        await apiCall('POST', { action: 'saveSettings', data: appState.settings });
    }

    async function syncDailyResultToCloud(dateKey, actual, checked) {
        await apiCall('POST', { action: 'saveDailyResult', date: dateKey, actual, checked });
    }

    async function loadFromCloud() {
        const settings = await apiCall('GET', { action: 'getSettings' });
        if (settings && !settings.error && Object.keys(settings).length > 0) {
            // Merge cloud settings
            if (settings.initialBalance) appState.settings.initialBalance = Number(settings.initialBalance);
            if (settings.monthlyExpense !== undefined) appState.settings.monthlyExpense = Number(settings.monthlyExpense);
            if (settings.profitTarget) appState.settings.profitTarget = Number(settings.profitTarget);
            if (settings.planPeriod) appState.settings.planPeriod = settings.planPeriod;
            if (settings.planYear) appState.settings.planYear = Number(settings.planYear);
            if (settings.riskReward) appState.settings.riskReward = settings.riskReward;
            if (settings.apiUrl) appState.settings.apiUrl = settings.apiUrl;
        }

        const results = await apiCall('GET', { action: 'getDailyResults' });
        if (results && !results.error) {
            appState.dailyResults = { ...appState.dailyResults, ...results };
        }

        saveLocal();
    }

    // ---- Setup Year Select ----
    function populateYears() {
        const currentYear = new Date().getFullYear();
        dom.planYear.innerHTML = '';
        for (let i = currentYear - 1; i <= currentYear + 5; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            if (i === appState.settings.planYear) option.selected = true;
            dom.planYear.appendChild(option);
        }
    }

    // ---- Apply Settings to Form ----
    function applySettingsToForm() {
        dom.initialBalance.value = appState.settings.initialBalance.toLocaleString('en-US');
        dom.monthlyExpense.value = (appState.settings.monthlyExpense || 0).toLocaleString('en-US');
        dom.profitTarget.value = appState.settings.profitTarget;
        dom.planPeriod.value = appState.settings.planPeriod;
        dom.planYear.value = appState.settings.planYear;
        dom.riskReward.value = appState.settings.riskReward;
        dom.apiUrl.value = appState.settings.apiUrl || '';
    }

    function updateSummaryDisplay() {
        dom.sumBalance.textContent = formatIDR(appState.settings.initialBalance);
        dom.sumExpense.textContent = formatIDR(appState.settings.monthlyExpense || 0);
        dom.sumProfit.textContent = appState.settings.profitTarget + '%';
        dom.sumRR.textContent = appState.settings.riskReward;
        dom.sumYear.textContent = appState.settings.planYear;

        const periodLabels = { full: '1 Tahun', h1: 'Semester 1', h2: 'Semester 2' };
        dom.badgePeriod.textContent = periodLabels[appState.settings.planPeriod] || '1 Tahun';
    }

    // ---- Core Calculation ----
    function calculateCompounding() {
        const s = appState.settings;
        const initialBalance = s.initialBalance;
        let profitStartPerc = s.profitTarget;
        const year = s.planYear;

        const rrParts = s.riskReward.split(':');
        const rewardRatio = parseFloat(rrParts[1]);

        if (initialBalance <= 0 || profitStartPerc <= 0 || isNaN(year)) return;

        let startMonth = 0, endMonth = 11;
        if (s.planPeriod === 'h1') { startMonth = 0; endMonth = 5; }
        else if (s.planPeriod === 'h2') { startMonth = 6; endMonth = 11; }

        const totalMonths = (endMonth - startMonth) + 1;
        const customFixedTargets = [7, 5, 3, 2, 1.5, 1];

        let currentBalance = initialBalance;
        let totalTradingDays = 0;
        let monthlyData = [];

        for (let step = 0; step < totalMonths; step++) {
            let month = startMonth + step;
            let monthTargetPerc = customFixedTargets[step] || 1;

            const monthStartBalance = currentBalance;
            let monthTradingDays = 0;
            let daysData = [];
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, month, day);
                const dayOfWeek = date.getDay();

                if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                    monthTradingDays++;
                    totalTradingDays++;

                    const dayStartBalance = currentBalance;
                    const dailyProfitTarget = dayStartBalance * (monthTargetPerc / 100);
                    const dailyRiskLimit = dailyProfitTarget / rewardRatio;
                    currentBalance += dailyProfitTarget;

                    const dateKey = toDateKey(year, month, day);

                    daysData.push({
                        dateKey: dateKey,
                        dateString: `${day} ${MONTH_NAMES[month]} ${year}`,
                        dayName: DAYS_NAMES[dayOfWeek],
                        startBalance: dayStartBalance,
                        targetPerc: monthTargetPerc,
                        targetIDR: dailyProfitTarget,
                        riskLimitIDR: dailyRiskLimit,
                        endBalance: currentBalance
                    });
                }
            }

            const grossBalance = currentBalance;
            const monthExpense = s.monthlyExpense || 0;
            const monthProfit = currentBalance - monthStartBalance;
            currentBalance -= monthExpense;
            if (currentBalance < 0) currentBalance = 0;

            monthlyData.push({
                monthIndex: month,
                monthName: MONTH_NAMES[month],
                targetPerc: monthTargetPerc,
                tradingDays: monthTradingDays,
                startBalance: monthStartBalance,
                profit: monthProfit,
                grossBalance: grossBalance,
                expense: monthExpense,
                endBalance: currentBalance,
                dailyData: daysData
            });
        }

        appState.monthlyData = monthlyData;
        updateUI(initialBalance, currentBalance, totalTradingDays, monthlyData, totalMonths);
    }

    function updateUI(initialBalance, finalBalance, totalDays, monthlyData, totalMonths) {
        const totalProfit = finalBalance - initialBalance;
        const percIncrease = (totalProfit / initialBalance) * 100;
        const avgMonthlyProfit = totalProfit / totalMonths;

        dom.resFinalBalance.textContent = formatIDR(finalBalance);
        dom.resTotalProfit.textContent = formatIDR(totalProfit);
        dom.resPercentage.textContent = `+${formatNumber(percIncrease, 1)}%`;
        dom.resTotalDays.textContent = `${totalDays} Hari Aktif`;
        dom.resAvgMonthly.textContent = formatIDR(avgMonthlyProfit);

        // Build Monthly Table
        dom.tableBody.innerHTML = '';
        monthlyData.forEach((row, index) => {
            // Count checked days for this month
            const checkedCount = row.dailyData.filter(d => appState.dailyResults[d.dateKey]?.checked).length;
            const progressText = checkedCount > 0 ? ` (${checkedCount}/${row.tradingDays})` : '';

            const tr = document.createElement('tr');
            tr.title = `Klik untuk melihat detail harian ${row.monthName}`;
            tr.innerHTML = `
                <td>${row.monthName}${progressText ? `<span style="color:var(--accent-1);font-size:0.75rem;"> ${progressText}</span>` : ''}</td>
                <td>${row.tradingDays}</td>
                <td><span class="target-badge">${formatNumber(row.targetPerc, 2)}%</span></td>
                <td>${formatIDR(row.startBalance)}</td>
                <td style="color: var(--accent-1);">+${formatIDR(row.profit)}</td>
                <td style="color: var(--text-primary); font-weight:500;">${formatIDR(row.grossBalance)}</td>
                <td style="color: var(--warning);">-${formatIDR(row.expense)}</td>
                <td style="font-weight:700;">${formatIDR(row.endBalance)}</td>
            `;
            tr.addEventListener('click', () => openDailyModal(index));
            dom.tableBody.appendChild(tr);
        });
    }

    // ---- Daily Modal + Checklist ----
    function openDailyModal(arrayIndex) {
        const monthData = appState.monthlyData[arrayIndex];
        if (!monthData) return;

        dom.modalTitle.textContent = `Trading Plan — ${monthData.monthName}`;
        dom.modalSubtitle.textContent = `Hari Aktif: ${monthData.tradingDays} | RR: ${appState.settings.riskReward} | Target: ${formatNumber(monthData.targetPerc, 2)}%`;

        dom.dailyTableBody.innerHTML = '';

        monthData.dailyData.forEach((dayRow, index) => {
            const savedResult = appState.dailyResults[dayRow.dateKey] || { actual: '', checked: false };
            const actualVal = savedResult.actual !== '' ? savedResult.actual : '';
            const isChecked = savedResult.checked;

            const tr = document.createElement('tr');
            if (isChecked && actualVal !== '') {
                tr.className = Number(actualVal) >= 0 ? 'row-profit' : 'row-loss';
            }

            tr.innerHTML = `
                <td>
                    <b>Hari ke-${index + 1}</b><br>
                    <span style="font-size:0.75rem;color:var(--text-muted);">${dayRow.dayName}, ${dayRow.dateString}</span>
                </td>
                <td class="profit-badge">+${formatIDR(dayRow.targetIDR)}</td>
                <td class="risk-badge">-${formatIDR(dayRow.riskLimitIDR)}</td>
                <td>
                    <input type="text" class="checklist-input ${actualVal !== '' ? (Number(actualVal) >= 0 ? 'profit' : 'loss') : ''}"
                        data-date="${dayRow.dateKey}" value="${actualVal !== '' ? Number(actualVal).toLocaleString('id-ID') : ''}"
                        placeholder="0" autocomplete="off">
                </td>
                <td style="text-align:center;">
                    <button class="check-btn ${isChecked ? 'checked' : ''}" data-date="${dayRow.dateKey}">
                        ${isChecked ? '✓' : ''}
                    </button>
                </td>
            `;
            dom.dailyTableBody.appendChild(tr);
        });

        // Attach event listeners
        dom.dailyTableBody.querySelectorAll('.checklist-input').forEach(input => {
            input.addEventListener('change', handleActualInput);
        });
        dom.dailyTableBody.querySelectorAll('.check-btn').forEach(btn => {
            btn.addEventListener('click', handleCheckToggle);
        });

        renderDailyModalTotals(monthData);

        dom.dailyModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function renderDailyModalTotals(monthData) {
        let sumTarget = 0;
        let sumRisk = 0;
        let sumActual = 0;

        monthData.dailyData.forEach(d => {
            sumTarget += d.targetIDR;
            sumRisk += d.riskLimitIDR;
            const savedResult = appState.dailyResults[d.dateKey];
            if (savedResult && savedResult.checked && savedResult.actual !== '') {
                sumActual += savedResult.actual;
            }
        });

        const diff = sumActual - sumTarget;
        const diffColor = diff >= 0 ? 'var(--accent-1)' : 'var(--danger)';

        const tfoot = document.querySelector('#daily-table tfoot');
        tfoot.innerHTML = `
            <tr style="background: rgba(15, 23, 42, 0.95); font-weight: 700;">
                <td style="text-align: right; color: var(--text-secondary);">TOTAL:</td>
                <td style="color: var(--accent-1);">+${formatIDR(sumTarget)}</td>
                <td style="color: var(--danger);">- ${formatIDR(sumRisk)}</td>
                <td style="text-align: right; color: ${sumActual >= 0 ? 'var(--accent-1)' : 'var(--danger)'};">${formatIDR(sumActual)}</td>
                <td></td>
            </tr>
            <tr style="background: rgba(15, 23, 42, 0.95); font-weight: 700; border-top: 1px dashed rgba(255,255,255,0.1);">
                <td colspan="3" style="text-align: right; color: var(--text-secondary);">SELISIH AKTUAL KETIMBANG TARGET:</td>
                <td style="text-align: right; color: ${diffColor};">${diff >= 0 ? '+' : ''}${formatIDR(diff)}</td>
                <td></td>
            </tr>
        `;
    }

    function handleActualInput(e) {
        const dateKey = e.target.dataset.date;
        const rawVal = e.target.value.replace(/[^0-9\-]/g, '');
        const numVal = parseInt(rawVal, 10) || 0;

        if (!appState.dailyResults[dateKey]) {
            appState.dailyResults[dateKey] = { actual: '', checked: false };
        }
        appState.dailyResults[dateKey].actual = numVal;

        // Update input styling
        e.target.className = 'checklist-input ' + (numVal >= 0 ? 'profit' : 'loss');
        e.target.value = numVal.toLocaleString('id-ID');

        // Update row color
        const tr = e.target.closest('tr');
        if (appState.dailyResults[dateKey].checked) {
            tr.className = numVal >= 0 ? 'row-profit' : 'row-loss';
        }

        const dateObj = new Date(dateKey);
        const monthIndex = appState.settings.planPeriod === 'h2' ? dateObj.getMonth() - 6 : dateObj.getMonth();
        renderDailyModalTotals(appState.monthlyData[monthIndex]);

        saveLocal();
        syncDailyResultToCloud(dateKey, numVal, appState.dailyResults[dateKey].checked);
    }

    function handleCheckToggle(e) {
        const btn = e.currentTarget;
        const dateKey = btn.dataset.date;

        if (!appState.dailyResults[dateKey]) {
            appState.dailyResults[dateKey] = { actual: 0, checked: false };
        }
        appState.dailyResults[dateKey].checked = !appState.dailyResults[dateKey].checked;
        const isChecked = appState.dailyResults[dateKey].checked;

        btn.className = 'check-btn ' + (isChecked ? 'checked' : '');
        btn.textContent = isChecked ? '✓' : '';

        // Update row color
        const tr = btn.closest('tr');
        const actual = appState.dailyResults[dateKey].actual;
        if (isChecked && actual !== '') {
            tr.className = Number(actual) >= 0 ? 'row-profit' : 'row-loss';
        } else {
            tr.className = '';
        }

        const dateObj = new Date(dateKey);
        const monthIndex = appState.settings.planPeriod === 'h2' ? dateObj.getMonth() - 6 : dateObj.getMonth();
        renderDailyModalTotals(appState.monthlyData[monthIndex]);

        saveLocal();
        calculateCompounding(); // refresh monthly progress count
        syncDailyResultToCloud(dateKey, appState.dailyResults[dateKey].actual, isChecked);
    }

    function closeDailyModal() {
        dom.dailyModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    // ---- Settings Modal ----
    function openSettings() {
        applySettingsToForm();
        dom.settingsModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeSettings() {
        dom.settingsModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    function saveSettings() {
        appState.settings.initialBalance = parseNumber(dom.initialBalance.value);
        appState.settings.monthlyExpense = parseNumber(dom.monthlyExpense.value);
        appState.settings.profitTarget = parseNumber(dom.profitTarget.value);
        appState.settings.planPeriod = dom.planPeriod.value;
        appState.settings.planYear = parseInt(dom.planYear.value, 10);
        appState.settings.riskReward = dom.riskReward.value;
        appState.settings.apiUrl = dom.apiUrl.value.trim();

        saveLocal();
        updateSummaryDisplay();
        calculateCompounding();
        closeSettings();
        showToast('✅ Settings tersimpan!', 'success');
        syncSettingsToCloud();
    }

    // ---- Input formatting in settings ----
    dom.initialBalance.addEventListener('input', function () {
        formatInputWithCommas(this);
    });
    dom.monthlyExpense.addEventListener('input', function () {
        formatInputWithCommas(this);
    });

    // ---- Event Listeners ----
    dom.btnSettings.addEventListener('click', openSettings);
    dom.settingsClose.addEventListener('click', closeSettings);
    dom.settingsModal.addEventListener('click', (e) => { if (e.target === dom.settingsModal) closeSettings(); });
    dom.btnSaveSettings.addEventListener('click', saveSettings);

    dom.modalClose.addEventListener('click', closeDailyModal);
    dom.dailyModal.addEventListener('click', (e) => { if (e.target === dom.dailyModal) closeDailyModal(); });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDailyModal();
            closeSettings();
        }
    });

    // ---- Initialize ----
    async function init() {
        loadLocal();
        populateYears();
        updateSummaryDisplay();
        calculateCompounding();

        // Try cloud sync
        if (appState.settings.apiUrl) {
            await loadFromCloud();
            applySettingsToForm();
            updateSummaryDisplay();
            calculateCompounding();
            showToast('☁️ Data berhasil di-sync dari Google Sheets', 'success');
        }
    }

    init();

})();
