# Database connection va helper funksiyalar
import pymysql
from dbutils.pooled_db import PooledDB
from config import Config
from datetime import datetime, timedelta, date, time
from decimal import Decimal
from typing import Optional, List, Dict, Any
import threading

# Connection Pool yaratish (bitta marta)
_pool = None
_pool_lock = threading.Lock()

def _get_pool():
    """Connection pool ni olish yoki yaratish (singleton pattern)"""
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                try:
                    _pool = PooledDB(
                        creator=pymysql,
                        maxconnections=20,  # Maksimal connectionlar soni
                        mincached=5,  # Minimal cache qilingan connectionlar
                        maxcached=10,  # Maksimal cache qilingan connectionlar
                        maxshared=10,  # Maksimal shared connectionlar
                        blocking=True,  # Connection kutish
                        maxusage=None,  # Har bir connection necha marta ishlatilishi mumkin
                        setsession=[],  # Session sozlamalari
                        ping=1,  # Connection'ni tekshirish (1 = har bir ishlatishdan oldin)
                        host=Config.MYSQL_HOST,
                        user=Config.MYSQL_USER,
                        password=Config.MYSQL_PASSWORD,
                        database=Config.MYSQL_DATABASE,
                        port=Config.MYSQL_PORT,
                        cursorclass=pymysql.cursors.DictCursor,
                        charset='utf8mb4',
                        connect_timeout=5,
                        read_timeout=10,
                        write_timeout=10
                    )
                    print("✅ Connection pool yaratildi")
                except Exception as e:
                    print(f"❌ Connection pool yaratishda xatolik: {e}")
                    raise
    return _pool

def get_db_connection():
    """MySQL database ulanishini pool'dan olish (optimallashtirilgan)"""
    try:
        pool = _get_pool()
        connection = pool.connection()
        return connection
    except pymysql.err.OperationalError as e:
        error_msg = str(e)
        if "Access denied" in error_msg:
            print(f"❌ Database ulanish xatosi: Foydalanuvchi yoki parol noto'g'ri")
            print(f"   Yoki IP manzilingiz ({Config.MYSQL_HOST}) whitelist'da yo'q")
        elif "Can't connect" in error_msg:
            print(f"❌ Database ulanish xatosi: Serverga ulanib bo'lmadi ({Config.MYSQL_HOST}:{Config.MYSQL_PORT})")
        else:
            print(f"❌ Database ulanish xatosi: {error_msg}")
        raise
    except Exception as e:
        print(f"❌ Database ulanish xatosi: {e}")
        raise

def get_user(user_id):
    """Foydalanuvchini ma'lumotlar bazasidan olish"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE user_id = %s", (user_id,))
            return cursor.fetchone()
    except Exception as e:
        print(f"❌ Foydalanuvchini olishda xatolik: {e}")
        return None
    finally:
        connection.close()

def update_user(user_id, name=None, source=None, account_type=None):
    """Foydalanuvchi ma'lumotlarini yangilash"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            updates = []
            params = []
            
            if name is not None:
                updates.append("name = %s")
                params.append(name)
            if source is not None:
                updates.append("source = %s")
                params.append(source)
            if account_type is not None:
                updates.append("account_type = %s")
                params.append(account_type)
            
            if not updates:
                return True
            
            updates.append("updated_at = NOW()")
            params.append(user_id)
            
            query = f"UPDATE users SET {', '.join(updates)} WHERE user_id = %s"
            cursor.execute(query, params)
            connection.commit()
            return True
    except Exception as e:
        print(f"❌ Foydalanuvchi ma'lumotlarini yangilashda xatolik: {e}")
        connection.rollback()
        return False
    finally:
        connection.close()

