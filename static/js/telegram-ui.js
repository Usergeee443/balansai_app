/**
 * Balans AI - Telegram UI Enhancements
 * Telegram Web App haptic feedback, animations, and UI improvements
 */

// ============================================
// TELEGRAM HAPTIC FEEDBACK
// ============================================

const TelegramUI = {
    // Haptic feedback helper
    haptic: {
        light: () => {
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
            }
        },
        medium: () => {
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
            }
        },
        heavy: () => {
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.impactOccurred('heavy');
            }
        },
        success: () => {
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
        },
        error: () => {
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
            }
        },
        warning: () => {
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
            }
        },
        selection: () => {
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.selectionChanged();
            }
        }
    },

    // Initialize Telegram theme
    initTheme: () => {
        const tg = window.Telegram?.WebApp;
        if (!tg) return;

        // Apply Telegram theme colors
        const isDark = tg.colorScheme === 'dark';
        document.body.classList.toggle('dark-mode', isDark);

        // Set CSS variables from Telegram theme
        const root = document.documentElement;
        const params = tg.themeParams;

        if (params.bg_color) root.style.setProperty('--tg-theme-bg-color', params.bg_color);
        if (params.text_color) root.style.setProperty('--tg-theme-text-color', params.text_color);
        if (params.hint_color) root.style.setProperty('--tg-theme-hint-color', params.hint_color);
        if (params.link_color) root.style.setProperty('--tg-theme-link-color', params.link_color);
        if (params.button_color) root.style.setProperty('--tg-theme-button-color', params.button_color);
        if (params.button_text_color) root.style.setProperty('--tg-theme-button-text-color', params.button_text_color);
        if (params.secondary_bg_color) root.style.setProperty('--tg-theme-secondary-bg-color', params.secondary_bg_color);

        // Listen for theme changes
        tg.onEvent('themeChanged', () => {
            const isDark = tg.colorScheme === 'dark';
            document.body.classList.toggle('dark-mode', isDark);
        });
    },

    // Add haptic to all clickable elements
    addHapticToElements: () => {
        // Navigation tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => TelegramUI.haptic.selection());
        });

        // Buttons
        document.querySelectorAll('button, .btn-primary, .btn-secondary').forEach(btn => {
            btn.addEventListener('click', () => TelegramUI.haptic.light());
        });

        // Cards
        document.querySelectorAll('.service-card, .home-service-card, .transaction-item').forEach(card => {
            card.addEventListener('click', () => TelegramUI.haptic.light());
        });

        // Toggle switches
        document.querySelectorAll('.toggle-switch input').forEach(toggle => {
            toggle.addEventListener('change', () => TelegramUI.haptic.medium());
        });
    },

    // Update balance with currency breakdown
    updateBalance: (currencies) => {
        const container = document.getElementById('balanceCurrencies');
        if (!container) return;

        const currencyFlags = {
            'UZS': '🇺🇿',
            'USD': '🇺🇸',
            'EUR': '🇪🇺',
            'RUB': '🇷🇺'
        };

        const html = currencies.map(curr => `
            <div class="balance-currency-item">
                <span class="balance-currency-flag">${currencyFlags[curr.code] || '💰'}</span>
                <span class="balance-currency-amount">${formatNumber(curr.amount)}</span>
                <span class="balance-currency-code">${curr.code}</span>
            </div>
        `).join('');

        container.innerHTML = html;
    }
};

// ============================================
// LAZY LOADING FOR TRANSACTIONS
// ============================================

