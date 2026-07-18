import { Router } from 'express';
import { createRoom, getRooms } from '../controllers/room';
import { authMiddleware, roleMiddleware } from '../middlewares/auth';

const router = Router();

// Public discovery
router.get('/', getRooms);

// Host only
router.post('/', authMiddleware, roleMiddleware(['HOST']), createRoom);

export default router;
