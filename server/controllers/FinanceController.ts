import type { Response } from 'express';
import { BaseController } from './BaseController.ts';
import { FinanceService } from '../services/FinanceService.ts';
import type { AuthRequest } from '../middlewares/auth.ts';

export class FinanceController extends BaseController {
  private _financeService: FinanceService | null = null;
  private get financeService() {
    if (!this._financeService) {
      this._financeService = new FinanceService();
    }
    return this._financeService;
  }

  async getTransactions(req: AuthRequest, res: Response) {
    try {
      const empresaId = req.empresaId;
      console.log('Fetching transactions for Empresa ID:', empresaId);
      if (!empresaId) return this.error(res, 'Empresa ID is required', 400);

      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        tipo: req.query.tipo,
      };
      console.log('Filters:', JSON.stringify(filters));

      const transactions = await this.financeService.getTransactions(empresaId, filters);
      return this.success(res, transactions);
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      return this.error(res, error.message || 'Internal Server Error', 500);
    }
  }

  async createTransaction(req: AuthRequest, res: Response) {
    try {
      const empresaId = req.empresaId;
      if (!empresaId) return this.error(res, 'Empresa ID is required', 400);

      const transaction = await this.financeService.createTransaction(empresaId, req.body);
      return this.success(res, transaction, 'Transaction created successfully');
    } catch (error: any) {
      console.error('Error creating transaction:', error);
      return this.error(res, error.message || 'Internal Server Error', 500);
    }
  }

  async updateTransaction(req: AuthRequest, res: Response) {
    try {
      const empresaId = req.empresaId;
      const { id } = req.params;
      if (!empresaId) return this.error(res, 'Empresa ID is required', 400);

      const transaction = await this.financeService.updateTransaction(empresaId, id, req.body);
      return this.success(res, transaction, 'Transaction updated successfully');
    } catch (error: any) {
      console.error('Error updating transaction:', error);
      return this.error(res, error.message || 'Internal Server Error', 500);
    }
  }

  async deleteTransaction(req: AuthRequest, res: Response) {
    try {
      const empresaId = req.empresaId;
      const { id } = req.params;
      if (!empresaId) return this.error(res, 'Empresa ID is required', 400);

      await this.financeService.deleteTransaction(empresaId, id);
      return this.success(res, { id }, 'Transaction deleted successfully');
    } catch (error: any) {
      console.error('Error deleting transaction:', error);
      return this.error(res, error.message || 'Internal Server Error', 500);
    }
  }
}
