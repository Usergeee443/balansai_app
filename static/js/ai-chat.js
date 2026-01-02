/**
 * Balans AI - AI Chat Assistant
 * Sun'iy intellekt moliyaviy maslahatchi
 */

// ============================================
// AI CHAT MANAGER
// ============================================

class AIChatManager {
    constructor() {
        this.messages = this.loadMessages();
        this.isTyping = false;
    }

    loadMessages() {
        const saved = localStorage.getItem('aiChatMessages');
        return saved ? JSON.parse(saved) : [];
    }

    saveMessages() {
        localStorage.setItem('aiChatMessages', JSON.stringify(this.messages));
    }

    async sendMessage(userMessage) {
        // User xabarini qo'shish
        this.messages.push({
            id: Date.now(),
            type: 'user',
            content: userMessage,
            timestamp: new Date().toISOString()
        });

        this.saveMessages();
        this.renderMessages();

        // AI javobini olish
        this.isTyping = true;
        this.showTypingIndicator();

        const aiResponse = await this.getAIResponse(userMessage);

        this.isTyping = false;
        this.hideTypingIndicator();

        // AI javobini qo'shish
        this.messages.push({
            id: Date.now() + 1,
            type: 'ai',
            content: aiResponse,
            timestamp: new Date().toISOString()
        });

        this.saveMessages();
        this.renderMessages();
    }

