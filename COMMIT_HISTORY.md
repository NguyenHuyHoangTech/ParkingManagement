# 📜 PBMS Project Commit History & Architectural Changelog

This document provides a comprehensive, professional record of the technical evolution, milestones, and individual commits for the **Parking Building Management System (PBMS)** repository. It highlights the development trajectory, architectural decisions, and module implementations across the entire engineering lifecycle.

---

## 🧭 Milestone & Phase Roadmap

| Phase | Timeframe | Core Focus & Milestones | Primary Author |
| :--- | :--- | :--- | :--- |
| **Phase 1: Project Initialization & Core Operations** | July 04 - July 06, 2026 | Domain modeling, database schema v1, basic gate sessions, incident reporting, initial dashboard. | HoangNH |
| **Phase 2: Security, Identity & Audit Governance** | July 07 - July 08, 2026 | Spring Security 6 + JWT auth, audit logging, session auto-logout, building profiles, incident desk. | HoangNH |
| **Phase 3: Dynamic Pricing & Pre-Booking Engine** | July 09 - July 12, 2026 | Multi-tier shift & block pricing engine, pre-booking slot locking, fee dispute management. | HoangNH |
| **Phase 4: IoT Hardware Simulator & Real-Time Sync** | July 18 - July 22, 2026 | Virtual barrier gate, RFID scanner, ultrasonic sensors, STOMP WebSocket gateway, reservation tracking. | HoangNH |
| **Phase 5: Refinement, Mobile Polish & Clean Code** | July 27 - July 31, 2026 | Comprehensive code comments, hardware controllers, smart vehicle routing rules, responsive UI. | HoangNH, nguyenhuuthanh-git |
| **Phase 6: Customer UX Modernization & Final Launch** | August 10, 2026 | Google OAuth2 configuration, dark/light theme, vehicle selector, error translation, bottom tab navigation. | tanphu-thai |

---

## 🔍 Detailed Phase Breakdown & Architectural Decisions

### Phase 1: Project Initialization & Domain Foundations (July 04 - July 06, 2026)
- **Commits:** `cd0248c` → `03ce166`
- **Architectural Highlights:**
  - Initialized multi-project repository: Spring Boot backend (`pbms-be`), React + Vite frontend (`pbms-fe`), and Playwright E2E suite (`pbms-e2e`).
  - Designed the relational schema in Microsoft SQL Server (`0_DATABASE.sql` & `pbms_db_Full_20260705.bak`) establishing 24 core domain entities.
  - Implemented initial Gate In/Out parking session workflows and physical RFID card tracking.
  - Built financial summary reporting and initial refund request management tables.
  - Integrated third-party payment gateways and Google OAuth authentication foundations.

### Phase 2: Security Architecture, Access Control & Audit Governance (July 07 - July 08, 2026)
- **Commits:** `10e17bc` → `5504981`
- **Architectural Highlights:**
  - Configured stateless **Spring Security 6 with JSON Web Tokens (JWT)**.
  - Implemented immutable `audit_logs` tracking user identifiers, IP addresses, timestamps, and action types.
  - Added token expiration handling with client-side auto-logout interceptors to prevent session hijacking.
  - Developed building profile configuration management (`building_profiles`) allowing facility admins to manage physical parameters (capacity, address, operating hours).
  - Engineered the Incident Management desk (`incident_tickets`) for handling lost cards, plate mismatches, and hardware anomalies.

### Phase 3: Dynamic Pricing Policy Engine & Pre-Booking Workflows (July 09 - July 12, 2026)
- **Commits:** `85e5f27` → `5d2e74c`
- **Architectural Highlights:**
  - Re-architected tariff calculation from hard-coded rates to a **dynamic multi-tier pricing policy engine**:
    - **Shifts:** Configurable day, night, and peak operating hours.
    - **Progressive Blocks:** First block base fee (e.g., initial 2 hours) followed by incremental 15/30-minute block rates.
    - **Vehicle Multipliers:** Dynamic rate adjustments for Cars, Motorbikes, and Electric Vehicles.
  - Built the **Customer Pre-Booking reservation engine**:
    - Pre-arrival slot locking with automatic expiration windows.
    - Capacity reservation quotas preventing overbooking.
    - Dispute resolution screen for parking tariff discrepancies.

