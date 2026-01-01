/**
 * Registration Page JavaScript
 */

const tg = window.Telegram?.WebApp || null;
let currentStep = 1;
const totalSteps = 7;
let formData = {
    name: '',
    source: '',
    account_type: '',
    tariff: '',
    cash_balance: 0,
    card_balance: 0,
    debts: []
};

// Telegram Web App initialization
if (tg) {
    tg.ready();
    
    // To'liq ekran qilish
    function ensureFullscreen() {
        if (!tg.isExpanded) {
            tg.expand();
        }
    }
    
    // Dastlabki fullscreen
    ensureFullscreen();
    
    // Viewport balandligini sozlash
    if (tg.viewportStableHeight !== undefined) {
        tg.viewportStableHeight = window.innerHeight;
    }
    
    // Pull-to-close'ni bloklash (scroll'ni bloklamasdan)
    if (tg.disableVerticalSwipes) {
        tg.disableVerticalSwipes();
    }
    
    // BackButton'ni yashirish
    if (tg.BackButton) {
        tg.BackButton.hide();
    }
    
    // Chiqishni tasdiqlash
    tg.enableClosingConfirmation();
    
    // Scroll'ni yoqish va pull-to-close'ni to'liq bloklash
    // CSS orqali overscroll-behavior: none qo'shilgan
    // JavaScript orqali ham qo'shimcha himoya
    document.body.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehaviorY = 'none';
    document.documentElement.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehaviorY = 'none';
    
    // Touch event'larni boshqarish (pull-to-close'ni oldini olish, lekin scroll'ni bloklamasdan)
    let touchStartY = 0;
    let touchStartTime = 0;
    let lastTouchY = 0;
    
    document.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
        lastTouchY = touchStartY;
        touchStartTime = Date.now();
    }, { passive: true });
    
    document.addEventListener('touchmove', (e) => {
        const touchY = e.touches[0].clientY;
        const deltaY = touchY - touchStartY;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight;
        const clientHeight = document.documentElement.clientHeight;
        const isAtTop = scrollTop <= 5; // Kichik margin
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5; // Kichik margin
        
        // Agar yuqoriga harakat qilmoqchi bo'lsa (pastga scroll) va sahifa tepada bo'lsa
        if (deltaY > 0 && isAtTop) {
            // Pull-to-close'ni bloklash
            e.preventDefault();
            return;
        }
        
        // Agar pastga harakat qilmoqchi bo'lsa (yuqoriga scroll) va sahifa pastda bo'lsa
        if (deltaY < 0 && isAtBottom) {
            // Pull-to-close'ni bloklash
            e.preventDefault();
            return;
        }
        
        lastTouchY = touchY;
    }, { passive: false });
    
    document.addEventListener('touchend', () => {
        // Touch tugaganda hech narsa qilmaymiz
    }, { passive: true });
    
    // Header va background ranglari
    tg.setHeaderColor('#000000');
    tg.setBackgroundColor('#000000');
    
    // Viewport o'zgarganda fullscreen'ni saqlash
    window.addEventListener('resize', () => {
        ensureFullscreen();
    });
    
    // Scroll event'ida ham tekshirish
    let scrollCheckTimeout;
    window.addEventListener('scroll', () => {
        clearTimeout(scrollCheckTimeout);
        scrollCheckTimeout = setTimeout(() => {
            ensureFullscreen();
        }, 100);
    });
    
    // Ilova ochilganda fullscreen'ni ta'minlash
    window.addEventListener('load', () => {
        setTimeout(() => {
            ensureFullscreen();
        }, 100);
    });
    
    // DOMContentLoaded'da ham tekshirish
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                ensureFullscreen();
            }, 50);
        });
    } else {
        setTimeout(() => {
            ensureFullscreen();
        }, 50);
    }
    
    // Periodic check
    setInterval(() => {
        ensureFullscreen();
    }, 500);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('Registration page loaded');
    
    // Check if user is already registered
    checkRegistrationStatus();
    
    // Setup form validation
    setupFormValidation();
    
    // Setup form submission
    document.getElementById('registrationForm').addEventListener('submit', handleSubmit);
    
    // Auto-focus on input
    const nameInput = document.getElementById('name');
    if (nameInput && !nameInput.value) {
        setTimeout(() => nameInput.focus(), 300);
    }
});

