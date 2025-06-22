import sqlite3

DB_FILE = "inventory.db"

def create_database():
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
    print("✅ قاعدة البيانات جاهزة!")

if __name__ == "__main__":
    create_database()
