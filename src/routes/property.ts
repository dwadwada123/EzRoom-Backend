import { Router } from 'express';
import { createProperty, getProperties } from '../controllers/property';
import { authMiddleware } from '../middlewares/auth';

const router = Router();
router.use(authMiddleware);

router.post('/', createProperty);
router.get('/', getProperties);

export default router;
