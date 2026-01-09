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
    limit: null,
    lastUpdate: {},
    TTL: 60000, // 60 sekund cache (1 minut)
    pageLoaded: {}, // Qaysi sahifa yuklangan

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

    isPageLoaded(page) {
        const now = Date.now();
        if (this.pageLoaded[page] && (now - this.pageLoaded[page]) < this.TTL) {
            return true;
        }
        return false;
    },

    setPageLoaded(page) {
        this.pageLoaded[page] = Date.now();
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
            this.limit = null;
            this.lastUpdate = {};
            this.pageLoaded = {};
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

    // Update nav
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
        // Agar sahifa allaqachon yuklangan bo'lsa, qayta yuklamaslik
        // home va settings har doim yangilanadi
        if (dataCache.isPageLoaded(pageName) && pageName !== 'home' && pageName !== 'settings') {
            console.log(`[Cache] ${pageName} sahifasi cache'dan`);
            return;
        }

        switch (pageName) {
            case 'home':
                // Home har doim yangilansin (limit, balance)
                await loadHomePage();
                break;
            case 'transactions':
                await loadTransactionsPage();
                dataCache.setPageLoaded(pageName);
                break;
            case 'statistics':
                await loadStatisticsPage('week');
                dataCache.setPageLoaded(pageName);
                break;
            case 'reminders':
                await loadRemindersPage();
                dataCache.setPageLoaded(pageName);
                break;
            case 'debts':
                await loadDebtsPage();
                dataCache.setPageLoaded(pageName);
                break;
            case 'profile':
                await loadProfilePage();
                dataCache.setPageLoaded(pageName);
                break;
            case 'settings':
                // Load tariff info when settings page opens
                await loadTariffInfo();
                dataCache.setPageLoaded(pageName);
                break;
            case 'topExpenses':
                await loadTopExpensesPage();
                dataCache.setPageLoaded(pageName);
                break;
            case 'warehouse':
                if (typeof loadWarehousePage === 'function') {
                    await loadWarehousePage();
                }
                dataCache.setPageLoaded(pageName);
                break;
            case 'employees':
                if (typeof loadEmployeesPage === 'function') {
                    await loadEmployeesPage();
                }
                dataCache.setPageLoaded(pageName);
                break;
            case 'tasks':
                if (typeof loadTasksPage === 'function') {
                    await loadTasksPage();
                }
                dataCache.setPageLoaded(pageName);
                break;
            case 'businessStats':
                // Business stats page - coming soon
                dataCache.setPageLoaded(pageName);
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

        // Load monthly limit status
        await loadLimitStatus();

        // Load transactions for home
        await loadHomeTransactions();

        // Load business features for BUSINESS tariff users
        if (user.tariff === 'BUSINESS' || user.tariff === 'BIZNES') {
            await loadBusinessQuickFeatures();
        }

    } catch (error) {
        console.error('Home page error:', error);
        if (error.code === 'USER_NOT_FOUND') {
            showNotRegisteredModal();
        }
    }
}

// ============================================
// BUSINESS QUICK FEATURES (For home page)
// ============================================

async function loadBusinessQuickFeatures() {
    const businessSection = document.getElementById('businessQuickActions');
    if (!businessSection) return;

    // Show the business section
    businessSection.style.display = 'block';

    try {
        // Load quick stats
        const stats = await apiRequest('/api/business/quick-stats');

        document.getElementById('businessStatProducts').textContent = stats.products || 0;
        document.getElementById('businessStatEmployees').textContent = stats.employees || 0;
        document.getElementById('businessStatTasks').textContent = stats.tasks || 0;

        // Load AI recommendations
        await loadAIRecommendations();

    } catch (error) {
        console.error('Business quick features error:', error);
    }
}

