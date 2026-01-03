/**
 * Balans AI - Wallet App JavaScript
 * Telegram Wallet Style Finance Management App
 */

// ============================================
// GLOBAL VARIABLES
// ============================================

const tg = window.Telegram?.WebApp || null;
let currentUser = null;
let currentPage = 'home';
let allTransactions = [];
let currentTransactionFilter = 'all';
let currentDebtFilter = 'all';
let charts = {};

// ============================================
// DATA CACHE - Tezlashtirish uchun kesh
// ============================================

const dataCache = {
    user: null,
    transactions: null,
    statistics: {},
    reminders: null,
    debts: null,
    lastUpdate: {},
    TTL: 30000, // 30 sekund cache

    get(key) {
        const now = Date.now();
        if (this.lastUpdate[key] && (now - this.lastUpdate[key]) < this.TTL) {
            return this[key];
        }
        return null;
    },

    set(key, value) {
        this[key] = value;
        this.lastUpdate[key] = Date.now();
    },

    clear(key) {
        if (key) {
            this[key] = null;
            this.lastUpdate[key] = 0;
        } else {
            this.user = null;
            this.transactions = null;
            this.statistics = {};
            this.reminders = null;
            this.debts = null;
            this.lastUpdate = {};
        }
    }
};

// ============================================
// TELEGRAM WEB APP SETUP
// ============================================

if (tg) {
    tg.ready();
    tg.expand();

    // Disable vertical swipes
    if (tg.disableVerticalSwipes) {
        tg.disableVerticalSwipes();
    }

    // Enable closing confirmation
    tg.enableClosingConfirmation();

    // Set colors for dark theme
    tg.setHeaderColor('#1C1C1E');
    tg.setBackgroundColor('#1C1C1E');
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function hapticFeedback(type = 'light') {
    if (tg?.HapticFeedback) {
        if (type === 'light') tg.HapticFeedback.impactOccurred('light');
        else if (type === 'medium') tg.HapticFeedback.impactOccurred('medium');
        else if (type === 'heavy') tg.HapticFeedback.impactOccurred('heavy');
        else if (type === 'success') tg.HapticFeedback.notificationOccurred('success');
        else if (type === 'error') tg.HapticFeedback.notificationOccurred('error');
    }
}

function formatCurrency(amount, currency = 'UZS') {
    const num = parseFloat(amount) || 0;
    const formatted = new Intl.NumberFormat('uz-UZ').format(Math.round(num));
    const symbols = { 'UZS': "so'm", 'USD': '$', 'EUR': '€', 'RUB': '₽' };
    return currency === 'UZS' ? `${formatted} ${symbols[currency]}` : `${symbols[currency] || currency}${formatted}`;
}

function formatCurrencyShort(amount) {
    const num = parseFloat(amount) || 0;
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
    return num.toFixed(0);
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Bugun';
    if (date.toDateString() === yesterday.toDateString()) return 'Kecha';

    return date.toLocaleDateString('uz-UZ', {
        day: 'numeric',
        month: 'short'
    });
}

function formatTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
}

function showLoading(show) {
    const loader = document.getElementById('loadingScreen');
    if (loader) loader.style.display = show ? 'flex' : 'none';
}

// ============================================
// API FUNCTIONS
// ============================================

function getInitData() {
    if (tg?.initData) return tg.initData;
    const params = new URLSearchParams(window.location.search);
    return params.get('test_user_id') ? '' : '';
}

async function apiRequest(endpoint, options = {}) {
    const initData = getInitData();
    const params = new URLSearchParams(window.location.search);
    const testUserId = params.get('test_user_id');

    let url = endpoint;
    if (testUserId && !initData) {
        url += (url.includes('?') ? '&' : '?') + `test_user_id=${testUserId}`;
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': initData || '',
                ...options.headers
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            let error;
            try {
                error = JSON.parse(errorText);
            } catch (e) {
                error = { error: errorText || 'Xatolik yuz berdi' };
            }

            if (response.status === 404 && error.error === 'User not found') {
                const customError = new Error('User not found');
                customError.code = 'USER_NOT_FOUND';
                throw customError;
            }

            throw new Error(error.error || 'Xatolik yuz berdi');
        }

        return await response.json();
    } catch (error) {
        console.error('[API Error]', endpoint, error);
        throw error;
    }
}

// ============================================
// NAVIGATION
// ============================================

function navigateTo(pageName) {
    hapticFeedback('light');

    // Hide current page
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // Show new page
    const pageId = `page${pageName.charAt(0).toUpperCase() + pageName.slice(1)}`;
    const newPage = document.getElementById(pageId);
    if (newPage) {
        newPage.classList.add('active');
    }

    // Update nav (support both old and new navbar)
    document.querySelectorAll('.wallet-nav-item, .tg-wallet-nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === pageName) {
            item.classList.add('active');
        }
    });

    currentPage = pageName;

    // Load page data
    loadPageData(pageName);
}

async function loadPageData(pageName) {
    try {
        switch (pageName) {
            case 'transactions':
                await loadTransactionsPage();
                break;
            case 'statistics':
                await loadStatisticsPage('week');
                break;
            case 'reminders':
                await loadRemindersPage();
                break;
            case 'debts':
                await loadDebtsPage();
                break;
            case 'profile':
                await loadProfilePage();
                break;
            case 'topExpenses':
                await loadTopExpensesPage();
                break;
        }
    } catch (error) {
        console.error(`Error loading ${pageName}:`, error);
    }
}

// ============================================
// HOME PAGE
// ============================================

