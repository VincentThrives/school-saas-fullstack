# School Management SaaS — Backend

Multi-Tenant School Academic Management System  
**Java 21 · Spring Boot 3.3 · MongoDB · JWT · Multi-Tenancy**

---

## Architecture Overview

```
saas_central (MongoDB)          school_tenant_<tenantId> (MongoDB)
├── tenants                     ├── users
├── super_admin_users           ├── students
├── audit_logs                  ├── teachers
├── feature_catalog             ├── classes / sections / subjects
└── subscription_plans          ├── attendance
                                ├── academic_years
                                ├── exams / exam_marks
                                ├── mcq_questions / mcq_exams / mcq_results
                                ├── fee_structures / fee_payments
                                ├── notifications
                                ├── events
                                ├── timetable
                                ├── mentoring_notes
                                └── settings
```

Every authenticated request:
1. `JwtAuthFilter` validates token, extracts `tenantId` + `role`
2. `TenantContext.setTenantId(tenantId)` routes all DB calls to the correct database
3. `FeatureFlagFilter` checks if the requested module is enabled for the tenant
4. Controller → Service → Repository (automatically uses tenant DB)
5. `TenantContext.clear()` in `finally` block

---

## Prerequisites

| Tool | Version |
|------|---------|
| Java | 21+ |
| Maven | 3.9+ |
| MongoDB | 7.0+ (local or Atlas) |
| (Optional) Redis | 7+ for caching |

---

## Quick Start

### 1. Clone and configure

```bash
git clone <repo>
cd school-management-backend
cp src/main/resources/application.yml src/main/resources/application-local.yml
```

Edit `application-local.yml`:

```yaml
spring:
  data:
    mongodb:
      uri: mongodb://localhost:27017
      database: saas_central
  mail:
    host: smtp.gmail.com
    username: your-email@gmail.com
    password: your-app-password

app:
  jwt:
    secret: YourVeryLongSecretKeyAtLeast256BitsForHS256SigningAlgorithm
  cors:
    allowed-origins: http://localhost:5173
```

### 2. Start MongoDB

```bash
# Local
mongod --dbpath /data/db

# Or Docker
docker run -d -p 27017:27017 --name mongo mongo:7
```

### 3. Run the application

```bash
mvn spring-boot:run
```

On first startup, `DataInitializer` seeds:
- Default Super Admin: `admin@schoolsaas.com` / `Admin@123` ← **change immediately**
- Feature catalog (13 feature flags)

### 4. Access Swagger UI

```
http://localhost:8080/swagger-ui
```

---

## Login Flow

### Tenant Users (SCHOOL_ADMIN, PRINCIPAL, TEACHER, STUDENT, PARENT)

```
Step 1: POST /api/v1/auth/resolve-tenant
        Body: { "schoolId": "your-subdomain" }
        → Returns: tenantId, schoolName, logoUrl

Step 2: POST /api/v1/auth/login
        Body: { "tenantId": "...", "username": "...", "password": "..." }
        → Returns: accessToken, refreshToken, role, featureFlags
```

### Super Admin

```
POST /api/v1/super/auth/login
Body: { "username": "admin@schoolsaas.com", "password": "Admin@123" }
→ Returns: accessToken (NO tenantId in JWT), refreshToken
```

All subsequent requests: `Authorization: Bearer <accessToken>`

---

## Roles & Access

| Role | Scope | Key Capabilities |
|------|-------|-----------------|
| `SUPER_ADMIN` | Global (central DB) | Tenant CRUD, feature flags, plan management |
| `SCHOOL_ADMIN` | Tenant | Full school control: users, settings, all modules |
| `PRINCIPAL` | Tenant | Read-only analytics, all filtered views |
| `TEACHER` | Tenant | Attendance, marks entry, MCQ, mentoring (own classes) |
| `STUDENT` | Tenant | Own data, MCQ exams |
| `PARENT` | Tenant | Child's data only |

---

## Key API Endpoints