async function loadAIRecommendations() {
    const recommendationsSection = document.getElementById('aiRecommendations');
    const recommendationsList = document.getElementById('aiRecommendationsList');

    if (!recommendationsSection || !recommendationsList) return;

    try {
        const recommendations = await apiRequest('/api/business/ai-recommendations');

        if (recommendations && recommendations.length > 0) {
            recommendationsSection.style.display = 'block';

            recommendationsList.innerHTML = recommendations.map(rec => {
                const priorityColors = {
                    'high': '#FF453A',
                    'medium': '#FF9F0A',
                    'low': '#0A84FF',
                    'info': '#34C759'
                };
                const color = priorityColors[rec.priority] || '#8E8E93';

                return `
                    <div class="wallet-transaction-item" style="cursor: default; margin-bottom: 8px;">
                        <div class="wallet-transaction-icon" style="background: ${color}20;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
                                ${rec.type === 'low_stock' ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' : ''}
                                ${rec.type === 'best_seller' ? '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' : ''}
                                ${rec.type === 'stagnant' ? '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' : ''}
                                ${rec.type === 'urgent_task' ? '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>' : ''}
                            </svg>
                        </div>
                        <div class="wallet-transaction-info">
                            <div class="wallet-transaction-name">${rec.title}</div>
                            <div class="wallet-transaction-category">${rec.description}</div>
                            <div style="font-size: 11px; color: ${color}; margin-top: 4px;">💡 ${rec.action}</div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            recommendationsSection.style.display = 'none';
        }

    } catch (error) {
        console.error('AI recommendations error:', error);
        recommendationsSection.style.display = 'none';
    }
}

function updateGauge(percent) {
    const gaugeFill = document.getElementById('balanceGaugeFill');
    if (gaugeFill) {
        // Arc length is 220 (for 70% circle), so dashoffset = 220 - (220 * percent / 100)
        const offset = 220 - (220 * Math.min(100, Math.max(0, percent)) / 100);
        gaugeFill.style.strokeDashoffset = offset;
    }
}

async function loadLimitStatus() {
    try {
        const limitStatus = await apiRequest('/api/limit');
        
        if (limitStatus && limitStatus.limit) {
            const limit = limitStatus.limit;
            const spent = limitStatus.spent || 0;
            const percent = (spent / limit) * 100;
            
            // Update gauge
            updateGauge(percent);
            
            // Update label if needed
            const balanceLabel = document.getElementById('balanceLabel');
            if (balanceLabel) {
                const remaining = limit - spent;
                if (remaining > 0) {
                    balanceLabel.textContent = `${formatCurrency(remaining)} qoldi`;
                } else {
                    balanceLabel.textContent = 'Limit oshib ketdi';
                }
            }
        } else {
            // No limit set, show 0%
            updateGauge(0);
        }
    } catch (error) {
        console.error('Limit status error:', error);
        // On error, show 0%
        updateGauge(0);
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

    // Load business analytics for BUSINESS tariff users
    if (currentUser && (currentUser.tariff === 'BUSINESS' || currentUser.tariff === 'BIZNES')) {
        loadBusinessAnalytics();
    }
}

// ============================================
// BUSINESS ANALYTICS (For statistics page)
// ============================================

async function loadBusinessAnalytics() {
    const businessSection = document.getElementById('businessAnalyticsSection');
    if (!businessSection) return;

    // Show the business section
    businessSection.style.display = 'block';

    try {
        // Load warehouse statistics
        const warehouseStats = await apiRequest('/api/business/statistics/warehouse');
        document.getElementById('bizStatWarehouse').textContent = formatCurrencyShort(warehouseStats.total_value || 0);
        document.getElementById('bizStatLowStock').textContent = warehouseStats.low_stock_count || 0;
        document.getElementById('bizWarehouseProducts').textContent = warehouseStats.total_products || 0;

        // Find best seller
        const recommendations = await apiRequest('/api/business/ai-recommendations');
        const bestSeller = recommendations.find(r => r.type === 'best_seller');
        if (bestSeller) {
            document.getElementById('bizBestSeller').textContent = bestSeller.title.replace('Ko\'p sotilayapti: ', '');
        } else {
            document.getElementById('bizBestSeller').textContent = '-';
        }

        // Load employee statistics
        const employeeStats = await apiRequest('/api/business/statistics/employees');
        document.getElementById('bizStatEmployees').textContent = employeeStats.active_employees || 0;
        document.getElementById('bizTotalEmployees').textContent = employeeStats.total_employees || 0;

        // Load task statistics
        const taskStats = await apiRequest('/api/business/statistics/tasks');
        const inProgressTasks = taskStats.in_progress_tasks || 0;
        document.getElementById('bizStatTasks').textContent = inProgressTasks;

        // Calculate task progress percentage
        const totalTasks = taskStats.total_tasks || 0;
        const completedTasks = taskStats.completed_tasks || 0;
        const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        document.getElementById('bizTasksProgress').textContent = progressPercentage + '%';

    } catch (error) {
        console.error('Business analytics error:', error);
    }
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
    const skeleton = document.getElementById('remindersSkeleton');
    const container = document.getElementById('remindersList');
    if (!container) return;

    // Show skeleton, hide content
    if (skeleton) skeleton.style.display = 'block';
    container.style.display = 'none';

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
        } else {
            container.innerHTML = remindersList.map(r => renderReminderItem(r)).join('');
        }

        // Hide skeleton, show content
        if (skeleton) skeleton.style.display = 'none';
        container.style.display = 'block';

    } catch (error) {
        console.error('Reminders error:', error);
        container.innerHTML = `
            <div style="padding: 40px 20px; text-align: center; color: var(--wallet-text-secondary);">
                Yuklanmadi
            </div>
        `;
        // Hide skeleton, show content even on error
        if (skeleton) skeleton.style.display = 'none';
        container.style.display = 'block';
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
    const skeleton = document.getElementById('debtsSkeleton');
    const container = document.getElementById('debtsList');
    if (!container) return;

    // Show skeleton, hide content
    if (skeleton) skeleton.style.display = 'block';
    container.style.display = 'none';

    try {
        const debts = await apiRequest('/api/debts');
        const debtsList = debts.debts || debts || [];

        renderDebtsList(debtsList);

        // Hide skeleton, show content
        if (skeleton) skeleton.style.display = 'none';
        container.style.display = 'block';

    } catch (error) {
        console.error('Debts error:', error);
        container.innerHTML = `
            <div style="padding: 40px 20px; text-align: center; color: var(--wallet-text-secondary);">
                Yuklanmadi
            </div>
        `;
        // Hide skeleton, show content even on error
        if (skeleton) skeleton.style.display = 'none';
        container.style.display = 'block';
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

// ============================================
// MONTHLY LIMIT FUNCTIONS
// ============================================

let currentLimitStatus = null;

async function loadLimitStatus() {
    try {
        const status = await apiRequest('/api/limit');
        currentLimitStatus = status;
        updateLimitUI(status);
        
        // Update gauge based on limit percentage
        if (status && status.has_limit) {
            const percent = status.percent || 0;
            updateGauge(percent);
            
            // Update balance label if needed
            const balanceLabel = document.getElementById('balanceLabel');
            if (balanceLabel && status.remaining !== undefined) {
                if (status.remaining > 0) {
                    balanceLabel.textContent = `${formatCurrency(status.remaining)} qoldi`;
                } else if (status.exceeded) {
                    balanceLabel.textContent = 'Limit oshib ketdi';
                } else {
                    balanceLabel.textContent = 'Umumiy balans';
                }
            }
        } else {
            // No limit set, show 0%
            updateGauge(0);
            const balanceLabel = document.getElementById('balanceLabel');
            if (balanceLabel) {
                balanceLabel.textContent = 'Umumiy balans';
            }
        }
    } catch (error) {
        console.error('Limit status error:', error);
        // On error, show 0%
        updateGauge(0);
    }
}

function updateLimitUI(status) {
    const limitSection = document.getElementById('limitSection');
    const setLimitCta = document.getElementById('setLimitCta');

    if (!status.has_limit) {
        // Limit o'rnatilmagan - CTA ko'rsatish
        if (limitSection) limitSection.style.display = 'none';
        if (setLimitCta) setLimitCta.style.display = 'flex';
        return;
    }

    // Limit bor - progress bar ko'rsatish
    if (setLimitCta) setLimitCta.style.display = 'none';
    if (limitSection) {
        limitSection.style.display = 'block';

        // Values
        document.getElementById('limitSpent').textContent = formatCurrencyShort(status.spent);
        document.getElementById('limitTotal').textContent = formatCurrencyShort(status.limit);
        document.getElementById('limitRemaining').textContent = `Qoldi: ${formatCurrency(Math.max(0, status.remaining))}`;
        document.getElementById('limitPercent').textContent = `${Math.round(status.percent)}%`;

        // Progress bar
        const progressFill = document.getElementById('limitProgressFill');
        if (progressFill) {
            progressFill.style.width = `${Math.min(100, status.percent)}%`;
        }

        // Warning states
        limitSection.classList.remove('warning', 'exceeded');
        if (status.exceeded) {
            limitSection.classList.add('exceeded');
            // Show warning
            if (tg?.showPopup && !sessionStorage.getItem('limitExceededWarning')) {
                sessionStorage.setItem('limitExceededWarning', 'true');
                tg.showPopup({
                    title: 'Limit oshdi!',
                    message: `Siz oylik ${formatCurrency(status.limit)} limitidan ${formatCurrency(status.spent - status.limit)} ga ko'proq sarfladingiz.`,
                    buttons: [{ type: 'ok', text: 'Tushundim' }]
                });
            }
        } else if (status.warning) {
            limitSection.classList.add('warning');
        }
    }
}