async function loadHomePage() {
    // Show skeleton for balance first
    const balanceEl = document.getElementById('totalBalance');
    if (balanceEl) {
        balanceEl.innerHTML = '<span class="skeleton-text" style="width: 120px; height: 28px;"></span>';
    }

    // Show skeleton for transactions
    const transContainer = document.getElementById('homeTransactionsList');
    if (transContainer) {
        transContainer.innerHTML = Array(3).fill(`
            <div class="skeleton-transaction">
                <div class="skeleton-icon"></div>
                <div class="skeleton-content">
                    <div class="skeleton-text" style="width: 60%;"></div>
                    <div class="skeleton-text short" style="width: 40%;"></div>
                </div>
                <div class="skeleton-text" style="width: 80px;"></div>
            </div>
        `).join('');
    }

    try {
        // Load user data
        const user = await apiRequest('/api/user');
        currentUser = user;

        // Update avatar
        const avatar = document.getElementById('userAvatar');
        if (avatar && user.name) {
            avatar.textContent = user.name.charAt(0).toUpperCase();
        }

        // Update balance
        if (balanceEl) {
            balanceEl.textContent = formatCurrency(user.balance || 0);
        }

        // Update gauge based on savings rate
        const totalIncome = user.total_income || 0;
        const totalExpense = user.total_expense || 0;
        const savingsPercent = totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 50;
        updateGauge(Math.max(0, Math.min(100, savingsPercent)));

        // Load transactions for home
        await loadHomeTransactions();

    } catch (error) {
        console.error('Home page error:', error);
        if (error.code === 'USER_NOT_FOUND') {
            showNotRegisteredModal();
        }
    }
}

function updateGauge(percent) {
    const gaugeFill = document.getElementById('gaugeFill');
    if (gaugeFill) {
        // Arc length is 251, so dashoffset = 251 - (251 * percent / 100)
        const offset = 251 - (251 * Math.min(100, Math.max(0, percent)) / 100);
        gaugeFill.style.strokeDashoffset = offset;
    }
}

async function loadHomeTransactions() {
    const container = document.getElementById('homeTransactionsList');
    if (!container) return;

    try {
        const response = await apiRequest('/api/transactions?limit=5');
        const transactions = response.transactions || response || [];

        if (!transactions.length) {
            container.innerHTML = `
                <div style="padding: 40px 20px; text-align: center; color: var(--wallet-text-secondary);">
                    Tranzaksiyalar yo'q
                </div>
            `;
            return;
        }

        allTransactions = transactions;

        container.innerHTML = transactions.slice(0, 5).map(t => renderTransactionItem(t)).join('');

    } catch (error) {
        console.error('Home transactions error:', error);
        container.innerHTML = `
            <div style="padding: 40px 20px; text-align: center; color: var(--wallet-text-secondary);">
                Yuklanmadi
            </div>
        `;
    }
}

function renderTransactionItem(t) {
    const isIncome = t.transaction_type === 'income';
    const typeClass = isIncome ? 'income' : 'expense';
    const sign = isIncome ? '+' : '-';

    const iconSvg = isIncome
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>';

    return `
        <div class="wallet-transaction-item" onclick="showTransactionDetail(${t.id})">
            <div class="wallet-transaction-icon ${typeClass}">
                ${iconSvg}
            </div>
            <div class="wallet-transaction-content">
                <div class="wallet-transaction-title">${t.description || t.category || 'Tranzaksiya'}</div>
                <div class="wallet-transaction-subtitle">${t.category || ''}</div>
            </div>
            <div class="wallet-transaction-amount">
                <div class="wallet-transaction-value ${typeClass}">${sign}${formatCurrency(t.amount, t.currency)}</div>
                <div class="wallet-transaction-time">${formatTime(t.created_at)}</div>
            </div>
        </div>
    `;
}

// ============================================
// TRANSACTIONS PAGE - with Infinite Scroll
// ============================================

let transactionsOffset = 0;
let transactionsLoading = false;
let transactionsHasMore = true;
const TRANSACTIONS_PER_PAGE = 20;

async function loadTransactionsPage() {
    const container = document.getElementById('transactionsContainer');
    if (!container) return;

    // Check cache first - instant render
    const cachedTrans = dataCache.get('transactions');
    if (cachedTrans && cachedTrans.length > 0) {
        allTransactions = cachedTrans;
        transactionsOffset = cachedTrans.length;
        transactionsHasMore = cachedTrans.length >= TRANSACTIONS_PER_PAGE;
        renderTransactionsList();
        setupInfiniteScroll();
        // Background refresh
        refreshTransactionsInBackground();
        return;
    }

    // Reset pagination
    transactionsOffset = 0;
    transactionsHasMore = true;
    allTransactions = [];

    // Show skeleton
    container.innerHTML = Array(4).fill(`
        <div class="skeleton-transaction" style="margin: 0 16px 8px;">
            <div class="skeleton-icon"></div>
            <div class="skeleton-content">
                <div class="skeleton-text" style="width: 60%;"></div>
                <div class="skeleton-text short" style="width: 40%;"></div>
            </div>
            <div class="skeleton-text" style="width: 80px;"></div>
        </div>
    `).join('');

    // Load first batch
    await loadMoreTransactions();

    // Setup infinite scroll
    setupInfiniteScroll();
}

async function refreshTransactionsInBackground() {
    try {
        const response = await apiRequest(`/api/transactions?limit=${TRANSACTIONS_PER_PAGE}&offset=0`);
        const newTransactions = response.transactions || response || [];
        if (newTransactions.length > 0) {
            dataCache.set('transactions', newTransactions);
        }
    } catch (e) {
        // Silent background refresh
    }
}

async function loadMoreTransactions() {
    if (transactionsLoading || !transactionsHasMore) return;

    transactionsLoading = true;

    try {
        const response = await apiRequest(`/api/transactions?limit=${TRANSACTIONS_PER_PAGE}&offset=${transactionsOffset}`);
        const newTransactions = response.transactions || response || [];

        if (newTransactions.length < TRANSACTIONS_PER_PAGE) {
            transactionsHasMore = false;
        }

        allTransactions = [...allTransactions, ...newTransactions];
        transactionsOffset += newTransactions.length;

        renderTransactionsList();
    } catch (error) {
        console.error('Load more transactions error:', error);
    } finally {
        transactionsLoading = false;
    }
}

