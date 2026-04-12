# School SaaS - Complete Setup & API Testing Guide

## Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [MongoDB Setup](#2-mongodb-setup)
3. [Backend Setup](#3-backend-setup)
4. [Verify Backend is Running](#4-verify-backend-is-running)
5. [Testing Flow in Postman](#5-testing-flow-in-postman)
6. [Frontend Setup & Connection](#6-frontend-setup--connection)
7. [Full API Reference](#7-full-api-reference)

---

## 1. Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Java JDK | 21+ | https://www.oracle.com/java/technologies/downloads/ |
| Maven | 3.8+ | https://maven.apache.org/download.cgi (or use `./mvnw`) |
| MongoDB | 7.0+ | See Section 2 below |
| Node.js | 18+ | https://nodejs.org/ |
| Postman | Latest | https://www.postman.com/downloads/ |

---

## 2. MongoDB Setup

### Option A: Install MongoDB Community Server (Recommended)

1. Download from: https://www.mongodb.com/try/download/community
2. Choose **Windows x64**, **MSI package**
3. Run installer, select **Complete** installation
4. Check **"Install MongoDB as a Service"** (auto-starts on boot)
5. Check **"Install MongoDB Compass"** (GUI tool)
6. Finish installation

**Verify it's running:**
```bash
mongosh
# Should connect to mongodb://localhost:27017
# Type 'exit' to quit
```

### Option B: MongoDB Atlas (Cloud - Free Tier)

1. Go to https://cloud.mongodb.com/ and create free account
2. Create a **Free Shared Cluster** (M0)
3. Set Database Access: create user with password
4. Set Network Access: Add your IP (or 0.0.0.0/0 for dev)
5. Click **Connect** > **Drivers** > Copy the connection string
6. It looks like: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/saas_central`
7. Set it as environment variable before starting backend:
   ```bash
   set MONGO_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/saas_central
   ```

---

## 3. Backend Setup

### Start the Backend

```bash
cd backend

# Using Maven wrapper (recommended)
./mvnw spring-boot:run

# OR using installed Maven
mvn spring-boot:run

# OR from Eclipse: Right-click SchoolManagementApplication.java > Run As > Java Application
```

### Expected Startup Logs
```
TenantMongoDbFactory initialized with central DB: saas_central
Started SchoolManagementApplication in ~20 seconds
Default Super Admin created: admin@schoolsaas.com / Admin@123
Feature catalog seeded with 14 features
```

Backend runs at: **http://localhost:8080**

> **NOTE:** Opening http://localhost:8080 in browser shows **403 Forbidden** - this is NORMAL!
> The backend is an API server, not a website. Use Postman to test APIs.

### Swagger UI (API Explorer)
Open in browser: **http://localhost:8080/swagger-ui/index.html**
This shows all available endpoints with a try-it-out interface.

---

## 4. Verify Backend is Running

Open Postman and test the health endpoint:

```
GET http://localhost:8080/actuator/health
```

Expected Response:
```json
{
  "status": "UP"
}
```

---

## 5. Testing Flow in Postman

### IMPORTANT: Follow this exact order!

The system is multi-tenant. You must:
1. Login as Super Admin
2. Create a Tenant (School)
3. Login as the School Admin
4. Create classes, students, teachers, etc.

---

### Step 1: Super Admin Login

```
POST http://localhost:8080/api/v1/super/auth/login
Content-Type: application/json

{
  "username": "admin@schoolsaas.com",
  "password": "Admin@123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Super admin login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
    "role": "SUPER_ADMIN",
    "featureFlags": {},
    "user": {
      "userId": "xxx",
      "email": "admin@schoolsaas.com",
      "firstName": "Super",
      "lastName": "Admin",
      "role": "SUPER_ADMIN"
    }
  },
  "timestamp": "2026-04-12T..."
}
```

**SAVE the `accessToken`!** You'll need it for the next steps.

In Postman, set up an **Environment Variable**:
- Variable: `superAdminToken`
- Value: (paste the accessToken)

---

### Step 2: Create a Tenant (School)

```
POST http://localhost:8080/api/v1/super/tenants
Authorization: Bearer {{superAdminToken}}
Content-Type: application/json

{
  "schoolName": "Springfield International School",
  "subdomain": "springfield",
  "contactEmail": "info@springfield.edu",
  "contactPhone": "+919876543210",
  "plan": "ENTERPRISE",
  "address": {
    "street": "123 Main Street",
    "city": "Bangalore",
    "state": "Karnataka",
    "country": "India",
    "zip": "560001"
  },
  "adminEmail": "admin@springfield.edu",
  "adminPassword": "School@123",
  "adminFirstName": "School",
  "adminLastName": "Admin"
}
```

**Response:** A Tenant object with `tenantId`. **SAVE the `tenantId`!**

Set Postman variable:
- Variable: `tenantId`
- Value: (paste the tenantId from response)

---

### Step 3: Enable Features for the Tenant

```
PUT http://localhost:8080/api/v1/super/tenants/{{tenantId}}/features
Authorization: Bearer {{superAdminToken}}
Content-Type: application/json

{
  "attendance": true,
  "timetable": true,
  "exams": true,
  "mcq": true,
  "fee": true,
  "notifications": true,
  "events": true,
  "messaging": true,
  "content": true,
  "report_cards": true,
  "bulk_import": true,
  "parent_portal": true,
  "analytics": true,
  "whatsapp": true
}
```

---

### Step 4: Resolve Tenant (Simulates Frontend Step 1)

```
POST http://localhost:8080/api/v1/auth/resolve-tenant
Content-Type: application/json

{
  "schoolId": "springfield"
}
```

**Response:** Returns tenant public info with `tenantId`.

---

### Step 5: Login as School Admin

```
POST http://localhost:8080/api/v1/auth/login
Content-Type: application/json

{
  "tenantId": "{{tenantId}}",
  "username": "admin@springfield.edu",
  "password": "School@123"
}
```

**Response:** Returns `accessToken`, `refreshToken`, `role`, `featureFlags`.

**SAVE the `accessToken`!**

Set Postman variable:
- Variable: `schoolAdminToken`
- Value: (paste the accessToken)

---

### Step 6: Create an Academic Year

```
POST http://localhost:8080/api/v1/academic-years
Authorization: Bearer {{schoolAdminToken}}
Content-Type: application/json

{
  "label": "2025-2026",
  "startDate": "2025-06-01",
  "endDate": "2026-03-31",
  "isCurrent": true
}
```

**SAVE the `id` from response as `academicYearId`.**

---

### Step 7: Create a Class

```
POST http://localhost:8080/api/v1/classes
Authorization: Bearer {{schoolAdminToken}}
Content-Type: application/json

{
  "name": "10th Grade",
  "academicYearId": "{{academicYearId}}",
  "sections": [
    {
      "name": "Section A",
      "capacity": 40
    },
    {
      "name": "Section B",
      "capacity": 40
    }
  ]
}
```

**SAVE the class `id` as `classId` and the section IDs.**

---

### Step 8: Create Users (Teacher, Parent, Student)

**Create a Teacher User:**
```
POST http://localhost:8080/api/v1/users
Authorization: Bearer {{schoolAdminToken}}
Content-Type: application/json

{
  "email": "teacher@springfield.edu",
  "password": "Teacher@123",
  "firstName": "John",
  "lastName": "Smith",
  "phone": "+919876543001",
  "role": "TEACHER"
}
```

**Create a Parent User:**
```
POST http://localhost:8080/api/v1/users
Authorization: Bearer {{schoolAdminToken}}
Content-Type: application/json

{
  "email": "parent@gmail.com",
  "password": "Parent@123",
  "firstName": "Rajesh",
  "lastName": "Kumar",
  "phone": "+919876543210",
  "role": "PARENT"
}
```

**Create a Student User:**
```
POST http://localhost:8080/api/v1/users
Authorization: Bearer {{schoolAdminToken}}
Content-Type: application/json

{
  "email": "student@springfield.edu",
  "password": "Student@123",
  "firstName": "Rahul",
  "lastName": "Kumar",
  "role": "STUDENT"
}
```

**SAVE all `userId` values!**

---

### Step 9: Create a Student Record

```
POST http://localhost:8080/api/v1/students
Authorization: Bearer {{schoolAdminToken}}
Content-Type: application/json

{
  "admissionNumber": "SPR-2025-001",
  "rollNumber": "01",
  "userId": "{{studentUserId}}",
  "classId": "{{classId}}",
  "sectionId": "{{sectionId}}",
  "academicYearId": "{{academicYearId}}",
  "parentIds": ["{{parentUserId}}"],
  "dateOfBirth": "2010-05-15",
  "gender": "MALE",
  "bloodGroup": "B+",
  "address": {
    "street": "456 Park Road",
    "city": "Bangalore",
    "state": "Karnataka",
    "zip": "560002"
  }
}
```

---

### Step 10: Test Attendance (Login as Teacher)

```
POST http://localhost:8080/api/v1/auth/login
Content-Type: application/json

{
  "tenantId": "{{tenantId}}",
  "username": "teacher@springfield.edu",
  "password": "Teacher@123"
}
```

Save the teacher's `accessToken` as `teacherToken`.

**Mark Attendance:**
```
POST http://localhost:8080/api/v1/attendance/mark
Authorization: Bearer {{teacherToken}}
Content-Type: application/json

{
  "classId": "{{classId}}",
  "sectionId": "{{sectionId}}",
  "academicYearId": "{{academicYearId}}",
  "date": "2026-04-12",
  "entries": [
    {
      "studentId": "{{studentId}}",
      "status": "PRESENT",
      "remarks": ""
    }
  ]
}
```

---

### Step 11: Test Exams

**Create Exam:**
```
POST http://localhost:8080/api/v1/exams
Authorization: Bearer {{teacherToken}}
Content-Type: application/json

{
  "name": "Mid-Term Math",
  "classId": "{{classId}}",
  "sectionId": "{{sectionId}}",
  "academicYearId": "{{academicYearId}}",
  "subjectId": "math-101",
  "examDate": "2026-04-20",
  "maxMarks": 100,
  "passingMarks": 35
}
```

Save the exam `id` as `examId`.

**Enter Marks:**
```
POST http://localhost:8080/api/v1/exams/marks
Authorization: Bearer {{teacherToken}}
Content-Type: application/json

{
  "examId": "{{examId}}",
  "marks": [
    {
      "studentId": "{{studentId}}",
      "marksObtained": 85,
      "remarks": "Good performance"
    }
  ]
}
```

---

### Step 12: Test WhatsApp (Teacher/Admin)

**Resolve Recipients:**
```
POST http://localhost:8080/api/v1/whatsapp/resolve-recipients
Authorization: Bearer {{teacherToken}}
Content-Type: application/json

{
  "recipientType": "CLASS",
  "classId": "{{classId}}"
}
```

**Send WhatsApp Message:**
```
POST http://localhost:8080/api/v1/whatsapp/send
Authorization: Bearer {{teacherToken}}
Content-Type: application/json

{
  "recipientType": "CLASS",
  "classId": "{{classId}}",
  "messageBody": "Dear parents, the parent-teacher meeting is scheduled for Saturday at 10 AM."
}
```

> Note: Actual WhatsApp delivery requires WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN env vars configured with Meta Business API credentials.

**View Message History:**
```
GET http://localhost:8080/api/v1/whatsapp/messages?page=0&size=10
Authorization: Bearer {{teacherToken}}
```

---

### Step 13: Test Dashboard

```
GET http://localhost:8080/api/v1/dashboard
Authorization: Bearer {{schoolAdminToken}}
```

---

### Step 14: Test Notifications

```
POST http://localhost:8080/api/v1/notifications
Authorization: Bearer {{schoolAdminToken}}
Content-Type: application/json

{
  "title": "Welcome to Springfield International School",
  "body": "Welcome to our school management system!",
  "type": "ANNOUNCEMENT",
  "channel": "IN_APP",
  "recipientType": "ALL"
}
```

---

## 6. Frontend Setup & Connection

### Step 1: Configure Frontend to Talk to Backend

The frontend already points to the backend. Check the base URL:

**File:** `frontend/src/store/api/baseApi.ts`
- Default: `VITE_API_URL` env var or `/api/v1`

For local development, create `frontend/.env.local`:
```
VITE_API_URL=http://localhost:8080/api/v1
```

### Step 2: Install and Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: **http://localhost:5173**

### Step 3: Login Flow in the UI

1. Open http://localhost:5173
2. Enter School ID: `springfield` (the subdomain you created)
3. Click "Continue" - resolves the tenant
4. Enter email: `admin@springfield.edu`
5. Enter password: `School@123`
6. Click "Sign In"
7. You're in the dashboard!

### Step 4: Super Admin UI

1. Open http://localhost:5173/superadmin
2. Enter email: `admin@schoolsaas.com`
3. Enter password: `Admin@123`
4. You can manage tenants and feature flags

---

## 7. Full API Reference

### Public Endpoints (No Auth Required)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/resolve-tenant` | Resolve school by subdomain |
| POST | `/api/v1/auth/login` | Tenant user login |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/forgot-password` | Request password reset |
| POST | `/api/v1/super/auth/login` | Super admin login |
| POST | `/api/v1/super/auth/refresh` | Super admin token refresh |
| GET | `/swagger-ui/index.html` | Swagger UI |
| GET | `/api-docs` | OpenAPI JSON |
| GET | `/actuator/health` | Health check |

### Super Admin Endpoints (SUPER_ADMIN role)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/super/tenants` | List all tenants |
| POST | `/api/v1/super/tenants` | Create new tenant |
| GET | `/api/v1/super/tenants/{id}` | Get tenant details |
| PUT | `/api/v1/super/tenants/{id}` | Update tenant |
| PATCH | `/api/v1/super/tenants/{id}/status` | Change tenant status |
| DELETE | `/api/v1/super/tenants/{id}` | Delete tenant |
| GET | `/api/v1/super/tenants/stats` | Global statistics |
| GET | `/api/v1/super/tenants/{id}/features` | Get feature flags |
| PUT | `/api/v1/super/tenants/{id}/features` | Bulk update features |
| PATCH | `/api/v1/super/tenants/{id}/features/{key}/enable` | Enable feature |
| PATCH | `/api/v1/super/tenants/{id}/features/{key}/disable` | Disable feature |
| PUT | `/api/v1/super/tenants/{id}/plan` | Change subscription plan |

### School Admin Endpoints (SCHOOL_ADMIN role)
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/v1/users` | List / Create users |
| GET/PUT/DELETE | `/api/v1/users/{id}` | Get / Update / Delete user |
| PATCH | `/api/v1/users/{id}/status` | Activate/deactivate user |
| PATCH | `/api/v1/users/{id}/unlock` | Unlock locked account |
| POST | `/api/v1/users/bulk-import` | Bulk import from Excel |
| GET/POST | `/api/v1/students` | List / Create students |
| GET/PUT/DELETE | `/api/v1/students/{id}` | Get / Update / Delete student |
| POST | `/api/v1/students/bulk-promote` | Bulk promote students |
| GET/POST | `/api/v1/classes` | List / Create classes |
| GET/POST | `/api/v1/academic-years` | List / Create academic years |
| GET/PUT | `/api/v1/settings` | Get / Update school settings |

### Teacher Endpoints (TEACHER role)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/attendance/mark` | Mark attendance |
| GET | `/api/v1/attendance/class/{classId}` | View class attendance |
| POST | `/api/v1/exams` | Create exam |
| POST | `/api/v1/exams/marks` | Enter marks |
| POST | `/api/v1/notifications` | Send notification |
| POST | `/api/v1/whatsapp/send` | Send WhatsApp message |

### Common Authenticated Endpoints (All roles)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/users/me` | Current user profile |
| PUT | `/api/v1/users/me` | Update profile |
| GET | `/api/v1/dashboard` | Dashboard stats |
| GET | `/api/v1/notifications` | List notifications |
| PATCH | `/api/v1/notifications/{id}/read` | Mark as read |
| POST | `/api/v1/auth/logout` | Logout |
| POST | `/api/v1/auth/change-password` | Change password |

---

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `JWT_SECRET` | (built-in dev key) | JWT signing secret |
| `MAIL_HOST` | `smtp.gmail.com` | SMTP host for emails |
| `MAIL_USERNAME` | (empty) | SMTP username |
| `MAIL_PASSWORD` | (empty) | SMTP password |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Allowed CORS origins |
| `WHATSAPP_PHONE_NUMBER_ID` | (empty) | Meta WhatsApp phone ID |
| `WHATSAPP_ACCESS_TOKEN` | (empty) | Meta WhatsApp API token |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| 403 on http://localhost:8080 | Normal! Use Postman or Swagger UI, not browser |
| MongoClient bean not found | Make sure MongoDB is running on localhost:27017 |
| Login returns "Tenant not found" | Create a tenant first via Super Admin |
| Login returns "Invalid credentials" | Check email/password. Email is case-sensitive |
| Feature disabled error (403) | Enable the feature via Super Admin > Features |
| CORS error from frontend | Backend CORS allows localhost:5173 by default |
| WhatsApp messages fail | Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN |
