import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../utils';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, title, children, footer }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-slate-950 shadow-2xl z-[101] flex flex-col border-l border-border"
          >
            <div className="p-6 border-b border-border flex items-center justify-between bg-white dark:bg-slate-950">
              <h3 className="text-xl font-black text-slate-900 dark:text-white font-display">{title}</h3>
              <Button variant="ghost" size="sm" onClick={onClose} className="!p-2">
                <X size={20} />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {children}
            </div>
            {footer && (
              <div className="p-6 border-t border-border bg-white dark:bg-slate-950">
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
