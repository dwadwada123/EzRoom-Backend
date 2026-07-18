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
