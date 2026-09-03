import express from 'express';
import fs from 'node:fs';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
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
import locationRouter from './routes/location';
import roomReviewRouter from './routes/roomReview';
import renterReviewRouter from './routes/renterReview';
import appointmentRouter from './routes/appointment';
import userProfileRouter from './routes/userProfile';
import chatRouter from './routes/chat';
import notificationRouter from './routes/notification';
import amenityRouter from './routes/amenity';
import { processEscrowDisbursals } from './tasks/escrow';

const app = express();

const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};


// B-06: CORS – restrict to known origins in production
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5174').split(',');
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: origin "${origin}" not allowed`));
    }
  },
  credentials: true,
}));

app.use(express.json());

// B-07: Rate limiting – protect auth endpoints from brute-force
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 15 minutes
  max: 20, // max 20 login attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.' },
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 requests/minute for general API
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth', authLimiter);
app.use('/api', generalLimiter);

app.use('/api/media', mediaRouter);
app.use('/api', authRouter);
app.use('/api/properties', propertyRouter);
app.use('/api/rooms', roomRouter);
app.use('/api/contracts', contractRouter);
app.use('/api', webhookRouter);
app.use('/api/admin', adminRouter);
app.use('/api/invoices', invoiceRouter);
app.use('/api/location', locationRouter);
app.use('/api/room-reviews', roomReviewRouter);
app.use('/api', renterReviewRouter);
app.use('/api', appointmentRouter);
app.use('/api', userProfileRouter);
app.use('/api', chatRouter);
app.use('/api', notificationRouter);
app.use('/api/amenities', amenityRouter);

// Daily schedule at 00:00 (disabled in test environment)
if (process.env.NODE_ENV !== 'test') {
  cron.schedule('0 0 * * *', async () => {
    await processEscrowDisbursals();
  });
}

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});



if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  connectDb().then(() => {
    console.log('Connected to MongoDB');
    app.listen(port, '0.0.0.0', () => {
      console.log(`Server is running on port ${port}`);
    });
  }).catch((err) => {
    console.error('Database connection failed:', err);
    process.exit(1);
  });
}

export default app;
