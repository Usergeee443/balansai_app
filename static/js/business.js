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
    const modalHTML = `
        <div class="modal-overlay" id="warehouseModal" onclick="if(event.target === this) closeWarehouseModal()">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Mahsulot qo'shish</h2>
                    <button class="modal-close" onclick="closeWarehouseModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Mahsulot nomi *</label>
                        <input type="text" id="productName" class="wallet-input" placeholder="Masalan: Olma">
                    </div>
                    <div class="form-group">
                        <label>Mahsulot kodi</label>
                        <input type="text" id="productCode" class="wallet-input" placeholder="Masalan: PR001">
                    </div>
                    <div class="form-group">
                        <label>Kategoriya</label>
                        <input type="text" id="productCategory" class="wallet-input" placeholder="Masalan: Mevalar">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Miqdor *</label>
                            <input type="number" id="productQuantity" class="wallet-input" placeholder="100" step="0.01">
                        </div>
                        <div class="form-group">
                            <label>Birlik</label>
                            <select id="productUnit" class="wallet-input">
                                <option value="dona">dona</option>
                                <option value="kg">kg</option>
                                <option value="litr">litr</option>
                                <option value="metr">metr</option>
                                <option value="quti">quti</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Sotib olish narxi</label>
                            <input type="number" id="productBuyPrice" class="wallet-input" placeholder="5000" step="0.01">
                        </div>
                        <div class="form-group">
                            <label>Sotish narxi</label>
                            <input type="number" id="productSellPrice" class="wallet-input" placeholder="7000" step="0.01">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Minimal zaxira (ogohlantirish uchun)</label>
                        <input type="number" id="productMinStock" class="wallet-input" placeholder="10" step="0.01">
                    </div>
                    <div class="form-group">
                        <label>Izoh</label>
                        <textarea id="productDescription" class="wallet-input" rows="3" placeholder="Qo'shimcha ma'lumot..."></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="wallet-btn-secondary" onclick="closeWarehouseModal()">Bekor qilish</button>
                    <button class="wallet-btn-primary" onclick="saveWarehouseItem()">Saqlash</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeWarehouseModal() {
    const modal = document.getElementById('warehouseModal');
    if (modal) modal.remove();
}

async function saveWarehouseItem() {
    const productName = document.getElementById('productName').value.trim();
    const quantity = parseFloat(document.getElementById('productQuantity').value);

    if (!productName) {
        showToast('Mahsulot nomini kiriting!', 'error');
        return;
    }

    if (!quantity || quantity <= 0) {
        showToast('Miqdorni to\'g\'ri kiriting!', 'error');
        return;
    }

    const data = {
        product_name: productName,
        product_code: document.getElementById('productCode').value.trim(),
        category: document.getElementById('productCategory').value.trim(),
        quantity: quantity,
        unit: document.getElementById('productUnit').value,
        buy_price: parseFloat(document.getElementById('productBuyPrice').value) || 0,
        sell_price: parseFloat(document.getElementById('productSellPrice').value) || 0,
        min_stock: parseFloat(document.getElementById('productMinStock').value) || 0,
        description: document.getElementById('productDescription').value.trim()
    };

    try {
        const response = await fetch('/api/business/warehouse', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });

        if (response.ok) {
            showToast('Mahsulot muvaffaqiyatli qo\'shildi!', 'success');
            closeWarehouseModal();
            loadWarehousePage();
        } else {
            const error = await response.json();
            showToast(error.message || 'Xatolik yuz berdi', 'error');
        }
    } catch (error) {
        console.error('Mahsulot qo\'shishda xato:', error);
        showToast('Xatolik yuz berdi', 'error');
    }
}

// Mahsulot tafsilotlari
async function showWarehouseItemDetails(itemId) {
    try {
        const response = await fetch(`/api/business/warehouse/${itemId}`);
        const item = await response.json();

        const modalHTML = `
            <div class="modal-overlay" id="warehouseDetailsModal" onclick="if(event.target === this) closeWarehouseDetailsModal()">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>${item.product_name}</h2>
                        <button class="modal-close" onclick="closeWarehouseDetailsModal()">✕</button>
                    </div>
                    <div class="modal-body">
                        <div class="detail-item">
                            <span class="detail-label">Mahsulot kodi:</span>
                            <span class="detail-value">${item.product_code || '-'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Kategoriya:</span>
                            <span class="detail-value">${item.category || '-'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Miqdor:</span>
                            <span class="detail-value">${item.quantity} ${item.unit}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Sotib olish narxi:</span>
                            <span class="detail-value">${formatCurrency(item.buy_price)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Sotish narxi:</span>
                            <span class="detail-value">${formatCurrency(item.sell_price)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Minimal zaxira:</span>
                            <span class="detail-value">${item.min_stock || 0} ${item.unit}</span>
                        </div>
                        ${item.description ? `
                            <div class="detail-item">
                                <span class="detail-label">Izoh:</span>
                                <span class="detail-value">${item.description}</span>
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button class="wallet-btn-secondary" onclick="deleteWarehouseItem(${itemId})">O'chirish</button>
                        <button class="wallet-btn-primary" onclick="editWarehouseItem(${itemId})">Tahrirlash</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    } catch (error) {
        console.error('Mahsulot tafsilotlarini yuklashda xato:', error);
        showToast('Xatolik yuz berdi', 'error');
    }
}

function closeWarehouseDetailsModal() {
    const modal = document.getElementById('warehouseDetailsModal');
    if (modal) modal.remove();
}

async function deleteWarehouseItem(itemId) {
    if (!confirm('Mahsulotni o\'chirmoqchimisiz?')) return;

    try {
        const response = await fetch(`/api/business/warehouse/${itemId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Mahsulot o\'chirildi', 'success');
            closeWarehouseDetailsModal();
            loadWarehousePage();
        } else {
            showToast('Xatolik yuz berdi', 'error');
        }
    } catch (error) {
        console.error('Mahsulotni o\'chirishda xato:', error);
        showToast('Xatolik yuz berdi', 'error');
    }
}

function editWarehouseItem(itemId) {
    closeWarehouseDetailsModal();
    showToast('Tahrirlash funksiyasi tez orada qo\'shiladi', 'info');
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
    const modalHTML = `
        <div class="modal-overlay" id="employeeModal" onclick="if(event.target === this) closeEmployeeModal()">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Xodim qo'shish</h2>
                    <button class="modal-close" onclick="closeEmployeeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>To'liq ism *</label>
                        <input type="text" id="employeeFullName" class="wallet-input" placeholder="Masalan: Aliyev Vali">
                    </div>
                    <div class="form-group">
                        <label>Lavozim *</label>
                        <input type="text" id="employeePosition" class="wallet-input" placeholder="Masalan: Sotuvchi">
                    </div>
                    <div class="form-group">
                        <label>Telefon</label>
                        <input type="tel" id="employeePhone" class="wallet-input" placeholder="+998 90 123 45 67">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Oylik maosh *</label>
                            <input type="number" id="employeeSalary" class="wallet-input" placeholder="3000000" step="1000">
                        </div>
                        <div class="form-group">
                            <label>Valyuta</label>
                            <select id="employeeCurrency" class="wallet-input">
                                <option value="UZS">UZS</option>
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Ishga qabul qilingan sana</label>
                        <input type="date" id="employeeHireDate" class="wallet-input">
                    </div>
                    <div class="form-group">
                        <label>Manzil</label>
                        <input type="text" id="employeeAddress" class="wallet-input" placeholder="Shahar, ko'cha">
                    </div>
                    <div class="form-group">
                        <label>Izoh</label>
                        <textarea id="employeeNotes" class="wallet-input" rows="3" placeholder="Qo'shimcha ma'lumot..."></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="wallet-btn-secondary" onclick="closeEmployeeModal()">Bekor qilish</button>
                    <button class="wallet-btn-primary" onclick="saveEmployee()">Saqlash</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('employeeHireDate').value = today;
}

function closeEmployeeModal() {
    const modal = document.getElementById('employeeModal');
    if (modal) modal.remove();
}

async function saveEmployee() {
    const fullName = document.getElementById('employeeFullName').value.trim();
    const position = document.getElementById('employeePosition').value.trim();
    const salary = parseFloat(document.getElementById('employeeSalary').value);

    if (!fullName) {
        showToast('Xodim ismini kiriting!', 'error');
        return;
    }

    if (!position) {
        showToast('Lavozimni kiriting!', 'error');
        return;
    }

    if (!salary || salary <= 0) {
        showToast('Maoshni to\'g\'ri kiriting!', 'error');
        return;
    }

    const data = {
        full_name: fullName,
        position: position,
        phone: document.getElementById('employeePhone').value.trim(),
        salary: salary,
        currency: document.getElementById('employeeCurrency').value,
        hire_date: document.getElementById('employeeHireDate').value,
        address: document.getElementById('employeeAddress').value.trim(),
        notes: document.getElementById('employeeNotes').value.trim()
    };

    try {
        const response = await fetch('/api/business/employees', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });

        if (response.ok) {
            showToast('Xodim muvaffaqiyatli qo\'shildi!', 'success');
            closeEmployeeModal();
            loadEmployeesPage();
        } else {
            const error = await response.json();
            showToast(error.message || 'Xatolik yuz berdi', 'error');
        }
    } catch (error) {
        console.error('Xodim qo\'shishda xato:', error);
        showToast('Xatolik yuz berdi', 'error');
    }
}

// Xodim tafsilotlari
async function showEmployeeDetails(employeeId) {
    try {
        const response = await fetch(`/api/business/employees/${employeeId}`);
        const emp = await response.json();

        const statusBadge = emp.status === 'active' ?
            '<span style="background: #34C759; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px;">Faol</span>' :
            '<span style="background: #8E8E93; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px;">Nofaol</span>';

        const modalHTML = `
            <div class="modal-overlay" id="employeeDetailsModal" onclick="if(event.target === this) closeEmployeeDetailsModal()">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>${emp.full_name}</h2>
                        <button class="modal-close" onclick="closeEmployeeDetailsModal()">✕</button>
                    </div>
                    <div class="modal-body">
                        <div class="detail-item">
                            <span class="detail-label">Lavozim:</span>
                            <span class="detail-value">${emp.position || '-'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Status:</span>
                            <span class="detail-value">${statusBadge}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Telefon:</span>
                            <span class="detail-value">${emp.phone || '-'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Oylik maosh:</span>
                            <span class="detail-value">${formatCurrency(emp.salary, emp.currency)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Ishga qabul qilingan:</span>
                            <span class="detail-value">${emp.hire_date ? new Date(emp.hire_date).toLocaleDateString('uz-UZ') : '-'}</span>
                        </div>
                        ${emp.address ? `
                            <div class="detail-item">
                                <span class="detail-label">Manzil:</span>
                                <span class="detail-value">${emp.address}</span>
                            </div>
                        ` : ''}
                        ${emp.notes ? `
                            <div class="detail-item">
                                <span class="detail-label">Izoh:</span>
                                <span class="detail-value">${emp.notes}</span>
                            </div>
                        ` : ''}
                        <div style="margin-top: 20px;">
                            <button class="wallet-btn-primary" style="width: 100%;" onclick="showAssignTaskToEmployee(${employeeId}, '${emp.full_name}')">
                                📋 Vazifa berish
                            </button>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="wallet-btn-secondary" onclick="deleteEmployee(${employeeId})">O'chirish</button>
                        <button class="wallet-btn-primary" onclick="editEmployee(${employeeId})">Tahrirlash</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    } catch (error) {
        console.error('Xodim tafsilotlarini yuklashda xato:', error);
        showToast('Xatolik yuz berdi', 'error');
    }
}

function closeEmployeeDetailsModal() {
    const modal = document.getElementById('employeeDetailsModal');
    if (modal) modal.remove();
}

async function deleteEmployee(employeeId) {
    if (!confirm('Xodimni o\'chirmoqchimisiz?')) return;

    try {
        const response = await fetch(`/api/business/employees/${employeeId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Xodim o\'chirildi', 'success');
            closeEmployeeDetailsModal();
            loadEmployeesPage();
        } else {
            showToast('Xatolik yuz berdi', 'error');
        }
    } catch (error) {
        console.error('Xodimni o\'chirishda xato:', error);
        showToast('Xatolik yuz berdi', 'error');
    }
}

function editEmployee(employeeId) {
    closeEmployeeDetailsModal();
    showToast('Tahrirlash funksiyasi tez orada qo\'shiladi', 'info');
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
async function showAddTaskModal(preSelectedEmployeeId = null) {
    // Load employees for assignment dropdown
    try {
        const response = await fetch('/api/business/employees?limit=100');
        const employees = await response.json();

        const employeeOptions = employees
            .filter(emp => emp.status === 'active')
            .map(emp => `<option value="${emp.id}" ${preSelectedEmployeeId == emp.id ? 'selected' : ''}>${emp.full_name} - ${emp.position}</option>`)
            .join('');

        const modalHTML = `
            <div class="modal-overlay" id="taskModal" onclick="if(event.target === this) closeTaskModal()">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Vazifa qo'shish</h2>
                        <button class="modal-close" onclick="closeTaskModal()">✕</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Vazifa nomi *</label>
                            <input type="text" id="taskTitle" class="wallet-input" placeholder="Masalan: Klientga qo'ng'iroq qilish">
                        </div>
                        <div class="form-group">
                            <label>Tavsif</label>
                            <textarea id="taskDescription" class="wallet-input" rows="3" placeholder="Vazifa tafsilotlari..."></textarea>
                        </div>
                        <div class="form-group">
                            <label>Xodim (biriktirilgan)</label>
                            <select id="taskAssignedTo" class="wallet-input">
                                <option value="">Tanlash</option>
                                ${employeeOptions}
                            </select>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Muhimlik darajasi</label>
                                <select id="taskPriority" class="wallet-input">
                                    <option value="low">Past</option>
                                    <option value="medium" selected>O'rta</option>
                                    <option value="high">Yuqori</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Status</label>
                                <select id="taskStatus" class="wallet-input">
                                    <option value="pending" selected>Kutilmoqda</option>
                                    <option value="in_progress">Jarayonda</option>
                                    <option value="completed">Bajarildi</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Muddati</label>
                            <input type="datetime-local" id="taskDueDate" class="wallet-input">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="wallet-btn-secondary" onclick="closeTaskModal()">Bekor qilish</button>
                        <button class="wallet-btn-primary" onclick="saveTask()">Saqlash</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    } catch (error) {
        console.error('Vazifa qo\'shish modalini ochishda xato:', error);
        showToast('Xatolik yuz berdi', 'error');
    }
}

function closeTaskModal() {
    const modal = document.getElementById('taskModal');
    if (modal) modal.remove();
}

async function saveTask() {
    const title = document.getElementById('taskTitle').value.trim();

    if (!title) {
        showToast('Vazifa nomini kiriting!', 'error');
        return;
    }

    const assignedTo = document.getElementById('taskAssignedTo').value;
    const data = {
        title: title,
        description: document.getElementById('taskDescription').value.trim(),
        assigned_to: assignedTo ? parseInt(assignedTo) : null,
        priority: document.getElementById('taskPriority').value,
        status: document.getElementById('taskStatus').value,
        due_date: document.getElementById('taskDueDate').value || null
    };

    try {
        const response = await fetch('/api/business/tasks', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });

        if (response.ok) {
            showToast('Vazifa muvaffaqiyatli qo\'shildi!', 'success');
            closeTaskModal();
            loadTasksPage();

            // Send Telegram notification if assigned to employee
            if (assignedTo) {
                sendTaskNotification(assignedTo, title);
            }
        } else {
            const error = await response.json();
            showToast(error.message || 'Xatolik yuz berdi', 'error');
        }
    } catch (error) {
        console.error('Vazifa qo\'shishda xato:', error);
        showToast('Xatolik yuz berdi', 'error');
    }
}

// Xodimga vazifa berish (employee details sahifasidan chaqiriladi)
function showAssignTaskToEmployee(employeeId, employeeName) {
    closeEmployeeDetailsModal();
    showAddTaskModal(employeeId);
}

// Telegram bot orqali eslatma yuborish
async function sendTaskNotification(employeeId, taskTitle) {
    try {
        const response = await fetch('/api/business/send-task-notification', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                employee_id: employeeId,
                task_title: taskTitle
            })
        });

        if (response.ok) {
            console.log('Telegram eslatma yuborildi');
        }
    } catch (error) {
        console.error('Telegram eslatma yuborishda xato:', error);
    }
}

// Vazifa tafsilotlari
async function showTaskDetails(taskId) {
    try {
        const response = await fetch(`/api/business/tasks/${taskId}`);
        const task = await response.json();

        let statusColor, statusText;
        switch(task.status) {
            case 'pending':
                statusColor = '#FF9500';
                statusText = 'Kutilmoqda';
                break;
            case 'in_progress':
                statusColor = '#0A84FF';
                statusText = 'Jarayonda';
                break;
            case 'completed':
                statusColor = '#34C759';
                statusText = 'Bajarildi';
                break;
            default:
                statusColor = '#8E8E93';
                statusText = task.status;
        }

        const priorityText = task.priority === 'high' ? '⚠️ Yuqori' : task.priority === 'medium' ? 'O\'rta' : 'Past';
        const statusBadge = `<span style="background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px;">${statusText}</span>`;

        const modalHTML = `
            <div class="modal-overlay" id="taskDetailsModal" onclick="if(event.target === this) closeTaskDetailsModal()">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>${task.title}</h2>
                        <button class="modal-close" onclick="closeTaskDetailsModal()">✕</button>
                    </div>
                    <div class="modal-body">
                        <div class="detail-item">
                            <span class="detail-label">Status:</span>
                            <span class="detail-value">${statusBadge}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Muhimlik:</span>
                            <span class="detail-value">${priorityText}</span>
                        </div>
                        ${task.employee_name ? `
                            <div class="detail-item">
                                <span class="detail-label">Biriktirilgan:</span>
                                <span class="detail-value">${task.employee_name}</span>
                            </div>
                        ` : ''}
                        ${task.due_date ? `
                            <div class="detail-item">
                                <span class="detail-label">Muddati:</span>
                                <span class="detail-value">${new Date(task.due_date).toLocaleString('uz-UZ')}</span>
                            </div>
                        ` : ''}
                        ${task.description ? `
                            <div class="detail-item">
                                <span class="detail-label">Tavsif:</span>
                                <span class="detail-value">${task.description}</span>
                            </div>
                        ` : ''}
                        ${task.completed_at ? `
                            <div class="detail-item">
                                <span class="detail-label">Bajarilgan:</span>
                                <span class="detail-value">${new Date(task.completed_at).toLocaleString('uz-UZ')}</span>
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button class="wallet-btn-secondary" onclick="deleteTask(${taskId})">O'chirish</button>
                        ${task.status !== 'completed' ? `
                            <button class="wallet-btn-primary" onclick="completeTask(${taskId})">Bajarildi ✓</button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    } catch (error) {
        console.error('Vazifa tafsilotlarini yuklashda xato:', error);
        showToast('Xatolik yuz berdi', 'error');
    }
}

function closeTaskDetailsModal() {
    const modal = document.getElementById('taskDetailsModal');
    if (modal) modal.remove();
}

async function deleteTask(taskId) {
    if (!confirm('Vazifani o\'chirmoqchimisiz?')) return;

    try {
        const response = await fetch(`/api/business/tasks/${taskId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Vazifa o\'chirildi', 'success');
            closeTaskDetailsModal();
            loadTasksPage();
        } else {
            showToast('Xatolik yuz berdi', 'error');
        }
    } catch (error) {
        console.error('Vazifani o\'chirishda xato:', error);
        showToast('Xatolik yuz berdi', 'error');
    }
}

async function completeTask(taskId) {
    try {
        const response = await fetch(`/api/business/tasks/${taskId}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                status: 'completed',
                completed_at: new Date().toISOString()
            })
        });

        if (response.ok) {
            showToast('Vazifa bajarildi!', 'success');
            closeTaskDetailsModal();
            loadTasksPage();
        } else {
            showToast('Xatolik yuz berdi', 'error');
        }
    } catch (error) {
        console.error('Vazifani bajarishda xato:', error);
        showToast('Xatolik yuz berdi', 'error');
    }
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

// ==================== STATISTIKA UCHUN BIZNES MA'LUMOTLARINI YUKLASH ====================

async function loadBusinessStatsForStatisticsPage() {
    try {
        // Ombor statistikasi
        const warehouseRes = await fetch('/api/business/statistics/warehouse');
        const warehouseStats = await warehouseRes.json();
        document.getElementById('statsWarehouseProducts').textContent = warehouseStats.total_products || 0;

        // Xodimlar statistikasi
        const employeesRes = await fetch('/api/business/statistics/employees');
        const employeesStats = await employeesRes.json();
        document.getElementById('statsEmployees').textContent = employeesStats.total_employees || 0;

        // Vazifalar statistikasi
        const tasksRes = await fetch('/api/business/statistics/tasks');
        const tasksStats = await tasksRes.json();
        document.getElementById('statsPendingTasks').textContent = tasksStats.pending_tasks || 0;
    } catch (error) {
        console.error('Biznes statistikalarini yuklashda xato:', error);
    }
}

// ==================== THEME MODE (LIGHT/DARK) ====================

async function loadTheme() {
    try {
        const response = await fetch('/api/user/theme');
        const data = await response.json();
        applyTheme(data.theme_mode || 'dark');
    } catch (error) {
        console.error('Theme yuklashda xato:', error);
        applyTheme('dark'); // Default
    }
}

function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-mode');
        document.getElementById('moonIcon').style.display = 'none';
        document.getElementById('sunIcon').style.display = 'block';
    } else {
        document.body.classList.remove('light-mode');
        document.getElementById('moonIcon').style.display = 'block';
        document.getElementById('sunIcon').style.display = 'none';
    }
}

async function toggleTheme() {
    const isLightMode = document.body.classList.contains('light-mode');
    const newTheme = isLightMode ? 'dark' : 'light';

    // Apply theme immediately for better UX
    applyTheme(newTheme);

    // Save to backend
    try {
        await fetch('/api/user/theme', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ theme_mode: newTheme })
        });
    } catch (error) {
        console.error('Theme saqlashda xato:', error);
    }
}

// ==================== SAHIFA YUKLANGANDA ====================

document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Biznes ilova funksiyalari yuklandi');

    // Theme yuklash
    loadTheme();

    // Agar foydalanuvchi biznes sahifalarida bo'lsa, ma'lumotlarni yuklash
    const currentPage = document.querySelector('.page.active')?.id;
    if (currentPage === 'pageWarehouse') {
        loadWarehousePage();
    } else if (currentPage === 'pageEmployees') {
        loadEmployeesPage();
    } else if (currentPage === 'pageTasks') {
        loadTasksPage();
    } else if (currentPage === 'pageStatistics') {
        loadBusinessStatsForStatisticsPage();
    }
});

// Sahifa o'zgartirilganda ham tekshirish
if (typeof window.navigateTo !== 'undefined') {
    const originalNavigateTo = window.navigateTo;
    window.navigateTo = function(pageName) {
        originalNavigateTo(pageName);
        if (pageName === 'statistics') {
            setTimeout(() => loadBusinessStatsForStatisticsPage(), 100);
        }
    };
}
