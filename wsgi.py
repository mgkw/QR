#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WSGI entry point for QR Scanner Python Flask Application
"""

from app import app, init_database
import os

# إنشاء قاعدة البيانات عند التشغيل
init_database()

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False) 