function showSetLimitModal() {
    hapticFeedback('light');
    const modal = document.getElementById('setLimitModal');
    if (modal) {
        modal.classList.add('active');
        // Agar oldingi limit bor bo'lsa, ko'rsatish
        if (currentLimitStatus?.has_limit && currentLimitStatus.limit > 0) {
            document.getElementById('limitAmount').value = currentLimitStatus.limit;
        }
    }
}

function closeSetLimitModal() {
    hapticFeedback('light');
    const modal = document.getElementById('setLimitModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function setLimitPreset(amount) {
    hapticFeedback('light');
    document.getElementById('limitAmount').value = amount;
}

async function handleSetLimit(event) {
    event.preventDefault();
    hapticFeedback('medium');

    const amount = parseFloat(document.getElementById('limitAmount').value);
    if (!amount || amount <= 0) {
        alert('Iltimos, to\'g\'ri summa kiriting');
        return;
    }

    try {
        const response = await apiRequest('/api/limit', {
            method: 'POST',
            body: JSON.stringify({ limit: amount })
        });

        if (response.success) {
            hapticFeedback('success');
            closeSetLimitModal();
            await loadLimitStatus();

            if (tg?.showPopup) {
                tg.showPopup({
                    title: 'Muvaffaqiyatli!',
                    message: `Oylik limit ${formatCurrency(amount)} ga o'rnatildi.`,
                    buttons: [{ type: 'ok', text: 'OK' }]
                });
            }
        } else {
            throw new Error(response.error || 'Xatolik');
        }
    } catch (error) {
        hapticFeedback('error');
        alert('Xatolik: ' + error.message);
    }
}

async function removeLimit() {
    hapticFeedback('medium');

    if (!confirm('Limitni o\'chirishni xohlaysizmi?')) {
        return;
    }

    try {
        const response = await apiRequest('/api/limit', {
            method: 'POST',
            body: JSON.stringify({ limit: 0 })
        });

        if (response.success) {
            hapticFeedback('success');
            closeSetLimitModal();
            await loadLimitStatus();
        }
    } catch (error) {
        hapticFeedback('error');
        alert('Xatolik: ' + error.message);
    }
}

window.showSetLimitModal = showSetLimitModal;
window.closeSetLimitModal = closeSetLimitModal;
window.setLimitPreset = setLimitPreset;
window.handleSetLimit = handleSetLimit;
window.removeLimit = removeLimit;

// ============================================
// SERVICES PAGE - SOON MESSAGE
// ============================================

function showSoonMessage(serviceName) {
    hapticFeedback('light');
    if (tg?.showPopup) {
        tg.showPopup({
            title: 'Tez kunda!',
            message: `${serviceName} xizmati tez orada ishga tushadi. Kuzatib boring!`,
            buttons: [{ type: 'ok', text: 'Kutaman' }]
        });
    } else {
        alert(`${serviceName} xizmati tez orada!`);
    }
}

window.showSoonMessage = showSoonMessage;

// ============================================
// NEW ANALYTICS FUNCTIONS
// ============================================

async function loadAdvancedAnalytics() {
    try {
        // Get all transactions for analytics
        const response = await apiRequest('/api/transactions?limit=1000');
        const transactions = response.transactions || response || [];

        // Calculate weekly comparison
        calculateWeeklyComparison(transactions);

        // Calculate spending insights
        calculateSpendingInsights(transactions);

        // Calculate forecast
        calculateForecast(transactions);

        // Calculate financial health
        calculateFinancialHealth(transactions);

        // Load premium analytics if user has Plus or higher plan
        await loadPremiumAnalytics(transactions);

    } catch (error) {
        console.error('Advanced analytics error:', error);
    }
}

async function loadPremiumAnalytics(transactions) {
    try {
        // Get user to check plan
        const user = currentUser || await apiRequest('/api/user');
        if (!user) return;

        const userPlan = user.tariff || 'NONE';

        // Plan hierarchy
        const planLevels = {
            'NONE': 0,
            'FREE': 1,
            'PLUS': 2,
            'PRO': 3,
            'BUSINESS': 4
        };

        const userLevel = planLevels[userPlan] || 0;
        const requiredLevel = planLevels['PLUS'] || 2;

        // Handle Category Trend Analytics
        const categoryTrendCard = document.getElementById('categoryTrendAnalytics');
        if (categoryTrendCard) {
            const locked = categoryTrendCard.querySelector('.analytics-locked');
            const content = categoryTrendCard.querySelector('.analytics-content');

            if (userLevel >= requiredLevel) {
                // User has access - show content, hide lock
                if (locked) locked.style.display = 'none';
                if (content) content.style.display = 'block';
                // Load category trend chart
                loadCategoryTrendChart(transactions);
            } else {
                // User doesn't have access - show lock, hide content
                if (locked) locked.style.display = 'block';
                if (content) content.style.display = 'none';
            }
        }

        // Handle Monthly Breakdown Analytics
        const monthlyBreakdownCard = document.getElementById('monthlyBreakdownAnalytics');
        if (monthlyBreakdownCard) {
            const locked = monthlyBreakdownCard.querySelector('.analytics-locked');
            const content = monthlyBreakdownCard.querySelector('.analytics-content');

            if (userLevel >= requiredLevel) {
                // User has access - show content, hide lock
                if (locked) locked.style.display = 'none';
                if (content) content.style.display = 'block';
                // Load monthly breakdown
                loadMonthlyBreakdown(transactions);
            } else {
                // User doesn't have access - show lock, hide content
                if (locked) locked.style.display = 'block';
                if (content) content.style.display = 'none';
            }
        }

    } catch (error) {
        console.error('Premium analytics error:', error);
    }
}

function loadCategoryTrendChart(transactions) {
    const canvas = document.getElementById('categoryTrendChart');
    if (!canvas) return;

    // Destroy existing chart if any
    if (charts.categoryTrend) {
        charts.categoryTrend.destroy();
    }

    // Group transactions by category and month
    const categoryData = {};
    const months = new Set();

    transactions.forEach(t => {
        if (t.transaction_type !== 'expense') return;
        const date = new Date(t.created_at);
        const month = date.toLocaleDateString('uz-UZ', { month: 'short', year: 'numeric' });
        const category = t.category || 'Boshqa';
        const amount = parseFloat(t.amount) || 0;

        months.add(month);

        if (!categoryData[category]) {
            categoryData[category] = {};
        }
        categoryData[category][month] = (categoryData[category][month] || 0) + amount;
    });

    const monthsArray = Array.from(months).sort();
    const categories = Object.keys(categoryData).slice(0, 5); // Top 5 categories

    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'];

    const datasets = categories.map((category, index) => ({
        label: category,
        data: monthsArray.map(month => categoryData[category][month] || 0),
        borderColor: colors[index],
        backgroundColor: colors[index] + '33',
        fill: false,
        tension: 0.4
    }));

    charts.categoryTrend = new Chart(canvas, {
        type: 'line',
        data: {
            labels: monthsArray,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 10,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrencyShort(value);
                        }
                    }
                }
            }
        }
    });
}

