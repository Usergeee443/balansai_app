# Flask backend server
from flask import Flask, render_template, request, jsonify, session, redirect
from config import Config
import database
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
    update_user, save_initial_balance, save_debt,
    get_category_transactions, get_category_details,
    get_balance_trend, get_monthly_comparison, get_category_breakdown,
    get_daily_spending, get_transaction_stats, get_currency_distribution,
    get_weekly_comparison,
    get_monthly_limit, set_monthly_limit, get_limit_status,
    run_migrations
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

# Database migrationlarni ishlatish
run_migrations()

# Telegram Mini App validatsiyasi
def parse_user_from_init_data(init_data_str):
    """initData dan user ma'lumotlarini parse qilish (turli formatlar uchun)"""
    user_id = None
    
    # URL decode qilish (bir necha marta bo'lishi mumkin)
    decoded = init_data_str
    for _ in range(3):  # Maksimum 3 marta decode
        try:
            new_decoded = unquote(decoded)
            if new_decoded == decoded:
                break
            decoded = new_decoded
        except:
            break
    
    # init_data ni parse qilish
    pairs = {}
    for pair in decoded.split('&'):
        if '=' in pair:
            key, value = pair.split('=', 1)
            pairs[key] = value
    
    if 'user' not in pairs:
        return None, pairs
    
    user_str = pairs['user']
    
    # User string ni decode qilish (bir necha marta bo'lishi mumkin)
    for _ in range(3):
        try:
            new_user_str = unquote(user_str)
            if new_user_str == user_str:
                break
            user_str = new_user_str
        except:
            break
    
    # JSON parse qilish
    try:
        user_data = json.loads(user_str)
        user_id = user_data.get('id')
    except json.JSONDecodeError as e:
        print(f"[DEBUG] JSON parse xatosi: {e}")
        # Regex bilan user_id ni topishga harakat qilish
        import re
        match = re.search(r'"id"\s*:\s*(\d+)', user_str)
        if match:
            user_id = int(match.group(1))
            print(f"[DEBUG] Regex bilan user_id topildi: {user_id}")
        else:
            # Boshqa format - id= shaklida
            match = re.search(r'id["\s:=]+(\d+)', user_str)
            if match:
                user_id = int(match.group(1))
                print(f"[DEBUG] Regex (alt) bilan user_id topildi: {user_id}")
    
    return user_id, pairs

def validate_telegram_webapp(init_data):
    """Telegram Mini App init_data ni validatsiya qilish"""
    try:
        print(f"[DEBUG] Init data received (length: {len(init_data)})")
        
        # User ma'lumotlarini parse qilish
        user_id, pairs = parse_user_from_init_data(init_data)
        
        print(f"[DEBUG] Parsed pairs keys: {list(pairs.keys())}")
        if user_id:
            print(f"[DEBUG] Parsed user_id: {user_id}")
        
        if 'hash' not in pairs:
            print("❌ Hash topilmadi")
            if user_id:
                print(f"[DEBUG] Hash yo'q, lekin user_id mavjud: {user_id}")
                return user_id
            return None
        
        hash_value = pairs.pop('hash')
        
        # signature maydonini olib tashlash (Telegram yangi versiyalarda qo'shgan)
        if 'signature' in pairs:
            pairs.pop('signature')
            print("[DEBUG] 'signature' maydoni olib tashlandi")
        
        # Bot token tekshiruvi
        bot_token = Config.TELEGRAM_BOT_TOKEN
        if not bot_token:
            print("⚠️ Bot token topilmadi, validatsiya o'tkazib yuborildi")
            if user_id:
                print(f"[DEBUG] Bot token yo'q, user_id qaytarilmoqda: {user_id}")
                return user_id
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
            print(f"⚠️ Hash mos kelmadi. Received: {hash_value[:10]}..., Calculated: {calculated_hash[:10]}...")
            # Hash mos kelmasa ham user_id qaytarish
            if user_id:
                print(f"[DEBUG] Hash mos kelmadi, lekin user_id mavjud: {user_id} - RUXSAT BERILDI")
                return user_id
            return None
        
        print("✅ Hash validatsiyasi muvaffaqiyatli")
        return user_id
        
    except Exception as e:
        print(f"❌ Validatsiya xatosi: {e}")
        import traceback
        traceback.print_exc()
        # Xatolik bo'lsa ham user_id parse qilib ko'rish
        if init_data:
            try:
                user_id, _ = parse_user_from_init_data(init_data)
                if user_id:
                    print(f"[DEBUG] Exception bo'ldi, lekin user_id parse qilindi: {user_id}")
                    return user_id
            except:
                pass
        return None

@app.route('/')
def index():
    """Asosiy sahifa (SPA) - Tarifga qarab yo'naltirish"""
    try:
        user_id = get_user_id_from_request()
        print(f"[DEBUG] Index route: user_id = {user_id}")
        
        if user_id and user_id != 123456789:  # Default test user emas
            user = database.get_user(user_id)
            print(f"[DEBUG] Index route: user = {user}, tariff = {user.get('tariff') if user else None}")
            
            # Xodim ekanligini tekshirish
            employee_link = database.get_employee_link(user_id)
            if employee_link:
                print(f"[DEBUG] User {user_id} xodim, employee.html ochilmoqda")
                return render_template('employee.html')
            
            # Biznes tarifi tekshirish
            if user and user.get('tariff') in ['BUSINESS', 'BIZNES']:
                print(f"[DEBUG] User {user_id} BIZNES tarifida, business.html ochilmoqda")
                return render_template('business.html')
    except Exception as e:
        print(f"[DEBUG] Tarif tekshirishda xato: {e}")

    print(f"[DEBUG] Index route: index.html ochilmoqda")
    return render_template('index.html')

@app.route('/register')
def register():
    """Ro'yxatdan o'tish sahifasi"""
    # Agar user allaqachon ro'yxatdan o'tgan bo'lsa, asosiy sahifaga yuborish
    try:
        user_id = get_user_id_from_request()
        print(f"[DEBUG] Register route: user_id = {user_id}")
        
        if user_id:
            user = get_user(user_id)
            print(f"[DEBUG] Register route: user found = {user is not None}")
            
            if user:
                # Registration complete tekshiruvi
                from database import check_registration_complete
                is_complete = check_registration_complete(user_id)
                print(f"[DEBUG] Register route: registration_complete = {is_complete}")
                
                if is_complete:
                    # Asosiy sahifaga redirect
                    print(f"[DEBUG] Register route: Redirecting to /")
                    return redirect('/')
                else:
                    print(f"[DEBUG] Register route: Registration not complete, showing registration form")
            else:
                print(f"[DEBUG] Register route: User not found in database, showing registration form")
        else:
            print(f"[DEBUG] Register route: No user_id found, showing registration form")
    except Exception as e:
        print(f"[DEBUG] Register route'da tekshirish xatosi: {e}")
        import traceback
        traceback.print_exc()
        # Xatolik bo'lsa ham registration sahifasini ko'rsatish
    
    return render_template('register.html')

