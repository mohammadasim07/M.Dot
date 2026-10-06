# M.DoT Enterprises

A modern web application for automatic and manual dual-sided ID card processing, edge detection, perspective correction, enhancement, and 300 DPI A4 print layout generation.

- **Client / Stakeholder**: Shoeb Akther
- **Developer**: Mohammad Asim

---

## 🌟 Key Features

- **Document Queue Management**:
  - Drag-and-drop dual photo upload (Front & Back).
  - One-click queue clearance (`Clear All`).
  - Real-time side assignment and preview cards.
- **Smart Image Processing**:
  - Automatic 4-corner document boundary detection (OpenCV).
  - Perspective transformation and straighten alignment.
  - Manual 4-point interactive crop editor.
  - Preset filters: Original, Auto, Scamcanner / Clean Doc, Grayscale, B&W.
  - Granular brightness, contrast, and sharpness controls.
- **Print & Layout Studio**:
  - Live A4 sheet preview (210 × 297 mm, 300 DPI).
  - Side-by-Side and Top-to-Bottom layouts.
  - ISO ID-1 standard dimensions (85.6 × 54.0 mm).
  - Native browser `<Ctrl + P>` integration directly executing `window.print()` without custom dialog popups.
  - Centered, borderless cards optimized for photo paper and manual cutting.

---

## 🏗️ Architecture

```
MDotenterprises/
├── frontend/        # React 18 + TypeScript + Vite
├── backend/         # Spring Boot 3.2.0 (Java 17) REST API
└── image-service/   # FastAPI + OpenCV Python microservice
```

---

## 🚀 Getting Started

### 1. Python Image Service
```bash
cd image-service
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 2. Spring Boot Backend
```bash
cd backend
./mvnw spring-boot:run
```

### 3. Frontend Web App
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173/` in your browser.
