import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils';
import { motion, AnimatePresence } from 'motion/react';

interface StandardDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  side?: 'right' | 'left';
}

const StandardDrawer: React.FC<StandardDrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'max-w-md',
  side = 'right'
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-end">
          {/* Overlay */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div 
            initial={{ x: side === 'right' ? '100%' : '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: side === 'right' ? '100%' : '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn(
              "relative h-full w-full bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col",
              maxWidth,
              side === 'right' ? "border-l" : "border-r",
              "border-slate-100 dark:border-slate-800"
            )}
          >
            <div className="px-8 py-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight font-display">
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
                    {subtitle}
                  </p>
                )}
              </div>
              <button 
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all active:scale-90"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
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

export default StandardDrawer;
