import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, orderBy, limit, doc, updateDoc, getDoc, writeBatch, increment } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Chat, ChatMessage, Listing, UserProfile } from '../types';
import { Send, ArrowLeft, Loader2, MessageCircle, User, Clock, Check, CheckCheck, Plus, Tag, ShoppingCart, Phone, MapPin, Navigation, ExternalLink, MoreVertical, Timer, StopCircle, Image as ImageIcon, Camera, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { UserProfileView } from './UserProfileView';

export const ChatBox: React.FC<{ initialChatId?: string | null }> = ({ initialChatId }) => {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);
  const [showLocationSubmenu, setShowLocationSubmenu] = useState(false);
  const [liveLocationId, setLiveLocationId] = useState<string | null>(null);
  const [activeListing, setActiveListing] = useState<Listing | null>(null);
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});
  const [viewingProfileUid, setViewingProfileUid] = useState<string | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [isCompletingDeal, setIsCompletingDeal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);

  // Click outside to close attachment menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target as Node)) {
        setShowAttachmentOptions(false);
        setShowLocationSubmenu(false);
      }
    };

    if (showAttachmentOptions) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAttachmentOptions]);

  useEffect(() => {
    if (chats.length === 0) return;

    const fetchProfiles = async () => {
      const uidsToFetch = Array.from(new Set(chats.flatMap(c => [c.buyerUid, c.sellerUid])));
      const newUids = uidsToFetch.filter(uid => !userProfiles[uid]);

      if (newUids.length === 0) return;

      const profiles: Record<string, UserProfile> = { ...userProfiles };
      for (const uid of newUids) {
        try {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            profiles[uid] = { uid, ...userDoc.data() } as UserProfile;
          }
        } catch (err) {
          console.error(`Error fetching profile for ${uid}:`, err);
        }
      }
      setUserProfiles(profiles);
    };

    fetchProfiles();
  }, [chats]);

  useEffect(() => {
    if (!user) return;

    // Listen for chats where user is buyer or seller
    const q = query(
      collection(db, 'chats'),
      where('buyerUid', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );
    const q2 = query(
      collection(db, 'chats'),
      where('sellerUid', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsub1 = onSnapshot(q, (snap) => {
      const buyerChats = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
      setChats(prev => {
        const combined = [...buyerChats, ...prev.filter(c => c.sellerUid === user.uid)];
        return combined.sort((a, b) => b.updatedAt?.toMillis() - a.updatedAt?.toMillis());
      });
      setLoading(false);
    });

    const unsub2 = onSnapshot(q2, (snap) => {
      const sellerChats = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
      setChats(prev => {
        const combined = [...sellerChats, ...prev.filter(c => c.buyerUid === user.uid)];
        return combined.sort((a, b) => b.updatedAt?.toMillis() - a.updatedAt?.toMillis());
      });
      setLoading(false);
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [user]);

  useEffect(() => {
    if (initialChatId) {
      const chat = chats.find(c => c.id === initialChatId);
      if (chat) {
        setActiveChat(chat);
      } else {
        // If not in list, fetch it directly
        const fetchChat = async () => {
          const chatDoc = await getDoc(doc(db, 'chats', initialChatId));
          if (chatDoc.exists()) {
            setActiveChat({ id: chatDoc.id, ...chatDoc.data() } as Chat);
          }
        };
        fetchChat();
      }
    }
  }, [initialChatId, chats]);

  useEffect(() => {
    if (!activeChat) {
      setActiveListing(null);
      return;
    }

    const fetchListing = async () => {
      const listingDoc = await getDoc(doc(db, 'listings', activeChat.listingId));
      if (listingDoc.exists()) {
        setActiveListing({ id: listingDoc.id, ...listingDoc.data() } as Listing);
      }
    };
    fetchListing();

    const q = query(
      collection(db, 'chats', activeChat.id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const newMessages = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      setMessages(newMessages);
      scrollToBottom();
    });

    return () => unsubscribe();
  }, [activeChat]);

  // Live Location Tracking
  useEffect(() => {
    if (!liveLocationId || !activeChat || !user) return;

    let watchId: number;

    const startWatching = () => {
      if (!navigator.geolocation) return;

      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const msgRef = doc(db, 'chats', activeChat.id, 'messages', liveLocationId);
            const msgSnap = await getDoc(msgRef);
            
            if (msgSnap.exists()) {
              const data = msgSnap.data() as ChatMessage;
              // Check if expired
              if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
                setLiveLocationId(null);
                return;
              }

              await updateDoc(msgRef, {
                location: { latitude, longitude }
              });
            } else {
              setLiveLocationId(null);
            }
          } catch (err) {
            console.error('Error updating live location:', err);
          }
        },
        (err) => console.error('WatchPosition error:', err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    };

    startWatching();

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [liveLocationId, activeChat, user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeChat || !newMessage.trim()) return;

    setSending(true);
    const text = newMessage.trim();
    setNewMessage('');

    try {
      await addDoc(collection(db, 'chats', activeChat.id, 'messages'), {
        chatId: activeChat.id,
        senderUid: user.uid,
        text,
        type: 'text',
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'chats', activeChat.id), {
        lastMessage: text,
        updatedAt: serverTimestamp(),
      });

      // Notify other user
      const otherUid = getOtherUserUid(activeChat);
      await addDoc(collection(db, 'notifications'), {
        uid: otherUid,
        text: `New message from ${user.displayName || 'Farmer'}`,
        read: false,
        type: 'chat',
        sourceUid: user.uid,
        listingId: activeChat.listingId,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !activeChat) return;

    if (file.size > 300 * 1024) {
      alert('Image size must be less than 300KB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      setSending(true);
      try {
        await addDoc(collection(db, 'chats', activeChat.id, 'messages'), {
          chatId: activeChat.id,
          senderUid: user.uid,
          text: '📷 Sent a photo',
          type: 'image',
          imageURL: base64String,
          createdAt: serverTimestamp(),
        });

        await updateDoc(doc(db, 'chats', activeChat.id), {
          lastMessage: '📷 Sent a photo',
          updatedAt: serverTimestamp(),
        });

        // Notify other user
        const otherUid = getOtherUserUid(activeChat);
        await addDoc(collection(db, 'notifications'), {
          uid: otherUid,
          text: `${user.displayName || 'Farmer'} sent a photo`,
          read: false,
          type: 'chat',
          sourceUid: user.uid,
          listingId: activeChat.listingId,
          createdAt: serverTimestamp()
        });
      } catch (err) {
        console.error('Error uploading image:', err);
      } finally {
        setSending(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCompleteDeal = async () => {
    if (!user || !activeChat || !activeListing) return;
    
    setIsCompletingDeal(true);
    try {
      const batch = writeBatch(db);
      
      // Update listing status
      batch.update(doc(db, 'listings', activeListing.id), {
        status: 'completed',
        updatedAt: serverTimestamp()
      });

      // Add system message
      const msgRef = doc(collection(db, 'chats', activeChat.id, 'messages'));
      batch.set(msgRef, {
        chatId: activeChat.id,
        senderUid: 'system',
        text: '🤝 Deal marked as completed! You can now rate each other.',
        type: 'text',
        createdAt: serverTimestamp()
      });

      // Notify other user
      const otherUid = getOtherUserUid(activeChat);
      batch.set(doc(collection(db, 'notifications')), {
        uid: otherUid,
        text: `Deal for ${activeListing.crop} completed! Please rate the farmer.`,
        read: false,
        type: 'deal',
        sourceUid: user.uid,
        listingId: activeListing.id,
        createdAt: serverTimestamp()
      });

      await batch.commit();
      
      // Show rating modal if I am the buyer
      if (user.uid === activeChat.buyerUid) {
        setShowRatingModal(true);
      }
    } catch (err) {
      console.error('Error completing deal:', err);
    } finally {
      setIsCompletingDeal(false);
    }
  };

  const submitRating = async () => {
    if (!user || !activeChat || !activeListing) return;

    const targetUid = getOtherUserUid(activeChat);
    try {
      const batch = writeBatch(db);
      
      // Add rating doc
      const ratingRef = doc(collection(db, 'ratings'));
      batch.set(ratingRef, {
        fromUid: user.uid,
        toUid: targetUid,
        chatId: activeChat.id,
        listingId: activeListing.id,
        score: ratingScore,
        comment: ratingComment,
        createdAt: serverTimestamp()
      });

      // Update user profile stats
      const targetUserRef = doc(db, 'users', targetUid);
      const targetProfile = userProfiles[targetUid];
      const currentRating = targetProfile?.rating || 5.0;
      const currentDeals = targetProfile?.successfulDeals || 0;
      
      // Simple moving average for rating
      const newRating = ((currentRating * currentDeals) + ratingScore) / (currentDeals + 1);
      
      batch.update(targetUserRef, {
        rating: newRating,
        successfulDeals: increment(1),
        updatedAt: serverTimestamp()
      });

      // Notify target user
      batch.set(doc(collection(db, 'notifications')), {
        uid: targetUid,
        text: `You received a ${ratingScore}-star rating!`,
        read: false,
        type: 'rating',
        sourceUid: user.uid,
        createdAt: serverTimestamp()
      });

      await batch.commit();
      setShowRatingModal(false);
    } catch (err) {
      console.error('Error submitting rating:', err);
    }
  };

  const handleShareLocation = async () => {
    if (!user || !activeChat || sharingLocation) return;

    setSharingLocation(true);
    setShowAttachmentOptions(false);
    
    try {
      if (!navigator.geolocation) {
        console.error("Geolocation is not supported");
        setSharingLocation(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        const locationText = `📍 Current Location: https://www.google.com/maps?q=${latitude},${longitude}`;

        await addDoc(collection(db, 'chats', activeChat.id, 'messages'), {
          chatId: activeChat.id,
          senderUid: user.uid,
          text: locationText,
          type: 'location',
          location: { latitude, longitude },
          createdAt: serverTimestamp(),
        });

        await updateDoc(doc(db, 'chats', activeChat.id), {
          lastMessage: '📍 Shared a location',
          updatedAt: serverTimestamp(),
        });
        setSharingLocation(false);
      }, (error) => {
        console.error('Error getting location:', error);
        setSharingLocation(false);
      }, { enableHighAccuracy: true, timeout: 15000 });
    } catch (err) {
      console.error('Error sharing location:', err);
      setSharingLocation(false);
    }
  };

  const handleShareLiveLocation = async (durationMinutes: number) => {
    if (!user || !activeChat || sharingLocation) return;

    setSharingLocation(true);
    setShowAttachmentOptions(false);

    try {
      if (!navigator.geolocation) {
        console.error("Geolocation is not supported");
        setSharingLocation(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
        const locationText = `📡 Live Location (${durationMinutes}m): https://www.google.com/maps?q=${latitude},${longitude}`;

        const docRef = await addDoc(collection(db, 'chats', activeChat.id, 'messages'), {
          chatId: activeChat.id,
          senderUid: user.uid,
          text: locationText,
          type: 'live_location',
          location: { latitude, longitude },
          expiresAt: expiresAt,
          createdAt: serverTimestamp(),
        });

        await updateDoc(doc(db, 'chats', activeChat.id), {
          lastMessage: '📡 Started sharing live location',
          updatedAt: serverTimestamp(),
        });

        setLiveLocationId(docRef.id);
        setSharingLocation(false);
      }, (error) => {
        console.error('Error getting location:', error);
        setSharingLocation(false);
      }, { enableHighAccuracy: true, timeout: 15000 });
    } catch (err) {
      console.error('Error sharing live location:', err);
      setSharingLocation(false);
    }
  };

  const stopLiveLocation = () => {
    setLiveLocationId(null);
  };

  const getOtherUserUid = (chat: Chat) => {
    return chat.buyerUid === user?.uid ? chat.sellerUid : chat.buyerUid;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#2E7D32]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto h-full bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex pb-28">
      {/* Chat List */}
      <div className={cn(
        "w-full md:w-80 border-r border-gray-100 flex flex-col",
        activeChat ? "hidden md:flex" : "flex"
      )}>
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">Negotiations</h2>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('changeView', { detail: 'market' }))}
            className="p-2 bg-green-50 text-[#2E7D32] rounded-xl hover:bg-green-100 transition-all"
            title="Start New Negotiation"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chats.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-sm">No active chats</p>
            </div>
          ) : (
            chats.map(chat => (
              <button
                key={chat.id}
                onClick={() => setActiveChat(chat)}
                className={cn(
                  "w-full p-4 text-left hover:bg-gray-50 transition-all border-b border-gray-50 flex items-center gap-3",
                  activeChat?.id === chat.id ? "bg-green-50/50 border-l-4 border-l-[#2E7D32]" : ""
                )}
              >
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewingProfileUid(getOtherUserUid(chat));
                  }}
                  className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 overflow-hidden border border-gray-100 hover:opacity-80 transition-opacity cursor-pointer"
                >
                  {userProfiles[getOtherUserUid(chat)]?.photoURL ? (
                    <img 
                      src={userProfiles[getOtherUserUid(chat)].photoURL} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <User className="w-6 h-6" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <h3 className="font-bold text-gray-800 text-sm truncate">
                      {userProfiles[getOtherUserUid(chat)]?.displayName || `User ${getOtherUserUid(chat).slice(0, 8)}`}
                    </h3>
                    <span className="text-[10px] text-gray-400 uppercase font-bold">
                      {chat.updatedAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-1">{chat.lastMessage}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Window */}
      <div className={cn(
        "flex-1 flex flex-col bg-gray-50/30",
        !activeChat ? "hidden md:flex items-center justify-center" : "flex"
      )}>
        {activeChat ? (
          <>
            {/* Header */}
            <div className="p-4 bg-white border-b border-gray-100 flex items-center gap-4">
              <button onClick={() => setActiveChat(null)} className="md:hidden text-gray-400">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div 
                onClick={() => setViewingProfileUid(getOtherUserUid(activeChat))}
                className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-[#2E7D32] overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
              >
                {userProfiles[getOtherUserUid(activeChat)]?.photoURL ? (
                  <img 
                    src={userProfiles[getOtherUserUid(activeChat)].photoURL} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  activeListing?.type === 'sell' ? <Tag className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-800 text-sm truncate">
                  {activeListing ? `${activeListing.crop} (${activeListing.quantity} ${activeListing.unit})` : (userProfiles[getOtherUserUid(activeChat)]?.displayName || `User ${getOtherUserUid(activeChat).slice(0, 8)}`)}
                </h3>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider">
                    {userProfiles[getOtherUserUid(activeChat)]?.displayName ? `Chatting with ${userProfiles[getOtherUserUid(activeChat)].displayName}` : 'Online'}
                  </p>
                  {activeListing && (
                    <span className="text-[10px] text-gray-400 font-bold">
                      • Ksh {activeListing.price}/{activeListing.unit}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeListing?.status === 'active' && (
                  <button
                    onClick={handleCompleteDeal}
                    disabled={isCompletingDeal}
                    className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 rounded-xl hover:bg-amber-100 transition-all text-xs font-bold"
                  >
                    {isCompletingDeal ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
                    Complete Deal
                  </button>
                )}
                {userProfiles[getOtherUserUid(activeChat)]?.phoneNumber && (
                  <a 
                    href={`tel:${userProfiles[getOtherUserUid(activeChat)].phoneNumber.replace(/\s+/g, '')}`}
                    className="p-2 bg-green-50 text-[#2E7D32] rounded-xl hover:bg-green-100 transition-all"
                    title="Call Farmer"
                  >
                    <Phone className="w-5 h-5" />
                  </a>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, idx) => {
                const isMe = msg.senderUid === user?.uid;
                const senderProfile = userProfiles[msg.senderUid];
                return (
                  <div key={msg.id} className={cn(
                    "flex gap-3 max-w-[85%]",
                    isMe ? "ml-auto flex-row-reverse" : "mr-auto"
                  )}>
                    {!isMe && (
                      <div 
                        onClick={() => setViewingProfileUid(msg.senderUid)}
                        className="w-8 h-8 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity mt-1"
                      >
                        {senderProfile?.photoURL ? (
                          <img src={senderProfile.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <User className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    )}
                    <div className={cn(
                      "flex flex-col",
                      isMe ? "items-end" : "items-start"
                    )}>
                      {!isMe && (
                        <span className="text-[9px] text-gray-400 font-bold uppercase mb-1 px-1">
                          {senderProfile?.displayName || 'Other'}
                        </span>
                      )}
                      <div className={cn(
                        "px-4 py-3 rounded-2xl text-sm shadow-sm",
                        isMe 
                          ? "bg-[#2E7D32] text-white rounded-tr-none" 
                          : "bg-white text-gray-800 rounded-tl-none border border-gray-100",
                        msg.senderUid === 'system' && "bg-amber-50 text-amber-800 border-amber-100 italic mx-auto max-w-full rounded-xl text-center"
                      )}>
                        {msg.type === 'image' && msg.imageURL ? (
                          <div className="space-y-2">
                            <img 
                              src={msg.imageURL} 
                              alt="Sent" 
                              className="max-w-full rounded-xl border border-gray-100 shadow-sm"
                              referrerPolicy="no-referrer"
                            />
                            {msg.text && msg.text !== '📷 Sent a photo' && <p>{msg.text}</p>}
                          </div>
                        ) : (msg.type === 'location' || msg.type === 'live_location') && msg.location ? (
                          <div className="space-y-2 min-w-[200px]">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2 font-bold">
                                {msg.type === 'live_location' ? <Navigation className="w-4 h-4 animate-pulse text-red-400" /> : <MapPin className="w-4 h-4" />}
                                <span>{msg.type === 'live_location' ? 'Live Location' : 'Current Location'}</span>
                              </div>
                              {msg.type === 'live_location' && msg.expiresAt && (
                                <span className="text-[10px] opacity-70 flex items-center gap-1">
                                  <Timer className="w-3 h-3" />
                                  {msg.expiresAt.toDate() < new Date() ? 'Expired' : 'Live'}
                                </span>
                              )}
                            </div>
                            <div className="w-full h-32 bg-gray-100 rounded-xl overflow-hidden relative border border-gray-200/50">
                              {process.env.GOOGLE_MAPS_API_KEY ? (
                                <img 
                                  src={`https://maps.googleapis.com/maps/api/staticmap?center=${msg.location.latitude},${msg.location.longitude}&zoom=15&size=300x150&markers=color:red%7C${msg.location.latitude},${msg.location.longitude}&key=${process.env.GOOGLE_MAPS_API_KEY}`} 
                                  alt="Map"
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400 gap-2">
                                  <MapPin className="w-6 h-6" />
                                  <span className="text-[10px] font-bold uppercase tracking-wider">Map Preview Unavailable</span>
                                </div>
                              )}
                              <div className="absolute inset-0 flex items-center justify-center bg-black/5 opacity-0 hover:opacity-100 transition-opacity">
                                <ExternalLink className="w-6 h-6 text-white drop-shadow-md" />
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <a 
                                href={`https://www.google.com/maps?q=${msg.location.latitude},${msg.location.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  "flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all",
                                  isMe ? "bg-white/20 text-white hover:bg-white/30" : "bg-green-50 text-[#2E7D32] hover:bg-green-100"
                                )}
                              >
                                View on Google Maps
                              </a>
                              {isMe && msg.type === 'live_location' && liveLocationId === msg.id && (
                                <button
                                  onClick={stopLiveLocation}
                                  className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-all"
                                >
                                  <StopCircle className="w-4 h-4" />
                                  Stop Sharing
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          msg.text
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1 px-1">
                        <span className="text-[9px] text-gray-400 font-bold uppercase">
                          {msg.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMe && <CheckCheck className="w-3 h-3 text-green-500" />}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-100 relative">
              <AnimatePresence>
                {showAttachmentOptions && (
                  <motion.div
                    ref={attachmentMenuRef}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bottom-full left-4 mb-2 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 min-w-[220px] z-50 overflow-hidden"
                  >
                    {!showLocationSubmenu ? (
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => {
                            imageInputRef.current?.removeAttribute('capture');
                            imageInputRef.current?.click();
                            setShowAttachmentOptions(false);
                          }}
                          className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-all text-sm font-medium text-gray-700"
                        >
                          <ImageIcon className="w-4 h-4 text-purple-500" />
                          Upload Photo
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            imageInputRef.current?.setAttribute('capture', 'environment');
                            imageInputRef.current?.click();
                            setShowAttachmentOptions(false);
                          }}
                          className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-all text-sm font-medium text-gray-700"
                        >
                          <Camera className="w-4 h-4 text-green-500" />
                          Take Photo
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowLocationSubmenu(true)}
                          className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-all text-sm font-medium text-gray-700"
                        >
                          <div className="flex items-center gap-3">
                            <MapPin className="w-4 h-4 text-blue-500" />
                            Location
                          </div>
                          <ArrowLeft className="w-4 h-4 rotate-180 text-gray-300" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => setShowLocationSubmenu(false)}
                          className="flex items-center gap-2 p-2 mb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
                        >
                          <ArrowLeft className="w-3 h-3" />
                          Back to Menu
                        </button>
                        <button
                          type="button"
                          onClick={handleShareLocation}
                          className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-all text-sm font-medium text-gray-700"
                        >
                          <MapPin className="w-4 h-4 text-blue-500" />
                          Current Location
                        </button>
                        <div className="p-2 border-t border-gray-50 mt-1">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Live Location</p>
                          {[15, 60, 480].map(mins => (
                            <button
                              key={mins}
                              type="button"
                              onClick={() => handleShareLiveLocation(mins)}
                              className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl transition-all text-sm font-medium text-gray-700"
                            >
                              <Navigation className="w-4 h-4 text-red-500" />
                              {mins === 15 ? '15 Minutes' : mins === 60 ? '1 Hour' : '8 Hours'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-2">
                <input
                  type="file"
                  ref={imageInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowAttachmentOptions(!showAttachmentOptions);
                    setShowLocationSubmenu(false);
                  }}
                  disabled={sharingLocation || sending}
                  className={cn(
                    "p-3 rounded-2xl transition-all disabled:opacity-50",
                    showAttachmentOptions ? "bg-green-100 text-[#2E7D32]" : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                  )}
                  title="Attachments"
                >
                  {sharingLocation || sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                </button>
                <input
                  type="text"
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 px-5 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#2E7D32] outline-none text-sm"
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="bg-[#2E7D32] text-white p-3 rounded-2xl shadow-lg hover:bg-[#1B5E20] disabled:opacity-50 transition-all"
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="text-center p-12">
            <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center text-gray-300 mx-auto mb-6">
              <MessageCircle className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Your Negotiations</h3>
            <p className="text-gray-400 text-sm max-w-xs mx-auto">
              Select a chat from the list to start negotiating with other farmers.
            </p>
          </div>
        )}
      </div>
      {/* Rating Modal */}
      <AnimatePresence>
        {showRatingModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full border border-gray-100"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-yellow-50 rounded-2xl flex items-center justify-center text-yellow-500 mx-auto mb-4">
                  <Star className="w-8 h-8 fill-current" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Rate the Farmer</h3>
                <p className="text-sm text-gray-500 mt-2">How was your experience with this deal?</p>
              </div>

              <div className="flex justify-center gap-2 mb-8">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRatingScore(star)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star 
                      className={cn(
                        "w-8 h-8 transition-colors",
                        star <= ratingScore ? "text-yellow-400 fill-current" : "text-gray-200"
                      )} 
                    />
                  </button>
                ))}
              </div>

              <textarea
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Add a comment (optional)..."
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-2 focus:ring-green-500 outline-none transition-all resize-none mb-6"
                rows={3}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowRatingModal(false)}
                  className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-2xl transition-all"
                >
                  Skip
                </button>
                <button
                  onClick={submitRating}
                  className="flex-1 py-3 bg-[#2E7D32] text-white font-bold rounded-2xl shadow-lg shadow-green-100 hover:bg-[#1B5E20] transition-all"
                >
                  Submit
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Profile Modal */}
      <AnimatePresence>
        {viewingProfileUid && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
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
