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
    
    // 1. Doim fullscreen qilish (yarim va to'liq formatlardan fullscreen'ga o'tkazish)
    function ensureFullscreen() {
        if (!tg.isExpanded) {
    tg.expand();
        }
    }
    
    // Dastlabki fullscreen
    ensureFullscreen();
    
    // Viewport balandligini sozlash (fullscreen uchun)
    if (tg.viewportStableHeight !== undefined) {
        tg.viewportStableHeight = window.innerHeight;
    }
    
    // 2. Pull-to-close'ni bloklash (surib chiqib ketishni oldini olish)
    if (tg.disableVerticalSwipes) {
        tg.disableVerticalSwipes();
    }
    
    // BackButton'ni yashirish (faqat X tugmasi qoladi)
    if (tg.BackButton) {
        tg.BackButton.hide();
    }
    
    // Chiqishni tasdiqlash (allaqachon bor, lekin qayta ta'minlash)
    tg.enableClosingConfirmation();
    
    // Header va background ranglari
    tg.setHeaderColor('#5A8EF4');
    tg.setBackgroundColor('#f5f5f5');
    
    // Viewport o'zgarganda fullscreen'ni saqlash
    window.addEventListener('resize', () => {
        ensureFullscreen();
    });
    
    // Scroll event'ida ham tekshirish (viewport o'zgarganda)
    let scrollCheckTimeout;
    window.addEventListener('scroll', () => {
        clearTimeout(scrollCheckTimeout);
        scrollCheckTimeout = setTimeout(() => {
            ensureFullscreen();
        }, 100);
    });
    
    // Ilova ochilganda fullscreen'ni ta'minlash
    window.addEventListener('load', () => {
        setTimeout(() => {
            ensureFullscreen();
        }, 100);
    });
    
    // DOMContentLoaded'da ham tekshirish
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                ensureFullscreen();
            }, 50);
        });
    } else {
        setTimeout(() => {
            ensureFullscreen();
        }, 50);
    }
    
    // Periodic check (viewport o'zgarishi uchun)
    setInterval(() => {
        ensureFullscreen();
    }, 500);
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
    
    console.log(`[API] Request: ${url}`, { 
        initData: initData ? 'mavjud' : 'yo\'q', 
        testUserId,
        method: options.method || 'GET'
    });
    
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': initData || '',
                ...options.headers
            }
        });
        
        console.log(`[API] Response status: ${response.status}`, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[API] Error response:', errorText);
            
            let error;
            try {
                error = JSON.parse(errorText);
            } catch (e) {
                error = { error: errorText || 'Xatolik yuz berdi' };
            }
            
            console.error('[API] Error object:', error, 'Status:', response.status);
            
            // User not found xatoligini alohida handle qilish
            if (response.status === 404 && (error.error === 'User not found' || error.code === 'USER_NOT_FOUND')) {
                const customError = new Error(error.error || 'User not found');
                customError.code = 'USER_NOT_FOUND';
                customError.status = 404;
                throw customError;
            }
            
            throw new Error(error.error || error.message || 'Xatolik yuz berdi');
        }
        
        const data = await response.json();
        console.log(`[API] Success: ${url}`, data);
        return data;
    } catch (error) {
        console.error('[API] Exception:', error);
        console.error('[API] Error details:', {
            message: error.message,
            stack: error.stack,
            endpoint: url,
            name: error.name
        });
        throw error;
    }
}

// ============================================
// USER DATA
// ============================================

async function loadUserData() {
    try {
        console.log('API request /api/user ga yuborilmoqda...');
        const user = await apiRequest('/api/user');
        console.log('User data olindi:', user);
        currentUser = user;
        
        // Tarif tekshiruvi (yumshoq - faqat ogohlantirish)
        const allowed = ['PLUS', 'PRO', 'FAMILY', 'FAMILY_PLUS', 'FAMILY_PRO', 'FREE', 'BUSINESS', 'BUSINESS_PLUS', 'BUSINESS_PRO'];
        if (!allowed.includes(user.tariff)) {
            console.warn('Tarif mos emas:', user.tariff);
            // Faqat ogohlantirish, lekin ma'lumotlarni yuklash davom etadi
            // alert('Sizning tarifingiz bu ilova uchun mos emas');
        }
        
        // Balansni ko'rsatish (eski va yangi UI ham)
        const balanceEl = document.getElementById('totalBalance');
        if (balanceEl) {
            balanceEl.textContent = formatCurrency(user.balance || 0);
            console.log('Balance ko\'rsatildi:', user.balance);
        }

        // Hero balance (yangi dizayn)
        const heroBalanceEl = document.getElementById('heroTotalBalance');
        if (heroBalanceEl) {
            heroBalanceEl.textContent = formatCurrency(user.balance || 0);
        }

        // Load quick stats for home page
        await loadQuickStats();

        // Load recent transactions for home page (5 items)
        await loadHomeTransactions();

        return true;
    } catch (error) {
        console.error('User yuklanmadi:', error);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        
        // Agar user topilmasa (404), ro'yxatdan o'tmagan sahifani ko'rsatish
        if (error.message && (error.message.includes('User not found') || error.message.includes('404') || error.code === 'USER_NOT_FOUND')) {
            console.log('User topilmadi, modal ko\'rsatilmoqda');
            showNotRegisteredModal();
        return false;
        }
        
        return false;
    }
}

function showNotRegisteredModal() {
    const modal = document.getElementById('notRegisteredModal');
    if (modal) {
        modal.classList.add('active');
        // Barcha sahifalarni yashirish
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        // Bottom navigation'ni yashirish
        const bottomNav = document.querySelector('.bottom-nav');
        if (bottomNav) bottomNav.style.display = 'none';
    }
}

