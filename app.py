# Flask backend server
from flask import Flask, render_template, request, jsonify, session
from config import Config
from database import (
    get_user, get_transactions, add_transaction, get_balance,
    get_statistics, get_debts, add_debt, get_reminders,
    get_balance_and_statistics
)
import os
import hmac
import hashlib
import json
from urllib.parse import unquote
from dotenv import load_dotenv
from decimal import Decimal
from datetime import datetime, date, time, timedelta

# .env faylini yuklash
load_dotenv()

app = Flask(__name__)
app.config.from_object(Config)

# Telegram Mini App validatsiyasi
def validate_telegram_webapp(init_data):
    """Telegram Mini App init_data ni validatsiya qilish"""
    try:
        # init_data ni URL decode qilish
        init_data = unquote(init_data)
        
        # init_data ni parse qilish
        pairs = {}
        for pair in init_data.split('&'):
            if '=' in pair:
                key, value = pair.split('=', 1)
                pairs[key] = value
        
        if 'hash' not in pairs:
            return None
        
        hash_value = pairs.pop('hash')
        
        # Data string ni yaratish
        data_check_string = '\n'.join(sorted([f"{k}={pairs[k]}" for k in pairs]))
        
        # Secret key yaratish (Bot token dan)
        secret_key = hmac.new(
            "WebAppData".encode(),
            Config.TELEGRAM_BOT_TOKEN.encode(),
            hashlib.sha256
        ).digest()
        
        # Hash ni tekshirish
        calculated_hash = hmac.new(
            secret_key,
            data_check_string.encode(),
            hashlib.sha256
        ).hexdigest()
        
        if calculated_hash != hash_value:
            return None
        
        # User ma'lumotlarini olish
        if 'user' in pairs:
            user_data = json.loads(pairs['user'].replace('+', ' ').replace('%22', '"'))
            return user_data.get('id')
        
        return None
    except Exception as e:
        print(f"Validatsiya xatosi: {e}")
        return None

@app.route('/')
def index():
    """Asosiy sahifa (SPA)"""
    return render_template('index.html')

def get_telegram_init_data():
    """Telegram Mini App init_data ni olish (header yoki query parameter dan)"""
    init_data = request.headers.get('X-Telegram-Init-Data') or request.args.get('_auth')
    return init_data

def parse_user_id_from_init_data(init_data):
    """DEBUG mode uchun init_data dan user_id ni parse qilish (validatsiyasiz)"""
    try:
        init_data = unquote(init_data)
        pairs = {}
        for pair in init_data.split('&'):
            if '=' in pair:
                key, value = pair.split('=', 1)
                pairs[key] = value
        
        if 'user' in pairs:
            # URL decode qilish
            user_str = unquote(pairs['user'])
            user_data = json.loads(user_str)
            user_id = user_data.get('id')
            if user_id:
                print(f"[DEBUG] User ID parse qilindi (validatsiyasiz): {user_id}")
                return user_id
    except Exception as e:
        print(f"[DEBUG] Parse xatosi: {e}")
    return None

def get_user_id_from_request():
    """Foydalanuvchi ID ni olish (validatsiya orqali yoki test mode)"""
    init_data = get_telegram_init_data()
    
    # Agar init_data bo'sh bo'lsa va DEBUG mode bo'lsa, test user_id qaytarish
    if not init_data and Config.DEBUG:
        # Test user_id ni query parameter dan olish yoki default
        test_user_id = request.args.get('test_user_id', '123456789')
        print(f"[DEBUG] Test mode: user_id={test_user_id}")
        return int(test_user_id)
    
    if not init_data:
        return None
    
    # Validatsiya qilish
    user_id = validate_telegram_webapp(init_data)
    
    # Agar validatsiya muvaffaqiyatsiz bo'lsa va DEBUG mode bo'lsa, parse qilib olish
    if not user_id and Config.DEBUG:
        print(f"[DEBUG] Validatsiya muvaffaqiyatsiz, parse qilib olinmoqda...")
        user_id = parse_user_id_from_init_data(init_data)
    
    return user_id

