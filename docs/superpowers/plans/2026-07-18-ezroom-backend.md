# EzRoom Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete TypeScript Express backend with MongoDB, integration tests, Cloudinary media upload, dynamic VietQR, escrow deposit management, platform fees invoicing, and admin resolution features.

**Architecture:** Layered MVC architecture (Routes -> Controllers -> Models & Services). Uses Mongoose ODM. Features global serialization config to convert database `_id` to standard `id` strings, automated `node-cron` jobs, and direct Cloudinary streaming.

**Tech Stack:** Node.js, TypeScript, Express, Mongoose, Multer, Cloudinary SDK, Node-cron, Jest, Supertest, Ts-jest.

## Global Constraints

- Absolute URL fields returned by MongoDB for image endpoints must point to Cloudinary.
- Do not store raw media files in the database.
- Every API JSON response must expose primary keys as `id` instead of `_id`.
- Commission fees must be exactly 5% of `roomPrice` for invoices.
- Database name is `vietnam_provinces` (reusing the existing database instance).

---

### Task 1: Environment Setup, TypeScript Configuration, Database Connection & Global JSON Id Mapping

**Files:**
- Create: `tsconfig.json`
- Create: `src/config/db.ts`
- Modify: `package.json`
- Modify: `tests/app.test.js` (temporarily run existing tests)

**Interfaces:**
- Consumes: None
- Produces: `connectDb` and `closeDb` functions in `src/config/db.ts`

- [ ] **Step 1: Install TypeScript & ts-jest dependencies**

Run in terminal:
```powershell
npm install typescript ts-node @types/node @types/express @types/jest ts-jest mongoose dotenv multer cloudinary @types/multer node-cron @types/node-cron --save-dev
```

- [ ] **Step 2: Create TypeScript Configuration**

Create `tsconfig.json` with the following content:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "allowJs": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Modify package.json scripts**

Update `package.json` to include build, ts-start, and ts-test scripts.
```json
{
  "name": "ezroom-backend",
  "version": "1.0.0",
  "description": "EzRoom backend API",
  "main": "dist/app.js",
  "scripts": {
    "start": "node dist/app.js",
    "dev": "ts-node src/app.ts",
    "build": "tsc",
    "test": "jest --detectOpenHandles --forceExit"
  },
  "dependencies": {
    "cloudinary": "^2.2.0",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "mongodb": "^6.5.0",
    "mongoose": "^8.3.1",
    "multer": "^1.4.5-lts.1",
    "node-cron": "^3.0.3"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.12",
    "@types/multer": "^1.4.11",
    "@types/node": "^20.12.7",
    "@types/node-cron": "^3.0.11",
    "jest": "^29.7.0",
    "supertest": "^6.3.4",
    "ts-jest": "^29.1.2",
    "ts-node": "^10.9.2",
    "typescript": "^5.4.5"
  }
}
```

- [ ] **Step 4: Initialize Jest to use ts-jest**

Create `jest.config.js` in the project root:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.(ts|js)'],
};
```

- [ ] **Step 5: Write MongoDB Connection and Global JSON Serializer in TypeScript**

Create `src/config/db.ts`:
```typescript
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.MONGODB_URI || 'mongodb://localhost:27017/vietnam_provinces';

// Global transformation to map _id to id
mongoose.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

let isConnected = false;

export async function connectDb() {
  if (isConnected) return mongoose.connection.db;
  await mongoose.connect(url);
  isConnected = true;
  return mongoose.connection.db;
}

export async function closeDb() {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
  }
}
```

- [ ] **Step 6: Setup app.ts and health route in TypeScript**

Create `src/app.ts`:
```typescript
import express from 'express';
import { connectDb } from './config/db';

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api/provinces', async (req, res) => {
  try {
    const db = await connectDb();
    if (!db) {
      return res.status(500).json({ success: false, error: 'Database connection failed.' });
    }
    const rawProvinces = await db.collection('provinces').find({}).toArray();
    const mapped = rawProvinces.map((prov: any) => ({
      code: prov.Code,
      name: prov.Name,
      fullName: prov.FullName,
      codeName: prov.CodeName,
      type: prov.Type,
      administrativeUnitId: prov.AdministrativeUnitId,
      wards: (prov.Wards || []).map((ward: any) => ({
        code: ward.Code,
        name: ward.Name,
        fullName: ward.FullName,
        codeName: ward.CodeName,
        type: ward.Type,
        administrativeUnitId: ward.AdministrativeUnitId
      }))
    }));
    res.status(200).json(mapped);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, error: 'Database connection failed.' });
  }
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
  });
}

export default app;
```

- [ ] **Step 7: Run health and province tests with Jest to ensure setup works**

Rename `tests/app.test.js` to `tests/app.test.ts` and modify imports:
```typescript
import request from 'supertest';
import app from '../src/app';
import { closeDb } from '../src/config/db';

afterAll(async () => {
  await closeDb();
});

