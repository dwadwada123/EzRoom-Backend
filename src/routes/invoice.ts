import { Router } from 'express';
import { createInvoice, payInvoice, getInvoices, getInvoiceById, getInvoicePaymentQR, remindInvoice, sendInvoiceReceipt } from '../controllers/invoice';
import { authMiddleware } from '../middlewares/auth';

const router = Router();
router.use(authMiddleware);

router.get('/', getInvoices);
router.get('/:id', getInvoiceById);
router.get('/:id/payment-qr', getInvoicePaymentQR);
router.post('/', createInvoice);
router.patch('/:id/pay', payInvoice);
router.post('/:id/remind', remindInvoice);
router.post('/:id/send-receipt', sendInvoiceReceipt);

export default router;
