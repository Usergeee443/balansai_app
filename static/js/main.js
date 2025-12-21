/**
 * Balans AI - Main JavaScript
 * Telegram Mini App moliyaviy boshqaruv tizimi
 */

// ============================================
// GLOBAL O'ZGARUVCHILAR
// ============================================

const tg = window.Telegram?.WebApp || null;
let currentUser = null;
let currentPage = 'home';
let loadedPages = new Set(['home', 'transactions']);
let statsChart = null;

// ============================================
// TELEGRAM WEB APP
// ============================================

if (tg) {
    tg.ready();
    // Doim fullscreen qilish
    tg.expand();
    tg.enableClosingConfirmation();
    tg.setHeaderColor('#5A8EF4');
    tg.setBackgroundColor('#f5f5f5');
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function hapticFeedback(type = 'light') {
    if (tg && tg.HapticFeedback) {
        if (type === 'light') tg.HapticFeedback.impactOccurred('light');
        else if (type === 'medium') tg.HapticFeedback.impactOccurred('medium');
        else if (type === 'success') tg.HapticFeedback.notificationOccurred('success');
        else if (type === 'error') tg.HapticFeedback.notificationOccurred('error');
    }
}

function formatCurrency(amount, currency = 'UZS') {
    const num = parseFloat(amount) || 0;
    const formatted = new Intl.NumberFormat('uz-UZ').format(num);
    return currency === 'UZS' ? `${formatted} so'm` : formatted;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('uz-UZ', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function showLoading(show) {
    const loader = document.getElementById('loadingScreen');
    if (loader) loader.style.display = show ? 'flex' : 'none';
}

function showPageLoading(containerId, type = 'default') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let skeletonHTML = '';
    
    switch(type) {
        case 'transactions':
            skeletonHTML = getTransactionsSkeleton();
            break;
        case 'statistics':
            skeletonHTML = getStatisticsSkeleton();
            break;
        case 'reminders':
            skeletonHTML = getRemindersSkeleton();
            break;
        case 'debts':
            skeletonHTML = getDebtsSkeleton();
            break;
        default:
            skeletonHTML = `
                <div class="page-loading">
                    <div class="spinner-small"></div>
                    <p style="margin-top: 16px; color: #999; font-size: 14px; text-align: center;">Yuklanmoqda...</p>
                </div>
            `;
    }
    
    container.innerHTML = skeletonHTML;
}

function getTransactionsSkeleton() {
    return `
        <div class="transaction-group">
            <div class="skeleton skeleton-title"></div>
            ${Array(5).fill(0).map(() => `
                <div class="skeleton-transaction">
                    <div class="skeleton skeleton-transaction-icon"></div>
                    <div class="skeleton-transaction-content">
                        <div class="skeleton skeleton-text skeleton-transaction-amount"></div>
                        <div class="skeleton skeleton-text skeleton-transaction-desc"></div>
                        <div class="skeleton skeleton-text skeleton-transaction-meta"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function getStatisticsSkeleton() {
    return `
        <div class="stats-card" style="margin-bottom: 16px;">
            <div class="skeleton skeleton-title" style="margin-bottom: 12px;"></div>
            <div class="skeleton skeleton-chart"></div>
        </div>
        <div class="stats-card" style="margin-bottom: 16px;">
            <div class="skeleton skeleton-title" style="margin-bottom: 12px;"></div>
            ${Array(5).fill(0).map(() => `
                <div class="skeleton-category-item">
                    <div class="skeleton skeleton-category-name"></div>
                    <div class="skeleton skeleton-category-amount"></div>
                </div>
            `).join('')}
        </div>
        <div class="stats-card">
            <div class="skeleton skeleton-title" style="margin-bottom: 12px;"></div>
            <div class="skeleton skeleton-chart" style="height: 250px;"></div>
        </div>
    `;
}

function getRemindersSkeleton() {
    return Array(3).fill(0).map(() => `
        <div class="skeleton-reminder-card">
            <div class="skeleton-reminder-header">
                <div class="skeleton skeleton-reminder-title"></div>
                <div class="skeleton skeleton-reminder-checkbox"></div>
            </div>
            <div class="skeleton skeleton-reminder-amount"></div>
            <div class="skeleton skeleton-reminder-date"></div>
            <div class="skeleton skeleton-text short" style="margin-top: 8px;"></div>
        </div>
    `).join('');
}

function getDebtsSkeleton() {
    return Array(3).fill(0).map(() => `
        <div class="skeleton-debt-card">
            <div class="skeleton skeleton-text medium" style="height: 18px; margin-bottom: 12px;"></div>
            <div class="skeleton skeleton-text long" style="height: 22px; margin-bottom: 12px;"></div>
            <div class="skeleton skeleton-text short" style="height: 14px; margin-bottom: 8px;"></div>
            <div class="skeleton skeleton-text short" style="width: 80px; height: 24px; border-radius: 12px;"></div>
        </div>
    `).join('');
}

function getHomeSkeleton() {
    return {
        transactions: Array(3).fill(0).map(() => `
            <div class="transaction-card">
                <div class="skeleton skeleton-text" style="height: 18px; width: 120px; margin-bottom: 8px;"></div>
                <div class="skeleton skeleton-text" style="height: 14px; width: 80%; margin-bottom: 4px;"></div>
                <div class="skeleton skeleton-text" style="height: 12px; width: 60%;"></div>
            </div>
        `).join(''),
        chart: `
            <div class="skeleton skeleton-chart" style="height: 180px;"></div>
        `
    };
}

// ============================================
// API FUNCTIONS
// ============================================

function getInitData() {
    if (tg && tg.initData) return tg.initData;
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
                'X-Telegram-Init-Data': initData,
                ...options.headers
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Xatolik yuz berdi');
        }
        
        return await response.json();
    } catch (error) {
        console.error('API xatosi:', error);
        throw error;
    }
}

// ============================================
// USER DATA
// ============================================

async function loadUserData() {
    try {
        const user = await apiRequest('/api/user');
        currentUser = user;
        
        // Tarif tekshiruvi
        const allowed = ['PLUS', 'PRO', 'FAMILY', 'FAMILY_PLUS', 'FAMILY_PRO'];
        if (!allowed.includes(user.tariff)) {
            alert('Sizning tarifingiz bu ilova uchun mos emas');
            return false;
        }
        
        // Balansni ko'rsatish
        const balanceEl = document.getElementById('totalBalance');
        if (balanceEl) {
            balanceEl.textContent = formatCurrency(user.balance || 0);
        }
        
        return true;
    } catch (error) {
        console.error('User yuklanmadi:', error);
        return false;
    }
}

// ============================================
// HOME PAGE SKELETON
// ============================================

function showHomePageSkeleton() {
    // Balance skeleton
    const balanceEl = document.getElementById('totalBalance');
    if (balanceEl) {
        balanceEl.innerHTML = '<div class="skeleton skeleton-text" style="height: 20px; width: 150px; display: inline-block;"></div>';
    }
    
    // Currency list skeleton
    const currencyContainer = document.getElementById('currencyList');
    if (currencyContainer) {
        currencyContainer.innerHTML = Array(5).fill(0).map(() => `
            <div class="currency-item">
                <div class="currency-icon">
                    <div class="skeleton skeleton-circle"></div>
                </div>
                <div class="skeleton skeleton-text" style="height: 18px; width: 120px;"></div>
            </div>
        `).join('');
    }
    
    // Transactions skeleton (agar container bo'sh bo'lsa)
    const transactionsContainer = document.getElementById('transactionsList');
    if (transactionsContainer && !transactionsContainer.innerHTML.trim()) {
        const homeSkeleton = getHomeSkeleton();
        transactionsContainer.innerHTML = homeSkeleton.transactions;
    }
    
    // Statistics skeleton
    const statsCanvas = document.getElementById('statsChart');
    if (statsCanvas && statsCanvas.parentElement) {
        const canvasContainer = statsCanvas.parentElement;
        // Canvas elementni saqlab qolish, skeleton qo'shish
        if (!canvasContainer.querySelector('.skeleton-chart')) {
            const homeSkeleton = getHomeSkeleton();
            statsCanvas.style.display = 'none';
            canvasContainer.insertAdjacentHTML('beforeend', homeSkeleton.chart);
        }
    }
}

// ============================================
// CURRENCIES
// ============================================

function renderCurrencies(balances) {
    const container = document.getElementById('currencyList');
    if (!container) return;
    
    const currencies = [
        { code: 'USD', icon: '$', class: 'currency-symbol-usd' },
        { code: 'RUB', icon: '₽', class: 'currency-symbol-rub' },
        { code: 'EUR', icon: '€', class: 'currency-symbol-eur' },
        { code: 'TRY', icon: '₺', class: 'currency-symbol-try' },
        { code: 'UZS', icon: null, class: null }
    ];
    
    let html = '';
    
    currencies.forEach(curr => {
        const balance = balances[curr.code] || 0;
        if (balance !== 0 || curr.code === 'UZS') {
            const iconHtml = curr.icon 
                ? `<span class="currency-symbol ${curr.class}">${curr.icon}</span>`
                : `<div class="currency-badge">UZS</div>`;
            
            html += `
                <div class="currency-item">
                    <div class="currency-icon">${iconHtml}</div>
                    <div class="currency-amount">${formatCurrency(balance, curr.code)}</div>
                </div>
            `;
        }
    });
    
    container.innerHTML = html || '<div class="empty-state">Ma\'lumot yo\'q</div>';
}

// ============================================
// TRANSACTIONS
// ============================================

async function loadTransactions() {
    const container = document.getElementById('transactionsList');
    if (!container) return;
    
    // Skeleton loading ko'rsatish (agar bo'sh bo'lsa)
    if (!container.innerHTML.trim() || container.innerHTML.includes('skeleton')) {
        const homeSkeleton = getHomeSkeleton();
        container.innerHTML = homeSkeleton.transactions;
    }
    
    try {
        const transactions = await apiRequest('/api/transactions?limit=20');
        
        if (!transactions || transactions.length === 0) {
            container.innerHTML = `
                <div class="transaction-card">
                    <div class="empty-state">Tranzaksiyalar mavjud emas</div>
                </div>`;
            return;
        }
        
        container.innerHTML = transactions.map(t => {
            const isIncome = t.transaction_type === 'income';
            const amountClass = isIncome ? 'income' : 'expense';
            const sign = isIncome ? '+' : '-';
            
            const date = new Date(t.created_at);
            const today = new Date();
            const isToday = date.toDateString() === today.toDateString();
            const time = date.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
            const dateStr = isToday ? `Bugun ${time} da` : formatDate(t.created_at);
            
            return `
                <div class="transaction-card">
                    <div class="transaction-amount ${amountClass}">
                        ${sign} ${formatCurrency(t.amount, t.currency)}
                    </div>
                    <div class="transaction-title">${t.description || 'Tranzaksiya'}</div>
                    <div class="transaction-meta">${t.category || ''}${t.category ? ' • ' : ''}${dateStr}</div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Tranzaksiyalar yuklanmadi:', error);
    }
}

// ============================================
// STATISTICS
// ============================================

async function loadStatistics() {
    // Canvas elementini topish (skeleton ichida yashiringan bo'lishi mumkin)
    let ctx = document.getElementById('statsChart');
    const canvasContainer = ctx?.parentElement;
    
    try {
        const trend = await apiRequest('/api/statistics/income-trend?period=auto');
        
        // Agar canvas topilmasa
        if (!ctx || !canvasContainer) return;
        
        // Skeleton ni olib tashlash va canvas ni ko'rsatish
        const skeletonEl = canvasContainer.querySelector('.skeleton-chart');
        if (skeletonEl) {
            skeletonEl.remove();
            ctx.style.display = 'block';
        }
        
        let labels = trend.labels || ['Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
        let data = trend.data || [111, 135, 160, 180, 170];
        
        // Format labels
        if (trend.labels && trend.labels.length > 0) {
            labels = trend.labels.map(label => {
                if (trend.period === 'day') {
                    const d = new Date(label);
                    return d.toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' });
                } else if (trend.period === 'month') {
                    const [year, month] = label.split('-');
                    const d = new Date(year, month - 1);
                    return d.toLocaleDateString('uz-UZ', { month: 'short' });
                }
                return label;
            });
        }
        
        if (statsChart) statsChart.destroy();
        
        statsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    borderColor: '#5A8EF4',
                    backgroundColor: (context) => {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                        gradient.addColorStop(0, 'rgba(90, 142, 244, 0.3)');
                        gradient.addColorStop(1, 'rgba(90, 142, 244, 0.05)');
                        return gradient;
                    },
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#5A8EF4',
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'white',
                        titleColor: '#333',
                        bodyColor: '#5A8EF4',
                        borderColor: '#e5e5e5',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        position: 'right',
                        grid: { color: '#f5f5f5' },
                        ticks: { font: { size: 11 }, color: '#999' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 11 }, color: '#999' }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Statistika yuklanmadi:', error);
    }
}

// ============================================
// NAVIGATION
// ============================================

function navigateTo(pageName) {
    hapticFeedback('light');
    
    if (currentPage === pageName) return;
    
    // Hide current page
    const oldPage = document.getElementById(`page${currentPage.charAt(0).toUpperCase() + currentPage.slice(1)}`);
    if (oldPage) oldPage.classList.remove('active');
    
    // Show new page
    const newPage = document.getElementById(`page${pageName.charAt(0).toUpperCase() + pageName.slice(1)}`);
    if (newPage) newPage.classList.add('active');
    
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-page') === pageName) {
            item.classList.add('active');
        }
    });
    
    currentPage = pageName;
    
    // Load page data if needed
    if (!loadedPages.has(pageName)) {
        loadedPages.add(pageName);
        loadPageData(pageName);
    }
}

async function loadPageData(pageName) {
    try {
        switch(pageName) {
            case 'transactions':
                // Data allaqachon yuklangan, faqat render qilish
                const searchQuery = document.getElementById('transactionSearch')?.value || '';
                await loadAllTransactions(currentTransactionFilter, searchQuery, false);
                break;
            case 'statistics':
                await loadAllStatistics();
                break;
            case 'reminders':
                await loadReminders();
                break;
            case 'debts':
                await loadDebts(currentDebtFilter);
                break;
        }
    } catch (error) {
        console.error(`Error loading ${pageName}:`, error);
    }
}

function showBalanceDetails() {
    hapticFeedback('light');
    // Placeholder for modal
    console.log('Show balance details');
}

// ============================================
// ALL TRANSACTIONS PAGE
// ============================================

let currentTransactionFilter = 'all';
let allTransactionsData = [];

async function loadAllTransactions(filter = 'all', searchQuery = '', showLoadingState = true) {
    const container = document.getElementById('allTransactionsList');
    if (!container) return;
    
    try {
        // Loading ko'rsatish (faqat sahifaga kirganda)
        if (showLoadingState && allTransactionsData.length === 0) {
            showPageLoading('allTransactionsList', 'transactions');
        }
        
        // Agar data yuklanmagan bo'lsa, API dan olish
        if (allTransactionsData.length === 0) {
            allTransactionsData = await apiRequest('/api/transactions?limit=500');
        }
        
        let filtered = allTransactionsData;
        
        // Filter by type
        if (filter !== 'all') {
            if (filter === 'debt_given' || filter === 'debt_taken') {
                // Qarzlar uchun alohida logic (kelgusida API dan olish mumkin)
                filtered = [];
            } else {
                filtered = filtered.filter(t => t.transaction_type === filter);
            }
        }
        
        // Search
        if (searchQuery) {
            filtered = filtered.filter(t => 
                (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (t.category && t.category.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        }
        
        if (!filtered || filtered.length === 0) {
            container.innerHTML = '<div class="empty-state">Tranzaksiyalar topilmadi</div>';
            return;
        }
        
        // Group by date
        const grouped = groupTransactionsByDate(filtered);
        
        container.innerHTML = Object.keys(grouped).map(dateKey => {
            const transactions = grouped[dateKey];
            return `
                <div class="transaction-group">
                    <div class="transaction-group-title">${dateKey}</div>
                    ${transactions.map(t => renderTransactionItem(t)).join('')}
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Tranzaksiyalar yuklanmadi:', error);
        if (container) container.innerHTML = '<div class="empty-state">Xatolik yuz berdi</div>';
    }
}

function groupTransactionsByDate(transactions) {
    const groups = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    transactions.forEach(t => {
        const date = new Date(t.created_at);
        date.setHours(0, 0, 0, 0);
        
        let key;
        if (date.getTime() === today.getTime()) {
            key = 'Bugun';
        } else if (date.getTime() === yesterday.getTime()) {
            key = 'Kecha';
        } else {
            key = new Date(t.created_at).toLocaleDateString('uz-UZ', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
        
        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
    });
    
    return groups;
}

function renderTransactionItem(t) {
    const isIncome = t.transaction_type === 'income';
    const typeClass = isIncome ? 'income' : 'expense';
    const sign = isIncome ? '+' : '-';
    
    const date = new Date(t.created_at);
    const time = date.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
    
    // Icon emoji based on category or type
    const icon = getTransactionIcon(t.category, isIncome);
    
    return `
        <div class="transaction-item">
            <div class="transaction-icon ${typeClass}">
                ${icon}
            </div>
            <div class="transaction-info">
                <div class="transaction-info-top">
                    <span class="transaction-amount-inline ${typeClass}">
                        ${sign} ${formatCurrency(t.amount, t.currency)}
                    </span>
                    <span class="transaction-time">${time}</span>
                </div>
                <div class="transaction-info-bottom">
                    <span class="transaction-desc">${t.description || 'Tranzaksiya'}</span>
                    ${t.category ? `<span class="transaction-category-inline"> • ${t.category}</span>` : ''}
                </div>
            </div>
        </div>
    `;
}

function getTransactionIcon(category, isIncome) {
    if (isIncome) return '💰';
    
    const iconMap = {
        'Transport': '🚗',
        'Food': '🍽️',
        'Shopping': '🛍️',
        'Health': '🏥',
        'Entertainment': '🎮',
        'Education': '📚',
        'Bills': '💡',
        'Qarz': '📋',
        'Maosh': '💰',
        'Oylik': '💰',
        'default': '💳'
    };
    
    return iconMap[category] || iconMap['default'];
}

// ============================================
// STATISTICS PAGE
// ============================================

let incomeTrendChart = null;
let expensePieChart = null;

async function loadAllStatistics() {
    const container = document.getElementById('statisticsContent');
    if (!container) return;
    
    try {
        // Loading ko'rsatish
        showPageLoading('statisticsContent', 'statistics');
        
        // Chart elementlarini yaratish (loading dan keyin)
        container.innerHTML = `
            <div class="stats-card" style="margin-bottom: 16px;">
                <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #1a1a1a;">Daromad dinamikasi</h3>
                <canvas id="incomeTrendChart" class="stats-canvas"></canvas>
            </div>
            <div class="stats-card" style="margin-bottom: 16px;">
                <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #1a1a1a;">Eng ko'p xarajat</h3>
                <div id="topCategoriesList"></div>
            </div>
            <div class="stats-card">
                <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #1a1a1a;">Xarajat taqsimoti</h3>
                <canvas id="expensePieChart" class="stats-canvas"></canvas>
            </div>
        `;
        
        await Promise.all([
            loadIncomeTrendChart(),
            loadTopCategories(),
            loadExpensePieChart()
        ]);
    } catch (error) {
        console.error('Statistika yuklanmadi:', error);
        container.innerHTML = '<div class="empty-state">Xatolik yuz berdi</div>';
    }
}

async function loadIncomeTrendChart() {
    try {
        const trend = await apiRequest('/api/statistics/income-trend?period=auto');
        const ctx = document.getElementById('incomeTrendChart');
        if (!ctx) return;
        
        let labels = trend.labels || [];
        let data = trend.data || [];
        
        if (trend.labels && trend.labels.length > 0) {
            labels = trend.labels.map(label => {
                if (trend.period === 'day') {
                    const d = new Date(label);
                    return d.toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' });
                } else if (trend.period === 'month') {
                    const [year, month] = label.split('-');
                    const d = new Date(year, month - 1);
                    return d.toLocaleDateString('uz-UZ', { year: 'numeric', month: 'short' });
                }
                return label;
            });
        }
        
        if (incomeTrendChart) incomeTrendChart.destroy();
        
        incomeTrendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Daromad',
                    data: data,
                    borderColor: '#10b981',
                    backgroundColor: (context) => {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
                        gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
                        return gradient;
                    },
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'white',
                        titleColor: '#333',
                        bodyColor: '#10b981',
                        borderColor: '#e5e5e5',
                        borderWidth: 1,
                        padding: 10
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#f5f5f5' },
                        ticks: { font: { size: 11 }, color: '#999' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 11 }, color: '#999' }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Income trend yuklanmadi:', error);
    }
}

async function loadTopCategories() {
    try {
        const categories = await apiRequest('/api/statistics/top-categories?limit=5&days=30');
        const container = document.getElementById('topCategoriesList');
        if (!container) return;
        
        if (!categories || categories.length === 0) {
            container.innerHTML = '<div class="empty-state">Ma\'lumot yo\'q</div>';
            return;
        }
        
        container.innerHTML = categories.map(cat => `
            <div class="category-item">
                <span class="category-name">${cat.category}</span>
                <span class="category-amount">${formatCurrency(cat.amount, 'UZS')}</span>
            </div>
        `).join('');
    } catch (error) {
        console.error('Top categories yuklanmadi:', error);
    }
}

async function loadExpensePieChart() {
    try {
        const expenses = await apiRequest('/api/statistics/expense-by-category?days=30');
        const ctx = document.getElementById('expensePieChart');
        if (!ctx) return;
        
        const labels = Object.keys(expenses);
        const data = Object.values(expenses);
        
        if (labels.length === 0) {
            return;
        }
        
        if (expensePieChart) expensePieChart.destroy();
        
        const colors = [
            '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
            '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9'
        ];
        
        expensePieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: { size: 12 },
                            color: '#666'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'white',
                        titleColor: '#333',
                        bodyColor: '#666',
                        borderColor: '#e5e5e5',
                        borderWidth: 1,
                        padding: 10
                    }
                }
            }
        });
    } catch (error) {
        console.error('Expense pie chart yuklanmadi:', error);
    }
}

