# EzRoom Backend System Design Specification

This document details the system design, directory layout, database schema, API specifications, and business logic implementation details for the EzRoom Backend.

---

## 1. Technology Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Web Framework**: Express
- **Database**: MongoDB (via Mongoose ODM)
- **File Upload**: Cloudinary SDK & Multer middleware
- **Scheduled Tasks**: Node-cron (for daily Escrow payout processing)
- **Testing Framework**: Jest & Supertest

---

## 2. Directory Structure

```text
ezroom-backend/
├── src/
│   ├── config/             # Connection configurations (MongoDB, Cloudinary, Env)
│   ├── controllers/        # Express handlers (User, Room, Contract, Invoice, Media, Admin)
│   ├── middlewares/        # Middlewares (Auth token, validation, Multer)
│   ├── models/             # Mongoose schemas & Typescript interfaces
│   ├── routes/             # Express API routes definition
│   ├── services/           # Service layer (Cloudinary upload, Escrow business logic)
│   ├── tasks/              # Scheduled Cron Jobs (Daily Escrow processor)
│   └── app.ts              # Express application initializer
├── tests/                  # Integration and unit tests
├── .env.example            # Environment variables template
├── tsconfig.json           # TypeScript configuration
└── package.json            # Dependencies and scripts
```

---

## 3. Database Schemas (Mongoose)

To align with the requirements, Mongoose is configured to automatically map `_id` to `id` (as a String) in JSON output, removing `_id` and `__v`.

```typescript
import mongoose from 'mongoose';

mongoose.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});
```

### 3.1 Users Collection
- **`id`**: String (Primary key, custom or MongoDB default stringified)
- **`name`**: String (Required)
- **`email`**: String (Unique, Required)
- **`phone`**: String (Required)
- **`avatarUrl`**: String (Nullable, Cloudinary secure URL)
- **`role`**: `'RENTER' | 'HOST'` (Required)
- **`isEkycVerified`**: Boolean (Default: `false`)
- **`creditScore`**: Number (Default: `0.0`)

### 3.2 Properties Collection
- **`id`**: String (Primary key)
- **`name`**: String (Required)
- **`type`**: `'SINGLE' | 'COMPLEX'` (Required)
- **`address`**: String (Required)
- **`detailedAddress`**: String (Required)
- **`description`**: String
- **`commonAmenities`**: Array of Strings
- **`latitude`**: Number (Required)
- **`longitude`**: Number (Required)
- **`isHidden`**: Boolean (Default: `false`)
- **`hostId`**: String (Reference: `Users`, Required)

### 3.3 Rooms Collection
- **`id`**: String (Primary key)
- **`propertyId`**: String (Reference: `Properties`, Nullable)
- **`title`**: String (Required)
- **`price`**: Number (64-bit equivalent VNĐ/month, Required)
- **`electricityPrice`**: Number (Default: `3500`)
- **`waterPrice`**: Number (Default: `15000`)
- **`address`**: String (Required)
- **`detailedAddress`**: String (Required)
- **`description`**: String
- **`structure`**: `'SINGLE' | 'WHOLE' | 'APARTMENT'` (Required)
- **`floorArea`**: Number (Required)
- **`mezzanineArea`**: Number (Default: `0.0`)
- **`detailedAreas`**: Array of `{ id: String, roomName: String, areaValue: Number }`
- **`images`**: Array of `{ url: String, category: String }`
- **`amenities`**: Array of `{ name: String, compensationAmount: Number }`
- **`status`**: `'ACTIVE' | 'RENTED' | 'PENDING' | 'HIDDEN' | 'REMOVED'` (Default: `'ACTIVE'`)
- **`latitude`**: Number (Required)
- **`longitude`**: Number (Required)
- **`isUserHidden`**: Boolean (Default: `false`)
- **`removalInfo`**: `{ reason: String, dateRemoved: String }` (Nullable)

### 3.4 Contracts Collection
- **`id`**: String (Primary key)
- **`roomId`**: String (Reference: `Rooms`, Required)
- **`renterId`**: String (Reference: `Users`, Required)
- **`renterName`**: String (Required)
- **`renterPhone`**: String (Required)
- **`hostName`**: String (Required)
- **`startDate`**: String (dd/MM/yyyy, Required)
- **`endDate`**: String (dd/MM/yyyy, Required)
- **`depositAmount`**: Number (Required)
- **`depositStatus`**: `'UNPAID' | 'FROZEN' | 'DISBURSED' | 'REFUNDED'` (Default: `'UNPAID'`)
- **`status`**: `'DRAFT' | 'WAITING_SIGN' | 'WAITING_DEPOSIT' | 'ACTIVE' | 'CANCELLED' | 'TERMINATED' | 'DISPUTED'` (Default: `'DRAFT'`)
- **`dateCreated`**: String (Required)
- **`dateSigned`**: String (Nullable)
- **`cancelReason`**: String (Nullable)
- **`cancelBy`**: `'HOST' | 'RENTER'` (Nullable)
- **`refundInfo`**: `{ bankName: String, accountNumber: String, accountOwner: String, status: 'PENDING' | 'COMPLETED' }` (Nullable)
- **`disburseDate`**: String (Nullable)
- **`isProtected`**: Boolean (Default: `false`)