// Check if user is already registered
async function checkRegistrationStatus() {
    try {
        const userId = getUserId();
        console.log('[REGISTER] Checking registration status for user:', userId);
        
        if (!userId) {
            console.error('[REGISTER] User ID topilmadi');
            return;
        }
        
        const response = await fetch(`/api/user/${userId}`);
        console.log('[REGISTER] API response status:', response.status);
        
        if (response.ok) {
            const user = await response.json();
            console.log('[REGISTER] User data received:', user);
            
            // Check if user exists and registration is complete
            const isComplete = checkRegistrationComplete(user);
            console.log('[REGISTER] Registration complete:', isComplete);
            
            if (isComplete) {
                // User allaqachon ro'yxatdan o'tgan - asosiy sahifaga yuborish
                console.log('[REGISTER] User allaqachon ro\'yxatdan o\'tgan, asosiy sahifaga yuborilmoqda...');
                
                // Kichik kechikish (UI ko'rinishi uchun)
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // Asosiy sahifaga yuborish
                // Telegram Web App'da window.location ishlatish yaxshiroq
                const baseUrl = window.location.origin;
                console.log('[REGISTER] Redirecting to:', baseUrl + '/');
                
                // window.location.href ishlatish (Telegram Web App'da ishlaydi)
                window.location.href = baseUrl + '/';
                return;
            }
            
            // Fill form with existing data if partially filled
            console.log('[REGISTER] Registration not complete, filling form with existing data');
            if (user.name && user.name !== 'Xojayin') {
                document.getElementById('name').value = user.name;
                formData.name = user.name;
                // Skip to next step if name is filled
                if (user.source && user.account_type) {
                    currentStep = 4; // Skip to balance step
                    showStep(4);
                } else if (user.source) {
                    currentStep = 3; // Skip to account type step
                    showStep(3);
                } else {
                    currentStep = 2; // Skip to source step
                    showStep(2);
                }
            }
            
            if (user.source) {
                const sourceRadio = document.querySelector(`input[name="source"][value="${user.source}"]`);
                if (sourceRadio) {
                    sourceRadio.checked = true;
                }
                formData.source = user.source;
            }
            
            if (user.account_type) {
                const accountRadio = document.querySelector(`input[name="account_type"][value="${user.account_type}"]`);
                if (accountRadio) {
                    accountRadio.checked = true;
                }
                formData.account_type = user.account_type;
            }
            
            updateProgress();
        } else if (response.status === 404) {
            // User topilmadi - yangi user, registration davom etadi
            console.log('[REGISTER] Yangi user, registration davom etadi');
        } else {
            console.error('[REGISTER] API error:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('[REGISTER] Error checking registration status:', error);
    }
}

// Check if registration is complete
function checkRegistrationComplete(user) {
    console.log('Checking registration complete for user:', user);
    
    // Use backend's registration_complete flag if available
    if (user.registration_complete !== undefined) {
        console.log('Using backend registration_complete flag:', user.registration_complete);
        return user.registration_complete;
    }
    
    // Fallback: Check if all required fields are filled
    const hasName = user.name && user.name !== 'Xojayin' && user.name !== '';
    const hasSource = user.source && user.source !== '';
    const hasAccountType = user.account_type && user.account_type !== '';
    const hasPhone = user.phone && user.phone !== '';
    
    console.log('Registration check:', {
        hasName,
        hasSource,
        hasAccountType,
        hasPhone
    });
    
    // Agar phone bo'lsa va asosiy maydonlar to'liq bo'lsa, complete deb hisoblaymiz
    if (hasPhone && hasName && hasSource && hasAccountType) {
        console.log('Registration complete (phone + all fields)');
        return true;
    }
    
    return false;
}

// Close app
function closeApp() {
    if (tg && tg.close) {
        tg.close();
    } else {
        window.close();
    }
}

// Get user ID from Telegram Web App
function getUserId() {
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
        return tg.initDataUnsafe.user.id;
    }
    
    // Fallback: get from URL params
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('user_id');
    if (userId) return parseInt(userId);
    
    // DEBUG mode: try to parse from initData
    if (tg && tg.initData) {
        try {
            const initData = new URLSearchParams(tg.initData);
            const userStr = initData.get('user');
            if (userStr) {
                const user = JSON.parse(decodeURIComponent(userStr));
                return user.id;
            }
        } catch (e) {
            console.error('Error parsing initData:', e);
        }
    }
    
    return null;
}

// Get init data for API requests
function getInitData() {
    if (tg && tg.initData) return tg.initData;
    return '';
}

// Setup form validation
function setupFormValidation() {
    const nameInput = document.getElementById('name');
    const sourceRadios = document.querySelectorAll('input[name="source"]');
    const accountTypeRadios = document.querySelectorAll('input[name="account_type"]');
    
    nameInput.addEventListener('input', () => {
        const nameError = document.getElementById('nameError');
        if (nameInput.value.trim()) {
            nameError.textContent = '';
        }
    });
    
    nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            nextStep(2);
        }
    });
    
    sourceRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            const sourceError = document.getElementById('sourceError');
            if (radio.checked) {
                sourceError.textContent = '';
                // Auto proceed after selection
                setTimeout(() => nextStep(3), 300);
            }
        });
    });
    
    accountTypeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            const accountTypeError = document.getElementById('accountTypeError');
            if (radio.checked) {
                accountTypeError.textContent = '';
                // Auto proceed after selection
                setTimeout(() => nextStep(4), 300);
            }
        });
    });
    
    // Tariff radios
    const tariffRadios = document.querySelectorAll('input[name="tariff"]');
    tariffRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            const tariffError = document.getElementById('tariffError');
            if (radio.checked) {
                tariffError.textContent = '';
                // Auto proceed after selection
                setTimeout(() => nextStep(7), 300);
            }
        });
    });
}

