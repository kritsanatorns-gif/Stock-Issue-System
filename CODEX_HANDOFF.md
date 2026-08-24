# Stock Issue System — เอกสารส่งต่องาน

เอกสารนี้ใช้สำหรับย้ายงานไปเครื่องใหม่หรือส่งต่อให้ Codex คน/เครื่องอื่นอ่านก่อนเริ่มแก้ไข

## ภาพรวม

ระบบจัดการคลังสินค้าและการเบิกสินค้าในองค์กร แบ่งเป็น 2 ฝั่ง

| ฝั่ง | หน้าที่ |
| --- | --- |
| HR / เจ้าหน้าที่คลัง | จัดการสินค้า รับเข้า FIFO ปรับสต๊อก จัดคำขอเบิก รายงาน ผู้ขาย พนักงาน และแผนก |
| ผู้ขอเบิก | เข้าด้วยแผนก/รหัสพนักงาน ค้นหาสินค้า ส่งคำขอเบิก และติดตามสถานะ |

## โครงสร้างโปรเจกต์

```text
backend/src/StockIssueSystem.Api/  # ASP.NET Core Web API (.NET 8)
frontend/                          # React + Vite + MUI
frontend/src/request/               # หน้าผู้ขอเบิก
frontend/src/layouts/               # Layout หน้า Login HR
```

## เทคโนโลยี

- Backend: ASP.NET Core `net8.0`, Entity Framework Core 8, SQL Server
- Frontend: React 19, Vite, Material UI, Zustand, Axios
- Server: IIS

## การเชื่อมต่อ API

### เครื่องพัฒนา

ไฟล์ `frontend/.env`

```env
VITE_API_USE_SERVER=false
VITE_LOCAL_API_BASE_URL=http://localhost:5208/api
VITE_SERVER_API_BASE_URL=http://192.168.0.13:96/api
```

เปลี่ยน `VITE_API_USE_SERVER` เป็น `true` เมื่อต้องการทดสอบกับ API บนเซิร์ฟเวอร์ แล้ว restart `npm run dev`

### Production

ไฟล์ `frontend/.env.production` ถูกตั้งให้ใช้ API บนเซิร์ฟเวอร์อัตโนมัติ

```text
Frontend: http://192.168.0.13:9400
Backend:  http://192.168.0.13:96/api
Health:   http://192.168.0.13:96/api/health
```

> ห้ามใช้พอร์ต 95 จาก Browser เพราะ Chrome/Edge บล็อกเป็น unsafe port. ปัจจุบันเปลี่ยน API เป็นพอร์ต 96 แล้ว

## การ Build และ Deploy

### Backend

```powershell
dotnet publish backend/src/StockIssueSystem.Api/StockIssueSystem.Api.csproj -c Release -o backend/publish
```

นำไฟล์ทั้งหมดจาก `backend/publish` ไปทับ Physical Path ของ IIS API แล้ว Restart Site

ข้อกำหนด IIS:

- Application Pool: `No Managed Code`, Integrated pipeline
- Server ต้องมี ASP.NET Core Hosting Bundle 8
- IIS Binding API: port 96
- เปิด Firewall TCP 96

### Frontend

```powershell
cd frontend
npm run build
```

นำไฟล์ทั้งหมดจาก `frontend/dist` ไปทับ Physical Path ของ IIS เว็บพอร์ต 9400 แล้ว Restart Site

ต้องนำ `web.config` ที่อยู่ใน `frontend/dist` ขึ้นไปด้วย เพราะใช้รองรับ React routes เช่น `/login`, `/request`, `/dashboard`

## ระบบที่ทำแล้ว

### คลังสินค้า / HR

