import { Router } from 'express';
import { createInvoice, payInvoice } from '../controllers/invoice';

const router = Router();
router.post('/invoices', createInvoice);
router.patch('/invoices/:id/pay', payInvoice);

export default router;
