// Telegram Mini App integratsiyasi va asosiy funksiyalar

// Telegram WebApp obyektini olish
const tg = window.Telegram?.WebApp || null;

// Telegram WebApp ni ishga tushirish
if (tg) {
    tg.ready();
    tg.expand();
    // Ilovaga o'xshash qilish
    tg.enableClosingConfirmation();
    tg.setHeaderColor('#1E88E5');
    tg.setBackgroundColor('#f5f5f5');
} else {
    console.warn('Telegram WebApp mavjud emas. Browser mode ishlatilmoqda.');
}

// Global o'zgaruvchilar
let currentUser = null;
let currentTariff = null;
let currentFilter = 'all';
let loadedPages = new Set(['home']); // Yuklangan sahifalar

// API base URL
const API_BASE = '';

// Haptic feedback
function hapticFeedback(type = 'light') {
    if (tg && tg.HapticFeedback) {
        if (type === 'light') {
            tg.HapticFeedback.impactOccurred('light');
        } else if (type === 'medium') {
            tg.HapticFeedback.impactOccurred('medium');
        } else if (type === 'heavy') {
            tg.HapticFeedback.impactOccurred('heavy');
        } else if (type === 'success') {
            tg.HapticFeedback.notificationOccurred('success');
        } else if (type === 'error') {
            tg.HapticFeedback.notificationOccurred('error');
        }
    }
}

