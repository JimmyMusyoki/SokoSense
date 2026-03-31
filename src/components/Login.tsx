import React, { useState, useEffect, useRef } from 'react';
import { auth, RecaptchaVerifier, signInWithPhoneNumber, signInAnonymously } from '../firebase';
import { ConfirmationResult } from 'firebase/auth';
import { Loader2, Phone, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export const Login: React.FC = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'phone' | 'code'>('phone');

  const recaptchaRef = useRef<any>(null);

  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  useEffect(() => {
    return () => {
      if (recaptchaRef.current) {
        try {
          recaptchaRef.current.clear();
          recaptchaRef.current = null;
        } catch (e) {
          console.error('Error clearing recaptcha:', e);
        }
      }
    };
  }, []);

  const initRecaptcha = () => {
    if (!recaptchaRef.current) {
      try {
        recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {
            console.log('reCAPTCHA resolved');
          },
          'expired-callback': () => {
            console.log('reCAPTCHA expired');
            if (recaptchaRef.current) {
              recaptchaRef.current.clear();
              recaptchaRef.current = null;
            }
          }
        });
      } catch (err) {
        console.error('reCAPTCHA init error:', err);
      }
    }
  };

  const handleSendCode = async () => {
    if (!phoneNumber.trim()) return;
    setLoading(true);
    setError(null);
    try {
      initRecaptcha();
      const appVerifier = recaptchaRef.current;
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setConfirmationResult(confirmation);
      setStep('code');
      setResendTimer(60); // 60 second cooldown
    } catch (err: any) {
      console.error('Error sending code:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Phone authentication is not enabled in your Firebase project. Please go to the Firebase Console > Authentication > Sign-in method and enable "Phone".');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized. Please add the current URL to "Authorized domains" in Firebase Console > Authentication > Settings.');
      } else if (err.message?.includes('reCAPTCHA') || err.code?.includes('captcha')) {
        setError('reCAPTCHA verification failed. Please try again or refresh the page.');
        // Reset recaptcha on error to allow retry
        if (recaptchaRef.current) {
          try {
            recaptchaRef.current.clear();
            recaptchaRef.current = null;
          } catch (e) {}
        }
      } else {
        setError(err.message || 'Failed to send verification code. Ensure the number is in international format (e.g., +254...).');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim() || !confirmationResult) return;
    setLoading(true);
    setError(null);
    try {
      await confirmationResult.confirm(verificationCode);
      // Auth state will update via AuthProvider
    } catch (err: any) {
      console.error('Error verifying code:', err);
      setError('Invalid verification code. Please try again.');
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
      console.error('Error in demo login:', err);
      if (err.code === 'auth/admin-restricted-operation' || err.code === 'auth/operation-not-allowed') {
        setError('Anonymous login is disabled in Firebase Console. Please enable it in Authentication > Sign-in method.');
      } else {
        setError('Demo login failed. Please ensure Anonymous Authentication is enabled in Firebase Console.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBypassLogin = () => {
    // Dispatch custom event to AuthContext
    window.dispatchEvent(new CustomEvent('auth:bypass', { 
      detail: { uid: `bypass-${Date.now()}` } 
    }));
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center text-[#2E7D32]">
            <Phone className="w-8 h-8" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
          {step === 'phone' ? 'Karibu SokoSense' : 'Verify Your Number'}
        </h2>
        <p className="text-center text-gray-500 mb-8 text-sm">
          {step === 'phone' 
            ? 'Enter your phone number to receive a secure login code.' 
            : `We've sent a 6-digit code to ${phoneNumber}`}
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex flex-col gap-3 text-red-600 text-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="font-medium leading-relaxed">{error}</p>
            </div>
            {(error.includes('disabled') || error.includes('enabled') || error.includes('authorized')) && (
              <button 
                onClick={handleBypassLogin}
                className="mt-2 text-[#2E7D32] font-bold underline text-left hover:text-[#1B5E20]"
              >
                Skip Login for now (Testing Mode)
              </button>
            )}
          </div>
        )}

        <div className="space-y-4">
          {step === 'phone' ? (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+254 700 000 000"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent outline-none transition-all text-lg font-medium"
                />
              </div>
              <button
                onClick={handleSendCode}
                disabled={loading || !phoneNumber}
                className="w-full py-4 bg-[#2E7D32] text-white rounded-2xl font-bold shadow-lg shadow-green-100 hover:bg-[#1B5E20] disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Code'}
              </button>

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
            </>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 text-center block">Verification Code</label>
                <input
                  type="text"
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  maxLength={6}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent outline-none transition-all text-center text-3xl tracking-[0.4em] font-black"
                />
              </div>
              <button
                onClick={handleVerifyCode}
                disabled={loading || verificationCode.length !== 6}
                className="w-full py-4 bg-[#2E7D32] text-white rounded-2xl font-bold shadow-lg shadow-green-100 hover:bg-[#1B5E20] disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & Login'}
              </button>
              
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={handleSendCode}
                  disabled={loading || resendTimer > 0}
                  className="text-sm font-bold text-[#2E7D32] hover:underline disabled:text-gray-400 disabled:no-underline"
                >
                  {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend Code'}
                </button>
                <button
                  onClick={() => setStep('phone')}
                  className="text-xs font-medium text-gray-400 hover:text-gray-600"
                >
                  Use a different phone number
                </button>
              </div>
            </>
          )}
        </div>

        <div id="recaptcha-container"></div>
      </div>
    </div>
  );
};
