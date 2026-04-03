import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { User, Camera, Loader2, Check, X, LogOut, MapPin, Info, Star, Users, UserCheck } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { cn } from '../lib/utils';
import { FollowLists } from './FollowLists';
import { UserProfileView } from './UserProfileView';
import { SuggestedFollows } from './SuggestedFollows';

interface ProfileProps {
  onClose: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ onClose }) => {
  const { user, profile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [about, setAbout] = useState(profile?.about || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'edit' | 'followers' | 'following'>('edit');
  const [viewingProfileUid, setViewingProfileUid] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync local state with profile if it updates in background
  React.useEffect(() => {
    if (profile && !isUpdating) {
      setDisplayName(profile.displayName || '');
      setAbout(profile.about || '');
      setLocation(profile.location || '');
    }
  }, [profile, isUpdating]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Check file size (limit to 300KB to be safe with Firestore 500KB limit)
    if (file.size > 300 * 1024) {
      setError('Image size must be less than 300KB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      setIsUpdating(true);
      setError(null);
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          photoURL: base64String
        });
        setUpdateSuccess(true);
        setTimeout(() => setUpdateSuccess(false), 3000);
      } catch (err: any) {
        console.error('Error updating photo:', err);
        setError(err.message || 'Failed to update photo');
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      } finally {
        setIsUpdating(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateProfile = async () => {
    if (!user || isUpdating) return;

    setIsUpdating(true);
    setError(null);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: displayName.trim(),
        about: about.trim(),
        location: location.trim()
      });
      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to update profile');
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    const handleViewProfile = (e: any) => {
      setViewingProfileUid(e.detail);
    };
    window.addEventListener('viewProfile', handleViewProfile);
    return () => window.removeEventListener('viewProfile', handleViewProfile);
  }, []);

  if (viewingProfileUid) {
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <UserProfileView 
          uid={viewingProfileUid} 
          onClose={() => setViewingProfileUid(null)} 
        />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-3xl p-6 shadow-xl max-w-md w-full mx-auto border border-gray-100 min-h-[500px] flex flex-col pb-28"
    >
      {view === 'edit' ? (
        <>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-gray-800">Your Profile</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="flex flex-col items-center gap-6 overflow-y-auto pr-1 custom-scrollbar">
            {/* Profile Picture */}
            <div className="relative group">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-green-50 shadow-inner bg-gray-50 flex items-center justify-center">
                {profile?.photoURL ? (
                  <img 
                    src={profile.photoURL} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User className="w-12 h-12 text-gray-300" />
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 bg-[#2E7D32] text-white rounded-full shadow-lg hover:bg-[#1B5E20] transition-all"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
            </div>

            {/* Form */}
            <div className="w-full space-y-4">
              {/* Reputation Stats */}
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="bg-green-50/50 border border-green-100 rounded-2xl p-3 flex flex-col items-center justify-center gap-1">
                  <div className="flex items-center gap-1 text-yellow-500">
                    <Star className="w-4 h-4 fill-current" />
                    <span className="text-lg font-bold">{profile?.rating?.toFixed(1) || '0.0'}</span>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Rating</span>
                </div>
                <div className="bg-green-50/50 border border-green-100 rounded-2xl p-3 flex flex-col items-center justify-center gap-1">
                  <span className="text-lg font-bold text-[#2E7D32]">{profile?.successfulDeals || 0}</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Successful Deals</span>
                </div>
              </div>

              {/* Follower Stats */}
              <div className="flex justify-center gap-4 py-2 border-b border-gray-50">
                <button 
                  onClick={() => setView('followers')}
                  className="flex-1 text-center p-3 hover:bg-gray-50 rounded-2xl transition-all border border-transparent hover:border-gray-100"
                >
                  <p className="text-lg font-bold text-gray-900">{profile?.followersCount || 0}</p>
                  <div className="flex items-center justify-center gap-1 text-gray-400">
                    <Users className="w-3 h-3" />
                    <p className="text-[10px] font-bold uppercase tracking-wider">Followers</p>
                  </div>
                </button>
                <button 
                  onClick={() => setView('following')}
                  className="flex-1 text-center p-3 hover:bg-gray-50 rounded-2xl transition-all border border-transparent hover:border-gray-100"
                >
                  <p className="text-lg font-bold text-gray-900">{profile?.followingCount || 0}</p>
                  <div className="flex items-center justify-center gap-1 text-gray-400">
                    <UserCheck className="w-3 h-3" />
                    <p className="text-[10px] font-bold uppercase tracking-wider">Following</p>
                  </div>
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Phone Number</label>
                <p className="px-4 py-3 bg-gray-50 rounded-2xl text-gray-500 font-medium border border-gray-100">
                  {profile?.phoneNumber}
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Location</label>
                <div className="relative">
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Nairobi, Wakulima Market"
                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
                  />
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">About (What you sell)</label>
                <textarea
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  placeholder="Describe your produce and business..."
                  rows={3}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-green-500 outline-none transition-all resize-none"
                />
              </div>

              <button
                onClick={handleUpdateProfile}
                disabled={isUpdating || !displayName.trim() || (displayName === profile?.displayName && about === profile?.about && location === profile?.location)}
                className={cn(
                  "w-full py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2",
                  updateSuccess 
                    ? "bg-green-100 text-green-700" 
                    : "bg-[#2E7D32] text-white shadow-lg shadow-green-100 hover:bg-[#1B5E20] disabled:opacity-50 disabled:shadow-none"
                )}
              >
                {isUpdating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : updateSuccess ? (
                  <>
                    <Check className="w-5 h-5" />
                    Updated!
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>

              <div className="pt-4 border-t border-gray-100">
                <SuggestedFollows />
                <button
                  onClick={() => signOut(auth)}
                  className="w-full py-3 text-red-500 font-bold flex items-center justify-center gap-2 hover:bg-red-50 rounded-2xl transition-all mt-4"
                >
                  <LogOut className="w-5 h-5" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <FollowLists 
          type={view === 'followers' ? 'followers' : 'following'} 
          onBack={() => setView('edit')} 
        />
      )}
    </motion.div>
  );
};