function setupInfiniteScroll() {
    const container = document.getElementById('transactionsContainer');
    if (!container) return;

    // Remove old listener if exists
    window.removeEventListener('scroll', handleTransactionsScroll);
    window.addEventListener('scroll', handleTransactionsScroll);
}

function handleTransactionsScroll() {
    if (currentPage !== 'transactions') return;

    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;

    // Load more when 200px from bottom
    if (scrollTop + clientHeight >= scrollHeight - 200) {
        loadMoreTransactions();
    }
}

function renderTransactionsList() {
    const container = document.getElementById('transactionsContainer');
    if (!container) return;

    let filtered = allTransactions;

    // Apply filter
    if (currentTransactionFilter !== 'all') {
        filtered = filtered.filter(t => t.transaction_type === currentTransactionFilter);
    }

    // Apply search
    const searchQuery = document.getElementById('transactionSearch')?.value?.toLowerCase() || '';
    if (searchQuery) {
        filtered = filtered.filter(t =>
            (t.description?.toLowerCase().includes(searchQuery)) ||
            (t.category?.toLowerCase().includes(searchQuery))
        );
    }

    if (!filtered.length) {
        container.innerHTML = `
            <div style="padding: 40px 20px; text-align: center; color: var(--wallet-text-secondary);">
                Tranzaksiyalar topilmadi
            </div>
        `;
        return;
    }

    // Group by date
    const grouped = {};
    filtered.forEach(t => {
        const dateKey = formatDate(t.created_at);
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(t);
    });

    let html = '';
    Object.keys(grouped).forEach(dateKey => {
        html += `<div class="wallet-date-header">${dateKey}</div>`;
        html += `<div class="wallet-transactions-list" style="margin: 0 16px 16px;">`;
        html += grouped[dateKey].map(t => renderTransactionItem(t)).join('');
        html += `</div>`;
    });

    // Add loading indicator if more available
    if (transactionsHasMore) {
        html += `<div id="transactionsLoadMore" style="padding: 20px; text-align: center; color: var(--wallet-text-secondary);">
            <div class="wallet-spinner" style="margin: 0 auto;"></div>
        </div>`;
    }

    container.innerHTML = html;
}

function setTransactionFilter(filter, btn) {
    hapticFeedback('light');
    currentTransactionFilter = filter;

    document.querySelectorAll('#pageTransactions .wallet-filter-btn').forEach(b => {
        b.classList.remove('active');
    });
    btn.classList.add('active');

    renderTransactionsList();
}

function filterTransactions() {
    renderTransactionsList();
}

// ============================================
// STATISTICS PAGE
// ============================================

async function loadStatisticsPage(period) {
    hapticFeedback('light');

    // Update period buttons
    document.querySelectorAll('.wallet-segment-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.period === period);
    });

    // Cache key
    const cacheKey = `stats_${period}`;

    // Check cache first - instant render
    const cachedStats = dataCache.statistics[cacheKey];
    if (cachedStats) {
        renderStatisticsData(cachedStats);
        // Background refresh
        refreshStatistics(period, cacheKey);
        return;
    }

    // Show skeleton loading for stats
    document.getElementById('statIncome').innerHTML = '<span class="skeleton-text" style="width: 50px; height: 20px;"></span>';
    document.getElementById('statExpense').innerHTML = '<span class="skeleton-text" style="width: 50px; height: 20px;"></span>';
    document.getElementById('statNet').innerHTML = '<span class="skeleton-text" style="width: 50px; height: 20px;"></span>';

    await refreshStatistics(period, cacheKey);
}

async function refreshStatistics(period, cacheKey) {
    try {
        const apiStats = await apiRequest(`/api/statistics?period=${period}`);

        if (apiStats && !apiStats.error) {
            // Cache the data
            dataCache.statistics[cacheKey] = apiStats;
            dataCache.lastUpdate[cacheKey] = Date.now();

            renderStatisticsData(apiStats);
        }
    } catch (error) {
        console.error('Statistics error:', error);
    }
}

function renderStatisticsData(apiStats) {
    // Use API data
    updateStatsOverviewFromAPI(apiStats);
    renderBalanceTrendChartFromAPI(apiStats.balance_trend || []);
    renderIncomeExpenseChartFromAPI(apiStats);
    renderCategoryChartFromAPI(apiStats.category_breakdown || []);
    renderDailySpendingChartFromAPI(apiStats.daily_spending || []);
    renderTopCategoriesListFromAPI(apiStats.category_breakdown || []);

    // Additional stats
    const savingsRate = apiStats.total_income > 0
        ? Math.round(((apiStats.total_income - apiStats.total_expense) / apiStats.total_income) * 100)
        : 0;
    document.getElementById('statSavingsRate').textContent = savingsRate + '%';
    document.getElementById('statTransactionCount').textContent = apiStats.transaction_count || 0;
    document.getElementById('statAvgTransaction').textContent = formatCurrencyShort(apiStats.average_transaction || 0);
}

// API-based stat functions
function updateStatsOverviewFromAPI(stats) {
    document.getElementById('statIncome').textContent = formatCurrencyShort(stats.total_income || 0);
    document.getElementById('statExpense').textContent = formatCurrencyShort(stats.total_expense || 0);
    const net = (stats.total_income || 0) - (stats.total_expense || 0);
    const netEl = document.getElementById('statNet');
    netEl.textContent = formatCurrencyShort(net);
    netEl.className = `wallet-stat-value ${net >= 0 ? 'positive' : 'negative'}`;
}

