import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { Listing, Notification } from '../types';

export const createListing = async (listing: Omit<Listing, 'id'>) => {
  const docRef = await addDoc(collection(db, 'listings'), {
    ...listing,
    createdAt: serverTimestamp(),
  });
  
  // Check for matches and notify
  const matchType = listing.type === 'buy' ? 'sell' : 'buy';
  const q = query(
    collection(db, 'listings'),
    where('type', '==', matchType),
    where('crop', '==', listing.crop),
    where('status', '==', 'active'),
    limit(10)
  );
  
  const snapshot = await getDocs(q);
  const matches = snapshot.docs.filter(doc => doc.data().uid !== listing.uid);
  
  for (const match of matches) {
    const matchData = match.data();
    // Notify the other user
    await addDoc(collection(db, 'notifications'), {
      uid: matchData.uid,
      text: `New match found for your ${listing.crop} listing! Someone is ${listing.type === 'buy' ? 'selling' : 'buying'} at Ksh ${listing.price}.`,
      read: false,
      createdAt: serverTimestamp(),
    });
    
    // Notify the current user
    await addDoc(collection(db, 'notifications'), {
      uid: listing.uid,
      text: `We found a match for your ${listing.crop} listing! User is ${matchType === 'buy' ? 'buying' : 'selling'} at Ksh ${matchData.price}.`,
      read: false,
      createdAt: serverTimestamp(),
    });
  }
  
  return docRef.id;
};

export const getMarketMatches = async (listing: Listing) => {
  const matchType = listing.type === 'buy' ? 'sell' : 'buy';
  const q = query(
    collection(db, 'listings'),
    where('type', '==', matchType),
    where('crop', '==', listing.crop),
    where('status', '==', 'active')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Listing))
    .filter(l => l.uid !== listing.uid);
};