// Validate field
function validateField(fieldName, value) {
    const errorElement = document.getElementById(`${fieldName}Error`);
    
    if (!value || (typeof value === 'string' && value.trim() === '')) {
        if (errorElement) {
            errorElement.textContent = 'Bu maydon majburiy';
        }
        return false;
    }
    
    if (fieldName === 'name' && value === 'Xojayin') {
        if (errorElement) {
            errorElement.textContent = 'Iltimos, to\'g\'ri ismingizni kiriting';
        }
        return false;
    }
    
    if (errorElement) {
        errorElement.textContent = '';
    }
    return true;
}

// Next step
function nextStep(step) {
    // Validate and save current step data
    if (currentStep === 1) {
        const name = document.getElementById('name').value.trim();
        if (!validateField('name', name)) {
            return;
        }
        formData.name = name;
    } else if (currentStep === 2) {
        const source = document.querySelector('input[name="source"]:checked')?.value;
        if (!validateField('source', source)) {
            return;
        }
        formData.source = source;
    } else if (currentStep === 3) {
        const accountType = document.querySelector('input[name="account_type"]:checked')?.value;
        if (!validateField('account_type', accountType)) {
            return;
        }
        formData.account_type = accountType;
    } else if (currentStep === 4) {
        formData.cash_balance = parseFloat(document.getElementById('cash_balance').value) || 0;
        formData.card_balance = parseFloat(document.getElementById('card_balance').value) || 0;
    } else if (currentStep === 5) {
        // Collect debts
        formData.debts = collectDebts();
    } else if (currentStep === 6) {
        const tariff = document.querySelector('input[name="tariff"]:checked')?.value;
        if (!validateField('tariff', tariff)) {
            return;
        }
        formData.tariff = tariff;
    }
    
    // Show next step
    showStep(step);
}