function loadMonthlyBreakdown(transactions) {
    const container = document.getElementById('monthlyBreakdownContent');
    if (!container) return;

    // Group transactions by month
    const monthlyData = {};

    transactions.forEach(t => {
        const date = new Date(t.created_at);
        const month = date.toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' });
        const amount = parseFloat(t.amount) || 0;

        if (!monthlyData[month]) {
            monthlyData[month] = { income: 0, expense: 0, count: 0 };
        }

        if (t.transaction_type === 'income') {
            monthlyData[month].income += amount;
        } else {
            monthlyData[month].expense += amount;
        }
        monthlyData[month].count += 1;
    });

    // Convert to array and sort by date
    const monthlyArray = Object.entries(monthlyData)
        .map(([month, data]) => ({ month, ...data }))
        .reverse()
        .slice(0, 6); // Last 6 months

    if (monthlyArray.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--wallet-text-secondary); padding: 20px;">Ma\'lumot yo\'q</p>';
        return;
    }

    container.innerHTML = monthlyArray.map(item => {
        const net = item.income - item.expense;
        const netClass = net >= 0 ? 'positive' : 'negative';

        return `
            <div class="monthly-breakdown-item">
                <div class="monthly-breakdown-header">
                    <div class="monthly-breakdown-month">${item.month}</div>
                    <div class="monthly-breakdown-count">${item.count} ta</div>
                </div>
                <div class="monthly-breakdown-stats">
                    <div class="monthly-breakdown-stat">
                        <span class="stat-label">Kirim:</span>
                        <span class="stat-value income">${formatCurrency(item.income)}</span>
                    </div>
                    <div class="monthly-breakdown-stat">
                        <span class="stat-label">Chiqim:</span>
                        <span class="stat-value expense">${formatCurrency(item.expense)}</span>
                    </div>
                    <div class="monthly-breakdown-stat">
                        <span class="stat-label">Sof:</span>
                        <span class="stat-value ${netClass}">${formatCurrency(net)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function calculateWeeklyComparison(transactions) {
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setSeconds(lastWeekEnd.getSeconds() - 1);

    let thisWeekExpense = 0;
    let lastWeekExpense = 0;

    transactions.forEach(t => {
        if (t.transaction_type !== 'expense') return;
        const date = new Date(t.created_at);
        const amount = parseFloat(t.amount) || 0;

        if (date >= thisWeekStart) {
            thisWeekExpense += amount;
        } else if (date >= lastWeekStart && date < thisWeekStart) {
            lastWeekExpense += amount;
        }
    });

    // Update UI
    document.getElementById('thisWeekExpense').textContent = formatCurrency(thisWeekExpense);
    document.getElementById('lastWeekExpense').textContent = formatCurrency(lastWeekExpense);

    const maxExpense = Math.max(thisWeekExpense, lastWeekExpense, 1);
    document.getElementById('thisWeekBar').style.width = `${(thisWeekExpense / maxExpense) * 100}%`;
    document.getElementById('lastWeekBar').style.width = `${(lastWeekExpense / maxExpense) * 100}%`;

    // Change text
    const changeEl = document.getElementById('weeklyChangeText');
    if (changeEl) {
        const diff = thisWeekExpense - lastWeekExpense;
        const diffPercent = lastWeekExpense > 0 ? Math.round((diff / lastWeekExpense) * 100) : 0;

        if (diff > 0) {
            changeEl.className = 'comparison-change negative';
            changeEl.innerHTML = `<span class="change-icon">↑</span><span class="change-text">Bu hafta ${Math.abs(diffPercent)}% ko'proq sarfladingiz</span>`;
        } else if (diff < 0) {
            changeEl.className = 'comparison-change positive';
            changeEl.innerHTML = `<span class="change-icon">↓</span><span class="change-text">Bu hafta ${Math.abs(diffPercent)}% kam sarfladingiz</span>`;
        } else {
            changeEl.innerHTML = `<span class="change-icon">→</span><span class="change-text">Xarajatlar teng</span>`;
        }
    }
}

