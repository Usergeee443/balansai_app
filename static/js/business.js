// ==================== BIZNES ILOVA FUNKSIYALARI ====================
// Ombor, Xodimlar, Vazifalar va boshqa biznes funksiyalari

// ==================== CACHING MEXANIZMI ====================
// Ma'lumotlarni cache'lash uchun global o'zgaruvchilar
const businessCache = {
    warehouse: { stats: null, items: null, timestamp: null },
    employees: { stats: null, items: null, timestamp: null },
    tasks: { stats: null, items: null, timestamp: null }
};

// Cache'ni tozalash (5 daqiqa)
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function isCacheValid(cacheKey) {
    const cache = businessCache[cacheKey];
    if (!cache || !cache.timestamp) return false;
    return (Date.now() - cache.timestamp) < CACHE_DURATION;
}

function setCache(cacheKey, data) {
    businessCache[cacheKey] = {
        ...data,
        timestamp: Date.now()
    };
}

function clearCache(cacheKey) {
    if (cacheKey) {
        businessCache[cacheKey] = { stats: null, items: null, timestamp: null };
    } else {
        // Barcha cache'ni tozalash
        Object.keys(businessCache).forEach(key => {
            businessCache[key] = { stats: null, items: null, timestamp: null };
        });
    }
}

// ==================== OMBOR (WAREHOUSE) FUNKSIYALARI ====================

