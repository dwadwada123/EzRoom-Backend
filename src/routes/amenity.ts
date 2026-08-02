import { Router } from 'express';
import { getAmenities, createAmenity, updateAmenity, deleteAmenity } from '../controllers/amenity';

const router = Router();

router.get('/', getAmenities);
router.post('/', createAmenity);
router.put('/:id', updateAmenity);
router.delete('/:id', deleteAmenity);

export default router;