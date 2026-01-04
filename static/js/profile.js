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
    tg.setHeaderColor('#1C1C1E');
    tg.setBackgroundColor('#f5f5f5');

    window.addEventListener('resize', ensureFullscreen);
    window.addEventListener('load', () => {
        setTimeout(ensureFullscreen, 100);
    });

    setInterval(ensureFullscreen, 500);
}

// Show skeleton
function showSkeleton() {
    const skeleton = document.getElementById('profileSkeleton');
    const content = document.getElementById('profileContent');
    if (skeleton) skeleton.style.display = 'block';
    if (content) content.style.display = 'none';
}

// Hide skeleton
function hideSkeleton() {
    const skeleton = document.getElementById('profileSkeleton');
    const content = document.getElementById('profileContent');
    if (skeleton) skeleton.style.display = 'none';
    if (content) content.style.display = 'block';
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
        document.getElementById('profileName').textContent = user.name || user.first_name || 'Foydalanuvchi';
        document.getElementById('profileUsername').textContent = user.username ? `@${user.username}` : '';

        // Avatar initials
        const name = user.name || user.first_name || 'U';
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        document.getElementById('profileAvatar').textContent = initials;

        // Tariff
        const tariff = user.tariff || 'NONE';
        const tariffBadge = document.getElementById('tariffBadge');
        const tariffIcon = document.getElementById('tariffIcon');
        const tariffName = document.getElementById('tariffName');
        const tariffStatus = document.getElementById('tariffStatus');

        tariffBadge.textContent = tariff;
        tariffBadge.className = `tariff-detail-badge ${tariff}`;
        tariffName.textContent = getTariffName(tariff);

        // Tariff icon
        const icons = {
            'NONE': '🆓',
            'FREE': '⭐',
            'PRO': '💎',
            'BUSINESS': '👔'
        };
        tariffIcon.textContent = icons[tariff] || '⭐';

        // Tariff status
        if (user.tariff_status) {
            tariffStatus.textContent = user.tariff_status === 'active' ? 'Faol' : user.tariff_status === 'trial' ? '7 kunlik sinov' : 'Nofaol';
        } else {
            tariffStatus.textContent = '-';
        }

        // Tariff details
        document.getElementById('tariffActiveStatus').textContent = user.tariff_status === 'active' ? 'Faol' : user.tariff_status === 'trial' ? 'Sinov davri' : 'Nofaol';

        // Trial status
        if (user.trial_expires_at) {
            const trialDate = new Date(user.trial_expires_at);
            const now = new Date();
            const daysLeft = Math.ceil((trialDate - now) / (1000 * 60 * 60 * 24));

            if (daysLeft > 0) {
                document.getElementById('trialStatus').textContent = `Faol (${daysLeft} kun qoldi)`;
            } else {
                document.getElementById('trialStatus').textContent = 'Tugagan';
            }
        } else {
            document.getElementById('trialStatus').textContent = '-';
        }

        // Start date
        if (user.tariff_start_date) {
            document.getElementById('tariffStartDate').textContent = formatDate(user.tariff_start_date);
        } else {
            document.getElementById('tariffStartDate').textContent = '-';
        }

        // End date
        if (user.tariff_expires_at) {
            document.getElementById('tariffEndDate').textContent = formatDate(user.tariff_expires_at);

            // Days left
            const endDate = new Date(user.tariff_expires_at);
            const now = new Date();
            const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

            if (daysLeft > 0) {
                const daysLeftContainer = document.getElementById('daysLeftContainer');
                daysLeftContainer.style.display = 'flex';
                document.getElementById('daysLeft').textContent = `${daysLeft} kun`;
            }
        } else {
            document.getElementById('tariffEndDate').textContent = 'Cheksiz';
        }

        // Balance
        document.getElementById('totalBalance').textContent = formatCurrency(user.balance || 0);
        document.getElementById('totalIncome').textContent = formatCurrency(user.total_income || 0);
        document.getElementById('totalExpense').textContent = formatCurrency(user.total_expense || 0);

        return user;
    } catch (error) {
        console.error('User yuklanmadi:', error);
        return null;
    }
}

function getTariffName(tariff) {
    const names = {
        'NONE': 'Tarif yo\'q',
        'FREE': 'Bepul',
        'PRO': 'Pro',
        'BUSINESS': 'Biznes'
    };
    return names[tariff] || tariff;
}

// Upgrade tariff
function upgradeTariff() {
    if (tg && tg.showAlert) {
        tg.showAlert('Tarifni yangilash uchun Telegram botga murojaat qiling');
    } else {
        alert('Tarifni yangilash uchun Telegram botga murojaat qiling');
    }
}

// Modal functions
function showLanguageModal() {
    if (tg && tg.showPopup) {
        tg.showPopup({
            title: 'Til',
            message: 'Tilni tanlang',
            buttons: [
                {id: 'uz', type: 'default', text: 'O\'zbek'},
                {id: 'ru', type: 'default', text: 'Русский'},
                {id: 'en', type: 'default', text: 'English'}
            ]
        });
    }
}

function showCurrencyModal() {
    if (tg && tg.showPopup) {
        tg.showPopup({
            title: 'Valyuta',
            message: 'Asosiy valyutani tanlang',
            buttons: [
                {id: 'uzs', type: 'default', text: 'UZS - So\'m'},
                {id: 'usd', type: 'default', text: 'USD - Dollar'},
                {id: 'eur', type: 'default', text: 'EUR - Euro'}
            ]
        });
    }
}

function showSupport() {
    if (tg && tg.openLink) {
        tg.openLink('https://t.me/balansai_support');
    }
}

function showAbout() {
    if (tg && tg.showAlert) {
        tg.showAlert('Balans AI v1.0.0\n\nMoliyaviy boshqaruv uchun smart yechim');
    }
}

function handleLogout() {
    if (tg && tg.showConfirm) {
        tg.showConfirm('Rostdan ham chiqmoqchimisiz?', (confirmed) => {
            if (confirmed) {
                window.location.href = '/';
            }
        });
    } else {
        if (confirm('Rostdan ham chiqmoqchimisiz?')) {
            window.location.href = '/';
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Show skeleton
    showSkeleton();

    // Load all data in parallel
    await Promise.all([
        loadUserData()
    ]);

    // Hide skeleton after loading
    hideSkeleton();
});