function renderBalanceTrendChartFromAPI(data) {
    const ctx = document.getElementById('balanceTrendChart');
    if (!ctx) return;
    if (charts.balanceTrend) charts.balanceTrend.destroy();

    if (!data.length) {
        charts.balanceTrend = null;
        return;
    }

    charts.balanceTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.date),
            datasets: [{
                data: data.map(d => d.balance),
                borderColor: '#0A84FF',
                backgroundColor: 'rgba(10, 132, 255, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8E8E93', callback: v => formatCurrencyShort(v) } },
                x: { grid: { display: false }, ticks: { color: '#8E8E93', maxTicksLimit: 5 } }
            }
        }
    });
}

function renderIncomeExpenseChartFromAPI(stats) {
    const ctx = document.getElementById('incomeExpenseChart');
    if (!ctx) return;
    if (charts.incomeExpense) charts.incomeExpense.destroy();

    charts.incomeExpense = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Kirim', 'Chiqim'],
            datasets: [{
                data: [stats.total_income || 0, stats.total_expense || 0],
                backgroundColor: ['#30D158', '#FF453A'],
                borderRadius: 6,
                barThickness: 30
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8E8E93', callback: v => formatCurrencyShort(v) } },
                x: { grid: { display: false }, ticks: { color: '#8E8E93' } }
            }
        }
    });
}

function renderCategoryChartFromAPI(categories) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;
    if (charts.category) charts.category.destroy();

    if (!categories.length) {
        charts.category = null;
        return;
    }

    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
    charts.category = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categories.slice(0, 5).map(c => c.category),
            datasets: [{
                data: categories.slice(0, 5).map(c => c.amount),
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { color: '#8E8E93', padding: 8, usePointStyle: true, font: { size: 10 } } } }
        }
    });
}

function renderDailySpendingChartFromAPI(data) {
    const ctx = document.getElementById('dailySpendingChart');
    if (!ctx) return;
    if (charts.dailySpending) charts.dailySpending.destroy();

    if (!data.length) {
        charts.dailySpending = null;
        return;
    }

    charts.dailySpending = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.slice(-7).map(d => d.date),
            datasets: [{
                data: data.slice(-7).map(d => d.amount),
                backgroundColor: '#FF453A',
                borderRadius: 4,
                barThickness: 16
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8E8E93', callback: v => formatCurrencyShort(v) } },
                x: { grid: { display: false }, ticks: { color: '#8E8E93' } }
            }
        }
    });
}

function renderTopCategoriesListFromAPI(categories) {
    const container = document.getElementById('topCategoriesList');
    if (!container) return;

    const topCats = categories.slice(0, 3);
    if (!topCats.length) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--wallet-text-secondary);">Ma\'lumot yo\'q</div>';
        return;
    }

    const total = topCats.reduce((sum, c) => sum + (c.amount || 0), 0);
    container.innerHTML = topCats.map((cat, i) => {
        const percent = total > 0 ? Math.round((cat.amount / total) * 100) : 0;
        return `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; ${i < topCats.length - 1 ? 'border-bottom: 0.5px solid var(--wallet-bg-tertiary);' : ''}">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="color: var(--wallet-text-secondary); font-size: 13px; width: 18px;">${i + 1}</span>
                    <span style="color: var(--wallet-text-primary); font-size: 14px;">${cat.category}</span>
                </div>
                <div style="text-align: right;">
                    <div style="color: var(--wallet-text-primary); font-weight: 600; font-size: 14px;">${formatCurrency(cat.amount)}</div>
                    <div style="color: var(--wallet-text-secondary); font-size: 11px;">${percent}%</div>
                </div>
            </div>
        `;
    }).join('');
}

function loadStatistics(period, btn) {
    // Update active button
    if (btn) {
        document.querySelectorAll('.wallet-segment-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    loadStatisticsPage(period);
}

function calculateStatistics(transactions, period) {
    let totalIncome = 0;
    let totalExpense = 0;
    const categoryTotals = {};
    const dailyTotals = {};
    const balanceByDate = {};

    transactions.forEach(t => {
        const amount = parseFloat(t.amount) || 0;
        const date = t.created_at?.split(' ')[0] || t.created_at?.split('T')[0];

        if (t.transaction_type === 'income') {
            totalIncome += amount;
        } else {
            totalExpense += amount;
        }

        // Category totals (only expenses)
        if (t.transaction_type === 'expense' && t.category) {
            categoryTotals[t.category] = (categoryTotals[t.category] || 0) + amount;
        }

        // Daily spending (only expenses)
        if (t.transaction_type === 'expense' && date) {
            dailyTotals[date] = (dailyTotals[date] || 0) + amount;
        }

        // Balance trend
        if (date) {
            if (!balanceByDate[date]) balanceByDate[date] = 0;
            balanceByDate[date] += t.transaction_type === 'income' ? amount : -amount;
        }
    });

    // Calculate balance trend (cumulative)
    const sortedDates = Object.keys(balanceByDate).sort();
    let runningBalance = 0;
    const balanceTrend = sortedDates.map(date => {
        runningBalance += balanceByDate[date];
        return { date, balance: runningBalance };
    });

    // Top categories (only top 3 to save space)
    const topCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([category, amount]) => ({ category, amount }));

    // Income/Expense chart data
    const incomeExpenseData = {
        labels: ['Kirim', 'Chiqim'],
        income: totalIncome,
        expense: totalExpense
    };

    // Daily spending (last 7 days)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        last7Days.push({
            date: date.toLocaleDateString('uz-UZ', { weekday: 'short' }),
            amount: dailyTotals[dateStr] || 0
        });
    }

    // Savings rate
    const savingsRate = totalIncome > 0
        ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100)
        : 0;

    return {
        totalIncome,
        totalExpense,
        net: totalIncome - totalExpense,
        balanceTrend,
        categoryData: categoryTotals,
        topCategories,
        incomeExpenseData,
        dailySpending: last7Days,
        savingsRate,
        transactionCount: transactions.length,
        avgTransaction: transactions.length > 0
            ? totalExpense / transactions.filter(t => t.transaction_type === 'expense').length || 0
            : 0
    };
}