function calculateSpendingInsights(transactions) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let totalExpense = 0;
    let maxExpense = 0;
    let maxExpenseDesc = '-';
    const dayExpenses = {};
    const categoryExpenses = {};
    let expenseCount = 0;

    transactions.forEach(t => {
        if (t.transaction_type !== 'expense') return;
        const date = new Date(t.created_at);
        if (date < monthStart) return;

        const amount = parseFloat(t.amount) || 0;
        totalExpense += amount;
        expenseCount++;

        // Max single expense
        if (amount > maxExpense) {
            maxExpense = amount;
            maxExpenseDesc = t.description || t.category || '-';
        }

        // Day expenses
        const dayName = date.toLocaleDateString('uz-UZ', { weekday: 'long' });
        dayExpenses[dayName] = (dayExpenses[dayName] || 0) + amount;

        // Category expenses
        const cat = t.category || 'Boshqa';
        categoryExpenses[cat] = (categoryExpenses[cat] || 0) + amount;
    });

    // Days passed in this month
    const daysPassed = Math.max(1, now.getDate());
    const avgDaily = totalExpense / daysPassed;

    // Most expensive day
    let mostExpensiveDay = '-';
    let mostExpensiveDayAmount = 0;
    Object.entries(dayExpenses).forEach(([day, amount]) => {
        if (amount > mostExpensiveDayAmount) {
            mostExpensiveDayAmount = amount;
            mostExpensiveDay = day;
        }
    });

    // Top category
    let topCategory = '-';
    let topCategoryAmount = 0;
    Object.entries(categoryExpenses).forEach(([cat, amount]) => {
        if (amount > topCategoryAmount) {
            topCategoryAmount = amount;
            topCategory = cat;
        }
    });

    // Update UI
    document.getElementById('avgDailyExpense').textContent = formatCurrencyShort(avgDaily) + " so'm";
    document.getElementById('maxSingleExpense').textContent = formatCurrencyShort(maxExpense) + " so'm";
    document.getElementById('mostExpensiveDay').textContent = mostExpensiveDay.charAt(0).toUpperCase() + mostExpensiveDay.slice(1);
    document.getElementById('topCategoryName').textContent = topCategory;
}

