import React, { useState, useEffect, useMemo } from 'react';
import { Users, Clock } from 'lucide-react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../src/lib/firebase';

interface UserStatus {
  id: string;
  name: string;
  lastSeen: any; // Firestore Timestamp
  isOnline: boolean;
  isPro?: boolean;
  statusMessage?: string;
}

interface UserPresenceListProps {
  onUserClick?: (user: { id: string; name: string; isPro?: boolean; statusMessage?: string }) => void;
}

const UserPresenceList: React.FC<UserPresenceListProps> = React.memo(({ onUserClick }) => {
  const [users, setUsers] = useState<UserStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'presence', 'global', 'users'),
      orderBy('lastSeen', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = Date.now();
      const fetchedUsers = snapshot.docs.map(doc => {
        const data = doc.data();
        // Handle null lastSeen (latency compensation) by assuming it's current
        const lastSeenMillis = data.lastSeen?.toMillis() || now;
        // Consider online if status is 'online' AND seen in last 5 minutes (fallback)
        const isOnline = data.status === 'online' && (now - lastSeenMillis < 300000);
        
        return {
          id: doc.id,
          name: data.name || 'Anonymous',
          lastSeen: lastSeenMillis,
          isOnline,
          isPro: data.isPro || false,
          statusMessage: data.statusMessage
        } as UserStatus;
      });
      setUsers(fetchedUsers);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching presence:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const onlineUsers = users.filter(u => u.isOnline);
  const recentUsers = users.filter(u => !u.isOnline);

  const renderedOnline = useMemo(() => (
    onlineUsers.length > 0 ? (
      <div>
        <div className="text-[8px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1.5">
          <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
          Active ({onlineUsers.length})
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {onlineUsers.map(user => (
            <div 
              key={user.id} 
              onClick={() => {
                console.log("User clicked:", user);
                onUserClick?.(user);
              }}
              className={`flex items-center gap-1.5 bg-slate-900/50 border border-slate-800/50 rounded px-1.5 py-1 transition-colors group ${onUserClick ? 'cursor-pointer hover:bg-slate-800 hover:border-indigo-500/30' : 'cursor-default'}`}
            >
              <div className="relative shrink-0">
                <div className="w-5 h-5 rounded-full bg-indigo-900/30 flex items-center justify-center text-[9px] font-bold text-indigo-400 border border-indigo-500/20">
                  {user.name[0]}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-500 rounded-full border border-slate-950" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-medium text-slate-200 group-hover:text-white transition-colors truncate">
                  {user.name}
                </span>
                {user.statusMessage && (
                  <span className="text-[8px] text-slate-400 truncate italic">
                    {user.statusMessage}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    ) : (
      <div className="text-[9px] text-slate-500 italic px-1">No users online</div>
    )
  ), [onlineUsers, onUserClick]);

  const renderedRecent = useMemo(() => (
    recentUsers.length > 0 && (
      <div className="pb-1">
        <div className="text-[8px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1.5">
          <Clock className="w-2 h-2" />
          Recent ({recentUsers.length})
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-1 px-1">
          {recentUsers.map(user => (
            <div 
              key={user.id} 
              onClick={() => {
                console.log("Recent user clicked:", user);
                onUserClick?.(user);
              }}
              className={`flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity ${onUserClick ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span className="text-[9px] text-slate-300 font-medium">
                {user.name}
              </span>
              <span className="text-[7px] text-slate-500 italic">
                {user.lastSeen ? `${Math.floor((Date.now() - user.lastSeen) / 60000)}m` : 'now'}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  ), [recentUsers, onUserClick]);

  if (loading && users.length === 0) {
    return (
      <div className="mt-4 border-t border-slate-800 pt-4 animate-pulse">
        <div className="h-4 w-24 bg-slate-800 rounded mb-4" />
        <div className="space-y-2">
          <div className="h-8 w-full bg-slate-800 rounded" />
          <div className="h-8 w-full bg-slate-800 rounded" />
        </div>
      </div>
    );
  }

  if (onlineUsers.length === 0 && recentUsers.length === 0) return null;

  return (
    <div className="p-2">
      <div className="flex items-center gap-2 mb-2 px-1">
        <Users className="w-3 h-3 text-indigo-400" />
        <h4 className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
          Network
        </h4>
      </div>

      <div className="space-y-3">
        {renderedOnline}
        {renderedRecent}
      </div>
    </div>
  );
});

export default UserPresenceList;