### Phase 4: IoT Hardware Telemetry & Real-Time Gate Operation (July 18 - July 22, 2026)
- **Commits:** `93efa65` → `56b4ef9`
- **Architectural Highlights:**
  - Created the dedicated **IoT Hardware Simulator (`pbms-iot-simulator`)** in React 19 + Vite:
    - Simulated motorized boom barrier states (Opening, Open, Closing, Closed, Jammed).
    - Simulated RFID card tap reader emitting card UIDs via WebSockets.
    - Simulated ultrasonic slot sensors transmitting vacancy state transitions.
  - Integrated **Spring STOMP WebSocket Broker (`/ws-pbms`)** on the backend and `@stomp/stompjs` on the frontend:
    - Sub-second bi-directional telemetry synchronization between physical hardware simulators and gate staff consoles.
    - Real-time slot status propagation without client polling.
  - Hardened database schemas and transactional boundaries during high-frequency barrier events.

### Phase 5: System Hardening, Smart Routing & Production Clean Code (July 27 - July 31, 2026)
- **Commits:** `7257419` → `23e91f3`
- **Architectural Highlights:**
  - Authored comprehensive architectural and coding documentation (`Comment_Coding.md`, `Websocket.md`).
  - Upgraded `IotHardwareController.java` to support secure API key authentication (`PBMS-HARDWARE-SECURE-KEY-2024`).
  - Implemented **Smart Vehicle Routing Rules**:
    - Algorithmically evaluates floor and zone occupancy thresholds.
    - Emits real-time directional recommendations to gate LED boards and customer interfaces.
  - Enhanced mobile responsiveness for on-foot gate security personnel.
  - Refactored Incident workflow with multi-step status resolution and audit trail verification.
  - Performed cross-module synchronization and eliminated redundant code paths.

### Phase 6: Customer UI/UX Modernization & Launch Readiness (August 10, 2026)
- **Commits:** `14a8137` → `7382d71`
- **Architectural Highlights:**
  - Finalized production Google OAuth2 client authentication flow.
  - Introduced soft dark/light mode toggle with theme persistence.
  - Streamlined Pre-Booking workflow with interactive `VehicleSelector` component.
  - Added mobile Bottom Navigation Bar for modern smartphone ergonomics.
  - Centralized error handling utility (`errorHandler.ts`) converting raw backend exceptions into user-friendly localized messages.
  - Refactored payment modal to a focused, responsive QR dialog supporting quick PayOS VietQR payments.

---

## 📊 Complete Chronological Commit Ledger

