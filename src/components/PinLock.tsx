import React, { useState, useEffect, useRef } from 'react';
import { auth, signInWithEmailAndPassword } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { usePinLock } from '../contexts/PinLockContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Loader2, AlertCircle, LogOut, Delete } from 'lucide-react';
import { cn } from '../lib/utils';
import { signOut } from 'firebase/auth';

export const PinLock: React.FC = () => {
  const { user, profile } = useAuth();
  const { isLocked, unlock } = usePinLock();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const PIN_SALT = "SokoSense2026"; 
  const getPasswordFromPin = (p: string) => p + PIN_SALT;

  useEffect(() => {
    if (pin.length === 4) {
      handleVerify();
    }
  }, [pin]);

  // Auto-focus hidden input for keyboard support
  useEffect(() => {
    if (isLocked) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLocked]);

  const handleVerify = async () => {
    if (!user || !user.email) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Re-authenticate to verify PIN
      await signInWithEmailAndPassword(auth, user.email, getPasswordFromPin(pin));
      unlock();
      setPin('');
    } catch (err: any) {
      console.error('PIN verification failed:', err);
      setError('Incorrect PIN. Please try again.');
      setPin('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    unlock();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
    setPin(val);
  };

  if (!isLocked || !user || user.isAnonymous) return null;

  return (
    <div 
      className="fixed inset-0 z-[200] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center p-4"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Hidden input for keyboard support */}
      <input
        ref={inputRef}
        type="tel"
        pattern="[0-9]*"
        inputMode="numeric"
        value={pin}
        onChange={handleInputChange}
        className="absolute opacity-0 pointer-events-none"
        autoFocus
      />

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xs bg-white rounded-[2rem] shadow-2xl p-6 border border-gray-100 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-[#2E7D32]">
            <Lock className="w-6 h-6" />
          </div>
        </div>
        
        <h2 className="text-xl font-bold text-gray-800 mb-1">Security Lock</h2>
        <p className="text-gray-400 mb-6 text-xs font-medium">
          Enter PIN for {profile?.displayName || 'Farmer'}
        </p>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-xs text-left"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="font-semibold">{error}</p>
          </motion.div>
        )}

        <div className="flex justify-center gap-3 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div 
              key={i}
              className={cn(
                "w-3 h-3 rounded-full border-2 transition-all duration-200",
                pin.length > i ? "bg-[#2E7D32] border-[#2E7D32] scale-125 shadow-sm" : "bg-transparent border-gray-200"
              )}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => pin.length < 4 && setPin(prev => prev + num)}
              className="w-full aspect-square rounded-2xl bg-gray-50 text-xl font-bold text-gray-700 hover:bg-gray-100 active:bg-gray-200 active:scale-95 transition-all flex items-center justify-center"
            >
              {num}
            </button>
          ))}
          <button
            onClick={() => setPin(prev => prev.slice(0, -1))}
            className="w-full aspect-square rounded-2xl bg-gray-50 text-gray-400 hover:bg-gray-100 active:bg-gray-200 active:scale-95 transition-all flex items-center justify-center"
          >
            <Delete className="w-5 h-5" />
          </button>
          <button
            onClick={() => pin.length < 4 && setPin(prev => prev + '0')}
            className="w-full aspect-square rounded-2xl bg-gray-50 text-xl font-bold text-gray-700 hover:bg-gray-100 active:bg-gray-200 active:scale-95 transition-all flex items-center justify-center"
          >
            0
          </button>
          <div className="w-full aspect-square" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 text-[#2E7D32] text-xs font-bold mb-4 h-6">
            <Loader2 className="w-3 h-3 animate-spin" />
            Verifying...
          </div>
        ) : (
          <div className="h-6 mb-4" />
        )}

        <button
          onClick={handleLogout}
          className="text-[10px] font-bold text-gray-400 hover:text-red-500 uppercase tracking-widest flex items-center justify-center gap-2 mx-auto transition-colors"
        >
          <LogOut className="w-3 h-3" />
          Logout
        </button>
      </motion.div>
    </div>
  );
};
