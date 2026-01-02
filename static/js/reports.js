/**
 * Balans AI - Reports & Export
 * Hisobotlar va eksport funksiyalari
 */

// ============================================
// REPORTS MANAGER
// ============================================

class ReportsManager {
    constructor() {
        this.reportData = null;
    }

    async generateReport(period = 'month', type = 'detailed') {
        try {
            const response = await fetch(`/api/reports/${period}`, {
                headers: {
                    'X-Telegram-Init-Data': this.getInitData()
                }
            });

            this.reportData = await response.json();
            return this.reportData;
        } catch (error) {
            console.error('Failed to generate report:', error);
            return null;
        }
    }

    getInitData() {
        const tg = window.Telegram?.WebApp;
        return tg?.initData || '';
    }

    // PDF Export
    async exportToPDF() {
        if (!this.reportData) {
            await this.generateReport();
        }

        const docDefinition = this.createPDFDefinition();

        // pdfmake kutubxonasidan foydalanish
        if (typeof pdfMake !== 'undefined') {
            pdfMake.createPdf(docDefinition).download('balans-ai-report.pdf');
        } else {
            console.error('pdfMake library not loaded');
            this.showError('PDF kutubxonasi yuklanmagan');
        }
    }

    createPDFDefinition() {
        const data = this.reportData;

        return {
            pageSize: 'A4',
            pageMargins: [40, 60, 40, 60],

            header: {
                text: 'Balans AI - Moliyaviy Hisobot',
                style: 'header',
                alignment: 'center',
                margin: [0, 20, 0, 0]
            },

            content: [
                {
                    text: `Hisobot davri: ${this.formatPeriod(data.period)}`,
                    style: 'subheader',
                    margin: [0, 0, 0, 20]
                },

                {
                    text: 'Umumiy Ma\'lumotlar',
                    style: 'sectionHeader'
                },

                {
                    table: {
                        widths: ['*', '*'],
                        body: [
                            ['Daromad', this.formatCurrency(data.totalIncome || 0)],
                            ['Xarajat', this.formatCurrency(data.totalExpense || 0)],
                            ['Balans', this.formatCurrency(data.balance || 0)]
                        ]
                    },
                    margin: [0, 10, 0, 20]
                },

                {
                    text: 'Kategoriyalar bo\'yicha xarajatlar',
                    style: 'sectionHeader'
                },

                {
                    table: {
                        widths: ['*', 'auto', 'auto'],
                        headerRows: 1,
                        body: this.createCategoryTable(data.categories || [])
                    },
                    margin: [0, 10, 0, 20]
                },

                {
                    text: 'So\'nggi tranzaksiyalar',
                    style: 'sectionHeader'
                },

                {
                    table: {
                        widths: ['auto', '*', 'auto', 'auto'],
                        headerRows: 1,
                        body: this.createTransactionTable(data.transactions || [])
                    },
                    margin: [0, 10, 0, 0]
                }
            ],

            styles: {
                header: {
                    fontSize: 18,
                    bold: true,
                    color: '#5A8EF4'
                },
                subheader: {
                    fontSize: 14,
                    italics: true,
                    color: '#666'
                },
                sectionHeader: {
                    fontSize: 14,
                    bold: true,
                    margin: [0, 10, 0, 5]
                }
            },

            defaultStyle: {
                font: 'Roboto'
            }
        };
    }

    createCategoryTable(categories) {
        const rows = [
            ['Kategoriya', 'Summa', 'Foiz']
        ];

        const total = categories.reduce((sum, cat) => sum + cat.amount, 0);

        categories.forEach(cat => {
            const percentage = ((cat.amount / total) * 100).toFixed(1);
            rows.push([
                cat.name,
                this.formatCurrency(cat.amount),
                `${percentage}%`
            ]);
        });

        return rows;
    }

    createTransactionTable(transactions) {
        const rows = [
            ['Sana', 'Tavsif', 'Kategoriya', 'Summa']
        ];

        transactions.slice(0, 20).forEach(tx => {
            rows.push([
                this.formatDate(tx.created_at),
                tx.description || '-',
                tx.category || '-',
                this.formatCurrency(tx.amount)
            ]);
        });

        return rows;
    }

    // Excel Export
    async exportToExcel() {
        if (!this.reportData) {
            await this.generateReport();
        }

        // SheetJS (xlsx) kutubxonasidan foydalanish
        if (typeof XLSX === 'undefined') {
            console.error('XLSX library not loaded');
            this.showError('Excel kutubxonasi yuklanmagan');
            return;
        }

        const wb = XLSX.utils.book_new();

        // Umumiy ma'lumotlar
        const summaryData = [
            ['Balans AI - Moliyaviy Hisobot'],
            [''],
            ['Davr:', this.formatPeriod(this.reportData.period)],
            ['Sana:', new Date().toLocaleDateString('uz-UZ')],
            [''],
            ['Ko\'rsatkich', 'Summa'],
            ['Daromad', this.reportData.totalIncome || 0],
            ['Xarajat', this.reportData.totalExpense || 0],
            ['Balans', this.reportData.balance || 0]
        ];

        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, summarySheet, 'Umumiy');

