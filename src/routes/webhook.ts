import { Router } from 'express';
import { paymentWebhook } from '../controllers/webhook';

const router = Router();
router.post('/payment-webhook', paymentWebhook);

export default router;
