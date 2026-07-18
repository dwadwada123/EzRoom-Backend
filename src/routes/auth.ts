import { Router } from 'express';
import { register, login, submitEkyc } from '../controllers/auth';

const router = Router();
router.post('/auth/register', register);
router.post('/auth/login', login);
router.post('/profile/ekyc', submitEkyc);

export default router;
