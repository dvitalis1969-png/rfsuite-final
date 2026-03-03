import React, { useState, useMemo } from 'react';
import { WMASState, WMASNode, WMASProfile, WMASMode, TVChannelState, ScanDataPoint } from '../types';
import Card from './Card';
import { getTVChannels } from '../utils/tvDatabase';
import { Trash2, Plus, Zap, Activity, Shield, AlertTriangle } from 'lucide-react';
import { WMAS_PRESET_PROFILES } from '../constants';

interface WMASTabProps {
    state: WMASState;
    setState: React.Dispatch<React.SetStateAction<WMASState>>;
    tvChannelStates?: Record<number, TVChannelState>;
    scanData?: ScanDataPoint[] | null;
}

const PRESET_PROFILES: WMASProfile[] = WMAS_PRESET_PROFILES;

const WMASTab: React.FC<WMASTabProps> = ({ state, setState, tvChannelStates = {}, scanData }) => {
    const [selectedChannel, setSelectedChannel] = useState<number | ''>('');

    const addNode = () => {
        const newNode: WMASNode = {
            id: `wmas-${Date.now()}`,
            name: `WMAS Node ${state.nodes.length + 1}`,
            profileId: PRESET_PROFILES[0].id,
            mode: 'standard',
            linksRequired: 16
        };
        setState(prev => ({ ...prev, nodes: [...prev.nodes, newNode] }));
    };

    const updateNode = (id: string, updates: Partial<WMASNode>) => {
        setState(prev => ({
            ...prev,
            nodes: prev.nodes.map(n => n.id === id ? { ...n, ...updates } : n)
        }));
    };

    const removeNode = (id: string) => {
        setState(prev => ({
            ...prev,
            nodes: prev.nodes.filter(n => n.id !== id)
        }));
    };

    const autoAssignBlocks = () => {
        const channels = getTVChannels(state.tvRegion);
        let assignedNodes = [...state.nodes];
        
        let channelIndex = 0;
        
        assignedNodes = assignedNodes.map(node => {
            const profile = PRESET_PROFILES.find(p => p.id === node.profileId);
            if (!profile) return node;

            while (channelIndex < channels.length) {
                const ch = channels[channelIndex];
                const chBandwidth = ch.end - ch.start;
                
                // Check if channel is blocked by user
                const isBlocked = tvChannelStates[ch.channel] === 'blocked';
                
                // Check scan data for high noise floor in this channel
                let hasInterference = false;
                if (scanData && scanData.length > 0) {
                    const pointsInChannel = scanData.filter(p => p.freq >= ch.start && p.freq <= ch.end);
                    if (pointsInChannel.length > 0) {
                        const maxAmp = Math.max(...pointsInChannel.map(p => p.amp));
                        if (maxAmp > -85) { // Threshold for interference
                            hasInterference = true;
                        }
                    }
                }
                
                if (chBandwidth >= profile.bandwidthMHz && !isBlocked && !hasInterference) {
                    channelIndex++;
                    return {
                        ...node,
                        assignedBlock: {
                            start: ch.start,
                            end: ch.start + profile.bandwidthMHz,
                            tvChannel: ch.channel
                        }
                    };
                }
                channelIndex++;
            }
            return node;
        });

        setState(prev => ({ ...prev, nodes: assignedNodes }));
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-wider">WMAS Coordination</h2>
                    <p className="text-slate-400 text-sm mt-1">Plan wideband blocks for Wireless Multichannel Audio Systems</p>
                </div>
                <div className="flex gap-3">
                    <select
                        value={state.tvRegion}
                        onChange={(e) => setState(prev => ({ ...prev, tvRegion: e.target.value as 'uk' | 'us' }))}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none"
                    >
                        <option value="uk">UK (8 MHz)</option>
                        <option value="us">US (6 MHz)</option>
                    </select>
                    <button
                        onClick={autoAssignBlocks}
                        className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 border border-slate-700"
                    >
                        <Zap size={16} className="text-yellow-400" />
                        Auto-Assign Blocks
                    </button>
                    <button
                        onClick={addNode}
                        className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                    >
                        <Plus size={16} />
                        Add WMAS Node
                    </button>
                </div>
            </div>

            <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-4 flex items-start gap-4">
                <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-400">
                    <Activity size={20} />
                </div>
                <div>
                    <h4 className="text-sm font-bold text-indigo-300 uppercase tracking-wider mb-1">Integration Logic</h4>
                    <p className="text-xs text-indigo-200/80 leading-relaxed">
                        WMAS Blocks configured as <strong>House Systems</strong> act as <strong>Global Exclusions</strong>. 
                        <strong>Act Specific</strong> blocks are only treated as exclusions during their assigned <strong>Time Slots</strong>.
                        <br/><br/>
                        When you calculate frequencies in the <strong>Festival Planner</strong>, the engine will automatically 
                        protect these wideband blocks from narrowband interference based on the festival timeline.
                    </p>
                </div>
            </div>

            {state.nodes.length === 0 ? (
                <div className="text-center py-16 bg-slate-900/50 border border-slate-800 rounded-2xl">
                    <Activity size={48} className="mx-auto text-slate-600 mb-4" />
                    <h3 className="text-xl font-bold text-slate-300 mb-2">No WMAS Nodes Configured</h3>
                    <p className="text-slate-500 max-w-md mx-auto mb-6">
                        Add a Wireless Multichannel Audio System node to allocate a wideband block and calculate link capacity.
                    </p>
                    <button
                        onClick={addNode}
                        className="bg-rose-600 hover:bg-rose-500 text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors inline-flex items-center gap-2 shadow-lg shadow-rose-900/20"
                    >
                        <Plus size={18} />
                        Add First Node
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {state.nodes.map(node => {
                        const profile = PRESET_PROFILES.find(p => p.id === node.profileId);
                        const maxLinks = profile ? profile.maxLinks[node.mode] : 0;
                        const utilization = maxLinks > 0 ? (node.linksRequired / maxLinks) * 100 : 0;
                        const isOverloaded = utilization > 100;

                        return (
                            <Card key={node.id} className="border-slate-800 bg-slate-900/80">
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <input
                                            type="text"
                                            value={node.name}
                                            onChange={(e) => updateNode(node.id, { name: e.target.value })}
                                            className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-rose-500 text-lg font-bold text-white px-1 py-0.5 outline-none transition-colors"
                                        />
                                        <button
                                            onClick={() => removeNode(node.id)}
                                            className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="col-span-2">
                                            <div className="flex items-center gap-4 p-3 bg-slate-950 rounded-xl border border-slate-800">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        checked={node.isHouseSystem !== false}
                                                        onChange={() => updateNode(node.id, { isHouseSystem: true })}
                                                        className="w-4 h-4 accent-rose-500"
                                                    />
                                                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">House System (Global)</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        checked={node.isHouseSystem === false}
                                                        onChange={() => updateNode(node.id, { isHouseSystem: false })}
                                                        className="w-4 h-4 accent-rose-500"
                                                    />
                                                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Act Specific</span>
                                                </label>
                                            </div>
                                        </div>

                                        {node.isHouseSystem === false && (
                                            <>
                                                <div className="col-span-1">
                                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Act Name</label>
                                                    <input
                                                        type="text"
                                                        value={node.actName || ''}
                                                        onChange={(e) => updateNode(node.id, { actName: e.target.value })}
                                                        placeholder="Artist Name"
                                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-rose-500 outline-none"
                                                    />
                                                </div>
                                                <div className="col-span-1">
                                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Stage / Zone</label>
                                                    <input
                                                        type="text"
                                                        value={node.stage || ''}
                                                        onChange={(e) => updateNode(node.id, { stage: e.target.value })}
                                                        placeholder="Main Stage"
                                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-rose-500 outline-none"
                                                    />
                                                </div>
                                                <div className="col-span-1">
                                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Start Time</label>
                                                    <input
                                                        type="datetime-local"
                                                        value={node.startTime ? new Date(node.startTime.getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                                                        onChange={(e) => updateNode(node.id, { startTime: new Date(e.target.value) })}
                                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-rose-500 outline-none font-mono"
                                                    />
                                                </div>
                                                <div className="col-span-1">
                                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">End Time</label>
                                                    <input
                                                        type="datetime-local"
                                                        value={node.endTime ? new Date(node.endTime.getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                                                        onChange={(e) => updateNode(node.id, { endTime: new Date(e.target.value) })}
                                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-rose-500 outline-none font-mono"
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">System Profile</label>
                                            <select
                                                value={node.profileId}
                                                onChange={(e) => updateNode(node.id, { profileId: e.target.value })}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:border-rose-500 outline-none"
                                            >
                                                {PRESET_PROFILES.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Latency Mode</label>
                                            <select
                                                value={node.mode}
                                                onChange={(e) => updateNode(node.id, { mode: e.target.value as WMASMode })}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:border-rose-500 outline-none"
                                            >
                                                <option value="low-latency">Low Latency (IEMs)</option>
                                                <option value="standard">Standard (Mics)</option>
                                                <option value="high-density">High Density</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 mb-6">
                                        <div className="flex justify-between items-end mb-2">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Required Links</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={node.linksRequired}
                                                    onChange={(e) => updateNode(node.id, { linksRequired: parseInt(e.target.value) || 0 })}
                                                    className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono focus:border-rose-500 outline-none"
                                                />
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Capacity</div>
                                                <div className={`text-lg font-mono font-bold ${isOverloaded ? 'text-red-400' : 'text-emerald-400'}`}>
                                                    {node.linksRequired} / {maxLinks}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden mt-3">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-500 ${isOverloaded ? 'bg-red-500' : utilization > 80 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                                                style={{ width: `${Math.min(utilization, 100)}%` }}
                                            />
                                        </div>
                                        {isOverloaded && (
                                            <div className="flex items-center gap-1.5 mt-2 text-red-400 text-xs font-medium">
                                                <AlertTriangle size={12} />
                                                Exceeds block capacity. Add another node or change mode.
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">RF Block Allocation</label>
                                        {node.assignedBlock ? (
                                            <div className="flex items-center justify-between bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400">
                                                        <Shield size={16} />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-white">
                                                            {node.assignedBlock.start.toFixed(3)} - {node.assignedBlock.end.toFixed(3)} MHz
                                                        </div>
                                                        <div className="text-xs text-rose-400 font-medium">
                                                            {node.assignedBlock.tvChannel ? `TV Channel ${node.assignedBlock.tvChannel}` : 'Custom Block'} ({profile?.bandwidthMHz} MHz)
                                                        </div>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => updateNode(node.id, { assignedBlock: undefined })}
                                                    className="text-xs font-bold text-slate-400 hover:text-white uppercase tracking-wider px-2 py-1"
                                                >
                                                    Clear
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex gap-2">
                                                <select
                                                    value={selectedChannel}
                                                    onChange={(e) => setSelectedChannel(e.target.value ? parseInt(e.target.value) : '')}
                                                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:border-rose-500 outline-none"
                                                >
                                                    <option value="">Select TV Channel...</option>
                                                    {getTVChannels(state.tvRegion).map(ch => (
                                                        <option key={ch.channel} value={ch.channel}>
                                                            CH {ch.channel} ({ch.start}-{ch.end} MHz)
                                                        </option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => {
                                                        if (selectedChannel === '') return;
                                                        const ch = getTVChannels(state.tvRegion).find(c => c.channel === selectedChannel);
                                                        if (ch) {
                                                            updateNode(node.id, {
                                                                assignedBlock: {
                                                                    start: ch.start,
                                                                    end: ch.start + (profile?.bandwidthMHz || 8),
                                                                    tvChannel: ch.channel
                                                                }
                                                            });
                                                            setSelectedChannel('');
                                                        }
                                                    }}
                                                    disabled={selectedChannel === ''}
                                                    className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                                                >
                                                    Assign
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default WMASTab;
