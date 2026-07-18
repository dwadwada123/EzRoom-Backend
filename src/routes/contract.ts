import { Router } from 'express';
import { createContract, signContract, getPaymentQR } from '../controllers/contract';

const router = Router();
router.post('/contracts', createContract);
router.post('/contracts/:id/sign', signContract);
router.post('/contracts/:id/payment', getPaymentQR);

export default router;