function calculateForecast(transactions) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const totalDaysInMonth = monthEnd.getDate();
    const daysPassed = now.getDate();
    const daysRemaining = totalDaysInMonth - daysPassed;

    // Current month expenses
    let currentMonthExpense = 0;
    transactions.forEach(t => {
        if (t.transaction_type !== 'expense') return;
        const date = new Date(t.created_at);
        if (date >= monthStart && date <= now) {
            currentMonthExpense += parseFloat(t.amount) || 0;
        }
    });

    // Daily average
    const dailyAverage = daysPassed > 0 ? currentMonthExpense / daysPassed : 0;

    // Projected expense
    const projectedExpense = currentMonthExpense + (dailyAverage * daysRemaining);

    // Update UI
    document.getElementById('currentMonthExpense').textContent = formatCurrency(currentMonthExpense);
    document.getElementById('projectedExpense').textContent = formatCurrency(projectedExpense);
    document.getElementById('forecastValue').textContent = formatCurrencyShort(projectedExpense) + " so'm";

    // Update limit status
    if (currentLimitStatus && currentLimitStatus.has_limit) {
        document.getElementById('monthlyLimitStat').textContent = formatCurrency(currentLimitStatus.limit);

        // Update gauge based on projected vs limit
        const forecastGauge = document.getElementById('forecastGaugeFill');
        if (forecastGauge) {
            const percent = Math.min(100, (projectedExpense / currentLimitStatus.limit) * 100);
            const offset = 126 - (126 * percent / 100);
            forecastGauge.style.strokeDashoffset = offset;
        }
    } else {
        document.getElementById('monthlyLimitStat').textContent = 'Belgilanmagan';
    }
}

function calculateFinancialHealth(transactions) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let income = 0;
    let expense = 0;
    let transactionCount = 0;

    transactions.forEach(t => {
        const date = new Date(t.created_at);
        if (date < monthStart) return;

        const amount = parseFloat(t.amount) || 0;
        transactionCount++;

        if (t.transaction_type === 'income') {
            income += amount;
        } else {
            expense += amount;
        }
    });

    // Income/Expense ratio
    const ratio = expense > 0 ? (income / expense).toFixed(2) : '-';
    document.getElementById('incomeExpenseRatio').textContent = ratio !== '-' ? `${ratio}x` : ratio;

    // Savings percent
    const savingsPercent = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;
    document.getElementById('savingsPercent').textContent = savingsPercent + '%';

    // Limit status
    let limitStatusText = 'Belgilanmagan';
    if (currentLimitStatus && currentLimitStatus.has_limit) {
        if (currentLimitStatus.exceeded) {
            limitStatusText = 'Oshgan';
        } else if (currentLimitStatus.percent > 80) {
            limitStatusText = 'Ogohlantirish';
        } else {
            limitStatusText = 'Normal';
        }
    }
    document.getElementById('limitStatus').textContent = limitStatusText;

    // Transaction frequency
    const daysPassed = Math.max(1, now.getDate());
    const frequency = (transactionCount / daysPassed).toFixed(1);
    document.getElementById('transactionFrequency').textContent = frequency + '/kun';

    // Calculate health score (0-100)
    let score = 50; // Base score

    // Add points for positive savings
    if (savingsPercent > 20) score += 20;
    else if (savingsPercent > 10) score += 10;
    else if (savingsPercent > 0) score += 5;
    else score -= 10;

    // Add points for good income/expense ratio
    if (parseFloat(ratio) >= 1.5) score += 15;
    else if (parseFloat(ratio) >= 1.2) score += 10;
    else if (parseFloat(ratio) >= 1) score += 5;
    else score -= 10;

    // Add points for limit compliance
    if (currentLimitStatus && currentLimitStatus.has_limit) {
        if (!currentLimitStatus.exceeded && currentLimitStatus.percent < 80) score += 15;
        else if (!currentLimitStatus.exceeded) score += 5;
        else score -= 10;
    }

    score = Math.max(0, Math.min(100, score));

    // Update health score UI
    const scoreEl = document.getElementById('financialHealthScore');
    if (scoreEl) {
        scoreEl.textContent = score;
        scoreEl.className = 'health-score';
        if (score >= 70) scoreEl.classList.add('high');
        else if (score >= 40) scoreEl.classList.add('medium');
        else scoreEl.classList.add('low');
    }
}

