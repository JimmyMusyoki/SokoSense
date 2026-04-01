import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { Listing, Notification } from '../types';

export const updateListing = async (id: string, data: Partial<Listing>) => {
  try {
    const docRef = doc(db, 'listings', id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `listings/${id}`);
    throw error;
  }
};

export const createListing = async (listing: Omit<Listing, 'id'>) => {
  try {
    console.log('marketplaceService: createListing called with:', listing);
    const docRef = await addDoc(collection(db, 'listings'), {
      ...listing,
      createdAt: serverTimestamp(),
    });
    console.log('marketplaceService: Listing created with ID:', docRef.id);
    
    // Notify followers
    try {
      const followersQuery = query(
        collection(db, 'follows'),
        where('followedUid', '==', listing.uid)
      );
      const followersSnapshot = await getDocs(followersQuery);
      for (const followerDoc of followersSnapshot.docs) {
        const followerData = followerDoc.data();
        await addDoc(collection(db, 'notifications'), {
          uid: followerData.followerUid,
          text: `${listing.type === 'sell' ? 'New produce available!' : 'New buy request!'} ${listing.crop} from a farmer you follow.`,
          read: false,
          type: 'listing',
          sourceUid: listing.uid,
          listingId: docRef.id,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error('Error notifying followers:', err);
    }

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
      try {
        await addDoc(collection(db, 'notifications'), {
          uid: matchData.uid,
          text: `New match found for your ${listing.crop} listing! Someone is ${listing.type === 'buy' ? 'selling' : 'buying'} at Ksh ${listing.price}.`,
          read: false,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Error creating match notification for other user:', err);
      }
      
      // Notify the current user
      try {
        await addDoc(collection(db, 'notifications'), {
          uid: listing.uid,
          text: `We found a match for your ${listing.crop} listing! User is ${matchType === 'buy' ? 'buying' : 'selling'} at Ksh ${matchData.price}.`,
          read: false,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Error creating match notification for current user:', err);
      }
    }
    
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'listings');
    throw error;
  }
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
