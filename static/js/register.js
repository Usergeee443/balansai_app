/**
 * Registration Page JavaScript - Wallet Style v2.0
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
let trialConfig = {
    free: 0,
    plus: 7,
    biznes: 7
};
let debtCounter = 0;

// Step names for progress
const stepNames = {
    1: 'Ism',
    2: 'Manba',
    3: 'Hisob turi',
    4: 'Balans',
    5: 'Qarzlar',
    6: 'Tarif',
    7: 'Tasdiqlash'
};

// Telegram Web App initialization
if (tg) {
    tg.ready();
            tg.expand();
    
    // Disable vertical swipes (pull-to-close)
    if (tg.disableVerticalSwipes) {
        tg.disableVerticalSwipes();
    }
    
    // Hide back button
    if (tg.BackButton) {
        tg.BackButton.hide();
    }
    
    // Enable closing confirmation
    tg.enableClosingConfirmation();
    
    // Set colors
    tg.setHeaderColor('#000000');
    tg.setBackgroundColor('#000000');
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[REGISTER] Page loaded');
    
    // Load trial config
    await loadTrialConfig();
    
    // Check registration status
    await checkRegistrationStatus();
    
    // Setup input listeners
    setupInputListeners();
    
    // Hide loading
    hideLoading();
});

// Load trial configuration
async function loadTrialConfig() {
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            const config = await response.json();
            trialConfig = config.trial_days || { free: 0, plus: 7, biznes: 7 };
            updateTrialUI();
        }
    } catch (error) {
        console.error('[REGISTER] Error loading trial config:', error);
    }
}

// Update trial days in UI
function updateTrialUI() {
    const plusTrialText = document.getElementById('plusTrialText');
    const plusBtn = document.getElementById('plusBtn');
    const businessTrialText = document.getElementById('businessTrialText');
    const businessBtn = document.getElementById('businessBtn');
    
    if (trialConfig.plus > 0) {
        if (plusTrialText) plusTrialText.textContent = `${trialConfig.plus} kunlik bepul sinov`;
        if (plusBtn) plusBtn.textContent = `${trialConfig.plus} kun sinash`;
    } else {
        if (plusTrialText) plusTrialText.textContent = 'Premium imkoniyatlar';
        if (plusBtn) plusBtn.textContent = 'Sotib olish';
    }
    
    if (trialConfig.biznes > 0) {
        if (businessTrialText) businessTrialText.textContent = `${trialConfig.biznes} kunlik bepul sinov`;
        if (businessBtn) businessBtn.textContent = `${trialConfig.biznes} kun sinash`;
    } else {
        if (businessTrialText) businessTrialText.textContent = 'Professional imkoniyatlar';
        if (businessBtn) businessBtn.textContent = 'Sotib olish';
    }
}

// Check registration status
async function checkRegistrationStatus() {
    try {
        const userId = getUserId();
        console.log('[REGISTER] Checking status for user:', userId);

        if (!userId) {
            console.log('[REGISTER] No user ID found');
            return;
        }

        const response = await fetch(`/api/user/${userId}`);

        if (response.ok) {
            const user = await response.json();
            console.log('[REGISTER] User data:', user);
            
            // Check if registration is complete
            if (isRegistrationComplete(user)) {
                console.log('[REGISTER] User already registered, redirecting...');
                showAlreadyRegistered();
                setTimeout(() => {
                    window.location.href = '/';
                }, 1500);
                return;
            }

            // Pre-fill form with existing data
            prefillForm(user);
        }
    } catch (error) {
        console.error('[REGISTER] Error checking status:', error);
    }
}

// Check if registration is complete
function isRegistrationComplete(user) {
    if (user.registration_complete !== undefined) {
        return user.registration_complete;
    }
    
    const hasName = user.name && user.name !== 'Xojayin' && user.name !== '';
    const hasSource = user.source && user.source !== '';
    const hasAccountType = user.account_type && user.account_type !== '';
    const hasPhone = user.phone && user.phone !== '';
    
    return hasPhone && hasName && hasSource && hasAccountType;
}

// Pre-fill form with existing data
function prefillForm(user) {
    if (user.name && user.name !== 'Xojayin') {
        document.getElementById('inputName').value = user.name;
        formData.name = user.name;
    }
    
    if (user.source) {
        formData.source = user.source;
        const sourceCard = document.querySelector(`#sourceOptions .option-card[data-value="${user.source}"]`);
        if (sourceCard) sourceCard.classList.add('selected');
    }
    
    if (user.account_type) {
        formData.account_type = user.account_type;
        const accountCard = document.querySelector(`#accountTypeOptions .option-card[data-value="${user.account_type}"]`);
        if (accountCard) accountCard.classList.add('selected');
    }
}

// Setup input listeners
function setupInputListeners() {
    const nameInput = document.getElementById('inputName');
    
    nameInput.addEventListener('input', () => {
        const error = document.getElementById('nameError');
        if (nameInput.value.trim()) {
            error.classList.remove('show');
            nameInput.classList.remove('error');
        }
    });
    
    nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            nextStep();
        }
    });
}

// Get user ID
function getUserId() {
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
        return tg.initDataUnsafe.user.id;
    }
    
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('user_id');
    if (userId) return parseInt(userId);
    
    if (tg && tg.initData) {
        try {
            const initData = new URLSearchParams(tg.initData);
            const userStr = initData.get('user');
            if (userStr) {
                const user = JSON.parse(decodeURIComponent(userStr));
                return user.id;
            }
        } catch (e) {
            console.error('[REGISTER] Error parsing initData:', e);
        }
    }
    
    return null;
}

// Get init data
function getInitData() {
    if (tg && tg.initData) return tg.initData;
    return '';
}

// Show/Hide loading
function showLoading() {
    document.getElementById('loadingScreen').classList.remove('hide');
}

function hideLoading() {
    document.getElementById('loadingScreen').classList.add('hide');
}

// Show already registered
function showAlreadyRegistered() {
    document.getElementById('alreadyRegistered').classList.add('show');
}

// Show success
function showSuccess() {
    document.getElementById('successScreen').classList.add('show');
}

// Haptic feedback
function haptic(type = 'light') {
    if (tg && tg.HapticFeedback) {
        if (type === 'success') {
            tg.HapticFeedback.notificationOccurred('success');
        } else if (type === 'error') {
            tg.HapticFeedback.notificationOccurred('error');
        } else {
            tg.HapticFeedback.impactOccurred(type);
        }
    }
}

// Select option (source, account_type)
function selectOption(field, value, element) {
    haptic('light');
    
    // Remove selected from siblings
    const parent = element.parentElement;
    parent.querySelectorAll('.option-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Add selected to clicked
    element.classList.add('selected');
    
    // Save value
    formData[field] = value;
    
    // Auto-advance after short delay
    setTimeout(() => {
        nextStep();
    }, 300);
}

// Select tariff
function selectTariff(tariff) {
    haptic('light');
    formData.tariff = tariff;
    nextStep();
}

// Add debt
function addDebt() {
    haptic('light');
    debtCounter++;
    
    const debtsList = document.getElementById('debtsList');
    const debtHtml = `
        <div class="debt-item" data-debt-id="${debtCounter}">
            <div class="debt-item-header">
                <span class="debt-item-title">Qarz #${debtCounter}</span>
                <button type="button" class="debt-remove-btn" onclick="removeDebt(${debtCounter})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="debt-inputs">
                <input type="text" class="debt-input debt-person" placeholder="Kimga/Kimdan" data-field="person_name">
                <input type="number" class="debt-input debt-amount" placeholder="Summa (so'm)" min="0" step="1000" data-field="amount">
                <select class="debt-select debt-direction" data-field="direction">
                    <option value="lent">Qarz berdim (menga qaytarishadi)</option>
                    <option value="borrowed">Qarz oldim (men qaytaraman)</option>
                    </select>
                <input type="date" class="debt-input debt-due-date" data-field="due_date" placeholder="Qaytarish sanasi">
            </div>
        </div>
    `;
    
    debtsList.insertAdjacentHTML('beforeend', debtHtml);
}

// Remove debt
function removeDebt(id) {
    haptic('light');
    const debtItem = document.querySelector(`.debt-item[data-debt-id="${id}"]`);
    if (debtItem) {
        debtItem.remove();
        renumberDebts();
    }
}

        // Renumber debts
function renumberDebts() {
        const debts = document.querySelectorAll('.debt-item');
        debts.forEach((debt, index) => {
            debt.querySelector('.debt-item-title').textContent = `Qarz #${index + 1}`;
        });
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

// Validate current step
function validateStep() {
    if (currentStep === 1) {
        const name = document.getElementById('inputName').value.trim();
        if (!name || name === 'Xojayin') {
            document.getElementById('nameError').classList.add('show');
            document.getElementById('inputName').classList.add('error');
            haptic('error');
            return false;
        }
        formData.name = name;
    } else if (currentStep === 2) {
        if (!formData.source) {
            haptic('error');
            return false;
        }
    } else if (currentStep === 3) {
        if (!formData.account_type) {
            haptic('error');
            return false;
        }
    } else if (currentStep === 4) {
        formData.cash_balance = parseFloat(document.getElementById('inputCash').value) || 0;
        formData.card_balance = parseFloat(document.getElementById('inputCard').value) || 0;
    } else if (currentStep === 5) {
        formData.debts = collectDebts();
    } else if (currentStep === 6) {
        if (!formData.tariff) {
            haptic('error');
            return false;
        }
    }
    
    return true;
}

// Next step
function nextStep() {
    if (!validateStep()) return;
    
    haptic('light');
    
    if (currentStep === 7) {
        // Submit form
        submitForm();
        return;
    }
    
    // Hide current step
    document.getElementById(`step${currentStep}`).classList.remove('active');
    
    // Show next step
    currentStep++;
    document.getElementById(`step${currentStep}`).classList.add('active');
    
    // Update progress
    updateProgress();
    
    // Update review if on step 7
    if (currentStep === 7) {
        updateReview();
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Previous step
function prevStep() {
    if (currentStep <= 1) return;
    
    haptic('light');
    
    // Hide current step
    document.getElementById(`step${currentStep}`).classList.remove('active');
    
    // Show previous step
    currentStep--;
    document.getElementById(`step${currentStep}`).classList.add('active');
    
    // Update progress
    updateProgress();
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Update progress
function updateProgress() {
    const progress = (currentStep / totalSteps) * 100;
    document.getElementById('progressFill').style.width = `${progress}%`;
    document.getElementById('stepText').textContent = `${currentStep} / ${totalSteps}`;
    document.getElementById('stepName').textContent = stepNames[currentStep];
    
    // Update buttons
    const backBtn = document.getElementById('backBtn');
    const nextBtn = document.getElementById('nextBtn');
    const nextBtnText = document.getElementById('nextBtnText');
    const nextBtnIcon = document.getElementById('nextBtnIcon');
    
    // Show/hide back button
    backBtn.style.display = currentStep > 1 ? 'flex' : 'none';
    
    // Update next button text
    if (currentStep === 6) {
        // Tariff step - hide next button (tariff cards have their own buttons)
        nextBtn.style.display = 'none';
    } else if (currentStep === 7) {
        nextBtn.style.display = 'flex';
        nextBtnText.textContent = 'Saqlash';
        nextBtnIcon.style.display = 'none';
    } else {
        nextBtn.style.display = 'flex';
        nextBtnText.textContent = 'Davom etish';
        nextBtnIcon.style.display = 'block';
    }
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
        'PLUS': 'Plus',
        'PRO': 'Plus',
        'BUSINESS': 'Biznes',
        'BIZNES': 'Biznes'
    };
    document.getElementById('reviewTariff').textContent = tariffMap[formData.tariff] || '-';
    
    document.getElementById('reviewCash').textContent = formatCurrency(formData.cash_balance);
    document.getElementById('reviewCard').textContent = formatCurrency(formData.card_balance);
    
    if (formData.debts && formData.debts.length > 0) {
        document.getElementById('reviewDebtsRow').style.display = 'flex';
        document.getElementById('reviewDebts').textContent = `${formData.debts.length} ta`;
    } else {
        document.getElementById('reviewDebtsRow').style.display = 'none';
    }
}

// Format currency
function formatCurrency(amount) {
    if (!amount || amount === 0) return '0 so\'m';
    return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
}

// Submit form
async function submitForm() {
    const nextBtn = document.getElementById('nextBtn');
    const nextBtnText = document.getElementById('nextBtnText');
    const nextBtnLoader = document.getElementById('nextBtnLoader');
    
    // Disable button and show loader
    nextBtn.disabled = true;
    nextBtnText.style.display = 'none';
    nextBtnLoader.style.display = 'block';
    
    try {
        const userId = getUserId();
        if (!userId) {
            throw new Error('User ID topilmadi');
        }
        
        // Update user data
        await updateUserData(userId);
        
        // Save onboarding data
        await saveOnboardingData(userId);

        // Check if need to redirect to payment
        if ((formData.tariff === 'PLUS' || formData.tariff === 'PRO') && trialConfig.plus === 0) {
                window.location.href = 'https://balansai.onrender.com/payment-plus';
                return;
            }
        
        if ((formData.tariff === 'BUSINESS' || formData.tariff === 'BIZNES') && trialConfig.biznes === 0) {
                window.location.href = 'https://balansai.onrender.com/payment-biznes';
                return;
        }
        
        // Show success
        haptic('success');
        showSuccess();
        
        // Send data to bot
        if (tg && tg.sendData) {
            tg.sendData(JSON.stringify({ action: 'registration_complete' }));
        }

        // Redirect after delay
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
        
    } catch (error) {
        console.error('[REGISTER] Submit error:', error);
        haptic('error');
        
        if (tg && tg.showAlert) {
            tg.showAlert('Xatolik: ' + error.message);
        } else {
            alert('Xatolik: ' + error.message);
        }
        
        // Re-enable button
        nextBtn.disabled = false;
        nextBtnText.style.display = 'block';
        nextBtnLoader.style.display = 'none';
    }
}

// Update user data
async function updateUserData(userId) {
    const response = await fetch(`/api/user/${userId}/update`, {
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
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ma\'lumotlar saqlanmadi');
    }
    
    // Set tariff
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
    
    return await response.json();
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

// Make functions global
window.selectOption = selectOption;
window.selectTariff = selectTariff;
window.addDebt = addDebt;
window.removeDebt = removeDebt;
window.nextStep = nextStep;
window.prevStep = prevStep;
