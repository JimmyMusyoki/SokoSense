import React, { useState, useEffect } from 'react';
import { auth, RecaptchaVerifier, signInWithPhoneNumber } from '../firebase';
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

  useEffect(() => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {
          console.log('Recaptcha resolved');
        }
      });
    }
  }, []);

  const handleSendCode = async () => {
    if (!phoneNumber.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const appVerifier = (window as any).recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setConfirmationResult(confirmation);
      setStep('code');
    } catch (err: any) {
      console.error('Error sending code:', err);
      setError(err.message || 'Failed to send verification code. Check phone number format (e.g., +254...).');
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

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center text-[#2E7D32]">
            <Phone className="w-8 h-8" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
          {step === 'phone' ? 'Karibu SokoSense' : 'Verify Phone'}
        </h2>
        <p className="text-center text-gray-500 mb-8 text-sm">
          {step === 'phone' 
            ? 'Enter your phone number to login or register.' 
            : `We sent a code to ${phoneNumber}`}
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {step === 'phone' ? (
            <>
              <div className="relative">
                <input
                  type="tel"
                  placeholder="+254 700 000 000"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent outline-none transition-all text-lg"
                />
              </div>
              <button
                onClick={handleSendCode}
                disabled={loading || !phoneNumber}
                className="w-full py-4 bg-[#2E7D32] text-white rounded-2xl font-bold shadow-lg shadow-green-100 hover:bg-[#1B5E20] disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Code'}
              </button>
            </>
          ) : (
            <>
              <input
                type="text"
                placeholder="Enter 6-digit code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                maxLength={6}
                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent outline-none transition-all text-center text-2xl tracking-[0.5em] font-bold"
              />
              <button
                onClick={handleVerifyCode}
                disabled={loading || verificationCode.length !== 6}
                className="w-full py-4 bg-[#2E7D32] text-white rounded-2xl font-bold shadow-lg shadow-green-100 hover:bg-[#1B5E20] disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & Login'}
              </button>
              <button
                onClick={() => setStep('phone')}
                className="w-full py-2 text-gray-400 text-sm font-medium hover:text-gray-600 transition-colors"
              >
                Change Phone Number
              </button>
            </>
          )}
        </div>

        <div id="recaptcha-container"></div>
      </div>
    </div>
  );
};
