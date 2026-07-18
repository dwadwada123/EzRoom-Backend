import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { Invoice } from '../src/models/invoice';
import { connectDb, closeDb } from '../src/config/db';

const JWT_SECRET = process.env.JWT_SECRET || 'ezroom_secret_key_123';

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

  let token = '';

  beforeAll(async () => {
    await connectDb();
    await Invoice.deleteMany({});
    token = jwt.sign({ id: 'user_1', email: 'renter@ezroom.vn', role: 'RENTER' }, JWT_SECRET);
  });

  afterAll(async () => {
    await Invoice.deleteMany({});
    await closeDb();
  });

  it('should create an invoice and perform payment with 5% commission deduction', async () => {
    // 1. Create Invoice
    const createRes = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send(mockInvoice)
      .expect(201);
    expect(createRes.body.success).toBe(true);

    // 2. Pay Invoice
    const payRes = await request(app)
      .patch(`/api/invoices/${mockInvoice.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
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