def save_initial_balance(user_id, cash_balance=0, card_balance=0):
    """Boshlang'ich balansni saqlash"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Naqd pul
            if cash_balance > 0:
                cursor.execute("""
                    INSERT INTO transactions (user_id, transaction_type, amount, category, currency, description)
                    VALUES (%s, 'income', %s, 'boshlang_ich_naqd', 'UZS', 'Boshlang''ich naqd pul')
                """, (user_id, cash_balance))
            
            # Karta balansi
            if card_balance > 0:
                cursor.execute("""
                    INSERT INTO transactions (user_id, transaction_type, amount, category, currency, description)
                    VALUES (%s, 'income', %s, 'boshlang_ich_karta', 'UZS', 'Boshlang''ich karta balansi')
                """, (user_id, card_balance))
            
            # Umumiy boshlang'ich balans
            total_balance = cash_balance + card_balance
            if total_balance > 0:
                cursor.execute("""
                    INSERT INTO transactions (user_id, transaction_type, amount, category, currency, description)
                    VALUES (%s, 'income', %s, 'boshlang_ich_balans', 'UZS', 'Boshlang''ich balans')
                """, (user_id, total_balance))
            
            connection.commit()
            return True
    except Exception as e:
        print(f"❌ Boshlang'ich balansni saqlashda xatolik: {e}")
        connection.rollback()
        return False
    finally:
        connection.close()

def save_debt(user_id, person_name, amount, direction, due_date=None):
    """Qarzni saqlash"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Avval contact yaratish yoki olish
            cursor.execute("SELECT id FROM contacts WHERE user_id = %s AND name = %s", (user_id, person_name))
            contact = cursor.fetchone()
            
            if not contact:
                cursor.execute("""
                    INSERT INTO contacts (user_id, name, created_at)
                    VALUES (%s, %s, NOW())
                """, (user_id, person_name))
                contact_id = cursor.lastrowid
            else:
                contact_id = contact['id']
            
            # Qarzni saqlash
            cursor.execute("""
                INSERT INTO transactions (user_id, transaction_type, amount, category, currency, description, due_date, debt_direction)
                VALUES (%s, 'debt', %s, %s, 'UZS', %s, %s, %s)
            """, (user_id, amount, f'qarz_{direction}', f'Qarz: {person_name}', due_date, direction))
            
            connection.commit()
            return True
    except Exception as e:
        print(f"❌ Qarzni saqlashda xatolik: {e}")
        connection.rollback()
        return False
    finally:
        connection.close()

def check_registration_complete(user_id):
    """Foydalanuvchi ro'yxatdan to'liq o'tganligini tekshirish"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # User ma'lumotlarini olish
            cursor.execute("SELECT name, source, account_type, phone FROM users WHERE user_id = %s", (user_id,))
            user = cursor.fetchone()
            
            if not user:
                print(f"[DEBUG] User {user_id} topilmadi")
                return False
            
            # Asosiy maydonlar to'ldirilganligini tekshirish
            has_name = user.get('name') and user.get('name') != 'Xojayin' and user.get('name') != ''
            has_source = user.get('source') and user.get('source') != ''
            has_account_type = user.get('account_type') and user.get('account_type') != ''
            has_phone = user.get('phone') and user.get('phone') != ''
            
            print(f"[DEBUG] Registration check for user {user_id}:")
            print(f"  - name: {has_name} ({user.get('name')})")
            print(f"  - source: {has_source} ({user.get('source')})")
            print(f"  - account_type: {has_account_type} ({user.get('account_type')})")
            print(f"  - phone: {has_phone} ({user.get('phone')})")
            
            # Agar asosiy maydonlar to'ldirilmagan bo'lsa
            if not (has_name and has_source and has_account_type):
                print(f"[DEBUG] Asosiy maydonlar to'liq emas")
                return False
            
            # Onboarding yakunlanganligini tekshirish (boshlang'ich balans mavjudligi)
            # Lekin agar phone bo'lsa va asosiy maydonlar to'liq bo'lsa, registration complete deb hisoblaymiz
            # (chunki eski userlar uchun boshlang'ich balans bo'lmasligi mumkin)
            if has_phone and has_name and has_source and has_account_type:
                print(f"[DEBUG] User {user_id} ro'yxatdan to'liq o'tgan (phone + asosiy maydonlar)")
                return True
            
            # Agar phone yo'q bo'lsa, boshlang'ich balansni tekshirish
            cursor.execute("""
                SELECT COUNT(*) as count FROM transactions 
                WHERE user_id = %s AND category IN ('boshlang_ich_balans', 'boshlang_ich_naqd', 'boshlang_ich_karta')
            """, (user_id,))
            result = cursor.fetchone()
            has_initial_balance = result.get('count', 0) > 0 if result else False
            
            print(f"[DEBUG] Has initial balance: {has_initial_balance}")
            
            return has_initial_balance
    except Exception as e:
        print(f"❌ Registration complete tekshirishda xatolik: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        connection.close()

# Valyuta kurslari cache (5 daqiqa)
_currency_cache = {}
_currency_cache_time = {}
_CACHE_TTL = 300  # 5 daqiqa

def get_currency_rate(currency_code='UZS'):
    """Valyuta kursini olish (cache bilan optimallashtirilgan)"""
    # Cache tekshirish
    import time
    current_time = time.time()
    
    if currency_code in _currency_cache:
        cache_time = _currency_cache_time.get(currency_code, 0)
        if current_time - cache_time < _CACHE_TTL:
            return _currency_cache[currency_code]
    
    # Cache eskirgan yoki yo'q, database'dan olish
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT rate_to_uzs FROM currency_rates WHERE currency_code = %s", (currency_code,))
            result = cursor.fetchone()
            if result:
                rate = float(result['rate_to_uzs'])
                # Cache'ga saqlash
                _currency_cache[currency_code] = rate
                _currency_cache_time[currency_code] = current_time
                return rate
            # Agar kurs topilmasa, default qiymat
            defaults = {'UZS': 1.0, 'USD': 12750.0, 'EUR': 13800.0, 'RUB': 135.0, 'TRY': 370.0}
            rate = defaults.get(currency_code, 1.0)
            _currency_cache[currency_code] = rate
            _currency_cache_time[currency_code] = current_time
            return rate
    except Exception as e:
        print(f"❌ Valyuta kursini olishda xatolik: {e}")
        defaults = {'UZS': 1.0, 'USD': 12750.0, 'EUR': 13800.0, 'RUB': 135.0, 'TRY': 370.0}
        rate = defaults.get(currency_code, 1.0)
        _currency_cache[currency_code] = rate
        _currency_cache_time[currency_code] = current_time
        return rate
    finally:
        connection.close()

def convert_to_uzs(amount, from_currency):
    """Summani UZS ga konvertatsiya qilish"""
    if from_currency == 'UZS':
        return float(amount)
    rate = get_currency_rate(from_currency)
    return float(amount) * rate

def get_transactions(user_id, limit=50, offset=0, transaction_type=None):
    """Tranzaksiyalarni olish (optimallashtirilgan)"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Faqat kerakli ustunlarni olish (SELECT * o'rniga)
            columns = "id, user_id, transaction_type, amount, currency, category, description, created_at, due_date, debt_direction"
            if transaction_type:
                query = f"SELECT {columns} FROM transactions WHERE user_id = %s AND transaction_type = %s ORDER BY created_at DESC LIMIT %s OFFSET %s"
                cursor.execute(query, (user_id, transaction_type, limit, offset))
            else:
                query = f"SELECT {columns} FROM transactions WHERE user_id = %s ORDER BY created_at DESC LIMIT %s OFFSET %s"
                cursor.execute(query, (user_id, limit, offset))
            return cursor.fetchall()
    except Exception as e:
        print(f"❌ Tranzaksiyalarni olishda xatolik: {e}")
        return []  # Xatolik bo'lsa bo'sh ro'yxat qaytarish
    finally:
        connection.close()

