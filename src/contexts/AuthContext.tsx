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
import { doc, getDoc, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile, UserRole, UserPermissions } from '../types';
import { 
  defaultPermissions, 
  adminPermissions, 
  gerentePermissions, 
  tecnicoPermissions, 
  financeiroPermissions, 
  estoquePermissions, 
  atendimentoPermissions,
  getPermissionsByRole
} from '../modules/auth/permissions';
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

  const bootstrapUser = async (firebaseUser: User) => {
    try {
      const docRef = doc(db, 'usuarios', firebaseUser.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
        setLoading(false);
        return;
      }

      // Check for invited user (by email)
      const emailDocRef = doc(db, 'usuarios', firebaseUser.email || 'no-email');
      let emailDocSnap;
      try {
        emailDocSnap = await getDoc(emailDocRef);
      } catch (e) {
        // If we can't read by email, it's likely not an invited user or rules blocked it
        console.log('Email lookup skipped or failed');
      }
      
      if (emailDocSnap?.exists()) {
        const preProfile = emailDocSnap.data() as UserProfile;
        const newProfile: UserProfile = {
          ...preProfile,
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || preProfile.name || 'Usuário',
          status: 'active',
          updatedAt: serverTimestamp() as any
        };
        
        const batch = writeBatch(db);
        batch.set(docRef, newProfile);
        batch.delete(emailDocRef);
        await batch.commit();
        
        setProfile(newProfile);
        toast.success('Perfil vinculado com sucesso!');
      } else {
        // New user: Create company and profile
        // Ensure empresaId is at least 10 chars to pass rules
        const empresaId = `empresa_${Math.random().toString(36).substr(2, 9)}`.padEnd(12, '0');
        const isAdminEmail = firebaseUser.email === 'iurioliveira82@gmail.com';
        const role: UserRole = isAdminEmail ? 'admin' : 'gerente';
        
        const batch = writeBatch(db);
        
        // 1. Create Company
        batch.set(doc(db, 'empresas', empresaId), {
          id: empresaId,
          name: `Oficina de ${firebaseUser.displayName || 'Usuário'}`,
          plan: 'pro',
          createdAt: serverTimestamp()
        });
        
        // 2. Create User Profile
        const newProfileData = {
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || 'Usuário',
          email: firebaseUser.email || '',
          role,
          empresaId: empresaId,
          permissions: getPermissionsByRole(role),
          status: 'active',
          createdAt: serverTimestamp()
        };
        batch.set(docRef, newProfileData);
        
        await batch.commit();
        
        setProfile({
          ...newProfileData,
          createdAt: new Date().toISOString()
        } as UserProfile);
        
        toast.success('Bem-vindo! Sua conta foi configurada.');
      }
    } catch (error) {
      console.error('Auth Bootstrap Error:', error);
      // Only show error if it's not a "permission denied" on a non-existent doc
      if (!(error instanceof Error && error.message.includes('permission-denied'))) {
        toast.error('Erro ao configurar perfil. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await bootstrapUser(firebaseUser);
      } else {
        setProfile(null);
        setLoading(false);
      }
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
