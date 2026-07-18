import express from 'express';
import { connectDb } from './config/db';
import cron from 'node-cron';
import mediaRouter from './routes/media';
import authRouter from './routes/auth';
import propertyRouter from './routes/property';
import roomRouter from './routes/room';
import contractRouter from './routes/contract';
import webhookRouter from './routes/webhook';
import adminRouter from './routes/admin';
import invoiceRouter from './routes/invoice';
import { processEscrowDisbursals } from './tasks/escrow';

const app = express();
app.use(express.json());
app.use('/api/media', mediaRouter);
app.use('/api', authRouter);
app.use('/api', propertyRouter);
app.use('/api', roomRouter);
app.use('/api', contractRouter);
app.use('/api', webhookRouter);
app.use('/api', adminRouter);
app.use('/api', invoiceRouter);

// Daily schedule at 00:00 (disabled in test environment)
if (process.env.NODE_ENV !== 'test') {
  cron.schedule('0 0 * * *', async () => {
    await processEscrowDisbursals();
  });
}

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
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
  });
}

export default app;