describe('GET /health', () => {
  it('should return 200 OK and status ok', async () => {
    const res = await request(app)
      .get('/health')
      .expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
```

Run test suite:
```powershell
npm test
```
Expected: PASS

- [ ] **Step 8: Commit setup**

```powershell
git add package.json tsconfig.json jest.config.js src/config/db.ts src/app.ts tests/app.test.ts
git commit -m "feat: set up typescript express environment and mongoose db connection"
```

---

### Task 2: Cloudinary Media Upload Service and Route

**Files:**
- Create: `src/config/cloudinary.ts`
- Create: `src/middlewares/multer.ts`
- Create: `src/routes/media.ts`
- Modify: `src/app.ts` (import and use media router)
- Test: `tests/media.test.ts`

**Interfaces:**
- Consumes: None
- Produces: `POST /api/media/upload` returns `{"success": true, "url": "https://res.cloudinary.com/..."}`

- [ ] **Step 1: Write Cloudinary Configuration and Upload Middleware**

Create `src/config/cloudinary.ts`:
```typescript
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'mock_cloud',
  api_key: process.env.CLOUDINARY_API_KEY || 'mock_key',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'mock_secret',
});

export default cloudinary;
```

Create `src/middlewares/multer.ts` to accept image uploads in memory:
```typescript
import multer from 'multer';

const storage = multer.memoryStorage();
export const upload = multer({ storage });
```

- [ ] **Step 2: Create Media Routes and Stream Upload Logic**

Create `src/routes/media.ts`:
```typescript
import { Router, Request, Response } from 'express';
import { upload } from '../middlewares/multer';
import cloudinary from '../config/cloudinary';

const router = Router();

router.post('/upload', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded.' });
  }

  // Stream upload directly to cloudinary
  const stream = cloudinary.uploader.upload_stream(
    { folder: 'ezroom' },
    (error, result) => {
      if (error || !result) {
        console.error('Cloudinary upload error:', error);
        return res.status(500).json({ success: false, error: 'Upload failed.' });
      }
      return res.status(200).json({ success: true, url: result.secure_url });
    }
  );

  stream.end(req.file.buffer);
});

export default router;
```

- [ ] **Step 3: Register Media Router in App**

Modify `src/app.ts` to register `/api/media`:
```typescript
// Import at top
import mediaRouter from './routes/media';

// Add after app.use(express.json());
app.use('/api/media', mediaRouter);
```

- [ ] **Step 4: Write Media Upload API tests (Mocking Cloudinary SDK)**

Create `tests/media.test.ts`:
```typescript
import request from 'supertest';
import app from '../src/app';
import cloudinary from '../src/config/cloudinary';

// Mock Cloudinary uploader.upload_stream
jest.spyOn(cloudinary.uploader, 'upload_stream').mockImplementation((options: any, callback?: any) => {
  const mockWritableStream: any = {
    write: jest.fn(),
    end: jest.fn(() => {
      if (callback) {
        callback(null, { secure_url: 'https://res.cloudinary.com/mock_cloud/image/upload/v12345/room_image.jpg' });
      }
    }),
  };
  return mockWritableStream;
});

