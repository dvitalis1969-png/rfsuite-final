import React from 'react';
import { TabID, AppCategory } from '../types';

interface TabsProps {
    activeTab: TabID;
    setActiveTab: (tab: TabID) => void;
    activeApp: AppCategory | null;
}

export const tabConfig: { id: TabID; label: string; category: AppCategory }[] = [
    // Calculator App
    { id: 'analyzer', label: 'Frequency Analyzer', category: 'calculator' },
    { id: 'generator', label: 'Batch Generator', category: 'calculator' },
    { id: 'multiband', label: 'Multi-Band', category: 'calculator' },
    { id: 'whitespace', label: 'TV Channels', category: 'calculator' },
    
    // Equipment Library
    { id: 'equipmentDatabase', label: 'Parameters', category: 'hardware' },

    // Coordination App (Festival)
    { id: 'festival', label: 'Site Coordinator', category: 'coordination' },
    { id: 'timeline', label: 'Timeline', category: 'coordination' },
    { id: 'festivalSiteMap', label: 'Spatial Map', category: 'coordination' },
    
    // Exhibition Planner (Multizone)
    { id: 'multizone', label: 'Booth Ledger', category: 'multizone' },
    { id: 'multizoneSiteMap', label: 'Floor Plan', category: 'multizone' },
    
    // Analysis App
    { id: 'spectrum', label: 'Analyzer', category: 'analysis' },
    { id: 'waterfall', label: 'Waterfall', category: 'analysis' },
    
    // Comms App
    { id: 'talkback', label: 'Talkback', category: 'comms' },
    { id: 'zonalTalkback', label: 'Zonal Talkback', category: 'comms' },

    // Toolkit App
    { id: 'iemStudy', label: 'Proximity Simulator', category: 'toolkit' },
    { id: 'interference', label: 'Co-Channel Lab', category: 'toolkit' },
    { id: 'imdDemo', label: 'IMD Physics', category: 'toolkit' },
    { id: 'diversityPlacement', label: 'Diversity', category: 'toolkit' },
    { id: 'linkBudget', label: 'Link Budget', category: 'toolkit' },
    { id: 'antennaDownTilt', label: 'Tilt Angle', category: 'toolkit' },
    { id: 'cableLoss', label: 'Cable Loss', category: 'toolkit' },
    { id: 'lineOfSight', label: 'LOS Calc', category: 'toolkit' },
    { id: 'vswr', label: 'VSWR', category: 'toolkit' },

    // Tour Planning App
    { id: 'tourPlanning', label: 'Tour Planning', category: 'tour' },

    // WMAS App
    { id: 'wmas', label: 'WMAS Coordination', category: 'wmas' },
];

const Tabs: React.FC<TabsProps> = ({ activeTab, setActiveTab, activeApp }) => {
    // Dynamically add a "How To Use" tab to the end of every category
    const visibleTabs = activeApp 
        ? [...tabConfig.filter(t => t.category === activeApp), { id: 'userGuide' as TabID, label: 'How To Use', category: activeApp }] 
        : tabConfig;

    return (
        <div className="flex bg-slate-950/60 backdrop-blur-2xl border border-white/10 rounded-2xl p-1.5 gap-1 shadow-2xl overflow-x-auto scrollbar-hide">
            {visibleTabs.map(({ id, label, category }, idx) => (
                <button
                    key={`${id}-${category}-${idx}`}
                    onClick={() => setActiveTab(id)}
                    className={`
                        flex-shrink-0 px-4 py-2.5 text-[10px] font-black rounded-xl transition-all duration-300 
                        uppercase tracking-widest focus:outline-none whitespace-nowrap border
                        ${
                            activeTab === id
                                ? (id === 'userGuide' ? 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]')
                                : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'
                        }
                        ${id === 'userGuide' ? '!text-emerald-400 hover:!text-emerald-200' : ''}
                    `}
                >
                    {label}
                </button>
            ))}
        </div>
    );
};

export default Tabs;