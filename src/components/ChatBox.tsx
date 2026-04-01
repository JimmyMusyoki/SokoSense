import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, orderBy, limit, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Chat, ChatMessage, Listing, UserProfile } from '../types';
import { Send, ArrowLeft, Loader2, MessageCircle, User, Clock, Check, CheckCheck, Plus, Tag, ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

export const ChatBox: React.FC<{ initialChatId?: string | null }> = ({ initialChatId }) => {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeListing, setActiveListing] = useState<Listing | null>(null);
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'chats', activeChat.id), {
        lastMessage: text,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
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
    <div className="max-w-4xl mx-auto h-[70vh] bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex">
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
                <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400">
                  <User className="w-6 h-6" />
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
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-[#2E7D32]">
                {activeListing?.type === 'sell' ? <Tag className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
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
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, idx) => {
                const isMe = msg.senderUid === user?.uid;
                return (
                  <div key={msg.id} className={cn(
                    "flex flex-col max-w-[80%]",
                    isMe ? "ml-auto items-end" : "mr-auto items-start"
                  )}>
                    {!isMe && (
                      <span className="text-[9px] text-gray-400 font-bold uppercase mb-1 px-1">
                        {userProfiles[msg.senderUid]?.displayName || 'Other'}
                      </span>
                    )}
                    <div className={cn(
                      "px-4 py-3 rounded-2xl text-sm shadow-sm",
                      isMe 
                        ? "bg-[#2E7D32] text-white rounded-tr-none" 
                        : "bg-white text-gray-800 rounded-tl-none border border-gray-100"
                    )}>
                      {msg.text}
                    </div>
                    <div className="flex items-center gap-1 mt-1 px-1">
                      <span className="text-[9px] text-gray-400 font-bold uppercase">
                        {msg.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isMe && <CheckCheck className="w-3 h-3 text-green-500" />}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-100">
              <div className="flex gap-2">
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
    </div>
  );
};