describe('POST /api/media/upload', () => {
  it('should upload a mock image file to Cloudinary and return secure URL', async () => {
    const res = await request(app)
      .post('/api/media/upload')
      .attach('file', Buffer.from('fake image content'), 'test.png')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.url).toBe('https://res.cloudinary.com/mock_cloud/image/upload/v12345/room_image.jpg');
  });

  it('should return 400 bad request if no file is provided', async () => {
    const res = await request(app)
      .post('/api/media/upload')
      .expect(400);

    expect(res.body.success).toBe(false);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm test tests/media.test.ts`
Expected: PASS

- [ ] **Step 6: Commit media changes**

```powershell
git add src/config/cloudinary.ts src/middlewares/multer.ts src/routes/media.ts src/app.ts tests/media.test.ts
git commit -m "feat: add cloudinary integration and media upload api"
```

---

### Task 3: Users Database Model & Authentication APIs

**Files:**
- Create: `src/models/user.ts`
- Create: `src/controllers/auth.ts`
- Create: `src/routes/auth.ts`
- Modify: `src/app.ts` (register auth routes)
- Test: `tests/auth.test.ts`

**Interfaces:**
- Consumes: None
- Produces:
  - `POST /api/auth/register` (Register RENTER/HOST)
  - `POST /api/auth/login` (Login with validation)
  - `POST /api/profile/ekyc` (Submits eKYC verification details)

- [ ] **Step 1: Write Mongoose User Schema**

Create `src/models/user.ts`:
```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  role: 'RENTER' | 'HOST';
  isEkycVerified: boolean;
  creditScore: number;
}

const UserSchema = new Schema<IUser>({
  _id: { type: String, required: true }, // Custom string identifier or UUID
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  avatarUrl: { type: String, default: null },
  role: { type: String, enum: ['RENTER', 'HOST'], required: true },
  isEkycVerified: { type: Boolean, default: false },
  creditScore: { type: Number, default: 0.0 }
}, {
  _id: false // Disable auto _id generation to use string type key explicitly
});

export const User = mongoose.model<IUser>('User', UserSchema);
```

- [ ] **Step 2: Create Auth Routes and Controller**

Create `src/controllers/auth.ts`:
```typescript
import { Request, Response } from 'express';
import { User } from '../models/user';

export async function register(req: Request, res: Response) {
  try {
    const { id, name, email, phone, avatarUrl, role } = req.body;
    if (!id || !name || !email || !phone || !role) {
      return res.status(400).json({ success: false, error: 'Missing required registration parameters' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Email already registered.' });
    }

    const user = new User({ _id: id, name, email, phone, avatarUrl, role });
    await user.save();
    return res.status(201).json({ success: true, user });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.status(200).json({ success: true, token: 'mock-jwt-token', user });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function submitEkyc(req: Request, res: Response) {
  try {
    const { userId, idCardNumber, frontImageUrl, backImageUrl } = req.body;
    if (!userId || !idCardNumber || !frontImageUrl || !backImageUrl) {
      return res.status(400).json({ success: false, error: 'Missing eKYC documents.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    // Update isEkycVerified status to false initially (pending admin review)
    user.isEkycVerified = false;
    await user.save();

    return res.status(200).json({ success: true, message: 'eKYC documents submitted. Awaiting moderation.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
```

Create `src/routes/auth.ts`:
```typescript
import { Router } from 'express';
import { register, login, submitEkyc } from '../controllers/auth';

const router = Router();
router.post('/register', register);
router.post('/login', login);
router.post('/profile/ekyc', submitEkyc);

export default router;
```

- [ ] **Step 3: Modify app.ts to Register Auth Routes**

Import and add Auth routes in `src/app.ts`:
```typescript
// Import
import authRouter from './routes/auth';

// Add
app.use('/api', authRouter); // maps /api/auth/register, /api/auth/login, /api/profile/ekyc
```

- [ ] **Step 4: Write tests for User Registration, Login & eKYC Submission**

Create `tests/auth.test.ts`:
```typescript
import request from 'supertest';
import app from '../src/app';
import { User } from '../src/models/user';
import { connectDb, closeDb } from '../src/config/db';

beforeAll(async () => {
  await connectDb();
  await User.deleteMany({});
});

afterAll(async () => {
  await User.deleteMany({});
  await closeDb();
});

describe('Auth APIs', () => {
  const mockUser = {
    id: 'user_1',
    name: 'Nguyen Van A',
    email: 'renter@ezroom.vn',
    phone: '0901234567',
    role: 'RENTER'
  };

  it('should register a new user successfully', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(mockUser)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.user.id).toBe(mockUser.id);
    expect(res.body.user.isEkycVerified).toBe(false);
  });

  it('should login successfully', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: mockUser.email })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(mockUser.email);
  });

  it('should submit eKYC details and await moderation', async () => {
    const res = await request(app)
      .post('/api/profile/ekyc')
      .send({
        userId: mockUser.id,
        idCardNumber: '123456789012',
        frontImageUrl: 'https://cloudinary.com/front.jpg',
        backImageUrl: 'https://cloudinary.com/back.jpg'
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('awaiting moderation');
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm test tests/auth.test.ts`
Expected: PASS

- [ ] **Step 6: Commit auth files**

```powershell
git add src/models/user.ts src/controllers/auth.ts src/routes/auth.ts src/app.ts tests/auth.test.ts
git commit -m "feat: add user model and auth/ekyc submission endpoints"
```

---

### Task 4: Properties & Rooms Database Models and APIs

**Files:**
- Create: `src/models/property.ts`
- Create: `src/models/room.ts`
- Create: `src/controllers/property.ts`
- Create: `src/controllers/room.ts`
- Create: `src/routes/property.ts`
- Create: `src/routes/room.ts`
- Modify: `src/app.ts` (register property & room routes)
- Test: `tests/room.test.ts`

**Interfaces:**
- Consumes: None
- Produces:
  - `GET /api/properties`, `POST /api/properties`
  - `GET /api/rooms`, `POST /api/rooms`

- [ ] **Step 1: Write Properties Schema**

Create `src/models/property.ts`:
```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface IProperty extends Document {
  id: string;
  name: string;
  type: 'SINGLE' | 'COMPLEX';
  address: string;
  detailedAddress: string;
  description?: string;
  commonAmenities: string[];
  latitude: number;
  longitude: number;
  isHidden: boolean;
  hostId: string;
}

const PropertySchema = new Schema<IProperty>({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['SINGLE', 'COMPLEX'], required: true },
  address: { type: String, required: true },
  detailedAddress: { type: String, required: true },
  description: { type: String },
  commonAmenities: [{ type: String }],
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  isHidden: { type: Boolean, default: false },
  hostId: { type: String, required: true }
}, {
  _id: false
});

export const Property = mongoose.model<IProperty>('Property', PropertySchema);
```

- [ ] **Step 2: Write Rooms Schema**

Create `src/models/room.ts`:
```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface IRoom extends Document {
  id: string;
  propertyId?: string;
  title: string;
  price: number;
  electricityPrice: number;
  waterPrice: number;
  address: string;
  detailedAddress: string;
  description?: string;
  structure: 'SINGLE' | 'WHOLE' | 'APARTMENT';
  floorArea: number;
  mezzanineArea: number;
  detailedAreas: Array<{ id: string; roomName: string; areaValue: number }>;
  images: Array<{ url: string; category: string }>;
  amenities: Array<{ name: string; compensationAmount: number }>;
  status: 'ACTIVE' | 'RENTED' | 'PENDING' | 'HIDDEN' | 'REMOVED';
  latitude: number;
  longitude: number;
  isUserHidden: boolean;
  removalInfo?: { reason: string; dateRemoved: string };
}

const RoomSchema = new Schema<IRoom>({
  _id: { type: String, required: true },
  propertyId: { type: String, default: null },
  title: { type: String, required: true },
  price: { type: Number, required: true },
  electricityPrice: { type: Number, default: 3500 },
  waterPrice: { type: Number, default: 15000 },
  address: { type: String, required: true },
  detailedAddress: { type: String, required: true },
  description: { type: String },
  structure: { type: String, enum: ['SINGLE', 'WHOLE', 'APARTMENT'], required: true },
  floorArea: { type: Number, required: true },
  mezzanineArea: { type: Number, default: 0.0 },
  detailedAreas: [
    {
      id: { type: String, required: true },
      roomName: { type: String, required: true },
      areaValue: { type: Number, required: true }
    }
  ],
  images: [
    {
      url: { type: String, required: true },
      category: { type: String, required: true }
    }
  ],
  amenities: [
    {
      name: { type: String, required: true },
      compensationAmount: { type: Number, required: true }
    }
  ],
  status: { type: String, enum: ['ACTIVE', 'RENTED', 'PENDING', 'HIDDEN', 'REMOVED'], default: 'ACTIVE' },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  isUserHidden: { type: Boolean, default: false },
  removalInfo: {
    reason: { type: String },
    dateRemoved: { type: String }
  }
}, {
  _id: false
});

export const Room = mongoose.model<IRoom>('Room', RoomSchema);
```

- [ ] **Step 3: Create Property and Room Controllers**

Create `src/controllers/property.ts`:
```typescript
import { Request, Response } from 'express';
import { Property } from '../models/property';

export async function createProperty(req: Request, res: Response) {
  try {
    const { id, name, type, address, detailedAddress, description, commonAmenities, latitude, longitude, hostId } = req.body;
    if (!id || !name || !type || !address || !detailedAddress || latitude === undefined || longitude === undefined || !hostId) {
      return res.status(400).json({ success: false, error: 'Missing properties required fields.' });
    }
    const prop = new Property({ _id: id, name, type, address, detailedAddress, description, commonAmenities, latitude, longitude, hostId });
    await prop.save();
    return res.status(201).json({ success: true, property: prop });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getProperties(req: Request, res: Response) {
  try {
    const props = await Property.find({});
    return res.status(200).json(props);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
```

Create `src/controllers/room.ts`:
```typescript
import { Request, Response } from 'express';
import { Room } from '../models/room';

export async function createRoom(req: Request, res: Response) {
  try {
    const { id, propertyId, title, price, electricityPrice, waterPrice, address, detailedAddress, description, structure, floorArea, mezzanineArea, detailedAreas, images, amenities, latitude, longitude } = req.body;
    if (!id || !title || price === undefined || !address || !detailedAddress || !structure || floorArea === undefined || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, error: 'Missing room required fields.' });
    }
    const room = new Room({
      _id: id, propertyId, title, price, electricityPrice, waterPrice, address, detailedAddress, description, structure, floorArea, mezzanineArea, detailedAreas, images, amenities, latitude, longitude
    });
    await room.save();
    return res.status(201).json({ success: true, room });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getRooms(req: Request, res: Response) {
  try {
    // Only show active and non-user-hidden rooms for discovery API
    const rooms = await Room.find({ status: 'ACTIVE', isUserHidden: false });
    return res.status(200).json(rooms);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
```

- [ ] **Step 4: Create Routes for Properties and Rooms**

Create `src/routes/property.ts`:
```typescript
import { Router } from 'express';
import { createProperty, getProperties } from '../controllers/property';

const router = Router();
router.post('/properties', createProperty);
router.get('/properties', getProperties);

export default router;
```

Create `src/routes/room.ts`:
```typescript
import { Router } from 'express';
import { createRoom, getRooms } from '../controllers/room';

const router = Router();
router.post('/rooms', createRoom);
router.get('/rooms', getRooms);

export default router;
```

- [ ] **Step 5: Modify app.ts to Register Routes**

Add to `src/app.ts`:
```typescript
import propertyRouter from './routes/property';
import roomRouter from './routes/room';

app.use('/api', propertyRouter);
app.use('/api', roomRouter);
```

- [ ] **Step 6: Write Room and Property Tests**

Create `tests/room.test.ts`:
```typescript
import request from 'supertest';
import app from '../src/app';
import { Property } from '../src/models/property';
import { Room } from '../src/models/room';
import { connectDb, closeDb } from '../src/config/db';

beforeAll(async () => {
  await connectDb();
  await Property.deleteMany({});
  await Room.deleteMany({});
});

afterAll(async () => {
  await Property.deleteMany({});
  await Room.deleteMany({});
  await closeDb();
});

describe('Properties & Rooms APIs', () => {
  const mockProp = {
    id: 'prop_1',
    name: 'EzBuilding A',
    type: 'COMPLEX',
    address: '123 Nguyen Trai, Q5, HCMC',
    detailedAddress: 'Lau 2, 123 Nguyen Trai, Q5, HCMC',
    latitude: 10.762622,
    longitude: 106.660172,
    hostId: 'user_1'
  };

  const mockRoom = {
    id: 'room_1',
    propertyId: 'prop_1',
    title: 'Phong tro gia re gan DH KHTN',
    price: 3000000,
    address: '123 Nguyen Trai, Q5, HCMC',
    detailedAddress: 'Phong 201, 123 Nguyen Trai, Q5, HCMC',
    structure: 'SINGLE',
    floorArea: 25,
    images: [{ url: 'https://cloudinary.com/testroom.jpg', category: 'THUMBNAIL' }],
    latitude: 10.762622,
    longitude: 106.660172
  };

  it('should create and retrieve properties', async () => {
    const createRes = await request(app)
      .post('/api/properties')
      .send(mockProp)
      .expect(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.property.id).toBe(mockProp.id);

    const getRes = await request(app)
      .get('/api/properties')
      .expect(200);
    expect(getRes.body.length).toBeGreaterThan(0);
    expect(getRes.body[0].id).toBe(mockProp.id);
  });

  it('should create and retrieve rooms for discovery', async () => {
    const createRes = await request(app)
      .post('/api/rooms')
      .send(mockRoom)
      .expect(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.room.id).toBe(mockRoom.id);

    const getRes = await request(app)
      .get('/api/rooms')
      .expect(200);
    expect(getRes.body.length).toBeGreaterThan(0);
    expect(getRes.body[0].id).toBe(mockRoom.id);
  });
});
```

- [ ] **Step 7: Run tests**

Run: `npm test tests/room.test.ts`
Expected: PASS

- [ ] **Step 8: Commit property and room changes**

```powershell
git add src/models/property.ts src/models/room.ts src/controllers/property.ts src/controllers/room.ts src/routes/property.ts src/routes/room.ts src/app.ts tests/room.test.ts
git commit -m "feat: add property and room models and APIs with JSON id mappings"
```

---

### Task 5: Contracts Model, Sign, payment QR, and Escrow Webhook

**Files:**
- Create: `src/models/contract.ts`
- Create: `src/controllers/contract.ts`
- Create: `src/routes/contract.ts`
- Create: `src/controllers/webhook.ts`
- Create: `src/routes/webhook.ts`
- Modify: `src/app.ts` (register routes)
- Test: `tests/contract.test.ts`

**Interfaces:**
- Consumes: `Room`, `User` Models
- Produces:
  - `POST /api/contracts`
  - `POST /api/contracts/:id/sign`
  - `POST /api/contracts/:id/payment`
  - `POST /api/payment-webhook`

- [ ] **Step 1: Write Contracts Schema**

Create `src/models/contract.ts`:
```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface IContract extends Document {
  id: string;
  roomId: string;
  renterId: string;
  renterName: string;
  renterPhone: string;
  hostName: string;
  startDate: string; // dd/MM/yyyy
  endDate: string; // dd/MM/yyyy
  depositAmount: number;
  depositStatus: 'UNPAID' | 'FROZEN' | 'DISBURSED' | 'REFUNDED';
  status: 'DRAFT' | 'WAITING_SIGN' | 'WAITING_DEPOSIT' | 'ACTIVE' | 'CANCELLED' | 'TERMINATED' | 'DISPUTED';
  dateCreated: string;
  dateSigned?: string;
  cancelReason?: string;
  cancelBy?: 'HOST' | 'RENTER';
  refundInfo?: {
    bankName: string;
    accountNumber: string;
    accountOwner: string;
    status: 'PENDING' | 'COMPLETED';
  };
  disburseDate?: string;
  isProtected: boolean;
}

const ContractSchema = new Schema<IContract>({
  _id: { type: String, required: true },
  roomId: { type: String, required: true },
  renterId: { type: String, required: true },
  renterName: { type: String, required: true },
  renterPhone: { type: String, required: true },
  hostName: { type: String, required: true },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  depositAmount: { type: Number, required: true },
  depositStatus: { type: String, enum: ['UNPAID', 'FROZEN', 'DISBURSED', 'REFUNDED'], default: 'UNPAID' },
  status: { type: String, enum: ['DRAFT', 'WAITING_SIGN', 'WAITING_DEPOSIT', 'ACTIVE', 'CANCELLED', 'TERMINATED', 'DISPUTED'], default: 'DRAFT' },
  dateCreated: { type: String, required: true },
  dateSigned: { type: String, default: null },
  cancelReason: { type: String, default: null },
  cancelBy: { type: String, enum: ['HOST', 'RENTER'], default: null },
  refundInfo: {
    bankName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    accountOwner: { type: String, default: '' },
    status: { type: String, enum: ['PENDING', 'COMPLETED'], default: 'PENDING' }
  },
  disburseDate: { type: String, default: null },
  isProtected: { type: Boolean, default: false }
}, {
  _id: false
});

export const Contract = mongoose.model<IContract>('Contract', ContractSchema);
```

- [ ] **Step 2: Create Contract Controller**

Create `src/controllers/contract.ts`:
```typescript
import { Request, Response } from 'express';
import { Contract } from '../models/contract';

export async function createContract(req: Request, res: Response) {
  try {
    const { id, roomId, renterId, renterName, renterPhone, hostName, startDate, endDate, depositAmount, isProtected } = req.body;
    if (!id || !roomId || !renterId || !renterName || !renterPhone || !hostName || !startDate || !endDate || depositAmount === undefined) {
      return res.status(400).json({ success: false, error: 'Missing contract required parameters.' });
    }
    const contract = new Contract({
      _id: id, roomId, renterId, renterName, renterPhone, hostName, startDate, endDate, depositAmount,
      depositStatus: 'UNPAID', status: 'DRAFT', dateCreated: new Date().toLocaleDateString('vi-VN'), isProtected
    });
    await contract.save();
    return res.status(201).json({ success: true, contract });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function signContract(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contract not found.' });
    }

    contract.status = 'WAITING_DEPOSIT';
    contract.dateSigned = new Date().toLocaleDateString('vi-VN');
    await contract.save();

    return res.status(200).json({ success: true, contract });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getPaymentQR(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contract not found.' });
    }

    // Generate simulated VietQR code
    const mockQRUrl = `https://img.vietqr.io/image/MB-123456789-compact.png?amount=${contract.depositAmount}&addInfo=EzRoom_Deposit_${contract.id}`;
    return res.status(200).json({ success: true, qrUrl: mockQRUrl, depositAmount: contract.depositAmount });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
```

Create `src/routes/contract.ts`:
```typescript
import { Router } from 'express';
import { createContract, signContract, getPaymentQR } from '../controllers/contract';

const router = Router();
router.post('/contracts', createContract);
router.post('/contracts/:id/sign', signContract);
router.post('/contracts/:id/payment', getPaymentQR);

export default router;
```

- [ ] **Step 3: Create Payment Webhook Controller to freeze deposit**

Create `src/controllers/webhook.ts`:
```typescript
import { Request, Response } from 'express';
import { Contract } from '../models/contract';

export async function paymentWebhook(req: Request, res: Response) {
  try {
    const { contractId, amount, status } = req.body;
    if (!contractId || amount === undefined || !status) {
      return res.status(400).json({ success: false, error: 'Missing webhook data' });
    }

    if (status !== 'SUCCESS') {
      return res.status(200).json({ success: true, message: 'Non-success payment status ignored.' });
    }

    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contract not found.' });
    }

    if (amount < contract.depositAmount) {
      return res.status(400).json({ success: false, error: 'Insufficient deposit amount paid.' });
    }

    // Freeze the deposit in escrow and activate contract
    contract.depositStatus = 'FROZEN';
    contract.status = 'ACTIVE';
    await contract.save();

    return res.status(200).json({ success: true, message: 'Deposit frozen successfully in Escrow.', contract });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
```

Create `src/routes/webhook.ts`:
```typescript
import { Router } from 'express';
import { paymentWebhook } from '../controllers/webhook';

const router = Router();
router.post('/payment-webhook', paymentWebhook);

export default router;
```

- [ ] **Step 4: Modify app.ts to Register Contract and Webhook Routes**

Add to `src/app.ts`:
```typescript
import contractRouter from './routes/contract';
import webhookRouter from './routes/webhook';

app.use('/api', contractRouter);
app.use('/api', webhookRouter);
```

- [ ] **Step 5: Write Integration Tests for Contracts & Webhook**

Create `tests/contract.test.ts`:
```typescript
import request from 'supertest';
import app from '../src/app';
import { Contract } from '../src/models/contract';
import { connectDb, closeDb } from '../src/config/db';

beforeAll(async () => {
  await connectDb();
  await Contract.deleteMany({});
});

afterAll(async () => {
  await Contract.deleteMany({});
  await closeDb();
});

describe('Contracts & Webhook APIs', () => {
  const mockContract = {
    id: 'contract_1',
    roomId: 'room_1',
    renterId: 'user_1',
    renterName: 'Renter One',
    renterPhone: '0987654321',
    hostName: 'Host One',
    startDate: '20/07/2026',
    endDate: '20/07/2027',
    depositAmount: 5000000,
    isProtected: true
  };

  it('should draft a contract and sign it', async () => {
    // 1. Draft Contract
    const draftRes = await request(app)
      .post('/api/contracts')
      .send(mockContract)
      .expect(201);
    expect(draftRes.body.success).toBe(true);
    expect(draftRes.body.contract.status).toBe('DRAFT');
    expect(draftRes.body.contract.depositStatus).toBe('UNPAID');

    // 2. Sign Contract
    const signRes = await request(app)
      .post(`/api/contracts/${mockContract.id}/sign`)
      .expect(200);
    expect(signRes.body.contract.status).toBe('WAITING_DEPOSIT');
    expect(signRes.body.contract.dateSigned).toBeDefined();

    // 3. Get Payment QR
    const qrRes = await request(app)
      .post(`/api/contracts/${mockContract.id}/payment`)
      .expect(200);
    expect(qrRes.body.qrUrl).toContain('vietqr.io');
  });

  it('should handle webhook to freeze deposit (Escrow)', async () => {
    const res = await request(app)
      .post('/api/payment-webhook')
      .send({
        contractId: mockContract.id,
        amount: mockContract.depositAmount,
        status: 'SUCCESS'
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.contract.depositStatus).toBe('FROZEN');
    expect(res.body.contract.status).toBe('ACTIVE');
  });
});
```

- [ ] **Step 6: Run tests**

Run: `npm test tests/contract.test.ts`
Expected: PASS

- [ ] **Step 7: Commit contract changes**

```powershell
git add src/models/contract.ts src/controllers/contract.ts src/routes/contract.ts src/controllers/webhook.ts src/routes/webhook.ts src/app.ts tests/contract.test.ts
git commit -m "feat: add contract sign payment qr and escrow payment webhook APIs"
```

---

### Task 6: Cron Jobs & Admin Dispute Resolution APIs

**Files:**
- Create: `src/tasks/escrow.ts`
- Create: `src/controllers/admin.ts`
- Create: `src/routes/admin.ts`
- Modify: `src/app.ts` (register admin routes & start tasks)
- Test: `tests/admin.test.ts`

**Interfaces:**
- Consumes: `Contract`, `User` Models
- Produces:
  - Daily scheduler using `node-cron`
  - `GET /api/admin/contracts`
  - `GET /api/admin/disputes`
  - `POST /api/admin/disputes/:id/resolve` (Renter win / Host win)
  - `POST /api/admin/tasks/run-escrow` (API trigger to simulate cron run)

- [ ] **Step 1: Write Escrow Cron Job and Simulation Service**

Create `src/tasks/escrow.ts`:
```typescript
import { Contract } from '../models/contract';

// Helper function to parse dd/MM/yyyy to Date object
export function parseDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split('/').map(Number);
  return new Date(year, month - 1, day);
}

export async function processEscrowDisbursals() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find active contracts with frozen deposit
    const contracts = await Contract.find({
      depositStatus: 'FROZEN',
      status: 'ACTIVE'
    });

    let count = 0;
    for (const contract of contracts) {
      const startDate = parseDate(contract.startDate);
      if (today >= startDate) {
        contract.depositStatus = 'DISBURSED';
        contract.disburseDate = today.toLocaleDateString('vi-VN');
        await contract.save();
        count++;
      }
    }
    console.log(`[Escrow Job] Automatically disbursed ${count} contract deposit payouts.`);
    return count;
  } catch (error) {
    console.error('[Escrow Job Error]:', error);
    return 0;
  }
}
```

- [ ] **Step 2: Create Admin Controllers**

Create `src/controllers/admin.ts`:
```typescript
import { Request, Response } from 'express';
import { Contract } from '../models/contract';
import { User } from '../models/user';
import { Room } from '../models/room';
import { processEscrowDisbursals } from '../tasks/escrow';

export async function getAdminContracts(req: Request, res: Response) {
  try {
    const contracts = await Contract.find({});
    return res.status(200).json(contracts);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getAdminDisputes(req: Request, res: Response) {
  try {
    // Return all contracts currently in DISPUTED status
    const disputes = await Contract.find({ status: 'DISPUTED' });
    return res.status(200).json(disputes);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function resolveDispute(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, resolutionNote } = req.body; // status can be APPROVED (renter win) or REJECTED (host win)
    if (!status || !resolutionNote) {
      return res.status(400).json({ success: false, error: 'Missing status or resolution note.' });
    }

    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contract not found.' });
    }

    if (status === 'APPROVED') {
      // Approve renter claim -> refund Renter
      contract.depositStatus = 'REFUNDED';
      contract.status = 'TERMINATED';
      if (!contract.refundInfo) {
        contract.refundInfo = { bankName: '', accountNumber: '', accountOwner: '', status: 'PENDING' };
      }
      contract.refundInfo.status = 'COMPLETED';
    } else if (status === 'REJECTED') {
      // Reject renter claim -> disburse to Host
      contract.depositStatus = 'DISBURSED';
      contract.status = 'ACTIVE';
      contract.disburseDate = new Date().toLocaleDateString('vi-VN');
    } else {
      return res.status(400).json({ success: false, error: 'Invalid resolution status. Must be APPROVED or REJECTED.' });
    }

    await contract.save();
    return res.status(200).json({ success: true, message: 'Dispute resolved.', contract });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function triggerEscrowTask(req: Request, res: Response) {
  const processed = await processEscrowDisbursals();
  return res.status(200).json({ success: true, processed });
}
```

Create `src/routes/admin.ts`:
```typescript
import { Router } from 'express';
import { getAdminContracts, getAdminDisputes, resolveDispute, triggerEscrowTask } from '../controllers/admin';

const router = Router();
router.get('/admin/contracts', getAdminContracts);
router.get('/admin/disputes', getAdminDisputes);
router.post('/admin/disputes/:id/resolve', resolveDispute);
router.post('/admin/tasks/run-escrow', triggerEscrowTask);

export default router;
```

- [ ] **Step 3: Modify app.ts to Register Admin Routes & Init Cron Job**

Add to `src/app.ts`:
```typescript
import cron from 'node-cron';
import adminRouter from './routes/admin';
import { processEscrowDisbursals } from './tasks/escrow';

app.use('/api', adminRouter);

// Start Cron task (every day at 00:00)
cron.schedule('0 0 * * *', async () => {
  await processEscrowDisbursals();
});
```

- [ ] **Step 4: Write Dispute Resolution & Cron Job Tests**

Create `tests/admin.test.ts`:
```typescript
import request from 'supertest';
import app from '../src/app';
import { Contract } from '../src/models/contract';
import { connectDb, closeDb } from '../src/config/db';

beforeAll(async () => {
  await connectDb();
  await Contract.deleteMany({});
});

afterAll(async () => {
  await Contract.deleteMany({});
  await closeDb();
});

describe('Admin panel & Cron task APIs', () => {
  it('should process frozen escrow payouts on startDate', async () => {
    // 1. Create a contract scheduled to start today (starts right now)
    const todayStr = new Date().toLocaleDateString('vi-VN');
    const contract = new Contract({
      _id: 'contract_cron',
      roomId: 'room_1',
      renterId: 'user_1',
      renterName: 'Renter',
      renterPhone: '09876',
      hostName: 'Host',
      startDate: todayStr,
      endDate: '20/12/2026',
      depositAmount: 4000000,
      depositStatus: 'FROZEN',
      status: 'ACTIVE',
      dateCreated: todayStr
    });
    await contract.save();

    // 2. Trigger task manually
    const res = await request(app)
      .post('/api/admin/tasks/run-escrow')
      .expect(200);

    expect(res.body.processed).toBe(1);

    const updated = await Contract.findById('contract_cron');
    expect(updated?.depositStatus).toBe('DISBURSED');
    expect(updated?.disburseDate).toBe(todayStr);
  });

  it('should resolve dispute APPROVED (renter win)', async () => {
    // Create disputed contract
    const contract = new Contract({
      _id: 'contract_dispute_1',
      roomId: 'room_1',
      renterId: 'user_1',
      renterName: 'Renter',
      renterPhone: '09876',
      hostName: 'Host',
      startDate: '20/07/2026',
      endDate: '20/12/2026',
      depositAmount: 4000000,
      depositStatus: 'FROZEN',
      status: 'DISPUTED',
      dateCreated: '10/07/2026'
    });
    await contract.save();

    const res = await request(app)
      .post(`/api/admin/disputes/${contract.id}/resolve`)
      .send({ status: 'APPROVED', resolutionNote: 'Host violated rental terms.' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.contract.depositStatus).toBe('REFUNDED');
    expect(res.body.contract.status).toBe('TERMINATED');
    expect(res.body.contract.refundInfo.status).toBe('COMPLETED');
  });

  it('should resolve dispute REJECTED (host win)', async () => {
    // Create disputed contract
    const contract = new Contract({
      _id: 'contract_dispute_2',
      roomId: 'room_1',
      renterId: 'user_1',
      renterName: 'Renter',
      renterPhone: '09876',
      hostName: 'Host',
      startDate: '20/07/2026',
      endDate: '20/12/2026',
      depositAmount: 4000000,
      depositStatus: 'FROZEN',
      status: 'DISPUTED',
      dateCreated: '10/07/2026'
    });
    await contract.save();

    const res = await request(app)
      .post(`/api/admin/disputes/${contract.id}/resolve`)
      .send({ status: 'REJECTED', resolutionNote: 'Complaints are not valid.' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.contract.depositStatus).toBe('DISBURSED');
    expect(res.body.contract.status).toBe('ACTIVE');
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm test tests/admin.test.ts`
Expected: PASS

- [ ] **Step 6: Commit changes**

```powershell
git add src/tasks/escrow.ts src/controllers/admin.ts src/routes/admin.ts src/app.ts tests/admin.test.ts
git commit -m "feat: add cron escrow disbursal job and dispute resolution admin APIs"
```

---

### Task 7: Invoices Model & Billing Commission Calculation Logic

**Files:**
- Create: `src/models/invoice.ts`
- Create: `src/controllers/invoice.ts`
- Create: `src/routes/invoice.ts`
- Modify: `src/app.ts` (register invoice routes)
- Test: `tests/invoice.test.ts`

**Interfaces:**
- Consumes: None
- Produces:
  - `POST /api/invoices`
  - `PATCH /api/invoices/:id/pay` (Performs 5% platform fee deduction & record revenues)

- [ ] **Step 1: Write Invoices Schema**

Create `src/models/invoice.ts`:
```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface IInvoice extends Document {
  id: string;
  roomId: string;
  roomName: string;
  period: string; // MM/yyyy
  roomPrice: number;
  oldElectricity: number;
  newElectricity: number;
  oldWater: number;
  newWater: number;
  otherCosts: Array<{ reason: string; amount: number }>;
  status: 'UNPAID' | 'PAID';
  type: string;
  dateCreated: string;
  paymentMethod?: string;
  commission: number; // Platform fee: roomPrice * 0.05
  finalRevenue: number; // Host revenue: totalAmount - commission
}

const InvoiceSchema = new Schema<IInvoice>({
  _id: { type: String, required: true },
  roomId: { type: String, required: true },
  roomName: { type: String, required: true },
  period: { type: String, required: true },
  roomPrice: { type: Number, required: true },
  oldElectricity: { type: Number, required: true },
  newElectricity: { type: Number, required: true },
  oldWater: { type: Number, required: true },
  newWater: { type: Number, required: true },
  otherCosts: [
    {
      reason: { type: String, required: true },
      amount: { type: Number, required: true }
    }
  ],
  status: { type: String, enum: ['UNPAID', 'PAID'], default: 'UNPAID' },
  type: { type: String, default: 'RENT' },
  dateCreated: { type: String, required: true },
  paymentMethod: { type: String, default: null },
  commission: { type: Number, default: 0 },
  finalRevenue: { type: Number, default: 0 }
}, {
  _id: false
});

export const Invoice = mongoose.model<IInvoice>('Invoice', InvoiceSchema);
```

- [ ] **Step 2: Create Invoice Controller with Platform Commission Hach Toan Logic**

Create `src/controllers/invoice.ts`:
```typescript
import { Request, Response } from 'express';
import { Invoice } from '../models/invoice';

export async function createInvoice(req: Request, res: Response) {
  try {
    const { id, roomId, roomName, period, roomPrice, oldElectricity, newElectricity, oldWater, newWater, otherCosts } = req.body;
    if (!id || !roomId || !roomName || !period || roomPrice === undefined || oldElectricity === undefined || newElectricity === undefined || oldWater === undefined || newWater === undefined) {
      return res.status(400).json({ success: false, error: 'Missing invoice parameters.' });
    }

    const invoice = new Invoice({
      _id: id, roomId, roomName, period, roomPrice, oldElectricity, newElectricity, oldWater, newWater, otherCosts,
      status: 'UNPAID', type: 'RENT', dateCreated: new Date().toLocaleDateString('vi-VN')
    });
    await invoice.save();
    return res.status(201).json({ success: true, invoice });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function payInvoice(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { paymentMethod } = req.body;
    if (!paymentMethod) {
      return res.status(400).json({ success: false, error: 'Payment method is required.' });
    }

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found.' });
    }

    // Constants defaults
    const electricityRate = 3500;
    const waterRate = 15000;

    // Calculation total amount
    const elecDiff = invoice.newElectricity - invoice.oldElectricity;
    const waterDiff = invoice.newWater - invoice.oldWater;
    const extraCostsTotal = (invoice.otherCosts || []).reduce((sum, item) => sum + item.amount, 0);

    const totalAmount = invoice.roomPrice + (elecDiff * electricityRate) + (waterDiff * waterRate) + extraCostsTotal;

    // Commission: 5% of static roomPrice
    const commission = invoice.roomPrice * 0.05;
    const finalRevenue = totalAmount - commission;

    invoice.status = 'PAID';
    invoice.paymentMethod = paymentMethod;
    invoice.commission = commission;
    invoice.finalRevenue = finalRevenue;

    await invoice.save();

    return res.status(200).json({ success: true, invoice, totalAmount });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
```

Create `src/routes/invoice.ts`:
```typescript
import { Router } from 'express';
import { createInvoice, payInvoice } from '../controllers/invoice';

const router = Router();
router.post('/invoices', createInvoice);
router.patch('/invoices/:id/pay', payInvoice);

export default router;
```

- [ ] **Step 3: Modify app.ts to Register Invoice Routes**

Add to `src/app.ts`:
```typescript
import invoiceRouter from './routes/invoice';

app.use('/api', invoiceRouter);
```

- [ ] **Step 4: Write Invoices Payment Test**

Create `tests/invoice.test.ts`:
```typescript
import request from 'supertest';
import app from '../src/app';
import { Invoice } from '../src/models/invoice';
import { connectDb, closeDb } from '../src/config/db';

beforeAll(async () => {
  await connectDb();
  await Invoice.deleteMany({});
});

afterAll(async () => {
  await Invoice.deleteMany({});
  await closeDb();
});

describe('Invoices APIs', () => {
  const mockInvoice = {
    id: 'invoice_1',
    roomId: 'room_1',
    roomName: 'Phòng 201',
    period: '07/2026',
    roomPrice: 4000000,
    oldElectricity: 100,
    newElectricity: 150, // 50 kWh * 3500 = 175,000 VNĐ
    oldWater: 10,
    newWater: 12, // 2 m3 * 15000 = 30,000 VNĐ
    otherCosts: [{ reason: 'Rác + Internet', amount: 150000 }] // Total: 4,000,000 + 175,000 + 30,000 + 150,000 = 4,355,000
  };

  it('should create an invoice and perform payment with 5% commission deduction', async () => {
    // 1. Create Invoice
    const createRes = await request(app)
      .post('/api/invoices')
      .send(mockInvoice)
      .expect(201);
    expect(createRes.body.success).toBe(true);

    // 2. Pay Invoice
    const payRes = await request(app)
      .patch(`/api/invoices/${mockInvoice.id}/pay`)
      .send({ paymentMethod: 'VietQR' })
      .expect(200);

    expect(payRes.body.success).toBe(true);
    expect(payRes.body.totalAmount).toBe(4355000);
    // Commission is 5% of 4,000,000 = 200,000 VNĐ
    expect(payRes.body.invoice.commission).toBe(200000);
    // Final revenue is 4,355,000 - 200,000 = 4,155,000 VNĐ
    expect(payRes.body.invoice.finalRevenue).toBe(4155000);
    expect(payRes.body.invoice.status).toBe('PAID');
    expect(payRes.body.invoice.paymentMethod).toBe('VietQR');
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm test tests/invoice.test.ts`
Expected: PASS

- [ ] **Step 6: Commit changes**

```powershell
git add src/models/invoice.ts src/controllers/invoice.ts src/routes/invoice.ts src/app.ts tests/invoice.test.ts
git commit -m "feat: add invoice model and payment api with 5% platform commission calculation"
```

---

### Task 8: Cleanup and Integration Verification

**Files:**
- Modify: `app.js` (Delete)
- Modify: `db.js` (Delete)

- [ ] **Step 1: Delete old JS implementation files**

Delete `app.js` and `db.js` in the project root.

- [ ] **Step 2: Run all tests to verify integration**

Run:
```powershell
npm test
```
Expected: All tests pass (including auth, media, room, contract, admin, invoice tests).

- [ ] **Step 3: Commit final modifications**

```powershell
git add .
git commit -m "cleanup: remove legacy javascript files and verify all typescript integration tests"
```
