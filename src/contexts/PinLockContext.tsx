import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

interface PinLockContextType {
  isLocked: boolean;
  unlock: () => void;
  lock: () => void;
  timeoutMinutes: number;
  setTimeoutMinutes: (minutes: number) => void;
}

const PinLockContext = createContext<PinLockContextType>({
  isLocked: false,
  unlock: () => {},
  lock: () => {},
  timeoutMinutes: 5,
  setTimeoutMinutes: () => {},
});

export const usePinLock = () => useContext(PinLockContext);

export const PinLockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isLocked, setIsLocked] = useState(false);
  const [timeoutMinutes, setTimeoutMinutesState] = useState(() => {
    const saved = localStorage.getItem('pin_timeout_minutes');
    return saved ? parseInt(saved, 10) : 5;
  });
  const [lastActivity, setLastActivity] = useState(Date.now());

  const setTimeoutMinutes = (minutes: number) => {
    setTimeoutMinutesState(minutes);
    localStorage.setItem('pin_timeout_minutes', minutes.toString());
  };

  const lock = useCallback(() => {
    if (user && !user.isAnonymous) {
      setIsLocked(true);
    }
  }, [user]);

  const unlock = useCallback(() => {
    setIsLocked(false);
    setLastActivity(Date.now());
  }, []);

  // Track activity
  useEffect(() => {
    if (!user || user.isAnonymous || isLocked) return;

    const handleActivity = () => {
      setLastActivity(Date.now());
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'mousemove'];
    events.forEach(event => window.addEventListener(event, handleActivity));

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = (now - lastActivity) / 1000 / 60; // in minutes
      if (diff >= timeoutMinutes) {
        lock();
      }
    }, 10000); // Check every 10 seconds

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      clearInterval(interval);
    };
  }, [user, isLocked, lastActivity, timeoutMinutes, lock]);

  // Handle app background/foreground
  useEffect(() => {
    if (!user || user.isAnonymous) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        const diff = (now - lastActivity) / 1000 / 60;
        if (diff >= timeoutMinutes) {
          lock();
        }
      } else {
        // App went to background, record this as last activity
        setLastActivity(Date.now());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, lastActivity, timeoutMinutes, lock]);

  // Lock on initial load if user is logged in
  useEffect(() => {
    if (user && !user.isAnonymous) {
      setIsLocked(true);
    } else {
      setIsLocked(false);
    }
  }, [user]);

  return (
    <PinLockContext.Provider value={{ isLocked, unlock, lock, timeoutMinutes, setTimeoutMinutes }}>
      {children}
    </PinLockContext.Provider>
  );
};