function updateStatsOverview(stats) {
    document.getElementById('statIncome').textContent = formatCurrencyShort(stats.totalIncome);
    document.getElementById('statExpense').textContent = formatCurrencyShort(stats.totalExpense);

    const netEl = document.getElementById('statNet');
    netEl.textContent = formatCurrencyShort(stats.net);
    netEl.className = `wallet-stat-value ${stats.net >= 0 ? 'positive' : 'negative'}`;
}

function renderBalanceTrendChart(data) {
    const ctx = document.getElementById('balanceTrendChart');
    if (!ctx) return;

    if (charts.balanceTrend) charts.balanceTrend.destroy();

    const labels = data.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' });
    });

    charts.balanceTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.slice(-14),
            datasets: [{
                data: data.slice(-14).map(d => d.balance),
                borderColor: '#0A84FF',
                backgroundColor: 'rgba(10, 132, 255, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#8E8E93', callback: v => formatCurrencyShort(v) }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#8E8E93', maxTicksLimit: 7 }
                }
            }
        }
    });
}

function renderIncomeExpenseChart(data) {
    const ctx = document.getElementById('incomeExpenseChart');
    if (!ctx) return;

    if (charts.incomeExpense) charts.incomeExpense.destroy();

    charts.incomeExpense = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Kirim', 'Chiqim'],
            datasets: [{
                data: [data.income, data.expense],
                backgroundColor: ['#30D158', '#FF453A'],
                borderRadius: 8,
                barThickness: 40
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#8E8E93', callback: v => formatCurrencyShort(v) }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#8E8E93' }
                }
            }
        }
    });
}

function renderCategoryChart(data) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    if (charts.category) charts.category.destroy();

    const labels = Object.keys(data);
    const values = Object.values(data);

    if (!labels.length) {
        ctx.parentElement.innerHTML = `
            <div class="wallet-chart-header">
                <span class="wallet-chart-title">Kategoriyalar</span>
            </div>
            <div style="padding: 40px; text-align: center; color: var(--wallet-text-secondary);">
                Ma'lumot yo'q
            </div>
        `;
        return;
    }

    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'];

    charts.category = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#8E8E93', padding: 16, usePointStyle: true }
                }
            }
        }
    });
}

function renderDailySpendingChart(data) {
    const ctx = document.getElementById('dailySpendingChart');
    if (!ctx) return;

    if (charts.dailySpending) charts.dailySpending.destroy();

    charts.dailySpending = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.date),
            datasets: [{
                data: data.map(d => d.amount),
                backgroundColor: '#FF453A',
                borderRadius: 4,
                barThickness: 20
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#8E8E93', callback: v => formatCurrencyShort(v) }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#8E8E93' }
                }
            }
        }
    });
}

function renderTopCategoriesList(categories) {
    const container = document.getElementById('topCategoriesList');
    if (!container) return;

    if (!categories.length) {
        container.innerHTML = `
            <div style="padding: 20px; text-align: center; color: var(--wallet-text-secondary);">
                Ma'lumot yo'q
            </div>
        `;
        return;
    }

    const total = categories.reduce((sum, c) => sum + c.amount, 0);

    container.innerHTML = categories.map((cat, i) => {
        const percent = total > 0 ? Math.round((cat.amount / total) * 100) : 0;
        return `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 0; ${i < categories.length - 1 ? 'border-bottom: 0.5px solid var(--wallet-bg-tertiary);' : ''}">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="color: var(--wallet-text-secondary); font-size: 14px; width: 20px;">${i + 1}</span>
                    <span style="color: var(--wallet-text-primary);">${cat.category}</span>
                </div>
                <div style="text-align: right;">
                    <div style="color: var(--wallet-text-primary); font-weight: 600;">${formatCurrency(cat.amount)}</div>
                    <div style="color: var(--wallet-text-secondary); font-size: 12px;">${percent}%</div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// REMINDERS PAGE
// ============================================

async function loadRemindersPage() {
    const container = document.getElementById('remindersList');
    if (!container) return;

    container.innerHTML = `
        <div style="padding: 40px 20px; text-align: center;">
            <div class="wallet-spinner"></div>
        </div>
    `;

    try {
        const reminders = await apiRequest('/api/reminders');
        const remindersList = reminders.reminders || reminders || [];

        if (!remindersList.length) {
            container.innerHTML = `
                <div class="wallet-empty">
                    <div class="wallet-empty-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                        </svg>
                    </div>
                    <div class="wallet-empty-title">Eslatmalar yo'q</div>
                    <div class="wallet-empty-text">To'lovlarni eslab qolish uchun eslatma qo'shing</div>
                </div>
            `;
            return;
        }

        container.innerHTML = remindersList.map(r => renderReminderItem(r)).join('');

    } catch (error) {
        console.error('Reminders error:', error);
        container.innerHTML = `
            <div style="padding: 40px 20px; text-align: center; color: var(--wallet-text-secondary);">
                Yuklanmadi
            </div>
        `;
    }
}

function renderReminderItem(r) {
    const date = new Date(r.reminder_date);
    const dateStr = date.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' });
    const isCompleted = r.is_completed;
    const isPast = date < new Date() && !isCompleted;

    const repeatLabels = {
        'none': '',
        'daily': 'Har kuni',
        'weekly': 'Har hafta',
        'monthly': 'Har oy'
    };

    return `
        <div class="wallet-list-item" onclick="toggleReminder(${r.id}, ${!isCompleted})">
            <div class="wallet-list-header">
                <div class="wallet-list-title">${r.title || 'Eslatma'}</div>
                <div class="wallet-list-badge ${isCompleted ? 'completed' : isPast ? 'overdue' : 'pending'}">
                    ${isCompleted ? 'Bajarildi' : isPast ? 'Muddati o\'tgan' : 'Kutilmoqda'}
                </div>
            </div>
            <div class="wallet-list-amount">${formatCurrency(r.amount, r.currency)}</div>
            <div class="wallet-list-meta">
                <div class="wallet-list-meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    ${dateStr}
                </div>
                ${repeatLabels[r.repeat_interval] ? `
                    <div class="wallet-list-meta-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="23 4 23 10 17 10"/>
                            <polyline points="1 20 1 14 7 14"/>
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                        </svg>
                        ${repeatLabels[r.repeat_interval]}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

async function toggleReminder(id, completed) {
    hapticFeedback('medium');
    try {
        await apiRequest(`/api/reminders/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ is_completed: completed })
        });
        hapticFeedback('success');
        await loadRemindersPage();
    } catch (error) {
        hapticFeedback('error');
        console.error('Toggle reminder error:', error);
    }
}

