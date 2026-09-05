import { Router } from 'express';
import { createProperty, getProperties, getHostProperties, togglePropertyVisibility, updateProperty, deleteProperty } from '../controllers/property';
import { authMiddleware, roleMiddleware } from '../middlewares/auth';

const router = Router();

// Public routes (No auth)
router.get('/', getProperties);

// Host routes (Requires auth)
router.use(authMiddleware);
router.use(roleMiddleware(['HOST']));
router.post('/', createProperty);
router.get('/host', getHostProperties);
router.put('/:id', updateProperty as any);
router.patch('/:id/visibility', togglePropertyVisibility as any);
router.delete('/:id', deleteProperty as any);

export default router;