def add_transaction(user_id, transaction_type, amount, currency='UZS', category=None, description=None, due_date=None, debt_direction=None):
    """Yangi tranzaksiya qo'shish"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            query = """INSERT INTO transactions 
                       (user_id, transaction_type, amount, currency, category, description, due_date, debt_direction, created_at)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)"""
            cursor.execute(query, (user_id, transaction_type, amount, currency, category, description, due_date, debt_direction, datetime.now()))
            connection.commit()
            return cursor.lastrowid
    finally:
        connection.close()

def get_currency_balances(user_id):
    """Har bir valyutada qancha pul borligini olish"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    currency,
                    transaction_type,
                    SUM(amount) as total
                FROM transactions 
                WHERE user_id = %s 
                GROUP BY currency, transaction_type
            """, (user_id,))
            results = cursor.fetchall()
            
            # Har bir valyuta uchun balans
            currency_balances = {}
            for row in results:
                currency = row['currency']
                if currency not in currency_balances:
                    currency_balances[currency] = 0.0
                
                if row['transaction_type'] == 'income':
                    currency_balances[currency] += float(row['total'])
                elif row['transaction_type'] == 'expense':
                    currency_balances[currency] -= float(row['total'])
            
            return currency_balances
    except Exception as e:
        print(f"❌ Valyuta balanslarini olishda xatolik: {e}")
        return {}
    finally:
        connection.close()

def get_balance_and_statistics(user_id, days=30):
    """Balans va statistika ni bir vaqtda olish (optimallashtirilgan)"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Barcha tranzaksiyalar uchun balans
            cursor.execute("""
                SELECT 
                    transaction_type,
                    currency,
                    SUM(amount) as total
                FROM transactions 
                WHERE user_id = %s 
                GROUP BY transaction_type, currency
            """, (user_id,))
            all_results = cursor.fetchall()
            
            # Balansni hisoblash va valyuta balanslarini olish
            balance_uzs = 0.0
            currency_balances = {}
            for row in all_results:
                currency = row['currency']
                if currency not in currency_balances:
                    currency_balances[currency] = 0.0
                
                amount = float(row['total'])
                if row['transaction_type'] == 'income':
                    balance_uzs += convert_to_uzs(amount, currency)
                    currency_balances[currency] += amount
                elif row['transaction_type'] == 'expense':
                    balance_uzs -= convert_to_uzs(amount, currency)
                    currency_balances[currency] -= amount
            
            # Oxirgi N kun uchun statistika
            date_from = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days)
            cursor.execute("""
                SELECT 
                    transaction_type,
                    currency,
                    SUM(amount) as total
                FROM transactions 
                WHERE user_id = %s AND created_at >= %s
                GROUP BY transaction_type, currency
            """, (user_id, date_from))
            stats_results = cursor.fetchall()
            
            income = 0.0
            expense = 0.0
            
            for row in stats_results:
                amount_uzs = convert_to_uzs(row['total'], row['currency'])
                if row['transaction_type'] == 'income':
                    income += amount_uzs
                elif row['transaction_type'] == 'expense':
                    expense += amount_uzs
            
            return {
                'balance': balance_uzs,
                'income': income,
                'expense': expense,
                'balance_period': income - expense,
                'days': days,
                'currency_balances': currency_balances
            }
    except Exception as e:
        print(f"❌ Balans va statistika olishda xatolik: {e}")
        return {
            'balance': 0.0,
            'income': 0.0,
            'expense': 0.0,
            'balance_period': 0.0,
            'days': days,
            'currency_balances': {}
        }
    finally:
        connection.close()

