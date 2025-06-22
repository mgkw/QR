#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
سكريبت تحديث قاعدة البيانات - إضافة عمود user_id
"""

import sqlite3
import os

DATABASE = 'qr_scanner.db'

def update_database():
    """تحديث قاعدة البيانات بإضافة الأعمدة المفقودة"""
    try:
        print("🔧 بدء تحديث قاعدة البيانات...")
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        # إضافة عمود user_id إذا لم يكن موجوداً
        try:
            cursor.execute('ALTER TABLE scan_results ADD COLUMN user_id INTEGER')
            print("✅ تمت إضافة عمود user_id")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print("ℹ️ عمود user_id موجود بالفعل")
            else:
                print(f"⚠️ خطأ في إضافة user_id: {e}")
        
        # التأكد من وجود أعمدة أخرى
        columns_to_add = [
            ('is_duplicate', 'BOOLEAN DEFAULT 0'),
            ('previous_time', 'TEXT'),
            ('current_time', 'TEXT'),
            ('has_images', 'BOOLEAN DEFAULT 0'),
            ('image_count', 'INTEGER DEFAULT 0')
        ]
        
        for column_name, column_def in columns_to_add:
            try:
                cursor.execute(f'ALTER TABLE scan_results ADD COLUMN {column_name} {column_def}')
                print(f"✅ تمت إضافة عمود {column_name}")
            except sqlite3.OperationalError as e:
                if "duplicate column name" in str(e).lower():
                    print(f"ℹ️ عمود {column_name} موجود بالفعل")
                else:
                    print(f"⚠️ خطأ في إضافة {column_name}: {e}")
        
        # التحقق من بنية الجدول
        columns = cursor.execute("PRAGMA table_info(scan_results)").fetchall()
        print("\n📋 أعمدة جدول scan_results:")
        for col in columns:
            print(f"   - {col[1]} ({col[2]})")
        
        conn.commit()
        conn.close()
        
        print("\n🎉 تم تحديث قاعدة البيانات بنجاح!")
        return True
        
    except Exception as e:
        print(f"❌ خطأ في تحديث قاعدة البيانات: {e}")
        return False

if __name__ == '__main__':
    update_database() 