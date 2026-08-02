import { Router } from 'express';
import { createRoom, getRooms, getHostRooms, toggleRoomVisibility, deleteRoom, reportRoom, submitRoomAppeal } from '../controllers/room';
import { authMiddleware, roleMiddleware } from '../middlewares/auth';

const router = Router();

// Public discovery (for renters)
router.get('/', getRooms);

// Host only: get all rooms for the authenticated host's properties
router.get('/host', authMiddleware, roleMiddleware(['HOST']), getHostRooms);

// Host only: create a room
router.post('/', authMiddleware, roleMiddleware(['HOST']), createRoom);

// Public / Authenticated: report a room for violations
router.post('/:id/report', reportRoom);

// Host only: submit appeal for a removed room
router.post('/:id/appeal', authMiddleware, submitRoomAppeal);

// Host only: toggle room visibility
router.patch('/:id/visibility', authMiddleware, roleMiddleware(['HOST']), toggleRoomVisibility as any);

// Host only: delete a room (soft delete)
router.delete('/:id', authMiddleware, roleMiddleware(['HOST']), deleteRoom as any);

export default router;
