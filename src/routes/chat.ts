import { Router } from 'express';
import { getConversations, getMessages, sendMessage, uploadImage } from '../controllers/chat';
import multer from 'multer';

const upload = multer();
const router = Router();

router.get('/conversations', getConversations);
router.get('/conversations/:conversationId/messages', getMessages);
router.post('/conversations/messages', sendMessage);
router.post('/upload', upload.single('image'), uploadImage);

export default router;
