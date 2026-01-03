/**
 * Balans AI - Advanced Statistics
 * Telegram-style statistics with 10+ analytics
 */

// Helper functions
function formatMoney(amount, currency = 'UZS') {
    const num = parseFloat(amount) || 0;
    const formatted = new Intl.NumberFormat('uz-UZ').format(num);
    return currency === 'UZS' ? `${formatted} so'm` : `${formatted} ${currency}`;
}

function formatNumber(num) {
    const n = parseFloat(num) || 0;
    return new Intl.NumberFormat('uz-UZ').format(n);
}

const StatisticsManager = {
    charts: {},
    currentPeriod: 'week',

    // Initialize statistics page
    init: async () => {
        await StatisticsManager.loadStatistics('week');
    },

    // Load statistics for period
    loadStatistics: async (period) => {
        try {
            StatisticsManager.currentPeriod = period;

            // Update active period button
            document.querySelectorAll('.period-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.period === period);
            });

            // Fetch statistics data
            const response = await fetch(`/api/statistics?period=${period}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            // API'dan qaytgan ma'lumotlar mavjud bo'lsa, render qilish
            if (data && !data.error) {
                StatisticsManager.updateOverview(data);
                StatisticsManager.renderBalanceTrend(data);
                StatisticsManager.renderIncomeExpense(data);
                StatisticsManager.renderCategoryBreakdown(data);
                StatisticsManager.renderDailySpending(data);
                StatisticsManager.renderTopCategories(data);
                StatisticsManager.renderSavingsRate(data);
                StatisticsManager.renderTransactionCount(data);
                StatisticsManager.renderAverageTransaction(data);
                StatisticsManager.renderCurrencyDistribution(data);
                StatisticsManager.renderWeeklyComparison(data);
            } else {
                console.error('Statistics API error:', data.error || 'Unknown error');
            }
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    },

    // Update overview cards
    updateOverview: (data) => {
        const income = data.total_income || 0;
        const expense = data.total_expense || 0;
        const net = income - expense;

        document.getElementById('statIncome').textContent = formatMoney(income);
        document.getElementById('statExpense').textContent = formatMoney(expense);
        document.getElementById('statNet').textContent = formatMoney(net);
        document.getElementById('statNet').className = `overview-stat-value ${net >= 0 ? 'positive' : 'negative'}`;
    },

    // 1. Balance Trend Chart
    renderBalanceTrend: (data) => {
        const ctx = document.getElementById('balanceTrendChart');
        if (!ctx) return;

        if (StatisticsManager.charts.balanceTrend) {
            StatisticsManager.charts.balanceTrend.destroy();
        }

        const trendData = data.balance_trend || [];

        StatisticsManager.charts.balanceTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: trendData.map(d => d.date),
                datasets: [{
                    label: 'Balans',
                    data: trendData.map(d => d.balance),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => formatNumber(value)
                        }
                    }
                }
            }
        });
    },

    // 2. Income vs Expense Chart
    renderIncomeExpense: (data) => {
        const ctx = document.getElementById('incomeExpenseChart');
        if (!ctx) return;

        if (StatisticsManager.charts.incomeExpense) {
            StatisticsManager.charts.incomeExpense.destroy();
        }

        const monthlyData = data.monthly_comparison || [];

        StatisticsManager.charts.incomeExpense = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: monthlyData.map(d => d.month),
                datasets: [
                    {
                        label: 'Kirim',
                        data: monthlyData.map(d => d.income),
                        backgroundColor: '#4CAF50'
                    },
                    {
                        label: 'Chiqim',
                        data: monthlyData.map(d => d.expense),
                        backgroundColor: '#FF5252'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                plugins: {
                    legend: { position: 'top' }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => formatNumber(value)
                        }
                    }
                }
            }
        });
    },

    // 3. Category Breakdown Chart
    renderCategoryBreakdown: (data) => {
        const ctx = document.getElementById('categoryChart');
        if (!ctx) return;

        if (StatisticsManager.charts.category) {
            StatisticsManager.charts.category.destroy();
        }

        const categories = data.category_breakdown || [];

        StatisticsManager.charts.category = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: categories.map(c => c.category),
                datasets: [{
                    data: categories.map(c => c.amount),
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                        '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    },

    // 4. Daily Spending Pattern
    renderDailySpending: (data) => {
        const ctx = document.getElementById('dailySpendingChart');
        if (!ctx) return;

        if (StatisticsManager.charts.dailySpending) {
            StatisticsManager.charts.dailySpending.destroy();
        }

        const dailyData = data.daily_spending || [];

        StatisticsManager.charts.dailySpending = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dailyData.map(d => d.date),
                datasets: [{
                    label: 'Xarajat',
                    data: dailyData.map(d => d.amount),
                    backgroundColor: '#FF5252'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => formatNumber(value)
                        }
                    }
                }
            }
        });
    },

    // 5. Top Categories List
    renderTopCategories: (data) => {
        const container = document.getElementById('topCategoriesList');
        if (!container) return;

        const categories = (data.category_breakdown || []).slice(0, 5);
        const total = categories.reduce((sum, c) => sum + c.amount, 0);

        const html = categories.map((cat, index) => {
            const percent = total > 0 ? ((cat.amount / total) * 100).toFixed(1) : 0;
            return `
                <div class="top-category-item" style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: var(--tg-theme-secondary-bg-color); border-radius: 8px; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 20px; font-weight: 600; color: var(--tg-theme-hint-color);">${index + 1}</span>
                        <div>
                            <div style="font-weight: 500; color: var(--tg-theme-text-color);">${cat.category}</div>
                            <div style="font-size: 12px; color: var(--tg-theme-hint-color);">${percent}%</div>
                        </div>
                    </div>
                    <div style="font-weight: 600; color: var(--tg-theme-text-color);">${formatMoney(cat.amount)}</div>
                </div>
            `;
        }).join('');

        container.innerHTML = html || '<p style="text-align: center; color: var(--tg-theme-hint-color); padding: 20px;">Ma\'lumot yo\'q</p>';
    },

    // 6. Savings Rate Display
    renderSavingsRate: (data) => {
        const container = document.getElementById('savingsRateDisplay');
        if (!container) return;

        const income = data.total_income || 0;
        const expense = data.total_expense || 0;
        const savingsRate = income > 0 ? ((income - expense) / income * 100).toFixed(1) : 0;

        const color = savingsRate >= 20 ? '#4CAF50' : savingsRate >= 10 ? '#FF9500' : '#FF5252';

        container.innerHTML = `
            <div style="text-align: center; padding: 30px 20px;">
                <div style="font-size: 48px; font-weight: 700; color: ${color}; margin-bottom: 8px;">
                    ${savingsRate}%
                </div>
                <div style="font-size: 14px; color: var(--tg-theme-hint-color);">
                    ${savingsRate >= 20 ? '✅ Ajoyib!' : savingsRate >= 10 ? '⚠️ Yaxshi' : '❌ Kam'}
                </div>
            </div>
        `;
    },

    // 7. Transaction Count Display
    renderTransactionCount: (data) => {
        const container = document.getElementById('transactionCountDisplay');
        if (!container) return;

        const count = data.transaction_count || 0;

        container.innerHTML = `
            <div style="text-align: center; padding: 30px 20px;">
                <div style="font-size: 48px; font-weight: 700; color: var(--tg-theme-link-color); margin-bottom: 8px;">
                    ${count}
                </div>
                <div style="font-size: 14px; color: var(--tg-theme-hint-color);">
                    Jami tranzaksiyalar
                </div>
            </div>
        `;
    },

    // 8. Average Transaction Display
    renderAverageTransaction: (data) => {
        const container = document.getElementById('avgTransactionDisplay');
        if (!container) return;

        const avg = data.average_transaction || 0;

        container.innerHTML = `
            <div style="text-align: center; padding: 30px 20px;">
                <div style="font-size: 32px; font-weight: 700; color: var(--tg-theme-text-color); margin-bottom: 8px;">
                    ${formatMoney(avg)}
                </div>
                <div style="font-size: 14px; color: var(--tg-theme-hint-color);">
                    O'rtacha summaa
                </div>
            </div>
        `;
    },

    // 9. Currency Distribution Chart
    renderCurrencyDistribution: (data) => {
        const ctx = document.getElementById('currencyDistChart');
        if (!ctx) return;

        if (StatisticsManager.charts.currencyDist) {
            StatisticsManager.charts.currencyDist.destroy();
        }

        const currencies = data.currency_distribution || [];

        StatisticsManager.charts.currencyDist = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: currencies.map(c => c.currency),
                datasets: [{
                    data: currencies.map(c => c.amount),
                    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    },

    // 10. Weekly Comparison Chart
    renderWeeklyComparison: (data) => {
        const ctx = document.getElementById('weeklyComparisonChart');
        if (!ctx) return;

        if (StatisticsManager.charts.weeklyComparison) {
            StatisticsManager.charts.weeklyComparison.destroy();
        }

        const weeklyData = data.weekly_comparison || [];

        StatisticsManager.charts.weeklyComparison = new Chart(ctx, {
            type: 'line',
            data: {
                labels: weeklyData.map(w => w.week),
                datasets: [
                    {
                        label: 'Joriy hafta',
                        data: weeklyData.map(w => w.current),
                        borderColor: '#4CAF50',
                        backgroundColor: '#4CAF5020',
                        fill: true
                    },
                    {
                        label: 'O\'tgan hafta',
                        data: weeklyData.map(w => w.previous),
                        borderColor: '#FF5252',
                        backgroundColor: '#FF525220',
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                plugins: {
                    legend: { position: 'top' }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => formatNumber(value)
                        }
                    }
                }
            }
        });
    }
};

// Global load statistics function
window.loadStatistics = (period) => {
    // Haptic feedback
    if (typeof hapticFeedback === 'function') {
        hapticFeedback('light');
    } else if (window.tg && window.tg.HapticFeedback) {
        window.tg.HapticFeedback.impactOccurred('light');
    }
    StatisticsManager.loadStatistics(period);
};

// Export
window.StatisticsManager = StatisticsManager;