### Authentication
```
POST /api/v1/auth/resolve-tenant     Public – Step 1
POST /api/v1/auth/login              Public – Step 2
POST /api/v1/auth/refresh            Public
POST /api/v1/auth/logout             Authenticated
POST /api/v1/auth/forgot-password    Public
POST /api/v1/auth/change-password    Authenticated
POST /api/v1/super/auth/login        Public – Super Admin only
```

### Super Admin
```
GET/POST   /api/v1/super/tenants
GET/PUT    /api/v1/super/tenants/{id}
PATCH      /api/v1/super/tenants/{id}/status
GET/PATCH  /api/v1/super/tenants/{id}/features
PUT        /api/v1/super/tenants/{id}/features      (bulk)
PUT        /api/v1/super/tenants/{id}/plan
GET        /api/v1/super/tenants/stats
```

### School Management
```
GET/POST        /api/v1/academic-years
PATCH           /api/v1/academic-years/{id}/set-current
PATCH           /api/v1/academic-years/{id}/archive

GET/POST        /api/v1/users
PATCH           /api/v1/users/{id}/status
PATCH           /api/v1/users/{id}/unlock
POST            /api/v1/users/bulk-import

GET/POST        /api/v1/students
POST            /api/v1/students/bulk-promote
GET/POST        /api/v1/teachers
GET/POST        /api/v1/classes
GET/POST        /api/v1/subjects
GET/POST/PUT    /api/v1/timetable
```

### Academic Operations
```
POST  /api/v1/attendance/mark
GET   /api/v1/attendance/summary/student/{id}
GET   /api/v1/attendance/class/{classId}

GET/POST      /api/v1/exams
POST          /api/v1/exams/marks
GET           /api/v1/exams/{id}/marks
PATCH         /api/v1/exams/{id}/lock-marks

POST          /api/v1/mcq/questions
POST          /api/v1/mcq/exams
PATCH         /api/v1/mcq/exams/{id}/publish
POST          /api/v1/mcq/exams/{id}/start
POST          /api/v1/mcq/exams/{id}/submit
```

### Admin & Communication
```
GET/POST    /api/v1/fees/structures
POST        /api/v1/fees/payments
GET         /api/v1/fees/payments/student/{id}

GET/POST    /api/v1/notifications
PATCH       /api/v1/notifications/{id}/read
GET         /api/v1/notifications/unread-count

GET/POST    /api/v1/events
GET         /api/v1/events/holidays

GET/PUT     /api/v1/settings

GET/POST    /api/v1/students/{id}/mentoring-notes
GET         /api/v1/dashboard
```

---

## Feature Flags

Features are toggled per tenant by Super Admin. If a feature is disabled, all its endpoints return:
```json
{ "success": false, "message": "Feature not enabled for this tenant: attendance" }
```

| Feature Key | Endpoints Protected |
|-------------|-------------------|
| `attendance` | `/api/v1/attendance/**` |
| `exams` | `/api/v1/exams/**` |
| `mcq` | `/api/v1/mcq/**` |
| `fee` | `/api/v1/fees/**` |
| `notifications` | `/api/v1/notifications/**` |
| `events` | `/api/v1/events/**` |
| `timetable` | `/api/v1/timetable/**` |
| `analytics` | `/api/v1/reports/**` |

---

## Multi-Tenancy DB Routing

```
Request arrives
    → JwtAuthFilter extracts tenantId from JWT
    → TenantContext.setTenantId("tenant-abc")
    → Any Repository call
        → TenantMongoDbFactory.getMongoDatabase()
            → returns school_tenant_abc database
    → finally: TenantContext.clear()
```

Super Admin requests have no `tenantId` in JWT → `TenantContext` is never set → all queries go to `saas_central`.

**New tenant provisioning** (`POST /api/v1/super/tenants`):
1. Saves `Tenant` document in `saas_central.tenants`
2. Calls `TenantMongoDbFactory.provisionTenant(tenantId)` → pre-warms connection to `school_tenant_<tenantId>`
3. Seeds default `SCHOOL_ADMIN` user in the tenant DB
4. Seeds feature flags based on plan

---

## Security

