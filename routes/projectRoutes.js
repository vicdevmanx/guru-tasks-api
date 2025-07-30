import express from 'express';
import {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  assignUserToProject,
} from '../controllers/projectController.js';

import { protect } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/upload.js'; // for image uploads

const router = express.Router();

router.post('/', protect, upload.single('image'), createProject);
router.get('/', protect, getProjects);
router.get('/:id', protect, getProjectById);
router.put('/:id', protect, upload.single('image'), updateProject);
router.delete('/:id', protect, deleteProject);
router.patch('/:id/assign', protect, assignUserToProject);

export default router;
