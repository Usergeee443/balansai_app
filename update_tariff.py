#!/usr/bin/env python3
"""Test uchun user tarifini BUSINESS ga o'zgartirish"""

import psycopg2
from config import Config

def update_user_tariff(user_id, tariff='BUSINESS'):
    """User tarifini yangilash"""
    try:
        connection = psycopg2.connect(
            host=Config.DB_HOST,
            database=Config.DB_NAME,
            user=Config.DB_USER,
            password=Config.DB_PASSWORD,
            port=Config.DB_PORT
        )

        with connection.cursor() as cursor:
            cursor.execute("""
                UPDATE users
                SET tariff = %s
                WHERE user_id = %s
            """, (tariff, user_id))
            connection.commit()

            print(f"✅ User {user_id} tarifi {tariff} ga o'zgartirildi!")

    except Exception as e:
        print(f"❌ Xatolik: {e}")
    finally:
        if connection:
            connection.close()

if __name__ == '__main__':
    # Test user ID (sizning user_id ingiz)
    USER_ID = 5602148645

    print(f"User {USER_ID} tarifini BUSINESS ga o'zgartirish...")
    update_user_tariff(USER_ID, 'BUSINESS')
