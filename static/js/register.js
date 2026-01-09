/**
 * Registration Page JavaScript - Modern Wallet Style
 */

const tg = window.Telegram?.WebApp || null;
let currentStep = 1;
const totalSteps = 6; // Changed from 7 to 6 (removed account_type step)
let formData = {
    first_name: '', // Changed from 'name' to 'first_name'
    source: '',
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
    document.body.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehaviorY = 'none';
    document.documentElement.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehaviorY = 'none';

    // Touch event'larni boshqarish
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
        const isAtTop = scrollTop <= 5;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5;

        if (deltaY > 0 && isAtTop) {
            e.preventDefault();
            return;
        }

        if (deltaY < 0 && isAtBottom) {
            e.preventDefault();
            return;
        }

        lastTouchY = touchY;
    }, { passive: false });

    document.addEventListener('touchend', () => {}, { passive: true });

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

// Show loading screen
function showLoading() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.classList.remove('hide');
        loadingScreen.style.display = 'flex';
    }
}

// Hide loading screen
function hideLoading() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.classList.add('hide');
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 300);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('Registration page loaded');

    // Show loading screen
    showLoading();

    // Update total steps display
    document.getElementById('totalStepsNum').textContent = totalSteps;

    // Load trial configuration
    loadTrialConfig();

    // Check if user is already registered
    checkRegistrationStatus();

    // Setup form validation
    setupFormValidation();

    // Setup form submission
    document.getElementById('registrationForm').addEventListener('submit', handleSubmit);

    // Auto-focus on input
    const firstNameInput = document.getElementById('first_name');
    if (firstNameInput && !firstNameInput.value) {
        setTimeout(() => firstNameInput.focus(), 300);
    }
});

// Load trial configuration from API
async function loadTrialConfig() {
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            const config = await response.json();
            trialConfig = config.trial_days || { free: 0, plus: 7, biznes: 7 };
            updateTrialDaysUI();
        }
    } catch (error) {
        console.error('Error loading trial config:', error);
    }
}

// Update trial days in UI
function updateTrialDaysUI() {
    const plusTrialDaysElements = document.querySelectorAll('#plusTrialDays, #plusTrialDaysBtn');
    plusTrialDaysElements.forEach(el => {
        el.textContent = trialConfig.plus;
    });

    const businessTrialDaysElements = document.querySelectorAll('#businessTrialDays, #businessTrialDaysBtn');
    businessTrialDaysElements.forEach(el => {
        el.textContent = trialConfig.biznes;
    });

    if (trialConfig.plus === 0) {
        document.getElementById('plusBtnText').textContent = 'Sotib olish';
    }
    if (trialConfig.biznes === 0) {
        document.getElementById('businessBtnText').textContent = 'Sotib olish';
    }
}

// Select tariff
function selectTariff(tariff) {
    formData.tariff = tariff;

    // Trigger haptic feedback
    if (tg && tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('medium');
    }

    // Move to review step (step 6)
    nextStep(6);
}

