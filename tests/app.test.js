const request = require('supertest');
const app = require('../app');
const { closeDb } = require('../db');

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

