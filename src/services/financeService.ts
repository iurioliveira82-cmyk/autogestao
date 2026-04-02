import { auth } from '../firebase';

const API_URL = '/api/finance';

const getHeaders = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  
  const token = await user.getIdToken();
  const empresaId = localStorage.getItem('empresaId'); // Assuming empresaId is stored in localStorage

  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-empresa-id': empresaId || '',
  };
};

export const financeService = {
  async getTransactions(filters: any = {}) {
    const headers = await getHeaders();
    const queryParams = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}?${queryParams}`, { headers });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch transactions');
    }
    
    const result = await response.json();
    return result.data;
  },

  async createTransaction(data: any) {
    const headers = await getHeaders();
    const response = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create transaction');
    }
    
    const result = await response.json();
    return result.data;
  },

  async updateTransaction(id: string, data: any) {
    const headers = await getHeaders();
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update transaction');
    }
    
    const result = await response.json();
    return result.data;
  },

  async deleteTransaction(id: string) {
    const headers = await getHeaders();
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
      headers,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete transaction');
    }
    
    const result = await response.json();
    return result.data;
  }
};
