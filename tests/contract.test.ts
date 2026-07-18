import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { Contract } from '../src/models/contract';
import { connectDb, closeDb } from '../src/config/db';
import { payOS } from '../src/config/payos';

const JWT_SECRET = process.env.JWT_SECRET || 'ezroom_secret_key_123';

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

  let token = '';

  beforeAll(async () => {
    await connectDb();
    await Contract.deleteMany({});
    token = jwt.sign({ id: 'user_1', email: 'renter@ezroom.vn', role: 'RENTER' }, JWT_SECRET);
    
    // Mock PayOS paymentRequests.create
    jest.spyOn(payOS.paymentRequests, 'create').mockImplementation(async (data: any) => {
      return {
        checkoutUrl: `https://checkout.payos.vn/web/${data.orderCode}`,
        paymentLinkId: 'mock_pay_link_id',
        status: 'PENDING',
        qrCode: 'mock_qr_code'
      } as any;
    });

    // Mock PayOS webhooks.verify
    jest.spyOn(payOS.webhooks, 'verify').mockImplementation(async (body: any) => {
      return {
        orderCode: body.orderCode,
        amount: body.amount,
        desc: body.desc || 'success'
      } as any;
    });
  });

  afterAll(async () => {
    await Contract.deleteMany({});
    await closeDb();
  });

  it('should draft a contract and sign it', async () => {
    // 1. Draft Contract
    const draftRes = await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${token}`)
      .send(mockContract)
      .expect(201);
    expect(draftRes.body.success).toBe(true);
    expect(draftRes.body.contract.status).toBe('DRAFT');
    expect(draftRes.body.contract.depositStatus).toBe('UNPAID');

    // 2. Sign Contract
    const signRes = await request(app)
      .post(`/api/contracts/${mockContract.id}/sign`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(signRes.body.contract.status).toBe('WAITING_DEPOSIT');
    expect(signRes.body.contract.dateSigned).toBeDefined();

    // 3. Get Payment QR
    const qrRes = await request(app)
      .post(`/api/contracts/${mockContract.id}/payment`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(qrRes.body.qrUrl).toContain('payos.vn');
  });

  it('should handle webhook to freeze deposit (Escrow)', async () => {
    // 1. Query the contract from DB to get the runtime orderCode set by getPaymentQR
    const contract = await Contract.findById(mockContract.id);
    const orderCode = contract?.orderCode || 0;

    // Webhook is public (no Auth header needed)
    const res = await request(app)
      .post('/api/payment-webhook')
      .send({
        orderCode,
        amount: mockContract.depositAmount,
        desc: 'success'
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.contract.depositStatus).toBe('FROZEN');
    expect(res.body.contract.status).toBe('ACTIVE');
  });
});