    async getAIResponse(userMessage) {
        try {
            // Backend AI API ga so'rov yuborish
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-Init-Data': this.getInitData()
                },
                body: JSON.stringify({ message: userMessage })
            });

            if (!response.ok) {
                // Fallback: rule-based responses
                return this.getRuleBasedResponse(userMessage);
            }

            const data = await response.json();
            return data.response;
        } catch (error) {
            console.error('AI Chat Error:', error);
            return this.getRuleBasedResponse(userMessage);
        }
    }

    getRuleBasedResponse(message) {
        const lowerMessage = message.toLowerCase();

        // Tejash maslahatlar
        if (lowerMessage.includes('tejash') || lowerMessage.includes('pul yig')) {
            return `💰 Tejash bo'yicha maslahatlairm:\n\n` +
                   `1. "50/30/20" qoidasidan foydalaning:\n` +
                   `   • 50% - zarur xarajatlar\n` +
                   `   • 30% - istaklar\n` +
                   `   • 20% - tejash va investitsiya\n\n` +
                   `2. Har oyning boshida tejash uchun pul ajratib qo'ying\n\n` +
                   `3. Keraksiz obunalarni bekor qiling\n\n` +
                   `4. Chegirmalar va aksiyalardan foydalaning`;
        }

        // Byudjet
        if (lowerMessage.includes('byudjet') || lowerMessage.includes('reja')) {
            return `📊 Byudjet tuzish bo'yicha tavsiyalar:\n\n` +
                   `1. Barcha daromadlaringizni ro'yxatga oling\n` +
                   `2. Doimiy va o'zgaruvchan xarajatlarni aniqlang\n` +
                   `3. Har bir kategoriya uchun limit belgilang\n` +
                   `4. Haftada bir marta byudjetingizni tekshiring\n` +
                   `5. Ehtiyot jamg'arma yarating`;
        }

        // Qarz
        if (lowerMessage.includes('qarz') || lowerMessage.includes('kredit')) {
            return `💳 Qarzlarni boshqarish:\n\n` +
                   `1. Barcha qarzlarni ro'yxatga oling\n` +
                   `2. Yuqori foizli qarzlarni birinchi to'lang\n` +
                   `3. Yangi qarzga kirmaslikka harakat qiling\n` +
                   `4. Qarz to'lash rejasini tuzing\n` +
                   `5. Qarzlarni konsolidatsiya qilishni o'ylab ko'ring`;
        }

        // Investitsiya
        if (lowerMessage.includes('investitsiya') || lowerMessage.includes('sarmoya')) {
            return `📈 Investitsiya bo'yicha umumiy maslahatlar:\n\n` +
                   `1. Avval ehtiyot jamg'arma yarating (3-6 oylik xarajat)\n` +
                   `2. Barcha tuxumlarni bir savatchaga solmang\n` +
                   `3. Uzoq muddatli maqsadlar qo'ying\n` +
                   `4. O'rganishdan boshlangling\n` +
                   `5. Professional maslahatchi bilan maslahatlashing`;
        }

        // Xarajat kamaytirish
        if (lowerMessage.includes('xarajat') || lowerMessage.includes('kamaytir')) {
            return `💸 Xarajatlarni kamaytirish usullari:\n\n` +
                   `1. Uyda ovqat tayyorlang, tashqarida kamroq ovqatlaning\n` +
                   `2. Jamoat transportidan foydalaning\n` +
                   `3. Ommaviy xaridlardan foydalaning\n` +
                   `4. Energiyani tejang (elektr, suv, gaz)\n` +
                   `5. Xariddan oldin 24 soat o'ylab ko'ring`;
        }

        // Moliyaviy maqsadlar
        if (lowerMessage.includes('maqsad') || lowerMessage.includes('goal')) {
            return `🎯 Moliyaviy maqsadlar qo'yish:\n\n` +
                   `1. SMART maqsadlar qo'ying:\n` +
                   `   • Specific (Aniq)\n` +
                   `   • Measurable (O'lchanadigan)\n` +
                   `   • Achievable (Erishilishi mumkin)\n` +
                   `   • Relevant (Muhim)\n` +
                   `   • Time-bound (Muddatli)\n\n` +
                   `2. Katta maqsadlarni kichik qadamlarga bo'ling\n` +
                   `3. Har oylik maqsad va yillik maqsad belgilang`;
        }

        // Default response
        return `Assalomu alaykum! Men Balans AI yordamchisiman. 🤖\n\n` +
               `Men sizga moliyaviy masalalar bo'yicha yordam bera olaman:\n\n` +
               `• Tejash maslahatlar 💰\n` +
               `• Byudjet tuzish 📊\n` +
               `• Qarzlarni boshqarish 💳\n` +
               `• Investitsiya bo'yicha umumiy ma'lumot 📈\n` +
               `• Xarajatlarni kamaytirish 💸\n` +
               `• Moliyaviy maqsadlar 🎯\n\n` +
               `Menga savol bering!`;
    }

    getInitData() {
        const tg = window.Telegram?.WebApp;
        return tg?.initData || '';
    }

    showTypingIndicator() {
        const container = document.getElementById('chatMessages');
        if (!container) return;

        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.id = 'typingIndicator';
        indicator.innerHTML = `
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;

        container.appendChild(indicator);
        container.scrollTop = container.scrollHeight;
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.remove();
        }
    }

    renderMessages() {
        const container = document.getElementById('chatMessages');
        if (!container) return;

        container.innerHTML = '';

        if (this.messages.length === 0) {
            container.innerHTML = `
                <div class="chat-empty-state">
                    <div class="chat-empty-icon">🤖</div>
                    <div class="chat-empty-title">Salom! Men Balans AI yordamchisiman</div>
                    <div class="chat-empty-message">Moliyaviy savollaringizni bering</div>
                </div>
            `;
            return;
        }

        this.messages.forEach(message => {
            const messageEl = document.createElement('div');
            messageEl.className = `chat-message ${message.type}`;

            const timeStr = new Date(message.timestamp).toLocaleTimeString('uz-UZ', {
                hour: '2-digit',
                minute: '2-digit'
            });

            messageEl.innerHTML = `
                <div class="chat-message-content">
                    <div class="chat-message-text">${this.formatMessage(message.content)}</div>
                    <div class="chat-message-time">${timeStr}</div>
                </div>
            `;

            container.appendChild(messageEl);
        });

        container.scrollTop = container.scrollHeight;
    }

    formatMessage(content) {
        // Markdown-style formatting
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
    }

    clearChat() {
        this.messages = [];
        this.saveMessages();
        this.renderMessages();
    }

    createChatUI() {
        const container = document.createElement('div');
        container.className = 'ai-chat-container';
        container.innerHTML = `
            <div class="ai-chat-header">
                <button class="back-btn" onclick="this.closest('.ai-chat-container').remove()">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                    </svg>
                </button>
                <div class="ai-chat-header-info">
                    <div class="ai-chat-header-title">AI Maslahatchi</div>
                    <div class="ai-chat-header-status">Onlayn</div>
                </div>
                <button class="ai-chat-clear" onclick="window.aiChat.clearChat()">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
            </div>

            <div class="ai-chat-messages" id="chatMessages"></div>

            <div class="ai-chat-input-container">
                <input type="text" class="ai-chat-input" id="chatInput" placeholder="Savol bering...">
                <button class="ai-chat-send" id="chatSend">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                    </svg>
                </button>
            </div>

            <!-- Quick Actions -->
            <div class="ai-chat-quick-actions">
                <button class="quick-action" onclick="window.aiChat.sendMessage('Tejash bo\\'yicha maslahat bering')">
                    💰 Tejash
                </button>
                <button class="quick-action" onclick="window.aiChat.sendMessage('Byudjet qanday tuzaman?')">
                    📊 Byudjet
                </button>
                <button class="quick-action" onclick="window.aiChat.sendMessage('Qarzlarni qanday boshqaraman?')">
                    💳 Qarzlar
                </button>
            </div>
        `;

        document.body.appendChild(container);

        // Event listeners
        const input = container.querySelector('#chatInput');
        const sendBtn = container.querySelector('#chatSend');

        const sendMessage = () => {
            const message = input.value.trim();
            if (message) {
                this.sendMessage(message);
                input.value = '';
            }
        };

        sendBtn.addEventListener('click', sendMessage);

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        // Render existing messages
        this.renderMessages();

        // Auto-focus
        setTimeout(() => input.focus(), 100);
    }
}

// ============================================
// FINANCIAL ADVISOR
// ============================================

class FinancialAdvisor {
    async getPersonalizedAdvice() {
        const userData = await this.getUserFinancialData();
        const advice = [];

        // Analyze spending patterns
        if (userData.expenses) {
            const highSpendingCategories = this.findHighSpendingCategories(userData.expenses);
            if (highSpendingCategories.length > 0) {
                advice.push({
                    type: 'spending',
                    priority: 'high',
                    message: `${highSpendingCategories[0].name} kategoriyasiga juda ko'p pul sarflayapsiz. Bu xarajatni kamaytiring.`,
                    suggestion: 'Ushbu kategoriya uchun oylik limit belgilang'
                });
            }
        }

        // Check savings rate
        const savingsRate = (userData.savings / (userData.income || 1)) * 100;
        if (savingsRate < 20) {
            advice.push({
                type: 'savings',
                priority: 'medium',
                message: 'Tejash darajasi past. Daromadingizning kamida 20% ini tejashga harakat qiling.',
                suggestion: 'Avtomatik tejash rejasini sozlang'
            });
        }

        // Debt management
        if (userData.debts && userData.debts.length > 0) {
            const totalDebt = userData.debts.reduce((sum, d) => sum + d.amount, 0);
            if (totalDebt > userData.income * 0.3) {
                advice.push({
                    type: 'debt',
                    priority: 'high',
                    message: 'Qarzlaringiz daromadingizning 30% idan oshib ketgan.',
                    suggestion: 'Qarzlarni to\'lash rejasini tuzing va yangi qarzga kirmang'
                });
            }
        }

        return advice;
    }

    async getUserFinancialData() {
        try {
            const response = await fetch('/api/user/financial-summary', {
                headers: {
                    'X-Telegram-Init-Data': this.getInitData()
                }
            });

            if (!response.ok) {
                // Mock data
                return {
                    income: 5000000,
                    expenses: [
                        { name: 'Oziq-ovqat', amount: 1500000 },
                        { name: 'Transport', amount: 500000 },
                        { name: 'Uy-joy', amount: 2000000 }
                    ],
                    savings: 500000,
                    debts: []
                };
            }

            return await response.json();
        } catch (error) {
            console.error('Failed to fetch financial data:', error);
            return null;
        }
    }

    findHighSpendingCategories(expenses) {
        return expenses
            .sort((a, b) => b.amount - a.amount)
            .filter(e => e.amount > 1000000);
    }

    getInitData() {
        const tg = window.Telegram?.WebApp;
        return tg?.initData || '';
    }
}