const TransactionsLazyLoader = {
    page: 1,
    loading: false,
    hasMore: true,
    container: null,

    init: () => {
        TransactionsLazyLoader.container = document.getElementById('transactionsContainer');
        if (!TransactionsLazyLoader.container) return;

        // Load initial transactions (today and yesterday)
        TransactionsLazyLoader.loadInitial();

        // Set up infinite scroll
        TransactionsLazyLoader.setupInfiniteScroll();
    },

    loadInitial: async () => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const todayStr = formatDate(today);
        const yesterdayStr = formatDate(yesterday);

        // Load today's transactions
        await TransactionsLazyLoader.loadTransactionsForDate(todayStr, 'Bugun');

        // Load yesterday's transactions
        await TransactionsLazyLoader.loadTransactionsForDate(yesterdayStr, 'Kecha');

        TransactionsLazyLoader.page = 2;
    },

    loadTransactionsForDate: async (date, label) => {
        try {
            const response = await fetch(`/api/transactions?date=${date}`);
            const data = await response.json();

            if (data.success && data.transactions.length > 0) {
                const group = document.createElement('div');
                group.className = 'transaction-date-group';
                group.innerHTML = `
                    <div class="transaction-date-header">${label}</div>
                    ${data.transactions.map(t => TransactionsLazyLoader.renderTransaction(t)).join('')}
                `;
                TransactionsLazyLoader.container.appendChild(group);
            }
        } catch (error) {
            console.error('Error loading transactions:', error);
        }
    },

    renderTransaction: (transaction) => {
        const isIncome = transaction.type === 'income';
        const amount = formatMoney(Math.abs(transaction.amount), transaction.currency);
        const icon = TransactionsLazyLoader.getCategoryIcon(transaction.category);

        return `
            <div class="transaction-item" onclick="TelegramUI.haptic.light(); showTransactionDetails(${transaction.id})">
                <div class="transaction-icon">${icon}</div>
                <div class="transaction-content">
                    <div class="transaction-title">${transaction.description || transaction.category}</div>
                    <div class="transaction-subtitle">${transaction.category} • ${formatTime(transaction.created_at)}</div>
                </div>
                <div class="transaction-amount ${isIncome ? 'income' : 'expense'}">
                    ${isIncome ? '+' : '-'}${amount}
                </div>
            </div>
        `;
    },

    getCategoryIcon: (category) => {
        const icons = {
            'Oziq-ovqat': '🍽',
            'Transport': '🚗',
            'Uy-joy': '🏠',
            'Ko\'ngilochar': '🎬',
            'Kiyim': '👕',
            'Sog\'liq': '🏥',
            'Ta\'lim': '📚',
            'Kommunal': '💡',
            'Boshqa': '📦',
            'Ish haqi': '💼',
            'Biznes': '💰',
            'Investitsiya': '📈'
        };
        return icons[category] || '💰';
    },

    setupInfiniteScroll: () => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !TransactionsLazyLoader.loading && TransactionsLazyLoader.hasMore) {
                    TransactionsLazyLoader.loadMore();
                }
            });
        }, {
            rootMargin: '100px'
        });

        // Create loader element
        const loader = document.createElement('div');
        loader.id = 'transactionsLoader';
        loader.className = 'transactions-loading';
        loader.innerHTML = 'Yuklanmoqda...';
        TransactionsLazyLoader.container.appendChild(loader);

        observer.observe(loader);
    },

    loadMore: async () => {
        if (TransactionsLazyLoader.loading || !TransactionsLazyLoader.hasMore) return;

        TransactionsLazyLoader.loading = true;
        const loader = document.getElementById('transactionsLoader');
        if (loader) loader.style.display = 'block';

        try {
            const response = await fetch(`/api/transactions?page=${TransactionsLazyLoader.page}&limit=20`);
            const data = await response.json();

            if (data.success && data.transactions.length > 0) {
                const groupedByDate = TransactionsLazyLoader.groupByDate(data.transactions);

                Object.keys(groupedByDate).forEach(date => {
                    const group = document.createElement('div');
                    group.className = 'transaction-date-group';
                    group.innerHTML = `
                        <div class="transaction-date-header">${formatDateHeader(date)}</div>
                        ${groupedByDate[date].map(t => TransactionsLazyLoader.renderTransaction(t)).join('')}
                    `;
                    TransactionsLazyLoader.container.insertBefore(group, loader);
                });

                TransactionsLazyLoader.page++;

                if (data.transactions.length < 20) {
                    TransactionsLazyLoader.hasMore = false;
                    if (loader) loader.innerHTML = 'Barchasi yuklandi';
                }
            } else {
                TransactionsLazyLoader.hasMore = false;
                if (loader) loader.innerHTML = 'Barchasi yuklandi';
            }
        } catch (error) {
            console.error('Error loading more transactions:', error);
            if (loader) loader.innerHTML = 'Xatolik yuz berdi';
        }

        TransactionsLazyLoader.loading = false;
    },

    groupByDate: (transactions) => {
        const grouped = {};
        transactions.forEach(t => {
            const date = t.created_at.split(' ')[0];
            if (!grouped[date]) grouped[date] = [];
            grouped[date].push(t);
        });
        return grouped;
    }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatNumber(num) {
    return new Intl.NumberFormat('uz-UZ').format(num);
}

function formatMoney(amount, currency = 'UZS') {
    const formatted = formatNumber(Math.round(amount));
    const symbols = { 'UZS': 'so\'m', 'USD': '$', 'EUR': '€', 'RUB': '₽' };
    return `${formatted} ${symbols[currency] || currency}`;
}

function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatTime(datetime) {
    const d = new Date(datetime);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function formatDateHeader(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (formatDate(date) === formatDate(today)) return 'Bugun';
    if (formatDate(date) === formatDate(yesterday)) return 'Kecha';

    const months = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
    return `${date.getDate()} ${months[date.getMonth()]}`;
}

// ============================================
// INITIALIZE ON LOAD
// ============================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        TelegramUI.initTheme();
        TelegramUI.addHapticToElements();
    });
} else {
    TelegramUI.initTheme();
    TelegramUI.addHapticToElements();
}

// Export for global use
window.TelegramUI = TelegramUI;
window.TransactionsLazyLoader = TransactionsLazyLoader;
