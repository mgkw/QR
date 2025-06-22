import sqlite3
import datetime

DB_FILE = "inventory.db"

def fetch_all_barcodes():
    """إرجاع جميع الباركودات المخزنة في قاعدة البيانات"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT barcode, first_scan, status FROM scanned_barcodes")
    rows = cursor.fetchall()
    conn.close()

    # تحويل البيانات إلى شكل JSON
    return {row[0]: {"firstScanTime": row[1], "status": row[2]} for row in rows}

def create_database():
    """إنشاء قاعدة البيانات إذا لم تكن موجودة"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS scanned_barcodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            barcode TEXT UNIQUE NOT NULL,
            first_scan TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_scan TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT "✅"
        )
    ''')

    conn.commit()
    conn.close()

def insert_or_update_barcode(barcode, status, scan_time):
    """إدخال باركود جديد أو تحديث حالته إذا كان موجودًا"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    cursor.execute("SELECT first_scan, status FROM scanned_barcodes WHERE barcode = ?", (barcode,))
    result = cursor.fetchone()

    if result:
        first_scan_time, current_status = result
        # تحديث فقط إذا تغيرت الحالة
        if current_status != status:
            cursor.execute("UPDATE scanned_barcodes SET last_scan = ?, status = ? WHERE barcode = ?", (scan_time, status, barcode))
    else:
        cursor.execute("INSERT INTO scanned_barcodes (barcode, first_scan, last_scan, status) VALUES (?, ?, ?, ?)",
                       (barcode, scan_time, scan_time, status))

    conn.commit()
    conn.close()