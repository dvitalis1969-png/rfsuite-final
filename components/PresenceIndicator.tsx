import React, { useState, useEffect } from 'react';
import { db, auth } from '../src/lib/firebase';
import { collection, onSnapshot, doc, setDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../src/utils/firestoreErrorHandler';

interface Presence {
  userId: string;
  userName: string;
  lastSeen: any;
}

const PresenceIndicator: React.FC<{ projectId: string | number }> = React.memo(({ projectId }) => {
  const [users, setUsers] = useState<Presence[]>([]);

  useEffect(() => {
    // Listen for presence
    const q = query(collection(db, 'presence', String(projectId), 'users'), where('status', '==', 'online'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activeUsers = snapshot.docs.map(doc => doc.data() as Presence);
      setUsers(activeUsers);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `presence/${projectId}/users`);
    });

    return () => unsubscribe();
  }, [projectId]);

  return (
    <div className="flex items-center gap-2 text-[10px] text-slate-400 h-6 overflow-hidden">
      <span className="shrink-0">Active:</span>
      <div className="flex -space-x-1 overflow-hidden">
        {users.slice(0, 3).map(user => (
          <div 
            key={user.userId} 
            className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[8px] font-bold text-indigo-400"
            title={user.userName}
          >
            {user.userName[0]}
          </div>
        ))}
        {users.length > 3 && (
          <div className="w-5 h-5 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-[8px] font-bold text-white">
            +{users.length - 3}
          </div>
        )}
      </div>
    </div>
  );
});

export default PresenceIndicator;