        // Kategoriyalar
        if (this.reportData.categories && this.reportData.categories.length > 0) {
            const categoryData = [
                ['Kategoriya', 'Summa', 'Foiz']
            ];

            const total = this.reportData.categories.reduce((sum, cat) => sum + cat.amount, 0);

            this.reportData.categories.forEach(cat => {
                const percentage = ((cat.amount / total) * 100).toFixed(1);
                categoryData.push([
                    cat.name,
                    cat.amount,
                    `${percentage}%`
                ]);
            });

            const categorySheet = XLSX.utils.aoa_to_sheet(categoryData);
            XLSX.utils.book_append_sheet(wb, categorySheet, 'Kategoriyalar');
        }

        // Tranzaksiyalar
        if (this.reportData.transactions && this.reportData.transactions.length > 0) {
            const transactionData = [
                ['Sana', 'Tur', 'Kategoriya', 'Tavsif', 'Summa', 'Valyuta']
            ];

            this.reportData.transactions.forEach(tx => {
                transactionData.push([
                    this.formatDate(tx.created_at),
                    tx.type === 'income' ? 'Daromad' : 'Xarajat',
                    tx.category || '-',
                    tx.description || '-',
                    tx.amount,
                    tx.currency || 'UZS'
                ]);
            });

            const transactionSheet = XLSX.utils.aoa_to_sheet(transactionData);
            XLSX.utils.book_append_sheet(wb, transactionSheet, 'Tranzaksiyalar');
        }

