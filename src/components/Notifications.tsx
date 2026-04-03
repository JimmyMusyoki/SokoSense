import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, serverTimestamp, orderBy, limit, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Notification } from '../types';
import { Bell, Check, Loader2, MessageSquare, Tag, ShoppingCart, ArrowRightLeft, X, UserPlus, Star, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { UserProfileView } from './UserProfileView';

export const Notifications: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingProfileUid, setViewingProfileUid] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const newNotifications = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      setNotifications(newNotifications);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;

    try {
      const batch = writeBatch(db);
      unread.forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      });
      await batch.commit();
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const getIcon = (n: Notification) => {
    if (n.type === 'follow') return <UserPlus className="w-5 h-5 text-indigo-500" />;
    if (n.type === 'rating') return <Star className="w-5 h-5 text-yellow-500 fill-current" />;
    if (n.type === 'deal') return <CheckCheck className="w-5 h-5 text-green-500" />;
    const text = n.text.toLowerCase();
    if (text.includes('match')) return <ArrowRightLeft className="w-5 h-5 text-amber-500" />;
    if (text.includes('message')) return <MessageSquare className="w-5 h-5 text-blue-500" />;
    if (text.includes('sell')) return <Tag className="w-5 h-5 text-green-500" />;
    if (text.includes('buy')) return <ShoppingCart className="w-5 h-5 text-purple-500" />;
    return <Bell className="w-5 h-5 text-gray-400" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#2E7D32]" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4 pb-28">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Notifications</h2>
        <div className="flex items-center gap-3">
          {notifications.some(n => !n.read) && (
            <button
              onClick={markAllAsRead}
              className="text-xs font-bold text-[#2E7D32] hover:underline"
            >
              Mark all as read
            </button>
          )}
          <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-bold">
            {notifications.filter(n => !n.read).length} Unread
          </span>
        </div>
      </div>

      <AnimatePresence>
        {notifications.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl text-center border border-dashed border-gray-200">
            <Bell className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 font-medium">No notifications yet.</p>
          </div>
        ) : (
          notifications.map((n) => (
            <motion.div
              layout
              key={n.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex items-start gap-4 transition-all",
                !n.read ? "border-l-4 border-l-[#2E7D32] bg-green-50/10" : "opacity-70"
              )}
            >
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center shrink-0">
                {getIcon(n)}
              </div>
              <div 
                className="flex-1 cursor-pointer"
                onClick={() => {
                  if (n.type === 'follow' && n.sourceUid) {
                    setViewingProfileUid(n.sourceUid);
                  } else if (n.type === 'listing') {
                    window.dispatchEvent(new CustomEvent('changeView', { detail: 'market' }));
                  }
                  markAsRead(n.id);
                }}
              >
                <p className={cn("text-sm text-gray-800", !n.read ? "font-bold" : "font-medium")}>
                  {n.text}
                </p>
                <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">
                  {n.createdAt?.toDate().toLocaleDateString()} at {n.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {!n.read && (
                <button
                  onClick={() => markAsRead(n.id)}
                  className="p-2 text-gray-300 hover:text-[#2E7D32] transition-colors"
                  title="Mark as read"
                >
                  <Check className="w-5 h-5" />
                </button>
              )}
            </motion.div>
          ))
        )}
      </AnimatePresence>

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
