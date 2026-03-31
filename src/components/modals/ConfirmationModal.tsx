import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../../utils';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger'
}) => {
  if (!isOpen) return null;

  const variants = {
    danger: {
      icon: <AlertTriangle className="text-red-600" size={40} />,
      iconBg: 'bg-red-50',
      button: 'bg-red-600 hover:bg-red-700 shadow-red-200',
      iconShadow: 'shadow-red-100/50'
    },
    warning: {
      icon: <AlertTriangle className="text-amber-600" size={40} />,
      iconBg: 'bg-amber-50',
      button: 'bg-amber-600 hover:bg-amber-700 shadow-amber-200',
      iconShadow: 'shadow-amber-100/50'
    },
    info: {
      icon: <AlertTriangle className="text-blue-600" size={40} />,
      iconBg: 'bg-blue-50',
      button: 'bg-blue-600 hover:bg-blue-700 shadow-blue-200',
      iconShadow: 'shadow-blue-100/50'
    }
  };

  const currentVariant = variants[variant];

  return (
    <div className="fixed inset-0 bg-zinc-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="p-8 text-center">
          <div className={cn(
            "w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl",
            currentVariant.iconBg,
            currentVariant.iconShadow
          )}>
            {currentVariant.icon}
          </div>
          <h3 className="text-2xl font-black text-zinc-900 mb-2">{title}</h3>
          <p className="text-sm text-zinc-500 mb-8 leading-relaxed">
            {message}
          </p>
          <div className="flex gap-4">
            <button 
              onClick={onClose}
              className="flex-1 px-6 py-4 border border-zinc-200 rounded-2xl font-bold text-zinc-600 hover:bg-zinc-50 transition-all text-sm"
            >
              {cancelLabel}
            </button>
            <button 
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={cn(
                "flex-1 px-6 py-4 text-white rounded-2xl font-bold transition-all shadow-lg text-sm",
                currentVariant.button
              )}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