// Ombor sahifasini yuklash (caching bilan)
async function loadWarehousePage(forceRefresh = false) {
    try {
        // Agar cache valid bo'lsa va force refresh bo'lmasa, cache'dan ol
        if (!forceRefresh && isCacheValid('warehouse')) {
            console.log('✅ Ombor ma\'lumotlari cache\'dan olinmoqda...');
            const cache = businessCache.warehouse;

            document.getElementById('warehouseTotalProducts').textContent = cache.stats.total_products || 0;
            document.getElementById('warehouseTotalValue').textContent = formatCurrency(cache.stats.total_value || 0);
            document.getElementById('warehouseLowStock').textContent = cache.stats.low_stock_count || 0;

            displayWarehouseItems(cache.items);
            return;
        }

        console.log('🔄 Ombor ma\'lumotlari API dan yuklanmoqda...');

        // Parallel yuklanish - tezroq
        const [statsResponse, itemsResponse] = await Promise.all([
            fetch('/api/business/statistics/warehouse'),
            fetch('/api/business/warehouse?limit=100')
        ]);

        const stats = await statsResponse.json();
        const items = await itemsResponse.json();

        // Cache'ga saqlash
        setCache('warehouse', { stats, items });

        document.getElementById('warehouseTotalProducts').textContent = stats.total_products || 0;
        document.getElementById('warehouseTotalValue').textContent = formatCurrency(stats.total_value || 0);
        document.getElementById('warehouseLowStock').textContent = stats.low_stock_count || 0;

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
async function showAddWarehouseModal() {
    const modal = createModal({
        title: 'Yangi mahsulot qo\'shish',
        content: `
            <div class="form-group">
                <label>Mahsulot nomi *</label>
                <input type="text" id="warehouseProductName" class="form-input" required>
            </div>
            <div class="form-group">
                <label>Mahsulot kodi</label>
                <input type="text" id="warehouseProductCode" class="form-input">
            </div>
            <div class="form-group">
                <label>Kategoriya</label>
                <input type="text" id="warehouseCategory" class="form-input">
            </div>
            <div class="form-group">
                <label>Miqdor *</label>
                <input type="number" id="warehouseQuantity" class="form-input" value="0" required>
            </div>
            <div class="form-group">
                <label>Birlik</label>
                <select id="warehouseUnit" class="form-input">
                    <option value="dona">Dona</option>
                    <option value="kg">Kilogram (kg)</option>
                    <option value="litr">Litr</option>
                    <option value="metr">Metr</option>
                    <option value="paket">Paket</option>
                </select>
            </div>
            <div class="form-group">
                <label>Sotib olish narxi</label>
                <input type="number" id="warehouseBuyPrice" class="form-input" step="0.01">
            </div>
            <div class="form-group">
                <label>Sotish narxi</label>
                <input type="number" id="warehouseSellPrice" class="form-input" step="0.01">
            </div>
            <div class="form-group">
                <label>Minimal zaxira</label>
                <input type="number" id="warehouseMinStock" class="form-input" value="0">
            </div>
            <div class="form-group">
                <label>Izoh</label>
                <textarea id="warehouseDescription" class="form-input" rows="3"></textarea>
            </div>
        `,
        buttons: [
            {
                text: 'Bekor qilish',
                class: 'btn-secondary',
                onClick: () => modal.close()
            },
            {
                text: 'Qo\'shish',
                class: 'btn-primary',
                onClick: async () => {
                    const data = {
                        product_name: document.getElementById('warehouseProductName').value,
                        product_code: document.getElementById('warehouseProductCode').value,
                        category: document.getElementById('warehouseCategory').value,
                        quantity: parseFloat(document.getElementById('warehouseQuantity').value),
                        unit: document.getElementById('warehouseUnit').value,
                        buy_price: parseFloat(document.getElementById('warehouseBuyPrice').value) || null,
                        sell_price: parseFloat(document.getElementById('warehouseSellPrice').value) || null,
                        min_stock: parseFloat(document.getElementById('warehouseMinStock').value) || 0,
                        description: document.getElementById('warehouseDescription').value
                    };

                    if (!data.product_name) {
                        showToast('Mahsulot nomini kiriting', 'error');
                        return;
                    }

                    try {
                        const response = await fetch('/api/business/warehouse', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });

                        const result = await response.json();
                        if (result.success) {
                            showToast('Mahsulot qo\'shildi', 'success');
                            clearCache('warehouse');
                            loadWarehousePage(true);
                            modal.close();
                        } else {
                            showToast('Xatolik yuz berdi', 'error');
                        }
                    } catch (error) {
                        console.error('Xato:', error);
                        showToast('Xatolik yuz berdi', 'error');
                    }
                }
            }
        ]
    });
}

// Mahsulot tafsilotlari va tahrirlash
async function showWarehouseItemDetails(itemId) {
    try {
        const response = await fetch(`/api/business/warehouse/${itemId}`);
        const item = await response.json();

        if (!item || item.error) {
            showToast('Mahsulot topilmadi', 'error');
            return;
        }

        const modal = createModal({
            title: item.product_name,
            content: `
                <div class="details-section">
                    <div class="detail-row">
                        <span class="detail-label">Mahsulot kodi:</span>
                        <span class="detail-value">${item.product_code || '-'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Kategoriya:</span>
                        <span class="detail-value">${item.category || '-'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Miqdor:</span>
                        <span class="detail-value">${item.quantity} ${item.unit}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Sotib olish narxi:</span>
                        <span class="detail-value">${item.buy_price ? formatCurrency(item.buy_price) : '-'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Sotish narxi:</span>
                        <span class="detail-value">${item.sell_price ? formatCurrency(item.sell_price) : '-'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Minimal zaxira:</span>
                        <span class="detail-value">${item.min_stock}</span>
                    </div>
                    ${item.description ? `
                        <div class="detail-row">
                            <span class="detail-label">Izoh:</span>
                            <span class="detail-value">${item.description}</span>
                        </div>
                    ` : ''}
                </div>
            `,
            buttons: [
                {
                    text: 'O\'chirish',
                    class: 'btn-danger',
                    onClick: async () => {
                        if (confirm('Rostdan ham o\'chirmoqchimisiz?')) {
                            try {
                                const response = await fetch(`/api/business/warehouse/${itemId}`, {
                                    method: 'DELETE'
                                });
                                const result = await response.json();
                                if (result.success) {
                                    showToast('Mahsulot o\'chirildi', 'success');
                                    clearCache('warehouse');
                                    loadWarehousePage(true);
                                    modal.close();
                                } else {
                                    showToast('Xatolik yuz berdi', 'error');
                                }
                            } catch (error) {
                                console.error('Xato:', error);
                                showToast('Xatolik yuz berdi', 'error');
                            }
                        }
                    }
                },
                {
                    text: 'Tahrirlash',
                    class: 'btn-primary',
                    onClick: () => {
                        modal.close();
                        showEditWarehouseModal(item);
                    }
                },
                {
                    text: 'Yopish',
                    class: 'btn-secondary',
                    onClick: () => modal.close()
                }
            ]
        });
    } catch (error) {
        console.error('Xato:', error);
        showToast('Xatolik yuz berdi', 'error');
    }
}

// Mahsulotni tahrirlash modali
async function showEditWarehouseModal(item) {
    const modal = createModal({
        title: 'Mahsulotni tahrirlash',
        content: `
            <div class="form-group">
                <label>Mahsulot nomi *</label>
                <input type="text" id="editWarehouseProductName" class="form-input" value="${item.product_name}" required>
            </div>
            <div class="form-group">
                <label>Mahsulot kodi</label>
                <input type="text" id="editWarehouseProductCode" class="form-input" value="${item.product_code || ''}">
            </div>
            <div class="form-group">
                <label>Kategoriya</label>
                <input type="text" id="editWarehouseCategory" class="form-input" value="${item.category || ''}">
            </div>
            <div class="form-group">
                <label>Miqdor *</label>
                <input type="number" id="editWarehouseQuantity" class="form-input" value="${item.quantity}" required>
            </div>
            <div class="form-group">
                <label>Birlik</label>
                <select id="editWarehouseUnit" class="form-input">
                    <option value="dona" ${item.unit === 'dona' ? 'selected' : ''}>Dona</option>
                    <option value="kg" ${item.unit === 'kg' ? 'selected' : ''}>Kilogram (kg)</option>
                    <option value="litr" ${item.unit === 'litr' ? 'selected' : ''}>Litr</option>
                    <option value="metr" ${item.unit === 'metr' ? 'selected' : ''}>Metr</option>
                    <option value="paket" ${item.unit === 'paket' ? 'selected' : ''}>Paket</option>
                </select>
            </div>
            <div class="form-group">
                <label>Sotib olish narxi</label>
                <input type="number" id="editWarehouseBuyPrice" class="form-input" value="${item.buy_price || ''}" step="0.01">
            </div>
            <div class="form-group">
                <label>Sotish narxi</label>
                <input type="number" id="editWarehouseSellPrice" class="form-input" value="${item.sell_price || ''}" step="0.01">
            </div>
            <div class="form-group">
                <label>Minimal zaxira</label>
                <input type="number" id="editWarehouseMinStock" class="form-input" value="${item.min_stock || 0}">
            </div>
            <div class="form-group">
                <label>Izoh</label>
                <textarea id="editWarehouseDescription" class="form-input" rows="3">${item.description || ''}</textarea>
            </div>
        `,
        buttons: [
            {
                text: 'Bekor qilish',
                class: 'btn-secondary',
                onClick: () => modal.close()
            },
            {
                text: 'Saqlash',
                class: 'btn-primary',
                onClick: async () => {
                    const data = {
                        product_name: document.getElementById('editWarehouseProductName').value,
                        product_code: document.getElementById('editWarehouseProductCode').value,
                        category: document.getElementById('editWarehouseCategory').value,
                        quantity: parseFloat(document.getElementById('editWarehouseQuantity').value),
                        unit: document.getElementById('editWarehouseUnit').value,
                        buy_price: parseFloat(document.getElementById('editWarehouseBuyPrice').value) || null,
                        sell_price: parseFloat(document.getElementById('editWarehouseSellPrice').value) || null,
                        min_stock: parseFloat(document.getElementById('editWarehouseMinStock').value) || 0,
                        description: document.getElementById('editWarehouseDescription').value
                    };

                    if (!data.product_name) {
                        showToast('Mahsulot nomini kiriting', 'error');
                        return;
                    }

                    try {
                        const response = await fetch(`/api/business/warehouse/${item.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });

                        const result = await response.json();
                        if (result.success) {
                            showToast('Mahsulot yangilandi', 'success');
                            clearCache('warehouse');
                            loadWarehousePage(true);
                            modal.close();
                        } else {
                            showToast('Xatolik yuz berdi', 'error');
                        }
                    } catch (error) {
                        console.error('Xato:', error);
                        showToast('Xatolik yuz berdi', 'error');
                    }
                }
            }
        ]
    });
}

// ==================== XODIMLAR (EMPLOYEES) FUNKSIYALARI ====================

// Xodimlar sahifasini yuklash (caching bilan)
async function loadEmployeesPage(forceRefresh = false) {
    try {
        // Agar cache valid bo'lsa va force refresh bo'lmasa, cache'dan ol
        if (!forceRefresh && isCacheValid('employees')) {
            console.log('✅ Xodimlar ma\'lumotlari cache\'dan olinmoqda...');
            const cache = businessCache.employees;

            document.getElementById('employeesTotal').textContent = cache.stats.total_employees || 0;
            document.getElementById('employeesActive').textContent = cache.stats.active_employees || 0;
            document.getElementById('employeesSalary').textContent = formatCurrency(cache.stats.total_salary || 0);

            displayEmployees(cache.items);
            return;
        }

        console.log('🔄 Xodimlar ma\'lumotlari API dan yuklanmoqda...');

        // Parallel yuklanish - tezroq
        const [statsResponse, employeesResponse] = await Promise.all([
            fetch('/api/business/statistics/employees'),
            fetch('/api/business/employees?limit=100')
        ]);

        const stats = await statsResponse.json();
        const employees = await employeesResponse.json();

        // Cache'ga saqlash
        setCache('employees', { stats, items: employees });

        document.getElementById('employeesTotal').textContent = stats.total_employees || 0;
        document.getElementById('employeesActive').textContent = stats.active_employees || 0;
        document.getElementById('employeesSalary').textContent = formatCurrency(stats.total_salary || 0);

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
async function showAddEmployeeModal() {
    const modal = createModal({
        title: 'Yangi xodim qo\'shish',
        content: `
            <div class="form-group">
                <label>F.I.O *</label>
                <input type="text" id="employeeFullName" class="form-input" required>
            </div>
            <div class="form-group">
                <label>Lavozim</label>
                <input type="text" id="employeePosition" class="form-input">
            </div>
            <div class="form-group">
                <label>Telefon</label>
                <input type="tel" id="employeePhone" class="form-input">
            </div>
            <div class="form-group">
                <label>Ish haqi</label>
                <input type="number" id="employeeSalary" class="form-input" step="0.01">
            </div>
            <div class="form-group">
                <label>Valyuta</label>
                <select id="employeeCurrency" class="form-input">
                    <option value="UZS">UZS</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                </select>
            </div>
            <div class="form-group">
                <label>Ishga kirgan sana</label>
                <input type="date" id="employeeHireDate" class="form-input">
            </div>
            <div class="form-group">
                <label>Manzil</label>
                <textarea id="employeeAddress" class="form-input" rows="2"></textarea>
            </div>
            <div class="form-group">
                <label>Izoh</label>
                <textarea id="employeeNotes" class="form-input" rows="2"></textarea>
            </div>
        `,
        buttons: [
            {
                text: 'Bekor qilish',
                class: 'btn-secondary',
                onClick: () => modal.close()
            },
            {
                text: 'Qo\'shish',
                class: 'btn-primary',
                onClick: async () => {
                    const data = {
                        full_name: document.getElementById('employeeFullName').value,
                        position: document.getElementById('employeePosition').value,
                        phone: document.getElementById('employeePhone').value,
                        salary: parseFloat(document.getElementById('employeeSalary').value) || null,
                        currency: document.getElementById('employeeCurrency').value,
                        hire_date: document.getElementById('employeeHireDate').value || null,
                        address: document.getElementById('employeeAddress').value,
                        notes: document.getElementById('employeeNotes').value
                    };

                    if (!data.full_name) {
                        showToast('F.I.O ni kiriting', 'error');
                        return;
                    }

                    try {
                        const response = await fetch('/api/business/employees', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });

                        const result = await response.json();
                        if (result.success) {
                            showToast('Xodim qo\'shildi', 'success');
                            clearCache('employees');
                            loadEmployeesPage(true);
                            modal.close();
                        } else {
                            showToast('Xatolik yuz berdi', 'error');
                        }
                    } catch (error) {
                        console.error('Xato:', error);
                        showToast('Xatolik yuz berdi', 'error');
                    }
                }
            }
        ]
    });
}

// Xodim tafsilotlari
async function showEmployeeDetails(employeeId) {
    try {
        const response = await fetch(`/api/business/employees/${employeeId}`);
        const employee = await response.json();

        if (!employee || employee.error) {
            showToast('Xodim topilmadi', 'error');
            return;
        }

        const modal = createModal({
            title: employee.full_name,
            content: `
                <div class="details-section">
                    <div class="detail-row">
                        <span class="detail-label">Lavozim:</span>
                        <span class="detail-value">${employee.position || '-'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Telefon:</span>
                        <span class="detail-value">${employee.phone || '-'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Ish haqi:</span>
                        <span class="detail-value">${employee.salary ? formatCurrency(employee.salary, employee.currency) : '-'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Holat:</span>
                        <span class="detail-value">${employee.status === 'active' ? 'Faol' : 'Nofaol'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Ishga kirgan:</span>
                        <span class="detail-value">${employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('uz-UZ') : '-'}</span>
                    </div>
                    ${employee.address ? `
                        <div class="detail-row">
                            <span class="detail-label">Manzil:</span>
                            <span class="detail-value">${employee.address}</span>
                        </div>
                    ` : ''}
                    ${employee.notes ? `
                        <div class="detail-row">
                            <span class="detail-label">Izoh:</span>
                            <span class="detail-value">${employee.notes}</span>
                        </div>
                    ` : ''}
                </div>
            `,
            buttons: [
                {
                    text: 'O\'chirish',
                    class: 'btn-danger',
                    onClick: async () => {
                        if (confirm('Rostdan ham o\'chirmoqchimisiz?')) {
                            try {
                                const response = await fetch(`/api/business/employees/${employeeId}`, {
                                    method: 'DELETE'
                                });
                                const result = await response.json();
                                if (result.success) {
                                    showToast('Xodim o\'chirildi', 'success');
                                    clearCache('employees');
                                    loadEmployeesPage(true);
                                    modal.close();
                                } else {
                                    showToast('Xatolik yuz berdi', 'error');
                                }
                            } catch (error) {
                                console.error('Xato:', error);
                                showToast('Xatolik yuz berdi', 'error');
                            }
                        }
                    }
                },
                {
                    text: 'Tahrirlash',
                    class: 'btn-primary',
                    onClick: () => {
                        modal.close();
                        showEditEmployeeModal(employee);
                    }
                },
                {
                    text: 'Yopish',
                    class: 'btn-secondary',
                    onClick: () => modal.close()
                }
            ]
        });
    } catch (error) {
        console.error('Xato:', error);
        showToast('Xatolik yuz berdi', 'error');
    }
}

// Xodimni tahrirlash
async function showEditEmployeeModal(employee) {
    const modal = createModal({
        title: 'Xodimni tahrirlash',
        content: `
            <div class="form-group">
                <label>F.I.O *</label>
                <input type="text" id="editEmployeeFullName" class="form-input" value="${employee.full_name}" required>
            </div>
            <div class="form-group">
                <label>Lavozim</label>
                <input type="text" id="editEmployeePosition" class="form-input" value="${employee.position || ''}">
            </div>
            <div class="form-group">
                <label>Telefon</label>
                <input type="tel" id="editEmployeePhone" class="form-input" value="${employee.phone || ''}">
            </div>
            <div class="form-group">
                <label>Ish haqi</label>
                <input type="number" id="editEmployeeSalary" class="form-input" value="${employee.salary || ''}" step="0.01">
            </div>
            <div class="form-group">
                <label>Valyuta</label>
                <select id="editEmployeeCurrency" class="form-input">
                    <option value="UZS" ${employee.currency === 'UZS' ? 'selected' : ''}>UZS</option>
                    <option value="USD" ${employee.currency === 'USD' ? 'selected' : ''}>USD</option>
                    <option value="EUR" ${employee.currency === 'EUR' ? 'selected' : ''}>EUR</option>
                </select>
            </div>
            <div class="form-group">
                <label>Holat</label>
                <select id="editEmployeeStatus" class="form-input">
                    <option value="active" ${employee.status === 'active' ? 'selected' : ''}>Faol</option>
                    <option value="inactive" ${employee.status === 'inactive' ? 'selected' : ''}>Nofaol</option>
                </select>
            </div>
            <div class="form-group">
                <label>Manzil</label>
                <textarea id="editEmployeeAddress" class="form-input" rows="2">${employee.address || ''}</textarea>
            </div>
            <div class="form-group">
                <label>Izoh</label>
                <textarea id="editEmployeeNotes" class="form-input" rows="2">${employee.notes || ''}</textarea>
            </div>
        `,
        buttons: [
            {
                text: 'Bekor qilish',
                class: 'btn-secondary',
                onClick: () => modal.close()
            },
            {
                text: 'Saqlash',
                class: 'btn-primary',
                onClick: async () => {
                    const data = {
                        full_name: document.getElementById('editEmployeeFullName').value,
                        position: document.getElementById('editEmployeePosition').value,
                        phone: document.getElementById('editEmployeePhone').value,
                        salary: parseFloat(document.getElementById('editEmployeeSalary').value) || null,
                        currency: document.getElementById('editEmployeeCurrency').value,
                        status: document.getElementById('editEmployeeStatus').value,
                        address: document.getElementById('editEmployeeAddress').value,
                        notes: document.getElementById('editEmployeeNotes').value
                    };

                    if (!data.full_name) {
                        showToast('F.I.O ni kiriting', 'error');
                        return;
                    }

                    try {
                        const response = await fetch(`/api/business/employees/${employee.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });

                        const result = await response.json();
                        if (result.success) {
                            showToast('Xodim yangilandi', 'success');
                            clearCache('employees');
                            loadEmployeesPage(true);
                            modal.close();
                        } else {
                            showToast('Xatolik yuz berdi', 'error');
                        }
                    } catch (error) {
                        console.error('Xato:', error);
                        showToast('Xatolik yuz berdi', 'error');
                    }
                }
            }
        ]
    });
}

// ==================== VAZIFALAR (TASKS) FUNKSIYALARI ====================

// Vazifalar sahifasini yuklash (caching bilan)
async function loadTasksPage(forceRefresh = false) {
    try {
        // Agar cache valid bo'lsa va force refresh bo'lmasa, cache'dan ol
        if (!forceRefresh && isCacheValid('tasks')) {
            console.log('✅ Vazifalar ma\'lumotlari cache\'dan olinmoqda...');
            const cache = businessCache.tasks;

            document.getElementById('tasksTotal').textContent = cache.stats.total_tasks || 0;
            document.getElementById('tasksPending').textContent = cache.stats.pending_tasks || 0;
            document.getElementById('tasksInProgress').textContent = cache.stats.in_progress_tasks || 0;
            document.getElementById('tasksCompleted').textContent = cache.stats.completed_tasks || 0;

            displayTasks(cache.items);
            return;
        }

        console.log('🔄 Vazifalar ma\'lumotlari API dan yuklanmoqda...');

        // Parallel yuklanish - tezroq
        const [statsResponse, tasksResponse] = await Promise.all([
            fetch('/api/business/statistics/tasks'),
            fetch('/api/business/tasks?limit=100')
        ]);

        const stats = await statsResponse.json();
        const tasks = await tasksResponse.json();

        // Cache'ga saqlash
        setCache('tasks', { stats, items: tasks });

        document.getElementById('tasksTotal').textContent = stats.total_tasks || 0;
        document.getElementById('tasksPending').textContent = stats.pending_tasks || 0;
        document.getElementById('tasksInProgress').textContent = stats.in_progress_tasks || 0;
        document.getElementById('tasksCompleted').textContent = stats.completed_tasks || 0;

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
async function showAddTaskModal() {
    // Xodimlarni yuklash
    let employees = [];
    try {
        const response = await fetch('/api/business/employees?limit=100');
        employees = await response.json();
    } catch (error) {
        console.error('Xodimlarni yuklashda xato:', error);
    }

    const employeesOptions = employees.map(emp =>
        `<option value="${emp.id}">${emp.full_name} - ${emp.position || 'Lavozim ko\'rsatilmagan'}</option>`
    ).join('');

    const modal = createModal({
        title: 'Yangi vazifa qo\'shish',
        content: `
            <div class="form-group">
                <label>Vazifa nomi *</label>
                <input type="text" id="taskTitle" class="form-input" required>
            </div>
            <div class="form-group">
                <label>Tavsif</label>
                <textarea id="taskDescription" class="form-input" rows="3"></textarea>
            </div>
            <div class="form-group">
                <label>Xodim biriktirish</label>
                <select id="taskAssignedTo" class="form-input">
                    <option value="">Tanlang...</option>
                    ${employeesOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Muhimlik</label>
                <select id="taskPriority" class="form-input">
                    <option value="low">Kam</option>
                    <option value="medium" selected>O'rta</option>
                    <option value="high">Yuqori</option>
                </select>
            </div>
            <div class="form-group">
                <label>Tugash muddati</label>
                <input type="date" id="taskDueDate" class="form-input">
            </div>
        `,
        buttons: [
            {
                text: 'Bekor qilish',
                class: 'btn-secondary',
                onClick: () => modal.close()
            },
            {
                text: 'Qo\'shish',
                class: 'btn-primary',
                onClick: async () => {
                    const data = {
                        title: document.getElementById('taskTitle').value,
                        description: document.getElementById('taskDescription').value,
                        assigned_to: parseInt(document.getElementById('taskAssignedTo').value) || null,
                        priority: document.getElementById('taskPriority').value,
                        status: 'pending',
                        due_date: document.getElementById('taskDueDate').value || null
                    };

                    if (!data.title) {
                        showToast('Vazifa nomini kiriting', 'error');
                        return;
                    }

                    try {
                        const response = await fetch('/api/business/tasks', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });

                        const result = await response.json();
                        if (result.success) {
                            showToast('Vazifa qo\'shildi', 'success');
                            clearCache('tasks');
                            loadTasksPage(true);
                            modal.close();
                        } else {
                            showToast('Xatolik yuz berdi', 'error');
                        }
                    } catch (error) {
                        console.error('Xato:', error);
                        showToast('Xatolik yuz berdi', 'error');
                    }
                }
            }
        ]
    });
}

// Vazifa tafsilotlari
async function showTaskDetails(taskId) {
    try {
        const response = await fetch(`/api/business/tasks/${taskId}`);
        const task = await response.json();

        if (!task || task.error) {
            showToast('Vazifa topilmadi', 'error');
            return;
        }

        const statusText = {
            'pending': 'Kutilmoqda',
            'in_progress': 'Jarayonda',
            'completed': 'Bajarildi'
        }[task.status] || task.status;

        const priorityText = {
            'low': 'Kam',
            'medium': 'O\'rta',
            'high': 'Yuqori'
        }[task.priority] || task.priority;

        const modal = createModal({
            title: task.title,
            content: `
                <div class="details-section">
                    ${task.description ? `
                        <div class="detail-row">
                            <span class="detail-label">Tavsif:</span>
                            <span class="detail-value">${task.description}</span>
                        </div>
                    ` : ''}
                    <div class="detail-row">
                        <span class="detail-label">Xodim:</span>
                        <span class="detail-value">${task.employee_name || 'Biriktirilmagan'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Holat:</span>
                        <span class="detail-value">${statusText}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Muhimlik:</span>
                        <span class="detail-value">${priorityText}</span>
                    </div>
                    ${task.due_date ? `
                        <div class="detail-row">
                            <span class="detail-label">Tugash muddati:</span>
                            <span class="detail-value">${new Date(task.due_date).toLocaleDateString('uz-UZ')}</span>
                        </div>
                    ` : ''}
                </div>
            `,
            buttons: [
                {
                    text: 'O\'chirish',
                    class: 'btn-danger',
                    onClick: async () => {
                        if (confirm('Rostdan ham o\'chirmoqchimisiz?')) {
                            try {
                                const response = await fetch(`/api/business/tasks/${taskId}`, {
                                    method: 'DELETE'
                                });
                                const result = await response.json();
                                if (result.success) {
                                    showToast('Vazifa o\'chirildi', 'success');
                                    clearCache('tasks');
                                    loadTasksPage(true);
                                    modal.close();
                                } else {
                                    showToast('Xatolik yuz berdi', 'error');
                                }
                            } catch (error) {
                                console.error('Xato:', error);
                                showToast('Xatolik yuz berdi', 'error');
                            }
                        }
                    }
                },
                {
                    text: 'Tahrirlash',
                    class: 'btn-primary',
                    onClick: () => {
                        modal.close();
                        showEditTaskModal(task);
                    }
                },
                {
                    text: 'Yopish',
                    class: 'btn-secondary',
                    onClick: () => modal.close()
                }
            ]
        });
    } catch (error) {
        console.error('Xato:', error);
        showToast('Xatolik yuz berdi', 'error');
    }
}

// Vazifani tahrirlash
async function showEditTaskModal(task) {
    // Xodimlarni yuklash
    let employees = [];
    try {
        const response = await fetch('/api/business/employees?limit=100');
        employees = await response.json();
    } catch (error) {
        console.error('Xodimlarni yuklashda xato:', error);
    }

    const employeesOptions = employees.map(emp =>
        `<option value="${emp.id}" ${task.assigned_to === emp.id ? 'selected' : ''}>${emp.full_name} - ${emp.position || 'Lavozim ko\'rsatilmagan'}</option>`
    ).join('');

    const modal = createModal({
        title: 'Vazifani tahrirlash',
        content: `
            <div class="form-group">
                <label>Vazifa nomi *</label>
                <input type="text" id="editTaskTitle" class="form-input" value="${task.title}" required>
            </div>
            <div class="form-group">
                <label>Tavsif</label>
                <textarea id="editTaskDescription" class="form-input" rows="3">${task.description || ''}</textarea>
            </div>
            <div class="form-group">
                <label>Xodim biriktirish</label>
                <select id="editTaskAssignedTo" class="form-input">
                    <option value="">Tanlang...</option>
                    ${employeesOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Holat</label>
                <select id="editTaskStatus" class="form-input">
                    <option value="pending" ${task.status === 'pending' ? 'selected' : ''}>Kutilmoqda</option>
                    <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>Jarayonda</option>
                    <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Bajarildi</option>
                </select>
            </div>
            <div class="form-group">
                <label>Muhimlik</label>
                <select id="editTaskPriority" class="form-input">
                    <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Kam</option>
                    <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>O'rta</option>
                    <option value="high" ${task.priority === 'high' ? 'selected' : ''}>Yuqori</option>
                </select>
            </div>
            <div class="form-group">
                <label>Tugash muddati</label>
                <input type="date" id="editTaskDueDate" class="form-input" value="${task.due_date || ''}">
            </div>
        `,
        buttons: [
            {
                text: 'Bekor qilish',
                class: 'btn-secondary',
                onClick: () => modal.close()
            },
            {
                text: 'Saqlash',
                class: 'btn-primary',
                onClick: async () => {
                    const data = {
                        title: document.getElementById('editTaskTitle').value,
                        description: document.getElementById('editTaskDescription').value,
                        assigned_to: parseInt(document.getElementById('editTaskAssignedTo').value) || null,
                        status: document.getElementById('editTaskStatus').value,
                        priority: document.getElementById('editTaskPriority').value,
                        due_date: document.getElementById('editTaskDueDate').value || null
                    };

                    if (!data.title) {
                        showToast('Vazifa nomini kiriting', 'error');
                        return;
                    }

                    try {
                        const response = await fetch(`/api/business/tasks/${task.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });

                        const result = await response.json();
                        if (result.success) {
                            showToast('Vazifa yangilandi', 'success');
                            clearCache('tasks');
                            loadTasksPage(true);
                            modal.close();
                        } else {
                            showToast('Xatolik yuz berdi', 'error');
                        }
                    } catch (error) {
                        console.error('Xato:', error);
                        showToast('Xatolik yuz berdi', 'error');
                    }
                }
            }
        ]
    });
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

// Modal yaratish utility funksiyasi
function createModal({ title, content, buttons }) {
    // Modal konteynerini yaratish
    const modalHTML = `
        <div class="business-modal-overlay" id="businessModalOverlay" onclick="if(event.target === this) closeBusinessModal()">
            <div class="business-modal">
                <div class="business-modal-header">
                    <h3>${title}</h3>
                    <button class="business-modal-close" onclick="closeBusinessModal()">&times;</button>
                </div>
                <div class="business-modal-body">
                    ${content}
                </div>
                <div class="business-modal-footer">
                    ${buttons.map((btn, idx) => `
                        <button class="business-modal-btn ${btn.class}" onclick="handleModalButton(${idx})">${btn.text}</button>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    // Modalga DOM'ga qo'shish
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHTML;
    const modalElement = tempDiv.firstElementChild;
    document.body.appendChild(modalElement);

    // Button handlerlarini saqlash
    window.currentModalButtons = buttons;

    // Animatsiya uchun timeout
    setTimeout(() => {
        modalElement.classList.add('active');
    }, 10);

    return {
        close: closeBusinessModal,
        element: modalElement
    };
}

// Modal button handlerini chaqirish
window.handleModalButton = function(index) {
    if (window.currentModalButtons && window.currentModalButtons[index]) {
        window.currentModalButtons[index].onClick();
    }
};

// Modal yopish
function closeBusinessModal() {
    const modal = document.getElementById('businessModalOverlay');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
            window.currentModalButtons = null;
        }, 300);
    }
}

// Global scope'ga export qilish
window.closeBusinessModal = closeBusinessModal;

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
    } else if (pageName === 'salesWarehouse') {
        originalNavigateTo(pageName);
        loadSalesWarehouseData();
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

// ==================== SAVDO & OMBOR MODULI ====================

// Sahifaga o'tish
function openSalesWarehouse() {
    window.navigateTo('salesWarehouse');
    loadSalesWarehouseData();
}

// Savdo & Ombor ma'lumotlarini yuklash
async function loadSalesWarehouseData() {
    const initData = getInitData();
    try {
        // Parallel API so'rovlari
        const [statsRes, salesRes, productsRes, creditsRes] = await Promise.all([
            fetch('/api/business/sales-warehouse/stats', { headers: { 'X-Telegram-Init-Data': initData } }),
            fetch('/api/business/sales?limit=5', { headers: { 'X-Telegram-Init-Data': initData } }),
            fetch('/api/business/warehouse?limit=5', { headers: { 'X-Telegram-Init-Data': initData } }),
            fetch('/api/business/credit?limit=5', { headers: { 'X-Telegram-Init-Data': initData } })
        ]);
        
        const statsData = await statsRes.json();
        const salesList = await salesRes.json();
        const productsList = await productsRes.json();
        const creditsList = await creditsRes.json();

        updateStickyStats(statsData);
        updateOverviewStats(statsData);
        
        // So'nggi harakatlar ro'yxatini yangilash
        updateRecentActivity(salesList, creditsList);
        
        // Top mahsulotlarni ko'rsatish
        updateTopProducts(productsList);
    } catch (error) {
        console.error('Savdo & Ombor ma\'lumotlarini yuklashda xato:', error);
    }
}

// So'nggi harakatlarni yangilash
function updateRecentActivity(sales, credits) {
    const container = document.getElementById('recentActivityList');
    if (!container) return;
    
    let activities = [];
    
    // Sotuvlarni qo'shish
    if (sales && sales.length > 0) {
        sales.forEach(sale => {
            activities.push({
                type: 'sale',
                date: new Date(sale.sale_date),
                amount: sale.total_amount,
                description: sale.client_name || 'Sotuv',
                icon: '📈',
                color: '#10b981'
            });
        });
    }
    
    // Nasiyalarni qo'shish
    if (credits && credits.length > 0) {
        credits.forEach(credit => {
            activities.push({
                type: 'credit',
                date: new Date(credit.given_date),
                amount: credit.amount,
                description: credit.client_name || 'Nasiya',
                icon: '💳',
                color: '#ef4444'
            });
        });
    }
    
    // Sanaga ko'ra tartiblash
    activities.sort((a, b) => b.date - a.date);
    activities = activities.slice(0, 5);
    
    if (activities.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--wallet-text-secondary);">Hozircha harakatlar yo\'q</div>';
        return;
    }
    
    let html = '';
    activities.forEach(activity => {
        const dateStr = activity.date.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' });
        const timeStr = activity.date.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
        html += `
            <div style="padding: 10px 0; border-bottom: 1px solid var(--wallet-border-color); display: flex; align-items: center; gap: 12px;">
                <div style="font-size: 20px;">${activity.icon}</div>
                <div style="flex: 1;">
                    <div style="font-weight: 500; color: var(--wallet-text-primary);">${activity.description}</div>
                    <div style="font-size: 11px; color: var(--wallet-text-secondary);">${dateStr} ${timeStr}</div>
                </div>
                <div style="font-weight: 600; color: ${activity.color};">
                    ${activity.type === 'sale' ? '+' : '-'}${formatCurrency(activity.amount)}
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// Top mahsulotlarni ko'rsatish
function updateTopProducts(products) {
    // Overview sahifasida top mahsulotlarni ko'rsatish uchun
    // Agar overview sahifasida top mahsulotlar bo'limi bo'lsa
    const topProductsContainer = document.getElementById('topProductsList');
    if (!topProductsContainer || !products || products.length === 0) return;
    
    let html = '';
    products.slice(0, 5).forEach((product, index) => {
        html += `
            <div style="padding: 8px 0; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--wallet-border-color);">
                <div style="width: 24px; height: 24px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: 600;">${index + 1}</div>
                <div style="flex: 1;">
                    <div style="font-weight: 500; color: var(--wallet-text-primary);">${product.product_name}</div>
                    <div style="font-size: 11px; color: var(--wallet-text-secondary);">${product.category || 'Kategoriya yo\'q'}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-weight: 600; color: #10b981;">${formatCurrency(product.sell_price || 0)}</div>
                    <div style="font-size: 11px; color: var(--wallet-text-secondary);">${product.quantity} ${product.unit || 'dona'}</div>
                </div>
            </div>
        `;
    });
    topProductsContainer.innerHTML = html;
}

// Overview statistikalarini yangilash
function updateOverviewStats(data) {
    // Bugungi sotuvlar
    document.getElementById('overviewTodaySales').textContent = data.today_sales || 0;
    document.getElementById('overviewSalesTrend').textContent = `+${data.sales_trend || 0}%`;

    // Bugungi daromad
    document.getElementById('overviewTodayRevenue').textContent = formatCurrency(data.today_revenue || 0);
    document.getElementById('overviewRevenueTrend').textContent = `+${data.revenue_trend || 0}%`;

    // Ombor
    document.getElementById('overviewWarehouseStock').textContent = data.total_products || 0;

    // Qarzlar
    document.getElementById('overviewTotalCredit').textContent = formatCurrency(data.total_credit || 0);
    document.getElementById('overviewCreditCount').textContent = `${data.credit_count || 0} ta mijoz`;
}

// Sticky statistikalarni yangilash
function updateStickyStats(data) {
    document.getElementById('stickyStatSales').textContent = data.total_sales || 0;
    document.getElementById('stickyStatProducts').textContent = data.total_products || 0;
    document.getElementById('stickyStatClients').textContent = data.total_clients || 0;
    document.getElementById('stickyStatInvoices').textContent = data.total_invoices || 0;
    document.getElementById('stickyStatCredit').textContent = data.total_credit || 0;
    document.getElementById('stickyStatRevenue').textContent = formatCurrency(data.total_revenue || 0);
}

// Savdo & Ombor bo'limlarini ko'rsatish
function showSalesSection(sectionType) {
    const overview = document.getElementById('salesOverview');
    const detailView = document.getElementById('salesDetailView');

    // Hide overview, show detail view
    overview.style.display = 'none';
    detailView.style.display = 'block';

    // Load section content
    loadSectionDetail(sectionType);
}

// Bo'lim tafsilotini yuklash
async function loadSectionDetail(sectionType) {
    const container = document.getElementById('salesDetailView');

    // Section titles
    const titles = {
        'sales': 'Sotuvlar',
        'products': 'Mahsulotlar',
        'clients': 'Mijozlar',
        'invoices': 'Fakturalar',
        'credit': 'Nasiya',
        'revenue': 'Daromad'
    };

    // Header with back button
    let html = `
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
            <button class="wallet-icon-btn" onclick="showSalesOverview()" style="flex-shrink: 0;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
            </button>
            <h3 style="margin: 0; font-size: 20px; color: var(--wallet-text-primary);">${titles[sectionType]}</h3>
        </div>
    `;

    // Add content based on section
    switch (sectionType) {
        case 'sales':
            html += await getSalesDetailContent();
            break;
        case 'products':
            html += await getProductsDetailContent();
            break;
        case 'clients':
            html += await getClientsDetailContent();
            break;
        case 'invoices':
            html += await getInvoicesDetailContent();
            break;
        case 'credit':
            html += await getCreditDetailContent();
            break;
        case 'revenue':
            html += await getRevenueDetailContent();
            break;
    }

    container.innerHTML = html;
}

// Umumiy ko'rinishga qaytish
function showSalesOverview() {
    document.getElementById('salesOverview').style.display = 'block';
    document.getElementById('salesDetailView').style.display = 'none';
}

// Sotuvlar tafsiloti
async function getSalesDetailContent() {
    // Ma'lumotlarni yuklash
    const initData = getInitData();
    let salesStats = { today_sales: 0, total_revenue: 0, total_sales: 0 };
    let salesList = [];
    
    try {
        const [statsRes, salesRes] = await Promise.all([
            fetch('/api/business/sales-warehouse/stats', { headers: { 'X-Telegram-Init-Data': initData } }),
            fetch('/api/business/sales?limit=50', { headers: { 'X-Telegram-Init-Data': initData } })
        ]);
        salesStats = await statsRes.json();
        salesList = await salesRes.json();
    } catch (e) { console.error('Sales data error:', e); }
    
    const avgCheck = salesStats.total_sales > 0 ? salesStats.total_revenue / salesStats.total_sales : 0;
    
    let salesHtml = '';
    if (salesList && salesList.length > 0) {
        salesList.forEach(sale => {
            const date = new Date(sale.sale_date);
            const dateStr = date.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const timeStr = date.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
            salesHtml += `
                <div style="padding: 12px; border-bottom: 1px solid var(--wallet-border-color); display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 600; color: var(--wallet-text-primary);">${formatCurrency(sale.total_amount)}</div>
                        <div style="font-size: 12px; color: var(--wallet-text-secondary);">${sale.client_name || 'Naqd'} • ${sale.payment_type === 'cash' ? 'Naqd' : 'Karta'}</div>
                        <div style="font-size: 11px; color: var(--wallet-text-secondary);">${dateStr} ${timeStr}</div>
                    </div>
                    <div style="color: #10b981; font-size: 20px;">✓</div>
                </div>
            `;
        });
    } else {
        salesHtml = '<div style="text-align: center; padding: 40px 20px; color: var(--wallet-text-secondary);">Sotuvlar mavjud emas</div>';
    }
    
    return `
        <button class="wallet-btn-primary" onclick="showAddSaleModal()" style="margin-bottom: 16px; width: 100%;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                <path d="M12 5v14M5 12h14"/>
            </svg>
            <span>Yangi sotuv</span>
        </button>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px;">
            <div class="wallet-stat-card">
                <div style="font-size: 12px; color: var(--wallet-text-secondary);">Jami sotuvlar</div>
                <div style="font-size: 24px; font-weight: 700; color: var(--wallet-text-primary);">${salesStats.total_sales || 0}</div>
            </div>
            <div class="wallet-stat-card">
                <div style="font-size: 12px; color: var(--wallet-text-secondary);">Jami summa</div>
                <div style="font-size: 24px; font-weight: 700; color: #10b981;">${formatCurrency(salesStats.total_revenue || 0)}</div>
            </div>
            <div class="wallet-stat-card">
                <div style="font-size: 12px; color: var(--wallet-text-secondary);">O'rtacha chek</div>
                <div style="font-size: 24px; font-weight: 700; color: var(--wallet-text-primary);">${formatCurrency(avgCheck)}</div>
            </div>
            <div class="wallet-stat-card">
                <div style="font-size: 12px; color: var(--wallet-text-secondary);">Bugungi sotuvlar</div>
                <div style="font-size: 24px; font-weight: 700; color: #3b82f6;">${salesStats.today_sales || 0}</div>
            </div>
        </div>
        <div class="wallet-card">
            <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--wallet-text-primary);">So'nggi sotuvlar</h4>
            <div id="salesListContainer">${salesHtml}</div>
            </div>
    `;
}

// Mahsulotlar tafsiloti (Ombor sahifasi)
async function getProductsDetailContent() {
    const initData = getInitData();
    let warehouseStats = { total_products: 0, low_stock_count: 0, total_value: 0 };
    let products = [];
    
    try {
        const [statsRes, productsRes] = await Promise.all([
            fetch('/api/business/statistics/warehouse', { headers: { 'X-Telegram-Init-Data': initData } }),
            fetch('/api/business/warehouse?limit=100', { headers: { 'X-Telegram-Init-Data': initData } })
        ]);
        warehouseStats = await statsRes.json();
        products = await productsRes.json();
    } catch (e) { console.error('Products data error:', e); }
    
    const categoriesCount = [...new Set(products.map(p => p.category).filter(c => c))].length;
    
    let productsHtml = '';
    if (products && products.length > 0) {
        products.forEach(product => {
            const isLowStock = product.min_stock > 0 && product.quantity <= product.min_stock;
            const stockColor = isLowStock ? '#ef4444' : '#10b981';
            productsHtml += `
                <div style="padding: 14px; border-bottom: 1px solid var(--wallet-border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: var(--wallet-text-primary); margin-bottom: 4px;">${product.product_name}</div>
                            <div style="font-size: 12px; color: var(--wallet-text-secondary);">
                                ${product.category || 'Kategoriya yo\'q'} ${product.product_code ? `• Kod: ${product.product_code}` : ''}
        </div>
                            <div style="font-size: 13px; color: #3b82f6; margin-top: 4px;">Narx: ${formatCurrency(product.sell_price || 0)}</div>
            </div>
                        <div style="text-align: right;">
                            <div style="font-weight: 700; color: ${stockColor}; font-size: 18px;">${product.quantity}</div>
                            <div style="font-size: 11px; color: var(--wallet-text-secondary);">${product.unit || 'dona'}</div>
                            ${isLowStock ? '<div style="font-size: 10px; color: #ef4444; margin-top: 2px;">⚠️ Kam qoldi</div>' : ''}
                </div>
            </div>
        </div>
    `;
        });
    } else {
        productsHtml = '<div style="text-align: center; padding: 40px 20px; color: var(--wallet-text-secondary);">Mahsulotlar mavjud emas</div>';
}

    return `
        <button class="wallet-btn-primary" onclick="showAddWarehouseModal()" style="margin-bottom: 16px; width: 100%;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                <path d="M12 5v14M5 12h14"/>
            </svg>
            <span>Yangi mahsulot</span>
        </button>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px;">
            <div class="wallet-stat-card">
                <div style="font-size: 12px; color: var(--wallet-text-secondary);">Jami mahsulotlar</div>
                <div style="font-size: 24px; font-weight: 700; color: var(--wallet-text-primary);">${warehouseStats.total_products || 0}</div>
            </div>
            <div class="wallet-stat-card">
                <div style="font-size: 12px; color: var(--wallet-text-secondary);">Kam qolgan</div>
                <div style="font-size: 24px; font-weight: 700; color: #ef4444;">${warehouseStats.low_stock_count || 0}</div>
            </div>
            <div class="wallet-stat-card">
                <div style="font-size: 12px; color: var(--wallet-text-secondary);">Kategoriyalar</div>
                <div style="font-size: 24px; font-weight: 700; color: #8b5cf6;">${categoriesCount}</div>
            </div>
            <div class="wallet-stat-card">
                <div style="font-size: 12px; color: var(--wallet-text-secondary);">Ombor qiymati</div>
                <div style="font-size: 24px; font-weight: 700; color: #10b981;">${formatCurrency(warehouseStats.total_value || 0)}</div>
        </div>
            </div>
        <div class="wallet-card">
            <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--wallet-text-primary);">Mahsulotlar ro'yxati</h4>
            <div id="productsListContainer">${productsHtml}</div>
                </div>
    `;
}

// Mijozlar tafsiloti
async function getClientsDetailContent() {
    const initData = getInitData();
    let clients = [];
    let clientStats = { total_clients: 0, suppliers: 0, active_clients: 0, new_clients: 0 };
    
    try {
        const clientsRes = await fetch('/api/business/clients?limit=100', { headers: { 'X-Telegram-Init-Data': initData } });
        clients = await clientsRes.json();
        
        // Statistikalarni hisoblash
        clientStats.total_clients = clients.length;
        clientStats.suppliers = clients.filter(c => c.type === 'supplier').length;
        clientStats.active_clients = clients.filter(c => c.status === 'active').length;
        // 30 kun ichida qo'shilganlar
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        clientStats.new_clients = clients.filter(c => new Date(c.created_at) > thirtyDaysAgo).length;
    } catch (e) { console.error('Clients data error:', e); }
    
    let clientsHtml = '';
    if (clients && clients.length > 0) {
        clients.forEach(client => {
            const balance = parseFloat(client.balance || 0);
            const balanceColor = balance > 0 ? '#10b981' : balance < 0 ? '#ef4444' : 'var(--wallet-text-secondary)';
            const typeLabel = client.type === 'supplier' ? 'Yetkazuvchi' : 'Mijoz';
            const statusLabel = client.status === 'active' ? 'Aktiv' : 'Passiv';
            const statusColor = client.status === 'active' ? '#10b981' : '#f59e0b';
            
            clientsHtml += `
                <div style="padding: 14px; border-bottom: 1px solid var(--wallet-border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: var(--wallet-text-primary); margin-bottom: 4px;">${client.name}</div>
                            <div style="font-size: 12px; color: var(--wallet-text-secondary);">
                                <span style="color: ${client.type === 'supplier' ? '#8b5cf6' : '#3b82f6'};">${typeLabel}</span> • 
                                <span style="color: ${statusColor};">${statusLabel}</span>
                            </div>
                            ${client.phone ? `<div style="font-size: 12px; color: var(--wallet-text-secondary); margin-top: 4px;">📞 ${client.phone}</div>` : ''}
                        </div>
                        <div style="text-align: right;">
                            <div style="font-weight: 700; color: ${balanceColor}; font-size: 16px;">
                                ${balance >= 0 ? '+' : ''}${formatCurrency(balance)}
                            </div>
                            <div style="font-size: 11px; color: var(--wallet-text-secondary);">
                                ${balance > 0 ? 'Ortiqcha' : balance < 0 ? 'Qarz' : 'Balans'}
                            </div>
                        </div>
            </div>
        </div>
    `;
        });
    } else {
        clientsHtml = '<div style="text-align: center; padding: 40px 20px; color: var(--wallet-text-secondary);">Mijozlar mavjud emas</div>';
}

    return `
        <button class="wallet-btn-primary" onclick="showAddClientModal()" style="margin-bottom: 16px; width: 100%;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                <path d="M12 5v14M5 12h14"/>
            </svg>
            <span>Yangi mijoz</span>
        </button>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px;">
            <div class="wallet-stat-card">
                <div style="font-size: 12px; color: var(--wallet-text-secondary);">Jami mijozlar</div>
                <div style="font-size: 24px; font-weight: 700; color: var(--wallet-text-primary);">${clientStats.total_clients}</div>
            </div>
            <div class="wallet-stat-card">
                <div style="font-size: 12px; color: var(--wallet-text-secondary);">Yetkazuvchilar</div>
                <div style="font-size: 24px; font-weight: 700; color: #8b5cf6;">${clientStats.suppliers}</div>
            </div>
            <div class="wallet-stat-card">
                <div style="font-size: 12px; color: var(--wallet-text-secondary);">Aktiv kontragentlar</div>
                <div style="font-size: 24px; font-weight: 700; color: #10b981;">${clientStats.active_clients}</div>
            </div>
            <div class="wallet-stat-card">
                <div style="font-size: 12px; color: var(--wallet-text-secondary);">Yangi mijozlar</div>
                <div style="font-size: 24px; font-weight: 700; color: #3b82f6;">${clientStats.new_clients}</div>
        </div>
            </div>
        <div class="wallet-card">
            <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--wallet-text-primary);">Kontragentlar ro'yxati</h4>
            <div id="clientsListContainer">${clientsHtml}</div>
        </div>
    `;
}

// Fakturalar tafsiloti
async function getInvoicesDetailContent() {
    const initData = getInitData();
    let invoices = [];
    let invoiceStats = { total: 0, pending: 0, paid: 0, total_amount: 0 };
    
    try {
        const invoicesRes = await fetch('/api/business/invoices?limit=100', { headers: { 'X-Telegram-Init-Data': initData } });
        invoices = await invoicesRes.json();
        
        // Statistikalarni hisoblash
        invoiceStats.total = invoices.length;
        invoiceStats.pending = invoices.filter(i => i.status === 'pending').length;
        invoiceStats.paid = invoices.filter(i => i.status === 'paid').length;
        invoiceStats.total_amount = invoices.reduce((sum, i) => sum + parseFloat(i.total_amount || 0), 0);
    } catch (e) { console.error('Invoices data error:', e); }
    
    let invoicesHtml = '';
    if (invoices && invoices.length > 0) {
        invoices.forEach(invoice => {
            const date = new Date(invoice.invoice_date);
            const dateStr = date.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const statusLabel = invoice.status === 'paid' ? 'To\'langan' : 'Kutilmoqda';
            const statusColor = invoice.status === 'paid' ? '#10b981' : '#f59e0b';
            const statusBg = invoice.status === 'paid' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)';
            
            invoicesHtml += `
                <div style="padding: 14px; border-bottom: 1px solid var(--wallet-border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: var(--wallet-text-primary); margin-bottom: 4px;">${invoice.invoice_number}</div>
                            <div style="font-size: 12px; color: var(--wallet-text-secondary);">
                                ${invoice.client_name || 'Mijoz belgilanmagan'} • ${dateStr}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-weight: 700; color: var(--wallet-text-primary); font-size: 16px;">${formatCurrency(invoice.total_amount)}</div>
                            <div style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: ${statusBg}; color: ${statusColor}; display: inline-block; margin-top: 4px;">
                                ${statusLabel}
                            </div>
                        </div>
            </div>
        </div>
    `;
        });
    } else {
        invoicesHtml = '<div style="text-align: center; padding: 40px 20px; color: var(--wallet-text-secondary);">Fakturalar mavjud emas</div>';
}

    return `
        <button class="wallet-btn-primary" onclick="showAddInvoiceModal()" style="margin-bottom: 16px; width: 100%;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                        <path d="M12 5v14M5 12h14"/>
                    </svg>
            <span>Yangi faktura</span>
                </button>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px;">
            <div class="wallet-stat-card">
                <div style="font-size: 12px; color: var(--wallet-text-secondary);">Jami fakturalar</div>
                <div style="font-size: 24px; font-weight: 700; color: var(--wallet-text-primary);">${invoiceStats.total}</div>
            </div>
            <div class="wallet-stat-card">
                <div style="font-size: 12px; color: var(--wallet-text-secondary);">Kutish holatida</div>
                <div style="font-size: 24px; font-weight: 700; color: #f59e0b;">${invoiceStats.pending}</div>
            </div>
            <div class="wallet-stat-card">
                <div style="font-size: 12px; color: var(--wallet-text-secondary);">To'langan</div>
                <div style="font-size: 24px; font-weight: 700; color: #10b981;">${invoiceStats.paid}</div>
            </div>
            <div class="wallet-stat-card">
                <div style="font-size: 12px; color: var(--wallet-text-secondary);">Umumiy summa</div>
                <div style="font-size: 24px; font-weight: 700; color: #3b82f6;">${formatCurrency(invoiceStats.total_amount)}</div>
        </div>
            </div>
        <div class="wallet-card">
            <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--wallet-text-primary);">Fakturalar ro'yxati</h4>
            <div id="invoicesListContainer">${invoicesHtml}</div>
        </div>
    `;
}

// Nasiya tafsiloti
async function getCreditDetailContent() {
    const initData = getInitData();
    let credits = [];
    let creditStats = { total: 0, total_debt: 0, overdue: 0, paid: 0 };
    
    try {
        const creditsRes = await fetch('/api/business/credit?limit=100', { headers: { 'X-Telegram-Init-Data': initData } });
        credits = await creditsRes.json();
        
        // Statistikalarni hisoblash
        creditStats.total = credits.length;
        creditStats.total_debt = credits.reduce((sum, c) => sum + (parseFloat(c.amount || 0) - parseFloat(c.paid_amount || 0)), 0);
        creditStats.overdue = credits.filter(c => {
            if (!c.due_date || c.status !== 'active') return false;
            return new Date(c.due_date) < new Date();
        }).length;
        creditStats.paid = credits.filter(c => c.status === 'closed').length;
    } catch (e) { console.error('Credits data error:', e); }
    
    let creditsHtml = '';
    if (credits && credits.length > 0) {
        credits.forEach(credit => {
            const givenDate = new Date(credit.given_date);
            const givenDateStr = givenDate.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const dueDate = credit.due_date ? new Date(credit.due_date) : null;
            const dueDateStr = dueDate ? dueDate.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Belgilanmagan';
            
            const isOverdue = dueDate && dueDate < new Date() && credit.status === 'active';
            const remaining = parseFloat(credit.amount || 0) - parseFloat(credit.paid_amount || 0);
            
            let statusLabel = 'Aktiv';
            let statusColor = '#3b82f6';
            let statusBg = 'rgba(59, 130, 246, 0.1)';
            
            if (credit.status === 'closed') {
                statusLabel = 'Yopilgan';
                statusColor = '#10b981';
                statusBg = 'rgba(16, 185, 129, 0.1)';
            } else if (isOverdue) {
                statusLabel = 'Kechikkan';
                statusColor = '#ef4444';
                statusBg = 'rgba(239, 68, 68, 0.1)';
            }
            
            creditsHtml += `
                <div style="padding: 14px; border-bottom: 1px solid var(--wallet-border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: var(--wallet-text-primary); margin-bottom: 4px;">${credit.client_name || 'Mijoz'}</div>
                            <div style="font-size: 12px; color: var(--wallet-text-secondary);">
                                Berilgan: ${givenDateStr}
                            </div>
                            <div style="font-size: 12px; color: ${isOverdue ? '#ef4444' : 'var(--wallet-text-secondary)'};">
                                Muddat: ${dueDateStr} ${isOverdue ? '⚠️' : ''}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-weight: 700; color: #ef4444; font-size: 16px;">${formatCurrency(remaining)}</div>
                            <div style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: ${statusBg}; color: ${statusColor}; display: inline-block; margin-top: 4px;">
                                ${statusLabel}
                            </div>
                        </div>
            </div>
        </div>
    `;
        });
    } else {
        creditsHtml = '<div style="text-align: center; padding: 40px 20px; color: var(--wallet-text-secondary);">Nasiyalar mavjud emas</div>';
}

    return `
        <button class="wallet-btn-primary" onclick="showAddCreditModal()" style="margin-bottom: 16px; width: 100%;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                <path d="M12 5v14M5 12h14"/>
            </svg>
            <span>Yangi nasiya</span>
        </button>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px;">
            <div class="wallet-stat-card">
                <div style="font-size: 12px; color: var(--wallet-text-secondary);">Jami nasiya</div>
                <div style="font-size: 24px; font-weight: 700; color: var(--wallet-text-primary);">${creditStats.total}</div>
            </div>
            <div class="wallet-stat-card">
                <div style="font-size: 12px; color: var(--wallet-text-secondary);">Qarz summasi</div>
                <div style="font-size: 24px; font-weight: 700; color: #ef4444;">${formatCurrency(creditStats.total_debt)}</div>
            </div>
            <div class="wallet-stat-card">
                <div style="font-size: 12px; color: var(--wallet-text-secondary);">Muddati o'tgan</div>
                <div style="font-size: 24px; font-weight: 700; color: #f59e0b;">${creditStats.overdue}</div>
            </div>
            <div class="wallet-stat-card">
                <div style="font-size: 12px; color: var(--wallet-text-secondary);">To'langan</div>
                <div style="font-size: 24px; font-weight: 700; color: #10b981;">${creditStats.paid}</div>
        </div>
            </div>
        <div class="wallet-card">
            <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--wallet-text-primary);">Nasiya ro'yxati</h4>
            <div id="creditsListContainer">${creditsHtml}</div>
            </div>
    `;
}

// Daromad tafsiloti
async function getRevenueDetailContent() {
    const initData = getInitData();
    let revenueStats = { today: 0, week: 0, month: 0, total: 0 };
    let salesList = [];
    
    try {
        const [statsRes, salesRes] = await Promise.all([
            fetch('/api/business/sales-warehouse/stats', { headers: { 'X-Telegram-Init-Data': initData } }),
            fetch('/api/business/sales?limit=20', { headers: { 'X-Telegram-Init-Data': initData } })
        ]);
        const statsData = await statsRes.json();
        salesList = await salesRes.json();
        
        revenueStats.today = statsData.today_revenue || 0;
        revenueStats.week = statsData.week_revenue || statsData.total_revenue * 0.3 || 0;
        revenueStats.month = statsData.month_revenue || statsData.total_revenue || 0;
        revenueStats.total = statsData.total_revenue || 0;
    } catch (e) { console.error('Revenue data error:', e); }
    
    // So'nggi daromadlar ro'yxati
    let historyHtml = '';
    if (salesList && salesList.length > 0) {
        salesList.forEach(sale => {
            const date = new Date(sale.sale_date);
            const dateStr = date.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const timeStr = date.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
            
            historyHtml += `
                <div style="padding: 12px; border-bottom: 1px solid var(--wallet-border-color); display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 600; color: var(--wallet-text-primary);">${sale.client_name || 'Sotuv'}</div>
                        <div style="font-size: 12px; color: var(--wallet-text-secondary);">${dateStr} ${timeStr}</div>
                    </div>
                    <div style="font-weight: 700; color: #10b981; font-size: 16px;">+${formatCurrency(sale.total_amount)}</div>
        </div>
    `;
        });
    } else {
        historyHtml = '<div style="text-align: center; padding: 40px 20px; color: var(--wallet-text-secondary);">Daromad tarixi mavjud emas</div>';
    }
    
    // Trend hisoblash
    const todayTrend = revenueStats.today > 0 ? '+' : '';
    const weekTrend = revenueStats.week > revenueStats.today * 7 ? '↑' : '↓';
    
    return `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px;">
            <div class="wallet-stat-card">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="font-size: 12px; color: var(--wallet-text-secondary);">Bugungi daromad</div>
                    <span style="font-size: 10px; color: #10b981;">${todayTrend ? '↑' : ''}</span>
                </div>
                <div style="font-size: 24px; font-weight: 700; color: #10b981;">${formatCurrency(revenueStats.today)}</div>
            </div>
            <div class="wallet-stat-card">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="font-size: 12px; color: var(--wallet-text-secondary);">Bu hafta</div>
                    <span style="font-size: 10px; color: ${weekTrend === '↑' ? '#10b981' : '#f59e0b'};">${weekTrend}</span>
                </div>
                <div style="font-size: 24px; font-weight: 700; color: var(--wallet-text-primary);">${formatCurrency(revenueStats.week)}</div>
            </div>
            <div class="wallet-stat-card">
                <div style="font-size: 12px; color: var(--wallet-text-secondary);">Bu oy</div>
                <div style="font-size: 24px; font-weight: 700; color: #3b82f6;">${formatCurrency(revenueStats.month)}</div>
            </div>
            <div class="wallet-stat-card">
                <div style="font-size: 12px; color: var(--wallet-text-secondary);">Jami daromad</div>
                <div style="font-size: 24px; font-weight: 700; color: #8b5cf6;">${formatCurrency(revenueStats.total)}</div>
        </div>
        </div>
        
        <div class="wallet-card" style="margin-bottom: 20px;">
            <h4 style="margin: 0 0 16px 0; font-size: 16px; color: var(--wallet-text-primary);">Daromad grafigi</h4>
            <div style="display: flex; align-items: flex-end; justify-content: space-between; height: 120px; padding: 10px 0;">
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                    <div style="width: 30px; background: linear-gradient(to top, #3b82f6, #8b5cf6); border-radius: 4px; height: ${Math.max(20, (revenueStats.today / Math.max(revenueStats.month, 1)) * 100)}px;"></div>
                    <div style="font-size: 10px; color: var(--wallet-text-secondary); margin-top: 4px;">Bugun</div>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                    <div style="width: 30px; background: linear-gradient(to top, #10b981, #34d399); border-radius: 4px; height: ${Math.max(20, (revenueStats.week / Math.max(revenueStats.month, 1)) * 100)}px;"></div>
                    <div style="font-size: 10px; color: var(--wallet-text-secondary); margin-top: 4px;">Hafta</div>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                    <div style="width: 30px; background: linear-gradient(to top, #f59e0b, #fbbf24); border-radius: 4px; height: 100px;"></div>
                    <div style="font-size: 10px; color: var(--wallet-text-secondary); margin-top: 4px;">Oy</div>
                </div>
            </div>
        </div>
        
        <div class="wallet-card">
            <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--wallet-text-primary);">Daromad tarixchasi</h4>
            <div id="revenueHistoryContainer">${historyHtml}</div>
        </div>
    `;
}

// ==================== MODAL FUNKSIYALARI ====================

// Yangi sotuv qo'shish modali
function showAddSaleModal() {
    const modalHtml = `
        <div id="saleModal" class="wallet-modal" style="display: flex;">
            <div class="wallet-modal-content">
                <div class="wallet-modal-header">
                    <h3>Yangi sotuv</h3>
                    <button class="wallet-icon-btn" onclick="closeSaleModal()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div class="wallet-modal-body">
                    <div class="wallet-form-group">
                        <label>Mijoz nomi (ixtiyoriy)</label>
                        <input type="text" id="saleClientName" class="wallet-input" placeholder="Mijoz nomi">
                    </div>
                    <div class="wallet-form-group">
                        <label>Summa *</label>
                        <input type="number" id="saleAmount" class="wallet-input" placeholder="0" required>
                    </div>
                    <div class="wallet-form-group">
                        <label>To'lov turi</label>
                        <select id="salePaymentType" class="wallet-input">
                            <option value="cash">Naqd</option>
                            <option value="card">Karta</option>
                            <option value="transfer">O'tkazma</option>
                            <option value="credit">Nasiya</option>
                        </select>
                    </div>
                    <div class="wallet-form-group">
                        <label>Izoh</label>
                        <textarea id="saleNotes" class="wallet-input" rows="2" placeholder="Izoh..."></textarea>
                    </div>
                </div>
                <div class="wallet-modal-footer">
                    <button class="wallet-btn-secondary" onclick="closeSaleModal()">Bekor qilish</button>
                    <button class="wallet-btn-primary" onclick="saveSale()">Saqlash</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeSaleModal() {
    const modal = document.getElementById('saleModal');
    if (modal) modal.remove();
}

async function saveSale() {
    const amount = document.getElementById('saleAmount').value;
    if (!amount || parseFloat(amount) <= 0) {
        showToast('Summani kiriting', 'error');
        return;
    }
    
    const initData = getInitData();
    try {
        const response = await fetch('/api/business/sales', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': initData
            },
            body: JSON.stringify({
                client_name: document.getElementById('saleClientName').value,
                total_amount: parseFloat(amount),
                payment_type: document.getElementById('salePaymentType').value,
                notes: document.getElementById('saleNotes').value
            })
        });
        const result = await response.json();
        if (result.success) {
            showToast('Sotuv qo\'shildi', 'success');
            closeSaleModal();
            loadSectionDetail('sales'); // Sahifani yangilash
        } else {
            showToast('Xatolik yuz berdi', 'error');
        }
    } catch (e) {
        console.error('Save sale error:', e);
        showToast('Xatolik yuz berdi', 'error');
    }
}

// Yangi mijoz qo'shish modali
function showAddClientModal() {
    const modalHtml = `
        <div id="clientModal" class="wallet-modal" style="display: flex;">
            <div class="wallet-modal-content">
                <div class="wallet-modal-header">
                    <h3>Yangi mijoz</h3>
                    <button class="wallet-icon-btn" onclick="closeClientModal()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div class="wallet-modal-body">
                    <div class="wallet-form-group">
                        <label>Nomi *</label>
                        <input type="text" id="clientName" class="wallet-input" placeholder="Mijoz nomi" required>
                    </div>
                    <div class="wallet-form-group">
                        <label>Telefon</label>
                        <input type="tel" id="clientPhone" class="wallet-input" placeholder="+998 90 123 45 67">
                    </div>
                    <div class="wallet-form-group">
                        <label>Turi</label>
                        <select id="clientType" class="wallet-input">
                            <option value="customer">Mijoz</option>
                            <option value="supplier">Yetkazuvchi</option>
                        </select>
                    </div>
                    <div class="wallet-form-group">
                        <label>Manzil</label>
                        <textarea id="clientAddress" class="wallet-input" rows="2" placeholder="Manzil..."></textarea>
                    </div>
                </div>
                <div class="wallet-modal-footer">
                    <button class="wallet-btn-secondary" onclick="closeClientModal()">Bekor qilish</button>
                    <button class="wallet-btn-primary" onclick="saveClient()">Saqlash</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeClientModal() {
    const modal = document.getElementById('clientModal');
    if (modal) modal.remove();
}

async function saveClient() {
    const name = document.getElementById('clientName').value;
    if (!name) {
        showToast('Nomni kiriting', 'error');
        return;
    }
    
    const initData = getInitData();
    try {
        const response = await fetch('/api/business/clients', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': initData
            },
            body: JSON.stringify({
                name: name,
                phone: document.getElementById('clientPhone').value,
                type: document.getElementById('clientType').value,
                address: document.getElementById('clientAddress').value
            })
        });
        const result = await response.json();
        if (result.success) {
            showToast('Mijoz qo\'shildi', 'success');
            closeClientModal();
            loadSectionDetail('clients');
        } else {
            showToast('Xatolik yuz berdi', 'error');
        }
    } catch (e) {
        console.error('Save client error:', e);
        showToast('Xatolik yuz berdi', 'error');
    }
}

// Yangi faktura qo'shish modali
function showAddInvoiceModal() {
    const invoiceNumber = 'INV-' + Date.now().toString().slice(-6);
    const modalHtml = `
        <div id="invoiceModal" class="wallet-modal" style="display: flex;">
            <div class="wallet-modal-content">
                <div class="wallet-modal-header">
                    <h3>Yangi faktura</h3>
                    <button class="wallet-icon-btn" onclick="closeInvoiceModal()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div class="wallet-modal-body">
                    <div class="wallet-form-group">
                        <label>Faktura raqami</label>
                        <input type="text" id="invoiceNumber" class="wallet-input" value="${invoiceNumber}" readonly>
                    </div>
                    <div class="wallet-form-group">
                        <label>Mijoz nomi *</label>
                        <input type="text" id="invoiceClientName" class="wallet-input" placeholder="Mijoz nomi" required>
                    </div>
                    <div class="wallet-form-group">
                        <label>Summa *</label>
                        <input type="number" id="invoiceAmount" class="wallet-input" placeholder="0" required>
                    </div>
                    <div class="wallet-form-group">
                        <label>To'lov muddati</label>
                        <input type="date" id="invoiceDueDate" class="wallet-input">
                    </div>
                </div>
                <div class="wallet-modal-footer">
                    <button class="wallet-btn-secondary" onclick="closeInvoiceModal()">Bekor qilish</button>
                    <button class="wallet-btn-primary" onclick="saveInvoice()">Saqlash</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeInvoiceModal() {
    const modal = document.getElementById('invoiceModal');
    if (modal) modal.remove();
}

async function saveInvoice() {
    const clientName = document.getElementById('invoiceClientName').value;
    const amount = document.getElementById('invoiceAmount').value;
    if (!clientName || !amount) {
        showToast('Barcha maydonlarni to\'ldiring', 'error');
        return;
    }
    
    const initData = getInitData();
    try {
        const response = await fetch('/api/business/invoices', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': initData
            },
            body: JSON.stringify({
                invoice_number: document.getElementById('invoiceNumber').value,
                client_name: clientName,
                total_amount: parseFloat(amount),
                due_date: document.getElementById('invoiceDueDate').value || null
            })
        });
        const result = await response.json();
        if (result.success) {
            showToast('Faktura qo\'shildi', 'success');
            closeInvoiceModal();
            loadSectionDetail('invoices');
        } else {
            showToast('Xatolik yuz berdi', 'error');
        }
    } catch (e) {
        console.error('Save invoice error:', e);
        showToast('Xatolik yuz berdi', 'error');
    }
}

// Yangi nasiya qo'shish modali
function showAddCreditModal() {
    const modalHtml = `
        <div id="creditModal" class="wallet-modal" style="display: flex;">
            <div class="wallet-modal-content">
                <div class="wallet-modal-header">
                    <h3>Yangi nasiya</h3>
                    <button class="wallet-icon-btn" onclick="closeCreditModal()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div class="wallet-modal-body">
                    <div class="wallet-form-group">
                        <label>Mijoz nomi *</label>
                        <input type="text" id="creditClientName" class="wallet-input" placeholder="Mijoz nomi" required>
                    </div>
                    <div class="wallet-form-group">
                        <label>Qarz summasi *</label>
                        <input type="number" id="creditAmount" class="wallet-input" placeholder="0" required>
                    </div>
                    <div class="wallet-form-group">
                        <label>To'lash muddati</label>
                        <input type="date" id="creditDueDate" class="wallet-input">
                    </div>
                    <div class="wallet-form-group">
                        <label>Izoh</label>
                        <textarea id="creditNotes" class="wallet-input" rows="2" placeholder="Izoh..."></textarea>
                    </div>
                </div>
                <div class="wallet-modal-footer">
                    <button class="wallet-btn-secondary" onclick="closeCreditModal()">Bekor qilish</button>
                    <button class="wallet-btn-primary" onclick="saveCredit()">Saqlash</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeCreditModal() {
    const modal = document.getElementById('creditModal');
    if (modal) modal.remove();
}

async function saveCredit() {
    const clientName = document.getElementById('creditClientName').value;
    const amount = document.getElementById('creditAmount').value;
    if (!clientName || !amount) {
        showToast('Barcha maydonlarni to\'ldiring', 'error');
        return;
    }
    
    const initData = getInitData();
    try {
        const response = await fetch('/api/business/credit', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': initData
            },
            body: JSON.stringify({
                client_name: clientName,
                amount: parseFloat(amount),
                due_date: document.getElementById('creditDueDate').value || null,
                notes: document.getElementById('creditNotes').value
            })
        });
        const result = await response.json();
        if (result.success) {
            showToast('Nasiya qo\'shildi', 'success');
            closeCreditModal();
            loadSectionDetail('credit');
        } else {
            showToast('Xatolik yuz berdi', 'error');
        }
    } catch (e) {
        console.error('Save credit error:', e);
        showToast('Xatolik yuz berdi', 'error');
    }
}

// Yangi mahsulot qo'shish (Ombor uchun)
function showAddProductModal() {
    // Ombor sahifasidagi mavjud modal funksiyasini chaqirish
    if (typeof showAddWarehouseModal === 'function') {
        showAddWarehouseModal();
    } else {
        showToast('Mahsulot qo\'shish uchun Ombor sahifasiga o\'ting', 'info');
    }
}

// Global scope'ga export
window.openSalesWarehouse = openSalesWarehouse;
window.showSalesSection = showSalesSection;
window.showSalesOverview = showSalesOverview;
window.showAddSaleModal = showAddSaleModal;
window.showAddProductModal = showAddProductModal;
window.showAddClientModal = showAddClientModal;
window.showAddInvoiceModal = showAddInvoiceModal;
window.showAddCreditModal = showAddCreditModal;
window.closeSaleModal = closeSaleModal;
window.saveSale = saveSale;
window.closeClientModal = closeClientModal;
window.saveClient = saveClient;
window.closeInvoiceModal = closeInvoiceModal;
window.saveInvoice = saveInvoice;
window.closeCreditModal = closeCreditModal;
window.saveCredit = saveCredit;
window.loadSectionDetail = loadSectionDetail;

// ==================== HR BO'LIMI (XODIMLAR BOSHQARUVI) ====================

// Data storage (loaded from backend API)
let hrEmployees = [];
let hrTasks = [];
let hrVacations = [];

// HR bo'limiga o'tish
function openHR() {
    window.navigateTo('HR');
    loadHRData();
}

// HR ma'lumotlarini yuklash
async function loadHRData() {
    try {
        // API dan xodimlarni yuklash
        const initData = getInitData();
        
        // Xodimlarni yuklash
        const employeesResponse = await fetch('/api/business/employees?limit=100', {
            headers: {
                'X-Telegram-Init-Data': initData
            }
        });
        const employeesData = await employeesResponse.json();
        
        if (Array.isArray(employeesData)) {
            // API dan kelgan ma'lumotlarni hrEmployees formatiga o'tkazish
            hrEmployees = employeesData.map(emp => ({
                id: emp.id || emp.employee_user_id,
                name: emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.username || 'Noma\'lum',
                position: emp.position || 'Xodim',
                department: emp.department || 'Umumiy',
                salary: emp.salary || 0,
                phone: emp.phone || '',
                status: emp.status || 'active',
                is_employee_link: emp.is_employee_link || false,
                employee_user_id: emp.employee_user_id
            }));
        }
        
        // Vazifalarni yuklash
        const tasksResponse = await fetch('/api/business/tasks?limit=100', {
            headers: {
                'X-Telegram-Init-Data': initData
            }
        });
        const tasksData = await tasksResponse.json();
        
        if (Array.isArray(tasksData)) {
            hrTasks = tasksData.map(task => ({
                id: task.id,
                title: task.title,
                description: task.description,
                assignedTo: task.assigned_to,
                assigneeName: task.employee_name || 'Tayinlanmagan',
                priority: task.priority || 'medium',
                status: task.status || 'pending',
                dueDate: task.due_date
            }));
        }
        
        // Load sticky statistics
        updateHRStickyStats();

        // Load overview statistics
        updateHROverviewStats();
    } catch (error) {
        console.error('HR ma\'lumotlarini yuklashda xato:', error);
        showToast('Ma\'lumotlarni yuklashda xatolik', 'error');
    }
}

// Sticky statistikalarni yangilash
function updateHRStickyStats() {
    document.getElementById('hrStatEmployees').textContent = hrEmployees.length || 0;
    document.getElementById('hrStatSchedule').textContent = hrEmployees.filter(e => e.status === 'active').length || 0;
    document.getElementById('hrStatVacation').textContent = hrVacations.filter(v => v.status === 'approved').length || 0;
    document.getElementById('hrStatTasks').textContent = hrTasks.length || 0;

    const totalSalary = hrEmployees.reduce((sum, e) => sum + (e.salary || 0), 0);
    document.getElementById('hrStatSalary').textContent = formatCurrency(totalSalary);
}

// Overview statistikalarni yangilash
function updateHROverviewStats() {
    const activeEmployees = hrEmployees.filter(e => e.status === 'active').length;
    const completedTasks = hrTasks.filter(t => t.status === 'completed').length;
    const totalSalary = hrEmployees.reduce((sum, e) => sum + (e.salary || 0), 0);
    const unpaidSalary = hrEmployees.reduce((sum, e) => sum + (e.unpaid || 0), 0);

    document.getElementById('overviewTotalEmployees').textContent = hrEmployees.length || 0;
    document.getElementById('overviewEmployeesTrend').textContent = `Faol: ${activeEmployees}`;
    document.getElementById('overviewWorkingToday').textContent = activeEmployees || 0;
    document.getElementById('overviewAbsentToday').textContent = `Dam olishda: ${hrEmployees.length - activeEmployees}`;
    document.getElementById('overviewActiveTasks').textContent = hrTasks.filter(t => t.status !== 'completed').length || 0;
    document.getElementById('overviewCompletedTasks').textContent = `Bajarilgan: ${completedTasks}`;
    document.getElementById('overviewMonthSalary').textContent = formatCurrency(totalSalary);
    document.getElementById('overviewUnpaidSalary').textContent = `To'lanmagan: ${formatCurrency(unpaidSalary)}`;
}

// HR bo'limlarini ko'rsatish
function showHRSection(sectionType) {
    const overview = document.getElementById('hrOverview');
    const detailView = document.getElementById('hrDetailView');

    // Hide overview, show detail view
    overview.style.display = 'none';
    detailView.style.display = 'block';

    // Load section content
    loadHRSectionDetail(sectionType);
}

// Umumiy ko'rinishga qaytish
function showHROverview() {
    document.getElementById('hrOverview').style.display = 'block';
    document.getElementById('hrDetailView').style.display = 'none';
}

// Bo'lim tafsilotini yuklash
async function loadHRSectionDetail(sectionType) {
    const container = document.getElementById('hrDetailView');

    // Section titles
    const titles = {
        'employees': 'Xodimlar',
        'schedule': 'Ish jadvali',
        'vacation': 'Tatil jadvali',
        'tasks': 'Vazifalar',
        'salary': 'Maosh'
    };

    // Header with back button
    let html = `
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
            <button class="wallet-icon-btn" onclick="showHROverview()" style="flex-shrink: 0;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
            </button>
            <h3 style="margin: 0; font-size: 20px; color: var(--wallet-text-primary);">${titles[sectionType]}</h3>
        </div>
    `;

    // Add content based on section
    switch (sectionType) {
        case 'employees':
            html += getEmployeesDetailContent();
            break;
        case 'schedule':
            html += getScheduleDetailContent();
            break;
        case 'vacation':
            html += getVacationDetailContent();
            break;
        case 'tasks':
            html += getTasksDetailContent();
            break;
        case 'salary':
            html += getSalaryDetailContent();
            break;
    }

    container.innerHTML = html;

    // Render list
    if (sectionType === 'employees') renderEmployeesList();
    else if (sectionType === 'tasks') renderTasksList();
    else if (sectionType === 'vacation') renderVacationsList();
    else if (sectionType === 'salary') renderSalariesList();
}

// Xodimlar tafsiloti
function getEmployeesDetailContent() {
    return `
        <button class="wallet-btn-primary" onclick="showAddEmployeeModal()" style="margin-bottom: 16px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                <path d="M12 5v14M5 12h14"/>
            </svg>
            <span>Yangi xodim</span>
        </button>
        <div class="wallet-section">
            <div class="wallet-section-header">
                <h2 class="wallet-section-title">Xodimlar ro'yxati</h2>
            </div>
            <div id="hrEmployeesListContainer"></div>
        </div>
    `;
}

// Jadval tafsiloti
function getScheduleDetailContent() {
    return `
        <div class="wallet-card" style="margin-bottom: 16px;">
            <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--wallet-text-primary);">Ish jadvali</h4>
            <div style="display: flex; gap: 8px; margin-bottom: 16px;">
                <button class="wallet-btn-secondary" style="flex: 1;" onclick="loadScheduleView('daily')">Kunlik</button>
                <button class="wallet-btn-secondary" style="flex: 1;" onclick="loadScheduleView('weekly')">Haftalik</button>
                <button class="wallet-btn-secondary" style="flex: 1;" onclick="loadScheduleView('monthly')">Oylik</button>
            </div>
            <div id="scheduleViewContainer">
                <div style="text-align: center; padding: 40px 20px; color: var(--wallet-text-secondary);">
                    Jadval ma'lumotlari yuklanmoqda...
                </div>
            </div>
        </div>
    `;
}

// Tatil tafsiloti
function getVacationDetailContent() {
    return `
        <button class="wallet-btn-primary" onclick="showAddVacationModal()" style="margin-bottom: 16px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                <path d="M12 5v14M5 12h14"/>
            </svg>
            <span>Tatil so'rovi</span>
        </button>
        <div class="wallet-section">
            <div class="wallet-section-header">
                <h2 class="wallet-section-title">Tatil jadvali</h2>
            </div>
            <div id="hrVacationsListContainer"></div>
            </div>
    `;
}

// Vazifalar tafsiloti
function getTasksDetailContent() {
    return `
        <button class="wallet-btn-primary" onclick="showAddHRTaskModal()" style="margin-bottom: 16px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                <path d="M12 5v14M5 12h14"/>
            </svg>
            <span>Yangi vazifa</span>
        </button>
        <div class="wallet-section">
            <div class="wallet-section-header">
                <h2 class="wallet-section-title">Vazifalar ro'yxati</h2>
            </div>
            <div id="hrTasksListContainer"></div>
        </div>
    `;
}

// Maosh tafsiloti
function getSalaryDetailContent() {
    return `
        <div class="wallet-section">
            <div class="wallet-section-header">
                <h2 class="wallet-section-title">Maosh ro'yxati</h2>
                <button class="wallet-icon-btn" onclick="showPaySalariesModal()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 5v14M5 12h14"/>
                    </svg>
                </button>
            </div>
            <div id="hrSalariesListContainer"></div>
            </div>
    `;
}
// ==================== XODIMLAR CRUD ====================

// Xodimlarni render qilish
function renderEmployeesList() {
    const container = document.getElementById('hrEmployeesListContainer');

    if (hrEmployees.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--wallet-text-secondary);">
                Xodimlar mavjud emas. "Yangi xodim" tugmasini bosib qo'shing.
        </div>
    `;
        return;
    }

    const html = hrEmployees.map(emp => `
        <div class="wallet-card" style="margin-bottom: 12px; cursor: pointer;" onclick="showEmployeeDetails(${emp.id})">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--wallet-accent-blue); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 18px;">
                    ${emp.name.charAt(0).toUpperCase()}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: var(--wallet-text-primary); margin-bottom: 4px;">${emp.name}</div>
                    <div style="font-size: 13px; color: var(--wallet-text-secondary);">${emp.position} • ${emp.department}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 14px; font-weight: 600; color: var(--wallet-text-primary); margin-bottom: 4px;">${formatCurrency(emp.salary)}</div>
                    <div style="font-size: 11px; color: ${emp.status === 'active' ? '#10b981' : '#ef4444'};">${emp.status === 'active' ? 'Faol' : 'Passiv'}</div>
                </div>
            </div>
        </div>
    `).join('');

    container.innerHTML = html;
}

// Xodim qo'shish modali (QR kod orqali)
function showAddEmployeeModal() {
    // Generate unique QR code token
    const businessId = window.Telegram.WebApp.initDataUnsafe.user?.id || 'demo';
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const qrToken = `BALANSAI_EMP_${businessId}_${timestamp}_${randomStr}`;

    // Save QR code to backend
    const initData = getInitData();
    fetch('/api/qr/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': initData
        },
        body: JSON.stringify({ qr_token: qrToken })
    }).then(response => response.json())
      .then(data => {
          if (data.success) {
              console.log('QR kod saqlandi:', data);
          }
      }).catch(err => console.error('QR kod saqlashda xatolik:', err));

    const modal = createModal({
        title: 'Xodim qo\'shish',
        content: `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 10px;">
                <div style="text-align: center;">
                    <p style="color: var(--wallet-text-secondary); margin-bottom: 16px;">
                        Yangi xodimni qo'shish uchun bu QR kodni ko'rsating
                    </p>
            </div>

                <!-- QR Code Container -->
                <div id="qrCodeContainer" style="
                    background: white;
                    padding: 20px;
                    border-radius: 16px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                "></div>

                <!-- Instructions -->
                <div style="
                    background: var(--wallet-bg-secondary);
                    padding: 16px;
                    border-radius: 12px;
                    width: 100%;
                ">
                    <div style="display: flex; align-items: start; gap: 12px; margin-bottom: 12px;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--wallet-accent-blue)" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="16" x2="12" y2="12"/>
                            <line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>
                        <div>
                            <p style="font-weight: 600; color: var(--wallet-text-primary); margin-bottom: 8px;">
                                Qanday ishlaydi?
                            </p>
                            <ol style="color: var(--wallet-text-secondary); font-size: 14px; margin: 0; padding-left: 20px;">
                                <li style="margin-bottom: 6px;">Xodim Balans AI botini ochadi</li>
                                <li style="margin-bottom: 6px;">Sozlamalar → "Xodim sifatida qo'shilish" tugmasini bosadi</li>
                                <li style="margin-bottom: 6px;">Bu QR kodni scan qiladi</li>
                                <li>Avtomatik sizning biznesingizga qo'shiladi</li>
                            </ol>
                        </div>
                    </div>

                    <div style="
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 8px 12px;
                        background: rgba(255, 193, 7, 0.1);
                        border-radius: 8px;
                        margin-top: 12px;
                    ">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFC107" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <span style="font-size: 13px; color: var(--wallet-text-secondary);">
                            QR kod 24 soat davomida amal qiladi
                        </span>
                    </div>
                </div>
            </div>
        `,
        buttons: [
            {
                text: 'Yangi QR yaratish',
                style: 'secondary',
                onClick: () => {
                    modal.close();
                    setTimeout(() => showAddEmployeeModal(), 100);
                }
            },
            {
                text: 'Yopish',
                style: 'primary',
                onClick: () => modal.close()
            }
        ]
    });

    // Generate QR code after modal is shown
    setTimeout(() => {
        const qrContainer = document.getElementById('qrCodeContainer');
        if (qrContainer && typeof QRCode !== 'undefined') {
            qrContainer.innerHTML = ''; // Clear previous QR if any
            new QRCode(qrContainer, {
                text: qrToken,
                width: 200,
                height: 200,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        } else {
            qrContainer.innerHTML = '<p style="color: red;">QR kod yuklanmadi</p>';
        }
    }, 100);
}

// Xodim tafsilotlari
function showEmployeeDetails(empId) {
    const emp = hrEmployees.find(e => e.id === empId);
    if (!emp) return;

    const modal = createModal({
        title: emp.name,
        content: `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <div style="display: flex; justify-content: center; margin-bottom: 8px;">
                    <div style="width: 80px; height: 80px; border-radius: 50%; background: var(--wallet-accent-blue); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 32px;">
                        ${emp.name.charAt(0).toUpperCase()}
                    </div>
                </div>
                <div>
                    <div style="font-size: 13px; color: var(--wallet-text-secondary); margin-bottom: 4px;">Lavozim</div>
                    <div style="font-weight: 600; color: var(--wallet-text-primary);">${emp.position}</div>
                </div>
                <div>
                    <div style="font-size: 13px; color: var(--wallet-text-secondary); margin-bottom: 4px;">Bo'lim</div>
                    <div style="font-weight: 600; color: var(--wallet-text-primary);">${emp.department}</div>
                </div>
                <div>
                    <div style="font-size: 13px; color: var(--wallet-text-secondary); margin-bottom: 4px;">Maosh</div>
                    <div style="font-weight: 600; color: var(--wallet-text-primary);">${formatCurrency(emp.salary)}</div>
                </div>
                ${emp.phone ? `
                <div>
                    <div style="font-size: 13px; color: var(--wallet-text-secondary); margin-bottom: 4px;">Telefon</div>
                    <div style="font-weight: 600; color: var(--wallet-text-primary);">${emp.phone}</div>
                </div>
                ` : ''}
                <div>
                    <div style="font-size: 13px; color: var(--wallet-text-secondary); margin-bottom: 4px;">Ishga kirgan sana</div>
                    <div style="font-weight: 600; color: var(--wallet-text-primary);">${emp.hireDate}</div>
                </div>
                <div>
                    <div style="font-size: 13px; color: var(--wallet-text-secondary); margin-bottom: 4px;">Holat</div>
                    <div style="font-weight: 600; color: ${emp.status === 'active' ? '#10b981' : '#ef4444'};">${emp.status === 'active' ? 'Faol' : 'Passiv'}</div>
                </div>
            </div>
        `,
        buttons: [
            {
                text: 'O\'chirish',
                style: 'danger',
                onClick: () => {
                    if (confirm(`${emp.name} xodimni o'chirmoqchimisiz?`)) {
                        hrEmployees = hrEmployees.filter(e => e.id !== empId);
                        updateHRStickyStats();
                        updateHROverviewStats();
                        renderEmployeesList();
                        modal.close();
                        showToast('Xodim o\'chirildi', 'success');
                    }
                }
            },
            {
                text: 'Tahrirlash',
                style: 'primary',
                onClick: () => {
                    modal.close();
                    showEditEmployeeModal(empId);
                }
            }
        ]
    });
}

// Xodim tahrirlash
function showEditEmployeeModal(empId) {
    const emp = hrEmployees.find(e => e.id === empId);
    if (!emp) return;

    const modal = createModal({
        title: 'Xodimni tahrirlash',
        content: `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <div>
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--wallet-text-primary);">Ism familiya *</label>
                    <input type="text" id="empName" class="wallet-input" value="${emp.name}" />
                </div>
                <div>
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--wallet-text-primary);">Lavozim *</label>
                    <input type="text" id="empPosition" class="wallet-input" value="${emp.position}" />
                </div>
                <div>
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--wallet-text-primary);">Bo'lim *</label>
                    <input type="text" id="empDepartment" class="wallet-input" value="${emp.department}" />
                </div>
                <div>
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--wallet-text-primary);">Maosh *</label>
                    <input type="number" id="empSalary" class="wallet-input" value="${emp.salary}" />
                </div>
                <div>
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--wallet-text-primary);">Telefon</label>
                    <input type="tel" id="empPhone" class="wallet-input" value="${emp.phone || ''}" />
                </div>
                <div>
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--wallet-text-primary);">Holat</label>
                    <select id="empStatus" class="wallet-input">
                        <option value="active" ${emp.status === 'active' ? 'selected' : ''}>Faol</option>
                        <option value="inactive" ${emp.status === 'inactive' ? 'selected' : ''}>Passiv</option>
                    </select>
                </div>
            </div>
        `,
        buttons: [
            {
                text: 'Bekor qilish',
                style: 'secondary',
                onClick: () => modal.close()
            },
            {
                text: 'Saqlash',
                style: 'primary',
                onClick: () => {
                    emp.name = document.getElementById('empName').value.trim();
                    emp.position = document.getElementById('empPosition').value.trim();
                    emp.department = document.getElementById('empDepartment').value.trim();
                    emp.salary = parseFloat(document.getElementById('empSalary').value);
                    emp.phone = document.getElementById('empPhone').value.trim();
                    emp.status = document.getElementById('empStatus').value;

                    updateHRStickyStats();
                    updateHROverviewStats();
                    renderEmployeesList();
                    modal.close();
                    showToast('Xodim ma\'lumotlari yangilandi', 'success');
                }
            }
        ]
    });
}

// ==================== VAZIFALAR CRUD ====================

// Vazifalarni render qilish
function renderTasksList() {
    const container = document.getElementById('hrTasksListContainer');

    if (hrTasks.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--wallet-text-secondary);">
                Vazifalar mavjud emas. "Yangi vazifa" tugmasini bosib qo'shing.
        </div>
    `;
        return;
    }

    const html = hrTasks.map(task => {
        const statusColor = task.status === 'completed' ? '#10b981' : task.status === 'in-progress' ? '#f59e0b' : '#ef4444';
        const statusText = task.status === 'completed' ? 'Bajarilgan' : task.status === 'in-progress' ? 'Jarayonda' : 'Kechikkan';

        return `
            <div class="wallet-card" style="margin-bottom: 12px; cursor: pointer;" onclick="showTaskDetails(${task.id})">
                <div style="display: flex; align-items: start; gap: 12px;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: var(--wallet-text-primary); margin-bottom: 4px;">${task.title}</div>
                        <div style="font-size: 13px; color: var(--wallet-text-secondary); margin-bottom: 8px;">${task.assignedTo || 'Tayinlanmagan'}</div>
                        <div style="display: flex; gap: 8px;">
                            <span style="font-size: 11px; padding: 4px 8px; border-radius: 12px; background: ${statusColor}22; color: ${statusColor};">${statusText}</span>
                            <span style="font-size: 11px; padding: 4px 8px; border-radius: 12px; background: var(--wallet-bg-secondary); color: var(--wallet-text-secondary);">📅 ${task.deadline}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

// Vazifa qo'shish
function showAddHRTaskModal() {
    const modal = createModal({
        title: 'Yangi vazifa qo\'shish',
        content: `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <div>
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--wallet-text-primary);">Vazifa nomi *</label>
                    <input type="text" id="taskTitle" class="wallet-input" placeholder="Vazifa nomini kiriting" />
                </div>
                <div>
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--wallet-text-primary);">Tavsif</label>
                    <textarea id="taskDesc" class="wallet-input" placeholder="Qisqa tavsif" rows="3"></textarea>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--wallet-text-primary);">Tayinlangan xodim</label>
                    <select id="taskAssignee" class="wallet-input">
                        <option value="">Tanlang</option>
                        ${hrEmployees.map(emp => `<option value="${emp.name}">${emp.name}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--wallet-text-primary);">Muddat *</label>
                    <input type="date" id="taskDeadline" class="wallet-input" />
                </div>
            </div>
        `,
        buttons: [
            {
                text: 'Bekor qilish',
                style: 'secondary',
                onClick: () => modal.close()
            },
            {
                text: 'Saqlash',
                style: 'primary',
                onClick: () => {
                    const title = document.getElementById('taskTitle').value.trim();
                    const description = document.getElementById('taskDesc').value.trim();
                    const assignedTo = document.getElementById('taskAssignee').value;
                    const deadline = document.getElementById('taskDeadline').value;

                    if (!title || !deadline) {
                        showToast('Vazifa nomi va muddatni kiriting', 'error');
                        return;
                    }

                    const newTask = {
                        id: Date.now(),
                        title,
                        description,
                        assignedTo,
                        deadline,
                        status: 'in-progress',
                        createdAt: new Date().toISOString().split('T')[0]
                    };

                    hrTasks.push(newTask);
                    updateHRStickyStats();
                    updateHROverviewStats();
                    renderTasksList();
                    modal.close();
                    showToast('Vazifa qo\'shildi', 'success');
                }
            }
        ]
    });
}

// Vazifa tafsilotlari
function showTaskDetails(taskId) {
    const task = hrTasks.find(t => t.id === taskId);
    if (!task) return;

    const statusColor = task.status === 'completed' ? '#10b981' : task.status === 'in-progress' ? '#f59e0b' : '#ef4444';
    const statusText = task.status === 'completed' ? 'Bajarilgan' : task.status === 'in-progress' ? 'Jarayonda' : 'Kechikkan';

    const modal = createModal({
        title: task.title,
        content: `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                ${task.description ? `
                <div>
                    <div style="font-size: 13px; color: var(--wallet-text-secondary); margin-bottom: 4px;">Tavsif</div>
                    <div style="color: var(--wallet-text-primary);">${task.description}</div>
                </div>
                ` : ''}
                <div>
                    <div style="font-size: 13px; color: var(--wallet-text-secondary); margin-bottom: 4px;">Tayinlangan</div>
                    <div style="font-weight: 600; color: var(--wallet-text-primary);">${task.assignedTo || 'Tayinlanmagan'}</div>
                </div>
                <div>
                    <div style="font-size: 13px; color: var(--wallet-text-secondary); margin-bottom: 4px;">Muddat</div>
                    <div style="font-weight: 600; color: var(--wallet-text-primary);">${task.deadline}</div>
                </div>
                <div>
                    <div style="font-size: 13px; color: var(--wallet-text-secondary); margin-bottom: 4px;">Holat</div>
                    <span style="padding: 6px 12px; border-radius: 12px; background: ${statusColor}22; color: ${statusColor}; font-weight: 600;">${statusText}</span>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--wallet-text-primary);">Holatni o'zgartirish</label>
                    <select id="taskStatusUpdate" class="wallet-input">
                        <option value="in-progress" ${task.status === 'in-progress' ? 'selected' : ''}>Jarayonda</option>
                        <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Bajarilgan</option>
                        <option value="overdue" ${task.status === 'overdue' ? 'selected' : ''}>Kechikkan</option>
                    </select>
                </div>
            </div>
        `,
        buttons: [
            {
                text: 'O\'chirish',
                style: 'danger',
                onClick: () => {
                    if (confirm(`"${task.title}" vazifani o'chirmoqchimisiz?`)) {
                        hrTasks = hrTasks.filter(t => t.id !== taskId);
                        updateHRStickyStats();
                        updateHROverviewStats();
                        renderTasksList();
                        modal.close();
                        showToast('Vazifa o\'chirildi', 'success');
                    }
                }
            },
            {
                text: 'Saqlash',
                style: 'primary',
                onClick: () => {
                    task.status = document.getElementById('taskStatusUpdate').value;
                    updateHRStickyStats();
                    updateHROverviewStats();
                    renderTasksList();
                    modal.close();
                    showToast('Vazifa yangilandi', 'success');
                }
            }
        ]
    });
}

// ==================== TATILLAR CRUD ====================

// Tatillarni render qilish
function renderVacationsList() {
    const container = document.getElementById('hrVacationsListContainer');

    if (hrVacations.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--wallet-text-secondary);">
                Tatil so'rovlari mavjud emas.
            </div>
        `;
        return;
    }

    const html = hrVacations.map(vac => {
        const statusColor = vac.status === 'approved' ? '#10b981' : vac.status === 'pending' ? '#f59e0b' : '#ef4444';
        const statusText = vac.status === 'approved' ? 'Tasdiqlangan' : vac.status === 'pending' ? 'Kutilmoqda' : 'Rad etilgan';

        return `
            <div class="wallet-card" style="margin-bottom: 12px; cursor: pointer;" onclick="showVacationDetails(${vac.id})">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: var(--wallet-text-primary); margin-bottom: 4px;">${vac.employeeName}</div>
                        <div style="font-size: 13px; color: var(--wallet-text-secondary);">${vac.startDate} — ${vac.endDate}</div>
                    </div>
                    <span style="padding: 6px 12px; border-radius: 12px; background: ${statusColor}22; color: ${statusColor}; font-weight: 600; font-size: 12px;">${statusText}</span>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

// Tatil qo'shish
function showAddVacationModal() {
    const modal = createModal({
        title: 'Tatil so\'rovi',
        content: `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <div>
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--wallet-text-primary);">Xodim *</label>
                    <select id="vacEmployee" class="wallet-input">
                        <option value="">Tanlang</option>
                        ${hrEmployees.map(emp => `<option value="${emp.name}">${emp.name}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--wallet-text-primary);">Boshlanish sanasi *</label>
                    <input type="date" id="vacStartDate" class="wallet-input" />
                </div>
                <div>
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--wallet-text-primary);">Tugash sanasi *</label>
                    <input type="date" id="vacEndDate" class="wallet-input" />
                </div>
                <div>
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--wallet-text-primary);">Sabab</label>
                    <textarea id="vacReason" class="wallet-input" placeholder="Tatil sababi" rows="2"></textarea>
                </div>
            </div>
        `,
        buttons: [
            {
                text: 'Bekor qilish',
                style: 'secondary',
                onClick: () => modal.close()
            },
            {
                text: 'Yuborish',
                style: 'primary',
                onClick: () => {
                    const employeeName = document.getElementById('vacEmployee').value;
                    const startDate = document.getElementById('vacStartDate').value;
                    const endDate = document.getElementById('vacEndDate').value;
                    const reason = document.getElementById('vacReason').value.trim();

                    if (!employeeName || !startDate || !endDate) {
                        showToast('Barcha majburiy maydonlarni to\'ldiring', 'error');
                        return;
                    }

                    const newVacation = {
                        id: Date.now(),
                        employeeName,
                        startDate,
                        endDate,
                        reason,
                        status: 'pending',
                        createdAt: new Date().toISOString().split('T')[0]
                    };

                    hrVacations.push(newVacation);
                    updateHRStickyStats();
                    renderVacationsList();
                    modal.close();
                    showToast('Tatil so\'rovi yuborildi', 'success');
                }
            }
        ]
    });
}

// Tatil tafsilotlari
function showVacationDetails(vacId) {
    const vac = hrVacations.find(v => v.id === vacId);
    if (!vac) return;

    const statusColor = vac.status === 'approved' ? '#10b981' : vac.status === 'pending' ? '#f59e0b' : '#ef4444';
    const statusText = vac.status === 'approved' ? 'Tasdiqlangan' : vac.status === 'pending' ? 'Kutilmoqda' : 'Rad etilgan';

    const modal = createModal({
        title: 'Tatil tafsilotlari',
        content: `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <div>
                    <div style="font-size: 13px; color: var(--wallet-text-secondary); margin-bottom: 4px;">Xodim</div>
                    <div style="font-weight: 600; color: var(--wallet-text-primary);">${vac.employeeName}</div>
                </div>
                <div>
                    <div style="font-size: 13px; color: var(--wallet-text-secondary); margin-bottom: 4px;">Davomiyligi</div>
                    <div style="font-weight: 600; color: var(--wallet-text-primary);">${vac.startDate} — ${vac.endDate}</div>
                </div>
                ${vac.reason ? `
                <div>
                    <div style="font-size: 13px; color: var(--wallet-text-secondary); margin-bottom: 4px;">Sabab</div>
                    <div style="color: var(--wallet-text-primary);">${vac.reason}</div>
                </div>
                ` : ''}
                <div>
                    <div style="font-size: 13px; color: var(--wallet-text-secondary); margin-bottom: 4px;">Holat</div>
                    <span style="padding: 6px 12px; border-radius: 12px; background: ${statusColor}22; color: ${statusColor}; font-weight: 600;">${statusText}</span>
                </div>
                ${vac.status === 'pending' ? `
                <div>
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--wallet-text-primary);">Qaror qabul qilish</label>
                    <div style="display: flex; gap: 8px;">
                        <button class="wallet-btn-secondary" style="flex: 1;" onclick="updateVacationStatus(${vac.id}, 'rejected')">Rad etish</button>
                        <button class="wallet-btn-primary" style="flex: 1;" onclick="updateVacationStatus(${vac.id}, 'approved')">Tasdiqlash</button>
                    </div>
                </div>
                ` : ''}
            </div>
        `,
        buttons: [
            {
                text: 'O\'chirish',
                style: 'danger',
                onClick: () => {
                    if (confirm('Tatil so\'rovini o\'chirmoqchimisiz?')) {
                        hrVacations = hrVacations.filter(v => v.id !== vacId);
                        updateHRStickyStats();
                        renderVacationsList();
                        modal.close();
                        showToast('Tatil so\'rovi o\'chirildi', 'success');
                    }
                }
            },
            {
                text: 'Yopish',
                style: 'secondary',
                onClick: () => modal.close()
            }
        ]
    });
}

// Tatil holatini yangilash
function updateVacationStatus(vacId, status) {
    const vac = hrVacations.find(v => v.id === vacId);
    if (!vac) return;

    vac.status = status;
    updateHRStickyStats();
    renderVacationsList();

    // Close all modals
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());

    const statusText = status === 'approved' ? 'tasdiqlandi' : 'rad etildi';
    showToast(`Tatil so'rovi ${statusText}`, 'success');
}

// ==================== MAOSHLAR ====================

// Maoshlarni render qilish
function renderSalariesList() {
    const container = document.getElementById('hrSalariesListContainer');

    if (hrEmployees.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--wallet-text-secondary);">
                Xodimlar mavjud emas.
            </div>
        `;
        return;
    }

    const html = hrEmployees.map(emp => `
        <div class="wallet-card" style="margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: var(--wallet-text-primary); margin-bottom: 4px;">${emp.name}</div>
                    <div style="font-size: 13px; color: var(--wallet-text-secondary);">${emp.position}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 16px; font-weight: 600; color: var(--wallet-text-primary); margin-bottom: 4px;">${formatCurrency(emp.salary)}</div>
                    ${emp.unpaid ? `<div style="font-size: 12px; color: #ef4444;">To'lanmagan: ${formatCurrency(emp.unpaid)}</div>` : '<div style="font-size: 12px; color: #10b981;">To\'langan</div>'}
                </div>
                ${emp.unpaid ? `<button class="wallet-btn-secondary" style="padding: 8px 16px; font-size: 13px;" onclick="paySalary(${emp.id})">To'lash</button>` : ''}
            </div>
        </div>
    `).join('');

    container.innerHTML = html;
}

// Maosh to'lash
function paySalary(empId) {
    const emp = hrEmployees.find(e => e.id === empId);
    if (!emp) return;

    const modal = createModal({
        title: 'Maosh to\'lash',
        content: `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <div>
                    <div style="font-size: 13px; color: var(--wallet-text-secondary); margin-bottom: 4px;">Xodim</div>
                    <div style="font-weight: 600; color: var(--wallet-text-primary); font-size: 18px;">${emp.name}</div>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--wallet-text-primary);">To'lov summasi</label>
                    <input type="number" id="paymentAmount" class="wallet-input" value="${emp.unpaid || emp.salary}" />
                </div>
                <div>
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--wallet-text-primary);">To'lov sanasi</label>
                    <input type="date" id="paymentDate" class="wallet-input" value="${new Date().toISOString().split('T')[0]}" />
                </div>
            </div>
        `,
        buttons: [
            {
                text: 'Bekor qilish',
                style: 'secondary',
                onClick: () => modal.close()
            },
            {
                text: 'To\'lash',
                style: 'primary',
                onClick: () => {
                    const amount = parseFloat(document.getElementById('paymentAmount').value);

                    if (emp.unpaid) {
                        emp.unpaid = Math.max(0, emp.unpaid - amount);
                    }

                    updateHRStickyStats();
                    updateHROverviewStats();
                    renderSalariesList();
                    modal.close();
                    showToast(`${emp.name}ga ${formatCurrency(amount)} to'landi`, 'success');
                }
            }
        ]
    });
}

