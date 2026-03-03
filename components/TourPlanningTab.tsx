
import React, { useState, useMemo, useEffect } from 'react';
import { Lock, Unlock, Globe, Calendar, MapPin, CheckCircle2, Trash2, Plus, Map, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    TourPlanningState, TourStop, TourCluster, EquipmentRequest, 
    Frequency, TVChannelState, EquipmentProfile, Thresholds, ConstantSystemRequest
} from '../types';
import { getFinalThresholds, generateTourFrequencies } from '../services/rfService';
import { UK_TV_CHANNELS, US_TV_CHANNELS, EQUIPMENT_DATABASE } from '../constants';
import { getBlockedChannelsForZip } from '../utils/tvDatabase';
import Card, { CardTitle } from './Card';

interface TourPlanningTabProps {
    state: TourPlanningState;
    setState: React.Dispatch<React.SetStateAction<TourPlanningState>>;
    customEquipment: EquipmentProfile[];
    equipmentOverrides: Record<string, Partial<Thresholds>>;
}

const buttonBase = "px-4 py-2 rounded-lg font-semibold uppercase tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transform active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed text-[10px]";
const primaryButton = `bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-b-4 border-blue-800 hover:border-blue-700 hover:brightness-110 ${buttonBase}`;
const generateButton = `bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 border-b-4 border-amber-700 hover:border-amber-600 hover:brightness-110 shadow-[0_0_20px_rgba(245,158,11,0.2)] ${buttonBase}`;
const secondaryButton = `bg-slate-700 text-slate-200 border-b-4 border-slate-900 hover:border-slate-800 hover:bg-slate-600 ${buttonBase}`;

