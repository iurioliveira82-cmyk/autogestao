import React from 'react';
import StandardDialog from '../layout/StandardDialog';
import { AppButton } from './AppButton';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger'
}) => {
  const getButtonVariant = () => {
    switch (variant) {
      case 'danger': return 'danger';
      case 'warning': return 'primary'; // Or another suitable mapping
      case 'info': return 'primary';
      case 'success': return 'primary';
      default: return 'danger';
    }
  };

  return (
    <StandardDialog 
      isOpen={isOpen} 
      onClose={onClose} 
      title={title}
      maxWidth="max-w-md"
      footer={
        <div className="flex justify-end gap-4">
          <AppButton variant="outline" onClick={onClose}>{cancelLabel}</AppButton>
          <AppButton variant={getButtonVariant()} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</AppButton>
        </div>
      }
    >
      <p className="text-slate-600 dark:text-slate-400 font-medium">{message}</p>
    </StandardDialog>
  );
};