// Override loadStatisticsPage to include advanced analytics
const originalLoadStatisticsPage = loadStatisticsPage;
loadStatisticsPage = async function(period) {
    await originalLoadStatisticsPage.call(this, period);
    // Load advanced analytics after basic stats
    await loadAdvancedAnalytics();
};

// ============================================
// SKELETON LOADERS FOR DEBTS AND REMINDERS
// ============================================

function showDebtsSkeleton() {
    const container = document.getElementById('debtsList');
    if (!container) return;

    container.innerHTML = Array(3).fill(`
        <div class="skeleton-list-item">
            <div class="skeleton-list-header">
                <div class="skeleton-list-title"></div>
                <div class="skeleton-list-badge"></div>
            </div>
            <div class="skeleton-list-amount"></div>
            <div class="skeleton-list-meta">
                <div class="skeleton-list-meta-item"></div>
                <div class="skeleton-list-meta-item"></div>
            </div>
        </div>
    `).join('');
}

function showRemindersSkeleton() {
    const container = document.getElementById('remindersList');
    if (!container) return;

    container.innerHTML = Array(3).fill(`
        <div class="skeleton-list-item">
            <div class="skeleton-list-header">
                <div class="skeleton-list-title"></div>
                <div class="skeleton-list-badge"></div>
            </div>
            <div class="skeleton-list-amount"></div>
            <div class="skeleton-list-meta">
                <div class="skeleton-list-meta-item"></div>
                <div class="skeleton-list-meta-item"></div>
            </div>
        </div>
    `).join('');
}

// Skeleton loading is now integrated directly into loadDebtsPage and loadRemindersPage functions

// ==================== THEME MODE (LIGHT/DARK) ====================

async function loadTheme() {
    try {
        const response = await fetch('/api/user/theme');
        const data = await response.json();
        applyTheme(data.theme_mode || 'dark');
    } catch (error) {
        console.error('Theme yuklashda xato:', error);
        applyTheme('dark'); // Default
    }
}

function applyTheme(theme) {
    // Header icons
    const moonIcon = document.getElementById('moonIcon');
    const sunIcon = document.getElementById('sunIcon');

    // Settings page icons
    const indexMoonIcon = document.getElementById('indexMoonIcon');
    const indexSunIcon = document.getElementById('indexSunIcon');
    const indexThemeDesc = document.getElementById('indexThemeDesc');

    if (theme === 'light') {
        document.body.classList.add('light-mode');
        if (moonIcon) moonIcon.style.display = 'none';
        if (sunIcon) sunIcon.style.display = 'block';
        if (indexMoonIcon) indexMoonIcon.style.display = 'none';
        if (indexSunIcon) indexSunIcon.style.display = 'block';
        if (indexThemeDesc) indexThemeDesc.textContent = 'Yorug\' rejim';
    } else {
        document.body.classList.remove('light-mode');
        if (moonIcon) moonIcon.style.display = 'block';
        if (sunIcon) sunIcon.style.display = 'none';
        if (indexMoonIcon) indexMoonIcon.style.display = 'block';
        if (indexSunIcon) indexSunIcon.style.display = 'none';
        if (indexThemeDesc) indexThemeDesc.textContent = 'Qorong\'u rejim';
    }
}

async function toggleTheme() {
    const isLightMode = document.body.classList.contains('light-mode');
    const newTheme = isLightMode ? 'dark' : 'light';

    // Apply theme immediately for better UX
    applyTheme(newTheme);

    // Save to backend
    try {
        await fetch('/api/user/theme', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ theme_mode: newTheme })
        });
    } catch (error) {
        console.error('Theme saqlashda xato:', error);
    }
}

// Load theme on page load
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => loadTheme(), 100);
});

// ==================== TARIFF INFO LOADING ====================

