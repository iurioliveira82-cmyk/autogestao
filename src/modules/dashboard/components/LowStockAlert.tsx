import React from 'react';
import { AlertCircle, Package } from 'lucide-react';
import { InventoryItem } from '../../../types';

interface LowStockAlertProps {
  lowStock: number;
  lowStockItems: InventoryItem[];
  setActiveTab?: (tab: string) => void;
}

export const LowStockAlert: React.FC<LowStockAlertProps> = ({ lowStock, lowStockItems, setActiveTab }) => {
  if (lowStock === 0) return null;

  return (
    <div className="bg-red-50 border border-red-100 rounded-2xl sm:rounded-[2rem] p-4 sm:p-8 flex flex-col sm:flex-row items-start gap-4 sm:gap-6 shadow-xl shadow-red-100/50 relative overflow-hidden group">
      <div className="p-3 sm:p-4 bg-red-100 rounded-xl sm:rounded-2xl text-red-600 shrink-0 shadow-inner">
        <AlertCircle size={24} className="sm:w-7 sm:h-7" />
      </div>
      <div className="flex-1 min-w-0 relative z-10">
        <h3 className="text-lg sm:text-xl font-black text-red-900 mb-1 sm:mb-2">Alerta de Estoque Baixo</h3>
        <p className="text-xs sm:text-sm text-red-700/80 font-medium mb-4 sm:mb-6 max-w-2xl">
          Atenção! Existem {lowStock} {lowStock === 1 ? 'item' : 'itens'} com quantidade crítica. Reponha seu estoque para evitar interrupções nos serviços.
        </p>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {lowStockItems.slice(0, 5).map(item => (
            <div key={item.id} className="bg-white/80 backdrop-blur-sm border border-red-200 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-3 shadow-sm hover:scale-105 transition-transform">
              <span className="text-[10px] sm:text-xs font-bold text-red-900">{item.name}</span>
              <div className="h-3 sm:h-4 w-px bg-red-200" />
              <span className="text-[8px] sm:text-[10px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-lg">
                {item.quantidadeAtual} / {item.estoqueMinimo}
              </span>
            </div>
          ))}
        </div>
      </div>
      <button 
        onClick={() => setActiveTab?.('inventory')}
        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-red-600 text-white px-6 py-3 rounded-xl sm:rounded-2xl font-bold text-sm hover:bg-red-700 active:scale-95 transition-all shrink-0 shadow-lg shadow-red-200 relative z-10"
      >
        <Package size={18} />
        Gerenciar Estoque
      </button>
      
      {/* Decorative background element */}
      <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-red-100/30 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700" />
    </div>
  );
};