// ============================================
// REMINDERS PAGE
// ============================================

let remindersData = [];

async function loadReminders() {
    const container = document.getElementById('remindersList');
    try {
        // Loading ko'rsatish
        showPageLoading('remindersList', 'reminders');
        
        remindersData = await apiRequest('/api/reminders');
        renderReminders();
    } catch (error) {
        console.error('Eslatmalar yuklanmadi:', error);
        if (container) container.innerHTML = '<div class="empty-state">Xatolik yuz berdi</div>';
    }
}

function renderReminders() {
    const container = document.getElementById('remindersList');
    if (!container) return;
    
    if (!remindersData || remindersData.length === 0) {
        container.innerHTML = '<div class="empty-state">Eslatmalar yo\'q<br><small style="color: #ccc; margin-top: 8px;">Yuqoridagi + tugmasini bosing</small></div>';
        return;
    }
    
    container.innerHTML = remindersData.map(r => {
        const date = new Date(r.reminder_date);
        const dateStr = date.toLocaleDateString('uz-UZ', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const repeatMap = {
            'none': 'Takrorlanmaydi',
            'daily': 'Har kuni',
            'weekly': 'Har hafta',
            'monthly': 'Har oy',
            'yearly': 'Har yil'
        };
        
        const isCompleted = r.is_completed || false;
        
        return `
            <div class="reminder-card ${isCompleted ? 'completed' : ''}" data-id="${r.id}">
                <div class="reminder-header">
                    <div class="reminder-title">${r.title || 'Eslatma'}</div>
                    <div class="reminder-checkbox ${isCompleted ? 'checked' : ''}" onclick="toggleReminder(${r.id}, ${!isCompleted})">
                        ${isCompleted ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5L20 7"/></svg>' : ''}
                    </div>
                </div>
                <div class="reminder-amount">${formatCurrency(r.amount, r.currency)}</div>
                <div class="reminder-date">📅 ${dateStr}</div>
                <div class="reminder-repeat">🔄 ${repeatMap[r.repeat_interval] || 'Takrorlanmaydi'}</div>
            </div>
        `;
    }).join('');
}

function showAddReminderModal() {
    hapticFeedback('light');
    const modal = document.getElementById('addReminderModal');
    if (modal) {
        modal.classList.add('active');
        // Set default date to today
        const dateInput = modal.querySelector('input[name="reminder_date"]');
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.value = today;
        }
    }
}

