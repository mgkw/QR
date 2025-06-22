document.getElementById('fileInput').addEventListener('change', function(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.getElementById('barcodeCanvas');
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const qrCode = jsQR(imageData.data, canvas.width, canvas.height);
            
            if (qrCode) {
                const { topLeft, topRight, bottomLeft, bottomRight } = qrCode.location;
                ctx.beginPath();
                ctx.moveTo(topLeft.x, topLeft.y);
                ctx.lineTo(topRight.x, topRight.y);
                ctx.lineTo(bottomRight.x, bottomRight.y);
                ctx.lineTo(bottomLeft.x, bottomLeft.y);
                ctx.closePath();
                ctx.lineWidth = 5;
                ctx.strokeStyle = 'red'; // تحديد الباركود باللون الأحمر
                ctx.stroke();
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
});