def get_balance(user_id):
    """Foydalanuvchining umumiy balansini hisoblash (barcha tranzaksiyalar bo'yicha)"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    transaction_type,
                    currency,
                    SUM(amount) as total
                FROM transactions 
                WHERE user_id = %s 
                GROUP BY transaction_type, currency
            """, (user_id,))
            results = cursor.fetchall()
            
            # Balansni hisoblash
            balance_uzs = 0.0
            for row in results:
                amount_uzs = convert_to_uzs(row['total'], row['currency'])
                if row['transaction_type'] == 'income':
                    balance_uzs += amount_uzs
                elif row['transaction_type'] == 'expense':
                    balance_uzs -= amount_uzs
            
            return balance_uzs
    except Exception as e:
        print(f"❌ Balansni hisoblashda xatolik: {e}")
        return 0.0  # Xatolik bo'lsa 0 qaytarish
    finally:
        connection.close()

def get_statistics(user_id, days=30):
    """Statistika olish (oxirgi N kun uchun)"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Sana hisoblashni to'g'rilash - timedelta ishlatish
            date_from = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days)
            
            cursor.execute("""
                SELECT 
                    transaction_type,
                    currency,
                    SUM(amount) as total
                FROM transactions 
                WHERE user_id = %s AND created_at >= %s
                GROUP BY transaction_type, currency
            """, (user_id, date_from))
            results = cursor.fetchall()
            
            income = 0.0
            expense = 0.0
            
            for row in results:
                amount_uzs = convert_to_uzs(row['total'], row['currency'])
                if row['transaction_type'] == 'income':
                    income += amount_uzs
                elif row['transaction_type'] == 'expense':
                    expense += amount_uzs
            
            return {
                'income': income,
                'expense': expense,
                'balance': income - expense,
                'days': days
            }
    except Exception as e:
        print(f"❌ Statistika olishda xatolik: {e}")
        # Xatolik bo'lsa ham default qiymatlar qaytarish
        return {
            'income': 0.0,
            'expense': 0.0,
            'balance': 0.0,
            'days': days
        }
    finally:
        connection.close()

def get_contacts(user_id):
    """Kontaktlar ro'yxatini olish"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Avval contacts jadvalini tekshiramiz
            try:
                cursor.execute("""
                    SELECT * FROM contacts 
                    WHERE user_id = %s 
                    ORDER BY name ASC
                """, (user_id,))
                contacts = cursor.fetchall()
                if contacts:
                    return contacts
            except:
                # Agar contacts jadvali yo'q bo'lsa, debts'dan kontaktlarni olamiz
                pass
            
            # Debts jadvalidan noyob kontaktlarni olish
            cursor.execute("""
                SELECT DISTINCT person_name as name, 
                       MIN(created_at) as created_at,
                       COUNT(*) as debts_count
                FROM debts 
                WHERE user_id = %s AND person_name IS NOT NULL AND person_name != ''
                GROUP BY person_name
                ORDER BY name ASC
            """, (user_id,))
            results = cursor.fetchall()
            
            # Formatlash
            contacts = []
            for row in results:
                contacts.append({
                    'id': None,
                    'user_id': user_id,
                    'name': row['name'],
                    'phone': None,
                    'notes': None,
                    'created_at': row['created_at'],
                    'debts_count': row['debts_count']
                })
            
            return contacts
    except Exception as e:
        print(f"❌ Kontaktlarni olishda xatolik: {e}")
        return []
    finally:
        connection.close()

