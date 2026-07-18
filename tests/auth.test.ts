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

  let token = '';

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
    token = res.body.token;
    expect(res.body.user.email).toBe(mockUser.email);
  });

  it('should submit eKYC details and await moderation', async () => {
    const res = await request(app)
      .post('/api/profile/ekyc')
      .set('Authorization', `Bearer ${token}`)
      .send({
        userId: mockUser.id,
        idCardNumber: '123456789012',
        frontImageUrl: 'https://cloudinary.com/front.jpg',
        backImageUrl: 'https://cloudinary.com/back.jpg'
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Awaiting moderation');
  });
});
