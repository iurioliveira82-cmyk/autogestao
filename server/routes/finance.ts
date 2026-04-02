import express from 'express';
import { FinanceController } from '../controllers/FinanceController.ts';
import { authenticate, authorize } from '../middlewares/auth.ts';

const router = express.Router();
const financeController = new FinanceController();

// All finance routes require authentication
router.use(authenticate);

// List transactions
router.get('/', (req, res) => financeController.getTransactions(req, res));

// Create transaction (requires admin or finance permission)
router.post('/', authorize(['admin', 'finance']), (req, res) => financeController.createTransaction(req, res));

// Update transaction
router.put('/:id', authorize(['admin', 'finance']), (req, res) => financeController.updateTransaction(req, res));

// Delete transaction
router.delete('/:id', authorize(['admin']), (req, res) => financeController.deleteTransaction(req, res));

export default router;
