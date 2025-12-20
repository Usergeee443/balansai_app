# Balans AI - Telegram Mini App

Moliyaviy hisobotlar va tranzaksiyalarni boshqarish uchun Telegram Mini App ilovasi.

## Texnologiyalar

- **Backend**: Python Flask
- **Frontend**: HTML + Tailwind CSS + JavaScript
- **Database**: MySQL
- **Integratsiya**: Telegram Mini App API

## O'rnatish

### 1. Python dependencies o'rnatish

```bash
pip install -r requirements.txt
```

### 2. Environment o'zgaruvchilarini sozlash

`.env` fayl yarating va quyidagilarni to'ldiring:

```env
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=balansai_db
MYSQL_PORT=3306

SECRET_KEY=your-secret-key-here
DEBUG=True

TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

### 3. Database struktura

Database da quyidagi jadvallar mavjud bo'lishi kerak:

- `users` - Foydalanuvchilar
- `transactions` - Tranzaksiyalar
- `currency_rates` - Valyuta kurslari
- `debts` - Qarzlar
- `reminders` - Eslatmalar

Jadval strukturalari TZ da berilgan.

**MUHIM: Database ulanish muammosi**

Agar "Access denied" xatosi ko'rsatilsa, quyidagilarni tekshiring:

1. **IP Whitelist**: Database server administratoriga IP manzilingizni whitelist'ga qo'shishni so'rang
2. **SSH Tunnel** (agar SSH access bo'lsa):
   ```bash
   ssh -L 3306:146.103.126.207:3306 your_username@146.103.126.207
   ```
   Keyin `.env` yoki `config.py` da `MYSQL_HOST=localhost` qiling
3. **VPN**: Database serverga ruxsat berilgan IP manzilidan ulanish
4. **Local Database**: Development uchun local MySQL ishlatish

### 4. Serverni ishga tushirish

```bash
python app.py
```

Server `http://localhost:5000` da ishga tushadi.

### 5. Ngrok sozlash (Development uchun)

Telegram Mini App'ni local development qilish uchun ngrok ishlatish:

1. Ngrok o'rnating (agar o'rnatilmagan bo'lsa):
   ```bash
   brew install ngrok
   # yoki
   # https://ngrok.com/download dan yuklab oling
   ```

2. Ngrok ni 5000 portga forward qiling:
   ```bash
   ngrok http 5000
   ```

3. Ngrok bergan HTTPS URL ni oling (masalan: `https://d22594753f75.ngrok-free.app`)

**MUHIM**: Ngrok ni to'xtatish uchun `Ctrl+C` bosing va qayta ishga tushirishda 5000 portni ko'rsating.

## Telegram Mini App sozlash

1. Telegram Bot yarating va token oling
2. BotFather orqali Mini App sozlang:
   ```
   /newapp
   ```
3. Web App URL ni kiriting: ngrok bergan HTTPS URL (masalan: `https://d22594753f75.ngrok-free.app`)

## API Endpoints

### GET /api/user
Foydalanuvchi ma'lumotlarini olish

### GET /api/transactions
Tranzaksiyalar ro'yxatini olish
- Query params: `type` (income/expense/debt), `limit`, `offset`

### POST /api/transactions
Yangi tranzaksiya qo'shish
- Body: `transaction_type`, `amount`, `currency`, `category`, `description`

### GET /api/balance
Foydalanuvchi balansini olish

### GET /api/statistics
Statistika olish
- Query params: `days` (default: 30)

### GET /api/debts
Qarzlar ro'yxatini olish

### POST /api/debts
Yangi qarz qo'shish
- Body: `debt_type`, `amount`, `person_name`, `due_date`

### GET /api/reminders
Eslatmalar ro'yxatini olish

## Funksiyalar

- ✅ Tranzaksiyalarni ko'rish va qo'shish (Kirim, Chiqim, Qarz)
- ✅ Balans ko'rsatkichlari
- ✅ Statistika (Kirim/Chiqim)
- ✅ Qarzlar boshqaruvi
- ✅ Eslatmalar
- ✅ Ko'p valyuta qo'llab-quvvatlash (UZS, USD, EUR, RUB, TRY)
- ✅ Valyuta konvertatsiyasi

## Development Mode

Development vaqtida browser'da test qilish uchun:

1. `.env` faylida `DEBUG=True` qiling
2. Browser'da sahifani ochishda URL ga `?test_user_id=YOUR_USER_ID` qo'shing:
   ```
   http://localhost:5000?test_user_id=123456789
   ```

Bu holda Telegram validatsiyasidan o'tmasdan test qilishingiz mumkin.

## Eslatmalar

- Production'da `DEBUG=False` qiling
- Barcha API so'rovlar `X-Telegram-Init-Data` header orqali validatsiya qilinadi
- Database bilan to'g'ridan-to'g'ri ishlaydi (ORM yo'q)
- Valyuta kurslari `currency_rates` jadvalidan olinadi
- Development mode'da test_user_id query parameter orqali test qilish mumkin

