import React, { useState, useMemo } from 'react';
import Card, { CardTitle } from './Card';
import { EquipmentProfile, Thresholds } from '../types';
import { EQUIPMENT_DATABASE, USER_INVENTORY } from '../constants';

interface EquipmentDatabaseTabProps {
    customEquipment: EquipmentProfile[];
    overrides: Record<string, Partial<Thresholds>>;
    setOverrides: React.Dispatch<React.SetStateAction<Record<string, Partial<Thresholds>>>>;
    onManageCustomEquipment: () => void;
}

const buttonBase = "px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider transition-all duration-200 focus:outline-none text-[10px]";
const primaryButton = `bg-blue-600 text-white hover:bg-blue-500 ${buttonBase}`;
const secondaryButton = `bg-slate-700 text-slate-200 hover:bg-slate-600 ${buttonBase}`;
const dangerButton = `bg-red-600/80 text-white hover:bg-red-500 ${buttonBase}`;

const EquipmentDatabaseTab: React.FC<EquipmentDatabaseTabProps> = ({ customEquipment, overrides, setOverrides, onManageCustomEquipment }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [bulkOffset, setBulkOffset] = useState<string>("0.025");

    const allProfiles = useMemo(() => {
        const standard = Object.entries(EQUIPMENT_DATABASE).map(([key, profile]) => ({ 
            ...profile, 
            id: key, 
            isStandard: true,
            isUserHardcoded: Object.keys(USER_INVENTORY).includes(key)
        }));
        const custom = customEquipment.map(p => ({ ...p, isStandard: false, isUserHardcoded: false }));
        return [...standard, ...custom].filter(p => 
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            p.band.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [customEquipment, searchTerm]);

    const handleValueChange = (key: string, field: keyof Thresholds, value: string) => {
        const numVal = parseFloat(value);
        setOverrides(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] || {}),
                [field]: isNaN(numVal) ? undefined : numVal
            }
        }));
    };

    const resetOverride = (key: string) => {
        setOverrides(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const toggleSelect = (key: string) => {
        setSelectedKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const selectAll = () => setSelectedKeys(new Set(allProfiles.map(p => p.id!)));
    const deselectAll = () => setSelectedKeys(new Set());

    const applyBulkOffset = (field: keyof Thresholds, mode: 'add' | 'set') => {
        const val = parseFloat(bulkOffset) || 0;
        setOverrides(prev => {
            const next = { ...prev };
            selectedKeys.forEach(key => {
                const profile = allProfiles.find(p => p.id === key);
                if (!profile) return;
                
                const currentVal = next[key]?.[field] ?? profile.recommendedThresholds?.[field] ?? 0;
                const newVal = mode === 'add' ? currentVal + val : val;
                
                next[key] = {
                    ...(next[key] || {}),
                    [field]: parseFloat(newVal.toFixed(3))
                };
            });
            return next;
        });
    };

    return (
        <div className="space-y-6">
            <Card>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-slate-700 pb-6">
                    <div>
                        <CardTitle className="!mb-0">⚙️ Global Hardware Library</CardTitle>
                        <p className="text-slate-400 text-xs mt-1">Manage tuning ranges and permanent intermodulation rules.</p>
                    </div>
                    <div className="flex gap-4 items-center">
                        <button 
                            onClick={onManageCustomEquipment}
                            className="bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-4 py-2 rounded-lg text-xs font-bold uppercase hover:bg-indigo-600 hover:text-white transition-all"
                        >
                            + Device Manager
                        </button>
                        <div className="w-full md:w-80">
                            <input 
                                type="text" 
                                placeholder="Search library..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-sm text-slate-200 outline-none focus:border-indigo-500 transition-colors shadow-inner"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-xl border border-indigo-500/20 mb-6 flex flex-wrap items-center gap-6 shadow-lg">
                    <div className="flex items-center gap-2 pr-6 border-r border-slate-700">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Select</span>
                        <button onClick={selectAll} className={secondaryButton}>All</button>
                        <button onClick={deselectAll} className={secondaryButton}>None</button>
                    </div>

                    <div className="flex items-center gap-3 flex-1 min-w-[300px]">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Patch</span>
                        <div className="flex bg-slate-800 rounded-lg p-1 gap-1 border border-slate-700 shadow-inner">
                            <span className="text-[10px] text-slate-400 self-center px-2">Offset (MHz):</span>
                            <input 
                                type="number" 
                                step="0.025" 
                                value={bulkOffset} 
                                onChange={e => setBulkOffset(e.target.value)} 
                                className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-cyan-400"
                            />
                            <button onClick={() => applyBulkOffset('fundamental', 'add')} disabled={selectedKeys.size === 0} className={primaryButton}>Shift FF</button>
                            <button onClick={() => applyBulkOffset('twoTone', 'add')} disabled={selectedKeys.size === 0} className={primaryButton}>Shift 2T</button>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/30">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-800 sticky top-0 z-10 shadow-sm">
                            <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-700">
                                <th className="p-4 w-10"></th>
                                <th className="p-4">Equipment Model</th>
                                <th className="p-4">Operating Band</th>
                                <th className="p-4 text-center">FF Guard</th>
                                <th className="p-4 text-center">2T Guard</th>
                                <th className="p-4 text-center">3T Guard</th>
                                <th className="p-4 text-center">Purchase</th>
                                <th className="p-4 w-10 text-right">State</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {allProfiles.map(p => {
                                const key = p.id!;
                                const override = overrides[key];
                                const defaults = p.recommendedThresholds || {};
                                
                                return (
                                    <tr key={key} className={`hover:bg-slate-800/40 transition-colors ${selectedKeys.has(key) ? 'bg-indigo-500/5' : ''}`}>
                                        <td className="p-4">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedKeys.has(key)} 
                                                onChange={() => toggleSelect(key)}
                                                className="w-4 h-4 rounded border-slate-700 bg-slate-900 accent-indigo-500"
                                            />
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-white text-sm">{p.name}</span>
                                                <div className="flex gap-1.5 mt-1">
                                                    {p.isUserHardcoded ? (
                                                        <span className="text-[8px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-black tracking-widest uppercase shadow-[0_0_10px_rgba(16,185,129,0.1)]">Permanent (Source)</span>
                                                    ) : p.isStandard ? (
                                                        <span className="text-[8px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded font-black tracking-widest uppercase">Factory Preset</span>
                                                    ) : (
                                                        <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-black tracking-widest uppercase">Local Entry</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-xs font-mono text-slate-400">{p.band}</td>
                                        <td className="p-4">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-[7px] font-black text-slate-600 uppercase tracking-tighter">FF</span>
                                                <input 
                                                    type="number" 
                                                    step="0.025" 
                                                    value={override?.fundamental ?? defaults.fundamental ?? 0.350} 
                                                    onChange={e => handleValueChange(key, 'fundamental', e.target.value)}
                                                    className={`w-24 text-center font-mono text-xs p-1.5 rounded bg-slate-900 border ${override?.fundamental !== undefined ? 'border-amber-500/50 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.05)]' : 'border-slate-700 text-slate-400 opacity-80'}`}
                                                />
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-[7px] font-black text-slate-600 uppercase tracking-tighter">2T</span>
                                                <input 
                                                    type="number" 
                                                    step="0.025" 
                                                    value={override?.twoTone ?? defaults.twoTone ?? 0.050} 
                                                    onChange={e => handleValueChange(key, 'twoTone', e.target.value)}
                                                    className={`w-24 text-center font-mono text-xs p-1.5 rounded bg-slate-900 border ${override?.twoTone !== undefined ? 'border-amber-500/50 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.05)]' : 'border-slate-700 text-slate-400 opacity-80'}`}
                                                />
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-[7px] font-black text-slate-600 uppercase tracking-tighter">3T</span>
                                                <input 
                                                    type="number" 
                                                    step="0.025" 
                                                    value={override?.threeTone ?? defaults.threeTone ?? 0.050} 
                                                    onChange={e => handleValueChange(key, 'threeTone', e.target.value)}
                                                    className={`w-24 text-center font-mono text-xs p-1.5 rounded bg-slate-900 border ${override?.threeTone !== undefined ? 'border-amber-500/50 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.05)]' : 'border-slate-700 text-slate-400 opacity-80'}`}
                                                />
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex justify-center">
                                                {p.affiliateUrl ? (
                                                    <a 
                                                        href={p.affiliateUrl} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-[9px] font-black text-emerald-400 uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all shadow-lg shadow-emerald-500/5"
                                                    >
                                                        🛒 Buy
                                                    </a>
                                                ) : (
                                                    <span className="text-[8px] text-slate-700 font-black uppercase tracking-widest italic opacity-20">N/A</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button 
                                                onClick={() => resetOverride(key)} 
                                                disabled={!override}
                                                className={`text-[9px] font-black uppercase tracking-tighter transition-all ${override ? 'text-red-400 hover:text-red-300' : 'text-slate-700 opacity-20'}`}
                                            >
                                                Seed
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Card className="!bg-slate-900/50 border-slate-700 shadow-2xl">
                <div className="flex gap-4 items-center">
                    <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div className="text-xs text-slate-400 leading-relaxed">
                        <p className="font-bold text-slate-200 mb-1 uppercase tracking-widest underline decoration-indigo-500/50 underline-offset-4">Touring Inventory Hardcoding Instructions</p>
                        <p>To make your custom equipment PERMANENT (immune to resets), edit <code className="text-indigo-400 font-mono">constants.ts</code> in the source code and add your profiles to the <code className="text-indigo-400 font-mono">USER_INVENTORY</code> block. Gear added there will show up with the <span className="text-emerald-400 font-bold">Permanent</span> badge and will always be available in all modules.</p>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default EquipmentDatabaseTab;