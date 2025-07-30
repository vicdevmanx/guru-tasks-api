import express from 'express';
import {
  createTask,
  getTasks,
  updateTask,
  updateTaskStatus,
  deleteTask
} from '../controllers/taskController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, createTask);
router.get('/', protect, getTasks);
router.put('/:id', protect, updateTask);
router.patch('/:id', protect, updateTaskStatus);
router.delete('/:id', protect, deleteTask);

export default router;
