from flask import Flask, render_template_string, request, jsonify
import database
import os

app = Flask(__name__)

# قراءة محتوى index.html
def get_index_html():
    try:
        with open('index.html', 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        return '''<!DOCTYPE html>
<html>
<head><title>Error</title></head>
<body><h1>index.html not found</h1></body>
</html>'''

@app.route('/')
def index():
    """عرض الصفحة الرئيسية"""
    return get_index_html()

@app.route('/scan')
def scan():
    """عرض صفحة المسح"""
    try:
        with open('templates/scan.html', 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        return get_index_html()

@app.route('/get_scanned_barcodes', methods=['GET'])
@app.route('/get_barcodes', methods=['GET'])
def get_scanned_barcodes():
    """جلب جميع بيانات الباركودات المخزنة في قاعدة البيانات"""
    try:
        barcodes = database.fetch_all_barcodes()
        return jsonify(barcodes)
    except Exception as e:
        app.logger.error(f"❌ خطأ في استرجاع الباركودات: {str(e)}")
        return jsonify({"error": "❌ خطأ في استرجاع البيانات"}), 500

@app.route('/update_barcode', methods=['POST'])
@app.route('/add_barcode', methods=['POST'])
def update_barcode():
    """تحديث بيانات الباركود عند مسحه"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "❌ لا توجد بيانات"}), 400
            
        barcode = data.get("barcode")
        status = data.get("status", "✅")
        scan_time = data.get("time")

        if barcode:
            database.insert_or_update_barcode(barcode, status, scan_time)
            return jsonify({"message": "✅ تم تحديث الباركود"})
        return jsonify({"error": "❌ خطأ في التحديث"}), 400
    except Exception as e:
        app.logger.error(f"❌ خطأ في تحديث الباركود: {str(e)}")
        return jsonify({"error": "❌ خطأ في التحديث"}), 500

# إنشاء قاعدة البيانات عند بدء التطبيق
with app.app_context():
    database.create_database()

if __name__ == "__main__":
    # إنشاء قاعدة البيانات
    database.create_database()
    
    # تشغيل التطبيق
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False) 