// ============================================
// CSS STYLES
// ============================================

const aiChatStyles = `
<style>
.ai-chat-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #f5f5f5;
    z-index: 9999;
    display: flex;
    flex-direction: column;
}

.ai-chat-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.ai-chat-header-info {
    flex: 1;
}

.ai-chat-header-title {
    font-size: 18px;
    font-weight: 700;
    color: white;
}

.ai-chat-header-status {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.8);
}

.ai-chat-clear {
    width: 40px;
    height: 40px;
    background: rgba(255, 255, 255, 0.2);
    border: none;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}

.ai-chat-clear svg {
    width: 20px;
    height: 20px;
    color: white;
}

.ai-chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    background: #f5f5f5;
}

.chat-message {
    margin-bottom: 16px;
    display: flex;
}

.chat-message.user {
    justify-content: flex-end;
}

.chat-message.ai {
    justify-content: flex-start;
}

.chat-message-content {
    max-width: 80%;
    padding: 12px 16px;
    border-radius: 16px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.chat-message.user .chat-message-content {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-bottom-right-radius: 4px;
}

.chat-message.ai .chat-message-content {
    background: white;
    color: #1a1a1a;
    border-bottom-left-radius: 4px;
}

.chat-message-text {
    font-size: 15px;
    line-height: 1.5;
    margin-bottom: 4px;
}

.chat-message-time {
    font-size: 11px;
    opacity: 0.7;
    text-align: right;
}

.chat-empty-state {
    text-align: center;
    padding: 60px 20px;
}

.chat-empty-icon {
    font-size: 64px;
    margin-bottom: 16px;
}

.chat-empty-title {
    font-size: 18px;
    font-weight: 700;
    color: #1a1a1a;
    margin-bottom: 8px;
}

.chat-empty-message {
    font-size: 14px;
    color: #666;
}

.ai-chat-input-container {
    padding: 16px;
    background: white;
    border-top: 1px solid #e5e5e5;
    display: flex;
    gap: 12px;
}

.ai-chat-input {
    flex: 1;
    padding: 12px 16px;
    border: 1px solid #e5e5e5;
    border-radius: 24px;
    font-size: 15px;
    outline: none;
}

.ai-chat-input:focus {
    border-color: #667eea;
}

.ai-chat-send {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}

.ai-chat-send svg {
    width: 24px;
    height: 24px;
    color: white;
}

.ai-chat-quick-actions {
    padding: 12px 16px;
    background: white;
    display: flex;
    gap: 8px;
    overflow-x: auto;
}

.quick-action {
    padding: 8px 16px;
    background: #f5f5f5;
    border: none;
    border-radius: 20px;
    font-size: 13px;
    white-space: nowrap;
    cursor: pointer;
}

.quick-action:active {
    background: #e5e5e5;
}

.typing-indicator {
    display: flex;
    justify-content: flex-start;
    margin-bottom: 16px;
}

.typing-dots {
    background: white;
    padding: 12px 16px;
    border-radius: 16px;
    border-bottom-left-radius: 4px;
    display: flex;
    gap: 4px;
}

.typing-dots span {
    width: 8px;
    height: 8px;
    background: #999;
    border-radius: 50%;
    animation: typing 1.4s infinite;
}

.typing-dots span:nth-child(2) {
    animation-delay: 0.2s;
}

.typing-dots span:nth-child(3) {
    animation-delay: 0.4s;
}

@keyframes typing {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-10px); }
}
</style>
`;

// Add styles to document
if (!document.getElementById('ai-chat-styles')) {
    const styleEl = document.createElement('div');
    styleEl.id = 'ai-chat-styles';
    styleEl.innerHTML = aiChatStyles;
    document.head.appendChild(styleEl);
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    window.aiChat = new AIChatManager();
    window.financialAdvisor = new FinancialAdvisor();
});
