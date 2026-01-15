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
        // Tariff tekshiruvi
        const user = currentUser || await apiRequest('/api/user');
        if (!user || (user.tariff !== 'BUSINESS' && user.tariff !== 'BIZNES')) {
            showToast('Biznes tarifi kerak', 'error');
            navigateTo('home');
            return;
        }

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
        const [stats, items] = await Promise.all([
            apiRequest('/api/business/statistics/warehouse'),
            apiRequest('/api/business/warehouse?limit=100')
        ]);

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
                        const result = await apiRequest('/api/business/warehouse', {
                            method: 'POST',
                            body: JSON.stringify(data)
                        });

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
        const item = await apiRequest(`/api/business/warehouse/${itemId}`);

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
                                const result = await apiRequest(`/api/business/warehouse/${itemId}`, {
                                    method: 'DELETE'
                                });
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
                        const result = await apiRequest(`/api/business/warehouse/${item.id}`, {
                            method: 'PUT',
                            body: JSON.stringify(data)
                        });

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
        // Tariff tekshiruvi
        const user = currentUser || await apiRequest('/api/user');
        if (!user || (user.tariff !== 'BUSINESS' && user.tariff !== 'BIZNES')) {
            showToast('Biznes tarifi kerak', 'error');
            navigateTo('home');
            return;
        }

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
        const [stats, employees] = await Promise.all([
            apiRequest('/api/business/statistics/employees'),
            apiRequest('/api/business/employees?limit=100')
        ]);

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
                <label>Telegram User ID (optional)</label>
                <input type="number" id="employeeTelegramId" class="form-input" placeholder="Xodimning Telegram ID raqami">
                <small style="color: var(--wallet-text-secondary); font-size: 11px; display: block; margin-top: 4px;">
                    Agar xodim ilovadan foydalansa, uning Telegram ID raqamini kiriting
                </small>
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
                    const telegramIdValue = document.getElementById('employeeTelegramId').value;
                    const data = {
                        full_name: document.getElementById('employeeFullName').value,
                        position: document.getElementById('employeePosition').value,
                        phone: document.getElementById('employeePhone').value,
                        telegram_user_id: telegramIdValue ? parseInt(telegramIdValue) : null,
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
                        const result = await apiRequest('/api/business/employees', {
                            method: 'POST',
                            body: JSON.stringify(data)
                        });

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
        const employee = await apiRequest(`/api/business/employees/${employeeId}`);

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
                                const result = await apiRequest(`/api/business/employees/${employeeId}`, {
                                    method: 'DELETE'
                                });
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
                        const result = await apiRequest(`/api/business/employees/${employee.id}`, {
                            method: 'PUT',
                            body: JSON.stringify(data)
                        });

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
        // Tariff tekshiruvi
        const user = currentUser || await apiRequest('/api/user');
        if (!user || (user.tariff !== 'BUSINESS' && user.tariff !== 'BIZNES')) {
            showToast('Biznes tarifi kerak', 'error');
            navigateTo('home');
            return;
        }

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
        const [stats, tasks] = await Promise.all([
            apiRequest('/api/business/statistics/tasks'),
            apiRequest('/api/business/tasks?limit=100')
        ]);

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
        employees = await apiRequest('/api/business/employees?limit=100');
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
                        const result = await apiRequest('/api/business/tasks', {
                            method: 'POST',
                            body: JSON.stringify(data)
                        });

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
        const task = await apiRequest(`/api/business/tasks/${taskId}`);

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
                                const result = await apiRequest(`/api/business/tasks/${taskId}`, {
                                    method: 'DELETE'
                                });
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
        employees = await apiRequest('/api/business/employees?limit=100');
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
                        const result = await apiRequest(`/api/business/tasks/${task.id}`, {
                            method: 'PUT',
                            body: JSON.stringify(data)
                        });

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

// Current tab tracker
let currentSalesTab = 'overview';

// Sahifaga o'tish
function openSalesWarehouse() {
    window.navigateTo('salesWarehouse');
    loadSalesWarehouseData();
}

// Savdo & Ombor ma'lumotlarini yuklash
async function loadSalesWarehouseData() {
    try {
        // Sticky statistics yuklash
        const statsData = await apiRequest('/api/business/sales-warehouse/stats');

        updateStickyStats(statsData);
        
        // Hozirgi tab'ni yuklash
        loadSalesTabContent(currentSalesTab);
    } catch (error) {
        console.error('Savdo & Ombor ma\'lumotlarini yuklashda xato:', error);
        showToast('Ma\'lumotlarni yuklashda xatolik', 'error');
    }
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

// Tab o'zgartirish
function switchSalesTab(tabName, element) {
    // Remove active from all tabs
    document.querySelectorAll('.sales-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Add active to clicked tab
    element.classList.add('active');
    
    // Update current tab
    currentSalesTab = tabName;
    
    // Load tab content
    loadSalesTabContent(tabName);
}

// Tab tarkibini yuklash
async function loadSalesTabContent(tabName) {
    const container = document.getElementById('salesTabContent');
    
    switch (tabName) {
        case 'overview':
            container.innerHTML = await getOverviewTabContent();
            break;
        case 'sales':
            container.innerHTML = await getSalesTabContent();
            break;
        case 'warehouse':
            container.innerHTML = await getWarehouseTabContent();
            break;
        case 'clients':
            container.innerHTML = await getClientsTabContent();
            break;
        case 'invoices':
            container.innerHTML = await getInvoicesTabContent();
            break;
        case 'credit':
            container.innerHTML = await getCreditTabContent();
            break;
    }
}

// Umumiy tab tarkibi
async function getOverviewTabContent() {
    return `
        <div class="sales-overview-grid">
            <div class="sales-overview-card">
                <div class="sales-overview-card-title">Bugungi sotuvlar</div>
                <div class="sales-overview-card-value">0</div>
                <div class="sales-overview-card-change positive">↑ 12%</div>
            </div>
            <div class="sales-overview-card">
                <div class="sales-overview-card-title">Bugungi daromad</div>
                <div class="sales-overview-card-value">0 so'm</div>
                <div class="sales-overview-card-change positive">↑ 8%</div>
            </div>
            <div class="sales-overview-card">
                <div class="sales-overview-card-title">Kutilayotgan to'lovlar</div>
                <div class="sales-overview-card-value">0 so'm</div>
                <div class="sales-overview-card-change negative">↓ 3%</div>
            </div>
            <div class="sales-overview-card">
                <div class="sales-overview-card-title">Kam qolgan tovarlar</div>
                <div class="sales-overview-card-value">0</div>
                <div class="sales-overview-card-change">—</div>
            </div>
        </div>
        <div class="wallet-chart-card">
            <div class="wallet-chart-header">
                <span class="wallet-chart-title">Haftalik savdo trendi</span>
            </div>
            <canvas id="salesTrendChart" class="wallet-chart-canvas"></canvas>
        </div>
        <div class="wallet-section" style="margin-top: 20px;">
            <div class="wallet-section-header">
                <h2 class="wallet-section-title">Top mahsulotlar</h2>
            </div>
            <div id="topProductsList">
                <div style="text-align: center; padding: 20px; color: var(--wallet-text-secondary);">
                    Ma'lumot yuklanmoqda...
                </div>
            </div>
        </div>
    `;
}

// Sotuvlar tab tarkibi
async function getSalesTabContent() {
    return `
        <div class="wallet-stats-overview" style="margin-bottom: 20px;">
            <div class="wallet-stat-card">
                <div class="wallet-stat-value">0</div>
                <div class="wallet-stat-label">Jami sotuvlar</div>
            </div>
            <div class="wallet-stat-card">
                <div class="wallet-stat-value">0 so'm</div>
                <div class="wallet-stat-label">Jami summa</div>
            </div>
            <div class="wallet-stat-card">
                <div class="wallet-stat-value">0 so'm</div>
                <div class="wallet-stat-label">O'rtacha chek</div>
            </div>
        </div>
        <div class="wallet-section">
            <div class="wallet-section-header">
                <h2 class="wallet-section-title">So'nggi sotuvlar</h2>
            </div>
            <div id="recentSalesList">
                <div style="text-align: center; padding: 20px; color: var(--wallet-text-secondary);">
                    Sotuvlar mavjud emas
                </div>
            </div>
        </div>
    `;
}

// Ombor tab tarkibi
async function getWarehouseTabContent() {
    return `
        <div class="wallet-stats-overview" style="margin-bottom: 20px;">
            <div class="wallet-stat-card">
                <div class="wallet-stat-value">0</div>
                <div class="wallet-stat-label">Jami mahsulotlar</div>
            </div>
            <div class="wallet-stat-card">
                <div class="wallet-stat-value">0</div>
                <div class="wallet-stat-label">Kam qolgan</div>
            </div>
            <div class="wallet-stat-card">
                <div class="wallet-stat-value">0</div>
                <div class="wallet-stat-label">Kategoriyalar</div>
            </div>
        </div>
        <div class="wallet-section">
            <div class="wallet-section-header">
                <h2 class="wallet-section-title">Mahsulotlar ro'yxati</h2>
                <button class="wallet-icon-btn" onclick="navigateTo('warehouse')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 5v14M5 12h14"/>
                    </svg>
                </button>
            </div>
            <div style="text-align: center; padding: 20px; color: var(--wallet-text-secondary);">
                To'liq ma'lumot uchun "Ombor" sahifasiga o'ting
            </div>
        </div>
    `;
}

// Mijozlar tab tarkibi
async function getClientsTabContent() {
    return `
        <div class="wallet-stats-overview" style="margin-bottom: 20px;">
            <div class="wallet-stat-card">
                <div class="wallet-stat-value">0</div>
                <div class="wallet-stat-label">Jami mijozlar</div>
            </div>
            <div class="wallet-stat-card">
                <div class="wallet-stat-value">0</div>
                <div class="wallet-stat-label">Yetkazuvchilar</div>
            </div>
            <div class="wallet-stat-card">
                <div class="wallet-stat-value">0</div>
                <div class="wallet-stat-label">Aktiv</div>
            </div>
        </div>
        <div class="wallet-section">
            <div class="wallet-section-header">
                <h2 class="wallet-section-title">Mijozlar ro'yxati</h2>
            </div>
            <div style="text-align: center; padding: 20px; color: var(--wallet-text-secondary);">
                Mijozlar ma'lumotlari tez orada qo'shiladi
            </div>
        </div>
    `;
}

// Faktura tab tarkibi
async function getInvoicesTabContent() {
    return `
        <div class="wallet-stats-overview" style="margin-bottom: 20px;">
            <div class="wallet-stat-card">
                <div class="wallet-stat-value">0</div>
                <div class="wallet-stat-label">Jami fakturalar</div>
            </div>
            <div class="wallet-stat-card">
                <div class="wallet-stat-value">0</div>
                <div class="wallet-stat-label">Kutilmoqda</div>
            </div>
            <div class="wallet-stat-card">
                <div class="wallet-stat-value">0</div>
                <div class="wallet-stat-label">To'langan</div>
            </div>
        </div>
        <div class="wallet-section">
            <div class="wallet-section-header">
                <h2 class="wallet-section-title">Fakturalar ro'yxati</h2>
            </div>
            <div style="text-align: center; padding: 20px; color: var(--wallet-text-secondary);">
                Fakturalar ma'lumotlari tez orada qo'shiladi
            </div>
        </div>
    `;
}

// Nasiya tab tarkibi
async function getCreditTabContent() {
    return `
        <div class="wallet-stats-overview" style="margin-bottom: 20px;">
            <div class="wallet-stat-card">
                <div class="wallet-stat-value">0</div>
                <div class="wallet-stat-label">Jami nasiya</div>
            </div>
            <div class="wallet-stat-card">
                <div class="wallet-stat-value">0 so'm</div>
                <div class="wallet-stat-label">Qarz summasi</div>
            </div>
            <div class="wallet-stat-card">
                <div class="wallet-stat-value">0</div>
                <div class="wallet-stat-label">Muddati o'tgan</div>
            </div>
        </div>
        <div class="wallet-section">
            <div class="wallet-section-header">
                <h2 class="wallet-section-title">Nasiya ro'yxati</h2>
            </div>
            <div style="text-align: center; padding: 20px; color: var(--wallet-text-secondary);">
                Nasiya ma'lumotlari tez orada qo'shiladi
            </div>
        </div>
    `;
}

// Bottom Sheet - Statistika tafsilotlari
function showStatsBottomSheet(statType) {
    const bottomSheet = document.getElementById('statsBottomSheet');
    const title = document.getElementById('bottomSheetTitle');
    const content = document.getElementById('bottomSheetContent');
    
    // Set title based on stat type
    const titles = {
        'sales': 'Sotuvlar statistikasi',
        'products': 'Mahsulotlar statistikasi',
        'clients': 'Mijozlar statistikasi',
        'invoices': 'Fakturalar statistikasi',
        'credit': 'Nasiya statistikasi',
        'revenue': 'Daromad statistikasi'
    };
    
    title.textContent = titles[statType] || 'Statistika';
    
    // Set content based on stat type
    content.innerHTML = `
        <div style="text-align: center; padding: 40px 20px;">
            <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
            <h3 style="margin: 0 0 8px 0;">Batafsil statistika</h3>
            <p style="color: var(--wallet-text-secondary); margin: 0;">
                Kunlik, haftalik va oylik ma'lumotlar
            </p>
            <div style="margin-top: 24px; padding: 20px; background: var(--wallet-bg-secondary); border-radius: 12px;">
                <div style="font-size: 32px; font-weight: 700; margin-bottom: 4px;">0</div>
                <div style="font-size: 14px; color: var(--wallet-text-secondary);">Bu oy</div>
            </div>
        </div>
    `;
    
    bottomSheet.classList.add('active');
}

// Bottom Sheet yopish
function closeStatsBottomSheet() {
    document.getElementById('statsBottomSheet').classList.remove('active');
}

// Global scope'ga export
window.openSalesWarehouse = openSalesWarehouse;
window.switchSalesTab = switchSalesTab;
window.showStatsBottomSheet = showStatsBottomSheet;
window.closeStatsBottomSheet = closeStatsBottomSheet;