def get_contact_by_id(user_id, contact_id):
    """Kontaktni ID bo'yicha olish"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT * FROM contacts 
                WHERE id = %s AND user_id = %s
            """, (contact_id, user_id))
            return cursor.fetchone()
    except Exception as e:
        print(f"❌ Kontaktni olishda xatolik: {e}")
        return None
    finally:
        connection.close()

def add_contact(user_id, name, phone=None, notes=None):
    """Yangi kontakt qo'shish"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Avval contacts jadvalini tekshiramiz
            try:
                query = """INSERT INTO contacts (user_id, name, phone, notes, created_at)
                           VALUES (%s, %s, %s, %s, %s)"""
                cursor.execute(query, (user_id, name, phone, notes, datetime.now()))
                connection.commit()
                return cursor.lastrowid
            except:
                # Agar contacts jadvali yo'q bo'lsa, faqat ID qaytaramiz
                return None
    except Exception as e:
        print(f"❌ Kontakt qo'shishda xatolik: {e}")
        return None
    finally:
        connection.close()

def update_contact(user_id, contact_id, name=None, phone=None, notes=None):
    """Kontaktni yangilash"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            updates = []
            params = []
            
            if name is not None:
                updates.append("name = %s")
                params.append(name)
            if phone is not None:
                updates.append("phone = %s")
                params.append(phone)
            if notes is not None:
                updates.append("notes = %s")
                params.append(notes)
            
            if not updates:
                return False
            
            params.extend([contact_id, user_id])
            query = f"UPDATE contacts SET {', '.join(updates)} WHERE id = %s AND user_id = %s"
            cursor.execute(query, params)
            connection.commit()
            return cursor.rowcount > 0
    except Exception as e:
        print(f"❌ Kontaktni yangilashda xatolik: {e}")
        return False
    finally:
        connection.close()

def delete_contact(user_id, contact_id):
    """Kontaktni o'chirish"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                DELETE FROM contacts 
                WHERE id = %s AND user_id = %s
            """, (contact_id, user_id))
            connection.commit()
            return cursor.rowcount > 0
    except Exception as e:
        print(f"❌ Kontaktni o'chirishda xatolik: {e}")
        return False
    finally:
        connection.close()

def get_debts(user_id, contact_id=None):
    """Qarzlar ro'yxatini olish (kontakt bo'yicha filterlash mumkin)"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            if contact_id:
                # Contact ID bo'yicha qarzlar
                cursor.execute("""
                    SELECT d.*, c.name as contact_name, c.phone as contact_phone
                    FROM debts d
                    LEFT JOIN contacts c ON d.contact_id = c.id
                    WHERE d.user_id = %s AND d.contact_id = %s AND d.status = 'active'
                    ORDER BY d.created_at DESC
                """, (user_id, contact_id))
            else:
                # Barcha qarzlar
                cursor.execute("""
                    SELECT d.*, 
                           COALESCE(c.name, d.person_name) as contact_name,
                           c.phone as contact_phone
                    FROM debts d
                    LEFT JOIN contacts c ON d.contact_id = c.id
                    WHERE d.user_id = %s AND d.status = 'active'
                    ORDER BY d.created_at DESC
                """, (user_id,))
            return cursor.fetchall()
    except Exception as e:
        # Agar contact_id ustuni yo'q bo'lsa, eski usul
        try:
            if contact_id:
                # Person name bo'yicha filterlash
                cursor.execute("""
                    SELECT * FROM debts 
                    WHERE user_id = %s AND person_name = %s AND status = 'active'
                    ORDER BY created_at DESC
                """, (user_id, contact_id))
            else:
                cursor.execute("""
                    SELECT * FROM debts 
                    WHERE user_id = %s AND status = 'active'
                    ORDER BY created_at DESC
                """, (user_id,))
            return cursor.fetchall()
        except Exception as e2:
            print(f"❌ Qarzlarni olishda xatolik: {e2}")
            return []
    finally:
        connection.close()

def get_debt_by_id(user_id, debt_id):
    """Qarzni ID bo'yicha olish"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT d.*, 
                       COALESCE(c.name, d.person_name) as contact_name,
                       c.phone as contact_phone
                FROM debts d
                LEFT JOIN contacts c ON d.contact_id = c.id
                WHERE d.id = %s AND d.user_id = %s
            """, (debt_id, user_id))
            return cursor.fetchone()
    except:
        try:
            cursor.execute("""
                SELECT * FROM debts 
                WHERE id = %s AND user_id = %s
            """, (debt_id, user_id))
            return cursor.fetchone()
        except Exception as e:
            print(f"❌ Qarzni olishda xatolik: {e}")
            return None
    finally:
        connection.close()

def add_debt(user_id, debt_type, amount, contact_id=None, person_name=None, currency='UZS', description=None, due_date=None):
    """Yangi qarz qo'shish"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Contact name ni olish
            contact_name = person_name
            if contact_id:
                contact = get_contact_by_id(user_id, contact_id)
                if contact:
                    contact_name = contact.get('name')
            
            # Contact ID yoki person_name bo'yicha qarz qo'shish
            try:
                query = """INSERT INTO debts 
                           (user_id, debt_type, amount, paid_amount, contact_id, person_name, currency, description, due_date, status, created_at, updated_at)
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"""
                cursor.execute(query, (user_id, debt_type, amount, 0, contact_id, contact_name, currency, description, due_date, 'active', datetime.now(), datetime.now()))
            except:
                # Agar contact_id ustuni yo'q bo'lsa
                query = """INSERT INTO debts 
                           (user_id, debt_type, amount, paid_amount, person_name, currency, description, due_date, status, created_at, updated_at)
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"""
                cursor.execute(query, (user_id, debt_type, amount, 0, contact_name, currency, description, due_date, 'active', datetime.now(), datetime.now()))
            
            connection.commit()
            return cursor.lastrowid
    except Exception as e:
        print(f"❌ Qarz qo'shishda xatolik: {e}")
        return None
    finally:
        connection.close()