// ============================================
// DEBTS PAGE
// ============================================

async function loadDebtsPage() {
    const container = document.getElementById('debtsList');
    if (!container) return;

    container.innerHTML = `
        <div style="padding: 40px 20px; text-align: center;">
            <div class="wallet-spinner"></div>
        </div>
    `;

    try {
        const debts = await apiRequest('/api/debts');
        const debtsList = debts.debts || debts || [];

        renderDebtsList(debtsList);

    } catch (error) {
        console.error('Debts error:', error);
        container.innerHTML = `
            <div style="padding: 40px 20px; text-align: center; color: var(--wallet-text-secondary);">
                Yuklanmadi
            </div>
        `;
    }
}

function renderDebtsList(debts) {
    const container = document.getElementById('debtsList');
    if (!container) return;

    let filtered = debts;

    if (currentDebtFilter !== 'all') {
        filtered = filtered.filter(d => d.debt_type === currentDebtFilter);
    }

    if (!filtered.length) {
        container.innerHTML = `
            <div class="wallet-empty">
                <div class="wallet-empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                        <line x1="1" y1="10" x2="23" y2="10"/>
                    </svg>
                </div>
                <div class="wallet-empty-title">Qarzlar yo'q</div>
                <div class="wallet-empty-text">Qarz berish yoki olishni kuzatib boring</div>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(d => renderDebtItem(d)).join('');
}

function renderDebtItem(d) {
    const isGiven = d.debt_type === 'given';
    const remaining = (d.amount || 0) - (d.paid_amount || 0);
    const date = new Date(d.created_at);
    const dateStr = date.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' });

    return `
        <div class="wallet-list-item" onclick="showDebtDetail(${d.id})">
            <div class="wallet-list-header">
                <div class="wallet-list-title">${d.person_name || d.contact_name || 'Noma\'lum'}</div>
                <div class="wallet-list-badge ${isGiven ? 'overdue' : 'pending'}">
                    ${isGiven ? 'Berdim' : 'Oldim'}
                </div>
            </div>
            <div class="wallet-list-amount" style="color: ${isGiven ? 'var(--wallet-accent-red)' : 'var(--wallet-accent-green)'};">
                ${isGiven ? '-' : '+'}${formatCurrency(remaining, d.currency)}
            </div>
            <div class="wallet-list-meta">
                <div class="wallet-list-meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    ${dateStr}
                </div>
                ${d.description ? `<div class="wallet-list-meta-item">${d.description}</div>` : ''}
            </div>
        </div>
    `;
}

function setDebtFilter(filter, btn) {
    hapticFeedback('light');
    currentDebtFilter = filter;

    document.querySelectorAll('#pageDebts .wallet-filter-btn').forEach(b => {
        b.classList.remove('active');
    });
    btn.classList.add('active');

    loadDebtsPage();
}

// ============================================
// PROFILE PAGE
// ============================================

async function loadProfilePage() {
    try {
        const user = await apiRequest('/api/user');

        const nameEl = document.getElementById('profileName');
        const usernameEl = document.getElementById('profileUsername');
        const avatarEl = document.getElementById('profileAvatar');

        if (nameEl && user.name) nameEl.textContent = user.name;
        if (usernameEl && user.username) usernameEl.textContent = `@${user.username}`;
        if (avatarEl && user.name) avatarEl.textContent = user.name.charAt(0).toUpperCase();

    } catch (error) {
        console.error('Profile error:', error);
    }
}

// ============================================
// TOP EXPENSES PAGE
// ============================================

async function loadTopExpensesPage() {
    const container = document.getElementById('topExpensesContent');
    if (!container) return;

    try {
        const categories = await apiRequest('/api/statistics/top-categories?limit=10&days=30');

        if (!categories.length) {
            container.innerHTML = `
                <div class="wallet-empty">
                    <div class="wallet-empty-title">Ma'lumot yo'q</div>
                </div>
            `;
            return;
        }

        const colors = ['#FF453A', '#FF9F0A', '#FFD60A', '#30D158', '#0A84FF', '#5E5CE6', '#BF5AF2', '#FF375F'];

        container.innerHTML = categories.map((cat, i) => `
            <div style="background: var(--wallet-bg-secondary); border-radius: 12px; padding: 16px; margin-bottom: 12px; display: flex; align-items: center; gap: 16px;">
                <div style="width: 40px; height: 40px; border-radius: 10px; background: ${colors[i % colors.length]}20; display: flex; align-items: center; justify-content: center; color: ${colors[i % colors.length]}; font-weight: 700;">
                    ${i + 1}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: var(--wallet-text-primary);">${cat.category}</div>
                    <div style="font-size: 13px; color: var(--wallet-text-secondary);">${cat.count || ''} tranzaksiya</div>
                </div>
                <div style="font-weight: 700; color: var(--wallet-accent-red);">${formatCurrency(cat.amount)}</div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Top expenses error:', error);
    }
}

// ============================================
// MODALS
// ============================================

