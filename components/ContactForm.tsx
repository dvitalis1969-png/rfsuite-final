import React, { useState } from 'react';
import { toast } from 'sonner';
import { db, auth } from '../src/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Send } from 'lucide-react';

enum OperationType {
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete',
    LIST = 'list',
    GET = 'get',
    WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
    const errInfo = {
        error: error instanceof Error ? error.message : String(error),
        authInfo: {
            userId: auth.currentUser?.uid,
            email: auth.currentUser?.email,
            emailVerified: auth.currentUser?.emailVerified,
            isAnonymous: auth.currentUser?.isAnonymous,
        },
        operationType,
        path
    }
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
}

const ContactForm: React.FC = () => {
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!auth.currentUser) {
            toast.error('You must be logged in to send a message.');
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Send email
            const emailResponse = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject,
                    message,
                    userEmail: auth.currentUser.email
                })
            });
            
            if (!emailResponse.ok) {
                const errorData = await emailResponse.json();
                throw new Error(errorData.error || 'Failed to send email');
            }

            // 2. Write to Firestore
            try {
                console.log("📝 Attempting to write to Firestore:", {
                    collection: 'contact_messages',
                    data: {
                        userId: auth.currentUser.uid,
                        userEmail: auth.currentUser.email,
                        subject,
                        message,
                        createdAt: serverTimestamp(),
                        status: 'new'
                    }
                });
                await addDoc(collection(db, 'contact_messages'), {
                    userId: auth.currentUser.uid,
                    userEmail: auth.currentUser.email,
                    subject,
                    message,
                    createdAt: serverTimestamp(),
                    status: 'new'
                });
                console.log("✅ Firestore write successful");
            } catch (error) {
                console.error("❌ Firestore write failed:", error);
                handleFirestoreError(error, OperationType.WRITE, 'contact_messages');
            }
            
            toast.success('Message sent successfully!');
            setSubject('');
            setMessage('');
        } catch (error: any) {
            console.error('Error sending message:', error);
            toast.error(error.message || 'Failed to send message.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 p-6 bg-slate-950 border border-white/5 rounded-3xl">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Contact Support</h4>
            <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Subject</label>
                <input 
                    type="text" 
                    value={subject} 
                    onChange={(e) => setSubject(e.target.value)} 
                    required 
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-sm text-white focus:border-indigo-500 outline-none" 
                />
            </div>
            <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Message</label>
                <textarea 
                    value={message} 
                    onChange={(e) => setMessage(e.target.value)} 
                    required 
                    className="w-full h-32 bg-slate-900 border border-slate-800 rounded-lg p-2 text-sm text-white focus:border-indigo-500 outline-none resize-none" 
                />
            </div>
            <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-widest text-[10px] rounded-xl transition-all"
            >
                {isSubmitting ? 'Sending...' : 'Send Message'}
                <Send className="w-4 h-4" />
            </button>
        </form>
    );
};

export default ContactForm;
