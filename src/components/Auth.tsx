import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged, 
  signOut,
  updateProfile,
  User
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile, UserRole, UserPermissions, ModulePermissions } from '../types';
import { defaultPermissions, adminPermissions } from '../lib/permissions';
import { LogIn, LogOut, User as UserIcon, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          // Check if there's a pre-created profile by email
          const emailDocRef = doc(db, 'users', user.email || '');
          const emailDocSnap = await getDoc(emailDocRef);
          
          if (emailDocSnap.exists()) {
            const preProfile = emailDocSnap.data() as UserProfile;
            const newProfile: UserProfile = {
              ...preProfile,
              uid: user.uid,
              name: user.displayName || preProfile.name || 'Usuário',
              updatedAt: serverTimestamp() as any
            };
            await setDoc(docRef, newProfile);
            await deleteDoc(emailDocRef);
            setProfile(newProfile);
          } else {
            const isAdminEmail = user.email === 'iurioliveira82@gmail.com';
            const newProfile: UserProfile = {
              uid: user.uid,
              name: user.displayName || 'Usuário',
              email: user.email || '',
              role: isAdminEmail ? 'admin' : 'employee',
              permissions: isAdminEmail ? adminPermissions : defaultPermissions,
              createdAt: new Date().toISOString()
            };
            await setDoc(docRef, {
              ...newProfile,
              createdAt: serverTimestamp()
            });
            setProfile(newProfile);
          }
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Login realizado com sucesso!');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/operation-not-allowed') {
        toast.error('O login por E-mail/Senha não está ativado no Console do Firebase.');
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        toast.error('Email ou senha incorretos.');
      } else {
        toast.error('Erro ao realizar login.');
      }
    }
  };

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      await signInWithPopup(auth, provider);
      toast.success('Login com Google realizado com sucesso!');
    } catch (error: any) {
      console.error(error);
      toast.error('Erro ao realizar login com Google.');
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Set the display name in the auth profile
      await updateProfile(user, { displayName: name });
      
      toast.success('Conta criada com sucesso!');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/operation-not-allowed') {
        toast.error('O cadastro por E-mail/Senha não está ativado no Console do Firebase.');
      } else if (error.code === 'auth/email-already-in-use') {
        toast.error('Este email já está em uso.');
      } else if (error.code === 'auth/weak-password') {
        toast.error('A senha deve ter pelo menos 6 caracteres.');
      } else {
        toast.error('Erro ao criar conta.');
      }
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      toast.success('Sessão encerrada.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao encerrar sessão.');
    }
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signInWithGoogle, signUp, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

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
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-zinc-200">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-zinc-900 text-white rounded-2xl mb-4">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">AutoGestão SaaS</h1>
          <p className="text-zinc-500">Gestão completa para estética, mecânica e revenda.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Nome</label>
              <input 
                type="text" 
                required
                placeholder="Seu nome completo"
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Email</label>
            <input 
              type="email" 
              required
              placeholder="seu@email.com"
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Senha</label>
            <input 
              type="password" 
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-3 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-400 text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-200 shadow-lg shadow-zinc-200 mt-4"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn size={20} />
                {isSignUp ? 'Criar Conta' : 'Entrar no Sistema'}
              </>
            )}
          </button>
        </form>

        {!isSignUp && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-zinc-400 tracking-widest font-bold">Ou continue com</span>
              </div>
            </div>

            <button
              onClick={() => signInWithGoogle()}
              className="w-full flex items-center justify-center gap-3 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-900 font-semibold py-3 px-6 rounded-2xl transition-all duration-200 shadow-sm"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              Google
            </button>
          </>
        )}

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm font-bold text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            {isSignUp ? 'Já tem uma conta? Entre aqui' : 'Não tem conta? Cadastre-se'}
          </button>
        </div>
        
        <div className="mt-8 text-center text-xs text-zinc-400 uppercase tracking-widest">
          Sistema Profissional de Gestão Automotiva
        </div>
      </div>
    </div>
  );
};
