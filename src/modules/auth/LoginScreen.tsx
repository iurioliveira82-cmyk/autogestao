import React, { useState } from 'react';
import { LogIn, ShieldCheck, Mail, Lock, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { AuthLayout } from '../../layouts/AuthLayout';
import { AppButton } from '../../components/ui/AppButton';
import { AppInput } from '../../components/ui/AppInput';

export const LoginScreen: React.FC = () => {
  const { signIn, signInWithGoogle, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (isSignUp) {
        await signUp(email, password, name);
      } else {
        await signIn(email, password);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout 
      title={isSignUp ? "Criar Conta" : "Bem-vindo de volta"}
      subtitle={isSignUp ? "Junte-se ao AutoGestão SaaS hoje" : "Acesse sua conta para gerenciar seu negócio"}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {isSignUp && (
          <AppInput
            label="Nome Completo"
            placeholder="Seu nome"
            icon={<User size={18} />}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        )}
        
        <AppInput
          label="Email Profissional"
          type="email"
          placeholder="seu@email.com"
          icon={<Mail size={18} />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <AppInput
          label="Senha de Acesso"
          type="password"
          placeholder="••••••••"
          icon={<Lock size={18} />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <AppButton
          type="submit"
          loading={isSubmitting}
          className="w-full py-4 text-base"
          icon={<LogIn size={20} />}
        >
          {isSignUp ? 'Criar minha conta' : 'Entrar no sistema'}
        </AppButton>
      </form>

      {!isSignUp && (
        <>
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-black">
              <span className="bg-white px-4 text-slate-400">Ou continue com</span>
            </div>
          </div>

          <AppButton
            variant="outline"
            onClick={() => signInWithGoogle()}
            className="w-full py-3"
            icon={<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />}
          >
            Entrar com Google
          </AppButton>
        </>
      )}

      <div className="mt-8 text-center">
        <button 
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-sm font-bold text-slate-500 hover:text-primary transition-colors"
        >
          {isSignUp ? 'Já possui uma conta? Faça login' : 'Não tem uma conta? Comece agora'}
        </button>
      </div>
    </AuthLayout>
  );
};
