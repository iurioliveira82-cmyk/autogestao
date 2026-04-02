import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { XCircle, Trash2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (signatureData: string) => void;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({ isOpen, onClose, onSave }) => {
  const sigCanvas = useRef<SignatureCanvas>(null);

  const clear = () => {
    sigCanvas.current?.clear();
  };

  const save = () => {
    if (sigCanvas.current?.isEmpty()) return;
    const data = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png');
    if (data) {
      onSave(data);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100"
          >
            <div className="p-8 sm:p-10 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight font-display">Assinatura Digital</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Assine no campo abaixo</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <XCircle size={24} className="text-slate-400" />
              </button>
            </div>

            <div className="p-8 sm:p-10">
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] overflow-hidden">
                <SignatureCanvas 
                  ref={sigCanvas}
                  penColor="black"
                  canvasProps={{
                    className: "w-full h-64 cursor-crosshair"
                  }}
                />
              </div>

              <div className="flex items-center justify-between mt-8">
                <button
                  type="button"
                  onClick={clear}
                  className="flex items-center gap-2 px-6 py-3 text-sm font-black text-rose-500 uppercase tracking-widest hover:bg-rose-50 rounded-2xl transition-all"
                >
                  <Trash2 size={18} />
                  Limpar
                </button>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-3 text-sm font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    className="btn-modern !px-8 !py-3 flex items-center gap-2"
                  >
                    <CheckCircle2 size={18} />
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
