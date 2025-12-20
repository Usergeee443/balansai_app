# Balans AI - Telegram Mini App

Telegram Mini App uchun moliyaviy hisobotlar va tranzaksiyalar boshqaruvi ilovasi.

## Texnologiyalar

- **Backend**: Python Flask
- **Frontend**: HTML, Tailwind CSS, JavaScript
- **Database**: MySQL
- **Deployment**: Render

## O'rnatish

### Lokal rivojlanish

1. Repository ni klon qiling:
```bash
git clone <repository-url>
cd balansai_app
```

2. Virtual environment yarating va aktivlashtiring:
```bash
python3 -m venv .venv
source .venv/bin/activate  # Linux/Mac
# yoki
.venv\Scripts\activate  # Windows
```

3. Kerakli paketlarni o'rnating:
```bash
pip install -r requirements.txt
```

4. `.env` faylini yarating va sozlang:
```bash
cp .env.example .env
# .env faylini o'zgartiring
```

5. Ilovani ishga tushiring:
```bash
python app.py
```

Ilova `http://localhost:5000` da ochiladi.

## Render'ga Deploy qilish

### 1. GitHub'ga yuklash

Ilovangizni GitHub repository ga yuklang.

### 2. Render'da yangi service yaratish

1. [Render Dashboard](https://dashboard.render.com/) ga kiring
2. "New +" tugmasini bosing va "Web Service" ni tanlang
3. GitHub repository ni ulang
4. Quyidagi sozlamalarni kiriting:
   - **Name**: `balansai-app` (yoki xohlagan nomingiz)
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app --bind 0.0.0.0:$PORT`

### 3. Environment Variables

Render Dashboard'da "Environment" bo'limiga quyidagi environment variables larni qo'shing:

```
MYSQL_HOST=146.103.126.207
MYSQL_USER=phpmyadmin
MYSQL_PASSWORD=PMA_Str0ng!2025
MYSQL_DATABASE=BalansAiBot
MYSQL_PORT=3306
SECRET_KEY=<random-secret-key>
DEBUG=False
TELEGRAM_BOT_TOKEN=<your-telegram-bot-token>
```

**Eslatma**: `SECRET_KEY` ni xavfsiz random string bilan almashtiring.

### 4. Deploy

"Create Web Service" tugmasini bosing. Render avtomatik deploy qiladi.

### Alternativ: render.yaml orqali

Agar `render.yaml` faylidan foydalanmoqchi bo'lsangiz:

1. Render Dashboard'da "New +" > "Blueprint"
2. GitHub repository ni tanlang
3. Render.yaml faylini avtomatik aniqlaydi va deploy qiladi

## Environment Variables

| Variable | Tavsif | Default |
|----------|--------|---------|
| `MYSQL_HOST` | MySQL server host | `146.103.126.207` |
| `MYSQL_USER` | MySQL foydalanuvchi nomi | `phpmyadmin` |
| `MYSQL_PASSWORD` | MySQL parol | - |
| `MYSQL_DATABASE` | Database nomi | `BalansAiBot` |
| `MYSQL_PORT` | MySQL port | `3306` |
| `SECRET_KEY` | Flask secret key | - |
| `DEBUG` | Debug mode | `False` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | - |

## Xususiyatlar

- ✅ Foydalanuvchi ma'lumotlarini ko'rsatish
- ✅ Tranzaksiyalarni ko'rsatish (faqat o'qish)
- ✅ Qarzlar ro'yxati
- ✅ Eslatmalar
- ✅ Statistika
- ✅ Valyuta balanslari
- ✅ Tarif tekshiruvi (Plus/Pro)
- ✅ SPA (Single Page Application) - tez sahifalar o'tish
- ✅ Lazy loading - sahifalar faqat bir marta yuklanadi

## API Endpoints

- `GET /` - Asosiy sahifa
- `GET /api/user` - Foydalanuvchi ma'lumotlari
- `GET /api/transactions` - Tranzaksiyalar ro'yxati
- `GET /api/statistics` - Statistika
- `GET /api/debts` - Qarzlar ro'yxati
- `GET /api/reminders` - Eslatmalar ro'yxati

## Litsenziya

Proprietary - Balans AI
