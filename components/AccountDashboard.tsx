import React, { useState } from 'react';
import { User, CreditCard, Shield, LogOut, X, Check, Clock, Calendar, Zap } from 'lucide-react';

interface AccountDashboardProps {
    user: any;
    onClose: () => void;
    onLogout: () => void;
    onUpgrade: (tier: string) => void;
}

const AccountDashboard: React.FC<AccountDashboardProps> = ({ user, onClose, onLogout, onUpgrade }) => {
    const [activeTab, setActiveTab] = useState<'profile' | 'billing' | 'security'>('profile');

    const tiers = [
        { id: '48h', name: '48 Hour Pass', price: '$4.99', icon: <Clock className="w-5 h-5" />, desc: 'Single Event Access' },
        { id: '7d', name: '7 Day Pass', price: '$10.99', icon: <Calendar className="w-5 h-5" />, desc: 'Festival Week Access' },
        { id: '1mo', name: '1 Month Pro', price: '$24.99', icon: <Zap className="w-5 h-5" />, desc: 'Continuous Professional Use' }
    ];

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
                            { id: 'billing', label: 'Subscription', icon: <CreditCard className="w-4 h-4" /> },
                            { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> }
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
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-black text-white uppercase tracking-wider">{user.name}</h4>
                                        <p className="text-slate-500 text-sm font-medium">{user.email}</p>
                                        <div className="mt-2 inline-block px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                                            {user.subscription === 'none' ? 'Free Tier' : `${user.subscription} Member`}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-6 bg-slate-950 border border-white/5 rounded-3xl">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Member Since</p>
                                        <p className="text-white font-bold">March 2024</p>
                                    </div>
                                    <div className="p-6 bg-slate-950 border border-white/5 rounded-3xl">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Projects Created</p>
                                        <p className="text-white font-bold">12 Active Plots</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'billing' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-8">Subscription Plans</h3>
                            
                            {user.subscription !== 'none' && (
                                <div className="mb-10 p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-xl text-white shadow-lg">✓</div>
                                        <div>
                                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Active Plan</p>
                                            <h4 className="text-lg font-black text-white uppercase tracking-wider">{user.subscription}</h4>
                                        </div>
                                    </div>
                                    <button className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all">
                                        Cancel Plan
                                    </button>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {tiers.map(tier => (
                                    <div key={tier.id} className="p-6 bg-slate-950 border border-white/5 rounded-3xl flex flex-col h-full hover:border-indigo-500/30 transition-all group">
                                        <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-slate-400 mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                            {tier.icon}
                                        </div>
                                        <h4 className="text-sm font-black text-white uppercase tracking-wider mb-1">{tier.name}</h4>
                                        <p className="text-2xl font-black text-white mb-4">{tier.price}</p>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-6 flex-grow">{tier.desc}</p>
                                        <button 
                                            onClick={() => onUpgrade(tier.name)}
                                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-[9px] rounded-xl transition-all"
                                        >
                                            Upgrade
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-8">Security Settings</h3>
                            <div className="space-y-4">
                                <button className="w-full flex items-center justify-between p-6 bg-slate-950 border border-white/5 rounded-3xl hover:bg-white/5 transition-all group text-left">
                                    <div>
                                        <h4 className="text-sm font-black text-white uppercase tracking-wider mb-1">Change Password</h4>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Update your account credentials</p>
                                    </div>
                                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-white transition-all">→</div>
                                </button>
                                <button className="w-full flex items-center justify-between p-6 bg-slate-950 border border-white/5 rounded-3xl hover:bg-white/5 transition-all group text-left">
                                    <div>
                                        <h4 className="text-sm font-black text-white uppercase tracking-wider mb-1">Two-Factor Auth</h4>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Add an extra layer of security</p>
                                    </div>
                                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-white transition-all">→</div>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AccountDashboard;
