import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, orderBy, limit, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Listing, Chat } from '../types';
import { Plus, Search, Tag, ShoppingCart, ArrowRightLeft, MessageSquare, Bell, User, LogOut, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

import { createListing, getMarketMatches } from '../services/marketplaceService';
import { CROPS, UNITS } from '../constants';

export const Marketplace: React.FC = () => {
  const { user, profile } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'my'>('all');
  const [matches, setMatches] = useState<Record<string, Listing[]>>({});

  // Form state
  const [type, setType] = useState<'buy' | 'sell'>('sell');
  const [crop, setCrop] = useState(CROPS[0]);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState(UNITS[0]);
  const [price, setPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedCrop, setSelectedCrop] = useState<string | null>(null);

  useEffect(() => {
    let q = query(
      collection(db, 'listings'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    if (selectedCrop) {
      q = query(
        collection(db, 'listings'),
        where('status', '==', 'active'),
        where('crop', '==', selectedCrop),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newListings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Listing));
      setListings(newListings);
      setLoading(false);
      
      // Find matches for each listing
      findMatches(newListings);
    });

    return () => unsubscribe();
  }, [selectedCrop]);

  const findMatches = (allListings: Listing[]) => {
    const newMatches: Record<string, Listing[]> = {};
    allListings.forEach(l => {
      const matchType = l.type === 'buy' ? 'sell' : 'buy';
      const possibleMatches = allListings.filter(m => 
        m.type === matchType && 
        m.crop.toLowerCase() === l.crop.toLowerCase() &&
        m.uid !== l.uid
      );
      if (possibleMatches.length > 0) {
        newMatches[l.id] = possibleMatches;
      }
    });
    setMatches(newMatches);
  };

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !crop || !quantity || !price) return;

    setSubmitting(true);
    setError(null);
    try {
      console.log('Creating listing with user:', user.uid);
      const newListingData: Omit<Listing, 'id'> = {
        uid: user.uid,
        type,
        crop,
        quantity: Number(quantity),
        unit,
        price: Number(price),
        status: 'active',
        createdAt: serverTimestamp(),
      };
      console.log('Listing data:', newListingData);
      await createListing(newListingData);
      setShowForm(false);
      resetForm();
      // Optional: Show success toast/message
    } catch (err: any) {
      console.error('Error creating listing:', err);
      setError(err.message || 'Failed to create listing. Please check your permissions.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setCrop(CROPS[0]);
    setQuantity('');
    setPrice('');
    setType('sell');
    setUnit(UNITS[0]);
  };

  const startChat = async (listing: Listing) => {
    if (!user) return;
    
    // Check if chat already exists
    const q = query(
      collection(db, 'chats'),
      where('listingId', '==', listing.id),
      where('buyerUid', '==', listing.type === 'buy' ? listing.uid : user.uid),
      where('sellerUid', '==', listing.type === 'sell' ? listing.uid : user.uid)
    );
    
    const chatSnap = await getDocs(q);
    if (!chatSnap.empty) {
      // Navigate to chat (we'll handle this in App.tsx)
      window.dispatchEvent(new CustomEvent('openChat', { detail: chatSnap.docs[0].id }));
      return;
    }

    // Create new chat
    const newChat = {
      listingId: listing.id,
      buyerUid: listing.type === 'buy' ? listing.uid : user.uid,
      sellerUid: listing.type === 'sell' ? listing.uid : user.uid,
      updatedAt: serverTimestamp(),
      lastMessage: 'Negotiation started'
    };
    const docRef = await addDoc(collection(db, 'chats'), newChat);
    window.dispatchEvent(new CustomEvent('openChat', { detail: docRef.id }));
  };

  const filteredListings = activeTab === 'all' 
    ? listings 
    : listings.filter(l => l.uid === user?.uid);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Soko Marketplace</h1>
          <p className="text-gray-500 text-sm">Buy and sell farm products directly</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-[#2E7D32] text-white p-4 rounded-2xl shadow-lg shadow-green-100 hover:bg-[#1B5E20] transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline font-bold">New Listing</span>
        </button>
      </div>

      {/* Categories / Produce Boxes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Browse by Produce</h3>
          {selectedCrop && (
            <button 
              onClick={() => setSelectedCrop(null)}
              className="text-xs font-bold text-red-500 hover:underline"
            >
              Clear Filter
            </button>
          )}
        </div>
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
          {CROPS.slice(0, 15).map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCrop(selectedCrop === c ? null : c)}
              className={cn(
                "flex-shrink-0 px-5 py-3 rounded-2xl border transition-all text-sm font-bold",
                selectedCrop === c 
                  ? "bg-[#2E7D32] text-white border-transparent shadow-lg shadow-green-100" 
                  : "bg-white text-gray-600 border-gray-100 hover:border-green-200 hover:bg-green-50"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('all')}
          className={cn(
            "px-6 py-2 rounded-xl text-sm font-bold transition-all",
            activeTab === 'all' ? "bg-white text-[#2E7D32] shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          All Listings
        </button>
        <button
          onClick={() => setActiveTab('my')}
          className={cn(
            "px-6 py-2 rounded-xl text-sm font-bold transition-all",
            activeTab === 'my' ? "bg-white text-[#2E7D32] shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          My Listings
        </button>
      </div>

      {/* Listing Form Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Create Listing</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleCreateListing} className="p-6 space-y-4">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600 text-sm">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="font-medium">{error}</p>
                  </div>
                )}
                <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setType('sell')}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                      type === 'sell' ? "bg-white text-green-600 shadow-sm" : "text-gray-500"
                    )}
                  >
                    I am Selling
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('buy')}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                      type === 'buy' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"
                    )}
                  >
                    I am Buying
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Crop Name</label>
                  <select
                    value={crop}
                    onChange={(e) => setCrop(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2E7D32] outline-none"
                    required
                  >
                    {CROPS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Quantity</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="0"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2E7D32] outline-none"
                        required
                      />
                      <select
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        className="w-24 px-2 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2E7D32] outline-none"
                      >
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Price per {unit}</label>
                    <input
                      type="number"
                      placeholder="Ksh"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2E7D32] outline-none"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-[#2E7D32] text-white rounded-2xl font-bold shadow-lg hover:bg-[#1B5E20] disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-4"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Post Listing'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Listings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#2E7D32]" />
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-3xl text-center border border-dashed border-gray-200">
            <ShoppingCart className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 font-medium">No listings found. Be the first to post!</p>
          </div>
        ) : (
          filteredListings.map((listing) => (
            <motion.div
              layout
              key={listing.id}
              className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-4 gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                    listing.type === 'sell' ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-600"
                  )}>
                    {listing.type === 'sell' ? <Tag className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-gray-800 capitalize truncate">{listing.crop}</h3>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                      {listing.type === 'sell' ? 'Selling' : 'Buying'}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-black text-gray-900">Ksh {listing.price}</p>
                  <p className="text-xs text-gray-400 font-medium">per {listing.unit}</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded-2xl">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{listing.quantity}</span>
                  <span className="text-gray-400">{listing.unit}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Bell className="w-3 h-3" />
                  <span>Active</span>
                </div>
              </div>

              {/* Matches Section */}
              {matches[listing.id] && matches[listing.id].length > 0 && (
                <div className="mb-4 p-3 bg-amber-50 rounded-2xl border border-amber-100">
                  <div className="flex items-center gap-2 text-amber-700 text-xs font-bold mb-2">
                    <ArrowRightLeft className="w-4 h-4" />
                    <span>{matches[listing.id].length} Match Found!</span>
                  </div>
                  <div className="space-y-2">
                    {matches[listing.id].slice(0, 2).map(match => (
                      <div key={match.id} className="flex items-center justify-between bg-white/50 p-2 rounded-xl text-xs">
                        <span className="text-gray-600">Price: Ksh {match.price}</span>
                        <button 
                          onClick={() => startChat(match)}
                          className="text-[#2E7D32] font-bold hover:underline"
                        >
                          Chat Now
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {listing.uid !== user?.uid ? (
                  <button
                    onClick={() => startChat(listing)}
                    className="flex-1 py-3 bg-gray-900 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-black transition-all"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Negotiate
                  </button>
                ) : (
                  <button className="flex-1 py-3 bg-gray-100 text-gray-400 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 cursor-default">
                    Your Listing
                  </button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};