async function openTelegramBot() {
    hapticFeedback('medium');
    
    // Bot username'ni config'dan olish
    let botUsername = 'BalansAiBot'; // Default
    try {
        const config = await apiRequest('/api/config');
        if (config && config.bot_username) {
            botUsername = config.bot_username;
        }
    } catch (error) {
        console.log('Config olinmadi, default ishlatilmoqda');
    }
    
    // Telegram bot'ga o'tish
    if (tg && tg.openTelegramLink) {
        tg.openTelegramLink(`https://t.me/${botUsername}`);
    } else {
        // Agar Telegram WebApp bo'lmasa, oddiy link
        window.open(`https://t.me/${botUsername}`, '_blank');
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
    
    // Faqat 0 dan katta balanslarni sanash
    const activeCurrencies = currencies.filter(curr => {
        const balance = balances[curr.code] || 0;
        return balance > 0 || curr.code === 'UZS';
    });
    
    // Agar faqat 1 ta valyuta bo'lsa, ko'rsatmaslik
    if (activeCurrencies.length <= 1) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }
    
    // Ko'rsatish
    container.style.display = 'block';
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

// Lazy loading uchun o'zgaruvchilar
let transactionsPage = 0;
let transactionsLoading = false;
let transactionsHasMore = true;
let todayTransactions = [];
let yesterdayTransactions = [];
let otherTransactions = [];
let loadedOtherTransactions = false;

async function loadMoreTransactions() {
    if (transactionsLoading || loadedOtherTransactions) return;
    
    transactionsLoading = true;
    const container = document.getElementById('transactionsList');
    const loadMoreBtn = document.getElementById('loadMoreTransactions');
    
    if (loadMoreBtn) {
        loadMoreBtn.innerHTML = '<div style="padding: 8px;">Yuklanmoqda...</div>';
    }
    
    try {
        // Qolgan tranzaksiyalarni API dan olish (offset bilan)
        const offset = todayTransactions.length + yesterdayTransactions.length;
        const moreTransactions = await apiRequest(`/api/transactions?limit=50&offset=${offset}`);
        
        if (moreTransactions && moreTransactions.length > 0) {
            // Bugun va kecha bo'lmagan tranzaksiyalarni ajratish
            const todayDate = new Date();
            todayDate.setHours(0, 0, 0, 0);
            const yesterdayDate = new Date(todayDate);
            yesterdayDate.setDate(yesterdayDate.getDate() - 1);
            
            const filtered = moreTransactions.filter(t => {
                const tDate = new Date(t.created_at);
                tDate.setHours(0, 0, 0, 0);
                return tDate.getTime() !== todayDate.getTime() && tDate.getTime() !== yesterdayDate.getTime();
            });
            
            if (filtered.length > 0) {
                const grouped = groupTransactionsByDate(filtered);
                let html = '';
                
                Object.keys(grouped).forEach(dateKey => {
                    html += `<div class="transaction-group-title" style="padding: 12px 16px; font-weight: 600; color: #333; background: #f5f5f5; margin: 16px -16px 8px -16px;">${dateKey}</div>`;
                    html += grouped[dateKey].map(t => renderHomeTransaction(t)).join('');
                });
                
                if (loadMoreBtn) {
                    loadMoreBtn.outerHTML = html;
                } else {
                    container.innerHTML += html;
                }
            } else {
                if (loadMoreBtn) {
                    loadMoreBtn.innerHTML = '<div style="padding: 8px; color: #999;">Boshqa tranzaksiyalar yo\'q</div>';
                }
            }
            
            loadedOtherTransactions = true;
        } else {
            if (loadMoreBtn) {
                loadMoreBtn.innerHTML = '<div style="padding: 8px; color: #999;">Boshqa tranzaksiyalar yo\'q</div>';
            }
            loadedOtherTransactions = true;
        }
    } catch (error) {
        console.error('Qolgan tranzaksiyalar yuklanmadi:', error);
        if (loadMoreBtn) {
            loadMoreBtn.innerHTML = '<div style="padding: 8px; color: #ef4444;">Xatolik yuz berdi</div>';
        }
    } finally {
        transactionsLoading = false;
    }
}

// Global scope'da bo'lishi kerak
window.loadMoreTransactions = loadMoreTransactions;

function setupTransactionsScroll() {
    // Scroll listener qo'shish (lazy loading)
    const container = document.getElementById('transactionsList');
    if (!container) return;
    
    let scrollTimeout;
    container.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            const loadMoreBtn = document.getElementById('loadMoreTransactions');
            if (loadMoreBtn && !loadedOtherTransactions) {
                const rect = loadMoreBtn.getBoundingClientRect();
                // Agar button ko'rinadigan bo'lsa, avtomatik yuklash
                if (rect.top < window.innerHeight + 200) {
                    loadMoreTransactions();
                }
            }
        }, 100);
    });
}

async function loadTransactions() {
    const container = document.getElementById('transactionsList');
    if (!container) {
        console.warn('transactionsList container topilmadi');
        return;
    }
    
    // Skeleton loading ko'rsatish (agar bo'sh bo'lsa)
    if (!container.innerHTML.trim() || container.innerHTML.includes('skeleton')) {
        const homeSkeleton = getHomeSkeleton();
        container.innerHTML = homeSkeleton.transactions;
    }
    
    try {
        console.log('Transactions API ga so\'rov yuborilmoqda...');
        
        // Avval bugun va kecha tranzaksiyalarini yuklash
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const yesterdayDate = new Date(todayDate);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        
        // Faqat bugun va kecha tranzaksiyalarini olish (optimallashtirilgan)
        // Faqat oxirgi 2 kun uchun (bugun va kecha) - tezroq yuklash
        // Limit 50 - tezroq yuklash
        const allRecent = await apiRequest('/api/transactions?limit=50&days=2');
        
        if (!allRecent || allRecent.length === 0) {
            container.innerHTML = `
                <div class="transaction-card">
                    <div class="empty-state">Tranzaksiyalar mavjud emas</div>
                </div>`;
            return;
        }
        
        // Bugun va kecha tranzaksiyalarini ajratish
        todayTransactions = [];
        yesterdayTransactions = [];
        otherTransactions = [];
        
        allRecent.forEach(t => {
            const tDate = new Date(t.created_at);
            tDate.setHours(0, 0, 0, 0);
            
            if (tDate.getTime() === todayDate.getTime()) {
                todayTransactions.push(t);
            } else if (tDate.getTime() === yesterdayDate.getTime()) {
                yesterdayTransactions.push(t);
            } else {
                otherTransactions.push(t);
            }
        });
        
        // Faqat bugun va kecha tranzaksiyalarini ko'rsatish
        if (todayTransactions.length === 0 && yesterdayTransactions.length === 0) {
            container.innerHTML = `
                <div class="transaction-card">
                    <div class="empty-state">Tranzaksiyalar mavjud emas</div>
                </div>`;
            return;
        }
        
        // Bugun va kecha guruhlarini ko'rsatish
        let html = '';
        
        if (todayTransactions.length > 0) {
            html += '<div class="transaction-group-title" style="padding: 12px 16px; font-weight: 600; color: #333; background: #f5f5f5; margin: 0 -16px 8px -16px;">Bugun</div>';
            html += todayTransactions.map(t => renderHomeTransaction(t)).join('');
        }
        
        if (yesterdayTransactions.length > 0) {
            html += '<div class="transaction-group-title" style="padding: 12px 16px; font-weight: 600; color: #333; background: #f5f5f5; margin: 16px -16px 8px -16px;">Kecha</div>';
            html += yesterdayTransactions.map(t => renderHomeTransaction(t)).join('');
        }
        
        // Scroll qilganda qolgan tranzaksiyalarni yuklash uchun trigger
        if (otherTransactions.length > 0) {
            html += `
                <div id="loadMoreTransactions" style="padding: 16px; text-align: center; color: #5A8EF4; cursor: pointer;" onclick="loadMoreTransactions()">
                    Qolgan ${otherTransactions.length} ta tranzaksiyani ko'rsatish
                </div>
            `;
        }
        
        container.innerHTML = html;
        
        // Scroll listener qo'shish
        setupTransactionsScroll();
        console.log('Transactions render qilindi');
    } catch (error) {
        console.error('Tranzaksiyalar yuklanmadi:', error);
        console.error('Error details:', error.message);
        if (container) {
            container.innerHTML = '<div class="empty-state">Xatolik yuz berdi</div>';
        }
    }
}

// ============================================
// STATISTICS
// ============================================