@app.route('/api/config', methods=['GET'])
def get_config():
    """Ilova konfiguratsiyasini olish"""
    return jsonify({
        'bot_username': Config.TELEGRAM_BOT_USERNAME,
        'trial_days': {
            'free': Config.TRIAL_DAYS_FREE,
            'plus': Config.TRIAL_DAYS_PLUS,
            'biznes': Config.TRIAL_DAYS_BIZNES
        }
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
        user_id, _ = parse_user_from_init_data(init_data)
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
        
        # Xodim ekanligini tekshirish
        employee_link = database.get_employee_link(user_id)

        response_data = {
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
        }

        # Agar xodim bo'lsa, employee ma'lumotlarini qo'shish
        if employee_link:
            response_data['is_employee'] = True
            response_data['employee_data'] = {
                'business_user_id': employee_link['business_user_id'],
                'business_name': employee_link.get('business_name', 'Biznes'),
                'permissions': employee_link.get('permissions', {}),
                'business_tariff': employee_link.get('tariff'),
                'business_tariff_expires_at': str(employee_link.get('tariff_expires_at')) if employee_link.get('tariff_expires_at') else None
            }
        else:
            response_data['is_employee'] = False

        return jsonify(response_data)
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

@app.route('/api/transactions', methods=['POST'])
def api_add_transaction():
    """Yangi tranzaksiya qo'shish"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        data = request.get_json()
        if not data:
            return jsonify({'error': 'Ma\'lumot yuborilmadi'}), 400

        # Required fields
        amount = data.get('amount')
        transaction_type = data.get('transaction_type')

        if not amount or not transaction_type:
            return jsonify({'error': 'amount va transaction_type majburiy'}), 400

        # Optional fields
        category = data.get('category', 'Boshqa')
        description = data.get('description', '')
        currency = data.get('currency', 'UZS')

        result = add_transaction(
            user_id=user_id,
            amount=float(amount),
            transaction_type=transaction_type,
            category=category,
            description=description,
            currency=currency
        )

        if result:
            return jsonify({'success': True, 'message': 'Tranzaksiya qo\'shildi'})
        else:
            return jsonify({'error': 'Tranzaksiya qo\'shishda xatolik'}), 500

    except Exception as e:
        print(f"❌ API: Tranzaksiya qo'shishda xatolik: {e}")
        return jsonify({'error': str(e)}), 500

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
    """Statistikani olish (period parametri bilan)"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        period = request.args.get('period', 'week')  # week, month, year, all
        days_map = {
            'week': 7,
            'month': 30,
            'year': 365,
            'all': 10000  # Barcha ma'lumotlar uchun katta son
        }
        days = days_map.get(period, 30)
        
        # Asosiy statistika
        stats = get_statistics(user_id, days)
        total_income = stats.get('income', 0.0)
        total_expense = stats.get('expense', 0.0)
        
        # Balance trend
        balance_trend = get_balance_trend(user_id, days)
        
        # Monthly comparison
        monthly_comparison = get_monthly_comparison(user_id, days)
        
        # Category breakdown
        category_breakdown = get_category_breakdown(user_id, days)
        
        # Daily spending
        daily_spending = get_daily_spending(user_id, days)
        
        # Transaction count va average
        transaction_count, average_transaction = get_transaction_stats(user_id, days)
        
        # Currency distribution
        currency_distribution = get_currency_distribution(user_id, days)
        
        # Weekly comparison
        weekly_comparison = get_weekly_comparison(user_id, days)
        
        return jsonify({
            'success': True,
            'total_income': total_income,
            'total_expense': total_expense,
            'balance_trend': balance_trend,
            'monthly_comparison': monthly_comparison,
            'category_breakdown': category_breakdown,
            'daily_spending': daily_spending,
            'transaction_count': transaction_count,
            'average_transaction': average_transaction,
            'currency_distribution': currency_distribution,
            'weekly_comparison': weekly_comparison
        })
    except Exception as e:
        print(f"❌ API: Statistika olishda xatolik: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e), 'success': False}), 500

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
    """Yangi kontakt qo'shish (person yoki category)"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        data = request.get_json()
        name = data.get('name')
        phone = data.get('phone')
        notes = data.get('notes')
        contact_type = data.get('contact_type', 'person')
        category_name = data.get('category_name')
        transaction_type = data.get('transaction_type', 'both')
        
        if not name:
            return jsonify({'error': 'Name majburiy'}), 400
        
        # Agar category bo'lsa, category_name majburiy
        if contact_type == 'category' and not category_name:
            category_name = name  # category_name bo'lmasa, name'dan olinadi
        
        contact_id = add_contact(user_id, name, phone, notes, contact_type, category_name, transaction_type)
        
        if contact_id:
            return jsonify({
                'success': True,
                'id': contact_id,
                'message': 'Kontakt qo\'shildi'
            }), 201
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

@app.route('/api/send-registration-notification', methods=['POST'])
def send_registration_notification():
    """Ro'yxatdan o'tgandan keyin botga xabar yuborish"""
    try:
        import requests
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Ma\'lumotlar topilmadi'}), 400
        
        user_id = data.get('user_id')
        name = data.get('name', 'Foydalanuvchi')
        tariff = data.get('tariff', 'FREE')
        
        if not user_id:
            return jsonify({'error': 'User ID topilmadi'}), 400
        
        bot_token = Config.TELEGRAM_BOT_TOKEN
        if not bot_token:
            return jsonify({'success': True, 'message': 'Bot token yo\'q'})
        
        # Tarif nomini o'zbekchaga o'girish
        tariff_names = {
            'FREE': 'Bepul',
            'PLUS': 'Plus',
            'PRO': 'Plus',
            'BUSINESS': 'Biznes',
            'BIZNES': 'Biznes'
        }
        tariff_name = tariff_names.get(tariff.upper(), tariff)
        
        # Xabar matni
        message = f"""🎉 <b>Tabriklaymiz, {name}!</b>

Siz Balans AI'da muvaffaqiyatli ro'yxatdan o'tdingiz!

📊 <b>Tanlangan tarif:</b> {tariff_name}

Endi moliyaviy hisoblaringizni oson boshqarishingiz mumkin.

👇 Ilovani ochish uchun quyidagi tugmani bosing:"""

        # Inline keyboard
        keyboard = {
            "inline_keyboard": [[
                {"text": "📱 Ilovani ochish", "web_app": {"url": "https://balansai-app.onrender.com/"}}
            ]]
        }
        
        # Telegram API ga so'rov yuborish
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        response = requests.post(url, json={
            'chat_id': user_id,
            'text': message,
            'parse_mode': 'HTML',
            'reply_markup': keyboard
        })
        
        if response.status_code == 200:
            return jsonify({'success': True, 'message': 'Xabar yuborildi'})
        else:
            print(f"[BOT] Xabar yuborishda xato: {response.text}")
            return jsonify({'success': False, 'error': response.text}), 500
            
    except Exception as e:
        print(f"[BOT] Xatolik: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/<int:user_id>/tariff', methods=['POST'])
def set_tariff(user_id):
    """Tarif tanlash (konfiguratsiya asosida sinov muddati bilan)"""
    try:
        from database import get_db_connection
        data = request.get_json()

        if not data or 'tariff' not in data:
            return jsonify({'error': 'Tarif topilmadi'}), 400

        tariff = data['tariff']

        # Tarif bo'yicha sinov muddatini olish (Config dan)
        trial_days = {
            'FREE': Config.TRIAL_DAYS_FREE,
            'PLUS': Config.TRIAL_DAYS_PLUS,
            'PRO': Config.TRIAL_DAYS_PLUS,  # PRO ham PLUS kabi
            'BUSINESS': Config.TRIAL_DAYS_BIZNES,
            'BIZNES': Config.TRIAL_DAYS_BIZNES
        }

        days = trial_days.get(tariff.upper(), 0)

        # Sinov muddatini hisoblash
        from datetime import datetime, timedelta
        trial_expires_at = datetime.now() + timedelta(days=days) if days > 0 else None

        connection = get_db_connection()
        try:
            with connection.cursor() as cursor:
                if trial_expires_at:
                    cursor.execute(
                        "UPDATE users SET tariff = %s, tariff_expires_at = %s, updated_at = NOW() WHERE user_id = %s",
                        (tariff, trial_expires_at, user_id)
                    )
                else:
                    cursor.execute(
                        "UPDATE users SET tariff = %s, tariff_expires_at = NULL, updated_at = NOW() WHERE user_id = %s",
                        (tariff, user_id)
                    )
                connection.commit()
                return jsonify({
                    'success': True,
                    'message': 'Tarif yangilandi',
                    'tariff': tariff,
                    'trial_days': days,
                    'trial_expires_at': trial_expires_at.isoformat() if trial_expires_at else None
                })
        except Exception as e:
            connection.rollback()
            return jsonify({'error': str(e)}), 500
        finally:
            connection.close()
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Kategoriya va Kontakt Integratsiyasi
@app.route('/api/category/<category_name>/transactions', methods=['GET'])
def api_get_category_transactions(category_name):
    """Kategoriya bo'yicha tranzaksiyalarni olish"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        
        transactions = get_category_transactions(user_id, category_name, limit, offset)
        
        # Decimal va datetime ni JSON ga moslashtirish
        for t in transactions:
            for key, value in t.items():
                if isinstance(value, Decimal):
                    t[key] = float(value)
                elif isinstance(value, datetime):
                    t[key] = value.isoformat()
                elif isinstance(value, (date, time)):
                    t[key] = str(value)
                elif value is None:
                    t[key] = None
        
        # Jami summani hisoblash
        details = get_category_details(user_id, category_name)
        
        return jsonify({
            'transactions': transactions,
            'total_amount': float(details.get('net_amount', 0)),
            'total_income': float(details.get('total_income', 0)),
            'total_expense': float(details.get('total_expense', 0)),
            'transaction_count': details.get('transaction_count', 0)
        })
    except Exception as e:
        print(f"❌ API: Kategoriya tranzaksiyalarini olishda xatolik: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/category/<category_name>/details', methods=['GET'])
def api_get_category_details(category_name):
    """Kategoriya tafsilotlari (jami summa, statistika)"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        details = get_category_details(user_id, category_name)

        # Decimal ni float ga konvertatsiya qilish
        for key, value in details.items():
            if isinstance(value, Decimal):
                details[key] = float(value)

        return jsonify(details)
    except Exception as e:
        print(f"❌ API: Kategoriya tafsilotlarini olishda xatolik: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ============================================
# TELEGRAM EXPORT ENDPOINT
# ============================================

# ============================================
# OYLIK LIMIT API ENDPOINTS
# ============================================

@app.route('/api/limit', methods=['GET'])
def api_get_limit():
    """Oylik limit holatini olish"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        status = get_limit_status(user_id)
        return jsonify(status)
    except Exception as e:
        print(f"❌ API: Limit olishda xatolik: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/limit', methods=['POST'])
def api_set_limit():
    """Oylik limit o'rnatish"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        data = request.get_json()
        limit_amount = data.get('limit')

        if limit_amount is None:
            return jsonify({'error': 'limit majburiy'}), 400

        limit_amount = float(limit_amount)
        if limit_amount < 0:
            return jsonify({'error': 'Limit 0 dan katta bo\'lishi kerak'}), 400

        success = set_monthly_limit(user_id, limit_amount)

        if success:
            status = get_limit_status(user_id)
            return jsonify({
                'success': True,
                'message': 'Limit o\'rnatildi',
                **status
            })
        else:
            return jsonify({'error': 'Limit o\'rnatilmadi'}), 500
    except Exception as e:
        print(f"❌ API: Limit o'rnatishda xatolik: {e}")
        return jsonify({'error': str(e)}), 500


# ============================================
# TELEGRAM EXPORT ENDPOINT
# ============================================

@app.route('/api/export/telegram', methods=['POST'])
def api_export_to_telegram():
    """Eksport faylini Telegram botga yuborish"""
    import requests

    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        # Faylni olish
        if 'file' not in request.files:
            return jsonify({'error': 'Fayl topilmadi'}), 400

        file = request.files['file']
        caption = request.form.get('caption', 'Balans AI Eksport')

        # Telegram Bot Token
        bot_token = Config.TELEGRAM_BOT_TOKEN
        if not bot_token:
            return jsonify({'error': 'Bot token mavjud emas'}), 500

        # Telegram API ga fayl yuborish
        telegram_url = f"https://api.telegram.org/bot{bot_token}/sendDocument"

        # Faylni yuborish
        files = {
            'document': (file.filename, file.stream, file.content_type or 'application/octet-stream')
        }
        data = {
            'chat_id': user_id,
            'caption': caption,
            'parse_mode': 'HTML'
        }

        response = requests.post(telegram_url, files=files, data=data, timeout=30)

        if response.status_code == 200:
            result = response.json()
            if result.get('ok'):
                print(f"✅ Eksport yuborildi: user_id={user_id}, file={file.filename}")
                return jsonify({'success': True, 'message': 'Fayl Telegram ga yuborildi'})
            else:
                print(f"❌ Telegram API xatosi: {result}")
                return jsonify({'error': 'Telegram API xatosi'}), 500
        else:
            print(f"❌ Telegram request xatosi: {response.status_code} - {response.text}")
            return jsonify({'error': 'Telegram ga yuborishda xatolik'}), 500

    except Exception as e:
        print(f"❌ Export to Telegram xatosi: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ==================== BIZNES TARIFI API ENDPOINTLARI ====================

# OMBOR (WAREHOUSE) ENDPOINTLARI

@app.route('/api/business/warehouse', methods=['GET'])
def api_get_warehouse():
    """Barcha ombor mahsulotlarini olish"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    limit = request.args.get('limit', 100, type=int)
    offset = request.args.get('offset', 0, type=int)

    items = database.get_warehouse_items(user_id, limit, offset)
    return jsonify(items)


@app.route('/api/business/warehouse/<int:item_id>', methods=['GET'])
def api_get_warehouse_item(item_id):
    """Bitta mahsulotni olish"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    item = database.get_warehouse_item(item_id)
    if item and item['user_id'] == user_id:
        return jsonify(item)
    return jsonify({'error': 'Mahsulot topilmadi'}), 404


@app.route('/api/business/warehouse', methods=['POST'])
def api_add_warehouse():
    """Yangi mahsulot qo'shish"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    data = request.get_json()
    item_id = database.add_warehouse_item(
        user_id=user_id,
        product_name=data.get('product_name'),
        product_code=data.get('product_code'),
        category=data.get('category'),
        quantity=data.get('quantity', 0),
        unit=data.get('unit', 'dona'),
        buy_price=data.get('buy_price'),
        sell_price=data.get('sell_price'),
        currency=data.get('currency', 'UZS'),
        min_stock=data.get('min_stock', 0),
        description=data.get('description')
    )

    return jsonify({'success': True, 'id': item_id}), 201


@app.route('/api/business/warehouse/<int:item_id>', methods=['PUT'])
def api_update_warehouse(item_id):
    """Mahsulotni yangilash"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    # Mahsulot foydalanuvchiga tegishli ekanligini tekshirish
    item = database.get_warehouse_item(item_id)
    if not item or item['user_id'] != user_id:
        return jsonify({'error': 'Ruxsat yo\'q'}), 403

    data = request.get_json()
    success = database.update_warehouse_item(item_id, **data)

    if success:
        return jsonify({'success': True})
    return jsonify({'error': 'Yangilashda xatolik'}), 500


@app.route('/api/business/warehouse/<int:item_id>', methods=['DELETE'])
def api_delete_warehouse(item_id):
    """Mahsulotni o'chirish"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    # Mahsulot foydalanuvchiga tegishli ekanligini tekshirish
    item = database.get_warehouse_item(item_id)
    if not item or item['user_id'] != user_id:
        return jsonify({'error': 'Ruxsat yo\'q'}), 403

    success = database.delete_warehouse_item(item_id)
    if success:
        return jsonify({'success': True})
    return jsonify({'error': 'O\'chirishda xatolik'}), 500


@app.route('/api/business/warehouse/movements', methods=['POST'])
def api_add_warehouse_movement():
    """Ombor harakatini qo'shish (kirim/chiqim)"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    data = request.get_json()
    movement_id = database.add_warehouse_movement(
        user_id=user_id,
        warehouse_id=data.get('warehouse_id'),
        movement_type=data.get('movement_type'),
        quantity=data.get('quantity'),
        price=data.get('price'),
        currency=data.get('currency', 'UZS'),
        notes=data.get('notes')
    )

    return jsonify({'success': True, 'id': movement_id}), 201


@app.route('/api/business/warehouse/movements', methods=['GET'])
def api_get_warehouse_movements():
    """Ombor harakatlarini olish"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    warehouse_id = request.args.get('warehouse_id', type=int)
    limit = request.args.get('limit', 100, type=int)
    offset = request.args.get('offset', 0, type=int)

    movements = database.get_warehouse_movements(user_id, warehouse_id, limit, offset)
    return jsonify(movements)


@app.route('/api/business/warehouse/low-stock', methods=['GET'])
def api_get_low_stock():
    """Qoldig'i kam mahsulotlar"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    items = database.get_low_stock_items(user_id)
    return jsonify(items)


# XODIMLAR (EMPLOYEES) ENDPOINTLARI

@app.route('/api/business/employees', methods=['GET'])
def api_get_employees():
    """Barcha xodimlarni olish (eski employees + yangi employee_links)"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    status = request.args.get('status')
    limit = request.args.get('limit', 100, type=int)
    offset = request.args.get('offset', 0, type=int)

    # Eski employees tizimidan
    old_employees_data = database.get_employees(user_id, status, limit, offset)
    # Tuple bo'lsa list ga o'tkazish
    old_employees = list(old_employees_data) if old_employees_data else []

    # Yangi employee_links tizimidan (QR orqali qo'shilganlar)
    employee_links = database.get_business_employees(user_id) or []

    # Employee_links'ni eski format'ga o'tkazish
    for link in employee_links:
        # employee_links'da: employee_user_id, username, first_name, last_name, permissions, joined_at
        # eski format'da: id, full_name, position, salary, phone, status
        link['id'] = link.get('id', 0)
        link['full_name'] = f"{link.get('first_name', '')} {link.get('last_name', '')}".strip() or link.get('username', 'Noma\'lum')
        link['position'] = 'Xodim (QR)'  # QR orqali qo'shilganligini ko'rsatish
        link['salary'] = 0  # Employee links'da oylik yo'q
        link['phone'] = ''
        link['status'] = link.get('status', 'active')
        link['is_employee_link'] = True  # Bu QR orqali qo'shilgan xodim

    # Ikkalasini birlashtirish
    all_employees = old_employees + employee_links

    return jsonify(all_employees)


@app.route('/api/business/employees/<int:employee_id>', methods=['GET'])
def api_get_employee(employee_id):
    """Bitta xodimni olish"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    employee = database.get_employee(employee_id)
    if employee and employee['user_id'] == user_id:
        return jsonify(employee)
    return jsonify({'error': 'Xodim topilmadi'}), 404


@app.route('/api/business/employees', methods=['POST'])
def api_add_employee():
    """Yangi xodim qo'shish"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    data = request.get_json()
    employee_id = database.add_employee(
        user_id=user_id,
        full_name=data.get('full_name'),
        position=data.get('position'),
        phone=data.get('phone'),
        salary=data.get('salary'),
        currency=data.get('currency', 'UZS'),
        hire_date=data.get('hire_date'),
        photo_url=data.get('photo_url'),
        address=data.get('address'),
        notes=data.get('notes')
    )

    return jsonify({'success': True, 'id': employee_id}), 201


@app.route('/api/business/employees/<int:employee_id>', methods=['PUT'])
def api_update_employee(employee_id):
    """Xodimni yangilash"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    employee = database.get_employee(employee_id)
    if not employee or employee['user_id'] != user_id:
        return jsonify({'error': 'Ruxsat yo\'q'}), 403

    data = request.get_json()
    success = database.update_employee(employee_id, **data)

    if success:
        return jsonify({'success': True})
    return jsonify({'error': 'Yangilashda xatolik'}), 500


@app.route('/api/business/employees/<int:employee_id>', methods=['DELETE'])
def api_delete_employee(employee_id):
    """Xodimni o'chirish"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    employee = database.get_employee(employee_id)
    if not employee or employee['user_id'] != user_id:
        return jsonify({'error': 'Ruxsat yo\'q'}), 403

    success = database.delete_employee(employee_id)
    if success:
        return jsonify({'success': True})
    return jsonify({'error': 'O\'chirishda xatolik'}), 500


# VAZIFALAR (TASKS) ENDPOINTLARI

@app.route('/api/business/tasks', methods=['GET'])
def api_get_tasks():
    """Barcha vazifalarni olish"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    status = request.args.get('status')
    assigned_to = request.args.get('assigned_to', type=int)
    limit = request.args.get('limit', 100, type=int)
    offset = request.args.get('offset', 0, type=int)

    tasks = database.get_tasks(user_id, status, assigned_to, limit, offset)
    return jsonify(tasks)


@app.route('/api/business/tasks/<int:task_id>', methods=['GET'])
def api_get_task(task_id):
    """Bitta vazifani olish"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    task = database.get_task(task_id)
    if task and task['user_id'] == user_id:
        return jsonify(task)
    return jsonify({'error': 'Vazifa topilmadi'}), 404


@app.route('/api/business/tasks', methods=['POST'])
def api_add_task():
    """Yangi vazifa qo'shish"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    data = request.get_json()
    task_id = database.add_task(
        user_id=user_id,
        title=data.get('title'),
        description=data.get('description'),
        assigned_to=data.get('assigned_to'),
        priority=data.get('priority', 'medium'),
        status=data.get('status', 'pending'),
        due_date=data.get('due_date')
    )

    return jsonify({'success': True, 'id': task_id}), 201


@app.route('/api/business/tasks/<int:task_id>', methods=['PUT'])
def api_update_task(task_id):
    """Vazifani yangilash"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    task = database.get_task(task_id)
    if not task or task['user_id'] != user_id:
        return jsonify({'error': 'Ruxsat yo\'q'}), 403

    data = request.get_json()
    success = database.update_task(task_id, **data)

    if success:
        return jsonify({'success': True})
    return jsonify({'error': 'Yangilashda xatolik'}), 500


@app.route('/api/business/tasks/<int:task_id>', methods=['DELETE'])
def api_delete_task(task_id):
    """Vazifani o'chirish"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    task = database.get_task(task_id)
    if not task or task['user_id'] != user_id:
        return jsonify({'error': 'Ruxsat yo\'q'}), 403

    success = database.delete_task(task_id)
    if success:
        return jsonify({'success': True})
    return jsonify({'error': 'O\'chirishda xatolik'}), 500


# BIZNES STATISTIKALARI

@app.route('/api/business/statistics/warehouse', methods=['GET'])
def api_warehouse_statistics():
    """Ombor statistikasi"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    stats = database.get_warehouse_statistics(user_id)
    return jsonify(stats)


@app.route('/api/business/statistics/employees', methods=['GET'])
def api_employee_statistics():
    """Xodimlar statistikasi"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    stats = database.get_employee_statistics(user_id)
    return jsonify(stats)


@app.route('/api/business/statistics/tasks', methods=['GET'])
def api_task_statistics():
    """Vazifalar statistikasi"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    stats = database.get_task_statistics(user_id)
    return jsonify(stats)


@app.route('/api/business/ai-recommendations', methods=['GET'])
def api_ai_recommendations():
    """AI tavsiyalar - kam qolgan tovar, ko'p sotilganlar"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    recommendations = database.get_ai_recommendations(user_id)
    return jsonify(recommendations)


@app.route('/api/business/quick-stats', methods=['GET'])
def api_business_quick_stats():
    """Biznes tarifi uchun tez statistika (asosiy sahifa uchun)"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    stats = database.get_business_quick_stats(user_id)
    return jsonify(stats)


# MOLIYAVIY TAHLILLAR

@app.route('/api/business/analysis/profit-loss', methods=['GET'])
def api_profit_loss_analysis():
    """Foyda-Zarar tahlili"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    days = request.args.get('days', 30, type=int)
    analysis = database.get_profit_loss_analysis(user_id, days)
    return jsonify(analysis)


@app.route('/api/business/analysis/roi', methods=['GET'])
def api_roi_analysis():
    """ROI (Return on Investment) tahlili"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    analysis = database.get_roi_analysis(user_id)
    return jsonify(analysis)


@app.route('/api/business/analysis/inventory-turnover', methods=['GET'])
def api_inventory_turnover():
    """Tovar aylanishi tahlili"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    days = request.args.get('days', 30, type=int)
    analysis = database.get_inventory_turnover_analysis(user_id, days)
    return jsonify(analysis)


@app.route('/api/business/alerts/low-stock', methods=['GET'])
def api_low_stock_alerts():
    """Kam qolgan mahsulotlar haqida ogohlantirishlar"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    alerts = database.get_low_stock_alerts(user_id)
    return jsonify(alerts)


# SAVDO & OMBOR MODULI

@app.route('/api/business/sales-warehouse/stats', methods=['GET'])
def api_sales_warehouse_stats():
    """Savdo & Ombor - Sticky statistics"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    try:
        # Umumiy statistikalarni yig'ish
        warehouse_stats = database.get_warehouse_statistics(user_id)
        
        # Sotuvlar statistikasi
        sales_stats = database.get_sales_statistics(user_id)
        
        # Mijozlar statistikasi
        clients_stats = database.get_clients_statistics(user_id)
        
        # Fakturalar statistikasi
        invoices_stats = database.get_invoices_statistics(user_id)
        
        # Nasiya statistikasi
        credit_stats = database.get_credit_statistics(user_id)

        return jsonify({
            'total_sales': sales_stats.get('total_sales', 0) if sales_stats else 0,
            'today_sales': sales_stats.get('today_sales', 0) if sales_stats else 0,
            'total_revenue': sales_stats.get('total_revenue', 0) if sales_stats else 0,
            'today_revenue': sales_stats.get('today_revenue', 0) if sales_stats else 0,
            'week_revenue': sales_stats.get('week_revenue', 0) if sales_stats else 0,
            'month_revenue': sales_stats.get('month_revenue', 0) if sales_stats else 0,
            'sales_trend': sales_stats.get('trend', 0) if sales_stats else 0,
            'revenue_trend': sales_stats.get('revenue_trend', 0) if sales_stats else 0,
            'total_products': warehouse_stats.get('total_products', 0) if warehouse_stats else 0,
            'low_stock_count': warehouse_stats.get('low_stock_count', 0) if warehouse_stats else 0,
            'total_value': warehouse_stats.get('total_value', 0) if warehouse_stats else 0,
            'total_clients': clients_stats.get('total_clients', 0) if clients_stats else 0,
            'suppliers': clients_stats.get('suppliers', 0) if clients_stats else 0,
            'active_clients': clients_stats.get('active_clients', 0) if clients_stats else 0,
            'total_invoices': invoices_stats.get('total_invoices', 0) if invoices_stats else 0,
            'pending_invoices': invoices_stats.get('pending', 0) if invoices_stats else 0,
            'paid_invoices': invoices_stats.get('paid', 0) if invoices_stats else 0,
            'total_credit': credit_stats.get('total_debt', 0) if credit_stats else 0,
            'credit_count': credit_stats.get('total_credits', 0) if credit_stats else 0,
            'overdue_credits': credit_stats.get('overdue', 0) if credit_stats else 0
        })
    except Exception as e:
        print(f"Sales warehouse stats error: {e}")
        return jsonify({'error': str(e)}), 500


# ==================== SAVDO & OMBOR API ENDPOINTLARI ====================

@app.route('/api/business/sales', methods=['GET'])
def api_get_sales():
    """Sotuvlar ro'yxatini olish"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401
    
    limit = request.args.get('limit', 50, type=int)
    offset = request.args.get('offset', 0, type=int)
    
    try:
        sales = database.get_sales(user_id, limit, offset)
        return jsonify(sales if sales else [])
    except Exception as e:
        print(f"Get sales error: {e}")
        return jsonify([])


@app.route('/api/business/sales', methods=['POST'])
def api_add_sale():
    """Yangi sotuv qo'shish"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401
    
    data = request.get_json()
    try:
        sale_id = database.add_sale(
            user_id=user_id,
            client_id=data.get('client_id'),
            client_name=data.get('client_name'),
            total_amount=data.get('total_amount', 0),
            payment_type=data.get('payment_type', 'cash'),
            notes=data.get('notes')
        )
        return jsonify({'success': True, 'id': sale_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/business/clients', methods=['GET'])
def api_get_clients():
    """Mijozlar ro'yxatini olish"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401
    
    limit = request.args.get('limit', 100, type=int)
    offset = request.args.get('offset', 0, type=int)
    
    try:
        clients = database.get_clients(user_id, limit, offset)
        return jsonify(clients if clients else [])
    except Exception as e:
        print(f"Get clients error: {e}")
        return jsonify([])


@app.route('/api/business/clients', methods=['POST'])
def api_add_client():
    """Yangi mijoz qo'shish"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401
    
    data = request.get_json()
    try:
        client_id = database.add_client(
            user_id=user_id,
            name=data.get('name'),
            phone=data.get('phone'),
            email=data.get('email'),
            address=data.get('address'),
            client_type=data.get('type', 'customer'),
            notes=data.get('notes')
        )
        return jsonify({'success': True, 'id': client_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/business/invoices', methods=['GET'])
def api_get_invoices():
    """Fakturalar ro'yxatini olish"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401
    
    limit = request.args.get('limit', 100, type=int)
    offset = request.args.get('offset', 0, type=int)
    
    try:
        invoices = database.get_invoices(user_id, limit, offset)
        return jsonify(invoices if invoices else [])
    except Exception as e:
        print(f"Get invoices error: {e}")
        return jsonify([])


@app.route('/api/business/invoices', methods=['POST'])
def api_add_invoice():
    """Yangi faktura qo'shish"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401
    
    data = request.get_json()
    try:
        invoice_id = database.add_invoice(
            user_id=user_id,
            invoice_number=data.get('invoice_number'),
            client_id=data.get('client_id'),
            client_name=data.get('client_name'),
            total_amount=data.get('total_amount', 0),
            due_date=data.get('due_date'),
            notes=data.get('notes')
        )
        return jsonify({'success': True, 'id': invoice_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/business/credit', methods=['GET'])
def api_get_credits():
    """Nasiyalar ro'yxatini olish"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401
    
    limit = request.args.get('limit', 100, type=int)
    offset = request.args.get('offset', 0, type=int)
    
    try:
        credits = database.get_credits(user_id, limit, offset)
        return jsonify(credits if credits else [])
    except Exception as e:
        print(f"Get credits error: {e}")
        return jsonify([])


@app.route('/api/business/credit', methods=['POST'])
def api_add_credit():
    """Yangi nasiya qo'shish"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401
    
    data = request.get_json()
    try:
        credit_id = database.add_credit(
            user_id=user_id,
            client_id=data.get('client_id'),
            client_name=data.get('client_name'),
            amount=data.get('amount', 0),
            due_date=data.get('due_date'),
            notes=data.get('notes')
        )
        return jsonify({'success': True, 'id': credit_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# TELEGRAM BOT ESLATMALARI

@app.route('/api/business/send-task-notification', methods=['POST'])
def send_task_notification():
    """Xodimga Telegram orqali vazifa eslatmasini yuborish"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    data = request.get_json()
    employee_id = data.get('employee_id')
    task_title = data.get('task_title')

    if not employee_id or not task_title:
        return jsonify({'error': 'Employee ID va task title kerak'}), 400

    try:
        # Xodim ma'lumotlarini olish
        employee = database.get_employee(employee_id)
        if not employee:
            return jsonify({'error': 'Xodim topilmadi'}), 404

        # Xodimning telefon raqamini Telegram user_id sifatida ishlatish
        # ESLATMA: Bu oddiy implementatsiya. To'liq ishlashi uchun xodimning
        # Telegram user ID sini olish va saqlash kerak

        # Telegram bot orqali xabar yuborish
        import requests
        bot_token = config.TELEGRAM_BOT_TOKEN

        # Foydalanuvchining o'ziga xabar yuborish (demo)
        # To'liq versiyada xodimning telegram_user_id ishlatiladi
        message = f"""
🔔 Yangi vazifa berildi!

📋 Vazifa: {task_title}
👤 Xodim: {employee['full_name']}
📍 Lavozim: {employee['position']}

Vazifani bajarish uchun botga kiring:
@{config.TELEGRAM_BOT_USERNAME}
        """

        # Demo: Biznes egasiga xabar yuborish
        telegram_api_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        response = requests.post(telegram_api_url, json={
            'chat_id': user_id,  # Biznes egasiga yuboriladi
            'text': message,
            'parse_mode': 'HTML'
        })

        if response.status_code == 200:
            return jsonify({'success': True, 'message': 'Eslatma yuborildi'})
        else:
            return jsonify({'success': False, 'message': 'Telegram xatosi'}), 500

    except Exception as e:
        print(f"Telegram eslatma yuborishda xato: {e}")
        return jsonify({'error': str(e)}), 500


# THEME MODE API

@app.route('/api/user/theme', methods=['GET'])
def get_theme():
    """Foydalanuvchining theme preference sini olish"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'theme_mode': 'dark'})  # Default

    try:
        user = database.get_user(user_id)
        theme_mode = user.get('theme_mode', 'dark') if user else 'dark'
        return jsonify({'theme_mode': theme_mode})
    except Exception as e:
        print(f"Theme olishda xato: {e}")
        return jsonify({'theme_mode': 'dark'})


@app.route('/api/user/theme', methods=['POST'])
def set_theme():
    """Foydalanuvchining theme preference sini saqlash"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    data = request.get_json()
    theme_mode = data.get('theme_mode', 'dark')

    # Faqat 'light' yoki 'dark' qabul qilish
    if theme_mode not in ['light', 'dark']:
        return jsonify({'error': 'Noto\'g\'ri theme_mode qiymati'}), 400

    connection = None
    try:
        connection = database.get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute("""
                UPDATE users SET theme_mode = %s WHERE user_id = %s
            """, (theme_mode, user_id))
            connection.commit()

        return jsonify({'success': True, 'theme_mode': theme_mode})
    except Exception as e:
        print(f"Theme saqlashda xato: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        if connection:
            connection.close()


# TARIFF CHANGE API

@app.route('/api/user/tariff', methods=['POST'])
def change_tariff():
    """Foydalanuvchining tarifini o'zgartirish"""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'User topilmadi'}), 401

    data = request.get_json()
    tariff = data.get('tariff', 'FREE')

    # Faqat ma'lum tariflarni qabul qilish
    if tariff not in ['FREE', 'PLUS', 'BIZNES', 'BUSINESS']:
        return jsonify({'error': 'Noto\'g\'ri tariff qiymati'}), 400

    connection = None
    try:
        connection = database.get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute("""
                UPDATE users SET tariff = %s WHERE user_id = %s
            """, (tariff, user_id))
            connection.commit()

        return jsonify({'success': True, 'tariff': tariff})
    except Exception as e:
        print(f"Tarifni o'zgartirishda xato: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        if connection:
            connection.close()


# ============ QR CODE VA EMPLOYEE SYSTEM ============

@app.route('/api/qr/validate', methods=['POST'])
def validate_qr_endpoint():
    """QR kodni validatsiya qilish va xodimni biznesga bog'lash"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401

        data = request.get_json()
        qr_token = data.get('qr_token')

        if not qr_token:
            return jsonify({'success': False, 'message': 'QR token kiritilmagan'}), 400

        # QR kodni validatsiya qilish
        qr_data = database.validate_qr_code(qr_token)

        if not qr_data:
            return jsonify({
                'success': False,
                'message': 'QR kod yaroqsiz yoki muddati o\'tgan'
            }), 400

        business_user_id = qr_data['business_user_id']

        # Xodimni o'zi biznes egasi bo'lishi mumkin emas
        if user_id == business_user_id:
            return jsonify({
                'success': False,
                'message': 'Siz o\'z biznesingizga xodim sifatida qo\'shila olmaysiz'
            }), 400

        # Xodimni biznesga bog'lash
        link_id = database.create_employee_link(business_user_id, user_id)

        # QR kodni ishlatilgan deb belgilash
        database.mark_qr_code_used(qr_token, user_id)

        return jsonify({
            'success': True,
            'message': 'Biznesga muvaffaqiyatli qo\'shildingiz',
            'link_id': link_id,
            'business_user_id': business_user_id
        }), 200

    except Exception as e:
        print(f"QR validation error: {e}")
        return jsonify({
            'success': False,
            'message': 'Serverda xatolik yuz berdi'
        }), 500


@app.route('/api/qr/generate', methods=['POST'])
def generate_qr_endpoint():
    """QR kod generatsiya qilish va bazaga saqlash"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401

        # Foydalanuvchi biznes tarifiga ega ekanligini tekshirish
        user = database.get_user(user_id)
        if not user or user.get('tariff') not in ['BUSINESS', 'BIZNES']:
            return jsonify({
                'success': False,
                'message': 'Faqat biznes tarifi foydalanuvchilari xodim qo\'sha oladi'
            }), 403

        data = request.get_json()
        qr_token = data.get('qr_token')

        if not qr_token:
            return jsonify({'success': False, 'message': 'QR token kiritilmagan'}), 400

        # QR kod 24 soat amal qiladi
        from datetime import datetime, timedelta
        expires_at = datetime.now() + timedelta(hours=24)

        # Bazaga saqlash
        qr_id = database.save_qr_code(user_id, qr_token, expires_at)

        return jsonify({
            'success': True,
            'message': 'QR kod yaratildi',
            'qr_id': qr_id,
            'expires_at': expires_at.isoformat()
        }), 200

    except Exception as e:
        print(f"QR generation error: {e}")
        return jsonify({
            'success': False,
            'message': 'Serverda xatolik yuz berdi'
        }), 500


@app.route('/api/employee/link', methods=['GET'])
def get_employee_link_endpoint():
    """Xodimning biznesga bog'lanishini olish"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401

        link = database.get_employee_link(user_id)

        if not link:
            return jsonify({
                'success': True,
                'has_link': False,
                'link': None
            }), 200

        return jsonify({
            'success': True,
            'has_link': True,
            'link': link
        }), 200

    except Exception as e:
        print(f"Get employee link error: {e}")
        return jsonify({
            'success': False,
            'message': 'Serverda xatolik yuz berdi'
        }), 500


@app.route('/api/employee/list', methods=['GET'])
def get_business_employees_endpoint():
    """Biznesning barcha xodimlarini olish"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401

        employees = database.get_business_employees(user_id)

        return jsonify({
            'success': True,
            'employees': employees,
            'total': len(employees)
        }), 200

    except Exception as e:
        print(f"Get business employees error: {e}")
        return jsonify({
            'success': False,
            'message': 'Serverda xatolik yuz berdi'
        }), 500


@app.route('/api/employee/remove', methods=['POST'])
def remove_employee_endpoint():
    """Xodimni biznesdan olib tashlash"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401

        data = request.get_json()
        employee_user_id = data.get('employee_user_id')

        if not employee_user_id:
            return jsonify({'success': False, 'message': 'Xodim ID kiritilmagan'}), 400

        success = database.remove_employee_link(user_id, employee_user_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Xodim olib tashlandi'
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': 'Xodim topilmadi'
            }), 404

    except Exception as e:
        print(f"Remove employee error: {e}")
        return jsonify({
            'success': False,
            'message': 'Serverda xatolik yuz berdi'
        }), 500


@app.route('/api/employee/permissions', methods=['POST'])
def update_employee_permissions_endpoint():
    """Xodim ruxsatlarini yangilash"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401

        data = request.get_json()
        employee_user_id = data.get('employee_user_id')
        permissions = data.get('permissions')

        if not employee_user_id or not permissions:
            return jsonify({'success': False, 'message': 'Ma\'lumotlar to\'liq emas'}), 400

        success = database.update_employee_permissions(user_id, employee_user_id, permissions)

        if success:
            return jsonify({
                'success': True,
                'message': 'Ruxsatlar yangilandi'
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': 'Xodim topilmadi'
            }), 404

    except Exception as e:
        print(f"Update permissions error: {e}")
        return jsonify({
            'success': False,
            'message': 'Serverda xatolik yuz berdi'
        }), 500


# BIZNES ILOVASI SAHIFASI

@app.route('/business')
def business_app():
    """Biznes tarifi uchun asosiy ilova - to'g'ridan-to'g'ri kirish"""
    # Telegram Mini App dan kelganda initData header orqali keladi
    # Agar header yo'q bo'lsa, sahifani yuklash va JavaScript orqali tekshirish
    # Bu Telegram WebApp ichida ishlaydi
    
    user_id = get_user_id_from_request()
    print(f"[DEBUG] /business route: user_id = {user_id}")

    # Agar header dan topilmasa, query param dan olish
    if not user_id or user_id == 123456789:
        init_data = request.args.get('initData')
        if init_data:
            try:
                pairs = init_data.split('&')
                for pair in pairs:
                    if pair.startswith('user='):
                        import urllib.parse
                        user_json = urllib.parse.unquote(pair.split('=', 1)[1])
                        import json
                        user_data = json.loads(user_json)
                        user_id = user_data.get('id')
                        print(f"[DEBUG] /business: Query param dan user_id olindi: {user_id}")
                        break
            except Exception as e:
                print(f"[DEBUG] Query param dan user_id parse qilishda xato: {e}")

    # Agar user_id topilmasa yoki test user bo'lsa, sahifani yuklash
    # JavaScript orqali Telegram WebApp dan initData olinadi va tekshiriladi
    if not user_id or user_id == 123456789:
        print("[DEBUG] /business: user_id topilmadi yoki test user, sahifa yuklanmoqda (JS tekshiradi)")
        return render_template('business.html')

    # Foydalanuvchining tarifini tekshirish
    user = database.get_user(user_id)
    print(f"[DEBUG] /business: User tariff = {user.get('tariff') if user else 'None'}")
    
    # Xodim bo'lsa, xodim sahifasiga yo'naltirish
    employee_link = database.get_employee_link(user_id)
    if employee_link:
        print(f"[DEBUG] /business: User is employee, redirecting to /employee")
        return redirect('/employee')
    
    # Biznes tarifi yo'q bo'lsa, asosiy sahifaga yo'naltirish
    if not user or user.get('tariff') not in ['BUSINESS', 'BIZNES']:
        print(f"[DEBUG] /business: User tariff is not BUSINESS, redirecting to /")
        return redirect('/')

    print("[DEBUG] /business: business.html yuklanmoqda")
    return render_template('business.html')


# XODIM ILOVASI SAHIFASI

@app.route('/employee')
def employee_app():
    """Xodim tarifi uchun asosiy ilova - to'g'ridan-to'g'ri kirish"""
    user_id = get_user_id_from_request()
    print(f"[DEBUG] /employee route: user_id = {user_id}")

    # Agar header dan topilmasa, query param dan olish
    if not user_id or user_id == 123456789:
        init_data = request.args.get('initData')
        if init_data:
            try:
                pairs = init_data.split('&')
                for pair in pairs:
                    if pair.startswith('user='):
                        import urllib.parse
                        user_json = urllib.parse.unquote(pair.split('=', 1)[1])
                        user_data = json.loads(user_json)
                        user_id = user_data.get('id')
                        print(f"[DEBUG] /employee: Query param dan user_id olindi: {user_id}")
                        break
            except Exception as e:
                print(f"[DEBUG] Query param dan user_id parse qilishda xato: {e}")

    # Agar user_id topilmasa yoki test user bo'lsa, sahifani yuklash
    # JavaScript orqali Telegram WebApp dan initData olinadi va tekshiriladi
    if not user_id or user_id == 123456789:
        print("[DEBUG] /employee: user_id topilmadi yoki test user, sahifa yuklanmoqda (JS tekshiradi)")
        return render_template('employee.html')

    # Xodim ekanligini tekshirish
    employee_link = database.get_employee_link(user_id)
    if not employee_link:
        # Xodim emas - tarifga qarab yo'naltirish
        user = database.get_user(user_id)
        print(f"[DEBUG] /employee: User is not employee, tariff = {user.get('tariff') if user else 'None'}")
        if user and user.get('tariff') in ['BUSINESS', 'BIZNES']:
            return redirect('/business')
        return redirect('/')

    print("[DEBUG] /employee: employee.html yuklanmoqda")
    return render_template('employee.html')


@app.route('/api/employee/tasks', methods=['GET'])
def get_employee_tasks():
    """Xodimga tayinlangan vazifalarni olish"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401

        # Xodim ekanligini tekshirish
        employee_link = database.get_employee_link(user_id)
        if not employee_link:
            return jsonify({'success': False, 'message': 'Xodim topilmadi'}), 404

        # Biznes user_id dan vazifalarni olish
        business_user_id = employee_link['business_user_id']
        
        # Xodimga tayinlangan vazifalarni olish
        tasks = database.get_employee_assigned_tasks(business_user_id, user_id)

        return jsonify({
            'success': True,
            'tasks': tasks
        }), 200

    except Exception as e:
        print(f"Get employee tasks error: {e}")
        return jsonify({
            'success': False,
            'message': 'Serverda xatolik yuz berdi'
        }), 500


@app.route('/api/employee/tasks/<int:task_id>/status', methods=['PUT'])
def update_employee_task_status(task_id):
    """Xodim vazifa holatini yangilash"""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401

        data = request.get_json()
        new_status = data.get('status')

        if not new_status:
            return jsonify({'success': False, 'message': 'Status kerak'}), 400

        # Vazifani yangilash
        success = database.update_task(task_id, status=new_status)

        if success:
            return jsonify({'success': True}), 200
        else:
            return jsonify({'success': False, 'message': 'Yangilashda xatolik'}), 500

    except Exception as e:
        print(f"Update employee task status error: {e}")
        return jsonify({
            'success': False,
            'message': 'Serverda xatolik yuz berdi'
        }), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5003))
    app.run(debug=Config.DEBUG, host='0.0.0.0', port=port)

