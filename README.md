# Balans AI - Telegram Mini App

Moliyaviy boshqaruv tizimi - Telegram Mini App

## 📁 Loyiha Strukturasi

```
balansai_app/
├── app.py                 # Flask backend server
├── config.py              # Konfiguratsiya
├── database.py            # Database funksiyalari
├── requirements.txt       # Python dependencies
├── Procfile              # Render deployment
├── render.yaml           # Render konfiguratsiya
├── .env                  # Environment variables (local)
├── static/
│   ├── css/
│   │   └── style.css     # Barcha stillar
│   ├── js/
│   │   └── main.js       # Frontend JavaScript
│   └── logo.png          # Logo
└── templates/
    └── index.html        # Asosiy HTML (SPA)
```

## 🎨 Frontend Arxitektura

### Single Page Application (SPA)
- **index.html** - Barcha sahifalar bitta faylda
- **style.css** - Toza, modulli CSS
- **main.js** - Sifatli JavaScript kod

### Sahifalar
1. **Asosiy** (Home) - Balans, valyutalar, tranzaksiyalar, statistika
2. **Tranzaksiyalar** - Barcha tranzaksiyalar ro'yxati
3. **Statistika** - Grafik va dashboardlar
4. **Eslatmalar** - To'lov eslatmalari
5. **Qarzlar** - Qarz boshqaruvi

### UI Xususiyatlari
- ✅ Minimalistik dizayn
- ✅ Telegram Web App integratsiyasi
- ✅ Haptic feedback
- ✅ Smooth animations
- ✅ Responsive layout
- ✅ No text selection, zoom, scrollbars
- ✅ Bottom navigation (rounded, open sides)

## 🚀 Ishga Tushirish

### Local Development

1. Virtual environment yaratish:
```bash
python3 -m venv venv
source venv/bin/activate  # MacOS/Linux
```

2. Dependencies o'rnatish:
```bash
pip install -r requirements.txt
```

3. `.env` fayl yaratish:
```env
MYSQL_HOST=146.103.126.207
MYSQL_USER=phpmyadmin
MYSQL_PASSWORD=PMA_Str0ng!2025
MYSQL_DATABASE=BalansAiBot
MYSQL_PORT=3306
SECRET_KEY=your-secret-key-here
DEBUG=True
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

4. Serverni ishga tushirish:
```bash
python app.py
```

5. Test uchun:
```
http://127.0.0.1:5000/?test_user_id=123
```

### Render Deployment

1. GitHub repository yaratish
2. Render.com'ga ulash
3. Environment variables qo'shish
4. Deploy qilish

## 🔧 Backend API

### Endpoints

- `GET /` - Asosiy sahifa
- `GET /api/user` - User ma'lumotlari
- `GET /api/transactions` - Tranzaksiyalar
- `GET /api/balance` - Balans
- `GET /api/statistics` - Statistika
- `GET /api/statistics/income-trend` - Daromad dinamikasi
- `GET /api/statistics/top-categories` - Top kategoriyalar
- `GET /api/statistics/expense-by-category` - Xarajat taqsimoti
- `GET /api/debts` - Qarzlar
- `GET /api/reminders` - Eslatmalar

### Authentication

Telegram Mini App `initData` validatsiyasi:
- Production: `X-Telegram-Init-Data` header
- Development: `?test_user_id=123` query parameter

## 📊 Database

MySQL database strukturasi:
- `users` - Foydalanuvchilar
- `transactions` - Tranzaksiyalar
- `debts` - Qarzlar
- `reminders` - Eslatmalar
- `currency_rates` - Valyuta kurslari

## 🎯 Tariflar

Qo'llab-quvvatlanadigan tariflar:
- ✅ PLUS
- ✅ PRO
- ✅ FAMILY
- ✅ FAMILY_PLUS
- ✅ FAMILY_PRO
- ❌ BUSINESS (alohida ilova)
- ❌ NONE (tarif sotib olish kerak)

## 📝 Kod Sifati

### CSS
- BEM metodologiyasi
- Modulli struktura
- Responsive design
- Animation va transition

### JavaScript
- ES6+ syntax
- Async/await
- Error handling
- Clean code principles

### Python
- PEP 8 standartlari
- Type hints (optional)
- Error handling
- Database connection pooling

## 🔐 Xavfsizlik

- Telegram WebApp validatsiyasi
- SQL injection himoyasi (parameterized queries)
- XSS himoyasi
- CORS sozlamalari

## 📱 Telegram Mini App

### Integration
```javascript
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();
tg.enableClosingConfirmation();
```

### Haptic Feedback
```javascript
tg.HapticFeedback.impactOccurred('light');
tg.HapticFeedback.notificationOccurred('success');
```

## 🐛 Debug

### Local Testing
```bash
# Flask debug mode
DEBUG=True python app.py

# Test user
http://127.0.0.1:5000/?test_user_id=123
```

### Logs
```bash
# Flask logs
tail -f app.log

# Database errors
grep "ERROR" app.log
```

## 📦 Dependencies

- Flask 3.0.0
- PyMySQL 1.1.0
- python-dotenv 1.0.0
- Chart.js 4.4.0 (CDN)
- Telegram Web App JS (CDN)

## 🎨 Design System

### Colors
- Primary: `#5A8EF4` (Blue)
- Success: `#10b981` (Green)
- Error: `#ef4444` (Red)
- Warning: `#F4D03F` (Gold)
- Background: `#f5f5f5` (Light Gray)
- Text: `#1a1a1a` (Dark)

### Typography
- Font: SF Pro / Segoe UI / Roboto
- Sizes: 12px, 14px, 16px, 18px, 20px

### Spacing
- Base: 4px
- Small: 8px
- Medium: 16px
- Large: 24px

## 📄 License

Private project - Balans AI

## 👨‍💻 Developer

Balans AI Team
