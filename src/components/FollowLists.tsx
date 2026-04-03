import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, writeBatch, increment, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { UserProfile, Follow } from '../types';
import { User, UserMinus, Loader2, ArrowLeft, Search, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { UserProfileView } from './UserProfileView';

interface FollowListsProps {
  type: 'followers' | 'following';
  onBack: () => void;
}

export const FollowLists: React.FC<FollowListsProps> = ({ type, onBack }) => {
  const { user } = useAuth();
  const [list, setList] = useState<(Follow & { profile?: UserProfile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingProfileUid, setViewingProfileUid] = useState<string | null>(null);
  const [unfollowLoading, setUnfollowLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'follows'),
      where(type === 'followers' ? 'followedUid' : 'followerUid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const followData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Follow));
      
      // Fetch profiles for each follow
      const listWithProfiles = await Promise.all(
        followData.map(async (follow) => {
          const targetUid = type === 'followers' ? follow.followerUid : follow.followedUid;
          const profileDoc = await getDoc(doc(db, 'users', targetUid));
          return {
            ...follow,
            profile: profileDoc.exists() ? (profileDoc.data() as UserProfile) : undefined
          };
        })
      );

      setList(listWithProfiles);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, type]);

  const handleUnfollow = async (followId: string, followedUid: string) => {
    if (!user || unfollowLoading) return;
    setUnfollowLoading(followId);
    try {
      const batch = writeBatch(db);
      const followedRef = doc(db, 'users', followedUid);
      const followerRef = doc(db, 'users', user.uid);

      batch.delete(doc(db, 'follows', followId));
      batch.set(followedRef, { followersCount: increment(-1), updatedAt: serverTimestamp() }, { merge: true });
      batch.set(followerRef, { followingCount: increment(-1), updatedAt: serverTimestamp() }, { merge: true });

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'follows');
    } finally {
      setUnfollowLoading(null);
    }
  };

  const filteredList = list.filter(item => 
    item.profile?.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.profile?.location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#2E7D32]" />
        <p className="text-gray-400 font-medium">Loading {type}...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h2 className="text-xl font-bold text-gray-800 capitalize">{type}</h2>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder={`Search ${type}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-green-500 outline-none transition-all text-sm"
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
        {filteredList.length === 0 ? (
          <div className="text-center py-12">
            <User className="w-12 h-12 text-gray-100 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No {type} found.</p>
          </div>
        ) : (
          filteredList.map((item) => (
            <motion.div
              layout
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4 hover:border-green-100 transition-all group"
            >
              <div 
                className="w-12 h-12 rounded-full overflow-hidden bg-gray-50 flex items-center justify-center cursor-pointer border border-gray-50"
                onClick={() => setViewingProfileUid(type === 'followers' ? item.followerUid : item.followedUid)}
              >
                {item.profile?.photoURL ? (
                  <img 
                    src={item.profile.photoURL} 
                    alt="" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User className="w-6 h-6 text-gray-300" />
                )}
              </div>

              <div 
                className="flex-1 cursor-pointer"
                onClick={() => setViewingProfileUid(type === 'followers' ? item.followerUid : item.followedUid)}
              >
                <h4 className="font-bold text-gray-900 group-hover:text-[#2E7D32] transition-colors">
                  {item.profile?.displayName || 'Farmer'}
                </h4>
                {item.profile?.location && (
                  <div className="flex items-center gap-1 text-gray-400 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{item.profile.location}</span>
                  </div>
                )}
              </div>

              {type === 'following' && (
                <button
                  onClick={() => handleUnfollow(item.id, item.followedUid)}
                  disabled={unfollowLoading === item.id}
                  className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  title="Unfollow"
                >
                  {unfollowLoading === item.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <UserMinus className="w-5 h-5" />
                  )}
                </button>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* User Profile Modal */}
      <AnimatePresence>
        {viewingProfileUid && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <UserProfileView 
              uid={viewingProfileUid} 
              onClose={() => setViewingProfileUid(null)} 
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
