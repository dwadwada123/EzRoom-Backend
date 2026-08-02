import { Router } from 'express';
import { suggestLocation, geocodeLocation } from '../controllers/location';

const router = Router();

router.get('/suggest', suggestLocation);
router.get('/geocode', geocodeLocation);

export default router;
