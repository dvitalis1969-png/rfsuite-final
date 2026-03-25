import React, { useState } from 'react';
import { X, Mail, Lock, User, ArrowRight, Github, Eye, EyeOff } from 'lucide-react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../src/lib/firebase';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (user: any) => void;
    initialMode?: 'login' | 'signup';
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess, initialMode = 'login' }) => {
    const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        
        if (!auth) {
            const missingKeys = [
                !import.meta.env.VITE_FIREBASE_API_KEY && 'VITE_FIREBASE_API_KEY',
                !import.meta.env.VITE_FIREBASE_AUTH_DOMAIN && 'VITE_FIREBASE_AUTH_DOMAIN',
                !import.meta.env.VITE_FIREBASE_PROJECT_ID && 'VITE_FIREBASE_PROJECT_ID',
            ].filter(Boolean);
            
            setError(`Firebase is not configured. Missing keys: ${missingKeys.join(', ')}. Please check your Render environment variables.`);
            setIsLoading(false);
            return;
        }

        try {
            if (mode === 'signup') {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                if (name) {
                    await updateProfile(userCredential.user, { displayName: name });
                }
                
                // Create user document in Firestore
                await setDoc(doc(db, 'users', userCredential.user.uid), {
                    email: userCredential.user.email,
                    name: name || userCredential.user.email?.split('@')[0],
                    subscriptionStatus: 'none',
                    createdAt: new Date().toISOString()
                });

                onSuccess({
                    id: userCredential.user.uid,
                    email: userCredential.user.email,
                    name: name || userCredential.user.email?.split('@')[0],
                    subscription: 'none',
                    stripeCustomerId: null
                });
            } else {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                
                // Fetch user document to get subscription status
                let subscription = 'none';
                let stripeCustomerId = null;
                try {
                    const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        subscription = data.subscriptionStatus || 'none';
                        stripeCustomerId = data.stripeCustomerId || null;
                    }
                } catch (dbErr) {
                    console.error("Error fetching user data:", dbErr);
                }

                onSuccess({
                    id: userCredential.user.uid,
                    email: userCredential.user.email,
                    name: userCredential.user.displayName || userCredential.user.email?.split('@')[0],
                    subscription: subscription,
                    stripeCustomerId: stripeCustomerId
                });
            }
            onClose();
        } catch (err: any) {
            console.error("Auth error:", err);
            let errorMessage = "Authentication failed. Please try again.";
            if (err.code === 'auth/invalid-credential') {
                errorMessage = "Invalid email or password. Please check your credentials or create an account.";
            } else if (err.code === 'auth/email-already-in-use') {
                errorMessage = "An account with this email already exists.";
            } else if (err.code === 'auth/weak-password') {
                errorMessage = "Password should be at least 6 characters.";
            } else if (err.code === 'auth/network-request-failed') {
                errorMessage = "Network error. Please check your internet connection, or disable any ad blockers/VPNs that might be blocking Firebase.";
            } else if (err.message) {
                errorMessage = err.message;
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative">
                <button 
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="p-8 md:p-10">
                    <div className="mb-8">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg mb-6">📡</div>
                        <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-2">
                            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
                        </h2>
                        <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">
                            {mode === 'login' ? 'Access your RF coordination suite' : 'Join the professional RF ecosystem'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-xs p-3 rounded-xl mb-4">
                                {error}
                            </div>
                        )}
                        {mode === 'signup' && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input 
                                        type="text" 
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="John Doe"
                                        className="w-full bg-slate-950 border border-white/5 rounded-xl py-3.5 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input 
                                    type="email" 
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="engineer@rfsuite.pro"
                                    className="w-full bg-slate-950 border border-white/5 rounded-xl py-3.5 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-slate-950 border border-white/5 rounded-xl py-3.5 pl-12 pr-12 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-white/5 text-slate-500 hover:text-white hover:bg-white/10 transition-all"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <button 
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-widest text-xs py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 group"
                        >
                            {isLoading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-white/5">
                        <button 
                            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black uppercase tracking-widest text-[10px] py-3.5 rounded-xl transition-all flex items-center justify-center gap-3"
                        >
                            <Github className="w-4 h-4" />
                            Continue with GitHub
                        </button>
                    </div>

                    <div className="mt-8 text-center">
                        <button 
                            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                            className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-400 transition-colors"
                        >
                            {mode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