@app.route('/api/user', methods=['GET'])
def get_user_info():
    """Foydalanuvchi ma'lumotlarini olish"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        user = get_user(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        tariff_expires_at = user.get('tariff_expires_at')
        if tariff_expires_at and isinstance(tariff_expires_at, datetime):
            tariff_expires_at = tariff_expires_at.isoformat()
        elif tariff_expires_at:
            tariff_expires_at = str(tariff_expires_at)
        else:
            tariff_expires_at = None
        
        # Optimallashtirilgan: balance va statistics ni bir vaqtda olish
        balance_stats = get_balance_and_statistics(user_id, days=30)
        
        return jsonify({
            'user_id': user['user_id'],
            'username': user.get('username'),
            'first_name': user.get('first_name'),
            'name': user.get('name', 'Xojayin'),
            'tariff': user.get('tariff', 'NONE'),
            'tariff_expires_at': tariff_expires_at,
            'balance': balance_stats['balance'],
            'income': balance_stats['income'],
            'expense': balance_stats['expense'],
            'currency_balances': balance_stats.get('currency_balances', {})
        })
    except Exception as e:
        error_msg = str(e)
        if "Access denied" in error_msg or "Can't connect" in error_msg:
            return jsonify({'error': 'Database ulanish xatosi. Server administratoriga murojaat qiling.'}), 500
        return jsonify({'error': error_msg}), 500

@app.route('/api/transactions', methods=['GET'])
def api_get_transactions():
    """Tranzaksiyalarni olish"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        transaction_type = request.args.get('type')  # income, expense, debt
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        
        transactions = get_transactions(user_id, limit, offset, transaction_type)
        
        # Agar transactions bo'sh bo'lsa yoki None bo'lsa
        if not transactions:
            return jsonify([])
        
        # Decimal ni float ga konvertatsiya qilish
        for t in transactions:
            for key, value in t.items():
                if isinstance(value, Decimal):
                    t[key] = float(value)
                elif isinstance(value, type(None)):
                    t[key] = None
                elif isinstance(value, datetime):
                    t[key] = value.isoformat()
        
        return jsonify(transactions)
    except Exception as e:
        print(f"❌ API: Tranzaksiyalarni olishda xatolik: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# POST endpoint'lar olib tashlandi - faqat ko'rsatish rejimi
# @app.route('/api/transactions', methods=['POST'])
# def api_add_transaction():
#     """Yangi tranzaksiya qo'shish - O'CHIRILGAN (faqat ko'rsatish rejimi)"""
#     return jsonify({'error': 'Qo\'shish funksiyasi o\'chirilgan'}), 403

@app.route('/api/balance', methods=['GET'])
def api_get_balance():
    """Balansni olish"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        balance = get_balance(user_id)
        return jsonify({'balance': balance})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/statistics', methods=['GET'])
def api_get_statistics():
    """Statistikani olish"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        days = int(request.args.get('days', 30))
        stats = get_statistics(user_id, days)
        
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/debts', methods=['GET'])
def api_get_debts():
    """Qarzlar ro'yxatini olish"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        debts = get_debts(user_id)
        
        # Decimal ni float ga konvertatsiya qilish
        for d in debts:
            for key, value in d.items():
                if isinstance(value, Decimal):
                    d[key] = float(value)
                elif isinstance(value, type(None)):
                    d[key] = None
        
        return jsonify(debts)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# POST endpoint'lar olib tashlandi - faqat ko'rsatish rejimi
# @app.route('/api/debts', methods=['POST'])
# def api_add_debt():
#     """Yangi qarz qo'shish - O'CHIRILGAN (faqat ko'rsatish rejimi)"""
#     return jsonify({'error': 'Qo\'shish funksiyasi o\'chirilgan'}), 403

@app.route('/api/reminders', methods=['GET'])
def api_get_reminders():
    """Eslatmalarni olish"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        limit = int(request.args.get('limit', 20))
        reminders = get_reminders(user_id, limit)
        
        # Agar reminders bo'sh bo'lsa yoki None bo'lsa
        if not reminders:
            return jsonify([])
        
        # Decimal ni float ga konvertatsiya qilish va boshqa turdagi ma'lumotlarni JSON ga moslashtirish
        for r in reminders:
            for key, value in r.items():
                if isinstance(value, Decimal):
                    r[key] = float(value)
                elif isinstance(value, type(None)):
                    r[key] = None
                elif isinstance(value, datetime):
                    r[key] = value.isoformat()
                elif isinstance(value, (date, time)):
                    r[key] = str(value)
                elif isinstance(value, timedelta):
                    # timedelta ni sekundlarga konvertatsiya qilish
                    r[key] = value.total_seconds()
                elif isinstance(value, bool):
                    r[key] = value
                elif isinstance(value, (int, float, str)):
                    r[key] = value
                else:
                    # Boshqa turdagi ma'lumotlarni string ga konvertatsiya qilish
                    r[key] = str(value)
        
        return jsonify(reminders)
    except Exception as e:
        print(f"❌ API: Eslatmalarni olishda xatolik: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(debug=Config.DEBUG, host='0.0.0.0', port=port)

