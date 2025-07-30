import express from 'express';
import { signup, login, forgotPassword, resetPassword } from '../controllers/authController.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Handle image upload too
router.post('/signup', upload.single('profile_pic'), signup);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);


export default router;