def update_debt(user_id, debt_id, amount=None, paid_amount=None, description=None, due_date=None, status=None):
    """Qarzni yangilash"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            updates = []
            params = []
            
            if amount is not None:
                updates.append("amount = %s")
                params.append(amount)
            if paid_amount is not None:
                updates.append("paid_amount = %s")
                params.append(paid_amount)
            if description is not None:
                updates.append("description = %s")
                params.append(description)
            if due_date is not None:
                updates.append("due_date = %s")
                params.append(due_date)
            if status is not None:
                updates.append("status = %s")
                params.append(status)
            
            if not updates:
                return False
            
            updates.append("updated_at = %s")
            params.append(datetime.now())
            params.extend([debt_id, user_id])
            
            query = f"UPDATE debts SET {', '.join(updates)} WHERE id = %s AND user_id = %s"
            cursor.execute(query, params)
            connection.commit()
            return cursor.rowcount > 0
    except Exception as e:
        print(f"❌ Qarzni yangilashda xatolik: {e}")
        return False
    finally:
        connection.close()

def delete_debt(user_id, debt_id):
    """Qarzni o'chirish (yoki status'ni 'deleted' qilish)"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Status'ni 'deleted' qilish (soft delete)
            cursor.execute("""
                UPDATE debts 
                SET status = 'deleted', updated_at = %s
                WHERE id = %s AND user_id = %s
            """, (datetime.now(), debt_id, user_id))
            connection.commit()
            return cursor.rowcount > 0
    except Exception as e:
        print(f"❌ Qarzni o'chirishda xatolik: {e}")
        return False
    finally:
        connection.close()