const TourPlanningTab: React.FC<TourPlanningTabProps> = ({ state, setState, customEquipment, equipmentOverrides }) => {
    const [isCalculating, setIsCalculating] = useState(false);
    const [calculationProgress, setCalculationProgress] = useState(0);
    const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [zipCode, setZipCode] = useState('');

    const steps = [
        { id: 'global', label: 'Global Gear', desc: 'Frequencies Needed For All Venues', icon: Globe },
        { id: 'itinerary', label: 'Itinerary', desc: 'Tour Dates, Venues, and RF Clusters', icon: Calendar },
        { id: 'local', label: 'Local Gear', desc: 'Site-Specific Equipment and TV Channels', icon: MapPin },
        { id: 'review', label: 'Review', desc: 'Calculate and Review Frequencies', icon: CheckCircle2 }
    ];

    const db = useMemo(() => {
        const base: Record<string, EquipmentProfile> = { ...EQUIPMENT_DATABASE };
        customEquipment.forEach(p => { if (p.id) base[p.id] = p; });
        return base;
    }, [customEquipment]);

    const handleAddStop = () => {
        const newStop: TourStop = {
            id: `stop-${Date.now()}`,
            location: 'New Venue',
            date: new Date(),
        };
        setState(prev => ({ ...prev, stops: [...prev.stops, newStop] }));
    };

    const handleRemoveStop = (id: string) => {
        setState(prev => ({
            ...prev,
            stops: prev.stops.filter(s => s.id !== id),
            clusters: prev.clusters.map(c => ({
                ...c,
                // No need to remove from cluster specifically as clusterId is on the stop
            }))
        }));
    };

    const handleUpdateStop = (id: string, field: keyof TourStop, value: any) => {
        setState(prev => ({
            ...prev,
            stops: prev.stops.map(s => s.id === id ? { ...s, [field]: value } : s)
        }));
    };

    const handleAddCluster = () => {
        const newCluster: TourCluster = {
            id: `cluster-${Date.now()}`,
            name: 'New Cluster',
            tvChannelStates: {},
            localRequests: [],
        };
        setState(prev => ({ ...prev, clusters: [...prev.clusters, newCluster] }));
        setActiveClusterId(newCluster.id);
    };

    const handleRemoveCluster = (id: string) => {
        setState(prev => ({
            ...prev,
            clusters: prev.clusters.filter(c => c.id !== id),
            stops: prev.stops.map(s => s.clusterId === id ? { ...s, clusterId: undefined } : s)
        }));
        if (activeClusterId === id) setActiveClusterId(null);
    };

    const handleUpdateCluster = (id: string, field: keyof TourCluster, value: any) => {
        setState(prev => ({
            ...prev,
            clusters: prev.clusters.map(c => c.id === id ? { ...c, [field]: value } : c)
        }));
    };

    const handleAddLocalRequest = (clusterId: string, type: 'mic' | 'iem') => {
        const defaultKey = type === 'iem' ? 'shure-psm1000-g10' : 'shure-ad-g56';
        const newReq: EquipmentRequest = {
            id: `req-${Date.now()}`,
            equipmentKey: defaultKey,
            count: 4,
            compatibilityLevel: 'standard',
            linearMode: false
        };
        handleUpdateCluster(clusterId, 'localRequests', [...(state.clusters.find(c => c.id === clusterId)?.localRequests || []), newReq]);
    };

    const handleUpdateConstantRequest = (type: 'mic' | 'iem', requests: EquipmentRequest[]) => {
        setState(prev => ({
            ...prev,
            constantSystems: {
                ...prev.constantSystems,
                [type === 'mic' ? 'micRequests' : 'iemRequests']: requests
            }
        }));
    };

    const handleUpdateConstantFrequencies = (frequencies: Frequency[]) => {
        setState(prev => ({
            ...prev,
            constantSystems: {
                ...prev.constantSystems,
                frequencies
            }
        }));
    };

    const handleUpdateClusterFrequencies = (clusterId: string, frequencies: Frequency[]) => {
        setState(prev => ({
            ...prev,
            clusters: prev.clusters.map(c => c.id === clusterId ? { ...c, localFrequencies: frequencies } : c)
        }));
    };

    const toggleConstantLock = (id: string) => {
        setState(prev => ({
            ...prev,
            constantSystems: {
                ...prev.constantSystems,
                frequencies: prev.constantSystems.frequencies?.map(f => f.id === id ? { ...f, locked: !f.locked } : f)
            }
        }));
    };

    const toggleAllConstantLocks = (lock: boolean) => {
        setState(prev => ({
            ...prev,
            constantSystems: {
                ...prev.constantSystems,
                frequencies: prev.constantSystems.frequencies?.map(f => ({ ...f, locked: lock }))
            }
        }));
    };

    const toggleClusterLock = (clusterId: string, freqId: string) => {
        setState(prev => ({
            ...prev,
            clusters: prev.clusters.map(c => c.id === clusterId ? {
                ...c,
                localFrequencies: c.localFrequencies?.map(f => f.id === freqId ? { ...f, locked: !f.locked } : f)
            } : c)
        }));
    };

    const toggleAllClusterLocks = (clusterId: string, lock: boolean) => {
        setState(prev => ({
            ...prev,
            clusters: prev.clusters.map(c => c.id === clusterId ? {
                ...c,
                localFrequencies: c.localFrequencies?.map(f => ({ ...f, locked: lock }))
            } : c)
        }));
    };

    const handleCalculate = async () => {
        setIsCalculating(true);
        setCalculationProgress(0);
        try {
            const { globalConstantFreqs, clusterResults } = await generateTourFrequencies(
                state,
                db,
                equipmentOverrides,
                (p) => setCalculationProgress(p)
            );

            const updatedClusters = state.clusters.map(c => ({
                ...c,
                constantFrequencies: clusterResults[c.id]?.constantFreqs || globalConstantFreqs,
                localFrequencies: clusterResults[c.id]?.localFreqs || []
            }));

            setState(prev => {
                return {
                    ...prev,
                    clusters: updatedClusters,
                    constantSystems: {
                        ...prev.constantSystems,
                        frequencies: globalConstantFreqs
                    }
                };
            });

            setCurrentStep(3);

        } catch (error) {
            console.error("Calculation failed", error);
            alert("Frequency coordination failed. Check your constraints.");
        } finally {
            setIsCalculating(false);
        }
    };

    useEffect(() => {
        if (currentStep === 2 && !activeClusterId && state.clusters.length > 0) {
            setActiveClusterId(state.clusters[0].id);
        }
    }, [currentStep, activeClusterId, state.clusters]);

    const activeCluster = state.clusters.find(c => c.id === activeClusterId);
    const channels = state.region === 'uk' ? UK_TV_CHANNELS : US_TV_CHANNELS;

    const handleExportPDF = () => {
        // @ts-ignore
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        
        doc.setFontSize(22);
        doc.setTextColor(15, 23, 42);
        doc.text('Tour Frequency Book', 14, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
        doc.text(`Region: ${state.region.toUpperCase()}`, 14, 33);

        let currentY = 45;

        if (state.stops.length === 0) {
            doc.text('No tour stops defined.', 14, currentY);
            doc.save(`Tour_Book_Empty.pdf`);
            return;
        }

        state.stops.forEach((stop, index) => {
            // Check if we need a new page before starting a new stop
            if (currentY > 240) {
                doc.addPage();
                currentY = 20;
            }

            doc.setFontSize(16);
            doc.setTextColor(79, 70, 229); // Indigo 600
            doc.text(`${index + 1}. ${stop.location}`, 14, currentY);
            
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139);
            doc.text(`Date: ${stop.date.toLocaleDateString()}`, 14, currentY + 6);

            const cluster = state.clusters.find(c => c.id === stop.clusterId);
            if (!cluster) {
                doc.setTextColor(225, 29, 72); // Rose 600
                doc.text('Status: No Cluster Assigned', 14, currentY + 12);
                currentY += 25;
                return;
            }

            doc.setTextColor(15, 23, 42);
            doc.text(`Cluster: ${cluster.name}`, 14, currentY + 12);

            const constantFreqs = cluster.constantFrequencies || [];
            const localFreqs = cluster.localFrequencies || [];
            const allFreqs = [...constantFreqs, ...localFreqs];

            if (allFreqs.length === 0) {
                doc.setFontSize(9);
                doc.setTextColor(100, 116, 139);
                doc.text('No frequencies calculated for this cluster.', 14, currentY + 18);
                currentY += 30;
            } else {
                const tableData = allFreqs.map(f => [
                    f.value.toFixed(3),
                    f.type?.toUpperCase() || 'GENERIC',
                    constantFreqs.includes(f) ? 'CONSTANT' : 'LOCAL',
                    f.locked ? 'LOCKED' : 'OPEN'
                ]);

                // @ts-ignore
                doc.autoTable({
                    startY: currentY + 18,
                    head: [['Frequency (MHz)', 'Type', 'Source', 'Status']],
                    body: tableData,
                    theme: 'grid',
                    headStyles: { fillColor: [79, 70, 229] }, // Indigo 600
                    margin: { left: 14 },
                    styles: { fontSize: 8, cellPadding: 2 },
                    didDrawPage: (data: any) => {
                        // Update currentY if table spans multiple pages
                        currentY = data.cursor.y;
                    }
                });

                // @ts-ignore
                currentY = doc.lastAutoTable.finalY + 20;
            }
        });

        doc.save(`Tour_Book_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const handleExportCSV = () => {
        const headers = ['Frequency (MHz)', 'Label', 'Type', 'Equipment', 'Source', 'Cluster', 'Status'];
        const rows: string[][] = [];

        state.clusters.forEach(cluster => {
            const constantFreqs = cluster.constantFrequencies || [];
            const localFreqs = cluster.localFrequencies || [];
            
            constantFreqs.forEach(f => {
                const profile = db[f.equipmentKey || 'custom'];
                rows.push([
                    f.value.toFixed(3),
                    f.label || 'Constant',
                    f.type?.toUpperCase() || 'GENERIC',
                    profile?.name || f.equipmentKey || 'Unknown',
                    'CONSTANT',
                    cluster.name,
                    f.locked ? 'LOCKED' : 'OPEN'
                ]);
            });

            localFreqs.forEach(f => {
                const profile = db[f.equipmentKey || 'custom'];
                rows.push([
                    f.value.toFixed(3),
                    f.label || 'Local',
                    f.type?.toUpperCase() || 'GENERIC',
                    profile?.name || f.equipmentKey || 'Unknown',
                    'LOCAL',
                    cluster.name,
                    f.locked ? 'LOCKED' : 'OPEN'
                ]);
            });
        });

        if (rows.length === 0) {
            alert("No frequencies to export. Please run a calculation first.");
            return;
        }

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Tour_Frequencies_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportWWB = () => {
        let csv = "Frequency,Name,Type,Band,RF Profile\n";
        const filename = `tour_rf_wwb_${new Date().toISOString().slice(0, 10)}`;
        
        const exportedIds = new Set<string>();
        const allFreqs: Frequency[] = [];

        state.clusters.forEach(cluster => {
            const constantFreqs = cluster.constantFrequencies || [];
            const localFreqs = cluster.localFrequencies || [];
            
            [...constantFreqs, ...localFreqs].forEach(f => {
                if (!exportedIds.has(f.id)) {
                    allFreqs.push(f);
                    exportedIds.add(f.id);
                }
            });
        });

        if (allFreqs.length === 0) {
            alert("No frequencies to export. Please run a calculation first.");
            return;
        }

        allFreqs.sort((a, b) => a.value - b.value).forEach(f => {
            const profile = db[f.equipmentKey || 'custom'];
            const wwbType = f.type === 'iem' ? 'In-ear Monitor' : 'Frequency';
            const cleanedProfile = profile?.name.replace(/^Shure\s+/i, '').replace(/\s*\(.*?\)/g, '').trim() || 'Generic';
            const label = f.label || 'Generated CH';
            csv += `${f.value.toFixed(3)},"${label}","${wwbType}","${profile?.band.split(' ')[0] || 'Custom'}","${cleanedProfile}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${filename}.csv`; a.click();
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center bg-slate-900/40 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
                <div>
                    <h2 className="text-xl font-black uppercase tracking-tighter text-white">Tour Planning Engine</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Multi-Location Frequency Synchronization</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={handleExportPDF}
                        className={secondaryButton}
                    >
                        Export PDF
                    </button>
                    <button 
                        onClick={handleExportCSV}
                        className={secondaryButton}
                    >
                        Export CSV
                    </button>
                    <button 
                        onClick={handleExportWWB}
                        className={secondaryButton}
                    >
                        Export WWB
                    </button>
                    <select 
                        value={state.region} 
                        onChange={e => setState(prev => ({ ...prev, region: e.target.value as 'uk' | 'us' }))}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-[10px] font-black uppercase text-indigo-400 outline-none"
                    >
                        <option value="uk">UK Region (8MHz)</option>
                        <option value="us">US Region (6MHz)</option>
                    </select>
                </div>
            </div>

            <div className="mb-8">
                <div className="flex justify-between items-start relative max-w-3xl mx-auto">
                    {/* Connecting Line */}
                    <div className="absolute top-5 left-[10%] right-[10%] h-0.5 bg-slate-800 z-0">
                        <motion.div 
                            className="h-full bg-indigo-500" 
                            initial={{ width: '0%' }}
                            animate={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
                            transition={{ duration: 0.5, ease: "easeInOut" }}
                        />
                    </div>
                    {steps.map((step, index) => {
                        const Icon = step.icon;
                        const isActive = currentStep === index;
                        const isPast = currentStep > index;
                        return (
                            <button 
                                key={step.id}
                                onClick={() => setCurrentStep(index)}
                                className={`relative z-10 flex flex-col items-center gap-2 group w-1/4`}
                            >
                                <motion.div 
                                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${isActive ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.6)]' : isPast ? 'bg-indigo-500/50 text-white border border-indigo-500/30' : 'bg-slate-800 text-slate-400 border border-white/5 group-hover:bg-slate-700'}`}
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <Icon size={18} />
                                </motion.div>
                                <div className="hidden md:block text-center mt-2">
                                    <div className={`text-[10px] sm:text-xs font-black uppercase tracking-widest transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-500'}`}>{step.label}</div>
                                    <div className={`text-[10px] mt-1 transition-colors ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>{step.desc}</div>
                                </div>
                            </button>
                        );
                    })}
                </div>
                <div className="mt-6 text-center md:hidden">
                    <div className="text-sm font-black text-indigo-400 uppercase tracking-widest">{steps[currentStep].label}</div>
                    <div className="text-[10px] text-slate-500 mt-1">{steps[currentStep].desc}</div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto relative overflow-hidden">
                {currentStep === 0 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                    <Card>
                        <div className="flex justify-between items-center mb-4">
                            <CardTitle subtitle="Base RF Cluster">Global Touring Gear</CardTitle>
                        </div>
                        <div className="space-y-4">
                            <RequestManager 
                                title="Global Mics" 
                                type="mic" 
                                requests={state.constantSystems.micRequests} 
                                onUpdate={reqs => handleUpdateConstantRequest('mic', reqs)}
                                db={db}
                                overrides={equipmentOverrides}
                            />
                            <RequestManager 
                                title="Global IEMs" 
                                type="iem" 
                                requests={state.constantSystems.iemRequests} 
                                onUpdate={reqs => handleUpdateConstantRequest('iem', reqs)}
                                db={db}
                                overrides={equipmentOverrides}
                            />
                            <ManualFrequencyManager
                                title="Global Manual Mics"
                                type="mic"
                                frequencies={state.constantSystems.frequencies || []}
                                onUpdate={handleUpdateConstantFrequencies}
                                db={db}
                            />
                            <ManualFrequencyManager
                                title="Global Manual IEMs"
                                type="iem"
                                frequencies={state.constantSystems.frequencies || []}
                                onUpdate={handleUpdateConstantFrequencies}
                                db={db}
                            />
                        </div>
                    </Card>
                    <Card>
                        <div className="flex justify-between items-center mb-4">
                            <CardTitle subtitle="Base RF Cluster">Global TV Channel Grid</CardTitle>
                            <div className="flex items-center gap-2">
                                {state.region === 'us' && (
                                    <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-lg border border-white/5">
                                        <input 
                                            type="text" 
                                            placeholder="US Zip" 
                                            value={zipCode} 
                                            onChange={e => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[10px] text-white outline-none w-16 text-center"
                                            maxLength={5}
                                        />
                                        <button 
                                            onClick={() => {
                                                const blocked = getBlockedChannelsForZip(zipCode);
                                                if (blocked.length === 0 && zipCode.length < 5) {
                                                    alert("Please enter a valid 5-digit US Zip Code.");
                                                    return;
                                                }
                                                const newStates: Record<number, TVChannelState> = {};
                                                Object.keys(channels).forEach(ch => {
                                                    newStates[parseInt(ch)] = blocked.includes(parseInt(ch)) ? 'blocked' : 'available';
                                                });
                                                setState(prev => ({ ...prev, globalTvChannelStates: newStates }));
                                            }}
                                            className="text-[9px] px-2 py-1 rounded font-black uppercase tracking-widest bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/40 hover:text-white transition-all"
                                        >
                                            Auto-Scan
                                        </button>
                                    </div>
                                )}
                                <button 
                                    onClick={() => {
                                        const allBlocked = Object.keys(channels).every(ch => (state.globalTvChannelStates || {})[parseInt(ch)] === 'blocked');
                                        const newState = allBlocked ? 'available' : 'blocked';
                                        const newStates: Record<number, TVChannelState> = {};
                                        Object.keys(channels).forEach(ch => {
                                            newStates[parseInt(ch)] = newState;
                                        });
                                        setState(prev => ({ ...prev, globalTvChannelStates: newStates }));
                                    }}
                                    className="text-[9px] px-2 py-1 rounded font-black uppercase tracking-widest bg-slate-800 border border-white/10 text-slate-400 hover:bg-slate-700 hover:text-white transition-all"
                                >
                                    {Object.keys(channels).every(ch => (state.globalTvChannelStates || {})[parseInt(ch)] === 'blocked') ? 'Unblock All' : 'Block All'}
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-1.5">
                            {Object.entries(channels).map(([ch, range]) => {
                                const channel = parseInt(ch);
                                const tvState = (state.globalTvChannelStates || {})[channel] || 'available';
                                return (
                                        <button
                                        key={channel}
                                        title={`Channel ${channel}: ${range[0]} MHz - ${range[1]} MHz`}
                                        onClick={() => {
                                            const states = ['available', 'mic-only', 'iem-only', 'blocked'] as TVChannelState[];
                                            const next = states[(states.indexOf(tvState) + 1) % states.length];
                                            setState(prev => ({
                                                ...prev,
                                                globalTvChannelStates: {
                                                    ...(prev.globalTvChannelStates || {}),
                                                    [channel]: next
                                                }
                                            }));
                                        }}
                                        className={`
                                            flex flex-col items-center justify-center p-1.5 rounded-lg border transition-all
                                            ${tvState === 'available' ? 'bg-slate-800/40 border-white/5 text-slate-400' : ''}
                                            ${tvState === 'mic-only' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : ''}
                                            ${tvState === 'iem-only' ? 'bg-rose-500/20 border-rose-500/40 text-rose-400' : ''}
                                            ${tvState === 'blocked' ? 'bg-red-500/40 border-red-500/60 text-white' : ''}
                                        `}
                                    >
                                        <span className="text-[10px] font-black">{channel}</span>
                                        <span className="text-[7px] uppercase font-bold opacity-70">{tvState === 'available' ? 'Free' : tvState.split('-')[0]}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-3 justify-center">
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-slate-700"></div><span className="text-[8px] text-slate-500 font-black uppercase">Available</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-emerald-500/40"></div><span className="text-[8px] text-emerald-500 font-black uppercase">Mic Only</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-rose-500/40"></div><span className="text-[8px] text-rose-500 font-black uppercase">IEM Only</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-red-500/60"></div><span className="text-[8px] text-red-500 font-black uppercase">Blocked</span></div>
                        </div>
                    </Card>
                    <div className="flex justify-end mt-6">
                        <button onClick={() => setCurrentStep(1)} className={primaryButton}>Next Step ➔</button>
                    </div>
                </div>
                )}

                {currentStep === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                    <Card>
                        <div className="flex justify-between items-center mb-6">
                            <CardTitle subtitle="Tour Routing">Itinerary</CardTitle>
                            <button onClick={handleAddStop} className={secondaryButton + " flex items-center gap-1"}><Plus size={12}/> Add Stop</button>
                        </div>
                        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-700 before:to-transparent">
                            <AnimatePresence>
                            {state.stops.length === 0 && (
                                <motion.div 
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    className="text-center py-8 text-slate-600 text-[10px] uppercase font-black italic opacity-50"
                                >
                                    No stops added yet
                                </motion.div>
                            )}
                            {state.stops.map((stop, index) => (
                                <motion.div 
                                    key={stop.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.3, delay: index * 0.05 }}
                                    className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
                                >
                                    {/* Timeline dot */}
                                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-950 bg-slate-800 text-slate-400 group-hover:text-indigo-400 group-hover:bg-indigo-900/50 group-hover:border-indigo-500/30 transition-all z-10 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm">
                                        <MapPin size={14} />
                                    </div>
                                    
                                    {/* Card */}
                                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-slate-900/60 border border-white/5 rounded-2xl p-4 shadow-lg hover:border-indigo-500/30 transition-all">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-950 px-2 py-0.5 rounded-full">Stop {index + 1}</div>
                                            </div>
                                            <button onClick={() => handleRemoveStop(stop.id)} className="text-red-400/50 hover:text-red-400 transition-colors">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1"><Map size={10}/> Venue / Location</label>
                                                <input 
                                                    type="text" 
                                                    value={stop.location} 
                                                    onChange={e => handleUpdateStop(stop.id, 'location', e.target.value)}
                                                    className="w-full bg-transparent border-b border-slate-700 hover:border-indigo-500/50 focus:border-indigo-500 px-1 py-1 text-sm font-bold text-white outline-none transition-colors"
                                                    placeholder="e.g. O2 Arena, London"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1"><Calendar size={10}/> Date</label>
                                                    <input 
                                                        type="date" 
                                                        value={stop.date instanceof Date && !isNaN(stop.date.getTime()) ? stop.date.toISOString().split('T')[0] : ''} 
                                                        onChange={e => {
                                                            const newDate = new Date(e.target.value);
                                                            if (!isNaN(newDate.getTime())) {
                                                                handleUpdateStop(stop.id, 'date', newDate);
                                                            }
                                                        }}
                                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-indigo-500 transition-colors"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1"><Radio size={10}/> RF Cluster</label>
                                                    <select 
                                                        value={stop.clusterId || ''} 
                                                        onChange={e => {
                                                            if (e.target.value === '__NEW__') {
                                                                const newCluster: TourCluster = {
                                                                    id: `cluster-${Date.now()}`,
                                                                    name: `Cluster ${state.clusters.length + 1}`,
                                                                    tvChannelStates: {},
                                                                    localRequests: [],
                                                                };
                                                                setState(prev => ({ 
                                                                    ...prev, 
                                                                    clusters: [...prev.clusters, newCluster],
                                                                    stops: prev.stops.map(s => s.id === stop.id ? { ...s, clusterId: newCluster.id } : s)
                                                                }));
                                                            } else {
                                                                handleUpdateStop(stop.id, 'clusterId', e.target.value || undefined);
                                                            }
                                                        }}
                                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-indigo-400 outline-none focus:border-indigo-500 transition-colors"
                                                    >
                                                        <option value="">Select Cluster...</option>
                                                        {state.clusters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                        <option value="__NEW__">+ Create New Cluster</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                            </AnimatePresence>
                        </div>
                    </Card>
                    <div className="flex justify-end mt-6">
                        <button onClick={() => setCurrentStep(2)} className={primaryButton}>Next Step ➔</button>
                    </div>
                </div>
                )}

                {currentStep === 2 && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-right-8 duration-500">
                    <div className="lg:col-span-1 space-y-4">
                        <Card>
                            <CardTitle subtitle="Select Cluster">Clusters</CardTitle>
                            <div className="space-y-2">
                                {state.clusters.length === 0 && (
                                    <div className="text-[10px] text-slate-500 italic">No clusters created yet. Go back to Itinerary to create one.</div>
                                )}
                                {state.clusters.map(cluster => (
                                    <div 
                                        key={cluster.id}
                                        onClick={() => setActiveClusterId(cluster.id)}
                                        className={`w-full flex justify-between items-center p-3 rounded-xl border transition-all cursor-pointer ${activeClusterId === cluster.id ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'bg-slate-900/40 border-white/5 text-slate-400 hover:bg-white/5'}`}
                                    >
                                        <div className="text-left flex-1 mr-4">
                                            <div className="text-sm font-bold truncate">{cluster.name}</div>
                                            <div className="text-[10px] opacity-70 mt-1 space-y-0.5">
                                                {state.stops.filter(s => s.clusterId === cluster.id).length > 0 ? (
                                                    state.stops.filter(s => s.clusterId === cluster.id).map(s => (
                                                        <div key={s.id} className="truncate">• {s.location}</div>
                                                    ))
                                                ) : (
                                                    <div className="italic">No stops assigned</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                    <div className="lg:col-span-3">
                        {activeCluster ? (
                            <div className="space-y-6">
                                <Card className="animate-in fade-in zoom-in-95 duration-300">
                                    <div className="flex justify-between items-center mb-4">
                                        <input 
                                            type="text"
                                            value={activeCluster.name}
                                            onChange={e => handleUpdateCluster(activeCluster.id, 'name', e.target.value)}
                                            className="text-lg font-black text-indigo-400 uppercase tracking-tighter bg-transparent border-b border-transparent hover:border-indigo-500/50 focus:border-indigo-500 outline-none w-full max-w-xs transition-colors"
                                            placeholder="Cluster Name"
                                        />
                                        <span className="text-[9px] font-black text-slate-500 uppercase">Local Requirements</span>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <RequestManager 
                                            title="Local Mics" 
                                            type="mic" 
                                            requests={activeCluster.localRequests.filter(r => {
                                                const p = db[r.equipmentKey];
                                                return !p || p.type === 'mic' || p.type === 'generic';
                                            })} 
                                            onUpdate={reqs => {
                                                const others = activeCluster.localRequests.filter(r => {
                                                    const p = db[r.equipmentKey];
                                                    return p && p.type === 'iem';
                                                });
                                                handleUpdateCluster(activeCluster.id, 'localRequests', [...reqs, ...others]);
                                            }}
                                            db={db}
                                            overrides={equipmentOverrides}
                                        />
                                        <RequestManager 
                                            title="Local IEMs" 
                                            type="iem" 
                                            requests={activeCluster.localRequests.filter(r => {
                                                const p = db[r.equipmentKey];
                                                return p && p.type === 'iem';
                                            })} 
                                            onUpdate={reqs => {
                                                const others = activeCluster.localRequests.filter(r => {
                                                    const p = db[r.equipmentKey];
                                                    return !p || p.type !== 'iem';
                                                });
                                                handleUpdateCluster(activeCluster.id, 'localRequests', [...others, ...reqs]);
                                            }}
                                            db={db}
                                            overrides={equipmentOverrides}
                                        />
                                        <ManualFrequencyManager
                                            title="Local Manual Mics"
                                            type="mic"
                                            frequencies={activeCluster.localFrequencies || []}
                                            onUpdate={freqs => handleUpdateClusterFrequencies(activeCluster.id, freqs)}
                                            db={db}
                                        />
                                        <ManualFrequencyManager
                                            title="Local Manual IEMs"
                                            type="iem"
                                            frequencies={activeCluster.localFrequencies || []}
                                            onUpdate={freqs => handleUpdateClusterFrequencies(activeCluster.id, freqs)}
                                            db={db}
                                        />

                                        {activeCluster.localFrequencies && activeCluster.localFrequencies.length > 0 && (
                                            <div className="mt-4 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                                                <div className="flex justify-between items-center mb-2">
                                                    <h4 className="text-[9px] font-black text-emerald-400 uppercase">Calculated Local Frequencies</h4>
                                                    <div className="flex gap-1">
                                                        <button 
                                                            onClick={() => toggleAllClusterLocks(activeCluster.id, true)}
                                                            className="p-1 hover:bg-white/5 rounded transition-colors text-slate-500 hover:text-emerald-400"
                                                            title="Lock All"
                                                        >
                                                            <Lock size={10} />
                                                        </button>
                                                        <button 
                                                            onClick={() => toggleAllClusterLocks(activeCluster.id, false)}
                                                            className="p-1 hover:bg-white/5 rounded transition-colors text-slate-500 hover:text-emerald-400"
                                                            title="Unlock All"
                                                        >
                                                            <Unlock size={10} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {activeCluster.localFrequencies.map(f => (
                                                        <div key={f.id} className="flex justify-between items-center bg-black/30 p-1.5 rounded border border-white/5 group">
                                                            <div className="flex items-center gap-1.5 overflow-hidden">
                                                                <button 
                                                                    onClick={() => toggleClusterLock(activeCluster.id, f.id)}
                                                                    className={`transition-colors ${f.locked ? 'text-emerald-400' : 'text-slate-600 opacity-0 group-hover:opacity-100'}`}
                                                                >
                                                                    {f.locked ? <Lock size={8} /> : <Unlock size={8} />}
                                                                </button>
                                                                <span className={`text-[10px] font-mono truncate ${f.locked ? 'text-emerald-300' : 'text-white'}`}>{f.value.toFixed(3)}</span>
                                                            </div>
                                                            <span className="text-[8px] text-slate-500 uppercase shrink-0">{f.type}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </Card>
                                <Card className="animate-in fade-in zoom-in-95 duration-300 delay-100">
                                    <div className="flex justify-between items-center mb-4">
                                        <CardTitle subtitle={`Local RF Cluster: ${activeCluster.name}`}>TV Channel Grid</CardTitle>
                                        <div className="flex items-center gap-2">
                                            {state.region === 'us' && (
                                                <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-lg border border-white/5">
                                                    <input 
                                                        type="text" 
                                                        placeholder="US Zip" 
                                                        value={zipCode} 
                                                        onChange={e => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                                                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[10px] text-white outline-none w-16 text-center"
                                                        maxLength={5}
                                                    />
                                                    <button 
                                                        onClick={() => {
                                                            const blocked = getBlockedChannelsForZip(zipCode);
                                                            if (blocked.length === 0 && zipCode.length < 5) {
                                                                alert("Please enter a valid 5-digit US Zip Code.");
                                                                return;
                                                            }
                                                            const newStates: Record<number, TVChannelState> = {};
                                                            Object.keys(channels).forEach(ch => {
                                                                newStates[parseInt(ch)] = blocked.includes(parseInt(ch)) ? 'blocked' : 'available';
                                                            });
                                                            handleUpdateCluster(activeCluster.id, 'tvChannelStates', newStates);
                                                        }}
                                                        className="text-[9px] px-2 py-1 rounded font-black uppercase tracking-widest bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/40 hover:text-white transition-all"
                                                    >
                                                        Auto-Scan
                                                    </button>
                                                </div>
                                            )}
                                            <button 
                                                onClick={() => {
                                                    const allBlocked = Object.keys(channels).every(ch => activeCluster.tvChannelStates[parseInt(ch)] === 'blocked');
                                                    const newState = allBlocked ? 'available' : 'blocked';
                                                    const newStates: Record<number, TVChannelState> = {};
                                                    Object.keys(channels).forEach(ch => {
                                                        newStates[parseInt(ch)] = newState;
                                                    });
                                                    handleUpdateCluster(activeCluster.id, 'tvChannelStates', newStates);
                                                }}
                                                className="text-[9px] px-2 py-1 rounded font-black uppercase tracking-widest bg-slate-800 border border-white/10 text-slate-400 hover:bg-slate-700 hover:text-white transition-all"
                                            >
                                                {Object.keys(channels).every(ch => activeCluster.tvChannelStates[parseInt(ch)] === 'blocked') ? 'Unblock All' : 'Block All'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                                        {Object.entries(channels).map(([ch, range]) => {
                                            const channel = parseInt(ch);
                                            const tvState = activeCluster.tvChannelStates[channel] || 'available';
                                            return (
                                                <button
                                                    key={channel}
                                                    title={`Channel ${channel}: ${range[0]} MHz - ${range[1]} MHz`}
                                                    onClick={() => {
                                                        const states = ['available', 'mic-only', 'iem-only', 'blocked'] as TVChannelState[];
                                                        const next = states[(states.indexOf(tvState) + 1) % states.length];
                                                        handleUpdateCluster(activeCluster.id, 'tvChannelStates', {
                                                            ...activeCluster.tvChannelStates,
                                                            [channel]: next
                                                        });
                                                    }}
                                                    className={`
                                                        flex flex-col items-center justify-center p-1.5 rounded-lg border transition-all
                                                        ${tvState === 'available' ? 'bg-slate-800/40 border-white/5 text-slate-400' : ''}
                                                        ${tvState === 'mic-only' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : ''}
                                                        ${tvState === 'iem-only' ? 'bg-rose-500/20 border-rose-500/40 text-rose-400' : ''}
                                                        ${tvState === 'blocked' ? 'bg-red-500/40 border-red-500/60 text-white' : ''}
                                                    `}
                                                >
                                                    <span className="text-[10px] font-black">{channel}</span>
                                                    <span className="text-[7px] uppercase font-bold opacity-70">{tvState === 'available' ? 'Free' : tvState.split('-')[0]}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-3 justify-center">
                                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-slate-700"></div><span className="text-[8px] text-slate-500 font-black uppercase">Available</span></div>
                                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-emerald-500/40"></div><span className="text-[8px] text-emerald-500 font-black uppercase">Mic Only</span></div>
                                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-rose-500/40"></div><span className="text-[8px] text-rose-500 font-black uppercase">IEM Only</span></div>
                                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-red-500/60"></div><span className="text-[8px] text-red-500 font-black uppercase">Blocked</span></div>
                                    </div>
                                </Card>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center border-2 border-dashed border-white/5 rounded-3xl p-12 text-center">
                                <div>
                                    <div className="text-4xl mb-4 opacity-20">📡</div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-600">Select a cluster to configure local gear</div>
                                </div>
                            </div>
                        )}
                        <div className="flex justify-end mt-6">
                            <button onClick={() => setCurrentStep(3)} className={primaryButton}>Next Step ➔</button>
                        </div>
                    </div>
                </div>
                )}

                {currentStep === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                    <div className="flex justify-center mb-8">
                        <button 
                            onClick={handleCalculate}
                            disabled={isCalculating}
                            className={`${generateButton} shadow-[0_20px_50px_rgba(0,0,0,0.5)] scale-110 md:scale-125 transition-all ${isCalculating ? 'opacity-50 scale-100' : ''} px-12 py-4 text-sm`}
                        >
                            {isCalculating ? '⚡ Calculating...' : '⚡ Calculate Tour Plan'}
                        </button>
                    </div>

                    {isCalculating && (
                        <div className="bg-slate-900 border border-white/10 p-4 rounded-xl shadow-2xl max-w-md mx-auto mb-8">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-black uppercase tracking-widest text-indigo-400">Coordination Engine</span>
                                <span className="text-xs font-mono text-slate-400">{Math.round(calculationProgress * 100)}%</span>
                            </div>
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
                                    style={{ width: `${calculationProgress * 100}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {(!isCalculating && (state.constantSystems.frequencies?.length > 0 || state.clusters.some(c => c.localFrequencies?.length > 0))) && (
                        <>
                            <Card>
                                <div className="flex justify-between items-center mb-4">
                                    <CardTitle subtitle="Calculated Frequencies">Global Transmits</CardTitle>
                                    <div className="flex gap-2">
                                        <button onClick={handleExportCSV} className={secondaryButton}>Export CSV</button>
                                        <button onClick={handleExportPDF} className={secondaryButton}>Export PDF</button>
                                    </div>
                                </div>
                                {(!state.constantSystems.frequencies || state.constantSystems.frequencies.length === 0) ? (
                                    <div className="text-center p-8 text-slate-500 text-sm">No global frequencies calculated yet.</div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                        {state.constantSystems.frequencies.map(f => (
                                            <div key={f.id} className="bg-slate-800/50 border border-white/5 rounded p-2 flex flex-col items-center justify-center relative group">
                                                <button 
                                                    onClick={() => toggleConstantLock(f.id)}
                                                    className={`absolute top-1 left-1 p-1.5 rounded-md transition-all ${f.locked ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-900/40 text-slate-400 border border-white/10 opacity-50 group-hover:opacity-100 hover:bg-indigo-500/20 hover:text-indigo-400 hover:border-indigo-500/30'}`}
                                                    title={f.locked ? "Unlock Frequency" : "Lock Frequency"}
                                                >
                                                    {f.locked ? <Lock size={12} /> : <Unlock size={12} />}
                                                </button>
                                                <div className="absolute top-1 right-1 text-[8px] font-bold text-slate-500 uppercase">{f.type || 'GENERIC'}</div>
                                                <div className={`text-xs font-bold mt-1 ${f.locked ? 'text-indigo-300' : 'text-indigo-400'}`}>{f.value.toFixed(3)}</div>
                                                <div className="text-[9px] text-slate-400 truncate w-full text-center">{f.label || 'Constant'}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Card>

                            {state.clusters.map(cluster => {
                                const clusterStops = state.stops.filter(s => s.clusterId === cluster.id).map(s => s.location).join(', ');
                                const clusterTitle = clusterStops ? `${cluster.name} - ${clusterStops}` : cluster.name;
                                return (
                                    <Card key={cluster.id}>
                                        <CardTitle subtitle="Local Cluster">{clusterTitle}</CardTitle>
                                        
                                        {(!cluster.localFrequencies || cluster.localFrequencies.length === 0) ? (
                                            <div className="text-center p-8 text-slate-500 text-sm">No local frequencies calculated yet.</div>
                                        ) : (
                                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mt-4">
                                                {cluster.localFrequencies.map(f => (
                                                    <div key={f.id} className="bg-slate-800/50 border border-white/5 rounded p-2 flex flex-col items-center justify-center relative group">
                                                        <button 
                                                            onClick={() => toggleClusterLock(cluster.id, f.id)}
                                                            className={`absolute top-1 left-1 p-1.5 rounded-md transition-all ${f.locked ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-900/40 text-slate-400 border border-white/10 opacity-50 group-hover:opacity-100 hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/30'}`}
                                                            title={f.locked ? "Unlock Frequency" : "Lock Frequency"}
                                                        >
                                                            {f.locked ? <Lock size={12} /> : <Unlock size={12} />}
                                                        </button>
                                                        <div className="absolute top-1 right-1 text-[8px] font-bold text-slate-500 uppercase">{f.type || 'GENERIC'}</div>
                                                        <div className={`text-xs font-bold mt-1 ${f.locked ? 'text-emerald-300' : 'text-emerald-400'}`}>{f.value.toFixed(3)}</div>
                                                        <div className="text-[9px] text-slate-400 truncate w-full text-center">{f.label || 'Local'}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </Card>
                                );
                            })}
                        </>
                    )}
                </div>
                )}
            </div>
        </div>
    );
};

// Re-using RequestManager from FestivalCoordinationTab but slightly adapted if needed
// For simplicity, I'll copy the logic here or import it if it was exported.
// Since it wasn't exported, I'll define a simplified version or copy it.

const RequestManager: React.FC<{
    requests: EquipmentRequest[],
    onUpdate: (requests: EquipmentRequest[]) => void,
    db: Record<string, EquipmentProfile>,
    overrides: Record<string, Partial<Thresholds>>,
    title: string,
    type: 'mic' | 'iem'
}> = ({ requests, onUpdate, db, overrides, title, type }) => {
    const handleAdd = () => {
        const defaultKey = type === 'iem' ? 'shure-psm1000-g10' : 'shure-ad-g56';
        onUpdate([...requests, { id: `req-${Date.now()}-${Math.random()}`, equipmentKey: defaultKey, count: 4, compatibilityLevel: 'standard', linearMode: false, type }]);
    };
    const handleRemove = (id: string) => onUpdate(requests.filter(r => r.id !== id));
    
    const handleFieldChange = (id: string, field: keyof EquipmentRequest, value: any) => {
        onUpdate(requests.map(r => {
            if (r.id !== id) return r;
            let updated = { ...r, [field]: value, type }; // Ensure type is preserved/set
            
            if (field === 'equipmentKey') {
                const profile = db[value as string];
                if (profile && profile.recommendedThresholds?.threeTone !== 0) {
                    updated.linearMode = false;
                }
            }

            if (field === 'useManualParams' && value === true) {
                const standardTh = getFinalThresholds({ equipmentKey: r.equipmentKey, compatibilityLevel: 'standard' }, db, overrides);
                if (updated.manualFundamental === undefined) updated.manualFundamental = standardTh.fundamental;
                if (updated.manualTwoTone === undefined) updated.manualTwoTone = standardTh.twoTone;
                if (updated.manualThreeTone === undefined) updated.manualThreeTone = standardTh.threeTone;
            }
            return updated;
        }));
    };

    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center mb-1 px-1">
                <h5 className={`text-[10px] font-black uppercase tracking-widest ${type === 'mic' ? 'text-emerald-400' : 'text-rose-400'}`}>{title}</h5>
                <button onClick={handleAdd} className={`text-[9px] px-2 py-0.5 rounded font-bold transition-all border ${type === 'mic' ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-600' : 'bg-rose-600/20 text-rose-300 border-rose-500/30 hover:bg-rose-600'} hover:text-white`}>+ Add</button>
            </div>
            <div className="space-y-2">
                {requests.map(req => {
                    const activeTh = getFinalThresholds({ equipmentKey: req.equipmentKey, compatibilityLevel: req.compatibilityLevel }, db, overrides);
                    return (
                        <div key={req.id} className="bg-slate-950/40 p-2 rounded-xl border border-white/5 space-y-2">
                            <div className="grid grid-cols-[1fr,40px,auto] gap-2 items-center">
                                <select value={req.equipmentKey} onChange={e => handleFieldChange(req.id, 'equipmentKey', e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-1 py-1 text-[10px] text-slate-200 outline-none">
                                    {(Object.entries(db) as [string, EquipmentProfile][])
                                        .filter(([k, p]) => {
                                            const pType = p.type || 'generic';
                                            return pType === type || pType === 'generic' || k === 'custom';
                                        })
                                        .map(([k, p]) => <option key={k} value={k}>{p.name} ({p.band})</option>)}
                                </select>
                                <input type="number" value={req.count} onChange={e => handleFieldChange(req.id, 'count', parseInt(e.target.value) || 0)} className={`bg-slate-950 border border-slate-700 rounded px-1 py-1 text-[10px] font-bold text-center ${type === 'mic' ? 'text-emerald-400' : 'text-rose-400'}`} />
                                <button onClick={() => handleRemove(req.id)} className="text-red-400 hover:text-red-300 font-bold text-xs px-1">&times;</button>
                            </div>

                            <div className="flex items-center justify-between gap-2 px-1">
                                <div className="flex gap-3">
                                    {db[req.equipmentKey]?.recommendedThresholds?.threeTone === 0 && (
                                        <label className="flex items-center gap-2 cursor-pointer group/lin">
                                            <span className={`text-[8px] font-black uppercase tracking-tighter ${req.linearMode ? 'text-cyan-400' : 'text-slate-600'}`}>HD Mode</span>
                                            <input type="checkbox" checked={req.linearMode} onChange={e => handleFieldChange(req.id, 'linearMode', e.target.checked)} className="w-3 h-3 accent-cyan-500" />
                                        </label>
                                    )}
                                    <label className="flex items-center gap-2 cursor-pointer group/bespoke">
                                        <span className={`text-[8px] font-black uppercase tracking-tighter ${req.useManualParams ? 'text-amber-400' : 'text-slate-600'}`}>Bespoke</span>
                                        <input type="checkbox" checked={req.useManualParams} onChange={e => handleFieldChange(req.id, 'useManualParams', e.target.checked)} className="w-3 h-3 accent-amber-500" />
                                    </label>
                                </div>
                                <select 
                                    value={req.compatibilityLevel} 
                                    onChange={e => handleFieldChange(req.id, 'compatibilityLevel', e.target.value)} 
                                    disabled={req.useManualParams}
                                    className="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[9px] text-indigo-300 font-bold uppercase tracking-tighter disabled:opacity-30 outline-none"
                                >
                                    <option value="standard">Standard</option>
                                    <option value="aggressive">Aggressive</option>
                                    <option value="robust">Robust</option>
                                </select>
                            </div>

                            {!req.useManualParams && (
                                <div className="flex justify-end gap-3 px-1 pt-1 border-t border-white/5 opacity-70">
                                    <div className="flex items-center gap-1">
                                        <span className="text-[7px] text-slate-500 uppercase font-bold">Fund</span>
                                        <span className="text-[9px] text-indigo-300 font-mono">{activeTh.fundamental.toFixed(3)}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[7px] text-slate-500 uppercase font-bold">2-Tone</span>
                                        <span className="text-[9px] text-indigo-300 font-mono">{activeTh.twoTone.toFixed(3)}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[7px] text-slate-500 uppercase font-bold">3-Tone</span>
                                        <span className="text-[9px] text-indigo-300 font-mono">{activeTh.threeTone.toFixed(3)}</span>
                                    </div>
                                </div>
                            )}

                            {req.useManualParams && (
                                <div className="grid grid-cols-3 gap-1 px-1 pt-1 border-t border-white/5">
                                    <div className="space-y-0.5">
                                        <label className="text-[7px] text-slate-500 uppercase font-bold">Fund</label>
                                        <input 
                                            type="number" step="0.025" 
                                            value={req.manualFundamental} 
                                            onChange={e => handleFieldChange(req.id, 'manualFundamental', parseFloat(e.target.value))}
                                            className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[9px] text-amber-200 font-mono"
                                        />
                                    </div>
                                    <div className="space-y-0.5">
                                        <label className="text-[7px] text-slate-500 uppercase font-bold">2-Tone</label>
                                        <input 
                                            type="number" step="0.025" 
                                            value={req.manualTwoTone} 
                                            onChange={e => handleFieldChange(req.id, 'manualTwoTone', parseFloat(e.target.value))}
                                            className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[9px] text-amber-200 font-mono"
                                        />
                                    </div>
                                    <div className="space-y-0.5">
                                        <label className="text-[7px] text-slate-500 uppercase font-bold">3-Tone</label>
                                        <input 
                                            type="number" step="0.025" 
                                            value={req.manualThreeTone} 
                                            onChange={e => handleFieldChange(req.id, 'manualThreeTone', parseFloat(e.target.value))}
                                            className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[9px] text-amber-200 font-mono"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const ManualFrequencyManager: React.FC<{
    frequencies: Frequency[],
    onUpdate: (frequencies: Frequency[]) => void,
    db: Record<string, EquipmentProfile>,
    title: string,
    type: 'mic' | 'iem'
}> = ({ frequencies, onUpdate, db, title, type }) => {
    const handleAdd = () => {
        const defaultKey = type === 'iem' ? 'shure-psm1000-g10' : 'shure-ad-g56';
        onUpdate([...frequencies, { 
            id: `manual-${Date.now()}-${Math.random()}`, 
            value: 470.000, 
            equipmentKey: defaultKey, 
            type, 
            locked: true,
            label: `Manual ${type === 'mic' ? 'Mic' : 'IEM'}`,
            compatibilityLevel: 'standard'
        }]);
    };
    
    const handleRemove = (id: string) => onUpdate(frequencies.filter(f => f.id !== id));
    
    const handleFieldChange = (id: string, field: keyof Frequency, value: any) => {
        onUpdate(frequencies.map(f => f.id === id ? { ...f, [field]: value } : f));
    };

    const relevantFreqs = frequencies.filter(f => f.type === type && f.locked && f.id.startsWith('manual-'));

    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center mb-1 px-1">
                <h5 className={`text-[10px] font-black uppercase tracking-widest ${type === 'mic' ? 'text-emerald-400' : 'text-rose-400'}`}>{title}</h5>
                <button onClick={handleAdd} className={`text-[9px] px-2 py-0.5 rounded font-bold transition-all border ${type === 'mic' ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-600' : 'bg-rose-600/20 text-rose-300 border-rose-500/30 hover:bg-rose-600'} hover:text-white`}>+ Add Manual</button>
            </div>
            <div className="space-y-2">
                {relevantFreqs.map(freq => (
                    <div key={freq.id} className="bg-slate-950/40 p-2 rounded-xl border border-white/5 space-y-2">
                        <div className="grid grid-cols-[1fr,60px,auto] gap-2 items-center">
                            <select value={freq.equipmentKey} onChange={e => handleFieldChange(freq.id, 'equipmentKey', e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-1 py-1 text-[10px] text-slate-200 outline-none">
                                {(Object.entries(db) as [string, EquipmentProfile][])
                                    .filter(([k, p]) => {
                                        const pType = p.type || 'generic';
                                        return pType === type || pType === 'generic' || k === 'custom';
                                    })
                                    .map(([k, p]) => <option key={k} value={k}>{p.name} ({p.band})</option>)}
                            </select>
                            <input type="number" step="0.025" value={freq.value} onChange={e => handleFieldChange(freq.id, 'value', parseFloat(e.target.value) || 0)} className={`bg-slate-950 border border-slate-700 rounded px-1 py-1 text-[10px] font-bold text-center ${type === 'mic' ? 'text-emerald-400' : 'text-rose-400'}`} />
                            <button onClick={() => handleRemove(freq.id)} className="text-red-400 hover:text-red-300 font-bold text-xs px-1">&times;</button>
                        </div>
                        <div className="flex items-center gap-2 px-1">
                            <input type="text" value={freq.label || ''} onChange={e => handleFieldChange(freq.id, 'label', e.target.value)} placeholder="Label" className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-slate-300 outline-none" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TourPlanningTab;
