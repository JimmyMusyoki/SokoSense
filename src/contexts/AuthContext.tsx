import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthReady: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAuthReady: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Bypass mode for development/debugging when Firebase Auth is not configured
  const bypassAuth = (mockUid: string = 'demo-user-123') => {
    const mockUser = {
      uid: mockUid,
      phoneNumber: '+254700000000',
      displayName: 'Demo Farmer',
    } as User;
    
    const mockProfile: UserProfile = {
      uid: mockUid,
      phoneNumber: '+254700000000',
      displayName: 'Demo Farmer',
      createdAt: serverTimestamp(),
      role: 'user'
    };
    
    setUser(mockUser);
    setProfile(mockProfile);
    setLoading(false);
    setIsAuthReady(true);
  };

  useEffect(() => {
    // Listen for a custom event to trigger bypass
    const handleBypass = (e: any) => {
      bypassAuth(e.detail?.uid);
    };
    window.addEventListener('auth:bypass', handleBypass);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setProfile(userDoc.data() as UserProfile);
          } else {
            const newProfile: UserProfile = {
              uid: user.uid,
              phoneNumber: user.phoneNumber || '',
              displayName: user.displayName || 'Farmer',
              createdAt: serverTimestamp(),
              role: 'user'
            };
            await setDoc(doc(db, 'users', user.uid), newProfile);
            setProfile(newProfile);
          }
        } catch (err) {
          console.error('Error fetching profile:', err);
          // If Firestore fails (e.g. rules), we still have the user
        }
      } else {
        // Only clear if we're not in bypass mode (simple check: if user was set but auth says null)
        // For simplicity, we'll just let the bypass stay until refresh
      }
      setLoading(false);
      setIsAuthReady(true);
    });

    return () => {
      unsubscribe();
      window.removeEventListener('auth:bypass', handleBypass);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAuthReady }}>
      {children}
    </AuthContext.Provider>
  );
};
