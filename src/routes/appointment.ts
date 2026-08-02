import { Router } from 'express';
import { createAppointment, getAppointments, updateAppointmentStatus } from '../controllers/appointment';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.post('/appointments', createAppointment);
router.get('/appointments', getAppointments);
router.put('/appointments/:id/status', authMiddleware, updateAppointmentStatus);

export default router;