- **JWT**: HS256, access token 15 min, refresh token 7 days, rotation on refresh
- **Super Admin JWT**: no `tenantId` claim — rejected by all tenant endpoints
- **Account lockout**: configurable (default 5 failed attempts), manual unlock by SCHOOL_ADMIN
- **Rate limiting**: Bucket4j in-memory (pluggable to Redis)
  - `/auth/login`: 10 req/min per IP
  - `/super/auth/login`: 5 req/min per IP
  - `/auth/resolve-tenant`: 20 req/min per IP
  - All others: 200 req/min per user
- **CORS**: configured via `app.cors.allowed-origins`

---

## Project Structure

```
src/main/java/com/saas/school/
├── SchoolManagementApplication.java
├── config/
│   ├── DataInitializer.java           ← Seeds super admin + feature catalog
│   ├── filter/
│   │   ├── JwtAuthFilter.java         ← JWT validation + TenantContext setup
│   │   ├── FeatureFlagFilter.java     ← Blocks disabled features
│   │   └── RateLimitFilter.java       ← Bucket4j rate limiting
│   ├── mongodb/
│   │   ├── TenantContext.java         ← ThreadLocal tenant ID
│   │   └── TenantMongoDbFactory.java  ← Dynamic DB routing
│   └── security/
│       ├── JwtUtil.java               ← Token generation + parsing
│       └── SecurityConfig.java        ← Spring Security config
├── common/
│   ├── audit/                         ← AuditLog model + AuditService
│   ├── exception/                     ← Custom exceptions + GlobalExceptionHandler
│   └── response/                      ← ApiResponse<T> + PageResponse<T>
└── modules/
    ├── superadmin/                    ← Super admin + tenant management
    ├── auth/                          ← Login, refresh, logout, password
    ├── academicyear/                  ← Academic year lifecycle
    ├── user/                          ← User CRUD + bulk import
    ├── student/                       ← Student CRUD + bulk promote
    ├── teacher/                       ← Teacher profiles
    ├── classes/                       ← Classes + sections + subjects
    ├── attendance/                    ← Attendance marking + reports
    ├── exam/                          ← Exams + marks entry
    ├── mcq/                           ← MCQ questions + exams + results
    ├── fee/                           ← Fee structures + payments
    ├── notification/                  ← Notifications + email
    ├── event/                         ← Events + holidays
    ├── timetable/                     ← Class schedules
    ├── settings/                      ← School settings + validation config
    ├── mentoring/                     ← Teacher mentoring notes
    ├── featureflag/                   ← Feature catalog + per-tenant flags
    └── dashboard/                     ← Role-based dashboard stats
```

---

## Running Tests

```bash
mvn test
```

Tests require a running MongoDB instance. Use the `test` profile for an isolated database:
```bash
mvn test -Dspring.profiles.active=test
```

---

## Connecting to the Frontend

Your React frontend (Vite, port 5173) connects via:

```
VITE_API_BASE_URL=http://localhost:8080
```

The MSW handlers in the frontend mock the same endpoints this backend implements. Remove MSW in production by setting `VITE_ENABLE_MSW=false`.

---

## Environment Variables (Production)

```bash
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net
JWT_SECRET=<256-bit-random-string>
MAIL_HOST=smtp.yourprovider.com
MAIL_USERNAME=noreply@yourdomain.com
MAIL_PASSWORD=<smtp-password>
CORS_ORIGINS=https://app.yourdomain.com
FILE_UPLOAD_DIR=/var/uploads
```

---

## What's Left to Implement

The following stubs need business logic filled in:

| Module | What to complete |
|--------|-----------------|
| `report/` | PDF generation (iText) for report cards, attendance, fee receipts |
| `auth/` | Password reset token persistence + validation |
| `attendance/` | Low-attendance alert scheduler (`@Scheduled`) |
| `fee/` | Overdue fee email notifications (`@Scheduled`) |
| `notification/` | Email recipient lookup from User repo |
| `teacher/` | Service layer (currently thin controller direct to repo) |
| `student/` | Bulk import via Excel (same pattern as UserService) |
| `timetable/` | Teacher's daily schedule endpoint |

Each module follows the same pattern: Model → Repository → Service → Controller → DTO. Add the missing service layer following the existing modules as templates.
