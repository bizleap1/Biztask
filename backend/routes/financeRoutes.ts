import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';
import { getInvoices, createInvoice, issueInvoice, addReceipt } from '../controllers/financeController';

const router = express.Router();
router.get('/invoices', protect, authorizeRoles('SuperAdmin', 'Manager'), getInvoices);
router.post('/invoices', protect, authorizeRoles('SuperAdmin', 'Manager'), createInvoice);
router.post('/invoices/:id/issue', protect, authorizeRoles('SuperAdmin', 'Manager'), issueInvoice);
router.post('/invoices/:id/receipts', protect, authorizeRoles('SuperAdmin', 'Manager'), addReceipt);
export default router;