function closeAddReminderModal() {
    hapticFeedback('light');
    const modal = document.getElementById('addReminderModal');
    if (modal) {
        modal.classList.remove('active');
        document.getElementById('addReminderForm').reset();
    }
}

async function handleAddReminder(event) {
    event.preventDefault();
    hapticFeedback('medium');
    
    const form = event.target;
    const formData = new FormData(form);
    const data = {
        title: formData.get('title'),
        amount: parseFloat(formData.get('amount')),
        currency: formData.get('currency'),
        reminder_date: formData.get('reminder_date'),
        repeat_interval: formData.get('repeat_interval')
    };
    
    try {
        // NOTE: Backend da POST /api/reminders endpoint qo'shish kerak
        await apiRequest('/api/reminders', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        
        hapticFeedback('success');
        closeAddReminderModal();
        await loadReminders();
    } catch (error) {
        hapticFeedback('error');
        alert('Xatolik yuz berdi: ' + error.message);
    }
}

async function toggleReminder(id, completed) {
    hapticFeedback('light');
    
    try {
        // NOTE: Backend da PATCH /api/reminders/:id endpoint qo'shish kerak
        await apiRequest(`/api/reminders/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ is_completed: completed })
        });
        
        // Update local data
        const reminder = remindersData.find(r => r.id === id);
        if (reminder) {
            reminder.is_completed = completed;
            renderReminders();
        }
        
        hapticFeedback('success');
    } catch (error) {
        console.error('Eslatma yangilanmadi:', error);
        hapticFeedback('error');
    }
}

// ============================================
// DEBTS PAGE
// ============================================

let currentDebtFilter = 'all';

async function loadDebts(filter = 'all') {
    const container = document.getElementById('debtsList');
    if (!container) return;
    
    try {
        // Loading ko'rsatish
        showPageLoading('debtsList', 'debts');
        
        const debts = await apiRequest('/api/debts');
        
        let filtered = debts;
        if (filter !== 'all') {
            filtered = debts.filter(d => d.debt_type === filter);
        }
        
        if (!filtered || filtered.length === 0) {
            container.innerHTML = '<div class="empty-state">Qarzlar yo\'q</div>';
            return;
        }
        
        container.innerHTML = filtered.map(d => {
            const isGiven = d.debt_type === 'given';
            const amountClass = isGiven ? 'given' : 'taken';
            const sign = isGiven ? '-' : '+';
            
            const date = new Date(d.created_at);
            const dateStr = date.toLocaleDateString('uz-UZ', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            return `
                <div class="debt-card ${amountClass}">
                    <div class="debt-person">${d.person_name}</div>
                    <div class="debt-amount ${amountClass}">
                        ${sign} ${formatCurrency(d.amount, d.currency)}
                    </div>
                    <div class="debt-date">${dateStr}</div>
                    <span class="debt-type-badge ${amountClass}">
                        ${isGiven ? 'Berdim' : 'Oldim'}
                    </span>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Qarzlar yuklanmadi:', error);
        const container = document.getElementById('debtsList');
        if (container) container.innerHTML = '<div class="empty-state">Xatolik yuz berdi</div>';
    }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Ilova darhol ochilsin, skeleton loading bilan
    // Home page skeleton ko'rsatish
    showHomePageSkeleton();
    
    // Background'da data yuklash (non-blocking)
    (async () => {
        try {
            const userLoaded = await loadUserData();
            if (!userLoaded) {
                return;
            }
            
            // Load home page data
            if (currentUser && currentUser.currency_balances) {
                renderCurrencies(currentUser.currency_balances);
            }
            
            // Barcha ma'lumotlarni parallel yuklash
            await Promise.all([
                loadTransactions(),
                loadStatistics(),
                loadAllTransactions('all', '', false) // Tranzaksiyalar sahifasi uchun
            ]);
        } catch (error) {
            console.error('Initialization error:', error);
        }
    })();
    
    // Setup navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.getAttribute('data-page');
            navigateTo(page);
        });
    });
    
    // Setup filters
    setupFilters();
    
    // Setup search
    setupSearch();
});

// ============================================
// FILTERS
// ============================================

function setupFilters() {
    // Transactions filter
    document.querySelectorAll('#pageTransactions .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            hapticFeedback('light');
            const filter = btn.getAttribute('data-filter');
            
            // Update active state
            document.querySelectorAll('#pageTransactions .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Load filtered data
            currentTransactionFilter = filter;
            const searchQuery = document.getElementById('transactionSearch')?.value || '';
            loadAllTransactions(filter, searchQuery, false); // Loading ko'rsatma, chunki data allaqachon bor
        });
    });
    
    // Debts filter
    document.querySelectorAll('#pageDebts .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            hapticFeedback('light');
            const filter = btn.getAttribute('data-filter');
            
            // Update active state
            document.querySelectorAll('#pageDebts .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Load filtered data
            currentDebtFilter = filter;
            loadDebts(filter);
        });
    });
}

// ============================================
// SEARCH
// ============================================

function setupSearch() {
    const searchInput = document.getElementById('transactionSearch');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const query = e.target.value;
                loadAllTransactions(currentTransactionFilter, query, false); // Loading ko'rsatma
            }, 300);
        });
    }
}
