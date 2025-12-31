# Flask backend server
from flask import Flask, render_template, request, jsonify, session, redirect
from config import Config
from database import (
    get_user, get_transactions, add_transaction, get_balance,
    get_statistics, get_debts, add_debt, get_reminders,
    get_balance_and_statistics, get_income_trend, get_top_expense_categories,
    get_expense_by_category, add_reminder, update_reminder_status,
    get_subscription_payments,
    get_contacts, get_contact_by_id, add_contact, update_contact, delete_contact,
    get_debt_by_id, update_debt, delete_debt,
    get_debt_reminders, add_debt_reminder, delete_debt_reminder,
    get_currency_rate,
    update_user, save_initial_balance, save_debt
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
        print(f"[DEBUG] Init data received (length: {len(init_data)})")
        
        # init_data ni parse qilish
        pairs = {}
        for pair in init_data.split('&'):
            if '=' in pair:
                key, value = pair.split('=', 1)
                pairs[key] = value
        
        print(f"[DEBUG] Parsed pairs keys: {list(pairs.keys())}")
        
        if 'hash' not in pairs:
            print("❌ Hash topilmadi")
            # DEBUG mode'da hash yo'q bo'lsa ham parse qilib ko'rish
            if Config.DEBUG and 'user' in pairs:
                try:
                    user_str = unquote(pairs['user'])
                    user_data = json.loads(user_str)
                    user_id = user_data.get('id')
                    print(f"[DEBUG] Hash yo'q, lekin DEBUG mode'da user_id parse qilindi: {user_id}")
                    return user_id
                except Exception as e:
                    print(f"[DEBUG] User parse xatosi: {e}")
            return None
        
        hash_value = pairs.pop('hash')
        
        # Bot token tekshiruvi
        bot_token = Config.TELEGRAM_BOT_TOKEN
        if not bot_token:
            print("⚠️ Bot token topilmadi, validatsiya o'tkazib yuborildi (development mode)")
            if 'user' in pairs:
                try:
                    user_str = unquote(pairs['user'])
                    user_data = json.loads(user_str)
                    user_id = user_data.get('id')
                    print(f"[DEBUG] Bot token yo'q, user_id parse qilindi: {user_id}")
                    return user_id
                except Exception as e:
                    print(f"[DEBUG] User parse xatosi: {e}")
            return None
        
        # Data string ni yaratish
        data_check_string = '\n'.join(sorted([f"{k}={pairs[k]}" for k in pairs]))
        print(f"[DEBUG] Data check string created (length: {len(data_check_string)})")
        
        # Secret key yaratish (Bot token dan)
        secret_key = hmac.new(
            "WebAppData".encode(),
            bot_token.encode(),
            hashlib.sha256
        ).digest()
        
        # Hash ni tekshirish
        calculated_hash = hmac.new(
            secret_key,
            data_check_string.encode(),
            hashlib.sha256
        ).hexdigest()
        
        if calculated_hash != hash_value:
            print(f"❌ Hash mos kelmadi. Received: {hash_value[:10]}..., Calculated: {calculated_hash[:10]}...")
            # DEBUG mode'da hash mos kelmasa ham parse qilib ko'rish
            if Config.DEBUG and 'user' in pairs:
                try:
                    user_str = unquote(pairs['user'])
                    user_data = json.loads(user_str)
                    user_id = user_data.get('id')
                    print(f"[DEBUG] Hash mos kelmadi, lekin DEBUG mode'da user_id parse qilindi: {user_id}")
                    return user_id
                except Exception as e:
                    print(f"[DEBUG] User parse xatosi: {e}")
            return None
        
        print("✅ Hash validatsiyasi muvaffaqiyatli")
        
        # User ma'lumotlarini olish
        if 'user' in pairs:
            user_str = unquote(pairs['user'])
            user_data = json.loads(user_str)
            user_id = user_data.get('id')
            print(f"[DEBUG] Valid user_id: {user_id}")
            return user_id
        
        return None
    except Exception as e:
        print(f"❌ Validatsiya xatosi: {e}")
        import traceback
        traceback.print_exc()
        # Xatolik bo'lsa ham DEBUG mode'da parse qilib ko'rish
        if Config.DEBUG and init_data:
            try:
                pairs = {}
                for pair in init_data.split('&'):
                    if '=' in pair:
                        key, value = pair.split('=', 1)
                        pairs[key] = value
                if 'user' in pairs:
                    user_str = unquote(pairs['user'])
                    user_data = json.loads(user_str)
                    user_id = user_data.get('id')
                    print(f"[DEBUG] Exception bo'ldi, lekin DEBUG mode'da user_id parse qilindi: {user_id}")
                    return user_id
            except:
                pass
        return None

@app.route('/')
def index():
    """Asosiy sahifa (SPA)"""
    return render_template('index.html')

@app.route('/register')
def register():
    """Ro'yxatdan o'tish sahifasi"""
    # Agar user allaqachon ro'yxatdan o'tgan bo'lsa, asosiy sahifaga yuborish
    try:
        user_id = get_user_id_from_request()
        if user_id:
            user = get_user(user_id)
            if user:
                # Registration complete tekshiruvi
                from database import check_registration_complete
                is_complete = check_registration_complete(user_id)
                if is_complete:
                    # Asosiy sahifaga redirect
                    return redirect('/')
    except Exception as e:
        print(f"[DEBUG] Register route'da tekshirish xatosi: {e}")
        # Xatolik bo'lsa ham registration sahifasini ko'rsatish
    
    return render_template('register.html')

@app.route('/api/config', methods=['GET'])
def get_config():
    """Ilova konfiguratsiyasini olish"""
    return jsonify({
        'bot_username': Config.TELEGRAM_BOT_USERNAME
    })

@app.route('/profile')
def profile():
    """Profile sahifasi (alohida mini ilova)"""
    return render_template('profile.html')

def get_telegram_init_data():
    """Telegram Mini App init_data ni olish (header yoki query parameter dan)"""
    # Avval header dan olish
    init_data = request.headers.get('X-Telegram-Init-Data')
    if init_data:
        print(f"[DEBUG] Init data header dan olindi (length: {len(init_data)})")
        return init_data
    
    # Keyin query parameter dan
    init_data = request.args.get('_auth') or request.args.get('initData')
    if init_data:
        print(f"[DEBUG] Init data query parameter dan olindi (length: {len(init_data)})")
        return init_data
    
    print("[DEBUG] Init data topilmadi")
    return None

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
    
    # Test user_id ni query parameter dan olish (DEBUG mode uchun)
    test_user_id = request.args.get('test_user_id')
    if test_user_id and Config.DEBUG:
        print(f"[DEBUG] Test mode: user_id={test_user_id}")
        return int(test_user_id)
    
    # Agar init_data bo'sh bo'lsa
    if not init_data:
        if Config.DEBUG:
            # DEBUG mode'da default test user_id
            print(f"[DEBUG] Init data yo'q, default test user_id ishlatilmoqda")
            return 123456789
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
            return jsonify({
                'error': 'User not found',
                'message': 'Ro\'yxatdan o\'tmagansiz. Iltimos, avval Telegram bot orqali ro\'yxatdan o\'ting.',
                'code': 'USER_NOT_FOUND'
            }), 404
        
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

@app.route('/api/statistics/income-trend', methods=['GET'])
def api_get_income_trend():
    """Daromad dinamikasini olish"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        period = request.args.get('period', 'auto')
        trend = get_income_trend(user_id, period)
        
        return jsonify(trend)
    except Exception as e:
        print(f"❌ API: Daromad dinamikasini olishda xatolik: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/statistics/top-categories', methods=['GET'])
def api_get_top_categories():
    """Top kategoriyalarni olish"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        days = int(request.args.get('days', 30))
        limit = int(request.args.get('limit', 5))
        categories = get_top_expense_categories(user_id, limit, days)
        
        # Decimal ni float ga konvertatsiya
        for cat in categories:
            if isinstance(cat.get('amount_original'), Decimal):
                cat['amount_original'] = float(cat['amount_original'])
        
        return jsonify(categories)
    except Exception as e:
        print(f"❌ API: Top kategoriyalarni olishda xatolik: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/statistics/expense-by-category', methods=['GET'])
def api_get_expense_by_category():
    """Kategoriya bo'yicha xarajatlar"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        days = int(request.args.get('days', 30))
        categories = get_expense_by_category(user_id, days)
        
        return jsonify(categories)
    except Exception as e:
        print(f"❌ API: Kategoriya bo'yicha xarajatlarni olishda xatolik: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/contacts', methods=['GET'])
def api_get_contacts():
    """Kontaktlar ro'yxatini olish"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        contacts = get_contacts(user_id)
        
        # Datetime ni string ga konvertatsiya qilish
        for c in contacts:
            for key, value in c.items():
                if isinstance(value, datetime):
                    c[key] = value.isoformat()
                elif isinstance(value, type(None)):
                    c[key] = None
        
        return jsonify(contacts)
    except Exception as e:
        print(f"❌ API: Kontaktlarni olishda xatolik: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/contacts', methods=['POST'])
def api_add_contact():
    """Yangi kontakt qo'shish"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        data = request.get_json()
        name = data.get('name')
        phone = data.get('phone')
        notes = data.get('notes')
        
        if not name:
            return jsonify({'error': 'Name majburiy'}), 400
        
        contact_id = add_contact(user_id, name, phone, notes)
        
        if contact_id:
            return jsonify({'success': True, 'id': contact_id}), 201
        else:
            return jsonify({'success': True, 'id': None, 'message': 'Kontakt qo\'shildi (faqat nom bilan)'}), 201
    except Exception as e:
        print(f"❌ API: Kontakt qo'shishda xatolik: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/contacts/<int:contact_id>', methods=['PUT', 'PATCH'])
def api_update_contact(contact_id):
    """Kontaktni yangilash"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        data = request.get_json()
        name = data.get('name')
        phone = data.get('phone')
        notes = data.get('notes')
        
        success = update_contact(user_id, contact_id, name, phone, notes)
        
        if success:
            return jsonify({'success': True, 'message': 'Kontakt yangilandi'})
        else:
            return jsonify({'error': 'Kontakt yangilanmadi'}), 500
    except Exception as e:
        print(f"❌ API: Kontakt yangilashda xatolik: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/contacts/<int:contact_id>', methods=['DELETE'])
def api_delete_contact(contact_id):
    """Kontaktni o'chirish"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        success = delete_contact(user_id, contact_id)
        
        if success:
            return jsonify({'success': True, 'message': 'Kontakt o\'chirildi'})
        else:
            return jsonify({'error': 'Kontakt o\'chirilmadi'}), 500
    except Exception as e:
        print(f"❌ API: Kontakt o'chirishda xatolik: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/debts', methods=['GET'])
def api_get_debts():
    """Qarzlar ro'yxatini olish"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        contact_id = request.args.get('contact_id')
        if contact_id:
            contact_id = int(contact_id)
        
        debts = get_debts(user_id, contact_id)
        
        # Decimal ni float ga konvertatsiya qilish
        for d in debts:
            for key, value in d.items():
                if isinstance(value, Decimal):
                    d[key] = float(value)
                elif isinstance(value, datetime):
                    d[key] = value.isoformat()
                elif isinstance(value, type(None)):
                    d[key] = None
        
        return jsonify(debts)
    except Exception as e:
        print(f"❌ API: Qarzlarni olishda xatolik: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/debts', methods=['POST'])
def api_add_debt():
    """Yangi qarz qo'shish"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        data = request.get_json()
        debt_type = data.get('debt_type')  # 'given' yoki 'taken'
        amount = data.get('amount')
        contact_id = data.get('contact_id')
        person_name = data.get('person_name')
        currency = data.get('currency', 'UZS')
        description = data.get('description')
        due_date = data.get('due_date')
        
        if not debt_type or not amount:
            return jsonify({'error': 'debt_type va amount majburiy'}), 400
        
        if not contact_id and not person_name:
            return jsonify({'error': 'contact_id yoki person_name majburiy'}), 400
        
        debt_id = add_debt(user_id, debt_type, amount, contact_id, person_name, currency, description, due_date)
        
        if debt_id:
            return jsonify({'success': True, 'id': debt_id}), 201
        else:
            return jsonify({'error': 'Qarz qo\'shilmadi'}), 500
    except Exception as e:
        print(f"❌ API: Qarz qo'shishda xatolik: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/debts/<int:debt_id>', methods=['PUT', 'PATCH'])
def api_update_debt(debt_id):
    """Qarzni yangilash"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        data = request.get_json()
        amount = data.get('amount')
        paid_amount = data.get('paid_amount')
        description = data.get('description')
        due_date = data.get('due_date')
        status = data.get('status')
        
        success = update_debt(user_id, debt_id, amount, paid_amount, description, due_date, status)
        
        if success:
            return jsonify({'success': True, 'message': 'Qarz yangilandi'})
        else:
            return jsonify({'error': 'Qarz yangilanmadi'}), 500
    except Exception as e:
        print(f"❌ API: Qarz yangilashda xatolik: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/debts/<int:debt_id>', methods=['DELETE'])
def api_delete_debt(debt_id):
    """Qarzni o'chirish"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        success = delete_debt(user_id, debt_id)
        
        if success:
            return jsonify({'success': True, 'message': 'Qarz o\'chirildi'})
        else:
            return jsonify({'error': 'Qarz o\'chirilmadi'}), 500
    except Exception as e:
        print(f"❌ API: Qarz o'chirishda xatolik: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/debts/<int:debt_id>/reminders', methods=['GET'])
def api_get_debt_reminders(debt_id):
    """Qarz eslatmalarini olish"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        reminders = get_debt_reminders(user_id, debt_id)
        
        # Datetime ni string ga konvertatsiya qilish
        for r in reminders:
            for key, value in r.items():
                if isinstance(value, datetime):
                    r[key] = value.isoformat()
                elif isinstance(value, type(None)):
                    r[key] = None
        
        return jsonify(reminders)
    except Exception as e:
        print(f"❌ API: Qarz eslatmalarini olishda xatolik: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/debts/<int:debt_id>/reminders', methods=['POST'])
def api_add_debt_reminder(debt_id):
    """Qarz uchun eslatma qo'shish"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        data = request.get_json()
        reminder_date = data.get('reminder_date')
        reminder_time = data.get('reminder_time')
        notes = data.get('notes')
        
        if not reminder_date:
            return jsonify({'error': 'reminder_date majburiy'}), 400
        
        reminder_id = add_debt_reminder(user_id, debt_id, reminder_date, reminder_time, notes)
        
        if reminder_id:
            return jsonify({'success': True, 'id': reminder_id}), 201
        else:
            return jsonify({'error': 'Eslatma qo\'shilmadi'}), 500
    except Exception as e:
        print(f"❌ API: Qarz eslatmasi qo'shishda xatolik: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/debts/reminders/<int:reminder_id>', methods=['DELETE'])
def api_delete_debt_reminder(reminder_id):
    """Qarz eslatmasini o'chirish"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        success = delete_debt_reminder(user_id, reminder_id)
        
        if success:
            return jsonify({'success': True, 'message': 'Eslatma o\'chirildi'})
        else:
            return jsonify({'error': 'Eslatma o\'chirilmadi'}), 500
    except Exception as e:
        print(f"❌ API: Qarz eslatmasini o'chirishda xatolik: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/reminders', methods=['GET', 'POST'])
def api_reminders():
    """Eslatmalarni olish va qo'shish"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    if request.method == 'GET':
        try:
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
    
    elif request.method == 'POST':
        try:
            data = request.get_json()
            title = data.get('title')
            amount = data.get('amount')
            currency = data.get('currency', 'UZS')
            reminder_date = data.get('reminder_date')
            repeat_interval = data.get('repeat_interval', 'none')
            
            if not title or not amount or not reminder_date:
                return jsonify({'error': 'Title, amount va reminder_date majburiy'}), 400
            
            success = add_reminder(user_id, title, amount, currency, reminder_date, repeat_interval)
            
            if success:
                return jsonify({'success': True, 'message': 'Eslatma qo\'shildi'}), 201
            else:
                return jsonify({'error': 'Eslatma qo\'shilmadi'}), 500
        except Exception as e:
            print(f"❌ API: Eslatma qo'shishda xatolik: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({'error': str(e)}), 500

@app.route('/api/reminders/<int:reminder_id>', methods=['PATCH'])
def api_update_reminder(reminder_id):
    """Eslatma statusini yangilash"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        data = request.get_json()
        is_completed = data.get('is_completed', False)
        
        success = update_reminder_status(user_id, reminder_id, is_completed)
        
        if success:
            return jsonify({'success': True, 'message': 'Eslatma yangilandi'})
        else:
            return jsonify({'error': 'Eslatma yangilanmadi'}), 500
    except Exception as e:
        print(f"❌ API: Eslatma yangilashda xatolik: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/profile/stats', methods=['GET'])
def api_get_profile_stats():
    """Profile uchun statistika"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        # Tranzaksiyalar soni
        transactions = get_transactions(user_id, limit=1000)
        total_transactions = len(transactions) if transactions else 0
        
        # Balans va statistika
        balance_stats = get_balance_and_statistics(user_id, days=30)
        
        # User ma'lumotlari
        user = get_user(user_id)
        
        registered_at = None
        if user and user.get('created_at'):
            if isinstance(user['created_at'], datetime):
                registered_at = user['created_at'].isoformat()
            else:
                registered_at = str(user['created_at'])
        
        return jsonify({
            'total_transactions': total_transactions,
            'balance': balance_stats['balance'],
            'income': balance_stats['income'],
            'expense': balance_stats['expense'],
            'currency_balances': balance_stats.get('currency_balances', {}),
            'registered_at': registered_at,
            'last_activity': datetime.now().isoformat()
        })
    except Exception as e:
        print(f"❌ API: Profile statistika olishda xatolik: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/profile/payments', methods=['GET'])
def api_get_payments_history():
    """Tarif uchun to'langan pullar tarixi"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        
        # Tarif to'lovlarini olish
        payments = get_subscription_payments(user_id, limit, offset)
        
        # Decimal ni float ga konvertatsiya qilish
        for p in payments:
            for key, value in p.items():
                if isinstance(value, Decimal):
                    p[key] = float(value)
                elif isinstance(value, datetime):
                    p[key] = value.isoformat()
                elif value is None:
                    p[key] = None
        
        return jsonify(payments)
    except Exception as e:
        print(f"❌ API: Tarif to'lovlarini olishda xatolik: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/currency-rates', methods=['GET'])
def api_get_currency_rates():
    """Valyuta kurslarini olish"""
    try:
        rates = {
            'USD': get_currency_rate('USD'),
            'EUR': get_currency_rate('EUR'),
            'RUB': get_currency_rate('RUB'),
            'TRY': get_currency_rate('TRY')
        }
        return jsonify(rates)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Registration API endpoints
@app.route('/api/user/<int:user_id>', methods=['GET'])
def get_user_by_id(user_id):
    """Foydalanuvchi ma'lumotlarini ID bo'yicha olish (registration uchun)"""
    try:
        user = get_user(user_id)
        if not user:
            return jsonify({
                'error': 'User not found',
                'code': 'USER_NOT_FOUND'
            }), 404
        
        # Check if registration is complete
        from database import check_registration_complete
        is_complete = check_registration_complete(user_id)
        
        return jsonify({
            'user_id': user['user_id'],
            'username': user.get('username'),
            'first_name': user.get('first_name'),
            'last_name': user.get('last_name'),
            'phone': user.get('phone'),
            'name': user.get('name', 'Xojayin'),
            'source': user.get('source'),
            'account_type': user.get('account_type'),
            'tariff': user.get('tariff', 'NONE'),
            'registration_complete': is_complete
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/<int:user_id>/update', methods=['POST'])
def update_user_info(user_id):
    """Foydalanuvchi ma'lumotlarini yangilash"""
    try:
        data = request.get_json()
        
        # Validatsiya
        if not data:
            return jsonify({'error': 'Ma\'lumotlar topilmadi'}), 400
        
        # Update user
        success = update_user(
            user_id=user_id,
            name=data.get('name'),
            source=data.get('source'),
            account_type=data.get('account_type')
        )
        
        if not success:
            return jsonify({'error': 'Ma\'lumotlar yangilanmadi'}), 500
        
        return jsonify({
            'success': True,
            'message': 'Ma\'lumotlar yangilandi'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/<int:user_id>/onboarding', methods=['POST'])
def save_onboarding(user_id):
    """Onboarding ma'lumotlarini saqlash"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Ma\'lumotlar topilmadi'}), 400
        
        # Boshlang'ich balansni saqlash
        cash_balance = float(data.get('cash_balance', 0))
        card_balance = float(data.get('card_balance', 0))
        
        if cash_balance > 0 or card_balance > 0:
            success = save_initial_balance(user_id, cash_balance, card_balance)
            if not success:
                return jsonify({'error': 'Balans saqlanmadi'}), 500
        
        # Qarzlarini saqlash
        debts = data.get('debts', [])
        for debt in debts:
            if debt.get('person_name') and debt.get('amount'):
                save_debt(
                    user_id=user_id,
                    person_name=debt['person_name'],
                    amount=float(debt['amount']),
                    direction=debt.get('direction', 'lent'),
                    due_date=debt.get('due_date')
                )
        
        return jsonify({
            'success': True,
            'message': 'Onboarding ma\'lumotlari saqlandi'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/<int:user_id>/tariff', methods=['POST'])
def set_tariff(user_id):
    """Tarif tanlash"""
    try:
        data = request.get_json()
        
        if not data or 'tariff' not in data:
            return jsonify({'error': 'Tarif topilmadi'}), 400
        
        tariff = data['tariff']
        connection = get_db_connection()
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE users SET tariff = %s, updated_at = NOW() WHERE user_id = %s",
                    (tariff, user_id)
                )
                connection.commit()
                return jsonify({
                    'success': True,
                    'message': 'Tarif yangilandi'
                })
        except Exception as e:
            connection.rollback()
            return jsonify({'error': str(e)}), 500
        finally:
            connection.close()
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5003))
    app.run(debug=Config.DEBUG, host='0.0.0.0', port=port)

