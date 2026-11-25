import express from 'express';
import { getTeams, createTeam, addTeamMember, removeTeamMember } from '../controllers/teamController';
import { protect } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';

const router = express.Router();

router.get('/', protect, authorizeRoles('SuperAdmin', 'Manager', 'TeamLead', 'Employee'), getTeams as any);
router.post('/', protect, authorizeRoles('SuperAdmin', 'Manager'), createTeam as any);
router.post('/:id/members', protect, authorizeRoles('SuperAdmin', 'Manager'), addTeamMember as any);
router.delete('/:id/members/:userId', protect, authorizeRoles('SuperAdmin', 'Manager'), removeTeamMember as any);

export default router;
