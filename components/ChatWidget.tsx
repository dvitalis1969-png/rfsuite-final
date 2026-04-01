import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db, auth, storage, getDocWithTimeout, setDocWithTimeout, addDocWithTimeout, deleteDocWithTimeout } from '../src/lib/firebase';
import { collection, query, orderBy, onSnapshot, serverTimestamp, doc, where } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { isPro } from '../src/lib/userUtils';
import { getUserColor, formatTimestamp } from '../src/utils/chatUtils';
import { handleFirestoreError, OperationType } from '../src/utils/firestoreErrorHandler';
import { ImagePlus, Loader2, SmilePlus, Mic, Square, Edit2, Trash2, Check, X, Search, ArrowDown, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import UserPresenceList from './UserPresenceList';
import ProfilePopover from './ProfilePopover';

interface Message {
  id: string;
  userId: string;
  userName: string;
  isPro?: boolean;
  text: string;
  imageUrl?: string;
  timestamp: any;
  projectId: string;
  reactions?: Record<string, string[]>;
  replyTo?: { id: string; userName: string; text: string };
  linkPreview?: { title?: string; description?: string; image?: string; url: string };
  editedAt?: any;
  audioUrl?: string;
}

const ChatWidget: React.FC<{ projectId?: string | number; unreadDMs?: Record<string, boolean>; user?: any; initialDmUser?: any }> = React.memo(({ projectId, unreadDMs = {}, user, initialDmUser }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<{ id: string; name: string }[]>([]);
  const [chatMode, setChatMode] = useState<'project' | 'lounge' | 'dm'>(projectId ? 'project' : 'lounge');
  const [selectedDmUser, setSelectedDmUser] = useState<{ id: string; name: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [clearTimestamp, setClearTimestamp] = useState<number | null>(null);
  const [showCommands, setShowCommands] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageText, setEditMessageText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [dividerTimestamp, setDividerTimestamp] = useState<number | null>(null);

  const [canRecord, setCanRecord] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  useEffect(() => {
    if (initialDmUser) {
      setChatMode('dm');
      setSelectedDmUser(initialDmUser);
    }
  }, [initialDmUser]);
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  const [selectedPublicProfile, setSelectedPublicProfile] = useState<any | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkSupport = async () => {
      const hasSupport = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      const isSecure = window.isSecureContext;
      setCanRecord(hasSupport && isSecure);
      
      if (!isSecure && hasSupport) {
        console.warn("Microphone access requires a secure context (HTTPS).");
      }
    };
    checkSupport();
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const lastSeenRef = useRef<Record<string, number>>({});

  const getActiveChannelId = () => {
    if (chatMode === 'project') return String(projectId);
    if (chatMode === 'lounge') return 'global';
    if (chatMode === 'dm' && selectedDmUser && auth.currentUser) {
      // Create a consistent ID for the two users
      const ids = [auth.currentUser.uid, selectedDmUser.id].sort();
      return `dm_${ids[0]}_${ids[1]}`;
    }
    return 'global';
  };

  const activeProjectId = getActiveChannelId();

  useEffect(() => {
    if (chatMode === 'dm' && !selectedDmUser) {
      setMessages([]);
      return;
    }

    // Set divider timestamp based on last seen
    const last = lastSeenRef.current[activeProjectId] || 0;
    setDividerTimestamp(last);
    lastSeenRef.current[activeProjectId] = Date.now();

    // Clear unread status if we are in a DM with this user
    if (chatMode === 'dm' && selectedDmUser && auth.currentUser) {
      const unreadRef = doc(db, 'users', auth.currentUser.uid, 'unread_dms', selectedDmUser.id);
      console.log("ChatWidget: Deleting unread status for:", selectedDmUser.id);
      deleteDocWithTimeout(unreadRef).catch(err => console.error("ChatWidget: Error deleting unread status:", err));
    }

    const q = query(
      collection(db, 'messages', activeProjectId, 'chat'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
      
      // Check for new messages and clear unread status if needed
      if (chatMode === 'dm' && selectedDmUser && auth.currentUser) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg && lastMsg.userId !== auth.currentUser.uid) {
          const unreadRef = doc(db, 'users', auth.currentUser.uid, 'unread_dms', selectedDmUser.id);
          deleteDocWithTimeout(unreadRef).catch(console.error);
        }
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `messages/${activeProjectId}/chat`);
    });

    // Listen for typing users
    const typingQ = query(collection(db, 'messages', activeProjectId, 'typing'));
    const unsubscribeTyping = onSnapshot(typingQ, (snapshot) => {
      const typing = snapshot.docs
        .filter(doc => doc.id !== auth.currentUser?.uid)
        .map(doc => doc.data().userName);
      setTypingUsers(typing);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `messages/${activeProjectId}/typing`);
    });

    // Listen for online users
    const onlineQ = query(collection(db, 'presence', 'global', 'users'), where('status', '==', 'online'));
    const unsubscribeOnline = onSnapshot(onlineQ, (snapshot) => {
      const online = snapshot.docs
        .filter(doc => doc.id !== auth.currentUser?.uid)
        .map(doc => ({ 
          id: doc.id, 
          name: doc.data().name,
          statusMessage: doc.data().statusMessage,
          isPro: doc.data().isPro
        }));
      setOnlineUsers(online);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'presence/global/users');
    });

    return () => {
      unsubscribe();
      unsubscribeTyping();
      unsubscribeOnline();
    };
  }, [activeProjectId, chatMode, selectedDmUser, auth.currentUser?.uid]);

  useEffect(() => {
    if (!showScrollToBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showScrollToBottom]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    setShowScrollToBottom(!isAtBottom);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollToBottom(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewMessage(val);
    
    if (val === '/') {
      setShowCommands(true);
    } else if (!val.startsWith('/')) {
      setShowCommands(false);
    }

    // Mentions logic
    const mentionMatch = val.match(/@(\w*)$/);
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1].toLowerCase());
    } else {
      setMentionQuery(null);
    }
    
    if (!auth.currentUser || (chatMode === 'dm' && !selectedDmUser)) return;

    // Set typing status
    const typingRef = doc(db, 'messages', activeProjectId, 'typing', auth.currentUser.uid);
    setDocWithTimeout(typingRef, { userName: auth.currentUser.displayName || 'Anonymous' });

    // Clear previous timeout
    if (typingTimeout.current) clearTimeout(typingTimeout.current);

    // Set timeout to remove typing status
    typingTimeout.current = setTimeout(async () => {
      await deleteDocWithTimeout(typingRef);
    }, 3000);
  };

  const insertMention = (name: string) => {
    const newVal = newMessage.replace(/@\w*$/, `@${name} `);
    setNewMessage(newVal);
    setMentionQuery(null);
    fileInputRef.current?.focus();
  };

  const startEditing = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditMessageText(msg.text);
  };

  const saveEdit = async () => {
    if (!editingMessageId || !editMessageText.trim()) return;
    const path = `messages/${activeProjectId}/chat/${editingMessageId}`;
    try {
      const msgRef = doc(db, 'messages', activeProjectId, 'chat', editingMessageId);
      await setDocWithTimeout(msgRef, { text: editMessageText, editedAt: serverTimestamp() }, { merge: true });
      setEditingMessageId(null);
      setEditMessageText('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const deleteMessage = async (id: string) => {
    const path = `messages/${activeProjectId}/chat/${id}`;
    try {
      await deleteDocWithTimeout(doc(db, 'messages', activeProjectId, 'chat', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            try {
              await addDocWithTimeout(collection(db, 'messages', activeProjectId, 'chat'), {
                userId: auth.currentUser!.uid,
                userName: auth.currentUser!.displayName || 'Anonymous',
                isPro: isPro(user),
                text: '',
                audioUrl: base64Audio,
                timestamp: serverTimestamp(),
                projectId: activeProjectId,
                reactions: {}
              });

              if (chatMode === 'dm' && selectedDmUser) {
                const unreadRef = doc(db, 'users', selectedDmUser.id, 'unread_dms', auth.currentUser!.uid);
                await setDocWithTimeout(unreadRef, { 
                  hasUnread: true, 
                  timestamp: serverTimestamp() 
                }, { merge: true }).catch(console.error);
              }
            } catch (err) {
              console.error("Failed to send audio:", err);
            }
          };
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Error accessing microphone", err);
        setUploadError("Microphone access denied.");
      }
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !auth.currentUser || (chatMode === 'dm' && !selectedDmUser)) return;

    // Handle Slash Commands
    if (newMessage.trim() === '/shrug') {
      setNewMessage('¯\\_(ツ)_/¯');
      setShowCommands(false);
      return; // Let them send it on the next enter
    } else if (newMessage.trim() === '/clear') {
      setClearTimestamp(Date.now());
      setNewMessage('');
      setShowCommands(false);
      return;
    }

    const messageText = newMessage;
    setNewMessage('');
    setShowCommands(false);

    // Remove typing status immediately
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    const typingRef = doc(db, 'messages', activeProjectId, 'typing', auth.currentUser.uid);
    await deleteDocWithTimeout(typingRef);

    // Check for URLs to fetch link preview
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = messageText.match(urlRegex);
    let linkPreviewData = null;

    if (urls && urls.length > 0) {
      try {
        const response = await fetch(`/api/link-preview?url=${encodeURIComponent(urls[0])}`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.title) {
            linkPreviewData = {
              title: data.title,
              description: data.description,
              image: data.images?.[0] || data.favicons?.[0],
              url: data.url || urls[0]
            };
          }
        }
      } catch (err) {
        console.error("Failed to fetch link preview:", err);
      }
    }

    const messageData: any = {
      userId: auth.currentUser.uid,
      userName: auth.currentUser.displayName || 'Anonymous',
      isPro: user?.subscriptionStatus === 'active',
      text: messageText,
      timestamp: serverTimestamp(),
      projectId: activeProjectId,
      reactions: {}
    };

    if (replyingTo) {
      messageData.replyTo = {
        id: replyingTo.id,
        userName: replyingTo.userName,
        text: replyingTo.text
      };
      setReplyingTo(null);
    }

    if (linkPreviewData) {
      messageData.linkPreview = linkPreviewData;
    }

    try {
      console.log("Sending message to:", activeProjectId, "Data:", messageData);
      await addDocWithTimeout(collection(db, 'messages', activeProjectId, 'chat'), messageData);
      console.log("Message sent successfully");
    } catch (err) {
      console.error("Error sending message:", err);
      handleFirestoreError(err, OperationType.CREATE, `messages/${activeProjectId}/chat`);
    }

    // Set unread status for the recipient
    if (chatMode === 'dm' && selectedDmUser) {
      console.log("Setting unread status for:", selectedDmUser.id, "from:", auth.currentUser.uid);
      const unreadRef = doc(db, 'users', selectedDmUser.id, 'unread_dms', auth.currentUser.uid);
      await setDocWithTimeout(unreadRef, { 
        hasUnread: true, 
        timestamp: serverTimestamp() 
      }, { merge: true }).catch(err => console.error("Error setting unread status:", err));
    }

    setNewMessage('');
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;
    
    const messageRef = doc(db, 'messages', activeProjectId, 'chat', messageId);
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const currentReactions = message.reactions || {};
    const usersWhoReacted = currentReactions[emoji] || [];
    
    let newUsersWhoReacted;
    if (usersWhoReacted.includes(userId)) {
      // Remove reaction
      newUsersWhoReacted = usersWhoReacted.filter(id => id !== userId);
    } else {
      // Add reaction
      newUsersWhoReacted = [...usersWhoReacted, userId];
    }

    const newReactions = {
      ...currentReactions,
      [emoji]: newUsersWhoReacted
    };

    // Clean up empty reaction arrays
    if (newUsersWhoReacted.length === 0) {
      delete newReactions[emoji];
    }

    try {
      await setDocWithTimeout(messageRef, { reactions: newReactions }, { merge: true });
    } catch (err) {
      console.error("Error updating reaction:", err);
    }
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;
    
    if (!isPro(user)) {
      setUploadError('Image uploads are only available for Pro users.');
      return;
    }
    
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      // 1. Compress Image to a tiny Base64 string (usually under 100kb)
      const compressedDataUrl = await compressImage(file);
      
      // 2. BYPASS FIREBASE STORAGE ENTIRELY!
      // Since we compressed the image so small, we can just save the text string 
      // directly into the Firestore database. This completely ignores CORS issues!
      
      await addDocWithTimeout(collection(db, 'messages', activeProjectId, 'chat'), {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'Anonymous',
        isPro: isPro(user),
        text: '',
        imageUrl: compressedDataUrl, // Save the Base64 string directly
        timestamp: serverTimestamp(),
        projectId: activeProjectId
      });

      if (chatMode === 'dm' && selectedDmUser) {
        const unreadRef = doc(db, 'users', selectedDmUser.id, 'unread_dms', auth.currentUser.uid);
        await setDocWithTimeout(unreadRef, { 
          hasUnread: true, 
          timestamp: serverTimestamp() 
        }, { merge: true }).catch(console.error);
      }
    } catch (error: any) {
      console.error('Error uploading image:', error);
      setUploadError(error.message || 'Failed to upload image.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectProfile = async (user: any) => {
    setSelectedProfile(user);
    setIsLoadingProfile(true);
    setSelectedPublicProfile(null);
    try {
      const profileDoc = await getDocWithTimeout(doc(db, 'public_profiles', user.id));
      if (profileDoc.exists()) {
        setSelectedPublicProfile(profileDoc.data());
      }
    } catch (err) {
      console.error("Error fetching public profile:", err);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const startDM = (user: { id: string; name: string }) => {
    setSelectedDmUser(user);
    setChatMode('dm');
  };

  const hasAnyUnread = Object.keys(unreadDMs).length > 0;

  const filteredMessages = useMemo(() => {
    const msgs = messages.filter(m => !clearTimestamp || m.timestamp?.toMillis() > clearTimestamp);
    if (!searchQuery.trim()) return msgs;
    const query = searchQuery.toLowerCase();
    return msgs.filter(m => 
      m.text.toLowerCase().includes(query) || 
      m.userName.toLowerCase().includes(query)
    );
  }, [messages, searchQuery, clearTimestamp]);

  const renderedMessages = useMemo(() => {
    if (chatMode === 'dm' && !selectedDmUser) {
      return (
        <div className="text-xs text-slate-400 text-center mt-10">
          Select a user from the Lounge to start a private chat.
        </div>
      );
    }

    return (
      <AnimatePresence initial={false}>
        {filteredMessages.map((msg, index, arr) => {
          const isNew = dividerTimestamp && msg.timestamp?.toMillis() > dividerTimestamp && msg.userId !== auth.currentUser?.uid;
          const prevMsg = arr[index - 1];
          const prevIsNew = dividerTimestamp && prevMsg?.timestamp?.toMillis() > dividerTimestamp && prevMsg?.userId !== auth.currentUser?.uid;
          const showDivider = Boolean(isNew && !prevIsNew);
          const isMentioned = auth.currentUser?.displayName && msg.text.includes(`@${auth.currentUser.displayName}`);

          return (
            <React.Fragment key={msg.id}>
              {showDivider && (
                <div className="w-full text-center text-[10px] text-red-400 border-b border-red-500/30 my-3 leading-[0.1em]">
                  <span className="bg-slate-900 px-2 font-bold uppercase tracking-wider">New Messages</span>
                </div>
              )}
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`text-xs group relative ${msg.userId === auth.currentUser?.uid ? 'text-right' : 'text-left'}`}
              >
                <div className={`flex flex-col ${msg.userId === auth.currentUser?.uid ? 'items-end' : 'items-start'}`}>
                  <div className={`flex items-center gap-1.5 mb-1 ${msg.userId === auth.currentUser?.uid ? 'flex-row-reverse' : 'flex-row'}`}>
                    <button 
                      onClick={() => handleSelectProfile({ id: msg.userId, name: msg.userName, isPro: msg.isPro })}
                      className="text-[10px] font-black text-slate-300 hover:text-indigo-300 transition-colors uppercase tracking-tighter"
                    >
                      {msg.userName}
                    </button>
                    <span className="text-[8px] text-slate-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatTimestamp(msg.timestamp)}
                    </span>
                    {msg.isPro && (
                      <span className="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase tracking-wider" title="Pro User">
                        Pro
                      </span>
                    )}
                  </div>
                  
                  <div className={`relative group/bubble max-w-[85%] ${isMentioned ? 'ring-1 ring-indigo-500 rounded-xl shadow-[0_0_10px_rgba(99,102,241,0.2)]' : ''}`}>
                    {msg.replyTo && (
                      <div className={`mb-1 text-[10px] p-1.5 rounded bg-slate-900/50 border-l-2 border-indigo-500 text-left opacity-80 truncate max-w-full ${msg.userId === auth.currentUser?.uid ? 'ml-auto' : 'mr-auto'}`}>
                        <span className="font-bold text-indigo-300">{msg.replyTo.userName}:</span> {msg.replyTo.text}
                      </div>
                    )}
                    
                    {msg.audioUrl && (
                      <div className={`mt-1 mb-1 p-2 rounded-xl ${msg.userId === auth.currentUser?.uid ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                        <audio src={msg.audioUrl} controls className="h-8 w-48" />
                      </div>
                    )}

                    {msg.imageUrl ? (
                      <div className={`mt-1 mb-1 ${msg.userId === auth.currentUser?.uid ? 'flex justify-end' : 'flex justify-start'}`}>
                        <img src={msg.imageUrl} alt="Uploaded" className="max-w-[150px] max-h-[150px] rounded-md border border-slate-700 object-cover" referrerPolicy="no-referrer" />
                      </div>
                    ) : editingMessageId === msg.id ? (
                      <div className="flex flex-col gap-1 bg-slate-800 p-2 rounded-xl border border-indigo-500 text-left">
                        <input 
                          type="text" 
                          value={editMessageText} 
                          onChange={e => setEditMessageText(e.target.value)}
                          className="bg-slate-900 text-white text-xs px-2 py-1 rounded border border-slate-700 w-full"
                          autoFocus
                          onKeyDown={e => e.key === 'Enter' && saveEdit()}
                        />
                        <div className="flex justify-end gap-1 mt-1">
                          <button onClick={() => setEditingMessageId(null)} className="p-1 hover:bg-slate-700 rounded text-slate-400"><X className="w-3 h-3"/></button>
                          <button onClick={saveEdit} className="p-1 hover:bg-indigo-500 rounded text-indigo-300 hover:text-white"><Check className="w-3 h-3"/></button>
                        </div>
                      </div>
                    ) : msg.text ? (
                      <div className={`inline-block px-3 py-2 rounded-xl text-left ${msg.userId === auth.currentUser?.uid ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-100 rounded-tl-sm'}`}>
                        <div className="markdown-body prose prose-invert prose-sm max-w-none text-xs prose-p:leading-snug prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-700 prose-pre:p-2 prose-pre:rounded-md prose-code:text-indigo-300 prose-code:bg-slate-900/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded">
                          <Markdown>{msg.text}</Markdown>
                        </div>
                        {msg.editedAt && <span className="text-[8px] opacity-50 italic mt-1 block">(edited)</span>}
                      </div>
                    ) : null}

                    {msg.linkPreview && (
                      <a href={msg.linkPreview.url} target="_blank" rel="noopener noreferrer" className={`block mt-1 p-2 rounded-lg border border-slate-700 bg-slate-900/50 hover:bg-slate-800 transition-colors text-left overflow-hidden ${msg.userId === auth.currentUser?.uid ? 'ml-auto' : 'mr-auto'}`}>
                        {msg.linkPreview.image && (
                          <img src={msg.linkPreview.image} alt="Preview" className="w-full h-24 object-cover rounded mb-2" referrerPolicy="no-referrer" />
                        )}
                        <div className="font-bold text-indigo-300 truncate">{msg.linkPreview.title}</div>
                        <div className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">{msg.linkPreview.description}</div>
                      </a>
                    )}

                    {/* Reaction Menu (Hover) */}
                    <div className={`absolute top-0 -translate-y-1/2 opacity-0 group-hover/bubble:opacity-100 transition-opacity flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-full p-1 shadow-lg z-10 ${msg.userId === auth.currentUser?.uid ? 'right-full mr-2' : 'left-full ml-2'}`}>
                      {msg.userId === auth.currentUser?.uid && (
                        <>
                          {!msg.imageUrl && !msg.audioUrl && (
                            <button onClick={() => startEditing(msg)} className="hover:bg-slate-700 p-1 rounded text-slate-400 hover:text-indigo-300 transition-colors"><Edit2 className="w-3 h-3" /></button>
                          )}
                          <button onClick={() => deleteMessage(msg.id)} className="hover:bg-slate-700 p-1 rounded text-slate-400 hover:text-red-400 transition-colors"><Trash2 className="w-3 h-3" /></button>
                          <div className="w-px h-3 bg-slate-700 mx-0.5" />
                        </>
                      )}
                      <button 
                        onClick={() => setReplyingTo(msg)}
                        className="hover:bg-slate-700 px-2 py-0.5 rounded text-[10px] font-bold text-indigo-300 transition-colors mr-1"
                      >
                        Reply
                      </button>
                      {['👍', '❤️', '🚀', '👀', '🔥'].map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(msg.id, emoji)}
                          className="hover:scale-125 transition-transform px-1 text-sm"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                {/* Active Reactions */}
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div className={`flex flex-wrap gap-1 mt-1 ${msg.userId === auth.currentUser?.uid ? 'justify-end' : 'justify-start'}`}>
                    {Object.entries(msg.reactions).map(([emoji, users]) => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(msg.id, emoji)}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors ${users.includes(auth.currentUser?.uid || '') ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700'}`}
                      >
                        <span>{emoji}</span>
                        <span>{users.length}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
            </React.Fragment>
          );
        })}
      </AnimatePresence>
    );
  }, [filteredMessages, chatMode, selectedDmUser, dividerTimestamp, editingMessageId, editMessageText, auth.currentUser?.uid]);

  const renderedOnlineUsers = useMemo(() => (
    chatMode === 'lounge' && (
      <div className="text-[10px] text-slate-400 mb-2 border-b border-slate-800 pb-2">
        Online: {onlineUsers.length > 0 ? onlineUsers.map((u, i) => (
          <span key={u.id} className="relative inline-block">
            <button 
              onClick={() => handleSelectProfile(u)}
              className="hover:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
              title={`View ${u.name}'s profile`}
            >
              {u.name}
              {unreadDMs[u.id] && (
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" title="New message!" />
              )}
            </button>
            {i < onlineUsers.length - 1 ? <span className="mr-1">,</span> : ''}
          </span>
        )) : 'Just you'}
      </div>
    )
  ), [chatMode, onlineUsers, unreadDMs]);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-slate-950/40 rounded-lg border border-white/5 p-4 relative backdrop-blur-sm">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex gap-1">
          {projectId !== undefined && (
            <button 
              onClick={() => setChatMode('project')}
              className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded ${chatMode === 'project' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              Project
            </button>
          )}
          <button 
            onClick={() => setChatMode('lounge')}
            className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded relative ${chatMode === 'lounge' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
          >
            Lounge
            {hasAnyUnread && chatMode !== 'lounge' && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </button>
          {chatMode === 'dm' && selectedDmUser && (
            <button 
              className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded bg-indigo-600 text-white"
            >
              DM: {selectedDmUser.name}
            </button>
          )}
        </div>
        
        <div className="relative group">
          <Search className="w-3 h-3 text-slate-500 group-focus-within:text-indigo-400 transition-colors absolute left-2 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="bg-slate-950 border border-slate-800 rounded-full pl-6 pr-2 py-1 text-[9px] text-white focus:outline-none focus:border-indigo-500/50 w-24 focus:w-32 transition-all"
          />
        </div>
      </div>
      
      {renderedOnlineUsers}

      <div 
        className="flex-1 overflow-y-auto mb-4 space-y-3 px-1 relative"
        onScroll={handleScroll}
        ref={messagesContainerRef}
      >
        {renderedMessages}
        <div ref={messagesEndRef} />
        
        <AnimatePresence>
          {showScrollToBottom && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              onClick={scrollToBottom}
              className="absolute bottom-2 right-2 bg-indigo-600 text-white p-1.5 rounded-full shadow-lg hover:bg-indigo-500 transition-colors z-10"
            >
              <ArrowDown className="w-3 h-3" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Profile Popover */}
      <AnimatePresence>
        {selectedProfile && (
          <ProfilePopover 
            selectedProfile={selectedProfile}
            selectedPublicProfile={selectedPublicProfile}
            isLoadingProfile={isLoadingProfile}
            onClose={() => setSelectedProfile(null)}
            onSendMessage={(user) => {
              startDM(user);
              setSelectedProfile(null);
            }}
          />
        )}
      </AnimatePresence>
      
      {typingUsers.length > 0 && (
        <div className="h-4 flex items-center px-1">
          <div className="text-[10px] text-slate-400 italic">
            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </div>
        </div>
      )}

      <div className="max-h-32 overflow-y-auto border-t border-white/5 bg-slate-900/10">
        <UserPresenceList onUserClick={handleSelectProfile} />
      </div>

      {uploadError && (
        <div className="text-[10px] text-red-400 mb-2 bg-red-950/50 p-1 rounded border border-red-900/50">
          ⚠️ {uploadError}
        </div>
      )}
      
      <div className="relative">
        {replyingTo && (
          <div className="absolute bottom-full left-0 right-0 mb-2 p-2 bg-slate-800 border border-slate-700 rounded-lg text-xs flex justify-between items-start shadow-lg">
            <div className="overflow-hidden">
              <div className="font-bold text-indigo-400 text-[10px] mb-0.5">Replying to {replyingTo.userName}</div>
              <div className="text-slate-300 truncate">{replyingTo.text}</div>
            </div>
            <button onClick={() => setReplyingTo(null)} className="text-slate-500 hover:text-white ml-2">×</button>
          </div>
        )}

        {showCommands && (
          <div className="absolute bottom-full left-0 mb-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-20">
            <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 bg-slate-900/50">Commands</div>
            <button onClick={() => { setNewMessage('/shrug '); setShowCommands(false); fileInputRef.current?.focus(); }} className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-indigo-600 hover:text-white transition-colors flex justify-between">
              <span className="font-mono">/shrug</span>
              <span className="opacity-50">¯\_(ツ)_/¯</span>
            </button>
            <button onClick={() => { setClearTimestamp(Date.now()); setNewMessage(''); setShowCommands(false); }} className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-indigo-600 hover:text-white transition-colors flex justify-between">
              <span className="font-mono">/clear</span>
              <span className="opacity-50">Clear chat</span>
            </button>
          </div>
        )}

        {mentionQuery !== null && (
          <div className="absolute bottom-full left-0 mb-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-20 max-h-32 overflow-y-auto">
            <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 bg-slate-900/50">Mentions</div>
            {onlineUsers.filter(u => u.name.toLowerCase().includes(mentionQuery)).map(u => (
              <button 
                key={u.id}
                onClick={() => insertMention(u.name)} 
                className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-indigo-600 hover:text-white transition-colors"
              >
                {u.name}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={sendMessage} className="flex gap-2 items-center">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleImageUpload}
          disabled={isUploading || (chatMode === 'dm' && !selectedDmUser)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || (chatMode === 'dm' && !selectedDmUser)}
          className="text-slate-400 hover:text-indigo-400 disabled:opacity-50 transition-colors"
          title="Upload image"
        >
          {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
        </button>
        <button
          type="button"
          onClick={toggleRecording}
          disabled={!canRecord || isUploading || (chatMode === 'dm' && !selectedDmUser)}
          className={`transition-colors ${isRecording ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-indigo-400'} disabled:opacity-30`}
          title={!canRecord ? "Microphone requires HTTPS and browser support" : (isRecording ? "Stop recording" : "Record audio")}
        >
          {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
        <input
          type="text"
          value={newMessage}
          onChange={handleInputChange}
          disabled={isUploading || (chatMode === 'dm' && !selectedDmUser)}
          className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white disabled:opacity-50"
          placeholder={chatMode === 'dm' && !selectedDmUser ? "Select a user to chat..." : "Type a message..."}
        />
        <button 
          type="submit" 
          disabled={isUploading || !newMessage.trim() || (chatMode === 'dm' && !selectedDmUser)}
          className="bg-indigo-600 text-white px-3 py-1 rounded text-xs font-bold disabled:opacity-50"
        >
          Send
        </button>
      </form>
      </div>
      <div className="mt-1.5 text-[9px] text-slate-500 text-right px-1">
        Supports **markdown** and `code`
      </div>
    </div>
  );
});

export default ChatWidget;