def get_debt_reminders(user_id, debt_id=None):
    """Qarz eslatmalarini olish"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            if debt_id:
                cursor.execute("""
                    SELECT * FROM debt_reminders 
                    WHERE user_id = %s AND debt_id = %s
                    ORDER BY reminder_date ASC
                """, (user_id, debt_id))
            else:
                cursor.execute("""
                    SELECT * FROM debt_reminders 
                    WHERE user_id = %s
                    ORDER BY reminder_date ASC
                """, (user_id,))
            return cursor.fetchall()
    except:
        # Agar debt_reminders jadvali yo'q bo'lsa
        return []
    finally:
        connection.close()

def add_debt_reminder(user_id, debt_id, reminder_date, reminder_time=None, notes=None):
    """Qarz uchun eslatma qo'shish"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            query = """INSERT INTO debt_reminders 
                       (user_id, debt_id, reminder_date, reminder_time, notes, is_completed, created_at)
                       VALUES (%s, %s, %s, %s, %s, FALSE, %s)"""
            cursor.execute(query, (user_id, debt_id, reminder_date, reminder_time, notes, datetime.now()))
            connection.commit()
            return cursor.lastrowid
    except Exception as e:
        print(f"❌ Qarz eslatmasi qo'shishda xatolik: {e}")
        return None
    finally:
        connection.close()

def delete_debt_reminder(user_id, reminder_id):
    """Qarz eslatmasini o'chirish"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                DELETE FROM debt_reminders 
                WHERE id = %s AND user_id = %s
            """, (reminder_id, user_id))
            connection.commit()
            return cursor.rowcount > 0
    except Exception as e:
        print(f"❌ Qarz eslatmasini o'chirishda xatolik: {e}")
        return False
    finally:
        connection.close()

def get_reminders(user_id, limit=20):
    """Eslatmalarni olish"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT * FROM reminders 
                WHERE user_id = %s
                ORDER BY is_completed ASC, reminder_date ASC, reminder_time ASC
                LIMIT %s
            """, (user_id, limit))
            return cursor.fetchall()
    except Exception as e:
        print(f"❌ Eslatmalarni olishda xatolik: {e}")
        return []
    finally:
        connection.close()

def add_reminder(user_id, title, amount, currency, reminder_date, repeat_interval='none'):
    """Yangi eslatma qo'shish"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO reminders 
                (user_id, title, amount, currency, reminder_date, repeat_interval, is_completed)
                VALUES (%s, %s, %s, %s, %s, %s, FALSE)
            """, (user_id, title, amount, currency, reminder_date, repeat_interval))
            connection.commit()
            return True
    except Exception as e:
        print(f"❌ Eslatma qo'shishda xatolik: {e}")
        connection.rollback()
        return False
    finally:
        connection.close()

def update_reminder_status(user_id, reminder_id, is_completed):
    """Eslatma statusini yangilash"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                UPDATE reminders 
                SET is_completed = %s
                WHERE id = %s AND user_id = %s
            """, (is_completed, reminder_id, user_id))
            connection.commit()
            return True
    except Exception as e:
        print(f"❌ Eslatma yangilashda xatolik: {e}")
        connection.rollback()
        return False
    finally:
        connection.close()

def get_income_trend(user_id, period='auto'):
    """
    Daromad dinamikasini olish
    period: 'day' (kunlar), 'month' (oylar), 'year' (yillar), 'auto' (avtomatik)
    """
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Avval birinchi tranzaksiya sanasini topamiz
            cursor.execute("""
                SELECT MIN(DATE(created_at)) as first_date, MAX(DATE(created_at)) as last_date
                FROM transactions 
                WHERE user_id = %s AND transaction_type = 'income'
            """, (user_id,))
            date_range = cursor.fetchone()
            
            if not date_range or not date_range['first_date']:
                return {'period': 'day', 'labels': [], 'data': []}
            
            first_date = date_range['first_date']
            last_date = date_range['last_date']
            # Date obyektlarini tekshirish
            if isinstance(first_date, datetime):
                first_date = first_date.date()
            if isinstance(last_date, datetime):
                last_date = last_date.date()
            days_diff = (last_date - first_date).days if first_date and last_date else 0
            
            # Avtomatik period aniqlash
            if period == 'auto':
                if days_diff <= 30:
                    period = 'day'
                elif days_diff <= 365:
                    period = 'month'
                else:
                    period = 'year'
            
            # Period bo'yicha GROUP BY
            if period == 'day':
                date_format = '%Y-%m-%d'
                cursor.execute("""
                    SELECT 
                        DATE(created_at) as period_date,
                        SUM(amount) as total,
                        currency
                    FROM transactions 
                    WHERE user_id = %s AND transaction_type = 'income'
                    GROUP BY DATE(created_at), currency
                    ORDER BY period_date ASC
                """, (user_id,))
            elif period == 'month':
                date_format = '%Y-%m'
                cursor.execute("""
                    SELECT 
                        DATE_FORMAT(created_at, '%%Y-%%m') as period_date,
                        SUM(amount) as total,
                        currency
                    FROM transactions 
                    WHERE user_id = %s AND transaction_type = 'income'
                    GROUP BY DATE_FORMAT(created_at, '%%Y-%%m'), currency
                    ORDER BY period_date ASC
                """, (user_id,))
            else:  # year
                date_format = '%Y'
                cursor.execute("""
                    SELECT 
                        YEAR(created_at) as period_date,
                        SUM(amount) as total,
                        currency
                    FROM transactions 
                    WHERE user_id = %s AND transaction_type = 'income'
                    GROUP BY YEAR(created_at), currency
                    ORDER BY period_date ASC
                """, (user_id,))
            
            results = cursor.fetchall()
            
            # Ma'lumotlarni guruhlash
            period_data = {}
            for row in results:
                period_key = str(row['period_date'])
                if period_key not in period_data:
                    period_data[period_key] = 0.0
                amount_uzs = convert_to_uzs(row['total'], row['currency'])
                period_data[period_key] += amount_uzs
            
            # Label va data array'larni yaratish
            labels = sorted(period_data.keys())
            data = [period_data[label] for label in labels]
            
            return {
                'period': period,
                'labels': labels,
                'data': data
            }
    except Exception as e:
        print(f"❌ Daromad dinamikasini olishda xatolik: {e}")
        return {'period': 'day', 'labels': [], 'data': []}
    finally:
        connection.close()

def get_top_expense_categories(user_id, limit=5, days=30):
    """Top eng ko'p xarajat qilinadigan kategoriyalar"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            date_from = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days)
            cursor.execute("""
                SELECT 
                    category,
                    currency,
                    SUM(amount) as total
                FROM transactions 
                WHERE user_id = %s AND transaction_type = 'expense' 
                    AND created_at >= %s
                    AND category IS NOT NULL
                    AND category != ''
                GROUP BY category, currency
                ORDER BY total DESC
                LIMIT %s
            """, (user_id, date_from, limit))
            results = cursor.fetchall()
            
            categories = []
            for row in results:
                amount_uzs = convert_to_uzs(row['total'], row['currency'])
                categories.append({
                    'category': row['category'],
                    'amount': amount_uzs,
                    'amount_original': float(row['total']),
                    'currency': row['currency']
                })
            
            return categories
    except Exception as e:
        print(f"❌ Top kategoriyalarni olishda xatolik: {e}")
        return []
    finally:
        connection.close()

