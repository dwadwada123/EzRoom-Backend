import { Router } from 'express';
import {
  getAdminContracts,
  getAdminDisputes,
  resolveDispute,
  getPendingEkyc,
  moderateEkyc,
  getRoomsModeration,
  moderateRoom,
  triggerEscrowTask
} from '../controllers/admin';

const router = Router();
router.get('/admin/contracts', getAdminContracts);
router.get('/admin/disputes', getAdminDisputes);
router.post('/admin/disputes/:id/resolve', resolveDispute);
router.get('/admin/ekyc/pending', getPendingEkyc);
router.post('/admin/ekyc/:id/moderate', moderateEkyc);
router.get('/admin/rooms/moderation', getRoomsModeration);
router.post('/admin/rooms/:id/moderate', moderateRoom);
router.post('/admin/tasks/run-escrow', triggerEscrowTask);

export default router;
