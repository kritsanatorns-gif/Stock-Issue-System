# รูปสินค้าผ่าน IIS Virtual Directory

ตั้งใต้เว็บ API StockIssueSystemApi พอร์ต 96:
- Alias: StockIssueSystemimg
- Physical path: \\pluto\data\PictureCenter\Supplyes\Express
- Connect as: บัญชี Windows ที่อ่านแชร์นี้ได้ ต้องมีสิทธิ์ทั้ง Share และ NTFS
- เปิดใช้ IIS Static Content และ Anonymous Authentication ตามการตั้งค่าของไซต์

Publish API พร้อม web.config ใหม่ ซึ่งยกเว้น handler aspNetCore เฉพาะพาธ StockIssueSystemimg ให้ IIS ส่งไฟล์โดยตรง ไม่ต้องวาง web.config ในแชร์

Build frontend ใหม่: .env.production กำหนด VITE_PRODUCT_IMAGE_BASE_URL=http://192.168.0.13:96/StockIssueSystemimg
หน้าสินค้า คลัง และขอเบิกใช้ URL เดียวกัน รองรับชื่อไฟล์และพาธ /uploads/products/ เดิมในฐานข้อมูล ไม่ต้องแก้ฐานข้อมูล

ทดสอบ http://192.168.0.13:96/StockIssueSystemimg/101.png ต้องได้ HTTP 200 และ Content-Type image/png ไม่ใช่ text/html
หากได้ 500 ให้เปิด URL บนเซิร์ฟเวอร์และตรวจ IIS Detailed Error / log เพื่อดู substatus และ HRESULT ก่อนแก้สิทธิ์หรือ config

Virtual Directory ใช้สำหรับอ่านรูปเท่านั้น การอัปโหลดยังส่งผ่าน API ไปยัง ProductImages:Path บัญชี Application Pool จึงยังต้องมีสิทธิ์เขียนแชร์ Connect as ของ Virtual Directory ไม่ได้ให้สิทธิ์แก่โค้ดอัปโหลดโดยอัตโนมัติ
