import React, { useState, useEffect, useRef } from 'react';
import { AppCategory } from '../types';

interface HeaderProps {
    projectName?: string;
    onManageProjects: () => void;
    onSaveProject: () => void;
    onExportProject: () => void;
    activeApp: AppCategory | null;
    onGoHome: () => void;
    isSunlightMode?: boolean;
    toggleSunlightMode?: () => void;
    isSaving?: boolean;
    isSaved?: boolean;
    onLogout?: () => void;
    user?: any;
    onOpenAccount?: () => void;
}

const appLabels: Record<AppCategory, string> = {
    calculator: 'RF Calculator',
    coordination: 'Festival Planner',
    analysis: 'Live Analysis',
    comms: 'Comms/Intercom',
    toolkit: 'RF Toolkit',
    multizone: 'Exhibition Planner',
    tour: 'Tour Planning',
    hardware: 'Equipment Library',
    wmas: 'WMAS Coordination'
};

const Header: React.FC<HeaderProps> = ({ 
    projectName, 
    onManageProjects, 
    onSaveProject, 
    onExportProject, 
    activeApp, 
    onGoHome, 
    isSunlightMode, 
    toggleSunlightMode,
    isSaving = false,
    isSaved = false,
    onLogout,
    user,
    onOpenAccount
}) => {
    const [installPrompt, setInstallPrompt] = useState<any>(null);
    const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        const handler = (e: any) => {
            e.preventDefault();
            setInstallPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsProjectMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('beforeinstallprompt', handler);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleInstall = () => {
        if (installPrompt) {
            installPrompt.prompt();
            installPrompt.userChoice.then((choiceResult: any) => {
                if (choiceResult.outcome === 'accepted') {
                    setInstallPrompt(null);
                }
            });
        }
    };

    return (
        <header className="bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-2xl mb-4 text-white p-4 flex flex-col md:flex-row items-center justify-between shadow-2xl relative z-50">
            <div className="flex items-center gap-5 mb-4 md:mb-0">
                {activeApp && (
                    <button 
                        onClick={onGoHome}
                        className="p-2.5 rounded-xl bg-slate-900 border border-white/10 text-slate-400 hover:text-white hover:border-indigo-500/50 transition-all group"
                        title="Return to App Launcher"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                    </button>
                )}
                <div className="text-left">
                    <div className="flex items-center gap-3">
                        <h1 className="text-lg font-black uppercase tracking-[0.3em] text-white">
                            {activeApp ? appLabels[activeApp] : 'RF Suite'}
                        </h1>
                        {!activeApp && <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-[9px] font-black border border-indigo-500/30 tracking-widest">PRO</span>}
                    </div>
                    {projectName && (
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                            Plot: <span className="text-indigo-400">{projectName}</span>
                        </p>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="flex gap-2 mr-3 border-r border-white/5 pr-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-white/5">
                        <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse'}`} />
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                            {isOnline ? 'Online' : 'Offline'}
                        </span>
                    </div>
                    {toggleSunlightMode && (
                        <button 
                            onClick={toggleSunlightMode}
                            className={`p-2 rounded-xl transition-all border ${isSunlightMode ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'bg-slate-900 border-white/10 text-slate-500 hover:text-white'}`}
                            title={isSunlightMode ? "Dark Mode" : "Sunlight Mode"}
                        >
                            {isSunlightMode ? '🌙' : '☀️'}
                        </button>
                    )}
                    {installPrompt && (
                        <button onClick={handleInstall} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-xl hover:bg-emerald-500 hover:text-white transition-all">
                            Install
                        </button>
                    )}
                </div>

                <div className="relative" ref={menuRef}>
                    <div className="flex items-center gap-2">
                        {user && (
                            <button 
                                onClick={onOpenAccount}
                                className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-slate-300 hover:border-indigo-500/50 hover:text-white transition-all group"
                            >
                                <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-lg flex items-center justify-center text-[10px] font-black text-white shadow-lg group-hover:scale-110 transition-transform">
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest hidden lg:block">{user.name}</span>
                            </button>
                        )}
                        <button 
                            onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
                            className={`flex items-center gap-3 px-5 py-2.5 rounded-xl font-black uppercase tracking-[0.15em] text-[10px] transition-all border ${
                                isProjectMenuOpen 
                                ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]' 
                                : 'bg-slate-900 border-white/10 text-slate-300 hover:border-indigo-500/50 hover:text-white'
                            }`}
                        >
                            <span>📁</span> Project
                            <svg className={`w-3 h-3 transition-transform duration-300 ${isProjectMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>

                    {isProjectMenuOpen && (
                        <div className="absolute top-full right-0 mt-3 w-64 bg-slate-950/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_40px_120px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
                            <div className="p-2 space-y-1">
                                <button 
                                    onClick={() => { onManageProjects(); setIsProjectMenuOpen(false); }}
                                    className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all text-left group"
                                >
                                    <div className="w-9 h-9 bg-slate-900 border border-white/5 rounded-lg flex items-center justify-center text-lg group-hover:scale-110 transition-transform">📂</div>
                                    <div>
                                        <p className="font-bold text-[11px] text-white uppercase tracking-wider">Dashboard</p>
                                        <p className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">Switch Project</p>
                                    </div>
                                </button>

                                <div className="h-px bg-white/5 mx-2 my-1" />

                                <button 
                                    onClick={() => { onSaveProject(); setIsProjectMenuOpen(false); }}
                                    disabled={isSaving}
                                    className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all text-left group disabled:opacity-50"
                                >
                                    <div className={`w-9 h-9 rounded-lg border flex items-center justify-center text-lg transition-all ${isSaved ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-slate-900 border-white/5 group-hover:scale-110'}`}>
                                        {isSaving ? '⏳' : (isSaved ? '✅' : '💾')}
                                    </div>
                                    <div>
                                        <p className="font-bold text-[11px] text-white uppercase tracking-wider">Persist</p>
                                        <p className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">Save To Browser</p>
                                    </div>
                                </button>

                                <button 
                                    onClick={() => { onExportProject(); setIsProjectMenuOpen(false); }}
                                    className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all text-left group"
                                >
                                    <div className="w-9 h-9 bg-slate-900 border border-white/5 rounded-lg flex items-center justify-center text-lg group-hover:scale-110 transition-transform">📥</div>
                                    <div>
                                        <p className="font-bold text-[11px] text-white uppercase tracking-wider">Download</p>
                                        <p className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">Export .rfproject</p>
                                    </div>
                                </button>

                                <a 
                                    href="/api/backup-code"
                                    download="RF_Suite_Source_Code.zip"
                                    onClick={() => setIsProjectMenuOpen(false)}
                                    className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all text-left group"
                                >
                                    <div className="w-9 h-9 bg-slate-900 border border-white/5 rounded-lg flex items-center justify-center text-lg group-hover:scale-110 transition-transform">⚡</div>
                                    <div>
                                        <p className="font-bold text-[11px] text-white uppercase tracking-wider">Source Code</p>
                                        <p className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">Download ZIP</p>
                                    </div>
                                </a>

                                <a 
                                    href="/api/backup-json"
                                    target="_blank"
                                    onClick={() => setIsProjectMenuOpen(false)}
                                    className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all text-left group"
                                >
                                    <div className="w-9 h-9 bg-slate-900 border border-white/5 rounded-lg flex items-center justify-center text-lg group-hover:scale-110 transition-transform">📄</div>
                                    <div>
                                        <p className="font-bold text-[11px] text-white uppercase tracking-wider">JSON Backup</p>
                                        <p className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">Fail-safe Text Copy</p>
                                    </div>
                                </a>

                                {onLogout && (
                                    <>
                                        <div className="h-px bg-white/5 mx-2 my-1" />
                                        <button 
                                            onClick={() => { onLogout(); setIsProjectMenuOpen(false); }}
                                            className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-red-500/10 transition-all text-left group"
                                        >
                                            <div className="w-9 h-9 bg-slate-900 border border-white/5 rounded-lg flex items-center justify-center text-lg group-hover:scale-110 transition-transform text-red-400">🚪</div>
                                            <div>
                                                <p className="font-bold text-[11px] text-red-400 uppercase tracking-wider">Sign Out</p>
                                                <p className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">Back to Website</p>
                                            </div>
                                        </button>
                                    </>
                                )}
                            </div>
                            
                            <div className="bg-white/5 p-2.5 flex items-center justify-between">
                                <span className="text-[8px] text-slate-600 font-black uppercase tracking-widest">Active State</span>
                                <div className={`w-1.5 h-1.5 rounded-full ${isSaved ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;