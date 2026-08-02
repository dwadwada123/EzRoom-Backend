import { Router } from 'express';
import { createRoomReview, getRoomReviews, reportRoomReview } from '../controllers/roomReview';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.post('/', authMiddleware, createRoomReview);
router.get('/room/:roomId', getRoomReviews);
router.post('/:id/report', reportRoomReview);

export default router;
