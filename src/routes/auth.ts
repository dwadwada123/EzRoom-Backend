import { Router } from 'express';
import { register, login, submitEkyc, adminLogin, getProfile, updateProfile, changePassword, forgotPassword, resetPassword, checkPhone, uploadEkycImage } from '../controllers/auth';
import { authMiddleware } from '../middlewares/auth';
import multer from 'multer';

const upload = multer();
const router = Router();
router.post('/auth/register', register);
router.post('/auth/login', login);
router.post('/auth/admin-login', adminLogin);
router.post('/auth/forgot-password', forgotPassword);
router.post('/auth/reset-password', resetPassword);
router.get('/auth/check-phone/:phone', checkPhone);
router.get('/profile', authMiddleware, getProfile);
router.post('/profile/update', authMiddleware, updateProfile);
router.post('/profile/change-password', authMiddleware, changePassword);
router.post('/profile/ekyc', authMiddleware, submitEkyc);
router.post('/auth/ekyc/upload', authMiddleware, upload.single('image'), uploadEkycImage);

export default router;