### 3.5 Invoices Collection
- **`id`**: String (Primary key)
- **`roomId`**: String (Reference: `Rooms`, Required)
- **`roomName`**: String (Required)
- **`period`**: String (MM/yyyy, Required)
- **`roomPrice`**: Number (Required)
- **`oldElectricity`**: Number (Required)
- **`newElectricity`**: Number (Required)
- **`oldWater`**: Number (Required)
- **`newWater`**: Number (Required)
- **`otherCosts`**: Array of `{ reason: String, amount: Number }`
- **`status`**: `'UNPAID' | 'PAID'` (Default: `'UNPAID'`)
- **`type`**: String (Default: `'RENT'`)
- **`dateCreated`**: String (Required)
- **`paymentMethod`**: String (Nullable)
- **`commission`**: Number (Default: `0` - platform fee: 5% of `roomPrice` upon payment)
- **`finalRevenue`**: Number (Default: `0` - net host revenue: `totalAmount` - `commission`)

---

## 4. Key Business Logic

### 4.1 Escrow Deposit Lifecycle & Simulation Webhook
- **Payment Webhook Route**: `POST /api/payment-webhook`
  - Body: `{ "contractId": "String", "amount": Number, "status": "SUCCESS" }`
  - Trigger Logic:
    - Finds the contract by ID.
    - Verifies if `amount` matches the contract's `depositAmount`.
    - Updates `depositStatus` to `'FROZEN'`.
    - Updates the contract status to `'ACTIVE'`.
    - Updates `dateSigned` if not already set.

### 4.2 Cron Job Escrow Disbursal
- **Task Scheduling**: Runs every day at 00:00 (represented by `node-cron` or triggerable by helper endpoint `POST /api/tasks/run-escrow`).
- **Processing Logic**:
    - Queries all contracts where `depositStatus = "FROZEN"`, `status = "ACTIVE"`.
    - Compares current server date to the contract's `startDate` (parsed from `dd/MM/yyyy`).
    - If `currentDate >= startDate` and there are no active disputes (status is not `'DISPUTED'`), automatically changes `depositStatus` to `'DISBURSED'` and records the `disburseDate = format(currentDate, "dd/MM/yyyy")`.

### 4.3 Invoice Commission Hach Toan
- **API route**: `PATCH /api/invoices/:id/pay`
  - Body: `{ "paymentMethod": "String" }`
  - Logic:
    1. Retrieve the invoice and calculate the `totalAmount`:
       `totalAmount = roomPrice + (newElectricity - oldElectricity) * electricityPrice + (newWater - oldWater) * waterPrice + sum(otherCosts)`.
    2. Calculate commission (5% platform fee):
       `commission = roomPrice * 0.05`.
    3. Calculate host revenue:
       `finalRevenue = totalAmount - commission`.
    4. Save `commission`, `finalRevenue`, `paymentMethod`, and transition invoice `status` to `'PAID'`.

### 4.4 Admin Dispute Resolution API
- **API route**: `POST /api/admin/disputes/:id/resolve`
  - Body: `{ "status": "APPROVED" | "REJECTED", "resolutionNote": "String" }`
  - Logic:
    - If contract status is `'DISPUTED'`:
      - **`APPROVED`** (Renter Win):
        - `depositStatus` becomes `'REFUNDED'`.
        - Contract status becomes `'TERMINATED'`.
        - `refundInfo.status` becomes `'COMPLETED'`.
      - **`REJECTED`** (Host Win):
        - `depositStatus` becomes `'DISBURSED'`.
        - Contract status is restored to `'ACTIVE'`.
        - Set `disburseDate` to current date.

---

## 5. Media Upload API (`POST /api/media/upload`)

- **Form Field**: `file` (single multipart file)
- **Service**: Captures file using `multer`, uploads it to Cloudinary using `cloudinary.v2.uploader.upload_stream` (streaming without local disk write issues), and returns the secure URL.
- **Output JSON**:
  ```json
  {
    "success": true,
    "url": "https://res.cloudinary.com/..."
  }
  ```

---

## 6. Main API Endpoints Summary

### Auth
- `POST /api/auth/register` (Register RENTER/HOST)
- `POST /api/auth/login` (Login, returns mock JWT or user profile)
- `POST /api/profile/ekyc` (Host/Renter submits eKYC image URLs)

### Properties & Rooms
- `GET /api/properties` / `POST /api/properties` (Manage buildings)
- `GET /api/rooms` (Discovery & filtering list)
- `POST /api/rooms` (Create/Update room)

### Contracts
- `POST /api/contracts` (Create contract)
- `POST /api/contracts/:id/sign` (Sign contract)
- `POST /api/contracts/:id/payment` (Get dynamic VietQR for escrow deposit)

### Invoices
- `POST /api/invoices` (Host issues monthly invoice)
- `PATCH /api/invoices/:id/pay` (Renter pays invoice, runs commission logic)

### Admin Panel APIs
- `GET /api/admin/contracts` (View all contracts status)
- `GET /api/admin/disputes` (View all complaints/disputes)
- `POST /api/admin/disputes/:id/resolve` (Resolve dispute)
- `GET /api/admin/ekyc/pending` (List pending eKYC user details)
- `POST /api/admin/ekyc/:id/moderate` (Approve or reject eKYC)
- `GET /api/admin/rooms/moderation` & `POST /api/admin/rooms/:id/moderate` (Moderate room postings)
