// ==================== BIZNES ILOVA FUNKSIYALARI ====================
// Ombor, Xodimlar, Vazifalar va boshqa biznes funksiyalari

// ==================== OMBOR (WAREHOUSE) FUNKSIYALARI ====================

// Ombor sahifasini yuklash
async function loadWarehousePage() {
    try {
        // Statistikani yuklash
        const statsResponse = await fetch('/api/business/statistics/warehouse');
        const stats = await statsResponse.json();

        document.getElementById('warehouseTotalProducts').textContent = stats.total_products || 0;
        document.getElementById('warehouseTotalValue').textContent = formatCurrency(stats.total_value || 0);
        document.getElementById('warehouseLowStock').textContent = stats.low_stock_count || 0;

        // Mahsulotlar ro'yxatini yuklash
        const itemsResponse = await fetch('/api/business/warehouse?limit=100');
        const items = await itemsResponse.json();

        displayWarehouseItems(items);
    } catch (error) {
        console.error('Ombor ma\'lumotlarini yuklashda xato:', error);
        showToast('Ma\'lumotlarni yuklashda xatolik', 'error');
    }
}

// Mahsulotlarni ko'rsatish
function displayWarehouseItems(items) {
    const list = document.getElementById('warehouseList');

    if (!items || items.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 48px 24px; color: var(--tg-theme-hint-color);">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3; margin-bottom: 16px;">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                </svg>
                <p style="font-size: 16px; margin: 0;">Hozircha mahsulot yo'q</p>
            </div>
        `;
        return;
    }

    let html = '';
    items.forEach(item => {
        const isLowStock = item.min_stock > 0 && item.quantity <= item.min_stock;
        const stockColor = isLowStock ? '#FF453A' : 'var(--tg-theme-text-color)';

        html += `
            <div class="wallet-transaction-item" onclick="showWarehouseItemDetails(${item.id})" style="cursor: pointer;">
                <div class="wallet-transaction-icon" style="background: rgba(94, 92, 230, 0.15);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#5E5CE6" stroke-width="2">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    </svg>
                </div>
                <div class="wallet-transaction-info">
                    <div class="wallet-transaction-title">${item.product_name}</div>
                    <div class="wallet-transaction-subtitle">
                        ${item.category || 'Kategoriyasiz'} • ${item.product_code || 'Kodsiz'}
                    </div>
                </div>
                <div style="text-align: right;">
                    <div class="wallet-transaction-amount" style="color: ${stockColor};">
                        ${item.quantity} ${item.unit}
                    </div>
                    ${item.sell_price ? `<div class="wallet-transaction-subtitle">${formatCurrency(item.sell_price)}</div>` : ''}
                </div>
            </div>
        `;
    });

    list.innerHTML = html;
}

// Mahsulot qo'shish modali
function showAddWarehouseModal() {
    // Bu funksiya modal yaratadi
    showToast('Mahsulot qo\'shish tez orada qo\'shiladi', 'info');
}

// Mahsulot tafsilotlari
function showWarehouseItemDetails(itemId) {
    showToast('Mahsulot tafsilotlari tez orada qo\'shiladi', 'info');
}

// ==================== XODIMLAR (EMPLOYEES) FUNKSIYALARI ====================

// Xodimlar sahifasini yuklash
async function loadEmployeesPage() {
    try {
        // Statistikani yuklash
        const statsResponse = await fetch('/api/business/statistics/employees');
        const stats = await statsResponse.json();

        document.getElementById('employeesTotal').textContent = stats.total_employees || 0;
        document.getElementById('employeesActive').textContent = stats.active_employees || 0;
        document.getElementById('employeesSalary').textContent = formatCurrency(stats.total_salary || 0);

        // Xodimlar ro'yxatini yuklash
        const employeesResponse = await fetch('/api/business/employees?limit=100');
        const employees = await employeesResponse.json();

        displayEmployees(employees);
    } catch (error) {
        console.error('Xodimlar ma\'lumotlarini yuklashda xato:', error);
        showToast('Ma\'lumotlarni yuklashda xatolik', 'error');
    }
}

// Xodimlarni ko'rsatish
function displayEmployees(employees) {
    const list = document.getElementById('employeesList');

    if (!employees || employees.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 48px 24px; color: var(--tg-theme-hint-color);">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3; margin-bottom: 16px;">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <p style="font-size: 16px; margin: 0;">Hozircha xodim yo'q</p>
            </div>
        `;
        return;
    }

    let html = '';
    employees.forEach(emp => {
        const statusColor = emp.status === 'active' ? '#34C759' : '#8E8E93';
        const statusText = emp.status === 'active' ? 'Faol' : 'Nofaol';

        html += `
            <div class="wallet-transaction-item" onclick="showEmployeeDetails(${emp.id})" style="cursor: pointer;">
                <div class="wallet-transaction-icon" style="background: rgba(52, 199, 89, 0.15);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#34C759" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                </div>
                <div class="wallet-transaction-info">
                    <div class="wallet-transaction-title">${emp.full_name}</div>
                    <div class="wallet-transaction-subtitle">
                        ${emp.position || 'Lavozim ko\'rsatilmagan'} • <span style="color: ${statusColor};">${statusText}</span>
                    </div>
                </div>
                <div style="text-align: right;">
                    ${emp.salary ? `
                        <div class="wallet-transaction-amount">${formatCurrency(emp.salary)}</div>
                        <div class="wallet-transaction-subtitle">${emp.currency || 'UZS'}</div>
                    ` : '<div class="wallet-transaction-subtitle">Ish haqi ko\'rsatilmagan</div>'}
                </div>
            </div>
        `;
    });

    list.innerHTML = html;
}

// Xodim qo'shish modali
function showAddEmployeeModal() {
    showToast('Xodim qo\'shish tez orada qo\'shiladi', 'info');
}

// Xodim tafsilotlari
function showEmployeeDetails(employeeId) {
    showToast('Xodim tafsilotlari tez orada qo\'shiladi', 'info');
}

// ==================== VAZIFALAR (TASKS) FUNKSIYALARI ====================

// Vazifalar sahifasini yuklash
async function loadTasksPage() {
    try {
        // Statistikani yuklash
        const statsResponse = await fetch('/api/business/statistics/tasks');
        const stats = await statsResponse.json();

        document.getElementById('tasksTotal').textContent = stats.total_tasks || 0;
        document.getElementById('tasksPending').textContent = stats.pending_tasks || 0;
        document.getElementById('tasksInProgress').textContent = stats.in_progress_tasks || 0;
        document.getElementById('tasksCompleted').textContent = stats.completed_tasks || 0;

        // Vazifalar ro'yxatini yuklash
        const tasksResponse = await fetch('/api/business/tasks?limit=100');
        const tasks = await tasksResponse.json();

        displayTasks(tasks);
    } catch (error) {
        console.error('Vazifalar ma\'lumotlarini yuklashda xato:', error);
        showToast('Ma\'lumotlarni yuklashda xatolik', 'error');
    }
}

