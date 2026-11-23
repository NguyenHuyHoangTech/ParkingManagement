# 🚀 PBMS Backend (Spring Boot Core Service)

[![Java](https://img.shields.io/badge/Java-26-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)](https://openjdk.org/)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot-4.1.0-6DB33F?style=for-the-badge&logo=spring-boot&logoColor=white)](https://spring.io/projects/spring-boot)
[![SQL Server](https://img.shields.io/badge/SQL_Server-2022-CC292B?style=for-the-badge&logo=microsoft-sql-server&logoColor=white)](https://www.microsoft.com/sql-server/)
[![WebSocket](https://img.shields.io/badge/WebSocket-STOMP-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://stomp.github.io/)

The **PBMS Backend** serves as the central nervous system for the Smart Parking Building Management System. Built on modern Java 26 and Spring Boot 4, it provides robust REST APIs, real-time WebSocket event streaming, complex automated fee calculation engines, and hardware IoT gateway integrations.

---

## 🏛 Architecture Overview

The backend is built adhering to Clean Architecture and Domain-Driven Design (DDD) principles:

```
pbms-be/src/main/java/com/pbms/
├── common/             # Cross-cutting concerns (Security, Exceptions, WebSocket, Swagger, Redis)
├── modules/
│   ├── identity/       # User management, Authentication, Roles & Permissions, JWT, OAuth2
│   ├── infrastructure/ # Floor, Zone, Slot mapping, Smart Routing Rules, Building Profiles
│   ├── operation/      # Gate In/Out, Parking Sessions, Physical RFID Cards, Incidents
│   ├── pricing/        # Dynamic fee engines, Shifts, Block billing, Monthly tickets, Refunds
│   ├── payment/        # PayOS, PayPal & QR code integration, Transaction ledgers
│   ├── reporting/      # Operational heatmaps, Revenue analytics, Hourly occupancy trends
│   └── iot/            # Hardware controller telemetry, Virtual barrier & sensor integration
└── PbmsApplication.java
```

---

## 🔑 Key Features & Technical Highlights

- **Dynamic Fee Calculation Engine**: Handles multi-tier shift pricing, progressive hourly blocks, overnight penalties, grace periods, vehicle category multipliers, and monthly pass subscriptions.
- **Smart Vehicle Routing Algorithm**: Evaluates current zone capacities, vehicle dimensions, and operational routing rules to dynamically guide drivers to optimal vacant spots.
- **Real-Time WebSocket Gateway (`/ws-pbms`)**: Uses STOMP over SockJS to broadcast gate events, sensor status updates, barrier triggers, and slot availability changes in sub-second latency.
- **Enterprise Security & Audit**: Stateless JWT authentication, role-based access control (RBAC for `ADMIN`, `MANAGER`, `STAFF`, `CUSTOMER`), Google OAuth2 SSO, and immutable audit logs.
- **Automated Database Migrations**: Flyway version-controlled migrations ensuring zero-drift database deployment across environments.

---

## ⚙️ Configuration & Prerequisites

- **Java**: JDK 26 or higher
- **Database**: Microsoft SQL Server 2019+
- **Build Tool**: Apache Maven (bundled via `./mvnw`)

### Setup Environment

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Update the credentials in `.env`:
   ```properties
   DB_URL=jdbc:sqlserver://localhost:1433;databaseName=pbms_db;encrypt=true;trustServerCertificate=true
   DB_USERNAME=sa
   DB_PASSWORD=your_password
   SERVER_PORT=8080
   JWT_SECRET=your_base64_secret_key
   ```

---

## 🛠 Compilation & Execution

```bash
# Compile and run with Maven Wrapper
./mvnw clean spring-boot:run

# Run Unit & Integration Tests
./mvnw test

# Package to standalone JAR
./mvnw clean package -DskipTests
```

The server starts by default at `http://localhost:8080`.
- API Base Path: `http://localhost:8080/api/v1`
- WebSocket Endpoint: `ws://localhost:8080/ws-pbms`
