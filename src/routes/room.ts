import { Router } from 'express';
import { createRoom, getRooms } from '../controllers/room';

const router = Router();
router.post('/rooms', createRoom);
router.get('/rooms', getRooms);

export default router;
