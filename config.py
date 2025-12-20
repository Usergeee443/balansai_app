# Database konfiguratsiyasi
import os
from datetime import timedelta

class Config:
    # MySQL database konfiguratsiyasi
    MYSQL_HOST = os.getenv('MYSQL_HOST', '146.103.126.207')
    MYSQL_USER = os.getenv('MYSQL_USER', 'phpmyadmin')
    MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD', 'PMA_Str0ng!2025')
    MYSQL_DATABASE = os.getenv('MYSQL_DATABASE', 'BalansAiBot')
    MYSQL_PORT = int(os.getenv('MYSQL_PORT', 3306))
    
    # Flask konfiguratsiyasi
    SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key-here-change-in-production')
    # Development uchun default True, production'da .env orqali False qiling
    # Render'da default False bo'ladi
    # Local development uchun True qiling
    DEBUG = os.getenv('DEBUG', 'True').lower() == 'true'
    
    # Telegram Mini App konfiguratsiyasi
    TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')

