import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils';
import { motion, AnimatePresence } from 'motion/react';

interface StandardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  showHeader?: boolean;
}

const StandardDialog: React.FC<StandardDialogProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'max-w-2xl',
  showHeader = true
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          {/* Overlay */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />

          {/* Dialog */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn(
              "relative w-full bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col",
              maxWidth
            )}
          >
            {showHeader && (
              <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight font-display">
                    {title}
                  </h2>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all active:scale-90"
                >
                  <X size={24} />
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar max-h-[70vh]">
              {children}
            </div>

            {footer && (
              <div className="px-8 py-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-4">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default StandardDialog;
