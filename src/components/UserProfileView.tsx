import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, addDoc, deleteDoc, serverTimestamp, increment, updateDoc, writeBatch, setDoc, onSnapshot } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { User, MapPin, Star, X, UserPlus, UserMinus, Loader2, Phone } from 'lucide-react';
import { UserProfile, Follow } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

interface UserProfileViewProps {
  uid: string;
  onClose: () => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({ uid, onClose }) => {
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followDocId, setFollowDocId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeProfile = onSnapshot(doc(db, 'users', uid), 
      (docSnap) => {
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          // Provide a default profile for users who haven't fully set up yet
          setProfile({
            uid: uid,
            displayName: 'Farmer',
            followersCount: 0,
            followingCount: 0,
            rating: 5.0,
            successfulDeals: 0
          } as UserProfile);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to user profile:', error);
        setLoading(false);
      }
    );

    const q = query(
      collection(db, 'follows'),
      where('followerUid', '==', currentUser?.uid || ''),
      where('followedUid', '==', uid)
    );

    const unsubscribeFollow = onSnapshot(q, (querySnapshot) => {
      if (!querySnapshot.empty) {
        setIsFollowing(true);
        setFollowDocId(querySnapshot.docs[0].id);
      } else {
        setIsFollowing(false);
        setFollowDocId(null);
      }
    });

    return () => {
      unsubscribeProfile();
      unsubscribeFollow();
    };
  }, [uid, currentUser]);

  const handleFollow = async () => {
    if (!currentUser || followLoading) return;
    setFollowLoading(true);
    try {
      const batch = writeBatch(db);
      const followedRef = doc(db, 'users', uid);
      const followerRef = doc(db, 'users', currentUser.uid);

      if (isFollowing && followDocId) {
        // Unfollow
        batch.delete(doc(db, 'follows', followDocId));
        batch.set(followedRef, { followersCount: increment(-1) }, { merge: true });
        batch.set(followerRef, { followingCount: increment(-1) }, { merge: true });
        
        await batch.commit();
        setIsFollowing(false);
        setFollowDocId(null);
      } else {
        // Follow
        const followRef = doc(collection(db, 'follows'));
        const followData: Omit<Follow, 'id'> = {
          followerUid: currentUser.uid,
          followedUid: uid,
          createdAt: serverTimestamp()
        };
        
        batch.set(followRef, followData);
        
        // Ensure both users have basic profile fields if they don't exist
        // This is especially important for anonymous/demo users
        batch.set(followedRef, { 
          uid: uid,
          followersCount: increment(1),
          updatedAt: serverTimestamp() 
        }, { merge: true });
        
        batch.set(followerRef, { 
          uid: currentUser.uid,
          followingCount: increment(1),
          updatedAt: serverTimestamp()
        }, { merge: true });
        
        // Notify the user
        const notificationRef = doc(collection(db, 'notifications'));
        batch.set(notificationRef, {
          uid: uid,
          text: `${currentUser.displayName || 'Someone'} followed you!`,
          read: false,
          type: 'follow',
          sourceUid: currentUser.uid,
          createdAt: serverTimestamp()
        });

        await batch.commit();
        setIsFollowing(true);
        setFollowDocId(followRef.id);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'follows');
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#2E7D32]" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-3xl p-6 shadow-xl max-w-md w-full mx-auto border border-gray-100"
    >
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl font-bold text-gray-800">User Profile</h2>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      <div className="flex flex-col items-center gap-6">
        {/* Profile Picture */}
        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-green-50 shadow-inner bg-gray-50 flex items-center justify-center">
          {profile.photoURL ? (
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

        <div className="text-center">
          <h3 className="text-2xl font-bold text-gray-900">{profile.displayName || 'Farmer'}</h3>
          {profile.location && (
            <div className="flex items-center justify-center gap-1 text-gray-500 mt-1">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">{profile.location}</span>
            </div>
          )}
        </div>

        {/* Reputation Stats */}
        <div className="grid grid-cols-2 gap-3 w-full">
          <div className="bg-green-50/50 border border-green-100 rounded-2xl p-3 flex flex-col items-center justify-center gap-1">
            <div className="flex items-center gap-1 text-yellow-500">
              <Star className="w-4 h-4 fill-current" />
              <span className="text-lg font-bold">{profile.rating?.toFixed(1) || '0.0'}</span>
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Rating</span>
          </div>
          <div className="bg-green-50/50 border border-green-100 rounded-2xl p-3 flex flex-col items-center justify-center gap-1">
            <span className="text-lg font-bold text-[#2E7D32]">{profile.successfulDeals || 0}</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Successful Deals</span>
          </div>
        </div>

        {/* Follower Stats */}
        <div className="flex gap-8 py-2">
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{profile.followersCount || 0}</p>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Followers</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{profile.followingCount || 0}</p>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Following</p>
          </div>
        </div>

        {/* About */}
        {profile.about && (
          <div className="w-full bg-gray-50 rounded-2xl p-4 border border-gray-100">
            <p className="text-sm text-gray-600 leading-relaxed italic">
              "{profile.about}"
            </p>
          </div>
        )}

        {/* Follow Button */}
        {currentUser && currentUser.uid !== uid && (
          <div className="w-full flex gap-2">
            {profile.phoneNumber && (
              <a
                href={`tel:${profile.phoneNumber.replace(/\s+/g, '')}`}
                className="flex-1 py-3 bg-green-50 text-[#2E7D32] rounded-2xl font-bold transition-all flex items-center justify-center gap-2 hover:bg-green-100 border border-green-100"
              >
                <Phone className="w-5 h-5" />
                Call
              </a>
            )}
            <button
              onClick={handleFollow}
              disabled={followLoading}
              className={cn(
                "flex-[2] py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2",
                isFollowing
                  ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  : "bg-[#2E7D32] text-white shadow-lg shadow-green-100 hover:bg-[#1B5E20]"
              )}
            >
              {followLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isFollowing ? (
                <>
                  <UserMinus className="w-5 h-5" />
                  Unfollow
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Follow
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};