// Previous step
function prevStep(step) {
    showStep(step);
    // Auto-focus on input
    setTimeout(() => {
        const stepElement = document.getElementById(`step${step}`);
        const input = stepElement?.querySelector('input, select');
        if (input) input.focus();
    }, 300);
}

// Show step
function showStep(step) {
    // Hide all steps
    document.querySelectorAll('.form-step').forEach(stepEl => {
        stepEl.classList.remove('active');
    });
    
    // Show current step
    const stepElement = document.getElementById(`step${step}`);
    stepElement.classList.add('active');
    currentStep = step;
    
    // Update progress
    updateProgress();
    
    // Update review if step 4
    if (step === 4) {
        updateReview();
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Update progress bar
function updateProgress() {
    // Update dots
    document.querySelectorAll('.dot').forEach((dot, index) => {
        if (index + 1 <= currentStep) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
}

// Add debt field
function addDebtField() {
    const container = document.getElementById('debtsContainer');
    const debtId = Date.now();
    
    const debtHtml = `
        <div class="debt-item" data-debt-id="${debtId}">
            <div class="debt-item-header">
                <span class="debt-item-title">Qarz #${container.children.length + 1}</span>
                <button type="button" class="btn-remove-debt" onclick="removeDebt(${debtId})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            <div class="input-group">
                <label class="input-label">Kimga/Kimdan</label>
                <input type="text" class="input-field debt-person" placeholder="Ism" data-field="person_name">
            </div>
            <div class="input-group">
                <label class="input-label">Summa (so'm)</label>
                <input type="number" class="input-field debt-amount" placeholder="0" min="0" step="1000" data-field="amount">
            </div>
            <div class="input-group">
                <label class="input-label">Qarz turi</label>
                <div class="select-wrapper">
                    <select class="select-field debt-direction" data-field="direction">
                        <option value="lent">Qarz berdim</option>
                        <option value="borrowed">Qarz oldim</option>
                    </select>
                    <svg class="select-arrow" viewBox="0 0 24 24" fill="none">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </div>
            </div>
            <div class="input-group">
                <label class="input-label">Qaytarish sanasi (ixtiyoriy)</label>
                <input type="date" class="input-field debt-due-date" data-field="due_date">
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', debtHtml);
}

// Remove debt
function removeDebt(debtId) {
    const debtItem = document.querySelector(`[data-debt-id="${debtId}"]`);
    if (debtItem) {
        debtItem.remove();
        // Renumber debts
        const debts = document.querySelectorAll('.debt-item');
        debts.forEach((debt, index) => {
            debt.querySelector('.debt-item-title').textContent = `Qarz #${index + 1}`;
        });
    }
}

// Collect debts
function collectDebts() {
    const debts = [];
    const debtItems = document.querySelectorAll('.debt-item');
    
    debtItems.forEach(item => {
        const personName = item.querySelector('.debt-person')?.value.trim();
        const amount = parseFloat(item.querySelector('.debt-amount')?.value) || 0;
        const direction = item.querySelector('.debt-direction')?.value;
        const dueDate = item.querySelector('.debt-due-date')?.value;
        
        if (personName && amount > 0) {
            debts.push({
                person_name: personName,
                amount: amount,
                direction: direction || 'lent',
                due_date: dueDate || null
            });
        }
    });
    
    return debts;
}

// Update review
function updateReview() {
    document.getElementById('reviewName').textContent = formData.name || '-';
    
    const sourceMap = {
        'telegram': 'Telegram',
        'instagram': 'Instagram',
        'youtube': 'YouTube',
        'tanish': 'Tanish orqali',
        'boshqa': 'Boshqa'
    };
    document.getElementById('reviewSource').textContent = sourceMap[formData.source] || '-';
    
    const accountTypeMap = {
        'SHI': 'Shaxsiy',
        'BIZNES': 'Biznes'
    };
    document.getElementById('reviewAccountType').textContent = accountTypeMap[formData.account_type] || '-';
    
    const tariffMap = {
        'FREE': 'Bepul',
        'PRO': 'Pro',
        'BUSINESS': 'Biznes'
    };
    document.getElementById('reviewTariff').textContent = tariffMap[formData.tariff] || '-';
    
    document.getElementById('reviewCash').textContent = formatCurrency(formData.cash_balance);
    document.getElementById('reviewCard').textContent = formatCurrency(formData.card_balance);
    
    if (formData.debts && formData.debts.length > 0) {
        document.getElementById('reviewDebts').style.display = 'flex';
        document.getElementById('reviewDebtsValue').textContent = `${formData.debts.length} ta qarz`;
    } else {
        document.getElementById('reviewDebts').style.display = 'none';
    }
}

// Format currency
function formatCurrency(amount) {
    if (!amount || amount === 0) return '0 so\'m';
    return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
}

// Handle form submission
async function handleSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitText');
    const submitLoader = document.getElementById('submitLoader');
    
    // Disable button and show loader
    submitBtn.disabled = true;
    submitText.style.display = 'none';
    submitLoader.style.display = 'block';
    
    try {
        const userId = getUserId();
        if (!userId) {
            throw new Error('User ID topilmadi');
        }
        
        // Update user data
        await updateUserData(userId);
        
        // Save onboarding data
        await saveOnboardingData(userId);
        
        // Show success screen
        document.querySelector('.form-container').style.display = 'none';
        document.getElementById('successScreen').style.display = 'flex';
        
        // Haptic feedback
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('success');
        }
        
        // Send data to bot (if needed)
        if (tg && tg.sendData) {
            tg.sendData(JSON.stringify({ action: 'registration_complete' }));
        }
        
    } catch (error) {
        console.error('Error submitting form:', error);
        
        // Show error
        if (tg && tg.showAlert) {
            tg.showAlert('Xatolik yuz berdi: ' + error.message);
        } else {
            alert('Xatolik yuz berdi: ' + error.message);
        }
        
        // Re-enable button
        submitBtn.disabled = false;
        submitText.style.display = 'block';
        submitLoader.style.display = 'none';
    }
}

