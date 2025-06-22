#!/usr/bin/env python3
"""
Alternative WSGI entry point for QR Scanner
"""
import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, init_database

# Initialize database on startup
init_database()

# WSGI application object
application = app

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False) 