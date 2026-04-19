import React, { useState } from 'react';
import { auth, db, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, Mail, Phone, Lock, User as UserIcon, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { UserProfile } from '../types';

export const Login: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [identifier, setIdentifier] = useState(''); // Email or Phone
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Firebase requires at least 6 characters for passwords.
  // We'll append a constant salt to the 4-digit PIN.
  const PIN_SALT = "SokoSense2026"; 
  const getPasswordFromPin = (p: string) => p + PIN_SALT;

  const normalizePhone = (phone: string) => {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    // If it starts with 0 and has 10 digits, replace 0 with 254
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      cleaned = '254' + cleaned.substring(1);
    }
    // If it's 9 digits, assume it needs 254
    if (cleaned.length === 9) {
      cleaned = '254' + cleaned;
    }
    return cleaned;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || pin.length !== 4) return;
    
    setLoading(true);
    setError(null);
    
    try {
      let loginEmail = identifier;
      
      // If identifier is a phone number (doesn't contain @)
      if (!identifier.includes('@')) {
        const cleanPhone = normalizePhone(identifier);
        const path = `phone_to_email/${cleanPhone}`;
        try {
          const phoneDoc = await getDoc(doc(db, 'phone_to_email', cleanPhone));
          if (!phoneDoc.exists()) {
            throw new Error('No account found with this phone number. Please sign up!');
          }
          loginEmail = phoneDoc.data().email;
        } catch (err: any) {
          if (err.message.includes('No account found')) throw err;
          handleFirestoreError(err, OperationType.GET, path);
        }
      }
      
      await signInWithEmailAndPassword(auth, loginEmail.trim(), getPasswordFromPin(pin));
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password authentication is not enabled in your Firebase project. Please go to the Firebase Console and enable it.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-email') {
        setError('Incorrect email/phone or PIN. Please double-check your credentials.');
      } else if (err.code === 'auth/user-not-found') {
        setError('No account found with this email. Please check your spelling or sign up.');
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect PIN. Please try again.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError(err.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !phoneNumber.trim() || pin.length !== 4) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const cleanPhone = normalizePhone(phoneNumber);
      
      // 1. Check if phone already mapped
      const phonePath = `phone_to_email/${cleanPhone}`;
      try {
        const phoneDoc = await getDoc(doc(db, 'phone_to_email', cleanPhone));
        if (phoneDoc.exists()) {
          setError(`This phone (${cleanPhone}) is already registered.`);
          setIdentifier(phoneNumber);
          setMode('login');
          setLoading(false);
          return;
        }
      } catch (err: any) {
        handleFirestoreError(err, OperationType.GET, phonePath);
      }
      
      // 2. Create Auth User
      // Trim email to avoid hidden character issues
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), getPasswordFromPin(pin));
      const user = userCredential.user;
      
      // 3. Create User Profile
      const profile: UserProfile = {
        uid: user.uid,
        email: email,
        phoneNumber: cleanPhone,
        displayName: displayName || 'Farmer',
        createdAt: serverTimestamp(),
        role: 'user',
        followersCount: 0,
        followingCount: 0,
        rating: 5.0,
        successfulDeals: 0
      };
      
      const userPath = `users/${user.uid}`;
      try {
        await setDoc(doc(db, 'users', user.uid), profile);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, userPath);
      }
      
      // 4. Create Phone Mapping
      try {
        await setDoc(doc(db, 'phone_to_email', cleanPhone), { email });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, phonePath);
      }
      
    } catch (err: any) {
      console.error('Signup error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password authentication is not enabled in your Firebase project. Please go to the Firebase Console > Authentication > Sign-in method and enable "Email/Password".');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already in use. Please login instead.');
      } else if (err.code === 'auth/weak-password') {
        setError('The PIN is too weak. Please try a different combination.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please provide a valid email address.');
      } else {
        setError(err.message || 'Signup failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInAnonymously(auth);
    } catch (err: any) {
      console.error('Demo login error:', err);
      setError('Demo login failed. Please ensure Anonymous Auth is enabled.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center text-[#2E7D32]">
            <Lock className="w-8 h-8" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
          {mode === 'login' ? 'Karibu Tena' : 'Create Account'}
        </h2>
        <p className="text-center text-gray-500 mb-8 text-sm">
          {mode === 'login' 
            ? 'Login with your email or phone number and PIN.' 
            : 'Join SokoSense to start trading your produce.'}
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="font-medium leading-relaxed">{error}</p>
          </div>
        )}

        <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-4">
          {mode === 'login' ? (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Email or Phone</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="example@mail.com or +254..."
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full pl-12 pr-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#2E7D32] outline-none transition-all"
                    required
                  />
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full pl-12 pr-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#2E7D32] outline-none transition-all"
                    required
                  />
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="farmer@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#2E7D32] outline-none transition-all"
                    required
                  />
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Phone Number</label>
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="+254 700 000 000"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full pl-12 pr-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#2E7D32] outline-none transition-all"
                    required
                  />
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">4-Digit PIN</label>
            <div className="relative">
              <input
                type="password"
                placeholder="****"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full pl-12 pr-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#2E7D32] outline-none transition-all text-2xl tracking-[0.5em]"
                required
              />
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#2E7D32] text-white rounded-2xl font-bold shadow-lg shadow-green-100 hover:bg-[#1B5E20] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (mode === 'login' ? 'Login' : 'Create Account')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="text-sm font-bold text-[#2E7D32] hover:underline"
          >
            {mode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Login"}
          </button>
        </div>

        <div className="relative flex items-center gap-4 my-6">
          <div className="h-[1px] flex-1 bg-gray-100"></div>
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Or</span>
          <div className="h-[1px] flex-1 bg-gray-100"></div>
        </div>

        <button
          onClick={handleDemoLogin}
          disabled={loading}
          className="w-full py-4 bg-white text-gray-700 border-2 border-gray-100 rounded-2xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Try Demo Mode'}
        </button>
      </div>
    </div>
  );
};
