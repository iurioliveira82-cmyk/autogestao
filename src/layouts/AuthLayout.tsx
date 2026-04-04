import React from 'react';
import { Car } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-primary text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/20 mb-6 rotate-3">
            <Car size={32} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter font-display">
            {title}
          </h1>
          {subtitle && (
            <p className="text-slate-500 font-medium mt-2">
              {subtitle}
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-card border border-slate-200 p-8">
          {children}
        </div>

        <p className="text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
          &copy; {new Date().getFullYear()} AutoGestão ERP &bull; Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
