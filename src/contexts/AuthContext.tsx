import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../firebase';

interface AuthContextType {
  currentUser: User | null;
  authLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  isFirebaseConfigured: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    }, (error) => {
      console.error('onAuthStateChanged error:', error);
      setAuthLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error('Firebase is not configured. Please supply keys.');
    }
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email: string, password: string, displayName?: string) => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error('Firebase is not configured. Please supply keys.');
    }
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName && userCredential.user) {
      await updateProfile(userCredential.user, { displayName });
    }
  };

  const signInWithGoogle = async () => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error('Firebase is not configured. Please supply keys.');
    }
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signOut = async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
  };

  const value = {
    currentUser,
    authLoading,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
    isFirebaseConfigured
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
