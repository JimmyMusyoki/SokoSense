import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { UserProfile, Listing } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import { User, Star, UserPlus, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface SuggestedFollowsProps {
  targetUid?: string; // If provided, suggest users similar to this user
}

export const SuggestedFollows: React.FC<SuggestedFollowsProps> = ({ targetUid }) => {
  const { user: currentUser } = useAuth();
  const [suggestions, setSuggestions] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!currentUser) return;
      setLoading(true);
      try {
        // 1. Get interests (crops) of the reference user (either current user or target user)
        const refUid = targetUid || currentUser.uid;
        const listingsQuery = query(
          collection(db, 'listings'),
          where('uid', '==', refUid),
          limit(10)
        );
        const listingsSnap = await getDocs(listingsQuery);
        const crops = Array.from(new Set(listingsSnap.docs.map(d => (d.data() as Listing).crop)));

        // 2. Get users who deal with these crops
        let suggestedUids = new Set<string>();
        
        if (crops.length > 0) {
          // Query for listings with same crops
          // Note: Firestore doesn't support 'in' with more than 10 items, but we only have a few usually
          const cropQuery = query(
            collection(db, 'listings'),
            where('crop', 'in', crops.slice(0, 10)),
            limit(20)
          );
          const cropSnap = await getDocs(cropQuery);
          cropSnap.docs.forEach(d => {
            const l = d.data() as Listing;
            if (l.uid !== currentUser.uid && l.uid !== targetUid) {
              suggestedUids.add(l.uid);
            }
          });
        }

        // 3. Get users from successful deals (if viewing own profile)
        if (!targetUid) {
          const chatsQuery = query(
            collection(db, 'chats'),
            where('buyerUid', '==', currentUser.uid),
            limit(10)
          );
          const chatsSnap = await getDocs(chatsQuery);
          chatsSnap.docs.forEach(d => {
            const c = d.data();
            if (c.sellerUid !== currentUser.uid) suggestedUids.add(c.sellerUid);
          });
        }

        // 4. Fetch profiles for these UIDs
        const profiles: UserProfile[] = [];
        const uidsArray = Array.from(suggestedUids).slice(0, 5);
        
        for (const uid of uidsArray) {
          // Check if already following
          const followQuery = query(
            collection(db, 'follows'),
            where('followerUid', '==', currentUser.uid),
            where('followedUid', '==', uid)
          );
          const followSnap = await getDocs(followQuery);
          
          if (followSnap.empty) {
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
              profiles.push({ uid, ...userDoc.data() } as UserProfile);
            }
          }
        }

        setSuggestions(profiles);
      } catch (err) {
        console.error('Error fetching suggestions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, [currentUser, targetUid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="w-full space-y-3 mt-6">
      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">
        {targetUid ? 'Similar Farmers' : 'Suggested for you'}
      </h4>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
        {suggestions.map((profile) => (
          <motion.div
            key={profile.uid}
            whileHover={{ y: -2 }}
            className="flex-shrink-0 w-32 bg-gray-50 border border-gray-100 rounded-2xl p-3 flex flex-col items-center gap-2"
          >
            <div className="w-12 h-12 rounded-full overflow-hidden bg-white border border-gray-100 flex items-center justify-center">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User className="w-6 h-6 text-gray-300" />
              )}
            </div>
            <div className="text-center min-w-0 w-full">
              <p className="text-xs font-bold text-gray-800 truncate">{profile.displayName || 'Farmer'}</p>
              <div className="flex items-center justify-center gap-0.5 text-yellow-500 mt-0.5">
                <Star className="w-2.5 h-2.5 fill-current" />
                <span className="text-[10px] font-bold">{profile.rating?.toFixed(1) || '5.0'}</span>
              </div>
            </div>
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('viewProfile', { detail: profile.uid }))}
              className="w-full py-1.5 bg-white border border-green-100 text-[#2E7D32] rounded-xl text-[10px] font-bold hover:bg-green-50 transition-all"
            >
              View
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
