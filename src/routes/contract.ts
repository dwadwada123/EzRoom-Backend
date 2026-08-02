import { Router } from 'express';
import { createContract, signContract, getPaymentQR, getHostTenants, getContracts, getContractById, confirmPayment, terminateContract } from '../controllers/contract';
import { authMiddleware } from '../middlewares/auth';

const router = Router();
router.use(authMiddleware);

router.get('/', getContracts);
router.get('/:id', getContractById);
router.post('/', createContract);
router.post('/:id/sign', signContract);
router.post('/:id/payment', getPaymentQR);
router.post('/:id/confirm-payment', confirmPayment);
router.post('/:id/terminate', terminateContract);
router.get('/host-tenants/:hostId', getHostTenants);

export default router;