// Check if user is already registered
async function checkRegistrationStatus() {
    try {
        const userId = getUserId();
        console.log('[REGISTER] Checking registration status for user:', userId);

        if (!userId) {
            console.error('[REGISTER] User ID topilmadi');
            hideLoading();
            return;
        }

        const response = await fetch(`/api/user/${userId}`);
        console.log('[REGISTER] API response status:', response.status);

        if (response.ok) {
            const user = await response.json();
            console.log('[REGISTER] User data received:', user);

            const isComplete = checkRegistrationComplete(user);
            console.log('[REGISTER] Registration complete:', isComplete);

            if (isComplete) {
                console.log('[REGISTER] User allaqachon ro\'yxatdan o\'tgan, asosiy sahifaga yuborilmoqda...');
                await new Promise(resolve => setTimeout(resolve, 300));
                const baseUrl = window.location.origin;
                console.log('[REGISTER] Redirecting to:', baseUrl + '/');
                window.location.href = baseUrl + '/';
                return;
            }

            hideLoading();

            // Fill form with existing data if partially filled
            console.log('[REGISTER] Registration not complete, filling form with existing data');
            if (user.first_name) {
                document.getElementById('first_name').value = user.first_name;
                formData.first_name = user.first_name;
                if (user.source) {
                    currentStep = 3;
                    showStep(3);
                } else {
                    currentStep = 2;
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

            updateProgress();
        } else if (response.status === 404) {
            console.log('[REGISTER] Yangi user, registration davom etadi');
            hideLoading();
        } else {
            console.error('[REGISTER] API error:', response.status, response.statusText);
            hideLoading();
        }
    } catch (error) {
        console.error('[REGISTER] Error checking registration status:', error);
        hideLoading();
    }
}

// Check if registration is complete
function checkRegistrationComplete(user) {
    console.log('Checking registration complete for user:', user);

    if (user.registration_complete !== undefined) {
        console.log('Using backend registration_complete flag:', user.registration_complete);
        return user.registration_complete;
    }

    const hasFirstName = user.first_name && user.first_name !== '';
    const hasSource = user.source && user.source !== '';
    const hasPhone = user.phone && user.phone !== '';

    console.log('Registration check:', {
        hasFirstName,
        hasSource,
        hasPhone
    });

    if (hasPhone && hasFirstName && hasSource) {
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
    const firstNameInput = document.getElementById('first_name');
    const sourceRadios = document.querySelectorAll('input[name="source"]');

    firstNameInput.addEventListener('input', () => {
        const firstNameError = document.getElementById('firstNameError');
        if (firstNameInput.value.trim()) {
            firstNameError.textContent = '';
        }
    });

    firstNameInput.addEventListener('keypress', (e) => {
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
                // Trigger haptic feedback
                if (tg && tg.HapticFeedback) {
                    tg.HapticFeedback.selectionChanged();
                }
                // Auto proceed after selection
                setTimeout(() => nextStep(3), 300);
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

    if (errorElement) {
        errorElement.textContent = '';
    }
    return true;
}

// Next step
function nextStep(step) {
    // Validate and save current step data
    if (currentStep === 1) {
        const firstName = document.getElementById('first_name').value.trim();
        if (!validateField('firstName', firstName)) {
            return;
        }
        formData.first_name = firstName;
    } else if (currentStep === 2) {
        const source = document.querySelector('input[name="source"]:checked')?.value;
        if (!validateField('source', source)) {
            return;
        }
        formData.source = source;
    } else if (currentStep === 3) {
        formData.cash_balance = parseFloat(document.getElementById('cash_balance').value) || 0;
        formData.card_balance = parseFloat(document.getElementById('card_balance').value) || 0;
    } else if (currentStep === 4) {
        // Collect debts
        formData.debts = collectDebts();
    } else if (currentStep === 5) {
        // Tariff validation
        if (!formData.tariff) {
            const tariffError = document.getElementById('tariffError');
            if (tariffError) {
                tariffError.textContent = 'Iltimos, tarifni tanlang';
            }
            return;
        }
    }

    // Trigger haptic feedback
    if (tg && tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }

    // Show next step
    showStep(step);
}

// Previous step
function prevStep(step) {
    // Trigger haptic feedback
    if (tg && tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }

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

    // Update review if step 6
    if (step === 6) {
        updateReview();
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Update progress bar
function updateProgress() {
    // Update progress fill
    const progressFill = document.getElementById('progressFill');
    const progressPercent = (currentStep / totalSteps) * 100;
    if (progressFill) {
        progressFill.style.width = `${progressPercent}%`;
    }

    // Update step number
    const currentStepNum = document.getElementById('currentStepNum');
    if (currentStepNum) {
        currentStepNum.textContent = currentStep;
    }
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

    // Trigger haptic feedback
    if (tg && tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('medium');
    }
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

    // Trigger haptic feedback
    if (tg && tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
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
    document.getElementById('reviewName').textContent = formData.first_name || '-';

    const sourceMap = {
        'telegram': 'Telegram',
        'instagram': 'Instagram',
        'youtube': 'YouTube',
        'tanish': 'Tanish orqali',
        'boshqa': 'Boshqa'
    };
    document.getElementById('reviewSource').textContent = sourceMap[formData.source] || '-';

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

        // Check if need to redirect to payment
        if (formData.tariff === 'PLUS' || formData.tariff === 'PRO') {
            if (trialConfig.plus === 0) {
                window.location.href = 'https://balansai.onrender.com/payment-plus';
                return;
            }
        } else if (formData.tariff === 'BUSINESS' || formData.tariff === 'BIZNES') {
            if (trialConfig.biznes === 0) {
                window.location.href = 'https://balansai.onrender.com/payment-biznes';
                return;
            }
        }

        // Show success screen
        showSuccessScreen();

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

// Show success screen with confetti
function showSuccessScreen() {
    // Hide form container
    document.querySelector('.form-container').style.display = 'none';

    // Show success screen
    const successScreen = document.getElementById('successScreen');
    successScreen.style.display = 'flex';

    // Trigger haptic feedback
    if (tg && tg.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
    }

    // Create confetti
    createConfetti();

    // Play success sound (if possible in Telegram WebApp)
    playSuccessSound();

    // Send data to bot
    if (tg && tg.sendData) {
        tg.sendData(JSON.stringify({ action: 'registration_complete' }));
    }

    // Redirect to home after 3 seconds
    setTimeout(() => {
        window.location.href = '/';
    }, 3000);
}

// Create confetti animation
function createConfetti() {
    const confettiContainer = document.getElementById('confettiContainer');
    const colors = ['#667eea', '#764ba2', '#f093fb', '#34d399', '#fbbf24', '#ef4444'];
    const confettiCount = 50;

    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.style.position = 'absolute';
        confetti.style.width = '10px';
        confetti.style.height = '10px';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.top = -20 + 'px';
        confetti.style.opacity = Math.random();
        confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
        confetti.style.animation = `confettiFall ${2 + Math.random() * 3}s linear ${Math.random() * 2}s`;

        confettiContainer.appendChild(confetti);
    }

    // Add confetti CSS animation
    if (!document.getElementById('confettiStyles')) {
        const style = document.createElement('style');
        style.id = 'confettiStyles';
        style.textContent = `
            @keyframes confettiFall {
                0% {
                    transform: translateY(0) rotate(0deg);
                    opacity: 1;
                }
                100% {
                    transform: translateY(100vh) rotate(720deg);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Play success sound (vibration pattern for mobile)
function playSuccessSound() {
    // Use vibration pattern to simulate celebration
    if (navigator.vibrate) {
        // Happy vibration pattern
        navigator.vibrate([100, 50, 100, 50, 100, 50, 200]);
    }

    // Trigger multiple haptic feedbacks
    if (tg && tg.HapticFeedback) {
        setTimeout(() => tg.HapticFeedback.notificationOccurred('success'), 0);
        setTimeout(() => tg.HapticFeedback.impactOccurred('medium'), 200);
        setTimeout(() => tg.HapticFeedback.notificationOccurred('success'), 400);
    }
}

// Update user data
async function updateUserData(userId) {
    const updateResponse = await fetch(`/api/user/${userId}/update`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': getInitData()
        },
        body: JSON.stringify({
            first_name: formData.first_name,
            source: formData.source
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