| # | Commit Hash | Date | Author | Commit Message | Scope / Components Affected |
| :-: | :--- | :---: | :--- | :--- | :--- |
| 1 | `cd0248c` | 2026-07-04 | HoangNH | Initial commit | Project root, initial project scaffolding |
| 2 | `86d692d` | 2026-07-05 | HoangNH | Change Of Booking | Customer booking form & slot reservation models |
| 3 | `462089a` | 2026-07-05 | HoangNH | Upload resolve booking config when handle zone before time booking arrive | Pre-booking zone quota & early-arrival buffer logic |
| 4 | `c2d258a` | 2026-07-05 | HoangNH | Create pbms_db_Full_20260705.bak | Full database backup archive for rapid restoration |
| 5 | `6360629` | 2026-07-05 | HoangNH | Update 0_DATABASE.sql | DDL schema initialization with foreign keys & indexes |
| 6 | `b920167` | 2026-07-05 | HoangNH | Upload incident | Incident ticket entities, status enums & logging |
| 7 | `abc06a3` | 2026-07-06 | HoangNH | Update operation and dash board report. | Operational analytics, turnover charts & dashboard |
| 8 | `6e9a8d3` | 2026-07-06 | HoangNH | change logo of web | Brand identity, favicon & header assets |
| 9 | `e5ab984` | 2026-07-06 | HoangNH | Change of rang of day config | Date range filtering for financial & occupancy reports |
| 10 | `5922e4c` | 2026-07-06 | HoangNH | Change discount no hard code | Dynamic discount rules & promotional vouchers |
| 11 | `f7c2c70` | 2026-07-06 | HoangNH | fix error of monthly tichker | Monthly pass validation & renewal date calculations |
| 12 | `c6d1a04` | 2026-07-06 | HoangNH | fix bug of refurnd management | Refund processing lifecycle & transaction ledger |
| 13 | `19cba97` | 2026-07-06 | HoangNH | fix error of finance report | Aggregation query corrections for daily revenue |
| 14 | `9eef8c1` | 2026-07-06 | HoangNH | Fix link gg. | Google OAuth redirect URIs and scopes |
| 15 | `03ce166` | 2026-07-06 | HoangNH | Update display flex. | Responsive layout adjustments across portal screens |
| 16 | `10e17bc` | 2026-07-07 | HoangNH | Update system log. | Logback configuration & structured application logging |
| 17 | `5570191` | 2026-07-07 | HoangNH | Update system auto logout | Inactivity timer & JWT token expiration listeners |
| 18 | `afd995a` | 2026-07-07 | HoangNH | update auditlog | Audit trail interceptor for sensitive administrative tasks |
| 19 | `efb811a` | 2026-07-07 | HoangNH | upload pre booking config | Reservation parameters (lead time, max hold duration) |
| 20 | `e9ae780` | 2026-07-07 | HoangNH | Update PreBookingManagementScreen.tsx | Management console for monitoring active pre-bookings |
| 21 | `f4faf8f` | 2026-07-08 | HoangNH | upload about building profile | Facility profile editing (operating hours, geolocation) |
| 22 | `be4c543` | 2026-07-08 | HoangNH | Create tsconfig.json | TypeScript compiler configuration & path alias setup |
| 23 | `04568f8` | 2026-07-08 | HoangNH | fix fe and be not connect | CORS policy & Vite reverse proxy bridge configuration |
| 24 | `e895734` | 2026-07-08 | HoangNH | upload security | Spring Security filter chain & role-based route guards |
| 25 | `5504981` | 2026-07-08 | HoangNH | upload icident resolve | Resolution action modal & incident ticket closure |
| 26 | `85e5f27` | 2026-07-09 | HoangNH | Update home page | Customer landing page hero, pricing & live slot badges |
| 27 | `4d9616a` | 2026-07-09 | HoangNH | Upload Cuculate Fee. | Core algorithmic calculation for multi-shift parking fees |
| 28 | `b9966ec` | 2026-07-09 | HoangNH | download new version npm | Package dependency upgrades & security patch updates |
| 29 | `734120e` | 2026-07-10 | HoangNH | change test caculate fee | Unit test fixtures for progressive block tariff formulas |
| 30 | `9a4c7b1` | 2026-07-10 | HoangNH | Update PricingConfigScreen.tsx | GUI editor for shift schedules, rates & vehicle types |
| 31 | `5479fca` | 2026-07-10 | HoangNH | update fee dispute | Workflow for disputing tariffs at Gate Out terminal |
| 32 | `12e97ef` | 2026-07-11 | HoangNH | Upload prebooking | Integrated booking form with slot lock confirmations |
| 33 | `5d2e74c` | 2026-07-12 | HoangNH | Upload Caculate In BE | Backend service implementation of tariff calculations |
| 34 | `93efa65` | 2026-07-18 | HoangNH | Update | General stabilization & operational refactoring |
| 35 | `6a0780a` | 2026-07-18 | HoangNH | update database | Schema patch for zone capacities & sensor bindings |
| 36 | `88fb4e6` | 2026-07-18 | HoangNH | update | State persistence improvements across user sessions |
| 37 | `8e4cc4a` | 2026-07-18 | HoangNH | Update fix bug | Edge case resolution in gate barrier state tracking |
| 38 | `a241a6c` | 2026-07-19 | HoangNH | Update IOT Tool Simulator | Virtual barrier gates, RFID scanners & sensors tool |
| 39 | `696f6a7` | 2026-07-19 | HoangNH | Update Reservation | Capacity counter updates upon reservation arrival |
| 40 | `86dcfec` | 2026-07-22 | HoangNH | Update ALL | Major multi-module sync between backend, UI & simulator |
| 41 | `9626bcb` | 2026-07-22 | HoangNH | update | WebSocket event payload serialization optimizations |
| 42 | `616dcea` | 2026-07-22 | HoangNH | update | Barrier timeout auto-close trigger implementation |
| 43 | `7879cfe` | 2026-07-22 | HoangNH | update | License plate string normalization and regex validation |
| 44 | `56b4ef9` | 2026-07-22 | HoangNH | update | Real-time vacancy broadcasting topic subscriber |
| 45 | `7257419` | 2026-07-27 | HoangNH | Update | Performance tuning for query execution plans |
| 46 | `96ed84a` | 2026-07-27 | HoangNH | Update Comment | In-line Javadoc and TypeScript interface documentation |
| 47 | `d6fc54f` | 2026-07-27 | HoangNH | Update Comment | Code readability and domain architecture comments |
| 48 | `ec5a701` | 2026-07-27 | HoangNH | Update IotHardwareController.java | Secure REST API endpoints for physical device telemetry |
| 49 | `93b7956` | 2026-07-27 | HoangNH | Create Comment_Coding.md | Team coding guidelines and clean architecture standards |
| 50 | `823929a` | 2026-07-28 | HoangNH | Update | Gate console camera preview resolution enhancements |
| 51 | `e031d1c` | 2026-07-28 | HoangNH | Update Translate | Vietnamese localization strings for staff terminals |
| 52 | `9b639f1` | 2026-07-28 | HoangNH | Update IOT Hardware | Sensor heartbeat interval & connection health monitoring |
| 53 | `eaf073b` | 2026-07-28 | HoangNH | Update Mobile | Responsive grid layouts for handheld mobile displays |
| 54 | `17e2c25` | 2026-07-28 | HoangNH | Update Default fee | Fallback tariff policies when shift rules are undefined |
| 55 | `ca0e48e` | 2026-07-30 | HoangNH | Update fix bug | Exception handling for missing vehicle type metadata |
| 56 | `33a2222` | 2026-07-30 | HoangNH | Update BuildingProfileService.java | Address validation & geocoding coordinate updates |
| 57 | `6dbb9c9` | 2026-07-30 | HoangNH | Update | Gate out bill printing and digital receipt formatting |
| 58 | `7894173` | 2026-07-30 | HoangNH | Update | RFID card inventory status synchronization |
| 59 | `c12e68b` | 2026-07-30 | HoangNH | UpDate | Staff shift handover & clock-out reconciliation |
| 60 | `4b95554` | 2026-07-31 | HoangNH | Update Incident | Incident evidence attachment and photo storage |
| 61 | `7af8ef3` | 2026-07-31 | HoangNH | update db | Indexing optimizations on `parking_sessions` and `slots` |
| 62 | `ff2d92d` | 2026-07-31 | HoangNH | Update | UI badge animations and real-time state feedback |
| 63 | `5fddec8` | 2026-07-31 | HoangNH | Update | Session duration formatting and overtime warnings |
| 64 | `a3e6749` | 2026-07-31 | nguyenhuuthanh-git | Sync routing/gate module updates and cleanup dead code | Gate module synchronization & unused import pruning |
| 65 | `23e91f3` | 2026-07-31 | HoangNH | Update Incident | Final incident resolution actions and audit logs |
| 66 | `14a8137` | 2026-08-10 | tanphu-thai | Fix: Config login google | Production Google Client ID and redirect configurations |
| 67 | `7382d71` | 2026-08-10 | tanphu-thai | feat(customer-ui): comprehensive ui optimization and fixes | Dark/light theme, avatar upload, bottom bar, vehicle selector, error translation |

---

## 💡 Key Engineering Contributions by HoangNH (Lead Architect)

1. **System & Domain Architecture:**
   - Engineered the entire core domain architecture spanning 24 relational tables in SQL Server and Spring Boot JPA entities.
   - Designed the multi-module layout ensuring clean separation between Identity, Infrastructure, Operation, Pricing, and Reporting.

2. **Real-Time IoT & Gate Synchronization:**
   - Designed and built the STOMP WebSocket real-time communication pipeline connecting gate consoles with simulated physical barriers.
   - Built the complete standalone **IoT Hardware Simulator** replicating real-world hardware behavior without physical devices.

3. **Dynamic Multi-Tier Pricing Engine:**
   - Conceptualized and implemented the shift-based, progressive-block billing algorithm supporting multiple vehicle categories, grace periods, and overnight penalties.

4. **Interactive 2D Space Map & Smart Routing:**
   - Integrated HTML5 canvas visual mapping (React Konva) for parking bay layout design.
   - Developed the capacity-aware vehicle routing rule algorithm directing traffic dynamically to vacant zones.