// Update user data
async function updateUserData(userId) {
    // Avval asosiy ma'lumotlarni yangilash
    const updateResponse = await fetch(`/api/user/${userId}/update`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': getInitData()
        },
        body: JSON.stringify({
            name: formData.name,
            source: formData.source,
            account_type: formData.account_type
        })
    });
    
    if (!updateResponse.ok) {
        const error = await updateResponse.json();
        throw new Error(error.error || 'Ma\'lumotlar saqlanmadi');
    }
    
    // Keyin tarifni tanlash
    if (formData.tariff) {
        const tariffResponse = await fetch(`/api/user/${userId}/tariff`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': getInitData()
            },
            body: JSON.stringify({
                tariff: formData.tariff
            })
        });
        
        if (!tariffResponse.ok) {
            const error = await tariffResponse.json();
            throw new Error(error.error || 'Tarif saqlanmadi');
        }
    }
    
    return await updateResponse.json();
}

// Save onboarding data
async function saveOnboardingData(userId) {
    const response = await fetch(`/api/user/${userId}/onboarding`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': getInitData()
        },
        body: JSON.stringify({
            cash_balance: formData.cash_balance,
            card_balance: formData.card_balance,
            debts: formData.debts
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Onboarding ma\'lumotlari saqlanmadi');
    }
    
    return await response.json();
}

