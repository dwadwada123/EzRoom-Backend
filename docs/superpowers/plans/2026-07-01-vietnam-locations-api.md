# Vietnam Locations API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node.js + Express API server that queries 34 provinces and their nested wards from local MongoDB and returns them as a camelCase JSON array.

**Architecture:** A lightweight Express application that queries local MongoDB using the native `mongodb` driver, maps data keys from PascalCase to camelCase, and serves the results on `GET /api/provinces`.

**Tech Stack:** Node.js v26.x, Express.js, MongoDB Native Driver, Jest, Supertest.

## Global Constraints

- Runs on Node.js v26.x
- Connects to MongoDB at `mongodb://localhost:27017/vietnam_provinces`
- Endpoint path: `/api/provinces`
- Response: camelCase JSON Array matching Android Kotlin classes

---

### Task 1: Scaffolding and Health Check Endpoint

**Files:**
- Create: `package.json`
- Create: `app.js`
- Create: `tests/app.test.js`

**Interfaces:**
- Consumes: None
- Produces: Health check endpoint `GET /health` returning `{ "status": "ok" }`

- [ ] **Step 1: Write the failing test**

Create `tests/app.test.js`:
```javascript
const request = require('supertest');
const app = require('../app');

describe('GET /health', () => {
  it('should return 200 OK and status ok', async () => {
    const res = await request(app)
      .get('/health')
      .expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Create placeholder `app.js` to allow test execution:
```javascript
module.exports = {};
```

Run:
```bash
npm test
```
Expected: FAIL due to `app` not being a valid request handler/function.

- [ ] **Step 3: Write minimal implementation**

Create `package.json`:
```json
{
  "name": "ezroom-backend",
  "version": "1.0.0",
  "description": "EzRoom backend API",
  "main": "app.js",
  "scripts": {
    "start": "node app.js",
    "test": "jest --detectOpenHandles --forceExit"
  },
  "dependencies": {
    "express": "^4.19.2",
    "mongodb": "^6.5.0"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^6.3.4"
  }
}
```

Install dependencies:
```bash
npm.cmd install
```

Update `app.js`:
```javascript
const express = require('express');
const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

module.exports = app;
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm.cmd test
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json app.js tests/app.test.js
git commit -m "feat: scaffold express application and add health check endpoint"
```

---

### Task 2: Database Connection and Province Mapping Endpoint

**Files:**
- Create: `db.js`
- Modify: `app.js`
- Modify: `tests/app.test.js`

**Interfaces:**
- Consumes: Express application from Task 1
- Produces: API endpoint `GET /api/provinces` returning 34 provinces mapped to camelCase

- [ ] **Step 1: Write the failing test**

Append to `tests/app.test.js`:
```javascript
const { closeDb } = require('../db');

afterAll(async () => {
  await closeDb();
});

describe('GET /api/provinces', () => {
  it('should return 200 OK and list of 34 provinces mapped to camelCase', async () => {
    const res = await request(app)
      .get('/api/provinces')
      .expect(200);
    
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(34);
    
    const firstProvince = res.body[0];
    expect(firstProvince).toHaveProperty('code');
    expect(firstProvince).toHaveProperty('name');
    expect(firstProvince).toHaveProperty('fullName');
    expect(firstProvince).toHaveProperty('codeName');
    expect(firstProvince).toHaveProperty('type');
    expect(firstProvince).toHaveProperty('administrativeUnitId');
    expect(firstProvince).toHaveProperty('wards');
    
    expect(firstProvince).not.toHaveProperty('Code');
    expect(firstProvince).not.toHaveProperty('Name');
    expect(firstProvince).not.toHaveProperty('Wards');
    
    if (firstProvince.wards && firstProvince.wards.length > 0) {
      const firstWard = firstProvince.wards[0];
      expect(firstWard).toHaveProperty('code');
      expect(firstWard).toHaveProperty('name');
      expect(firstWard).toHaveProperty('fullName');
      expect(firstWard).not.toHaveProperty('ProvinceCode');
    }
  });
});
```

Create placeholder `db.js`:
```javascript
async function closeDb() {}
module.exports = { closeDb };
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm.cmd test
```
Expected: FAIL (404 Not Found on `/api/provinces`)

- [ ] **Step 3: Write minimal implementation**

Implement `db.js`:
```javascript
const { MongoClient } = require('mongodb');

const url = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = 'vietnam_provinces';
let client;
let db;

async function connectDb() {
  if (db) return db;
  client = new MongoClient(url);
  await client.connect();
  db = client.db(dbName);
  return db;
}

async function closeDb() {
  if (client) {
    await client.close();
    db = null;
    client = null;
  }
}

module.exports = { connectDb, closeDb };
```

Update `app.js`:
```javascript
const express = require('express');
const { connectDb } = require('./db');
const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

function mapProvince(prov) {
  return {
    code: prov.Code,
    name: prov.Name,
    fullName: prov.FullName,
    codeName: prov.CodeName,
    type: prov.Type,
    administrativeUnitId: prov.AdministrativeUnitId,
    wards: (prov.Wards || []).map(ward => ({
      code: ward.Code,
      name: ward.Name,
      fullName: ward.FullName,
      codeName: ward.CodeName,
      type: ward.Type,
      administrativeUnitId: ward.AdministrativeUnitId
    }))
  };
}

app.get('/api/provinces', async (req, res) => {
  try {
    const db = await connectDb();
    const rawProvinces = await db.collection('provinces').find({}).toArray();
    const mapped = rawProvinces.map(mapProvince);
    res.status(200).json(mapped);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, error: 'Database connection failed.' });
  }
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

module.exports = app;
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm.cmd test
```
Expected: PASS (All tests green)

- [ ] **Step 5: Commit**

```bash
git add db.js app.js tests/app.test.js
git commit -m "feat: add database module and implement provinces API route with mapping"
```