async function loadTariffInfo() {
    try {
        const response = await fetch('/api/user', {
            headers: {
                'X-Telegram-Init-Data': getInitData()
            }
        });
        const user = await response.json();

        console.log('[DEBUG] loadTariffInfo - User:', user.user_id, 'Tariff:', user.tariff);

        const tariff = user.tariff || 'FREE';
        const tariffNames = {
            'FREE': 'Bepul tarif',
            'PLUS': 'Plus tarif',
            'BIZNES': 'Biznes tarif',
            'BUSINESS': 'Biznes tarif',
            'NONE': 'Tarif tanlanmagan'
        };
        
        const tariffIcons = {
            'FREE': '🆓',
            'PLUS': '⭐',
            'BIZNES': '💼',
            'BUSINESS': '💼',
            'NONE': '⭐'
        };
        
        // Update tariff info
        const tariffInfoIcon = document.getElementById('tariffInfoIcon');
        const tariffInfoName = document.getElementById('tariffInfoName');
        const tariffInfoDesc = document.getElementById('tariffInfoDesc');
        const tariffInfoBadge = document.getElementById('tariffInfoBadge');
        
        if (tariffInfoIcon) tariffInfoIcon.textContent = tariffIcons[tariff] || '⭐';
        if (tariffInfoName) tariffInfoName.textContent = tariffNames[tariff] || tariff;
        if (tariffInfoDesc) {
            if (tariff === 'BIZNES' || tariff === 'BUSINESS') {
                tariffInfoDesc.textContent = 'Ombor, xodimlar, vazifalar';
            } else if (tariff === 'PLUS') {
                tariffInfoDesc.textContent = 'Kengaytirilgan funksiyalar';
            } else {
                tariffInfoDesc.textContent = 'Asosiy funksiyalar';
            }
        }
        if (tariffInfoBadge) {
            tariffInfoBadge.textContent = tariff;
            tariffInfoBadge.className = `tariff-info-badge ${tariff}`;
        }

        // Show/hide business services section based on tariff
        const businessSection = document.getElementById('businessServicesSection');
        if (businessSection) {
            if (tariff === 'BIZNES' || tariff === 'BUSINESS') {
                businessSection.style.display = 'block';
                console.log('[DEBUG] Biznes bo\'limi ko\'rsatildi');
            } else {
                businessSection.style.display = 'none';
                console.log('[DEBUG] Biznes bo\'limi yashirildi');
            }
        }
    } catch (error) {
        console.error('Tarif ma\'lumotlarini yuklashda xato:', error);
    }
}

function showChangeTariffModal() {
    const modalHTML = `
        <div class="modal-overlay" id="changeTariffModal" onclick="if(event.target === this) closeChangeTariffModal()">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Tarifni o'zgartirish</h2>
                    <button class="modal-close" onclick="closeChangeTariffModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 500;">Tarif tanlang:</label>
                        <select id="selectTariff" class="wallet-input">
                            <option value="FREE">🆓 Bepul tarif</option>
                            <option value="PLUS">⭐ Plus tarif</option>
                            <option value="BIZNES">💼 Biznes tarif</option>
                        </select>
                    </div>
                    <div style="padding: 12px; background: rgba(255, 159, 10, 0.1); border-radius: 12px; margin-top: 16px;">
                        <p style="margin: 0; font-size: 13px; color: var(--wallet-text-secondary);">
                            💡 Tarifni o'zgartirgandan keyin sahifani yangilang (refresh).
                        </p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="wallet-btn-secondary" onclick="closeChangeTariffModal()">Bekor qilish</button>
                    <button class="wallet-btn-primary" onclick="changeTariff()">Saqlash</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeChangeTariffModal() {
    const modal = document.getElementById('changeTariffModal');
    if (modal) modal.remove();
}

async function changeTariff() {
    const selectTariff = document.getElementById('selectTariff');
    const newTariff = selectTariff.value;
    
    try {
        const initData = getInitData();
        const params = new URLSearchParams(window.location.search);
        const testUserId = params.get('test_user_id');
        
        let url = '/api/user/tariff';
        if (testUserId) {
            url += `?test_user_id=${testUserId}`;
        }
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': initData
            },
            body: JSON.stringify({ tariff: newTariff })
        });
        
        if (response.ok) {
            alert('Tarif o\'zgartirildi! Sahifani yangilang (refresh).');
            closeChangeTariffModal();
            loadTariffInfo();
            
            // If changed to BIZNES, redirect to business page
            if (newTariff === 'BIZNES' || newTariff === 'BUSINESS') {
                setTimeout(() => {
                    window.location.href = '/business';
                }, 1000);
            }
        } else {
            alert('Xatolik yuz berdi!');
        }
    } catch (error) {
        console.error('Tarifni o\'zgartirishda xato:', error);
        alert('Xatolik yuz berdi!');
    }
}

// Helper function
function getInitData() {
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
        return window.Telegram.WebApp.initData;
    }
    return '';
}

// Load tariff info on profile page load
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on profile page
    const profilePage = document.getElementById('pageProfile');
    if (profilePage) {
        setTimeout(() => loadTariffInfo(), 100);
    }
});

// Open Business App with initData
function openBusinessApp() {
    const initData = getInitData();
    if (initData) {
        window.location.href = `/business?initData=${encodeURIComponent(initData)}`;
    } else {
        window.location.href = '/business';
    }
}

// Make it globally accessible
window.openBusinessApp = openBusinessApp;
