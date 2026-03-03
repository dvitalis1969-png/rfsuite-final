import React from 'react';
import { AppCategory } from '../types';

interface AppLauncherProps {
    onSelectApp: (app: AppCategory) => void;
}

const AppCard: React.FC<{ 
    title: string; 
    description: string; 
    icon: React.ReactNode; 
    onClick: () => void;
    colorClass: string;
    borderClass: string;
}> = ({ title, description, icon, onClick, colorClass, borderClass }) => (
    <button 
        onClick={onClick}
        className={`group relative overflow-hidden p-8 rounded-3xl border border-white/10 bg-slate-900/40 hover:bg-slate-900 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_40px_100px_rgba(0,0,0,0.6)] text-left w-full h-full flex flex-col`}
    >
        <div className={`absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full blur-[80px] opacity-20 group-hover:opacity-40 transition-opacity duration-700 ${colorClass}`}></div>
        
        <div className={`p-4 w-fit rounded-2xl mb-6 bg-slate-950 border ${borderClass} group-hover:scale-110 transition-transform duration-500 ${colorClass.replace('bg-', 'text-')}`}>
            {icon}
        </div>
        
        <h3 className="text-xl font-black text-white mb-3 uppercase tracking-wider group-hover:text-indigo-400 transition-colors">{title}</h3>
        <p className="text-sm text-slate-500 font-medium leading-relaxed group-hover:text-slate-300 transition-colors">{description}</p>
        
        <div className="mt-auto pt-8 flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 group-hover:text-indigo-400 transition-colors">
            Initialize Module <span className="ml-2 text-lg leading-none transform group-hover:translate-x-2 transition-transform">&rarr;</span>
        </div>
    </button>
);

const AppLauncher: React.FC<AppLauncherProps> = ({ onSelectApp }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[85vh] p-4">
            <div className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-1000">
                <div className="inline-block px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[10px] font-black uppercase tracking-[0.4em] mb-4">
                    Authoritative RF Intelligence
                </div>
                <h2 className="text-5xl md:text-6xl font-black text-white mb-6 tracking-tighter">
                    Select Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Workspace</span>
                </h2>
                <p className="text-slate-500 text-lg max-w-2xl mx-auto font-medium">
                    A high-precision coordination ecosystem for wireless professionals.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 max-w-7xl w-full">
                <AppCard 
                    title="RF Calculator" 
                    description="Standard coordination engine for intermod analysis and manual frequency entry."
                    colorClass="bg-indigo-500"
                    borderClass="border-indigo-500/20"
                    onClick={() => onSelectApp('calculator')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
                />
                <AppCard 
                    title="Festival Coordinator" 
                    description="Multi-stage artist management with time-aware frequency reuse and site diagrams."
                    colorClass="bg-fuchsia-500"
                    borderClass="border-fuchsia-500/20"
                    onClick={() => onSelectApp('coordination')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
                />
                <AppCard 
                    title="Real-Time Analysis" 
                    description="High-fidelity spectral visualization, waterfall displays, and scan data processing."
                    colorClass="bg-cyan-500"
                    borderClass="border-cyan-500/20"
                    onClick={() => onSelectApp('analysis')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>}
                />
                <AppCard 
                    title="Exhibition Planner" 
                    description="Booth-level hardware deployment for trade shows and multi-zone installations."
                    colorClass="bg-purple-500"
                    borderClass="border-purple-500/20"
                    onClick={() => onSelectApp('multizone')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
                />
                <AppCard 
                    title="Comms & Intercom" 
                    description="Discrete duplex pair calculation and high-power talkback IMD modelling."
                    colorClass="bg-emerald-500"
                    borderClass="border-emerald-500/20"
                    onClick={() => onSelectApp('comms')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>}
                />
                <AppCard 
                    title="Equipment Library" 
                    description="Define hardware tuning ranges and global intermodulation spacing rules for your inventory."
                    colorClass="bg-amber-500"
                    borderClass="border-amber-500/20"
                    onClick={() => onSelectApp('hardware')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2M7 11V7a2 2 0 012-2h6a2 2 0 012 2v4M9 19v-1h6v1" /></svg>}
                />
                <AppCard 
                    title="Tour Planning" 
                    description="Coordinate fixed equipment racks across multiple locations with local TV white space awareness."
                    colorClass="bg-blue-500"
                    borderClass="border-blue-500/20"
                    onClick={() => onSelectApp('tour')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-2 1 2-1zm3.968-3.047a10.031 10.031 0 01-4.477 2.548 4.885 4.885 0 00-1.513.658l-2.096 1.048a.51.51 0 01-.689-.23.51.51 0 01.23-.69l2.103-1.052a5.086 5.086 0 011.578-.68 9.037 9.037 0 004.42-2.513 4.666 4.666 0 00.614-2.75 4.35 4.35 0 00-.773-2.545 5.59 5.05 0 01-.512-1.88A3.993 3.993 0 0112 3a3.993 3.993 0 013.726 2.348c.19.456.365.923.512 1.88.316.817.58 1.673.773 2.545.193.87.205 1.794-.614 2.75a9.037 9.037 0 00-4.42 2.513 5.086 5.086 0 01-1.578.68l-2.103 1.052a.51.51 0 01-.69-.23.51.51 0 01.23-.689l2.096-1.048a4.885 4.885 0 001.513-.658 10.031 10.031 0 014.477-2.548" /></svg>}
                />
                <AppCard 
                    title="WMAS Coordination" 
                    description="Plan and allocate wideband blocks for Wireless Multichannel Audio Systems."
                    colorClass="bg-rose-500"
                    borderClass="border-rose-500/20"
                    onClick={() => onSelectApp('wmas')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                />
                <AppCard 
                    title="RF Toolkit" 
                    description="Calculators for path loss, Fresnel zones, cable attenuation, and antenna placement."
                    colorClass="bg-slate-500"
                    borderClass="border-slate-500/20"
                    onClick={() => onSelectApp('toolkit')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg>}
                />
            </div>
            
            <div className="mt-16 text-slate-600 text-[10px] font-black uppercase tracking-[0.4em] flex gap-10">
                <span>V2.5.0 STABLE</span>
                <span>COORD ENGINE X64</span>
                <span>&copy; 2024</span>
            </div>
        </div>
    );
};

export default AppLauncher;