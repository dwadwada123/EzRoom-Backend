import { Router } from 'express';
import { createContract, signContract, getPaymentQR } from '../controllers/contract';
import { authMiddleware } from '../middlewares/auth';

const router = Router();
router.use(authMiddleware);

router.post('/', createContract);
router.post('/:id/sign', signContract);
router.post('/:id/payment', getPaymentQR);

export default router;
