import express from 'express';
import {
  getAllUsers,
  getUserById,
  updateUser,
  suspendUser,
  deleteUser,
} from '../controllers/userController.js';
import { allowRoles, isAdmin, protect } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

router.get('/', protect, getAllUsers);           // GET all users
router.get('/:id', protect, getUserById);        // GET user by ID
router.put('/:id', protect, upload.single('profile_pic'), updateUser);         // UPDATE user
router.patch('/:id/suspend', protect, isAdmin, suspendUser); //PATCH user
router.delete('/:id', protect, isAdmin, deleteUser);      // DELETE user

export default router;
