import { Router } from 'express';
import {
  getAdminContracts,
  getAdminDisputes,
  resolveDispute,
  getPendingEkyc,
  moderateEkyc,
  getRoomsModeration,
  moderateRoom,
  triggerEscrowTask,
  getDashboardStats,
  getAdminUsers,
  toggleUserStatus,
  getAdminInvoices,
  getAdminReviewReports,
  resolveReviewReport
} from '../controllers/admin';
import { authMiddleware, roleMiddleware } from '../middlewares/auth';

const router = Router();
router.use(authMiddleware);
router.use(roleMiddleware(['ADMIN']));

router.get('/contracts', getAdminContracts);
router.get('/disputes', getAdminDisputes);
router.post('/disputes/:id/resolve', resolveDispute);
router.get('/ekyc/pending', getPendingEkyc);
router.post('/ekyc/:id/moderate', moderateEkyc);
router.get('/rooms/moderation', getRoomsModeration);
router.post('/rooms/:id/moderate', moderateRoom);
router.post('/tasks/run-escrow', triggerEscrowTask);

router.get('/dashboard-stats', getDashboardStats);
router.get('/users', getAdminUsers);
router.post('/users/:id/status', toggleUserStatus);
router.get('/invoices', getAdminInvoices);
router.get('/reports', getAdminReviewReports);
router.post('/reports/:id/resolve', resolveReviewReport);

export default router;