def get_expense_by_category(user_id, days=30):
    """Kategoriya bo'yicha xarajatlar taqsimoti"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            date_from = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days)
            cursor.execute("""
                SELECT 
                    COALESCE(category, 'Boshqa') as category,
                    currency,
                    SUM(amount) as total
                FROM transactions 
                WHERE user_id = %s AND transaction_type = 'expense' 
                    AND created_at >= %s
                GROUP BY category, currency
                ORDER BY total DESC
            """, (user_id, date_from))
            results = cursor.fetchall()
            
            categories = {}
            for row in results:
                category = row['category'] or 'Boshqa'
                if category not in categories:
                    categories[category] = 0.0
                amount_uzs = convert_to_uzs(row['total'], row['currency'])
                categories[category] += amount_uzs
            
            return categories
    except Exception as e:
        print(f"❌ Kategoriya bo'yicha xarajatlarni olishda xatolik: {e}")
        return {}
    finally:
        connection.close()

def get_subscription_payments(user_id, limit=50, offset=0):
    """Tarif uchun to'langan pullarni olish"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Avval subscription_payments jadvalini tekshiramiz
            # Agar yo'q bo'lsa, transactions jadvalidan tarif to'lovlarini olamiz
            
            # Subscription payments jadvalini tekshirish
            try:
                cursor.execute("""
                    SELECT id, user_id, amount, currency, description, created_at, payment_method, status
                    FROM subscription_payments 
                    WHERE user_id = %s 
                    ORDER BY created_at DESC 
                    LIMIT %s OFFSET %s
                """, (user_id, limit, offset))
                results = cursor.fetchall()
                if results and len(results) > 0:
                    return results
            except Exception as e:
                # Agar subscription_payments jadvali yo'q bo'lsa, transactions'dan olamiz
                print(f"[DEBUG] subscription_payments jadvali topilmadi, transactions'dan olinmoqda: {e}")
                pass
            
            # Transactions jadvalidan tarif to'lovlarini olish
            # Category yoki description'da "tarif", "subscription", "payment" so'zlari bo'lsa
            cursor.execute("""
                SELECT 
                    id, user_id, amount, currency, 
                    COALESCE(description, category, 'Tarif to\'lovi') as description, 
                    created_at,
                    NULL as payment_method, 
                    'completed' as status
                FROM transactions 
                WHERE user_id = %s 
                    AND (
                        (category IS NOT NULL AND (
                            LOWER(category) LIKE '%%tarif%%' 
                            OR LOWER(category) LIKE '%%subscription%%'
                            OR LOWER(category) LIKE '%%payment%%'
                            OR category = 'Tarif'
                            OR category = 'Subscription'
                        ))
                        OR (description IS NOT NULL AND (
                            LOWER(description) LIKE '%%tarif%%'
                            OR LOWER(description) LIKE '%%subscription%%'
                            OR LOWER(description) LIKE '%%to\'lov%%'
                        ))
                    )
                ORDER BY created_at DESC 
                LIMIT %s OFFSET %s
            """, (user_id, limit, offset))
            
            return cursor.fetchall()
    except Exception as e:
        print(f"❌ Tarif to'lovlarini olishda xatolik: {e}")
        import traceback
        traceback.print_exc()
        return []
    finally:
        connection.close()
