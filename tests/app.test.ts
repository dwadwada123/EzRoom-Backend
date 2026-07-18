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