- Dashboard และกราฟแนวโน้ม
- สินค้าและหมวดหมู่สินค้า พร้อม Import/Export Excel และรูปสินค้า
- หน่วยรับเข้า/เบิกออก และ Conversion quantity
- รับสินค้าเข้า พร้อม PO/Invoice, ราคาซื้อ, ผู้ขาย และ FIFO cost lots
- ผู้ขาย: เพิ่ม แก้ไข ปิดใช้งาน สรุปยอดซื้อ และขยายดูรายการรับเข้า
- ยอดคงเหลือ ต้นทุน FIFO สถานะพร้อมเบิก/ใกล้หมด/หมด
- ปรับสต๊อก พร้อมบันทึกเหตุผล
- รายการขอเบิก จัดของ ตัดสต๊อก และรองรับเบิกด่วน
- ประวัติรับเข้า/เบิก พร้อมแผนกผู้เบิก
- รายงานการเบิก สินค้าที่เบิกเยอะสุด และยอดซื้อแยกผู้ขาย
- ผู้ใช้งาน แผนก สิทธิ์เมนู และสิทธิ์เมนูผู้ขาย
- Audit Log สำหรับ API ที่มีการเขียนข้อมูล

### ผู้ขอเบิก

- เลือกแผนกและกรอกรหัสพนักงานเพื่อเข้าสู่ระบบ
- ดูสินค้า ค้นหาสินค้า ดูยอดคงเหลือ
- สร้างและส่งคำขอเบิก
- ดูสถานะและประวัติคำขอ

### Login UI

- หน้า HR และผู้ขอเบิกเป็น Two-column warehouse login
- รูปพื้นหลัง: `frontend/public/login-bg.png`
- มีหุ่นยนต์ LED ขยับตาตามเมาส์
- HR: คลิก Password แล้วหุ่นปิดตา, ชี้ปุ่ม Login แล้วหัวเราะ/ส่ายหัว
- User: คลิกรหัสพนักงานแล้วหุ่นปิดตา, ชี้ปุ่ม Login แล้วหัวเราะ/ส่ายหัว

## ไฟล์สำคัญ

| งาน | ไฟล์ |
| --- | --- |
| API Axios + API selector | `frontend/src/api/api.js`, `frontend/src/api/apiConfig.js` |
| HR Login | `frontend/src/layouts/LoginLayout.jsx`, `frontend/src/layouts/LoginLayout.css`, `frontend/src/components/LoginPanel.jsx`, `frontend/src/components/LoginPanel.css` |
| User Login | `frontend/src/request/pages/RequestLoginPage.jsx`, `frontend/src/request/pages/RequestLoginPage.css` |
| สินค้า/สต๊อก/ผู้ขาย | `frontend/src/stock/components/InventoryWorkspace.jsx` |
| Backend startup/CORS/schema preparation | `backend/src/StockIssueSystem.Api/Program.cs` |
| Database model | `backend/src/StockIssueSystem.Api/Data/AppDbContext.cs` |
| ตรวจรับระบบ | `SYSTEM_ACCEPTANCE_CHECKLIST.md` |

## ข้อควรระวัง

- อย่า commit หรือส่งต่อรหัสผ่าน Database ใน `appsettings.json`
- ก่อนลบข้อมูล Database ต้องตกลงก่อนว่าจะเก็บ `Department`, `Employee`, `Menu`, `Permission`, `Status` หรือไม่
- Frontend bundle มีขนาดใหญ่กว่า 500 KB; เป็น Vite warning ไม่ใช่ build failure
- `frontend/.env` ถูกใช้ตอน `npm run dev`; `.env.production` ถูกใช้ตอน `npm run build`
- หลังแก้ `.env` ต้อง restart Vite dev server หรือ build ใหม่
- CORS ของ Backend ต้องมี origin ของ IIS Frontend (`http://192.168.0.13:9400`)

## สถานะล่าสุดที่ตรวจแล้ว

- Backend .NET 8 build ผ่าน ไม่มี Warning/Error
- Frontend production build ผ่าน
- Server API health ตอบ `Healthy` เมื่อ 24 สิงหาคม 2026
- หน้า IIS Frontend ต้องมี `web.config` เพื่อไม่ให้ `/login` ขึ้น 404

## งานถัดไปที่แนะนำ

- ตรวจรับตาม `SYSTEM_ACCEPTANCE_CHECKLIST.md` กับผู้ใช้งานจริง
- ตัดสินใจชุดข้อมูลเริ่มต้นก่อนลบข้อมูลทดสอบ
- เปลี่ยน Database credential ไปใช้ Secret/Environment Variable ก่อนใช้งานจริงในระยะยาว
