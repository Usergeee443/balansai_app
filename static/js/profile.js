/**
 * Profile Page JavaScript
 * Alohida Profile Mini App
 */

const tg = window.Telegram?.WebApp || null;

// Telegram WebApp sozlamalari
if (tg) {
    tg.ready();
    
    // Fullscreen qilish
    function ensureFullscreen() {
        if (!tg.isExpanded) {
            tg.expand();
        }
    }
    
    ensureFullscreen();
    
    if (tg.viewportStableHeight !== undefined) {
        tg.viewportStableHeight = window.innerHeight;
    }
    
    // Pull-to-close'ni bloklash
    if (tg.disableVerticalSwipes) {
        tg.disableVerticalSwipes();
    }
    
    if (tg.BackButton) {
        tg.BackButton.hide();
    }
    
    tg.enableClosingConfirmation();
    tg.setHeaderColor('#5A8EF4');
    tg.setBackgroundColor('#f5f5f5');
    
    window.addEventListener('resize', ensureFullscreen);
    window.addEventListener('load', () => {
        setTimeout(ensureFullscreen, 100);
    });
    
    setInterval(ensureFullscreen, 500);
}

// Utility functions
function formatCurrency(amount, currency = 'UZS') {
    const num = parseFloat(amount) || 0;
    const formatted = new Intl.NumberFormat('uz-UZ').format(num);
    return currency === 'UZS' ? `${formatted} so'm` : formatted;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('uz-UZ', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('uz-UZ', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// API functions
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

// Load user data
async function loadUserData() {
    try {
        const user = await apiRequest('/api/user');
        
        // User info
        document.getElementById('userName').textContent = user.name || user.first_name || 'Foydalanuvchi';
        document.getElementById('userUsername').textContent = user.username ? `@${user.username}` : '';
        document.getElementById('userId').textContent = user.user_id || '-';
        
        // Avatar initials
        const name = user.name || user.first_name || 'U';
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        document.getElementById('userInitials').textContent = initials;
        
        // Tariff
        const tariff = user.tariff || 'NONE';
        const tariffBadge = document.getElementById('tariffBadge');
        tariffBadge.textContent = tariff;
        tariffBadge.className = `tariff-badge ${tariff}`;
        
        document.getElementById('tariffType').textContent = getTariffName(tariff);
        document.getElementById('tariffExpires').textContent = user.tariff_expires_at 
            ? formatDate(user.tariff_expires_at) 
            : 'Cheksiz';
        
        // Balance
        document.getElementById('totalBalance').textContent = formatCurrency(user.balance || 0);
        document.getElementById('totalIncome').textContent = formatCurrency(user.income || 0);
        document.getElementById('totalExpense').textContent = formatCurrency(user.expense || 0);
        
        // Currency badges
        const currencyBadges = document.getElementById('currencyBadges');
        if (user.currency_balances && Object.keys(user.currency_balances).length > 0) {
            currencyBadges.innerHTML = Object.entries(user.currency_balances)
                .filter(([_, balance]) => Math.abs(balance) > 0.01)
                .map(([currency, balance]) => {
                    const formatted = formatCurrency(balance, currency);
                    return `<span class="currency-badge">${currency}: ${formatted}</span>`;
                }).join('');
        } else {
            currencyBadges.innerHTML = '<span class="currency-badge">UZS: 0 so\'m</span>';
        }
        
        return user;
    } catch (error) {
        console.error('User yuklanmadi:', error);
        return null;
    }
}

function getTariffName(tariff) {
    const names = {
        'NONE': 'Tarif yo\'q',
        'PLUS': 'Plus',
        'PRO': 'Pro',
        'FAMILY': 'Family',
        'FAMILY_PLUS': 'Family Plus',
        'FAMILY_PRO': 'Family Pro'
    };
    return names[tariff] || tariff;
}

// Load payments history
async function loadPayments() {
    const container = document.getElementById('paymentsList');
    
    try {
        // Tarif to'lovlari tarixi
        const payments = await apiRequest('/api/profile/payments?limit=10');
        
        if (!payments || payments.length === 0) {
            container.innerHTML = '<div class="empty-state">Tarif to\'lovlari tarixi yo\'q</div>';
            return;
        }
        
        container.innerHTML = payments.map(p => {
            const amount = formatCurrency(p.amount, p.currency || 'UZS');
            const date = formatDateTime(p.created_at);
            const title = p.description || 'Tarif to\'lovi';
            
            return `
                <div class="payment-item">
                    <div class="payment-info">
                        <div class="payment-title">${title}</div>
                        <div class="payment-date">${date}</div>
                    </div>
                    <div class="payment-amount expense">-${amount}</div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('To\'lovlar yuklanmadi:', error);
        container.innerHTML = '<div class="empty-state">Xatolik yuz berdi</div>';
    }
}

// Load additional info
async function loadAdditionalInfo() {
    try {
        const user = await apiRequest('/api/user');
        
        if (user) {
            // Registered date va last activity
            // Bu ma'lumotlar user API'dan kelmaydi, shuning uchun hozircha default qoldiramiz
            const registeredDate = document.getElementById('registeredDate');
            if (registeredDate) {
                registeredDate.textContent = 'Ma\'lumot yo\'q';
            }
            
            const lastActivity = document.getElementById('lastActivity');
            if (lastActivity) {
                lastActivity.textContent = 'Bugun';
            }
        }
    } catch (error) {
        console.error('Qo\'shimcha ma\'lumotlar yuklanmadi:', error);
    }
}

// Settings modal
function showSettingsModal(type) {
    const modal = document.getElementById('settingsModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    const settings = {
        language: {
            title: 'Tilni tanlang',
            content: `
                <div class="setting-option" onclick="selectSetting('language', 'uz')">
                    <span>O'zbek</span>
                    <span>✓</span>
                </div>
                <div class="setting-option" onclick="selectSetting('language', 'ru')">
                    <span>Русский</span>
                </div>
                <div class="setting-option" onclick="selectSetting('language', 'en')">
                    <span>English</span>
                </div>
            `
        },
        currency: {
            title: 'Asosiy valyuta',
            content: `
                <div class="setting-option" onclick="selectSetting('currency', 'UZS')">
                    <span>UZS - So'm</span>
                    <span>✓</span>
                </div>
                <div class="setting-option" onclick="selectSetting('currency', 'USD')">
                    <span>USD - Dollar</span>
                </div>
                <div class="setting-option" onclick="selectSetting('currency', 'EUR')">
                    <span>EUR - Euro</span>
                </div>
            `
        },
        notifications: {
            title: 'Bildirishnomalar',
            content: `
                <div class="setting-option" onclick="selectSetting('notifications', 'on')">
                    <span>Yoqilgan</span>
                    <span>✓</span>
                </div>
                <div class="setting-option" onclick="selectSetting('notifications', 'off')">
                    <span>O'chirilgan</span>
                </div>
            `
        },
        theme: {
            title: 'Mavzu',
            content: `
                <div class="setting-option" onclick="selectSetting('theme', 'light')">
                    <span>Yorug'</span>
                    <span>✓</span>
                </div>
                <div class="setting-option" onclick="selectSetting('theme', 'dark')">
                    <span>Qorong'i</span>
                </div>
            `
        }
    };
    
    const setting = settings[type];
    if (setting) {
        modalTitle.textContent = setting.title;
        modalBody.innerHTML = setting.content;
        modal.classList.add('active');
    }
}

function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('active');
}

function selectSetting(type, value) {
    // Bu yerda sozlamalarni saqlash logikasi bo'lishi kerak
    console.log(`Setting selected: ${type} = ${value}`);
    closeSettingsModal();
    // TODO: API orqali sozlamalarni saqlash
}

function showAllPayments() {
    // Barcha to'lovlarni ko'rsatish (kelajakda alohida sahifa yaratish mumkin)
    window.location.href = '/profile';
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Load all data in parallel
    await Promise.all([
        loadUserData(),
        loadPayments(),
        loadAdditionalInfo()
    ]);
});

