import React, { useState } from 'react';
import { toast } from 'sonner';
import { User, CreditCard, Shield, LogOut, X, Check, Clock, Calendar, Zap, ExternalLink, Mail } from 'lucide-react';
import { db, auth } from '../src/lib/firebase';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '../src/utils/firestoreErrorHandler';
import { getUserProjectsFromCloud, deleteProjectFromCloud } from '../services/cloudDbService';
import { isPro } from '../src/lib/userUtils';
import ContactForm from './ContactForm';
import { ShieldAlert, Loader2 } from 'lucide-react';

interface AccountDashboardProps {
    user: any;
    onClose: () => void;
    onLogout: () => void;
    onUpgrade: (tier: string) => void;
    onLoadProject?: (project: any) => void;
}

const AccountDashboard: React.FC<AccountDashboardProps> = ({ user, onClose, onLogout, onUpgrade, onLoadProject }) => {
    const [activeTab, setActiveTab] = useState<'profile' | 'billing' | 'security' | 'projects' | 'contact'>('profile');
    const [isLoading, setIsLoading] = useState(false);
    const [lastError, setLastError] = useState<string | null>(null);
    const [configStatus, setConfigStatus] = useState<{ stripe: boolean; firebase: boolean; stripeMode?: string; stripePrefix?: string }>({ stripe: false, firebase: false });
    const [cloudProjects, setCloudProjects] = useState<any[]>([]);
    const [isFetchingProjects, setIsFetchingProjects] = useState(false);
    const currentUser = user;
    const [displayName, setDisplayName] = useState(currentUser?.name || '');
    const [title, setTitle] = useState(currentUser?.title || '');
    const [location, setLocation] = useState(currentUser?.location || '');
    const [currentTour, setCurrentTour] = useState(currentUser?.currentTour || '');
    const [specialties, setSpecialties] = useState(currentUser?.specialties?.join(', ') || '');
    const [gearInventory, setGearInventory] = useState(currentUser?.gearInventory || '');
    const [availableForWork, setAvailableForWork] = useState(currentUser?.availableForWork || false);
    const [isUpdatingName, setIsUpdatingName] = useState(false);

    React.useEffect(() => {
        if (currentUser) {
            setDisplayName(currentUser.name || '');
            setTitle(currentUser.title || '');
            setLocation(currentUser.location || '');
            setCurrentTour(currentUser.currentTour || '');
            setSpecialties(currentUser.specialties?.join(', ') || '');
            setGearInventory(currentUser.gearInventory || '');
            setAvailableForWork(currentUser.availableForWork || false);
        }
    }, [currentUser]);

    const handleUpdateProfile = async () => {
        if (!displayName.trim() || !auth.currentUser) {
            console.error("Missing display name or auth user:", { displayName: displayName.trim(), user: auth.currentUser });
            return;
        }
        console.log("Updating profile for user:", auth.currentUser.uid);
        try {
            setIsUpdatingName(true);
            await updateProfile(auth.currentUser!, { displayName: displayName });
            
            // Update user document in Firestore too
            const profileData = {
                name: displayName,
                title: title.trim(),
                location: location.trim(),
                currentTour: currentTour.trim(),
                specialties: specialties.split(',').map(s => s.trim()).filter(s => s),
                gearInventory: gearInventory.trim(),
                availableForWork
            };

            console.log("Saving to Firestore:", { uid: auth.currentUser.uid, profileData });
            await setDoc(doc(db, 'users', auth.currentUser.uid), profileData, { merge: true });
            await setDoc(doc(db, 'public_profiles', auth.currentUser.uid), {
                id: auth.currentUser.uid,
                ...profileData,
                lastSeen: new Date()
            }, { merge: true });
            
            // Sync with presence
            const globalRef = doc(db, 'presence', 'global', 'users', auth.currentUser.uid);
            await setDoc(globalRef, { 
                statusMessage: profileData.title || profileData.currentTour || ''
            }, { merge: true });

            console.log("Firestore save successful");
            
            toast.success('Profile updated successfully!');
        } catch (error: any) {
            console.error("Error updating profile:", error);
            toast.error(`Failed to update profile: ${error.message}`);
        } finally {
            setIsUpdatingName(false);
        }
    };

    // Sync currentUser with user prop from App.tsx

    React.useEffect(() => {
        // Check if config is available (via a health check or similar)
        const checkConfig = async () => {
            try {
                const response = await fetch(`${API_BASE}/api/health`);
                const data = await response.json();
                
                const stripeResponse = await fetch(`${API_BASE}/api/stripe-status`);
                const stripeData = await stripeResponse.json();
                
                setConfigStatus({ 
                    stripe: stripeData.configured, 
                    firebase: data.config?.firebaseAdmin,
                    stripeMode: stripeData.mode,
                    stripePrefix: stripeData.prefix
                });
            } catch (err) {
                console.error("Config check failed:", err);
            }
        };
        checkConfig();

        if (user?.id && activeTab === 'projects') {
            fetchProjects();
        }
    }, [user?.id, activeTab]);

    const fetchProjects = async () => {
        if (!user?.id) return;
        setIsFetchingProjects(true);
        try {
            const projects = await getUserProjectsFromCloud(user.id);
            setCloudProjects(projects);
        } catch (err) {
            console.error("Failed to fetch cloud projects:", err);
        } finally {
            setIsFetchingProjects(false);
        }
    };

    const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this project?')) return;
        try {
            await deleteProjectFromCloud(id);
            setCloudProjects(prev => prev.filter(p => p.id !== id));
        } catch (err) {
            console.error("Failed to delete project:", err);
            toast.error("Failed to delete project.");
        }
    };

    const handleLoadProject = (project: any) => {
        if (onLoadProject) {
            onLoadProject(project);
            onClose();
        }
    };

    // Hardcoded Stripe Price IDs
    const tiers = [
        { id: 'price_1TFx8PL5JAY1lJg5iiPBdgWN', name: '48 Hour Pass', price: '£5.99', icon: <Clock className="w-5 h-5" />, desc: 'Single Event Access' },
        { id: 'price_1TFx8gL5JAY1lJg5po1s8JQ2', name: '7 Day Pass', price: '£12.99', icon: <Calendar className="w-5 h-5" />, desc: 'Festival Week Access' },
        { id: 'price_1TFx90L5JAY1lJg5fCz7HRne', name: '1 Month Pro', price: '£26.99', icon: <Zap className="w-5 h-5" />, desc: 'Continuous Professional Use' }
    ];

    // Use relative path for API calls - this works on both localhost and Render automatically
    const API_BASE = ''; 

    const handleSubscribe = async (priceId: string, tierName: string) => {
        const targetUrl = `${API_BASE}/api/create-checkout-session`;
        try {
            setIsLoading(true);
            setLastError(null);
            toast.info("Connecting to Stripe...", { description: `Price ID: ${priceId}` });
            console.log(`Initiating checkout to: ${targetUrl}`);
            
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    priceId,
                    userId: currentUser.id,
                    email: currentUser.email,
                    returnUrl: API_BASE || window.location.origin, // Ensure return URL points to the backend server
                    tierName,
                }),
            });
            
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const text = await response.text();
                console.error(`Invalid response from ${targetUrl}:`, text.substring(0, 100));
                throw new Error(`Server returned an invalid response (likely HTML) from ${targetUrl}.`);
            }
            
            const data = await response.json();
            if (data.url) {
                const newWindow = window.open(data.url, '_blank');
                if (!newWindow) {
                    toast.error('Please allow popups to open the Stripe checkout page.');
                }
                setIsLoading(false);
            } else {
                const errorMsg = data.message || data.error || 'Failed to create checkout session';
                setLastError(errorMsg);
                throw new Error(errorMsg);
            }
        } catch (error: any) {
            console.error('Subscription error:', error);
            const errorMessage = error.message || 'Failed to start checkout process.';
            setLastError(errorMessage);
            toast.error(`Stripe Connection Error: ${errorMessage}`);
            setIsLoading(false);
        }
    };

    const handleManageBilling = async () => {
        // In a real app, you'd fetch the stripeCustomerId from the user document
        // For now, we'll show a toast if it's not available in the user object
        if (!currentUser.stripeCustomerId) {
            toast.error('No active billing profile found. Please subscribe to a plan first.');
            return;
        }

        try {
            setIsLoading(true);
            const response = await fetch(`${API_BASE}/api/create-portal-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId: currentUser.stripeCustomerId,
                    returnUrl: API_BASE || window.location.origin, // Ensure return URL points to the backend server
                }),
            });
            
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("Server returned an invalid response. If you deployed this app to a static host like Netlify, the backend API is not running.");
            }
            
            const data = await response.json();
            if (data.url) {
                const newWindow = window.open(data.url, '_blank');
                if (!newWindow) {
                    toast.error('Please allow popups to open the Stripe billing portal.');
                }
                setIsLoading(false);
            } else {
                throw new Error(data.error || 'Failed to create portal session');
            }
        } catch (error) {
            console.error('Portal error:', error);
            toast.error('Failed to open billing portal.');
            setIsLoading(false);
        }
    };

    const handlePasswordReset = async () => {
        if (!currentUser?.email) return;
        try {
            setIsLoading(true);
            await sendPasswordResetEmail(auth, currentUser.email);
            toast.success(`A password reset email has been sent to ${currentUser.email}. Please check your inbox.`);
        } catch (error: any) {
            console.error("Password reset error:", error);
            toast.error(`Failed to send password reset email: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-4xl h-[80vh] bg-slate-900 border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col md:flex-row">
                {/* Sidebar */}
                <div className="w-full md:w-64 bg-slate-950/50 border-r border-white/5 p-6 flex flex-col">
                    <div className="flex items-center gap-4 mb-10">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-xl shadow-lg">📡</div>
                        <div>
                            <h2 className="text-sm font-black text-white uppercase tracking-widest">RF Pro</h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Account Center</p>
                        </div>
                    </div>

                    <nav className="space-y-2 flex-grow">
                        {[
                            { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
                            { id: 'projects', label: 'My Projects', icon: <Zap className="w-4 h-4" /> },
                            { id: 'billing', label: 'Subscription', icon: <CreditCard className="w-4 h-4" /> },
                            { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
                            { id: 'contact', label: 'Contact', icon: <Mail className="w-4 h-4" /> }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                    activeTab === tab.id 
                                    ? 'bg-indigo-600 text-white shadow-lg' 
                                    : 'text-slate-500 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </nav>

                    <button 
                        onClick={onLogout}
                        className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/10 transition-all mt-auto"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow p-8 md:p-12 overflow-y-auto relative">
                    <button 
                        onClick={onClose}
                        className="absolute top-8 right-8 p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {activeTab === 'profile' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-8">User Profile</h3>
                            <div className="space-y-8">
                                <div className="flex items-center gap-6 p-6 bg-slate-950 border border-white/5 rounded-3xl">
                                    <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-3xl flex items-center justify-center text-3xl font-black text-white shadow-lg">
                                        {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                    <div className="flex-grow">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xl font-black text-white uppercase tracking-wider">{currentUser?.name || 'User'}</h4>
                                        </div>
                                        <p className="text-slate-500 text-sm font-medium">{currentUser?.email}</p>
                                        <div className="mt-4 flex items-center gap-2">
                                            <input 
                                                type="text"
                                                value={displayName}
                                                onChange={(e) => setDisplayName(e.target.value)}
                                                className="bg-slate-950 border border-white/5 rounded-xl py-2 px-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all"
                                                placeholder="Enter display name"
                                            />
                                        </div>
                                        <div className="mt-2 inline-block px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                                            {currentUser?.subscriptionStatus === 'none' ? 'Free Tier' : `${currentUser?.subscription} Member`}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 bg-slate-950 border border-white/5 rounded-3xl space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Professional Details</h4>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Job Title</label>
                                            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. RF Coordinator, A1" className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-sm text-white focus:border-indigo-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Location</label>
                                            <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. London, UK" className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-sm text-white focus:border-indigo-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Current Tour / Project</label>
                                            <input type="text" value={currentTour} onChange={e => setCurrentTour(e.target.value)} placeholder="e.g. World Tour 2026" className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-sm text-white focus:border-indigo-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Specialties (comma separated)</label>
                                            <input type="text" value={specialties} onChange={e => setSpecialties(e.target.value)} placeholder="e.g. IEMs, Broadcast, Comms" className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-sm text-white focus:border-indigo-500 outline-none" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Gear Inventory / Notes</label>
                                        <textarea value={gearInventory} onChange={e => setGearInventory(e.target.value)} placeholder="List your available gear or professional notes..." className="w-full h-20 bg-slate-900 border border-slate-800 rounded-lg p-2 text-sm text-white focus:border-indigo-500 outline-none resize-none" />
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <div className="relative">
                                                <input type="checkbox" className="sr-only" checked={availableForWork} onChange={e => setAvailableForWork(e.target.checked)} />
                                                <div className={`block w-10 h-6 rounded-full transition-colors ${availableForWork ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
                                                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${availableForWork ? 'transform translate-x-4' : ''}`}></div>
                                            </div>
                                            <span className="text-sm font-medium text-slate-300">Available for Work / Networking</span>
                                        </label>

                                        <button 
                                            onClick={handleUpdateProfile}
                                            disabled={isUpdatingName}
                                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-widest text-[10px] rounded-xl transition-all"
                                        >
                                            {isUpdatingName ? 'Saving...' : 'Save Profile'}
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-6 bg-slate-950 border border-white/5 rounded-3xl">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Member Since</p>
                                        <p className="text-white font-bold">Today</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'projects' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-2xl font-black text-white uppercase tracking-tight">My Cloud Projects</h3>
                                <button 
                                    onClick={fetchProjects}
                                    className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                                    title="Refresh Projects"
                                >
                                    <Clock className={`w-4 h-4 ${isFetchingProjects ? 'animate-spin' : ''}`} />
                                </button>
                            </div>

                            {isFetchingProjects ? (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                    <p className="text-[10px] font-black uppercase tracking-widest">Loading Projects...</p>
                                </div>
                            ) : cloudProjects.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 bg-slate-950/50 border border-dashed border-white/10 rounded-3xl text-slate-500">
                                    <Zap className="w-12 h-12 mb-4 opacity-20" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">No cloud projects found</p>
                                    <p className="text-[9px] mt-2 opacity-50">Save a project from the main header to see it here.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {cloudProjects.map(project => (
                                        <div 
                                            key={project.id} 
                                            onClick={() => handleLoadProject(project)}
                                            className="group p-6 bg-slate-950 border border-white/5 rounded-3xl hover:border-indigo-500/30 transition-all cursor-pointer flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-6">
                                                <div className="w-12 h-12 bg-indigo-600/10 rounded-2xl flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                                    <Zap className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-white uppercase tracking-wider mb-1">{project.name}</h4>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                                                        <Clock className="w-3 h-3" />
                                                        Modified: {project.lastModified.toLocaleDateString()} {project.lastModified.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <button 
                                                    onClick={(e) => handleDeleteProject(project.id, e)}
                                                    className="p-3 rounded-xl bg-red-500/10 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
                                                    title="Delete Project"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                                <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-white transition-all">
                                                    →
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'billing' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-8">Subscription Plans</h3>
                            
                            {currentUser?.subscriptionStatus !== 'none' && (
                                <div className="mb-10 p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-xl text-white shadow-lg">✓</div>
                                        <div>
                                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Active Plan</p>
                                            <h4 className="text-lg font-black text-white uppercase tracking-wider">{currentUser?.subscription}</h4>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={handleManageBilling}
                                        disabled={isLoading}
                                        className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all flex items-center gap-2"
                                    >
                                        Manage Billing <ExternalLink className="w-3 h-3" />
                                    </button>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
                                {tiers.map(tier => (
                                    <div key={tier.id} className="p-6 bg-slate-950 border border-white/5 rounded-3xl flex flex-col h-full hover:border-indigo-500/30 transition-all group">
                                        <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-slate-400 mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                            {tier.icon}
                                        </div>
                                        <h4 className="text-sm font-black text-white uppercase tracking-wider mb-1">{tier.name}</h4>
                                        <p className="text-2xl font-black text-white mb-4">{tier.price}</p>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-6 flex-grow">{tier.desc}</p>
                                        <button 
                                            onClick={() => handleSubscribe(tier.id, tier.name)}
                                            disabled={isLoading}
                                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-widest text-[9px] rounded-xl transition-all"
                                        >
                                            {isLoading ? 'Processing...' : 'Subscribe'}
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Debug Section - Only visible in development or for admins */}
                            <div className="bg-amber-500/5 rounded-3xl border border-amber-500/20 overflow-hidden">
                                <div className="p-4 bg-amber-500/10 border-b border-amber-500/10 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <ShieldAlert className="w-4 h-4 text-amber-500" />
                                        <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Debug Information</h3>
                                    </div>
                                    <span className="text-[8px] font-black text-amber-500/50 bg-amber-500/10 px-2 py-0.5 rounded uppercase tracking-tighter">Diagnostic Mode</span>
                                </div>
                                <div className="p-6 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black text-amber-500/70 uppercase tracking-widest">Backend Configuration</p>
                                            <div className="bg-black/40 p-4 rounded-2xl border border-white/5 font-mono text-[10px] space-y-1">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Stripe Config:</span>
                                                    <span className={configStatus.stripe ? 'text-emerald-400' : 'text-rose-400'}>{configStatus.stripe ? '✅ CONFIGURED' : '❌ MISSING'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Firebase Admin:</span>
                                                    <span className={configStatus.firebase ? 'text-emerald-400' : 'text-rose-400'}>{configStatus.firebase ? '✅ CONFIGURED' : '❌ MISSING'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Stripe Mode:</span>
                                                    <span className="text-amber-400 uppercase">{configStatus.stripeMode || 'UNKNOWN'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black text-amber-500/70 uppercase tracking-widest">User Document State</p>
                                            <div className="bg-black/40 p-4 rounded-2xl border border-white/5 font-mono text-[10px] space-y-1">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Status:</span>
                                                    <span className="text-white">{user?.subscriptionStatus || 'undefined'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Plan:</span>
                                                    <span className="text-white">{user?.subscription || 'undefined'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">isPro Result:</span>
                                                    <span className={isPro(user) ? 'text-emerald-400' : 'text-rose-400'}>{isPro(user) ? 'TRUE' : 'FALSE'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-black/40 rounded-xl border border-white/5 font-mono text-[9px] text-slate-400 break-all">
                                        UID: {user?.id}
                                    </div>
                                    <div className="flex gap-4">
                                        <button 
                                            onClick={() => {
                                                console.log("Full User Object:", user);
                                                toast.info("Full user object logged to console");
                                            }}
                                            className="text-[9px] font-black uppercase tracking-widest text-amber-500 hover:text-amber-400 transition-colors"
                                        >
                                            Log Full User Object
                                        </button>
                                        <button 
                                            onClick={async () => {
                                                try {
                                                    const response = await fetch(`${API_BASE}/api/health`);
                                                    const data = await response.json();
                                                    console.log("Health Check Result:", data);
                                                    toast.info("Health check result logged to console");
                                                } catch (e) {
                                                    console.error("Health check failed:", e);
                                                    toast.error("Health check failed");
                                                }
                                            }}
                                            className="text-[9px] font-black uppercase tracking-widest text-amber-500 hover:text-amber-400 transition-colors"
                                        >
                                            Run Health Check
                                        </button>
                                        <button 
                                            onClick={async () => {
                                                if (!user?.id) return toast.error("No user ID found");
                                                try {
                                                    const response = await fetch(`${API_BASE}/api/test-checkout-success`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ userId: user.id })
                                                    });
                                                    const data = await response.json();
                                                    if (data.success) {
                                                        toast.success("Mock update successful! Refreshing...");
                                                        setTimeout(() => window.location.reload(), 2000);
                                                    } else {
                                                        throw new Error(data.error || "Unknown error");
                                                    }
                                                } catch (e: any) {
                                                    console.error("Mock update failed:", e);
                                                    toast.error(`Mock update failed: ${e.message}`);
                                                }
                                            }}
                                            className="text-[9px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-400 transition-colors"
                                        >
                                            Test Mock Success
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-8">Security Settings</h3>
                            <div className="space-y-4">
                                <button 
                                    onClick={handlePasswordReset}
                                    disabled={isLoading}
                                    className="w-full flex items-center justify-between p-6 bg-slate-950 border border-white/5 rounded-3xl hover:bg-white/5 transition-all group text-left disabled:opacity-50"
                                >
                                    <div>
                                        <h4 className="text-sm font-black text-white uppercase tracking-wider mb-1">Change Password</h4>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Send a password reset email to your inbox</p>
                                    </div>
                                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-white transition-all">→</div>
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'contact' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Contact Support</h3>
                            <p className="text-sm text-slate-400 mb-8">Have a question or need help? Send us a message or email us directly at <a href="mailto:info@rfsuite.net" className="text-indigo-400 hover:text-indigo-300 transition-colors">info@rfsuite.net</a>.</p>
                            <ContactForm />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AccountDashboard;
