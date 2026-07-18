import { Router } from 'express';
import { register, login, submitEkyc } from '../controllers/auth';
import { authMiddleware } from '../middlewares/auth';

const router = Router();
router.post('/auth/register', register);
router.post('/auth/login', login);
router.post('/profile/ekyc', authMiddleware, submitEkyc);

export default router;