        // Faylni yuklab olish
        XLSX.writeFile(wb, `balans-ai-report-${Date.now()}.xlsx`);
    }

    // CSV Export
    async exportToCSV() {
        if (!this.reportData) {
            await this.generateReport();
        }

        let csv = 'Balans AI - Moliyaviy Hisobot\n\n';
        csv += `Davr:,${this.formatPeriod(this.reportData.period)}\n`;
        csv += `Sana:,${new Date().toLocaleDateString('uz-UZ')}\n\n`;

        csv += 'Umumiy Ma\'lumotlar\n';
        csv += 'Ko\'rsatkich,Summa\n';
        csv += `Daromad,${this.reportData.totalIncome || 0}\n`;
        csv += `Xarajat,${this.reportData.totalExpense || 0}\n`;
        csv += `Balans,${this.reportData.balance || 0}\n\n`;

        if (this.reportData.categories && this.reportData.categories.length > 0) {
            csv += 'Kategoriyalar\n';
            csv += 'Kategoriya,Summa,Foiz\n';

            const total = this.reportData.categories.reduce((sum, cat) => sum + cat.amount, 0);

            this.reportData.categories.forEach(cat => {
                const percentage = ((cat.amount / total) * 100).toFixed(1);
                csv += `${cat.name},${cat.amount},${percentage}%\n`;
            });

            csv += '\n';
        }

        if (this.reportData.transactions && this.reportData.transactions.length > 0) {
            csv += 'Tranzaksiyalar\n';
            csv += 'Sana,Tur,Kategoriya,Tavsif,Summa,Valyuta\n';

            this.reportData.transactions.forEach(tx => {
                csv += `${this.formatDate(tx.created_at)},`;
                csv += `${tx.type === 'income' ? 'Daromad' : 'Xarajat'},`;
                csv += `${tx.category || '-'},`;
                csv += `"${tx.description || '-'}",`;
                csv += `${tx.amount},`;
                csv += `${tx.currency || 'UZS'}\n`;
            });
        }

        // Faylni yuklab olish
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `balans-ai-report-${Date.now()}.csv`;
        link.click();
    }

    // JSON Export
    async exportToJSON() {
        if (!this.reportData) {
            await this.generateReport();
        }

        const json = JSON.stringify(this.reportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `balans-ai-report-${Date.now()}.json`;
        link.click();
    }

    // Helper functions
    formatCurrency(amount) {
        return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('uz-UZ', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    formatPeriod(period) {
        const now = new Date();
        switch (period) {
            case 'week':
                return 'Oxirgi hafta';
            case 'month':
                return now.toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' });
            case 'year':
                return now.getFullYear().toString();
            default:
                return period;
        }
    }

    showError(message) {
        if (window.Telegram?.WebApp?.showAlert) {
            window.Telegram.WebApp.showAlert(message);
        } else {
            alert(message);
        }
    }

    // Report Modal UI
    showReportModal() {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px; max-height: none; border-radius: 20px;">
                <div class="modal-header">
                    <h2 class="modal-title">Hisobot yaratish</h2>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Davr</label>
                        <select id="reportPeriod" class="form-control">
                            <option value="week">Oxirgi hafta</option>
                            <option value="month" selected>Joriy oy</option>
                            <option value="year">Joriy yil</option>
                            <option value="all">Barchasi</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Format</label>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 12px;">
                            <button class="action-btn" onclick="window.reportsManager.exportPDF()">
                                <div class="action-btn-icon income">📄</div>
                                <div class="action-btn-label">PDF</div>
                            </button>
                            <button class="action-btn" onclick="window.reportsManager.exportExcel()">
                                <div class="action-btn-icon expense">📊</div>
                                <div class="action-btn-label">Excel</div>
                            </button>
                            <button class="action-btn" onclick="window.reportsManager.exportCSV()">
                                <div class="action-btn-icon transfer">📋</div>
                                <div class="action-btn-label">CSV</div>
                            </button>
                            <button class="action-btn" onclick="window.reportsManager.exportJSON()">
                                <div class="action-btn-icon debt">💾</div>
                                <div class="action-btn-label">JSON</div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    async exportPDF() {
        const period = document.getElementById('reportPeriod')?.value || 'month';
        await this.generateReport(period);
        await this.exportToPDF();
        document.querySelector('.modal')?.remove();
    }

    async exportExcel() {
        const period = document.getElementById('reportPeriod')?.value || 'month';
        await this.generateReport(period);
        await this.exportToExcel();
        document.querySelector('.modal')?.remove();
    }

    async exportCSV() {
        const period = document.getElementById('reportPeriod')?.value || 'month';
        await this.generateReport(period);
        await this.exportToCSV();
        document.querySelector('.modal')?.remove();
    }

    async exportJSON() {
        const period = document.getElementById('reportPeriod')?.value || 'month';
        await this.generateReport(period);
        await this.exportToJSON();
        document.querySelector('.modal')?.remove();
    }
}

// ============================================
// ANALYTICS INSIGHTS
// ============================================

class AnalyticsInsights {
    constructor() {
        this.insights = [];
    }

    async generateInsights() {
        const data = await this.fetchUserData();
        if (!data) return;

        this.insights = [];

        // Xarajat tendensiyasi
        if (data.expenseGrowth > 10) {
            this.insights.push({
                type: 'warning',
                icon: '⚠️',
                title: 'Xarajatlar o\'smoqda',
                message: `Xarajatlaringiz o'tgan oyga nisbatan ${data.expenseGrowth.toFixed(1)}% oshgan`,
                action: 'Byudjet belgilash'
            });
        }

        // Top xarajat kategoriyasi
        if (data.topCategory) {
            this.insights.push({
                type: 'info',
                icon: '📊',
                title: 'Eng ko\'p xarajat',
                message: `${data.topCategory.name} kategoriyasiga ${this.formatCurrency(data.topCategory.amount)} sarfladingiz`,
                action: 'Batafsil ko\'rish'
            });
        }

        // Tejash imkoniyati
        const savingsRate = (data.balance / (data.income || 1)) * 100;
        if (savingsRate < 10) {
            this.insights.push({
                type: 'tip',
                icon: '💡',
                title: 'Tejash maslahati',
                message: 'Daromadingizning kamida 20% ni tejashga harakat qiling',
                action: 'Maqsad belgilash'
            });
        }

        // Qarz eslatmasi
        if (data.unpaidDebts > 0) {
            this.insights.push({
                type: 'alert',
                icon: '🔔',
                title: 'To\'lanmagan qarzlar',
                message: `${data.unpaidDebts} ta to'lanmagan qarzingiz bor`,
                action: 'Qarzlarni ko\'rish'
            });
        }

        return this.insights;
    }

    async fetchUserData() {
        try {
            const response = await fetch('/api/analytics/insights', {
                headers: {
                    'X-Telegram-Init-Data': this.getInitData()
                }
            });

            if (!response.ok) {
                // Mock data
                return {
                    expenseGrowth: 15,
                    topCategory: { name: 'Oziq-ovqat', amount: 500000 },
                    income: 5000000,
                    balance: 400000,
                    unpaidDebts: 2
                };
            }

            return await response.json();
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
            return null;
        }
    }

    getInitData() {
        const tg = window.Telegram?.WebApp;
        return tg?.initData || '';
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
    }

    renderInsights(container) {
        if (!this.insights || this.insights.length === 0) {
            container.innerHTML = '<div class="empty-state">Tahlillar yo\'q</div>';
            return;
        }

        container.innerHTML = '';

        this.insights.forEach(insight => {
            const card = document.createElement('div');
            card.className = `insight-card ${insight.type}`;
            card.innerHTML = `
                <div class="insight-icon">${insight.icon}</div>
                <div class="insight-content">
                    <div class="insight-title">${insight.title}</div>
                    <div class="insight-message">${insight.message}</div>
                    ${insight.action ? `<button class="insight-action">${insight.action}</button>` : ''}
                </div>
            `;

            container.appendChild(card);
        });
    }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Reports Manager
    window.reportsManager = new ReportsManager();

    // Analytics Insights
    window.analyticsInsights = new AnalyticsInsights();
});