function showAddTransactionModal(type = null) {
    hapticFeedback('light');
    const modal = document.getElementById('addTransactionModal');
    if (modal) {
        modal.classList.add('active');
        if (type) {
            document.getElementById('transactionType').value = type;
        }
    }
}

function closeAddTransactionModal() {
    hapticFeedback('light');
    const modal = document.getElementById('addTransactionModal');
    if (modal) {
        modal.classList.remove('active');
        document.getElementById('addTransactionForm')?.reset();
    }
}

async function handleAddTransaction(event) {
    event.preventDefault();
    hapticFeedback('medium');

    const data = {
        transaction_type: document.getElementById('transactionType').value,
        amount: parseFloat(document.getElementById('transactionAmount').value),
        currency: document.getElementById('transactionCurrency').value,
        category: document.getElementById('transactionCategory').value,
        description: document.getElementById('transactionDescription').value || null
    };

    try {
        await apiRequest('/api/transactions', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        // Clear cache after adding transaction
        dataCache.clear();

        hapticFeedback('success');
        closeAddTransactionModal();
        await loadHomePage();
        if (currentPage === 'transactions') {
            await loadTransactionsPage();
        }
    } catch (error) {
        hapticFeedback('error');
        alert('Xatolik: ' + error.message);
    }
}

function showAddReminderModal() {
    hapticFeedback('light');
    const modal = document.getElementById('addReminderModal');
    if (modal) {
        modal.classList.add('active');
        const dateInput = document.getElementById('reminderDate');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    }
}

function closeAddReminderModal() {
    hapticFeedback('light');
    const modal = document.getElementById('addReminderModal');
    if (modal) {
        modal.classList.remove('active');
        document.getElementById('addReminderForm')?.reset();
    }
}

async function handleAddReminder(event) {
    event.preventDefault();
    hapticFeedback('medium');

    const data = {
        title: document.getElementById('reminderTitle').value,
        amount: parseFloat(document.getElementById('reminderAmount').value),
        currency: 'UZS',
        reminder_date: document.getElementById('reminderDate').value,
        repeat_interval: document.getElementById('reminderRepeat').value
    };

    try {
        await apiRequest('/api/reminders', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        hapticFeedback('success');
        closeAddReminderModal();
        await loadRemindersPage();
    } catch (error) {
        hapticFeedback('error');
        alert('Xatolik: ' + error.message);
    }
}

function showAddDebtModal() {
    hapticFeedback('light');
    const modal = document.getElementById('addDebtModal');
    if (modal) {
        modal.classList.add('active');
    }
}

function closeAddDebtModal() {
    hapticFeedback('light');
    const modal = document.getElementById('addDebtModal');
    if (modal) {
        modal.classList.remove('active');
        document.getElementById('addDebtForm')?.reset();
    }
}

async function handleAddDebt(event) {
    event.preventDefault();
    hapticFeedback('medium');

    const data = {
        debt_type: document.getElementById('debtType').value,
        person_name: document.getElementById('debtPersonName').value,
        amount: parseFloat(document.getElementById('debtAmount').value),
        currency: 'UZS',
        due_date: document.getElementById('debtDueDate').value || null,
        description: document.getElementById('debtDescription').value || null
    };

    try {
        await apiRequest('/api/debts', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        hapticFeedback('success');
        closeAddDebtModal();
        await loadDebtsPage();
    } catch (error) {
        hapticFeedback('error');
        alert('Xatolik: ' + error.message);
    }
}

function showNotRegisteredModal() {
    const modal = document.getElementById('notRegisteredModal');
    if (modal) {
        modal.classList.add('active');
    }
}

function openTelegramBot() {
    hapticFeedback('medium');
    if (tg?.openTelegramLink) {
        tg.openTelegramLink('https://t.me/BalansAiBot');
    } else {
        window.open('https://t.me/BalansAiBot', '_blank');
    }
}

// Placeholder functions
function showNotifications() {
    hapticFeedback('light');
    alert('Bildirishnomalar tez orada!');
}

function showExportModal() {
    hapticFeedback('light');

    // Create export modal if not exists
    let modal = document.getElementById('exportModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'exportModal';
        modal.className = 'wallet-modal';
        modal.innerHTML = `
            <div class="wallet-modal-content" style="max-height: 60vh;">
                <div class="wallet-modal-handle"></div>
                <div class="wallet-modal-header">
                    <span class="wallet-modal-title">Eksport qilish</span>
                    <button class="wallet-modal-close" onclick="closeExportModal()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div style="padding: 16px 0;">
                    <p style="color: var(--wallet-text-secondary); font-size: 13px; margin-bottom: 16px; text-align: center;">
                        Fayl Telegram botga yuboriladi
                    </p>
                    <button class="wallet-form-btn" style="margin-bottom: 12px;" onclick="exportData('csv')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px; vertical-align: middle;">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                        </svg>
                        CSV formatida yuborish
                    </button>
                    <button class="wallet-form-btn secondary" onclick="exportData('json')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px; vertical-align: middle;">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        JSON formatida yuborish
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    modal.classList.add('active');
}

function closeExportModal() {
    const modal = document.getElementById('exportModal');
    if (modal) modal.classList.remove('active');
    // Hide loading if modal is closed
    hideExportLoading();
}

function showExportLoading() {
    // Create or get loading overlay
    let loadingOverlay = document.getElementById('exportLoadingOverlay');
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'exportLoadingOverlay';
        loadingOverlay.className = 'export-loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="export-loading-content">
                <div class="export-loading-spinner"></div>
                <div class="export-loading-text">Fayl yuborilmoqda...</div>
                <div class="export-loading-subtext">Iltimos, kuting</div>
            </div>
        `;
        document.body.appendChild(loadingOverlay);
    }
    loadingOverlay.classList.add('active');
}

function hideExportLoading() {
    const loadingOverlay = document.getElementById('exportLoadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('active');
    }
}

async function exportData(format) {
    hapticFeedback('medium');

    try {
        const response = await apiRequest('/api/transactions?limit=10000');
        const transactions = response.transactions || response || [];

        if (!transactions.length) {
            alert('Eksport qilish uchun ma\'lumot yo\'q');
            return;
        }

        let content, filename, mimeType;

        if (format === 'csv') {
            // Create CSV
            const headers = ['Sana', 'Turi', 'Kategoriya', 'Summa', 'Valyuta', 'Tavsif'];
            const rows = transactions.map(t => [
                t.created_at || '',
                t.transaction_type === 'income' ? 'Kirim' : 'Chiqim',
                t.category || '',
                t.amount || 0,
                t.currency || 'UZS',
                (t.description || '').replace(/,/g, ';')
            ]);
            content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            filename = `balans_ai_export_${new Date().toISOString().split('T')[0]}.csv`;
            mimeType = 'text/csv;charset=utf-8;';
        } else {
            // Create JSON
            content = JSON.stringify(transactions, null, 2);
            filename = `balans_ai_export_${new Date().toISOString().split('T')[0]}.json`;
            mimeType = 'application/json;charset=utf-8;';
        }

        // Send file to Telegram bot
        await sendFileToTelegram(content, filename, mimeType, transactions.length);

    } catch (error) {
        hapticFeedback('error');
        alert('Eksport xatosi: ' + error.message);
    }
}

async function sendFileToTelegram(content, filename, mimeType, count) {
    // Show loading animation
    showExportLoading();
    
    try {
        // Create blob and FormData
        const blob = new Blob([content], { type: mimeType });
        const formData = new FormData();
        formData.append('file', blob, filename);
        formData.append('caption', `📊 Balans AI Eksport\n\n📁 Fayl: ${filename}\n📝 Tranzaksiyalar: ${count} ta\n📅 Sana: ${new Date().toLocaleDateString('uz-UZ')}`);

        // Send to API endpoint that forwards to Telegram
        const initData = getInitData();
        const params = new URLSearchParams(window.location.search);
        const testUserId = params.get('test_user_id');

        let url = '/api/export/telegram';
        if (testUserId && !initData) {
            url += `?test_user_id=${testUserId}`;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'X-Telegram-Init-Data': initData || ''
            },
            body: formData
        });

        // Hide loading animation
        hideExportLoading();

        if (response.ok) {
            hapticFeedback('success');
            closeExportModal();

            // Show success with Telegram native popup
            if (tg?.showPopup) {
                tg.showPopup({
                    title: 'Muvaffaqiyatli!',
                    message: `${count} ta tranzaksiya Telegram botga yuborildi. Botni tekshiring!`,
                    buttons: [{ type: 'ok', text: 'OK' }]
                });
            } else {
                alert(`${count} ta tranzaksiya Telegram botga yuborildi!`);
            }
        } else {
            throw new Error('Telegram ga yuborishda xatolik');
        }

    } catch (error) {
        // Hide loading animation on error
        hideExportLoading();
        console.error('Telegram export error:', error);

        // Fallback: download locally
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);

        hapticFeedback('success');
        closeExportModal();
        alert(`Fayl yuklab olindi. Telegram yuborishda xatolik.`);
    }
}

