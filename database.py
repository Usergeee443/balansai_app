# Database connection va helper funksiyalar
import pymysql
from config import Config
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional, List, Dict, Any

def get_db_connection():
    """MySQL database ulanishini olish"""
    try:
        connection = pymysql.connect(
            host=Config.MYSQL_HOST,
            user=Config.MYSQL_USER,
            password=Config.MYSQL_PASSWORD,
            database=Config.MYSQL_DATABASE,
            port=Config.MYSQL_PORT,
            cursorclass=pymysql.cursors.DictCursor,
            charset='utf8mb4',
            connect_timeout=5,
            read_timeout=5,
            write_timeout=5
        )
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

def get_currency_rate(currency_code='UZS'):
    """Valyuta kursini olish"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT rate_to_uzs FROM currency_rates WHERE currency_code = %s", (currency_code,))
            result = cursor.fetchone()
            if result:
                return float(result['rate_to_uzs'])
            # Agar kurs topilmasa, default qiymat
            defaults = {'UZS': 1.0, 'USD': 12750.0, 'EUR': 13800.0, 'RUB': 135.0, 'TRY': 370.0}
            return defaults.get(currency_code, 1.0)
    except Exception as e:
        print(f"❌ Valyuta kursini olishda xatolik: {e}")
        defaults = {'UZS': 1.0, 'USD': 12750.0, 'EUR': 13800.0, 'RUB': 135.0, 'TRY': 370.0}
        return defaults.get(currency_code, 1.0)
    finally:
        connection.close()

def convert_to_uzs(amount, from_currency):
    """Summani UZS ga konvertatsiya qilish"""
    if from_currency == 'UZS':
        return float(amount)
    rate = get_currency_rate(from_currency)
    return float(amount) * rate

def get_transactions(user_id, limit=50, offset=0, transaction_type=None):
    """Tranzaksiyalarni olish"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            if transaction_type:
                query = "SELECT * FROM transactions WHERE user_id = %s AND transaction_type = %s ORDER BY created_at DESC LIMIT %s OFFSET %s"
                cursor.execute(query, (user_id, transaction_type, limit, offset))
            else:
                query = "SELECT * FROM transactions WHERE user_id = %s ORDER BY created_at DESC LIMIT %s OFFSET %s"
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

def get_debts(user_id):
    """Qarzlar ro'yxatini olish"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT * FROM debts 
                WHERE user_id = %s AND status = 'active'
                ORDER BY created_at DESC
            """, (user_id,))
            return cursor.fetchall()
    except Exception as e:
        print(f"❌ Qarzlarni olishda xatolik: {e}")
        return []
    finally:
        connection.close()

def add_debt(user_id, debt_type, amount, person_name, due_date=None):
    """Yangi qarz qo'shish"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            query = """INSERT INTO debts 
                       (user_id, debt_type, amount, paid_amount, person_name, due_date, status, created_at, updated_at)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)"""
            cursor.execute(query, (user_id, debt_type, amount, 0, person_name, due_date, 'active', datetime.now(), datetime.now()))
            connection.commit()
            return cursor.lastrowid
    finally:
        connection.close()

def get_reminders(user_id, limit=20):
    """Eslatmalarni olish"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT * FROM reminders 
                WHERE user_id = %s AND is_completed = FALSE
                ORDER BY reminder_date ASC, reminder_time ASC
                LIMIT %s
            """, (user_id, limit))
            return cursor.fetchall()
    except Exception as e:
        print(f"❌ Eslatmalarni olishda xatolik: {e}")
        return []  # Xatolik bo'lsa bo'sh ro'yxat qaytarish
    finally:
        connection.close()
