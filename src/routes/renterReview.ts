import { Router } from 'express';
import { createReview, getRenterReviews, updateReview, deleteReview, reportRenterReview } from '../controllers/renterReview';

const router = Router();

router.post('/renter-reviews', createReview);
router.get('/renter-reviews/renter/:renterId', getRenterReviews);
router.put('/renter-reviews/:id', updateReview);
router.delete('/renter-reviews/:id', deleteReview);
router.post('/renter-reviews/:id/report', reportRenterReview);

export default router;
