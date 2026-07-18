import { Router } from 'express';
import { createInvoice, payInvoice } from '../controllers/invoice';
import { authMiddleware } from '../middlewares/auth';

const router = Router();
router.use(authMiddleware);

router.post('/', createInvoice);
router.patch('/:id/pay', payInvoice);

export default router;
