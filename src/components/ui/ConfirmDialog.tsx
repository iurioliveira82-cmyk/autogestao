import React from 'react';
import StandardDialog from '../layout/StandardDialog';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar'
}) => {
  return (
    <StandardDialog 
      isOpen={isOpen} 
      onClose={onClose} 
      title={title}
      maxWidth="max-w-md"
      footer={
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={onClose}>{cancelLabel}</Button>
          <Button variant="danger" onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button>
        </div>
      }
    >
      <p className="text-slate-600 dark:text-slate-400 font-medium">{message}</p>
    </StandardDialog>
  );
};
