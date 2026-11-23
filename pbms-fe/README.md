# ⚡ PBMS Frontend (React 19 + TypeScript + Vite)

[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Ant Design](https://img.shields.io/badge/Ant_Design-6.x-0170FE?style=for-the-badge&logo=ant-design&logoColor=white)](https://ant.design/)

The **PBMS Frontend** is a state-of-the-art web application providing unified portals for **Customers**, **Gate Staff**, and **Building Administrators**. It delivers a seamless, high-performance UI with responsive design, interactive 2D parking maps, and real-time hardware status synchronization.

---

## 🌟 Portals & Functional Modules

### 1. 🚗 Customer Experience Portal
- **Real-Time Slot Vacancy**: Live tracking of available parking spots by vehicle category (Car, Motorbike, E-Bike).
- **Smart Pre-Booking**: Reserve a parking bay prior to arrival, pick preferred parking zones, and lock slots securely.
- **Interactive Routing & Geo-Distance**: OpenStreetMap & OSRM driving distance estimation from customer's current GPS location to the parking facility, with one-tap Google Maps navigation.
- **Cashless Dynamic Payments**: Integrated PayOS QR code payments with instantaneous verification via WebSockets.
- **Monthly Subscription Management**: Purchase and renew long-term digital passes with plate-binding.

### 2. 🛡 Staff & Gate Console
- **Multi-Lane Gate In / Gate Out**: Real-time license plate detection preview (ANPR), barrier control, and RFID swipe processing.
- **Automated Price Preview & Settlement**: Instantaneous tariff breakdown based on shifts, duration, overtime, and discounts.
- **Exception & Incident Desk**: Resolve plate mismatch disputes, lost physical cards, overstay violations, and manual override logging.

### 3. 📊 Executive & Operational Management
- **Interactive 2D Space Map (React Konva)**: Visual layout editor and real-time slot occupancy visualization.
- **Financial & Occupancy Analytics**: In-depth revenue breakdowns, peak hourly trend graphs (Recharts), and capacity forecasts.
- **Dynamic Policy Configuration**: Intuitive GUI to customize pricing tiers, penalty formulas, shifts, and smart routing priorities.

---

## 🛠 Tech Stack Deep-Dive

| Category | Technologies |
| :--- | :--- |
| **Core Framework** | React 19, TypeScript, Vite |
| **State Management & Data Fetching** | TanStack React Query v5, Zustand |
| **Styling & UI Components** | TailwindCSS v4, Ant Design 6, @ant-design/icons |
| **Canvas & Interactive Mapping** | React Konva, Konva.js |
| **Real-time Communication** | STOMP.js, SockJS-Client |
| **Charting & Visualization** | Recharts |
| **Date & Time Provider** | Day.js, Custom Simulated Time Engine |

---

## 💻 Getting Started

### Prerequisites
- Node.js 20+ (LTS recommended)
- npm 10+

### Setup & Run
```bash
# Navigate to directory
cd pbms-fe

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The application runs by default at `http://localhost:5173`.