function showAddGoalModal() {
    hapticFeedback('light');
    alert('Maqsadlar funksiyasi tez orada!');
}

function showTransactionDetail(id) {
    hapticFeedback('light');
    console.log('Transaction detail:', id);
}

function showDebtDetail(id) {
    hapticFeedback('light');
    console.log('Debt detail:', id);
}

function showLanguageModal() {
    hapticFeedback('light');
    alert('Til sozlamalari tez orada!');
}

function showCurrencyModal() {
    hapticFeedback('light');
    alert('Valyuta sozlamalari tez orada!');
}

function showSupport() {
    hapticFeedback('light');
    if (tg?.openTelegramLink) {
        tg.openTelegramLink('https://t.me/BalansAiBot');
    }
}

function showAbout() {
    hapticFeedback('light');
    alert('Balans AI v2.0\nTelegram Wallet Style\n\n© 2024');
}

function handleLogout() {
    hapticFeedback('medium');
    if (confirm('Chiqishni tasdiqlaysizmi?')) {
        if (tg) {
            tg.close();
        } else {
            localStorage.clear();
            window.location.reload();
        }
    }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Wallet App initialized');

    // Load home page directly without loading screen
    await loadHomePage();
});

// Make functions globally available
window.navigateTo = navigateTo;
window.loadStatistics = loadStatistics;
window.setTransactionFilter = setTransactionFilter;
window.filterTransactions = filterTransactions;
window.setDebtFilter = setDebtFilter;
window.showAddTransactionModal = showAddTransactionModal;
window.closeAddTransactionModal = closeAddTransactionModal;
window.handleAddTransaction = handleAddTransaction;
window.showAddReminderModal = showAddReminderModal;
window.closeAddReminderModal = closeAddReminderModal;
window.handleAddReminder = handleAddReminder;
window.showAddDebtModal = showAddDebtModal;
window.closeAddDebtModal = closeAddDebtModal;
window.handleAddDebt = handleAddDebt;
window.toggleReminder = toggleReminder;
window.showNotifications = showNotifications;
window.showExportModal = showExportModal;
window.closeExportModal = closeExportModal;
window.exportData = exportData;
window.showExportLoading = showExportLoading;
window.hideExportLoading = hideExportLoading;
window.showAddGoalModal = showAddGoalModal;
window.showTransactionDetail = showTransactionDetail;
window.showDebtDetail = showDebtDetail;
window.showLanguageModal = showLanguageModal;
window.showCurrencyModal = showCurrencyModal;
window.showSupport = showSupport;
window.showAbout = showAbout;
window.handleLogout = handleLogout;
window.openTelegramBot = openTelegramBot;
