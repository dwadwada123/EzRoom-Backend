import { Router } from 'express';
import { createProperty, getProperties, getHostProperties, togglePropertyVisibility } from '../controllers/property';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

// Public routes (No auth)
router.get('/', getProperties);

// Host routes (Requires auth)
router.use(authMiddleware);
router.post('/', createProperty);
router.get('/host', getHostProperties);
router.patch('/:id/visibility', togglePropertyVisibility as any);

export default router;
