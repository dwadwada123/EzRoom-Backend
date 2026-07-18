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
