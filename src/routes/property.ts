import { Router } from 'express';
import { createProperty, getProperties } from '../controllers/property';

const router = Router();
router.post('/properties', createProperty);
router.get('/properties', getProperties);

export default router;
