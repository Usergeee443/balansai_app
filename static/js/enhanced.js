/**
 * Balans AI - Enhanced Features
 * Professional moliyaviy boshqaruv imkoniyatlari
 */

// ============================================
// DARK MODE
// ============================================

class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'light';
        this.init();
    }

    init() {
        this.applyTheme();
        this.createToggleButton();
    }

    applyTheme() {
        if (this.theme === 'dark') {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }

        // Telegram WebApp ranglarini yangilash
        if (window.Telegram?.WebApp) {
            const tg = window.Telegram.WebApp;
            if (this.theme === 'dark') {
                tg.setHeaderColor('#1e3a8a');
                tg.setBackgroundColor('#1a1a2e');
            } else {
                tg.setHeaderColor('#5A8EF4');
                tg.setBackgroundColor('#f5f5f5');
            }
        }
    }

    toggle() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', this.theme);
        this.applyTheme();
        this.updateToggleButton();
    }

    createToggleButton() {
        const button = document.createElement('button');
        button.className = 'theme-toggle';
        button.innerHTML = this.theme === 'dark'
            ? '<svg fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"/></svg>'
            : '<svg fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>';

        button.addEventListener('click', () => this.toggle());
        document.body.appendChild(button);
    }

    updateToggleButton() {
        const button = document.querySelector('.theme-toggle');
        if (button) {
            button.innerHTML = this.theme === 'dark'
                ? '<svg fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"/></svg>'
                : '<svg fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>';
        }
    }
}

// ============================================
// ADVANCED STATISTICS
// ============================================

class StatisticsManager {
    constructor() {
        this.charts = {};
        this.currentPeriod = 'month';
    }

    async loadDashboardStats() {
        const user = await this.getUserData();
        if (!user) return;

        this.createStatCards(user);
        await this.createExpenseChart();
        await this.createCategoryPieChart();
        await this.createTrendChart();
    }

    async getUserData() {
        try {
            const response = await fetch('/api/user', {
                headers: {
                    'X-Telegram-Init-Data': this.getInitData()
                }
            });
            return await response.json();
        } catch (error) {
            console.error('Failed to load user data:', error);
            return null;
        }
    }

    getInitData() {
        const tg = window.Telegram?.WebApp;
        return tg?.initData || '';
    }