async function loadStatistics() {
    // Loading screen'ni ko'rsatish
    showLoading(true);
    
    // Canvas elementini topish (skeleton ichida yashiringan bo'lishi mumkin)
    let ctx = document.getElementById('statsChart');
    const canvasContainer = ctx?.parentElement;
    
    if (!ctx || !canvasContainer) {
        console.warn('Stats chart element topilmadi');
        showLoading(false);
        return;
    }
    
    try {
        console.log('Statistics API ga so\'rov yuborilmoqda...');
        const trend = await apiRequest('/api/statistics/income-trend?period=auto');
        console.log('Statistics olindi:', trend);
        
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
        
        console.log('Chart yaratilmoqda...');
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
        console.log('Chart yaratildi');
        
        // Loading screen'ni yopish
        showLoading(false);
    } catch (error) {
        console.error('Statistika yuklanmadi:', error);
        console.error('Error details:', error.message, error.stack);
        // Xatolik bo'lsa ham loading screen'ni yopish
        showLoading(false);
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
    const pageId = `page${pageName.charAt(0).toUpperCase() + pageName.slice(1)}`;
    const newPage = document.getElementById(pageId);
    if (newPage) {
        newPage.classList.add('active');
    } else {
        console.error(`Page not found: ${pageId}`);
    }

    // Update both old nav-item and new nav-tab classes for backward compatibility
    document.querySelectorAll('.nav-item, .nav-tab').forEach(item => {
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
                await loadContacts();
                break;
            case 'balanceDetails':
                await loadBalanceDetails();
                break;
            case 'topExpenses':
                await loadTopExpenses();
                break;
            case 'services':
                await loadServicesPage();
                break;
            case 'profile':
                await loadProfilePage();
                break;
            case 'goals':
            case 'aiChat':
            case 'savings':
                // Tez orada...
                break;
        }
    } catch (error) {
        console.error(`Error loading ${pageName}:`, error);
    }
}

async function showBalanceDetails() {
    hapticFeedback('light');
    
    // Hide current page
    const oldPage = document.getElementById(`page${currentPage.charAt(0).toUpperCase() + currentPage.slice(1)}`);
    if (oldPage) oldPage.classList.remove('active');
    
    // Show balance details page
    const balancePage = document.getElementById('pageBalanceDetails');
    if (balancePage) {
        balancePage.classList.add('active');
        currentPage = 'balanceDetails';
        
        // Load data
        await loadBalanceDetails();
    } else {
        console.error('Balance details page not found');
    }
}

// ============================================
// BALANCE DETAILS PAGE
// ============================================

async function loadBalanceDetails() {
    const container = document.getElementById('balanceDetailsContent');
    if (!container) return;
    
    try {
        showPageLoading('balanceDetailsContent', 'default');
        
        // User data va currency rates olish
        const [user, currencyRates] = await Promise.all([
            apiRequest('/api/user'),
            getCurrencyRates()
        ]);
        
        if (!user || !user.currency_balances) {
            container.innerHTML = '<div class="empty-state">Ma\'lumot topilmadi</div>';
            return;
        }
        
        const balances = user.currency_balances;
        const totalBalance = user.balance || 0;
        
        // Har bir valyutani so'mga chiqarish
        let currencyDetails = [];
        let totalInUzs = 0;
        
        const currencies = ['USD', 'EUR', 'RUB', 'TRY', 'UZS'];
        const currencyNames = {
            'USD': 'AQSH dollari',
            'EUR': 'Yevro',
            'RUB': 'Rossiya rubli',
            'TRY': 'Turkiya lirasi',
            'UZS': 'O\'zbek so\'mi'
        };
        
        currencies.forEach(code => {
            const balance = balances[code] || 0;
            if (balance !== 0 || code === 'UZS') {
                let amountInUzs = 0;
                if (code === 'UZS') {
                    amountInUzs = balance;
                } else {
                    const rate = currencyRates[code] || 1;
                    amountInUzs = balance * rate;
                }
                totalInUzs += amountInUzs;
                
                currencyDetails.push({
                    code,
                    name: currencyNames[code],
                    balance,
                    rate: code === 'UZS' ? 1 : (currencyRates[code] || 1),
                    amountInUzs
                });
            }
        });
        
        // HTML yaratish
        let html = `
            <div style="background: white; border-radius: 16px; padding: 20px; margin-bottom: 16px;">
                <h3 style="font-size: 16px; font-weight: 600; color: #666; margin-bottom: 8px;">Umumiy balans</h3>
                <div style="font-size: 28px; font-weight: 700; color: #1a1a1a;">${formatCurrency(totalBalance)}</div>
            </div>
            
            <div style="background: white; border-radius: 16px; padding: 20px; margin-bottom: 16px;">
                <h3 style="font-size: 16px; font-weight: 600; color: #666; margin-bottom: 16px;">Valyuta tafsilotlari</h3>
                <div style="display: flex; flex-direction: column; gap: 12px;">
        `;
        
        currencyDetails.forEach(curr => {
            const currencyIcon = curr.code === 'USD' ? '$' : 
                                curr.code === 'EUR' ? '€' : 
                                curr.code === 'RUB' ? '₽' : 
                                curr.code === 'TRY' ? '₺' : 'UZS';
            
            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f9f9f9; border-radius: 12px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #5A8EF4 0%, #7BA5F7 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 600; color: white;">
                            ${currencyIcon}
                        </div>
                        <div>
                            <div style="font-size: 16px; font-weight: 600; color: #1a1a1a;">${curr.name}</div>
                            <div style="font-size: 14px; color: #666;">${formatCurrency(curr.balance, curr.code)}</div>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 16px; font-weight: 600; color: #1a1a1a;">${formatCurrency(curr.amountInUzs)}</div>
                        ${curr.code !== 'UZS' ? `<div style="font-size: 12px; color: #999;">Kurs: ${formatCurrency(curr.rate)}</div>` : ''}
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
            
            <div style="background: #f0f7ff; border-radius: 16px; padding: 16px; border-left: 4px solid #5A8EF4;">
                <div style="font-size: 14px; color: #666; margin-bottom: 4px;">Qanday hisoblanadi?</div>
                <div style="font-size: 13px; color: #888; line-height: 1.5;">
                    Umumiy balans barcha valyutalardagi mablag'lar yig'indisidir. Har bir valyuta joriy kurs bo'yicha O'zbek so'miga aylantiriladi va umumiy balansga qo'shiladi.
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Balans tafsilotlari yuklanmadi:', error);
        container.innerHTML = '<div class="empty-state">Xatolik yuz berdi</div>';
    }
}

async function getCurrencyRates() {
    try {
        const rates = await apiRequest('/api/currency-rates');
        return rates || {};
    } catch (error) {
        console.error('Valyuta kurslari olinmadi:', error);
        // Default kurslar
        return {
            'USD': 12750,
            'EUR': 13800,
            'RUB': 135,
            'TRY': 370
        };
    }
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

function renderHomeTransaction(t) {
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
    
    // Loading screen'ni ko'rsatish
    showLoading(true);
    
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
        
        // Loading screen'ni yopish
        showLoading(false);
    } catch (error) {
        console.error('Statistika yuklanmadi:', error);
        container.innerHTML = '<div class="empty-state">Xatolik yuz berdi</div>';
        // Xatolik bo'lsa ham loading screen'ni yopish
        showLoading(false);
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

async function loadTopExpenses() {
    const container = document.getElementById('topExpensesContent');
    if (!container) return;
    
    try {
        container.innerHTML = '<div style="text-align: center; padding: 40px 20px; color: #999;"><p>Yuklanmoqda...</p></div>';
        
        const categories = await apiRequest('/api/statistics/top-categories?limit=10&days=30');
        
        if (!categories || categories.length === 0) {
            container.innerHTML = '<div class="empty-state">Top xarajatlar mavjud emas</div>';
            return;
        }
        
        let html = '<div style="padding: 16px;">';
        html += '<h3 style="font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #1a1a1a;">Eng ko\'p xarajat qilingan kategoriyalar</h3>';
        
        categories.forEach((cat, index) => {
            html += `
                <div class="category-item" style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: white; border-radius: 12px; margin-bottom: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #5A8EF4 0%, #7BA5F7 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 16px;">
                            ${index + 1}
                        </div>
                        <span style="font-size: 16px; font-weight: 600; color: #1a1a1a;">${cat.category || 'Noma\'lum'}</span>
                    </div>
                    <span style="font-size: 16px; font-weight: 600; color: #ef4444;">${formatCurrency(cat.amount, 'UZS')}</span>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Top xarajatlar yuklanmadi:', error);
        if (container) {
            container.innerHTML = '<div class="empty-state">Xatolik yuz berdi</div>';
        }
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

// Eslatma modal funksiyalari (global scope'da bo'lishi kerak)
window.showAddReminderModal = function() {
    hapticFeedback('light');
    const modal = document.getElementById('addReminderModal');
    if (modal) {
        modal.classList.add('active');
        // Bugungi sanani default qilish
            const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('reminderDate');
        if (dateInput) dateInput.value = today;
    } else {
        console.error('addReminderModal topilmadi');
    }
}

window.closeAddReminderModal = function() {
    hapticFeedback('light');
    const modal = document.getElementById('addReminderModal');
    if (modal) {
        modal.classList.remove('active');
        document.getElementById('addReminderForm').reset();
    }
}

async function handleAddReminder(event) {
    // Funksiya o'chirilgan - faqat ko'rish uchun
    event.preventDefault();
    return;
    
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
// DEBTS PAGE - Kontaktli tizim
// ============================================

let currentDebtFilter = 'all';
let currentContactId = null;
let currentContactName = null;
let contactsData = [];
let debtsData = [];

// Kontaktlar ro'yxatini yuklash
async function loadContacts() {
    const container = document.getElementById('contactsList');
    if (!container) return;
    
    try {
        showPageLoading('contactsList', 'debts');
        
        contactsData = await apiRequest('/api/contacts');
        
        if (!contactsData || contactsData.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Kontaktlar yo'q</p>
                    <p style="font-size: 12px; color: #999; margin-top: 8px;">Yangi kontakt qo'shish uchun + tugmasini bosing</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = contactsData.map((contact, index) => {
            const name = contact.name || 'Nomsiz';
            const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            const debtsCount = contact.debts_count || 0;
            const contactId = contact.id || contact.name || `contact_${index}`;
            const contactIdStr = typeof contactId === 'string' ? `'${contactId.replace(/'/g, "\\'")}'` : contactId;
            
            return `
                <div class="contact-item" onclick="selectContact(${contactIdStr}, '${name.replace(/'/g, "\\'")}')">
                    <div class="contact-avatar">${initials}</div>
                    <div class="contact-info">
                        <div class="contact-name">${name}</div>
                        <div class="contact-meta">
                            ${contact.phone ? `<span>${contact.phone}</span>` : ''}
                            ${debtsCount > 0 ? `<span class="contact-debts-count">${debtsCount} qarz</span>` : ''}
                        </div>
                    </div>
                    <svg class="contact-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 18l6-6-6-6"/>
                    </svg>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Kontaktlar yuklanmadi:', error);
        if (container) container.innerHTML = '<div class="empty-state">Xatolik yuz berdi</div>';
    }
}

// Kontakt tanlash
async function selectContact(contactId, contactName) {
    hapticFeedback('light');
    currentContactId = contactId;
    currentContactName = contactName;
    
    // Qarzlar ro'yxatini ko'rsatish
    const contactsList = document.getElementById('contactsList');
    const debtsList = document.getElementById('debtsList');
    
    if (contactsList) contactsList.style.display = 'none';
    if (debtsList) {
        debtsList.style.display = 'block';
        await loadDebtsForContact(contactId, contactName);
    }
}

// Kontakt uchun qarzlar
async function loadDebtsForContact(contactId, contactName) {
    const container = document.getElementById('debtsList');
    if (!container) return;
    
    try {
        showPageLoading('debtsList', 'debts');
        
        const contactIdParam = typeof contactId === 'number' ? contactId : null;
        const url = contactIdParam ? `/api/debts?contact_id=${contactIdParam}` : '/api/debts';
        debtsData = await apiRequest(url);
        
        // Agar contact_id number bo'lmasa, person_name bo'yicha filterlash
        if (!contactIdParam && typeof contactId === 'string') {
            debtsData = debtsData.filter(d => d.person_name === contactId || d.contact_name === contactId);
        }
        
        const displayName = contactName || contactId;
        
        if (!debtsData || debtsData.length === 0) {
            container.innerHTML = `
                <div style="padding: 16px; background: white; border-bottom: 1px solid rgba(0,0,0,0.1); position: sticky; top: 0; z-index: 10;">
                    <button onclick="backToContacts()" style="background: none; border: none; color: #5A8EF4; font-size: 16px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                        Orqaga
                    </button>
                    <h3 style="margin: 8px 0 0 0; font-size: 18px; font-weight: 600;">${displayName}</h3>
                </div>
                <div class="empty-state">
                    <p>Qarzlar yo'q</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div style="padding: 16px; background: white; border-bottom: 1px solid rgba(0,0,0,0.1); position: sticky; top: 0; z-index: 10;">
                <button onclick="backToContacts()" style="background: none; border: none; color: #5A8EF4; font-size: 16px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                    Orqaga
                </button>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                    <h3 style="margin: 0; font-size: 18px; font-weight: 600;">${displayName}</h3>
                </div>
            </div>
            ${debtsData.map(d => renderDebtCard(d)).join('')}
        `;
    } catch (error) {
        console.error('Qarzlar yuklanmadi:', error);
        if (container) container.innerHTML = '<div class="empty-state">Xatolik yuz berdi</div>';
    }
}

// Qarz kartasini render qilish
function renderDebtCard(d) {
            const isGiven = d.debt_type === 'given';
            const amountClass = isGiven ? 'given' : 'taken';
            const sign = isGiven ? '-' : '+';
    const remaining = (d.amount || 0) - (d.paid_amount || 0);
            
            const date = new Date(d.created_at);
            const dateStr = date.toLocaleDateString('uz-UZ', {
                year: 'numeric',
        month: 'short',
                day: 'numeric'
            });
            
            return `
        <div class="debt-card ${amountClass}" onclick="showDebtDetail(${d.id})">
            <div class="debt-header">
                <div>
                    <div class="debt-amount ${amountClass}">
                        ${sign} ${formatCurrency(remaining, d.currency || 'UZS')}
                    </div>
                    ${d.description ? `<div class="debt-description">${d.description}</div>` : ''}
                </div>
                <div class="debt-actions">
                    <button class="debt-action-btn" onclick="event.stopPropagation(); editDebt(${d.id})">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="debt-meta">
                <span>${dateStr}</span>
                <span>${isGiven ? 'Berdim' : 'Oldim'}</span>
            </div>
        </div>
    `;
}

// Orqaga (kontaktlar ro'yxatiga)
function backToContacts() {
    hapticFeedback('light');
    currentContactId = null;
    currentContactName = null;
    const contactsList = document.getElementById('contactsList');
    const debtsList = document.getElementById('debtsList');
    
    if (contactsList) contactsList.style.display = 'block';
    if (debtsList) debtsList.style.display = 'none';
}

// Modal funksiyalari (global scope'da bo'lishi kerak)
window.showAddContactModal = function() {
    hapticFeedback('light');
    const modal = document.getElementById('addContactModal');
    if (modal) {
        modal.classList.add('active');
    } else {
        console.error('addContactModal topilmadi');
    }
}

window.closeAddContactModal = function() {
    hapticFeedback('light');
    const modal = document.getElementById('addContactModal');
    if (modal) {
        modal.classList.remove('active');
        document.getElementById('addContactForm')?.reset();
    }
}

window.handleAddContact = async function(event) {
    event.preventDefault();
    hapticFeedback('medium');
    
    try {
        const name = document.getElementById('contactName').value;
        const phone = document.getElementById('contactPhone').value || null;
        const notes = document.getElementById('contactNotes').value || null;
        
        const response = await apiRequest('/api/contacts', {
            method: 'POST',
            body: JSON.stringify({ name, phone, notes })
        });
        
        if (response.success || response.id) {
            hapticFeedback('success');
            closeAddContactModal();
            await loadContacts();
        } else {
            throw new Error('Kontakt qo\'shilmadi');
        }
    } catch (error) {
        console.error('Kontakt qo\'shishda xatolik:', error);
        hapticFeedback('error');
        alert('Xatolik: ' + error.message);
    }
}

window.showAddDebtModal = async function() {
    hapticFeedback('light');
    const modal = document.getElementById('addDebtModal');
    if (modal) {
        // Kontaktlar ro'yxatini yuklash
        const contactSelect = document.getElementById('debtContact');
        if (contactSelect) {
            try {
                const contacts = await apiRequest('/api/contacts');
                contactSelect.innerHTML = '<option value="">Tanlang...</option>';
                if (contacts && contacts.length > 0) {
                    contacts.forEach(contact => {
                        const option = document.createElement('option');
                        option.value = contact.id || contact.name;
                        option.textContent = contact.name;
                        contactSelect.appendChild(option);
                    });
                }
            } catch (error) {
                console.error('Kontaktlar yuklanmadi:', error);
            }
        }
        modal.classList.add('active');
    } else {
        console.error('addDebtModal topilmadi');
    }
}

window.closeAddDebtModal = function() {
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
    
    const form = event.target;
    const formData = new FormData(form);
    const data = {
        debt_type: formData.get('debt_type'),
        amount: parseFloat(formData.get('amount')),
        currency: formData.get('currency'),
        description: formData.get('description') || null,
        due_date: formData.get('due_date') || null
    };
    
    // Contact ID yoki person_name
    if (currentContactId) {
        if (typeof currentContactId === 'number') {
            data.contact_id = currentContactId;
        } else {
            data.person_name = currentContactId;
        }
    }
    
    try {
        await apiRequest('/api/debts', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        
        hapticFeedback('success');
        closeAddDebtModal();
        if (currentContactId) {
            await loadDebtsForContact(currentContactId, currentContactName);
        } else {
            await loadContacts();
        }
    } catch (error) {
        hapticFeedback('error');
        alert('Xatolik yuz berdi: ' + error.message);
    }
}

// Qarz ma'lumotlarini ko'rsatish
async function showDebtDetail(debtId) {
    hapticFeedback('light');
    const modal = document.getElementById('debtDetailModal');
    const content = document.getElementById('debtDetailContent');
    
    if (!modal || !content) return;
    
    try {
        const debt = debtsData.find(d => d.id === debtId);
        if (!debt) {
            // API dan olish
            const allDebts = await apiRequest('/api/debts');
            const foundDebt = allDebts.find(d => d.id === debtId);
            if (foundDebt) {
                await renderDebtDetail(foundDebt, content);
                modal.classList.add('active');
            }
            return;
        }
        
        await renderDebtDetail(debt, content);
        modal.classList.add('active');
    } catch (error) {
        console.error('Qarz ma\'lumotlarini olishda xatolik:', error);
        alert('Xatolik yuz berdi');
    }
}

// Qarz ma'lumotlarini render qilish
async function renderDebtDetail(debt, container) {
    const isGiven = debt.debt_type === 'given';
    const remaining = (debt.amount || 0) - (debt.paid_amount || 0);
    const date = new Date(debt.created_at);
    const dateStr = date.toLocaleDateString('uz-UZ', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Eslatmalarni olish
    let reminders = [];
    try {
        reminders = await apiRequest(`/api/debts/${debt.id}/reminders`);
    } catch (e) {
        console.log('Eslatmalar olinmadi');
    }
    
    container.innerHTML = `
        <div style="margin-bottom: 20px;">
            <div style="font-size: 14px; color: #666; margin-bottom: 8px;">Qarz turi</div>
            <div style="font-size: 18px; font-weight: 600; color: ${isGiven ? '#ef4444' : '#10b981'};">
                        ${isGiven ? 'Berdim' : 'Oldim'}
            </div>
        </div>
        
        <div style="margin-bottom: 20px;">
            <div style="font-size: 14px; color: #666; margin-bottom: 8px;">Summa</div>
            <div style="font-size: 24px; font-weight: 700; color: #1a1a1a;">
                ${formatCurrency(debt.amount, debt.currency || 'UZS')}
            </div>
        </div>
        
        ${debt.paid_amount > 0 ? `
        <div style="margin-bottom: 20px;">
            <div style="font-size: 14px; color: #666; margin-bottom: 8px;">To'langan</div>
            <div style="font-size: 18px; font-weight: 600; color: #10b981;">
                ${formatCurrency(debt.paid_amount, debt.currency || 'UZS')}
            </div>
        </div>
        
        <div style="margin-bottom: 20px;">
            <div style="font-size: 14px; color: #666; margin-bottom: 8px;">Qolgan</div>
            <div style="font-size: 18px; font-weight: 600; color: #1a1a1a;">
                ${formatCurrency(remaining, debt.currency || 'UZS')}
            </div>
        </div>
        ` : ''}
        
        ${debt.description ? `
        <div style="margin-bottom: 20px;">
            <div style="font-size: 14px; color: #666; margin-bottom: 8px;">Izoh</div>
            <div style="font-size: 16px; color: #1a1a1a;">${debt.description}</div>
        </div>
        ` : ''}
        
        <div style="margin-bottom: 20px;">
            <div style="font-size: 14px; color: #666; margin-bottom: 8px;">Sana</div>
            <div style="font-size: 16px; color: #1a1a1a;">${dateStr}</div>
        </div>
        
        ${debt.due_date ? `
        <div style="margin-bottom: 20px;">
            <div style="font-size: 14px; color: #666; margin-bottom: 8px;">Muddat</div>
            <div style="font-size: 16px; color: #1a1a1a;">${formatDate(debt.due_date)}</div>
        </div>
        ` : ''}
        
        <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <div style="font-size: 16px; font-weight: 600;">Eslatmalar</div>
                <button onclick="showAddDebtReminderModal(${debt.id})" style="background: #5A8EF4; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-size: 14px; cursor: pointer;">
                    + Qo'shish
                </button>
            </div>
            <div id="debtRemindersList">
                ${reminders.length > 0 ? reminders.map(r => `
                    <div style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 14px; font-weight: 500;">${formatDate(r.reminder_date)}</div>
                            ${r.notes ? `<div style="font-size: 12px; color: #666; margin-top: 4px;">${r.notes}</div>` : ''}
                        </div>
                        <button onclick="deleteDebtReminder(${r.id}, ${debt.id})" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px 8px;">
                            ✕
                        </button>
                    </div>
                `).join('') : '<div style="color: #999; font-size: 14px;">Eslatmalar yo\'q</div>'}
            </div>
        </div>
        
        <div class="modal-actions" style="margin-top: 24px;">
            <button class="btn-cancel" onclick="closeDebtDetailModal()">Yopish</button>
            <button class="btn-primary" onclick="editDebt(${debt.id})">Tahrirlash</button>
                </div>
            `;
}

function closeDebtDetailModal() {
    hapticFeedback('light');
    const modal = document.getElementById('debtDetailModal');
    if (modal) modal.classList.remove('active');
}

// Qarzni tahrirlash
async function editDebt(debtId) {
    hapticFeedback('light');
    closeDebtDetailModal();
    
    const debt = debtsData.find(d => d.id === debtId);
    if (!debt) return;
    
    // Tahrirlash modal yaratish
    const editModal = document.createElement('div');
    editModal.className = 'modal active';
    editModal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Qarzni tahrirlash</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">✕</button>
            </div>
            <form onsubmit="handleUpdateDebt(event, ${debtId})">
                <div class="modal-body">
                    <div class="form-group">
                        <label>Summa</label>
                        <input type="number" name="amount" value="${debt.amount}" required step="0.01">
                    </div>
                    <div class="form-group">
                        <label>To'langan summa</label>
                        <input type="number" name="paid_amount" value="${debt.paid_amount || 0}" step="0.01">
                    </div>
                    <div class="form-group">
                        <label>Izoh</label>
                        <input type="text" name="description" value="${debt.description || ''}">
                    </div>
                    <div class="form-group">
                        <label>Muddat</label>
                        <input type="date" name="due_date" value="${debt.due_date ? debt.due_date.split('T')[0] : ''}">
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn-cancel" onclick="this.closest('.modal').remove()">Bekor qilish</button>
                    <button type="submit" class="btn-primary">Saqlash</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(editModal);
}

async function handleUpdateDebt(event, debtId) {
    event.preventDefault();
    hapticFeedback('medium');
    
    const form = event.target;
    const formData = new FormData(form);
    const data = {
        amount: parseFloat(formData.get('amount')),
        paid_amount: parseFloat(formData.get('paid_amount') || 0),
        description: formData.get('description') || null,
        due_date: formData.get('due_date') || null
    };
    
    try {
        await apiRequest(`/api/debts/${debtId}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
        
        hapticFeedback('success');
        event.target.closest('.modal').remove();
        if (currentContactId) {
            await loadDebtsForContact(currentContactId, currentContactName);
        } else {
            await loadContacts();
        }
    } catch (error) {
        hapticFeedback('error');
        alert('Xatolik yuz berdi: ' + error.message);
    }
}

// Qarz eslatmasi qo'shish
function showAddDebtReminderModal(debtId) {
    hapticFeedback('light');
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Eslatma qo'shish</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">✕</button>
            </div>
            <form onsubmit="handleAddDebtReminder(event, ${debtId})">
                <div class="modal-body">
                    <div class="form-group">
                        <label>Sana</label>
                        <input type="date" name="reminder_date" required>
                    </div>
                    <div class="form-group">
                        <label>Vaqt (ixtiyoriy)</label>
                        <input type="time" name="reminder_time">
                    </div>
                    <div class="form-group">
                        <label>Izoh (ixtiyoriy)</label>
                        <textarea name="notes" rows="3" placeholder="Eslatma haqida izoh"></textarea>
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn-cancel" onclick="this.closest('.modal').remove()">Bekor qilish</button>
                    <button type="submit" class="btn-primary">Qo'shish</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Bugungi sanani default qilish
    const dateInput = modal.querySelector('input[name="reminder_date"]');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
}

async function handleAddDebtReminder(event, debtId) {
    event.preventDefault();
    hapticFeedback('medium');
    
    const form = event.target;
    const formData = new FormData(form);
    const data = {
        reminder_date: formData.get('reminder_date'),
        reminder_time: formData.get('reminder_time') || null,
        notes: formData.get('notes') || null
    };
    
    try {
        await apiRequest(`/api/debts/${debtId}/reminders`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        
        hapticFeedback('success');
        event.target.closest('.modal').remove();
        // Qarz ma'lumotlarini yangilash
        await showDebtDetail(debtId);
    } catch (error) {
        hapticFeedback('error');
        alert('Xatolik yuz berdi: ' + error.message);
    }
}

async function deleteDebtReminder(reminderId, debtId) {
    hapticFeedback('light');
    
    if (!confirm('Eslatmani o\'chirishni tasdiqlaysizmi?')) return;
    
    try {
        await apiRequest(`/api/debts/reminders/${reminderId}`, {
            method: 'DELETE'
        });
        
        hapticFeedback('success');
        await showDebtDetail(debtId);
    } catch (error) {
        hapticFeedback('error');
        alert('Xatolik yuz berdi: ' + error.message);
    }
}

// Eski funksiya (backward compatibility)
async function loadDebts(filter = 'all') {
    await loadContacts();
}

// ============================================
// HOME PAGE FUNCTIONS
// ============================================

async function loadQuickStats() {
    try {
        // Get balance and transactions data
        const balance = await apiRequest('/api/balance');
        const transactions = await apiRequest('/api/transactions');

        // Calculate income, expense
        let totalIncome = 0;
        let totalExpense = 0;

        transactions.transactions?.forEach(t => {
            if (t.transaction_type === 'income') {
                totalIncome += parseFloat(t.amount || 0);
            } else if (t.transaction_type === 'expense') {
                totalExpense += parseFloat(t.amount || 0);
            }
        });

        // Update quick stats
        const quickIncome = document.getElementById('quickIncome');
        const quickExpense = document.getElementById('quickExpense');
        const quickBalance = document.getElementById('quickBalance');
        const quickSavings = document.getElementById('quickSavings');

        if (quickIncome) {
            quickIncome.textContent = formatCurrencyShort(totalIncome);
        }

        if (quickExpense) {
            quickExpense.textContent = formatCurrencyShort(totalExpense);
        }

        if (quickBalance) {
            quickBalance.textContent = formatCurrencyShort(balance.total || 0);
        }

        if (quickSavings) {
            const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100) : 0;
            quickSavings.textContent = Math.round(savingsRate) + '%';
        }
    } catch (error) {
        console.error('Quick stats loading error:', error);
    }
}

async function loadHomeTransactions() {
    try {
        const transactions = await apiRequest('/api/transactions');
        const homeList = document.getElementById('homeTransactionsList');

        if (!homeList) return;

        if (!transactions.transactions || transactions.transactions.length === 0) {
            homeList.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">Tranzaksiyalar yo\'q</div>';
            return;
        }

        // Take only first 5 transactions
        const recentTransactions = transactions.transactions.slice(0, 5);

        let html = '';
        recentTransactions.forEach((transaction, index) => {
            const isLast = index === recentTransactions.length - 1;
            const borderStyle = isLast ? '' : 'border-bottom: 0.5px solid rgba(0, 0, 0, 0.1);';

            html += `
                <div style="display: flex; align-items: center; padding: 12px 16px; ${borderStyle}" onclick="showTransactionDetail(${transaction.id})">
                    <div style="flex: 1;">
                        <div style="font-size: 15px; font-weight: 600; color: #1a1a1a; margin-bottom: 2px;">
                            ${transaction.description || 'Tranzaksiya'}
                        </div>
                        <div style="font-size: 13px; color: #8E8E93;">
                            ${formatDate(transaction.created_at)}
                        </div>
                    </div>
                    <div style="font-size: 16px; font-weight: 700; color: ${transaction.transaction_type === 'income' ? '#34C759' : '#FF3B30'};">
                        ${transaction.transaction_type === 'income' ? '+' : '-'}${formatCurrency(transaction.amount)}
                    </div>
                </div>
            `;
        });

        homeList.innerHTML = html;
    } catch (error) {
        console.error('Home transactions loading error:', error);
    }
}

// Helper function for shorter currency format
function formatCurrencyShort(amount) {
    const num = parseFloat(amount);
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(0) + 'K';
    }
    return num.toFixed(0);
}

// ============================================
// SERVICES PAGE
// ============================================

async function loadServicesPage() {
    try {
        // Update service badges with counts
        const remindersCount = await getActiveRemindersCount();
        const debtsCount = await getUnpaidDebtsCount();

        const remindersBadge = document.getElementById('remindersBadge');
        const debtsBadge = document.getElementById('debtsBadge');

        if (remindersBadge && remindersCount > 0) {
            remindersBadge.textContent = remindersCount;
            remindersBadge.style.display = 'flex';
        }

        if (debtsBadge && debtsCount > 0) {
            debtsBadge.textContent = debtsCount;
            debtsBadge.style.display = 'flex';
        }
    } catch (error) {
        console.error('Services page loading error:', error);
    }
}

async function getActiveRemindersCount() {
    try {
        const response = await apiRequest('/api/reminders');
        return response.reminders?.filter(r => r.status === 'active').length || 0;
    } catch {
        return 0;
    }
}

async function getUnpaidDebtsCount() {
    try {
        const response = await apiRequest('/api/debts');
        return response.debts?.filter(d => d.status === 'active').length || 0;
    } catch {
        return 0;
    }
}

// ============================================
// PROFILE PAGE
// ============================================

async function loadProfilePage() {
    try {
        // Load user data
        const userData = await apiRequest('/api/user');

        // Update profile header
        const profileName = document.getElementById('profileName');
        const profileUsername = document.getElementById('profileUsername');
        const profileInitials = document.getElementById('profileInitials');

        if (profileName && userData.name) {
            profileName.textContent = userData.name;
        }

        if (profileUsername && userData.username) {
            profileUsername.textContent = `@${userData.username}`;
        }

        if (profileInitials && userData.name) {
            profileInitials.textContent = userData.name.charAt(0).toUpperCase();
        }

        // Load stats
        const balance = await apiRequest('/api/balance');
        const transactions = await apiRequest('/api/transactions');

        const profileBalance = document.getElementById('profileBalance');
        const profileTransactions = document.getElementById('profileTransactions');
        const profileDays = document.getElementById('profileDays');

        if (profileBalance) {
            profileBalance.textContent = formatCurrency(balance.total || 0);
        }

        if (profileTransactions) {
            profileTransactions.textContent = transactions.transactions?.length || 0;
        }

        if (profileDays && transactions.transactions?.length > 0) {
            const firstDate = new Date(transactions.transactions[0].created_at);
            const daysSinceStart = Math.floor((Date.now() - firstDate) / (1000 * 60 * 60 * 24));
            profileDays.textContent = daysSinceStart;
        }

        // Sync dark mode toggle with current theme
        const darkModeToggle = document.getElementById('darkModeToggle');
        if (darkModeToggle && window.themeManager) {
            darkModeToggle.checked = window.themeManager.theme === 'dark';
        }
    } catch (error) {
        console.error('Profile page loading error:', error);
    }
}

// ============================================
// PROFILE SETTINGS HANDLERS
// ============================================

function showLanguageSettings() {
    hapticFeedback('light');
    alert('Til sozlamalari tez orada qo\'shiladi!');
}

function showCurrencySettings() {
    hapticFeedback('light');
    alert('Valyuta sozlamalari tez orada qo\'shiladi!');
}

function showTariffSettings() {
    hapticFeedback('light');
    alert('Tarif sozlamalari tez orada qo\'shiladi!');
}

function showPaymentHistory() {
    hapticFeedback('light');
    alert('To\'lov tarixi tez orada qo\'shiladi!');
}

function showDataExport() {
    hapticFeedback('light');
    // Use existing reports manager
    if (window.reportsManager) {
        window.reportsManager.showReportModal();
    } else {
        alert('Eksport funksiyasi yuklanmoqda...');
    }
}

function showFAQ() {
    hapticFeedback('light');
    alert('FAQ bo\'limi tez orada qo\'shiladi!');
}

function showSupport() {
    hapticFeedback('light');
    alert('Qo\'llab-quvvatlash tez orada qo\'shiladi!');
}

function showAbout() {
    hapticFeedback('light');
    alert('Balans AI v1.0\nMoliyaviy boshqaruv tizimi\n\n© 2024');
}

function handleLogout() {
    hapticFeedback('light');
    if (confirm('Ilovadan chiqishni tasdiqlaysizmi?')) {
        // Clear local storage
        localStorage.clear();
        // Close Telegram WebApp
        if (tg) {
            tg.close();
        } else {
            window.location.reload();
        }
    }
}

// ============================================
// AI FEATURES PLACEHOLDERS
// ============================================

function showAIInsights() {
    hapticFeedback('light');
    alert('Smart Tahlil funksiyasi tez orada qo\'shiladi!\n\nBu yerda:\n• Xarajat tendensiyalari\n• Tejash imkoniyatlari\n• Noodatiy tranzaksiyalar\nva boshqa tahlillar ko\'rsatiladi.');
}

function showAIForecast() {
    hapticFeedback('light');
    alert('Prognoz funksiyasi tez orada qo\'shiladi!\n\nBu yerda:\n• Keyingi oy xarajatlari\n• Kutilayotgan balans\n• Tavsiyalar\nko\'rsatiladi.');
}

function showAIRecommendations() {
    hapticFeedback('light');
    alert('Tavsiyalar funksiyasi tez orada qo\'shiladi!\n\nBu yerda:\n• Shaxsiylashtirilgan maslahatlar\n• Byudjet optimizatsiyasi\n• Tejash yo\'llari\nko\'rsatiladi.');
}

function showCurrencyConverter() {
    hapticFeedback('light');
    alert('Valyuta konvertor funksiyasi tez orada qo\'shiladi!\n\nBu yerda real-time valyuta kurslari bilan konvertatsiya qilish mumkin bo\'ladi.');
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOMContentLoaded - initialization boshlandi');
    
    // Ilova darhol ochilsin, skeleton loading bilan
    // Home page skeleton ko'rsatish
    showHomePageSkeleton();
    
    // Background'da data yuklash (non-blocking)
    (async () => {
        try {
            console.log('User data yuklanmoqda...');
            const userLoaded = await loadUserData();
            console.log('User data yuklandi:', userLoaded);
            
            if (!userLoaded) {
                console.log('User yuklanmadi, to\'xtatilmoqda');
                return;
            }
            
            // Load home page data
            if (currentUser && currentUser.currency_balances) {
                console.log('Currency balances render qilinmoqda...');
                renderCurrencies(currentUser.currency_balances);
            }
            
            // Barcha ma'lumotlarni parallel yuklash (faqat kerakli ma'lumotlar)
            console.log('Transactions va Statistics yuklanmoqda...');
            await Promise.all([
                loadTransactions(),
                loadStatistics()
            ]);
            console.log('Barcha ma\'lumotlar yuklandi');
            // loadAllTransactions faqat transactions sahifasiga o'tganda yuklanadi
        } catch (error) {
            console.error('Initialization error:', error);
            console.error('Error details:', error.message, error.stack);
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
// ADD REMINDER
// ============================================

function showAddReminderModal() {
    hapticFeedback('light');
    const modal = document.getElementById('addReminderModal');
    if (modal) {
        modal.classList.add('active');
        // Bugungi sanani default qilish
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('reminderDate');
        if (dateInput) dateInput.value = today;
    }
}

function closeAddReminderModal() {
    const modal = document.getElementById('addReminderModal');
    if (modal) {
        modal.classList.remove('active');
        document.getElementById('addReminderForm')?.reset();
    }
}

window.handleAddReminder = async function(event) {
    event.preventDefault();
    hapticFeedback('medium');
    
    try {
        const title = document.getElementById('reminderTitle').value;
        const amount = parseFloat(document.getElementById('reminderAmount').value);
        const currency = document.getElementById('reminderCurrency').value;
        const reminderDate = document.getElementById('reminderDate').value;
        const reminderTime = document.getElementById('reminderTime').value;
        const repeatInterval = document.getElementById('reminderRepeat').value;
        
        const response = await apiRequest('/api/reminders', {
            method: 'POST',
            body: JSON.stringify({
                title,
                amount,
                currency,
                reminder_date: reminderDate,
                reminder_time: reminderTime || null,
                repeat_interval: repeatInterval
            })
        });
        
        if (response.success) {
            hapticFeedback('success');
            closeAddReminderModal();
            await loadReminders();
        } else {
            throw new Error('Eslatma qo\'shilmadi');
        }
    } catch (error) {
        console.error('Eslatma qo\'shishda xatolik:', error);
        hapticFeedback('error');
        alert('Xatolik: ' + error.message);
    }
}

// ============================================
// ADD DEBT
// ============================================

window.showAddDebtModal = async function() {
    hapticFeedback('light');
    const modal = document.getElementById('addDebtModal');
    if (modal) {
        // Kontaktlar ro'yxatini yuklash
        const contactSelect = document.getElementById('debtContact');
        if (contactSelect) {
            try {
                const contacts = await apiRequest('/api/contacts');
                contactSelect.innerHTML = '<option value="">Tanlang...</option>';
                if (contacts && contacts.length > 0) {
                    contacts.forEach(contact => {
                        const option = document.createElement('option');
                        option.value = contact.id || contact.name;
                        option.textContent = contact.name;
                        contactSelect.appendChild(option);
                    });
                }
            } catch (error) {
                console.error('Kontaktlar yuklanmadi:', error);
            }
        }
        modal.classList.add('active');
    }
}

window.closeAddDebtModal = function() {
    const modal = document.getElementById('addDebtModal');
    if (modal) {
        modal.classList.remove('active');
        document.getElementById('addDebtForm')?.reset();
    }
}

window.handleAddDebt = async function(event) {
    event.preventDefault();
    hapticFeedback('medium');
    
    try {
        const contactId = document.getElementById('debtContact').value;
        const personName = document.getElementById('debtPersonName').value;
        const amount = parseFloat(document.getElementById('debtAmount').value);
        const direction = document.getElementById('debtDirection').value;
        const dueDate = document.getElementById('debtDueDate').value || null;
        const description = document.getElementById('debtDescription').value || null;
        
        if (!contactId && !personName) {
            alert('Iltimos, kontakt tanlang yoki yangi kontakt nomini kiriting');
            return;
        }
        
        // Avval kontakt yaratish (agar yangi bo'lsa)
        let finalContactId = contactId;
        if (!contactId && personName) {
            const contactResponse = await apiRequest('/api/contacts', {
                method: 'POST',
                body: JSON.stringify({ name: personName })
            });
            if (contactResponse.id) {
                finalContactId = contactResponse.id;
            }
        }
        
        // Qarzni saqlash
        const response = await apiRequest('/api/debts', {
            method: 'POST',
            body: JSON.stringify({
                person_name: personName || null,
                contact_id: finalContactId || null,
                amount,
                direction,
                due_date: dueDate,
                description
            })
        });
        
        if (response.success) {
            hapticFeedback('success');
            closeAddDebtModal();
            await loadDebts();
            await loadContacts();
        } else {
            throw new Error('Qarz qo\'shilmadi');
        }
    } catch (error) {
        console.error('Qarz qo\'shishda xatolik:', error);
        hapticFeedback('error');
        alert('Xatolik: ' + error.message);
    }
}

// ============================================
// ADD CONTACT
// ============================================

function showAddContactModal() {
    hapticFeedback('light');
    const modal = document.getElementById('addContactModal');
    if (modal) {
        modal.classList.add('active');
    }
}

function closeAddContactModal() {
    const modal = document.getElementById('addContactModal');
    if (modal) {
        modal.classList.remove('active');
        document.getElementById('addContactForm')?.reset();
    }
}

async function handleAddContact(event) {
    event.preventDefault();
    hapticFeedback('medium');
    
    try {
        const name = document.getElementById('contactName').value;
        const phone = document.getElementById('contactPhone').value || null;
        const notes = document.getElementById('contactNotes').value || null;
        
        const response = await apiRequest('/api/contacts', {
            method: 'POST',
            body: JSON.stringify({ name, phone, notes })
        });
        
        if (response.success || response.id) {
            hapticFeedback('success');
            closeAddContactModal();
            await loadContacts();
        } else {
            throw new Error('Kontakt qo\'shilmadi');
        }
    } catch (error) {
        console.error('Kontakt qo\'shishda xatolik:', error);
        hapticFeedback('error');
        alert('Xatolik: ' + error.message);
    }
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