// Telegram initData ni olish
function getInitData() {
    if (tg && tg.initData) {
        return tg.initData;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const testUserId = urlParams.get('test_user_id');
    if (testUserId) {
        return '';
    }
    return '';
}

// API so'rov yuborish
async function apiRequest(endpoint, options = {}) {
    const initData = getInitData();
    const urlParams = new URLSearchParams(window.location.search);
    const testUserId = urlParams.get('test_user_id');
    let url = `${API_BASE}${endpoint}`;
    if (testUserId && !initData) {
        url += (url.includes('?') ? '&' : '?') + `test_user_id=${testUserId}`;
    }
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': initData,
            ...options.headers
        }
    };

    try {
        const response = await fetch(url, {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
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

// Tarif tekshiruvi
function checkTariff(tariff) {
    const allowedTariffs = ['PLUS', 'PRO', 'FAMILY', 'FAMILY_PLUS', 'FAMILY_PRO'];
    const businessTariffs = ['BUSINESS', 'BUSINESS_PLUS', 'BUSINESS_PRO'];
    
    if (!tariff || tariff === 'NONE') {
        showTarifModal('Tarif topilmadi', 'Sizning tarifingiz bu ilova uchun mos emas. Tarif sotib olish uchun quyidagi havolaga o\'ting.', 'https://balansai.uz/payments');
        return false;
    }
    
    if (businessTariffs.some(bt => tariff.includes(bt) || tariff === bt)) {
        showTarifModal('Siz uchun boshqa ilova bor', 'Sizning tarifingiz biznes tarifi. Biznes funksiyalari uchun boshqa ilovadan foydalaning.', 'https://balansai.uz');
        return false;
    }
    
    if (!allowedTariffs.some(at => tariff.includes(at) || tariff === at)) {
        showTarifModal('Tarif topilmadi', 'Sizning tarifingiz bu ilova uchun mos emas. Tarif sotib olish uchun quyidagi havolaga o\'ting.', 'https://balansai.uz/payments');
        return false;
    }
    
    return true;
}

// Tarif modal ko'rsatish
function showTarifModal(title, text, url) {
    document.getElementById('tarifModalTitle').textContent = title;
    document.getElementById('tarifModalText').textContent = text;
    document.getElementById('tarifModalBtn').onclick = () => {
        window.open(url, '_blank');
        if (tg && tg.close) {
            tg.close();
        }
    };
    document.getElementById('tarifModal').classList.add('active');
}

// Loading screen ko'rsatish/yashirish (faqat asosiy sahifada)
function showLoading(show) {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        if (show) {
            loadingScreen.style.display = 'flex';
        } else {
            loadingScreen.style.display = 'none';
        }
    }
}

// Top loading bar ko'rsatish/yashirish (boshqa sahifalar uchun)
function showTopLoading(show) {
    const topLoadingBar = document.getElementById('topLoadingBar');
    if (topLoadingBar) {
        if (show) {
            topLoadingBar.style.display = 'block';
            // Body padding-top qo'shish
            document.body.style.paddingTop = '48px';
        } else {
            topLoadingBar.style.display = 'none';
            // Body padding-top olib tashlash
            document.body.style.paddingTop = '0';
        }
    }
}

// Foydalanuvchi ma'lumotlarini yuklash
async function loadUserInfo() {
    try {
        const user = await apiRequest('/api/user');
        currentUser = user;
        currentTariff = user.tariff;
        
        // Tarif tekshiruvi
        if (!checkTariff(user.tariff)) {
            showLoading(false);
            return false;
        }
        
        // User ma'lumotlarini darhol ko'rsatish
        const userNameEl = document.getElementById('userName');
        const userInitialEl = document.getElementById('userInitial');
        if (userNameEl) {
            userNameEl.textContent = user.name || user.first_name || 'Foydalanuvchi';
        }
        if (userInitialEl) {
            userInitialEl.textContent = (user.name || user.first_name || 'U')[0].toUpperCase();
        }
        
        // Balance ni darhol ko'rsatish (user API dan kelgan)
        const balanceEl = document.getElementById('balanceAmount');
        if (balanceEl && user.balance !== undefined) {
            balanceEl.textContent = formatCurrencySimple(user.balance || 0, 'UZS');
        }
        
        return true;
    } catch (error) {
        console.error('Foydalanuvchi ma\'lumotlarini yuklashda xatolik:', error);
        
        // 401 xatosi bo'lsa, test mode haqida xabar ko'rsatish
        if (error.message && error.message.includes('Unauthorized')) {
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                const urlParams = new URLSearchParams(window.location.search);
                const testUserId = urlParams.get('test_user_id');
                
                if (!testUserId) {
                    loadingScreen.innerHTML = `
                        <div style="text-align: center; padding: 20px;">
                            <div style="font-size: 48px; margin-bottom: 16px;">🔐</div>
                            <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 8px; color: #333;">Autentifikatsiya kerak</h2>
                            <p style="color: #666; font-size: 14px; margin-bottom: 12px;">Iltimos, Telegram orqali oching yoki</p>
                            <p style="color: #999; font-size: 12px; margin-bottom: 20px;">Test mode uchun URL ga <code style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px;">?test_user_id=YOUR_ID</code> qo'shing</p>
                            <p style="color: #666; font-size: 12px; margin-bottom: 16px;">Masalan: <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 4px;">?test_user_id=123456789</code></p>
                            <button onclick="location.reload()" style="background: #1E88E5; color: white; border: none; border-radius: 12px; padding: 12px 24px; font-size: 14px; font-weight: 600; cursor: pointer;">
                                Qayta urinish
                            </button>
                        </div>
                    `;
                }
            }
        }
        
        return false;
    }
}

// Valyuta belgilari
const currencySymbols = {
    'USD': '$',
    'EUR': '€',
    'RUB': '₽',
    'TRY': '₺',
    'UZS': 'UZS'
};

const currencyIcons = {
    'USD': '$',
    'EUR': '€',
    'RUB': '₽',
    'TRY': '₺',
    'UZS': 'UZS'
};

// Valyuta balanslarini ko'rsatish
function renderCurrencyList(currencyBalances) {
    const container = document.getElementById('currencyList');
    if (!container) return;
    
    const currencies = ['USD', 'RUB', 'EUR', 'TRY', 'UZS'];
    const currencyIconsMap = {
        'USD': '$',
        'RUB': '₽',
        'EUR': '€',
        'TRY': '₺',
        'UZS': 'UZS'
    };
    
    let html = '';
    currencies.forEach(currency => {
        const balance = currencyBalances[currency] || 0;
        if (balance > 0 || currency === 'UZS') {
            const icon = currencyIconsMap[currency] || currency;
            const formattedBalance = formatCurrencySimple(balance, currency);
            
            html += `
                <div class="currency-item" onclick="showCurrencyDetails('${currency}')">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 40px; height: 40px; background: #f0f0f0; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 600; color: #1E88E5;">
                            ${icon}
                        </div>
                        <p style="font-size: 16px; font-weight: 500; color: #333; margin: 0;">${formattedBalance}</p>
                    </div>
                </div>
            `;
        }
    });
    
    if (html === '') {
        html = '<div style="padding: 20px; text-align: center; color: #999;">Valyuta balanslari mavjud emas</div>';
    }
    
    container.innerHTML = html;
}

// Soddalashtirilgan valyuta formatlash (faqat raqam)
function formatCurrencySimple(amount, currency = 'UZS') {
    const formatter = new Intl.NumberFormat('uz-UZ', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
    
    const formatted = formatter.format(amount);
    
    if (currency === 'UZS') {
        return `${formatted} so'm`;
    }
    
    return formatted;
}

// Valyuta tafsilotlarini ko'rsatish
function showCurrencyDetails(currency = null) {
    hapticFeedback('light');
    const modal = document.getElementById('currencyModal');
    const title = document.getElementById('currencyModalTitle');
    const content = document.getElementById('currencyModalContent');
    
    if (!currentUser || !currentUser.currency_balances) {
        return;
    }
    
    if (currency) {
        // Bitta valyuta tafsilotlari
        const balance = currentUser.currency_balances[currency] || 0;
        const currencyNames = {
            'USD': 'Dollar',
            'RUB': 'Rubl',
            'EUR': 'Yevro',
            'TRY': 'Lira',
            'UZS': 'So\'m'
        };
        
        title.textContent = `${currencyNames[currency] || currency} tafsilotlari`;
        content.innerHTML = `
            <div style="text-align: center; padding: 20px 0;">
                <div style="width: 80px; height: 80px; background: #f0f0f0; border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 600; margin: 0 auto 16px;">
                    ${currencyIcons[currency] || currency}
                </div>
                <h3 style="font-size: 24px; font-weight: 700; margin: 0 0 8px;">${formatCurrency(balance, currency)}</h3>
                <p style="color: #999; font-size: 14px; margin: 0;">${formatCurrency(balance * getCurrencyRate(currency), 'UZS')} (so'm)</p>
            </div>
        `;
    } else {
        // Barcha valyutalar tafsilotlari
        title.textContent = 'Valyuta tafsilotlari';
        const currencies = ['USD', 'RUB', 'EUR', 'TRY', 'UZS'];
        const currencyNames = {
            'USD': 'Dollar',
            'RUB': 'Rubl',
            'EUR': 'Yevro',
            'TRY': 'Lira',
            'UZS': 'So\'m'
        };
        
        let html = '';
        currencies.forEach(curr => {
            const balance = currentUser.currency_balances[curr] || 0;
            if (balance > 0 || curr === 'UZS') {
                html += `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 40px; height: 40px; background: #f0f0f0; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 600;">
                                ${currencyIcons[curr] || curr}
                            </div>
                            <div>
                                <p style="font-size: 14px; font-weight: 600; color: #333; margin: 0;">${currencyNames[curr] || curr}</p>
                                <p style="font-size: 12px; color: #999; margin: 4px 0 0;">${formatCurrency(balance * getCurrencyRate(curr), 'UZS')}</p>
                            </div>
                        </div>
                        <p style="font-size: 16px; font-weight: 700; color: #333; margin: 0;">${formatCurrency(balance, curr)}</p>
                    </div>
                `;
            }
        });
        
        content.innerHTML = html || '<div style="padding: 20px; text-align: center; color: #999;">Ma\'lumotlar mavjud emas</div>';
    }
    
    modal.classList.add('active');
}

// Valyuta kursini olish (default qiymatlar)
function getCurrencyRate(currency) {
    const rates = {
        'USD': 12750.0,
        'EUR': 13800.0,
        'RUB': 135.0,
        'TRY': 370.0,
        'UZS': 1.0
    };
    return rates[currency] || 1.0;
}

// So'nggi tranzaksiyalarni ko'rsatish (2 ta)
async function loadRecentTransactions() {
    try {
        // Timeout qo'shish - 5 soniyadan keyin to'xtatish
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
        );
        
        const transactions = await Promise.race([
            apiRequest('/api/transactions?limit=2'),
            timeoutPromise
        ]);
        
        const container = document.getElementById('recentTransactions');
        if (!container) return;
        
        if (transactions.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">Tranzaksiyalar mavjud emas</div>';
            return;
        }
        
        container.innerHTML = transactions.slice(0, 2).map(transaction => {
            const typeColor = transaction.transaction_type === 'income' ? '#10b981' : '#ef4444';
            
            const date = new Date(transaction.created_at);
            const now = new Date();
            const isToday = date.toDateString() === now.toDateString();
            const timeStr = date.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
            const dateStr = isToday ? `Bugun ${timeStr} da` : formatDate(transaction.created_at);
            
            return `
                <div class="transaction-card-mini">
                    <p style="font-size: 18px; font-weight: 700; color: ${typeColor}; margin: 0 0 8px;">
                        ${transaction.transaction_type === 'income' ? '+' : '-'}${formatCurrency(transaction.amount, transaction.currency)}
                    </p>
                    <p style="font-size: 14px; color: #333; margin: 0 0 4px; font-weight: 500;">${transaction.description || 'Tranzaksiya'}</p>
                    <p style="font-size: 12px; color: #999; margin: 0;">${transaction.category || ''} • ${dateStr}</p>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('So\'nggi tranzaksiyalarni yuklashda xatolik:', error);
        const container = document.getElementById('recentTransactions');
        if (container) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">Tranzaksiyalar yuklanmadi</div>';
        }
    }
}

// Statistika grafigini yaratish
let statisticsChart = null;
async function loadStatisticsChart() {
    try {
        // Timeout qo'shish - 5 soniyadan keyin to'xtatish
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
        );
        
        const stats = await Promise.race([
            apiRequest('/api/statistics?days=30'),
            timeoutPromise
        ]);
        
        const ctx = document.getElementById('statisticsChart');
        if (!ctx) return;
        
        // Oylik ma'lumotlar (mock data - keyinchalik API dan olinadi)
        const months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
        const data = [160, 170, 165, 180, 175]; // Mock data
        
        if (statisticsChart) {
            statisticsChart.destroy();
        }
        
        statisticsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: 'Balans',
                    data: data,
                    borderColor: '#1E88E5',
                    backgroundColor: 'rgba(30, 136, 229, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: '#f0f0f0'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Statistika grafigini yuklashda xatolik:', error);
        // Xatolik bo'lsa ham grafikni ko'rsatish (mock data bilan)
        const ctx = document.getElementById('statisticsChart');
        if (ctx && !statisticsChart) {
            const months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
            const data = [160, 170, 165, 180, 175];
            
            statisticsChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: months,
                    datasets: [{
                        label: 'Balans',
                        data: data,
                        borderColor: '#1E88E5',
                        backgroundColor: 'rgba(30, 136, 229, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: false,
                            grid: {
                                color: '#f0f0f0'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });
        }
    }
}

// Asosiy sahifa ma'lumotlarini yuklash (optimallashtirilgan - tezroq)
async function loadHomePage() {
    try {
        // Valyuta balanslarini ko'rsatish
        if (currentUser && currentUser.currency_balances) {
            try {
                renderCurrencyList(currentUser.currency_balances);
            } catch (err) {
                console.error('Valyuta ro\'yxatini ko\'rsatishda xatolik:', err);
            }
        } else {
            // Agar currency_balances yo'q bo'lsa, bo'sh ro'yxat ko'rsatish
            const container = document.getElementById('currencyList');
            if (container) {
                container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">Valyuta balanslari mavjud emas</div>';
            }
        }
        
        // Loading screen yashirish - asosiy ma'lumotlar yuklandi
        showLoading(false);
        
        // So'nggi tranzaksiyalarni va statistika grafigini background'da yuklash (non-blocking)
        setTimeout(() => {
            Promise.all([
                loadRecentTransactions().catch(err => console.error('Tranzaksiyalarni yuklashda xatolik:', err)),
                loadStatisticsChart().catch(err => console.error('Statistika grafigini yuklashda xatolik:', err))
            ]).catch(err => console.error('Background yuklashda xatolik:', err));
        }, 100);
        
    } catch (error) {
        console.error('Asosiy sahifa ma\'lumotlarini yuklashda xatolik:', error);
        showLoading(false);
    }
}

// Tranzaksiyalarni yuklash
async function loadTransactions(filter = 'all') {
    try {
        const endpoint = filter === 'all' ? '/api/transactions' : `/api/transactions?type=${filter}`;
        const transactions = await apiRequest(endpoint);
        
        const container = document.getElementById('transactionsList');
        if (!container) return;
        
        if (transactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <p>Tranzaksiyalar mavjud emas</p>
                </div>
            `;
            return;
        }

        container.innerHTML = transactions.map(transaction => {
            const typeClass = transaction.transaction_type === 'income' ? 'income' : 
                            transaction.transaction_type === 'expense' ? 'expense' : 'debt';
            const typeIcon = transaction.transaction_type === 'income' ? '📈' : 
                           transaction.transaction_type === 'expense' ? '📉' : '💳';
            const typeColor = transaction.transaction_type === 'income' ? '#10b981' : 
                            transaction.transaction_type === 'expense' ? '#ef4444' : '#f59e0b';
            
            return `
                <div class="transaction-item ${typeClass}">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                                <span style="font-size: 20px; margin-right: 8px;">${typeIcon}</span>
                                <span style="font-size: 12px; padding: 4px 8px; border-radius: 12px; background: ${typeColor}15; color: ${typeColor}; font-weight: 600;">
                                    ${getTransactionTypeLabel(transaction.transaction_type)}
                                </span>
                                ${transaction.category ? `<span style="font-size: 11px; color: #999; margin-left: 8px;">${transaction.category}</span>` : ''}
                            </div>
                            ${transaction.description ? `<p style="font-size: 14px; color: #333; margin: 4px 0; font-weight: 500;">${transaction.description}</p>` : ''}
                            <p style="font-size: 12px; color: #999; margin: 4px 0 0;">${formatDate(transaction.created_at)}</p>
                        </div>
                        <div style="text-align: right; margin-left: 16px;">
                            <p style="font-size: 18px; font-weight: 700; color: ${typeColor}; margin: 0;">
                                ${transaction.transaction_type === 'income' ? '+' : '-'}${formatCurrency(transaction.amount, transaction.currency)}
                            </p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Tranzaksiyalarni yuklashda xatolik:', error);
        const container = document.getElementById('transactionsList');
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <p>Ma'lumotlarni yuklashda xatolik</p>
            </div>
        `;
    }
}

// Statistika yuklash
async function loadStatistics() {
    try {
        const stats = await apiRequest('/api/statistics?days=30');
        const container = document.getElementById('statisticsContent');
        if (!container) return;
        
        container.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
                <div class="stat-item">
                    <div style="display: flex; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 20px; margin-right: 8px;">📈</span>
                        <span style="font-size: 12px; color: #666;">Kirim</span>
                    </div>
                    <p style="font-size: 20px; font-weight: 700; color: #10b981; margin: 0;">${formatCurrency(stats.income || 0, 'UZS')}</p>
                </div>
                <div class="stat-item">
                    <div style="display: flex; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 20px; margin-right: 8px;">📉</span>
                        <span style="font-size: 12px; color: #666;">Chiqim</span>
                    </div>
                    <p style="font-size: 20px; font-weight: 700; color: #ef4444; margin: 0;">${formatCurrency(stats.expense || 0, 'UZS')}</p>
                </div>
            </div>
            <div class="stat-item">
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 20px; margin-right: 8px;">💰</span>
                    <span style="font-size: 12px; color: #666;">Balans</span>
                </div>
                <p style="font-size: 24px; font-weight: 700; color: #667eea; margin: 0;">${formatCurrency(stats.balance || 0, 'UZS')}</p>
            </div>
        `;
    } catch (error) {
        console.error('Statistikani yuklashda xatolik:', error);
        const container = document.getElementById('statisticsContent');
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <p>Ma'lumotlarni yuklashda xatolik</p>
            </div>
        `;
    }
}

// Qarzlar yuklash
async function loadDebts() {
    try {
        const debts = await apiRequest('/api/debts');
        const container = document.getElementById('debtsList');
        if (!container) return;
        
        if (debts.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <p>Qarzlar mavjud emas</p>
                </div>
            `;
            return;
        }

        container.innerHTML = debts.map(debt => {
            const isLent = debt.debt_type === 'lent';
            const progress = debt.paid_amount > 0 ? (debt.paid_amount / debt.amount) * 100 : 0;
            
            return `
                <div class="card" style="padding: 16px; margin-bottom: 12px; border-left: 4px solid ${isLent ? '#3b82f6' : '#f59e0b'};">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                                <span style="font-size: 20px; margin-right: 8px;">${isLent ? '💙' : '🧡'}</span>
                                <span style="font-size: 12px; padding: 4px 8px; border-radius: 12px; background: ${isLent ? '#3b82f6' : '#f59e0b'}15; color: ${isLent ? '#3b82f6' : '#f59e0b'}; font-weight: 600;">
                                    ${isLent ? 'Qarz berdim' : 'Qarz oldim'}
                                </span>
                            </div>
                            <p style="font-size: 16px; font-weight: 700; color: #333; margin: 4px 0;">${debt.person_name}</p>
                            ${debt.due_date ? `<p style="font-size: 12px; color: #999; margin: 4px 0;">Muddat: ${formatDate(debt.due_date)}</p>` : ''}
                        </div>
                        <div style="text-align: right; margin-left: 16px;">
                            <p style="font-size: 18px; font-weight: 700; color: #333; margin: 0;">${formatCurrency(debt.amount, 'UZS')}</p>
                            ${debt.paid_amount > 0 ? `
                                <p style="font-size: 12px; color: #10b981; margin: 4px 0;">To'langan: ${formatCurrency(debt.paid_amount, 'UZS')}</p>
                                <p style="font-size: 12px; color: #999; margin: 0;">Qoldiq: ${formatCurrency(debt.amount - debt.paid_amount, 'UZS')}</p>
                            ` : ''}
                        </div>
                    </div>
                    ${debt.paid_amount > 0 ? `
                        <div style="margin-top: 12px;">
                            <div style="width: 100%; height: 6px; background: #e5e5e5; border-radius: 3px; overflow: hidden;">
                                <div style="height: 100%; background: linear-gradient(90deg, #10b981, #34d399); width: ${progress}%; transition: width 0.3s;"></div>
                            </div>
                            <p style="font-size: 11px; color: #999; text-align: right; margin: 4px 0 0;">${Math.round(progress)}% to'langan</p>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Qarzlarni yuklashda xatolik:', error);
        const container = document.getElementById('debtsList');
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <p>Ma'lumotlarni yuklashda xatolik</p>
            </div>
        `;
    }
}

// Eslatmalar yuklash
async function loadReminders() {
    try {
        const reminders = await apiRequest('/api/reminders');
        const container = document.getElementById('remindersList');
        if (!container) return;
        
        if (reminders.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⏰</div>
                    <p>Eslatmalar mavjud emas</p>
                </div>
            `;
            return;
        }

        container.innerHTML = reminders.map(reminder => {
            const reminderDate = new Date(reminder.reminder_date);
            const now = new Date();
            const isPast = reminderDate < now;
            const isToday = reminderDate.toDateString() === now.toDateString();
            const borderColor = isPast ? '#ef4444' : isToday ? '#f59e0b' : '#3b82f6';
            const icon = isPast ? '🔴' : isToday ? '🟡' : '🔵';
            
            return `
                <div class="card" style="padding: 16px; margin-bottom: 12px; border-left: 4px solid ${borderColor};">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                                <span style="font-size: 20px; margin-right: 8px;">${icon}</span>
                                <h3 style="font-size: 16px; font-weight: 700; color: #333; margin: 0;">${reminder.title}</h3>
                            </div>
                            ${reminder.description ? `<p style="font-size: 14px; color: #666; margin: 4px 0;">${reminder.description}</p>` : ''}
                            <div style="display: flex; gap: 16px; margin-top: 8px;">
                                <span style="font-size: 12px; color: #999;">${formatDate(reminder.reminder_date)}</span>
                                ${reminder.reminder_time ? `<span style="font-size: 12px; color: #999;">${reminder.reminder_time}</span>` : ''}
                            </div>
                        </div>
                        ${reminder.amount ? `
                            <div style="text-align: right; margin-left: 16px;">
                                <p style="font-size: 18px; font-weight: 700; color: #333; margin: 0;">${formatCurrency(reminder.amount, reminder.currency || 'UZS')}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Eslatmalarni yuklashda xatolik:', error);
        const container = document.getElementById('remindersList');
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <p>Ma'lumotlarni yuklashda xatolik</p>
            </div>
        `;
    }
}

// Helper funksiyalar
function formatCurrency(amount, currency = 'UZS') {
    const formatter = new Intl.NumberFormat('uz-UZ', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
    
    const formatted = formatter.format(amount);
    const symbols = {
        'UZS': 'so\'m',
        'USD': '$',
        'EUR': '€',
        'RUB': '₽',
        'TRY': '₺'
    };
    
    if (currency === 'UZS') {
        return `${formatted} ${symbols[currency] || currency}`;
    } else {
        return `${symbols[currency] || currency} ${formatted}`;
    }
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

function getTransactionTypeLabel(type) {
    const labels = {
        'income': 'Kirim',
        'expense': 'Chiqim',
        'debt': 'Qarz'
    };
    return labels[type] || type;
}

// Sahifa o'zgartirish - SPA (silliq va tez)
function switchPage(pageName) {
    // Agar bir xil sahifaga o'tmoqchi bo'lsa, hech narsa qilmaymiz
    if (currentPage === pageName) {
        return;
    }
    
    hapticFeedback('light');
    
    // Eski sahifani yashirish
    const oldPageElement = document.getElementById(`page${currentPage.charAt(0).toUpperCase() + currentPage.slice(1)}`);
    if (oldPageElement) {
        oldPageElement.classList.remove('active');
    }
    
    // Eski nav itemni deaktivatsiya qilish
    const oldNavItem = document.querySelector(`[data-page="${currentPage}"]`);
    if (oldNavItem) {
        oldNavItem.classList.remove('active');
    }
    
    // Yangi sahifani ko'rsatish
    currentPage = pageName;
    const newPageElement = document.getElementById(`page${pageName.charAt(0).toUpperCase() + pageName.slice(1)}`);
    if (newPageElement) {
        newPageElement.classList.add('active');
    }
    
    // Yangi nav itemni aktivatsiya qilish
    const newNavItem = document.querySelector(`[data-page="${pageName}"]`);
    if (newNavItem) {
        newNavItem.classList.add('active');
    }
    
    // Agar sahifa birinchi marta yuklanmoqchi bo'lsa, ma'lumotlarni yuklash
    if (!loadedPages.has(pageName)) {
        loadedPages.add(pageName);
        
        if (pageName === 'transactions') {
            loadTransactions(currentFilter);
        } else if (pageName === 'statistics') {
            loadStatistics();
        } else if (pageName === 'reminders') {
            loadReminders();
        } else if (pageName === 'debts') {
            loadDebts();
        }
    }
}

// Sahifa tekshiruvi - SPA uchun
function getCurrentPage() {
    return currentPage || 'home';
}

// Event listenerlar
document.addEventListener('DOMContentLoaded', async () => {
    // Asosiy sahifa boshlang'ich holati
    currentPage = 'home';
    loadedPages.add('home');
    
    // Asosiy loading screen
    showLoading(true);
    
    try {
        // Foydalanuvchi ma'lumotlarini yuklash
        const userLoaded = await loadUserInfo();
        if (!userLoaded) {
            // Xatolik bo'lsa, loading screen yashirish
            showLoading(false);
            return;
        }
        
        // Asosiy sahifa ma'lumotlarini yuklash
        await loadHomePage();
    } catch (error) {
        console.error('Yuklanishda xatolik:', error);
        showLoading(false);
        
        // Xatolik xabari ko'rsatish
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                    <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 8px; color: #333;">Xatolik</h2>
                    <p style="color: #666; font-size: 14px; margin-bottom: 12px;">Ilovani yuklashda xatolik yuz berdi.</p>
                    <p style="color: #999; font-size: 12px; margin-bottom: 20px;">Iltimos, Telegram orqali oching yoki test mode uchun URL ga ?test_user_id=YOUR_ID qo'shing</p>
                    <button onclick="location.reload()" style="background: #1E88E5; color: white; border: none; border-radius: 12px; padding: 12px 24px; font-size: 14px; font-weight: 600; cursor: pointer; margin-right: 8px;">
                        Qayta urinish
                    </button>
                </div>
            `;
        }
    }
    
    // Nav itemlar - SPA o'tish
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const pageName = e.currentTarget.getAttribute('data-page');
            switchPage(pageName);
        });
    });
    
    // Filter buttonlar
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            hapticFeedback('light');
            const filter = e.target.getAttribute('data-type');
            currentFilter = filter;
            
            // Buttonlarni aktivatsiya qilish
            document.querySelectorAll('.filter-btn').forEach(b => {
                b.style.background = 'white';
                b.style.color = '#666';
                b.style.borderColor = '#e5e5e5';
            });
            e.target.style.background = '#1E88E5';
            e.target.style.color = 'white';
            e.target.style.borderColor = '#1E88E5';
            
            loadTransactions(filter);
        });
    });
});