// Vazifalarni ko'rsatish
function displayTasks(tasks) {
    const list = document.getElementById('tasksList');

    if (!tasks || tasks.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 48px 24px; color: var(--tg-theme-hint-color);">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3; margin-bottom: 16px;">
                    <path d="M9 11l3 3L22 4"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                <p style="font-size: 16px; margin: 0;">Hozircha vazifa yo'q</p>
            </div>
        `;
        return;
    }

    let html = '';
    tasks.forEach(task => {
        let statusColor, statusText, statusIcon;

        switch(task.status) {
            case 'pending':
                statusColor = '#FF9500';
                statusText = 'Kutilmoqda';
                statusIcon = '<path d="M12 2v20M2 12h20"/>';
                break;
            case 'in_progress':
                statusColor = '#0A84FF';
                statusText = 'Jarayonda';
                statusIcon = '<circle cx="12" cy="12" r="10"/>';
                break;
            case 'completed':
                statusColor = '#34C759';
                statusText = 'Bajarildi';
                statusIcon = '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>';
                break;
            default:
                statusColor = '#8E8E93';
                statusText = task.status;
                statusIcon = '<circle cx="12" cy="12" r="10"/>';
        }

        const priorityBadge = task.priority === 'high' ? '<span style="color: #FF453A; font-size: 11px;">⚠️ Muhim</span>' : '';

        html += `
            <div class="wallet-transaction-item" onclick="showTaskDetails(${task.id})" style="cursor: pointer;">
                <div class="wallet-transaction-icon" style="background: rgba(10, 132, 255, 0.15);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="${statusColor}" stroke-width="2">
                        ${statusIcon}
                    </svg>
                </div>
                <div class="wallet-transaction-info" style="flex: 1;">
                    <div class="wallet-transaction-title">${task.title}</div>
                    <div class="wallet-transaction-subtitle">
                        ${task.employee_name ? `👤 ${task.employee_name}` : 'Biriktirilmagan'}
                        ${task.due_date ? `• 📅 ${new Date(task.due_date).toLocaleDateString('uz-UZ')}` : ''}
                        ${priorityBadge}
                    </div>
                </div>
                <div style="text-align: right;">
                    <div class="wallet-transaction-subtitle" style="color: ${statusColor}; font-weight: 500;">
                        ${statusText}
                    </div>
                </div>
            </div>
        `;
    });

    list.innerHTML = html;
}

// Vazifa qo'shish modali
function showAddTaskModal() {
    showToast('Vazifa qo\'shish tez orada qo\'shiladi', 'info');
}

// Vazifa tafsilotlari
function showTaskDetails(taskId) {
    showToast('Vazifa tafsilotlari tez orada qo\'shiladi', 'info');
}

// ==================== YORDAMCHI FUNKSIYALAR ====================

// Pul miqdorini formatlash
function formatCurrency(amount, currency = 'UZS') {
    if (!amount) return '0 so\'m';

    const formatted = new Intl.NumberFormat('uz-UZ').format(amount);

    if (currency === 'UZS') {
        return `${formatted} so'm`;
    } else if (currency === 'USD') {
        return `$${formatted}`;
    } else if (currency === 'EUR') {
        return `€${formatted}`;
    } else {
        return `${formatted} ${currency}`;
    }
}

// Toast xabarnomasi ko'rsatish
function showToast(message, type = 'info') {
    // Telegram WebApp feedback
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.showAlert(message);
    } else {
        alert(message);
    }
}

// ==================== NAVIGATSIYA KENGAYTMASI ====================

// navigateTo funksiyasini kengaytirish
const originalNavigateTo = window.navigateTo;
window.navigateTo = function(pageName) {
    // Biznes sahifalarini tekshirish
    if (pageName === 'warehouse') {
        originalNavigateTo(pageName);
        loadWarehousePage();
    } else if (pageName === 'employees') {
        originalNavigateTo(pageName);
        loadEmployeesPage();
    } else if (pageName === 'tasks') {
        originalNavigateTo(pageName);
        loadTasksPage();
    } else {
        // Oddiy sahifalar uchun asl funksiyani chaqirish
        originalNavigateTo(pageName);
    }
};

// ==================== SAHIFA YUKLANGANDA ====================

document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Biznes ilova funksiyalari yuklandi');

    // Agar foydalanuvchi biznes sahifalarida bo'lsa, ma'lumotlarni yuklash
    const currentPage = document.querySelector('.page.active')?.id;
    if (currentPage === 'pageWarehouse') {
        loadWarehousePage();
    } else if (currentPage === 'pageEmployees') {
        loadEmployeesPage();
    } else if (currentPage === 'pageTasks') {
        loadTasksPage();
    }
});