    createStatCards(user) {
        const container = document.createElement('div');
        container.className = 'responsive-grid';
        container.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon income">💰</div>
                <div class="stat-content">
                    <div class="stat-label">Daromad</div>
                    <div class="stat-value">${this.formatCurrency(user.income || 0)}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon expense">💸</div>
                <div class="stat-content">
                    <div class="stat-label">Xarajat</div>
                    <div class="stat-value">${this.formatCurrency(user.expense || 0)}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon savings">💎</div>
                <div class="stat-content">
                    <div class="stat-label">Balans</div>
                    <div class="stat-value">${this.formatCurrency(user.balance || 0)}</div>
                </div>
            </div>
        `;

        const homeCards = document.querySelector('.home-cards-scroll');
        if (homeCards && homeCards.parentNode) {
            homeCards.parentNode.insertBefore(container, homeCards);
        }
    }

    async createExpenseChart() {
        const canvas = document.createElement('canvas');
        canvas.id = 'expenseChart';

        const container = document.createElement('div');
        container.className = 'chart-container';
        container.innerHTML = `
            <div class="chart-header">
                <div class="chart-title">Xarajatlar tahlili</div>
                <div class="chart-period">
                    <button class="period-btn active" data-period="week">Hafta</button>
                    <button class="period-btn" data-period="month">Oy</button>
                    <button class="period-btn" data-period="year">Yil</button>
                </div>
            </div>
        `;
        container.appendChild(canvas);

        const section = document.querySelector('.section');
        if (section && section.parentNode) {
            section.parentNode.insertBefore(container, section);
        }

        // Chart.js
        const ctx = canvas.getContext('2d');
        const data = await this.getExpenseData(this.currentPeriod);

        this.charts.expense = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Xarajatlar',
                    data: data.values,
                    borderColor: 'rgb(239, 68, 68)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => this.formatCurrency(value)
                        }
                    }
                }
            }
        });

        // Period tugmalari
        container.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                container.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                this.currentPeriod = btn.dataset.period;
                const newData = await this.getExpenseData(this.currentPeriod);

                this.charts.expense.data.labels = newData.labels;
                this.charts.expense.data.datasets[0].data = newData.values;
                this.charts.expense.update();
            });
        });
    }

    async createCategoryPieChart() {
        const canvas = document.createElement('canvas');
        canvas.id = 'categoryChart';

        const container = document.createElement('div');
        container.className = 'chart-container';
        container.innerHTML = '<div class="chart-title">Kategoriyalar bo\'yicha</div>';
        container.appendChild(canvas);

        const section = document.querySelector('.section');
        if (section) {
            section.parentNode.insertBefore(container, section.nextSibling);
        }

        const ctx = canvas.getContext('2d');
        const data = await this.getCategoryData();

        this.charts.category = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.values,
                    backgroundColor: [
                        '#f093fb',
                        '#4facfe',
                        '#43e97b',
                        '#fa709a',
                        '#30cfd0',
                        '#a8edea',
                        '#ff9a9e',
                        '#ffecd2'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    async createTrendChart() {
        const canvas = document.createElement('canvas');
        canvas.id = 'trendChart';

        const container = document.createElement('div');
        container.className = 'chart-container';
        container.innerHTML = '<div class="chart-title">Daromad vs Xarajat</div>';
        container.appendChild(canvas);

        const section = document.querySelector('.section');
        if (section && section.nextSibling) {
            section.parentNode.insertBefore(container, section.nextSibling.nextSibling);
        }

        const ctx = canvas.getContext('2d');
        const data = await this.getTrendData();

        this.charts.trend = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: 'Daromad',
                        data: data.income,
                        backgroundColor: 'rgba(16, 185, 129, 0.8)'
                    },
                    {
                        label: 'Xarajat',
                        data: data.expense,
                        backgroundColor: 'rgba(239, 68, 68, 0.8)'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => this.formatCurrency(value)
                        }
                    }
                }
            }
        });
    }

    async getExpenseData(period) {
        // Mock data - bu yerda backend API'dan real data olinadi
        const days = period === 'week' ? 7 : period === 'month' ? 30 : 365;
        const labels = [];
        const values = [];

        for (let i = 0; i < Math.min(days, 12); i++) {
            labels.push(`Kun ${i + 1}`);
            values.push(Math.random() * 1000000);
        }

        return { labels, values };
    }

    async getCategoryData() {
        // Mock data
        return {
            labels: ['Oziq-ovqat', 'Transport', 'Xarid', 'Hisob-kitoblar', 'Ko\'ngilochar', 'Sog\'liq', 'Ta\'lim', 'Boshqa'],
            values: [300000, 150000, 250000, 200000, 100000, 120000, 180000, 80000]
        };
    }

    async getTrendData() {
        // Mock data
        return {
            labels: ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun'],
            income: [5000000, 5500000, 6000000, 5800000, 6200000, 6500000],
            expense: [4000000, 4200000, 4500000, 4800000, 4600000, 4900000]
        };
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
    }
}

// ============================================
// BUDGET MANAGER
// ============================================

class BudgetManager {
    constructor() {
        this.budgets = this.loadBudgets();
    }

    loadBudgets() {
        const saved = localStorage.getItem('budgets');
        return saved ? JSON.parse(saved) : [];
    }

    saveBudgets() {
        localStorage.setItem('budgets', JSON.stringify(this.budgets));
    }

    addBudget(category, amount, period = 'month') {
        const budget = {
            id: Date.now(),
            category,
            amount,
            period,
            spent: 0,
            createdAt: new Date().toISOString()
        };

        this.budgets.push(budget);
        this.saveBudgets();
        return budget;
    }

    updateBudgetSpent(budgetId, spent) {
        const budget = this.budgets.find(b => b.id === budgetId);
        if (budget) {
            budget.spent = spent;
            this.saveBudgets();
        }
    }

    getBudgetStatus(budget) {
        const percentage = (budget.spent / budget.amount) * 100;

        if (percentage >= 90) return 'danger';
        if (percentage >= 70) return 'warning';
        return 'safe';
    }

    renderBudgets(container) {
        container.innerHTML = '';

        this.budgets.forEach(budget => {
            const percentage = (budget.spent / budget.amount) * 100;
            const status = this.getBudgetStatus(budget);

            const card = document.createElement('div');
            card.className = 'budget-card';
            card.innerHTML = `
                <div class="budget-header">
                    <div class="budget-category">${budget.category}</div>
                    <div class="budget-percentage ${status}">${percentage.toFixed(0)}%</div>
                </div>
                <div class="budget-amounts">
                    <span class="budget-spent">${this.formatCurrency(budget.spent)}</span>
                    <span class="budget-total">${this.formatCurrency(budget.amount)}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
            `;

            container.appendChild(card);
        });
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
    }
}

// ============================================
// GOALS MANAGER
// ============================================

class GoalsManager {
    constructor() {
        this.goals = this.loadGoals();
    }

    loadGoals() {
        const saved = localStorage.getItem('goals');
        return saved ? JSON.parse(saved) : [];
    }

    saveGoals() {
        localStorage.setItem('goals', JSON.stringify(this.goals));
    }

    addGoal(title, description, targetAmount, icon = '🎯') {
        const goal = {
            id: Date.now(),
            title,
            description,
            targetAmount,
            currentAmount: 0,
            icon,
            createdAt: new Date().toISOString()
        };

        this.goals.push(goal);
        this.saveGoals();
        return goal;
    }

    updateGoalProgress(goalId, amount) {
        const goal = this.goals.find(g => g.id === goalId);
        if (goal) {
            goal.currentAmount = Math.min(amount, goal.targetAmount);
            this.saveGoals();
        }
    }

    renderGoals(container) {
        container.innerHTML = '';

        this.goals.forEach(goal => {
            const percentage = (goal.currentAmount / goal.targetAmount) * 100;

            const card = document.createElement('div');
            card.className = 'goal-card';
            card.innerHTML = `
                <div class="goal-icon">${goal.icon}</div>
                <div class="goal-title">${goal.title}</div>
                <div class="goal-description">${goal.description}</div>
                <div class="goal-progress">
                    <div class="goal-current">${this.formatCurrency(goal.currentAmount)}</div>
                    <div class="goal-target">/ ${this.formatCurrency(goal.targetAmount)}</div>
                </div>
                <div class="goal-progress-bar">
                    <div class="goal-progress-fill" style="width: ${percentage}%"></div>
                </div>
            `;

            container.appendChild(card);
        });
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
    }
}

// ============================================
// CURRENCY CONVERTER
// ============================================

class CurrencyConverter {
    constructor() {
        this.rates = {};
        this.lastUpdate = null;
        this.updateRates();
    }

    async updateRates() {
        try {
            // CBU API dan real kurslarni olish
            const response = await fetch('https://cbu.uz/uz/arkhiv-kursov-valyut/json/');
            const data = await response.json();

            this.rates = {
                'USD': parseFloat(data.find(r => r.Ccy === 'USD')?.Rate || 0),
                'EUR': parseFloat(data.find(r => r.Ccy === 'EUR')?.Rate || 0),
                'RUB': parseFloat(data.find(r => r.Ccy === 'RUB')?.Rate || 0),
                'UZS': 1
            };

            this.lastUpdate = new Date();
            localStorage.setItem('currencyRates', JSON.stringify({
                rates: this.rates,
                lastUpdate: this.lastUpdate
            }));
        } catch (error) {
            console.error('Failed to update currency rates:', error);
            // Saqlangan kurslardan foydalanish
            const saved = localStorage.getItem('currencyRates');
            if (saved) {
                const data = JSON.parse(saved);
                this.rates = data.rates;
                this.lastUpdate = new Date(data.lastUpdate);
            }
        }
    }

    convert(amount, from, to) {
        if (from === to) return amount;

        // UZS ga o'tkazish
        const inUZS = from === 'UZS' ? amount : amount * this.rates[from];

        // Kerakli valyutaga o'tkazish
        return to === 'UZS' ? inUZS : inUZS / this.rates[to];
    }

    formatRate(currency) {
        return `1 ${currency} = ${this.rates[currency].toLocaleString('uz-UZ')} UZS`;
    }
}

// ============================================
// REMINDER SYSTEM
// ============================================

class ReminderSystem {
    constructor() {
        this.reminders = this.loadReminders();
        this.checkReminders();
        setInterval(() => this.checkReminders(), 60000); // Har daqiqada tekshirish
    }

    loadReminders() {
        const saved = localStorage.getItem('reminders');
        return saved ? JSON.parse(saved) : [];
    }

    saveReminders() {
        localStorage.setItem('reminders', JSON.stringify(this.reminders));
    }

    addReminder(title, amount, date, repeat = 'none') {
        const reminder = {
            id: Date.now(),
            title,
            amount,
            date: new Date(date).toISOString(),
            repeat,
            completed: false,
            createdAt: new Date().toISOString()
        };

        this.reminders.push(reminder);
        this.saveReminders();
        return reminder;
    }

    checkReminders() {
        const now = new Date();

        this.reminders.forEach(reminder => {
            if (reminder.completed) return;

            const reminderDate = new Date(reminder.date);
            if (reminderDate <= now) {
                this.triggerReminder(reminder);

                if (reminder.repeat !== 'none') {
                    this.scheduleNextReminder(reminder);
                } else {
                    reminder.completed = true;
                }

                this.saveReminders();
            }
        });
    }

    triggerReminder(reminder) {
        // Telegram notification
        if (window.Telegram?.WebApp) {
            const tg = window.Telegram.WebApp;
            if (tg.showAlert) {
                tg.showAlert(`Eslatma: ${reminder.title}\nSumma: ${this.formatCurrency(reminder.amount)}`);
            }
        }

        // Browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Balans AI Eslatma', {
                body: `${reminder.title} - ${this.formatCurrency(reminder.amount)}`,
                icon: '/static/logo.png'
            });
        }
    }

    scheduleNextReminder(reminder) {
        const currentDate = new Date(reminder.date);

        switch (reminder.repeat) {
            case 'daily':
                currentDate.setDate(currentDate.getDate() + 1);
                break;
            case 'weekly':
                currentDate.setDate(currentDate.getDate() + 7);
                break;
            case 'monthly':
                currentDate.setMonth(currentDate.getMonth() + 1);
                break;
            case 'yearly':
                currentDate.setFullYear(currentDate.getFullYear() + 1);
                break;
        }

        reminder.date = currentDate.toISOString();
        reminder.completed = false;
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
    }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Dark mode
    window.themeManager = new ThemeManager();

    // Statistics
    window.statsManager = new StatisticsManager();
    window.statsManager.loadDashboardStats();

    // Budget
    window.budgetManager = new BudgetManager();

    // Goals
    window.goalsManager = new GoalsManager();

    // Currency
    window.currencyConverter = new CurrencyConverter();

    // Reminders
    window.reminderSystem = new ReminderSystem();

    // Notification permission so'rash
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});
