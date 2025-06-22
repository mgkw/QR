import os
import cherrypy
import database
import json

class BarcodeScannerApp:
    @cherrypy.expose
    def index(self):
        """عرض الصفحة الرئيسية"""
        return open("templates/index.html", encoding="utf-8").read()

    @cherrypy.expose
    def scan(self):
        """عرض صفحة المسح"""
        return open("templates/scan.html", encoding="utf-8").read()

    @cherrypy.expose
    def get_scanned_barcodes(self):
        """جلب جميع بيانات الباركودات المخزنة في قاعدة البيانات"""
        try:
            barcodes = database.fetch_all_barcodes()
            return json.dumps(barcodes)
        except Exception as e:
            cherrypy.log(f"❌ خطأ في استرجاع الباركودات: {str(e)}")
            return json.dumps({"error": "❌ خطأ في استرجاع البيانات"})

    @cherrypy.expose
    @cherrypy.tools.json_in()
    def update_barcode(self):
        """تحديث بيانات الباركود عند مسحه"""
        data = cherrypy.request.json
        barcode = data.get("barcode")
        status = data.get("status")
        scan_time = data.get("time")

        if barcode and status:
            database.insert_or_update_barcode(barcode, status, scan_time)
            return json.dumps({"message": "✅ تم تحديث الباركود"})
        return json.dumps({"error": "❌ خطأ في التحديث"})

if __name__ == "__main__":
    database.create_database()
    
    # تحديد المسار المطلق لمجلد المشروع
    current_dir = os.path.abspath(os.path.dirname(__file__))

    config = {
        '/': {
            'tools.sessions.on': True,
            'tools.staticdir.root': current_dir,
        },
        '/static': {
            'tools.staticdir.on': True,
            'tools.staticdir.dir': os.path.join(current_dir, 'static')
        }
    }
    
    cherrypy.quickstart(BarcodeScannerApp(), "/", config)