// Maosh to'lash modali (barcha xodimlar)
function showPaySalariesModal() {
    const modal = createModal({
        title: 'Maosh to\'lash',
        content: `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <div>
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--wallet-text-primary);">Xodimni tanlang</label>
                    <select id="payEmpSelect" class="wallet-input">
                        <option value="">Tanlang</option>
                        ${hrEmployees.map(emp => `<option value="${emp.id}">${emp.name} - ${formatCurrency(emp.salary)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--wallet-text-primary);">Summa</label>
                    <input type="number" id="payAmount" class="wallet-input" placeholder="Summa" />
                </div>
            </div>
        `,
        buttons: [
            {
                text: 'Bekor qilish',
                style: 'secondary',
                onClick: () => modal.close()
            },
            {
                text: 'To\'lash',
                style: 'primary',
                onClick: () => {
                    const empId = parseInt(document.getElementById('payEmpSelect').value);
                    const amount = parseFloat(document.getElementById('payAmount').value);

                    if (!empId || !amount) {
                        showToast('Xodim va summani tanlang', 'error');
                        return;
                    }

                    const emp = hrEmployees.find(e => e.id === empId);
                    if (emp) {
                        if (emp.unpaid) {
                            emp.unpaid = Math.max(0, emp.unpaid - amount);
                        }
                        updateHRStickyStats();
                        updateHROverviewStats();
                        renderSalariesList();
                        showToast(`${emp.name}ga maosh to'landi`, 'success');
                    }

                    modal.close();
                }
            }
        ]
    });
}

// Jadval ko'rinishi
function loadScheduleView(viewType) {
    const container = document.getElementById('scheduleViewContainer');
    container.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--wallet-text-secondary);">
            ${viewType.charAt(0).toUpperCase() + viewType.slice(1)} jadval ko'rinishi tez orada qo'shiladi.
        </div>
    `;
}

// Global scope'ga export
window.openHR = openHR;
window.showHRSection = showHRSection;
window.showHROverview = showHROverview;
window.showAddEmployeeModal = showAddEmployeeModal;
window.showEmployeeDetails = showEmployeeDetails;
window.showAddHRTaskModal = showAddHRTaskModal;
window.showTaskDetails = showTaskDetails;
window.showAddVacationModal = showAddVacationModal;
window.showVacationDetails = showVacationDetails;
window.updateVacationStatus = updateVacationStatus;
window.paySalary = paySalary;
window.showPaySalariesModal = showPaySalariesModal;
window.loadScheduleView = loadScheduleView;
