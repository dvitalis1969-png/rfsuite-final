import React, { useState, useEffect, useRef, useMemo } from 'react';
import Card, { CardTitle } from './Card';
import { Thresholds, Zone, ZoneConfig, Frequency, EquipmentProfile, CompatibilityLevel, TxType, TVChannelState, WMASState } from '../types';
import { generateMultizoneFrequencies, getFinalThresholds, getCoordinationDiagnostics, CoordinationDiagnostic } from '../services/rfService';
import { UK_TV_CHANNELS, EQUIPMENT_DATABASE, COMPATIBILITY_PROFILES } from '../constants';

type ChannelState = 'available' | 'mic-only' | 'iem-only' | 'blocked';

interface MultizoneTabProps {
    isLinked: boolean;
    setIsLinked: (isLinked: boolean) => void;
    numZones: number;
    setNumZones: (num: number) => void;
    zoneConfigs: ZoneConfig[]; // Physical Booths
    setZoneConfigs: (configs: ZoneConfig[]) => void;
    equipmentGroups: ZoneConfig[]; // Deployed Gear List
    setEquipmentGroups: (groups: ZoneConfig[]) => void;
    manualFrequencies?: Frequency[];
    setManualFrequencies?: (freqs: Frequency[]) => void;
    distances: number[][];
    setDistances: (distances: number[][]) => void;
    results: { zones: Zone[], spares: { mics: Frequency[], iems: Frequency[] } } | null;
    setResults: (results: { zones: Zone[], spares: { mics: Frequency[], iems: Frequency[] } } | null) => void;
    customEquipment: EquipmentProfile[];
    onManageCustomEquipment: () => void;
    compatibilityMatrix: boolean[][];
    setCompatibilityMatrix: React.Dispatch<React.SetStateAction<boolean[][]>>;
    equipmentOverrides?: Record<string, Partial<Thresholds>>;
    tvChannelStates?: Record<number, TVChannelState>;
    setTvChannelStates?: React.Dispatch<React.SetStateAction<Record<number, TVChannelState>>>;
    wmasState?: WMASState;
}

const buttonBase = "px-4 py-2 rounded-lg font-semibold uppercase tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transform active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed text-xs";
const primaryButton = `bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-b-4 border-indigo-800 hover:border-indigo-700 hover:brightness-110 ${buttonBase}`;
const secondaryButton = `bg-slate-700 text-slate-200 border-b-4 border-slate-900 hover:border-slate-800 hover:bg-slate-600 ${buttonBase}`;
const actionButton = `bg-cyan-600/80 text-white border-b-4 border-cyan-800 hover:border-cyan-700 hover:bg-cyan-600 ${buttonBase}`;
const greenButton = `bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600 hover:text-white ${buttonBase}`;

const MultizoneTab: React.FC<MultizoneTabProps> = ({ 
    numZones,
    setNumZones,
    zoneConfigs,
    setZoneConfigs,
    equipmentGroups,
    setEquipmentGroups,
    manualFrequencies = [],
    setManualFrequencies,
    distances,
    setDistances,
    results,
    setResults,
    customEquipment,
    onManageCustomEquipment,
    compatibilityMatrix,
    setCompatibilityMatrix,
    equipmentOverrides,
    tvChannelStates,
    setTvChannelStates,
    wmasState
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [localChannelStates, setLocalChannelStates] = useState<Record<number, ChannelState>>({});
    const channelStates = tvChannelStates || localChannelStates;
    const updateChannelStates = setTvChannelStates || setLocalChannelStates;
    const [showTabulation, setShowTabulation] = useState(false);
    const [proximityThreshold, setProximityThreshold] = useState<number>(10);
    const [diagnostic, setDiagnostic] = useState<CoordinationDiagnostic | null>(null);
    const [numZonesInput, setNumZonesInput] = useState(numZones.toString());
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [isWwbSubmenuOpen, setIsWwbSubmenuOpen] = useState(false);
    
    // Global Distance State
    const [globalDistInput, setGlobalDistInput] = useState<string>("15");

    // Sorting States
    const [sortField, setSortField] = useState<string>('freq');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const allTvChannels = Object.keys(UK_TV_CHANNELS).map(Number);

    const totalRequested = useMemo(() => equipmentGroups.reduce((a, b) => a + b.count, 0), [equipmentGroups]);
    const totalFound = useMemo(() => (results?.zones || []).reduce((s, z) => s + (z.frequencies || []).filter(f => f.value > 0).length, 0), [results]);

    const handleDistanceChange = (row: number, col: number, value: string) => {
        const next = distances.map(r => [...r]);
        const val = parseInt(value, 10) || 0;
        next[row][col] = val;
        if (row !== col) next[col][row] = val;
        setDistances(next);
    };

    const handleApplyGlobalDistance = () => {
        const val = parseInt(globalDistInput, 10);
        if (isNaN(val)) return;
        const next = distances.map((row, rIdx) => 
            row.map((col, cIdx) => (rIdx === cIdx ? 0 : val))
        );
        setDistances(next);
    };

    const handleMatrixChange = (row: number, col: number) => {
        const next = compatibilityMatrix.map(r => [...r]);
        next[row][col] = !next[row][col];
        if (row !== col) next[col][row] = next[row][col];
        setCompatibilityMatrix(next);
    };

    const handleTvChannelCycle = (channel: number) => {
        updateChannelStates(prev => {
            const current = prev[channel] || 'available';
            let next: ChannelState = 'available';
            if (current === 'available') next = 'mic-only';
            else if (current === 'mic-only') next = 'iem-only';
            else if (current === 'iem-only') next = 'blocked';
            else if (current === 'blocked') next = 'available';
            return { ...prev, [channel]: next };
        });
    };

    const handleResetChannels = () => {
        updateChannelStates({});
    };

    const handleBlockAllChannels = () => {
        const next: Record<number, ChannelState> = {};
        allTvChannels.forEach(ch => {
            next[ch] = 'blocked';
        });
        updateChannelStates(next);
    };

    useEffect(() => {
        setNumZonesInput(numZones.toString());
    }, [numZones]);

    const fullEquipmentDatabase = useMemo<Record<string, EquipmentProfile>>(() => {
        const customProfiles = (customEquipment || []).reduce((acc: Record<string, EquipmentProfile>, profile) => {
            if (profile.id) acc[profile.id] = profile;
            return acc;
        }, {} as Record<string, EquipmentProfile>);
        return { ...EQUIPMENT_DATABASE, ...customProfiles };
    }, [customEquipment]);

    const { shureProfiles, sennheiserProfiles, lectrosonicsProfiles } = useMemo<{
        shureProfiles: [string, EquipmentProfile][];
        sennheiserProfiles: [string, EquipmentProfile][];
        lectrosonicsProfiles: [string, EquipmentProfile][];
    }>(() => {
        const allEntries = Object.entries(fullEquipmentDatabase) as [string, EquipmentProfile][];
        const shure = allEntries.filter(([, p]) => p.name.toLowerCase().includes('shure'));
        const sennheiser = allEntries.filter(([, p]) => p.name.toLowerCase().includes('sennheiser'));
        const lectrosonics = allEntries.filter(([, p]) => p.name.toLowerCase().includes('lectrosonics'));
        return { shureProfiles: shure, sennheiserProfiles: sennheiser, lectrosonicsProfiles: lectrosonics };
    }, [fullEquipmentDatabase]);

    const handleNumZonesChange = (val: string) => {
        setNumZonesInput(val);
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 20) {
            setNumZones(parsed);
        }
    };

    const handleAddGroup = (zIdx: number = 0) => {
        const newGroup: ZoneConfig = {
            name: `Group ${equipmentGroups.length + 1}`,
            count: 6,
            equipmentKey: 'shure-ad-g56',
            compatibilityLevel: 'standard',
            zoneIndex: zIdx,
            linearMode: false,
            type: 'generic'
        };
        setEquipmentGroups([...equipmentGroups, newGroup]);
    };

    const handleDuplicateGroup = (index: number) => {
        const source = equipmentGroups[index];
        const newGroup: ZoneConfig = {
            ...source,
            name: `${source.name} (Copy)`
        };
        const next = [...equipmentGroups];
        next.splice(index + 1, 0, newGroup);
        setEquipmentGroups(next);
    };

    const handleRemoveGroup = (index: number) => {
        setEquipmentGroups(equipmentGroups.filter((_, i) => i !== index));
    };

    const handleGroupChange = (index: number, field: keyof ZoneConfig, value: any) => {
        const nextGroups = [...equipmentGroups];
        let updated = { ...nextGroups[index], [field]: value };

        if (field === 'equipmentKey') {
            const profile = fullEquipmentDatabase[value as string];
            if (profile && profile.recommendedThresholds?.threeTone !== 0) {
                updated.linearMode = false;
            }
        }

        if (field === 'useManualParams' && value === true) {
            const standardTh = getFinalThresholds(
                { equipmentKey: updated.equipmentKey || 'custom', compatibilityLevel: 'standard' }, 
                fullEquipmentDatabase, 
                equipmentOverrides
            );
            updated.manualFundamental = updated.manualFundamental ?? standardTh.fundamental;
            updated.manualTwoTone = updated.manualTwoTone ?? standardTh.twoTone;
            updated.manualThreeTone = updated.manualThreeTone ?? standardTh.threeTone;
        }

        if (field === 'equipmentKey' && value !== 'custom') {
            const profile = fullEquipmentDatabase[value];
            if (profile) {
                updated.customMin = profile.minFreq;
                updated.customMax = profile.maxFreq;
            }
        }

        nextGroups[index] = updated;
        setEquipmentGroups(nextGroups);
    };

    const handleZoneNameChange = (index: number, name: string) => {
        const nextConfigs = [...zoneConfigs];
        nextConfigs[index] = { ...nextConfigs[index], name };
        setZoneConfigs(nextConfigs);
    };

    const handleGlobalLock = (lock: boolean) => {
        if (!results) return;
        const nextZones = results.zones.map(zone => ({
            ...zone,
            frequencies: zone.frequencies.map(f => ({ ...f, locked: lock }))
        }));
        setResults({ ...results, zones: nextZones });
    };

    const handleZoneLock = (zoneIndex: number, lock: boolean) => {
        if (!results) return;
        const nextZones = results.zones.map((zone, idx) => {
            if (idx !== zoneIndex) return zone;
            return {
                ...zone,
                frequencies: zone.frequencies.map(f => ({ ...f, locked: lock }))
            };
        });
        setResults({ ...results, zones: nextZones });
    };

    const handleIndividualLock = (freqId: string) => {
        if (!results) return;
        const nextZones = results.zones.map(zone => ({
            ...zone,
            frequencies: zone.frequencies.map(f => {
                if (f.id === freqId) return { ...f, locked: !f.locked };
                return f;
            })
        }));
        setResults({ ...results, zones: nextZones });
    };

    const handleFrequencyValueChange = (freqId: string, newValue: string) => {
        if (!results) return;
        const val = parseFloat(newValue) || 0;
        const nextZones = results.zones.map(zone => ({
            ...zone,
            frequencies: zone.frequencies.map(f => {
                if (f.id === freqId) return { ...f, value: val };
                return f;
            })
        }));
        setResults({ ...results, zones: nextZones });
    };
    
    const handleFrequencyStep = (freqId: string, direction: 'up' | 'down') => {
        if (!results) return;
        const step = 0.025;
        const nextZones = results.zones.map(zone => ({
            ...zone,
            frequencies: zone.frequencies.map(f => {
                if (f.id === freqId) {
                    const currentVal = f.value || 0;
                    const newVal = parseFloat((direction === 'up' ? currentVal + step : currentVal - step).toFixed(5));
                    return { ...f, value: newVal };
                }
                return f;
            })
        }));
        setResults({ ...results, zones: nextZones });
    };

    const handleAddManualFrequency = (zoneIndex: number) => {
        if (!results) return;
        const nextZones = results.zones.map((zone, idx) => {
            if (idx !== zoneIndex) return zone;
            const newFreq: Frequency = {
                id: `MANUAL-${Date.now()}-${Math.random()}`,
                value: 0,
                label: 'Manual Entry',
                locked: false,
                zoneIndex: zoneIndex
            };
            return {
                ...zone,
                frequencies: [...zone.frequencies, newFreq]
            };
        });
        setResults({ ...results, zones: nextZones });
    };

    const handleRemoveFrequency = (freqId: string) => {
        if (!results) return;
        const nextZones = results.zones.map(zone => ({
            ...zone,
            frequencies: zone.frequencies.filter(f => f.id !== freqId)
        }));
        setResults({ ...results, zones: nextZones });
    };

    const handleAddFixedFreq = () => {
        if (!setManualFrequencies) return;
        const newFreq: Frequency = {
            id: `FIXED-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            value: 470.000,
            label: 'Fixed Frequency',
            locked: true,
            zoneIndex: 0,
            type: 'generic'
        };
        setManualFrequencies([...manualFrequencies, newFreq]);
    };

    const handleUpdateFixedFreq = (id: string, field: keyof Frequency, value: any) => {
        if (!setManualFrequencies) return;
        setManualFrequencies(manualFrequencies.map(f => f.id === id ? { ...f, [field]: value } : f));
    };

    const handleRemoveFixedFreq = (id: string) => {
        if (!setManualFrequencies) return;
        setManualFrequencies(manualFrequencies.filter(f => f.id !== id));
    };

    const handleCalculate = async () => {
        setIsLoading(true);
        setProgress(0);
        setDiagnostic(null);
        
        try {
            const tvExclusions: {min: number, max: number}[] = [];
            Object.entries(channelStates).forEach(([chStr, state]) => {
                const ch = Number(chStr);
                if (state === 'blocked') {
                    const range = UK_TV_CHANNELS[ch];
                    if (range) tvExclusions.push({ min: range[0], max: range[1] });
                }
            });

            if (wmasState && wmasState.nodes) {
                wmasState.nodes.forEach(node => {
                    if (node.assignedBlock) {
                        tvExclusions.push({
                            min: node.assignedBlock.start,
                            max: node.assignedBlock.end
                        });
                    }
                });
            }

            const calculatedResults = await generateMultizoneFrequencies(
                equipmentGroups,
                fullEquipmentDatabase,
                compatibilityMatrix,
                distances,
                results,
                tvExclusions, 
                equipmentOverrides,
                channelStates,
                'uk',
                (p) => setProgress(p),
                manualFrequencies
            );
            setResults(calculatedResults);

            const totalReq = equipmentGroups.reduce((a, b) => a + b.count, 0);
            const totalFnd = (calculatedResults.zones || []).reduce((s, z) => s + (z.frequencies || []).filter(f=>f.value > 0).length, 0);
            
            const diag = getCoordinationDiagnostics(
                totalReq, 
                totalFnd, 
                470, 702, [], 
                { fundamental: 0.35, twoTone: 0.1, threeTone: 0.1, fiveTone: 0, sevenTone: 0 }
            );
            setDiagnostic(diag);
        } catch (error) {
            console.error(error);
            alert("Calculation error.");
        } finally {
            setIsLoading(false);
            setProgress(1);
        }
    };

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const SortArrow = ({ field }: { field: string }) => {
        if (sortField !== field) return <span className="ml-1 opacity-20 group-hover:opacity-100 transition-opacity">⇅</span>;
        return <span className="ml-1 text-cyan-400 font-black">{sortDirection === 'asc' ? '▲' : '▼'}</span>;
    };

    const tabulatedData = useMemo(() => {
        if (!results || !results.zones) return [];
        const baseData = results.zones.flatMap(zone => (zone.frequencies || []).filter(f => f.value > 0).map(f => {
            const profile = f.equipmentKey ? fullEquipmentDatabase[f.equipmentKey] : null;
            return {
                freq: f.value,
                zone: zone.name,
                id: f.id,
                locked: !!f.locked,
                label: f.label || 'Unlabelled',
                modelName: profile?.name || 'Custom',
                bandName: profile?.band.split(' ')[0] || 'Custom',
                wwbType: f.type === 'iem' ? 'In-ear Monitor' : 'Frequency',
                equipmentKey: f.equipmentKey,
                affiliateUrl: profile?.affiliateUrl
            };
        }));

        return baseData.sort((a: any, b: any) => {
            const valA = a[sortField];
            const valB = b[sortField];
            if (typeof valA === 'string' && typeof valB === 'string') {
                const comparison = valA.localeCompare(valB);
                return sortDirection === 'asc' ? comparison : -comparison;
            }
            const numA = parseFloat(valA) || 0;
            const numB = parseFloat(valB) || 0;
            return sortDirection === 'asc' ? numA - numB : numB - numA;
        });
    }, [results, fullEquipmentDatabase, sortField, sortDirection]);

    const uniqueWwbGroups = useMemo(() => {
        const groups: Record<string, { name: string, count: number }> = {};
        tabulatedData.forEach(f => {
            if (!f.equipmentKey) return;
            if (!groups[f.equipmentKey]) {
                groups[f.equipmentKey] = { name: f.modelName, count: 0 };
            }
            groups[f.equipmentKey].count++;
        });
        return Object.entries(groups).map(([key, data]) => ({ key, ...data }));
    }, [tabulatedData]);

    const handleWwbSmartExport = (eqKey?: string) => {
        setIsExportMenuOpen(false);
        setIsWwbSubmenuOpen(false);
        let freqs = tabulatedData;
        let filename = `WWB_COORD_MULTIZONE_${new Date().toISOString().slice(0, 10)}`;
        if (eqKey) {
            freqs = freqs.filter(f => f.equipmentKey === eqKey);
            const group = uniqueWwbGroups.find(g => g.key === eqKey);
            const cleanedName = (group?.name || eqKey).replace(/\s+/g, '_').toUpperCase();
            filename += `_${cleanedName}`;
        }
        const content = freqs.map(f => f.freq.toFixed(3)).join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExport = (format: 'pdf' | 'csv' | 'xls' | 'doc' | 'txt' | 'wwb') => {
        setIsExportMenuOpen(false);
        const data = tabulatedData;
        const filename = `exhibition_rf_plan_${new Date().toISOString().slice(0, 10)}`;

        if (format === 'wwb') {
            let content = "Frequency,Name,Type,Band,RF Profile\n";
            data.forEach(row => {
                const cleanedProfile = row.modelName.replace(/^Shure\s+/i, '').replace(/\s*\(.*?\)/g, '').trim();
                content += `${row.freq.toFixed(3)},"${row.label}","${row.wwbType}","${row.bandName}","${cleanedProfile}"\n`;
            });
            const blob = new Blob([content], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}_WWB_Coordination.csv`;
            a.click();
        } else if (format === 'csv' || format === 'xls') {
            let content = "Frequency (MHz),Designation,ID,Location,Hardware Model\n";
            data.forEach(row => {
                content += `${row.freq.toFixed(3)},"${row.label || ''}",${row.id},"${row.zone}","${row.modelName} ${row.bandName}"\n`;
            });
            const blob = new Blob([content], { type: format === 'xls' ? 'application/vnd.ms-excel' : 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `${filename}.${format}`; a.click();
        } else if (format === 'txt') {
            let content = "EXHIBITION RF COORDINATION PLAN\n=================================\n\n";
            data.forEach(row => {
                content += `${row.freq.toFixed(3)} MHz | ${row.label || 'No Label'} | ${row.zone} | ${row.modelName}\n`;
            });
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `${filename}.txt`; a.click();
        } else if (format === 'doc') {
            let html = `<html><body><h1>Exhibition RF Coordination Plan</h1><table border="1">
                <tr><th>Frequency (MHz)</th><th>Designation</th><th>ID</th><th>Location</th><th>Hardware</th></tr>
                ${data.map(row => `<tr><td>${row.freq.toFixed(3)}</td><td>${row.label || ''}</td><td>${row.id}</td><td>${row.zone}</td><td>${row.modelName}</td></tr>`).join('')}
            </table></body></html>`;
            const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `${filename}.doc`; a.click();
        } else if (format === 'pdf') {
            // @ts-ignore
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.setFontSize(18);
            doc.text("Exhibition RF Coordination Plan", 14, 20);
            doc.setFontSize(10);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
            const tableData = data.map(row => [row.freq.toFixed(3), row.label || '—', row.id, row.zone, row.modelName]);
            // @ts-ignore
            doc.autoTable({
                startY: 35,
                head: [['Frequency', 'Designation', 'ID', 'Location', 'Hardware']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [79, 70, 229] }
            });
            doc.save(`${filename}.pdf`);
        }
    };

    const renderEquipmentOptions = () => (
        <>
            <optgroup label="General"><option value="custom">Custom Range</option></optgroup>
            {customEquipment && customEquipment.length > 0 && <optgroup label="My Custom">{customEquipment.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
            <optgroup label="Shure">{(shureProfiles || []).map(([k, p]) => <option key={k} value={k}>{p.name} ({p.band})</option>)}</optgroup>
            <optgroup label="Sennheiser">{(sennheiserProfiles || []).map(([k, p]) => <option key={k} value={k}>{p.name} ({p.band})</option>)}</optgroup>
            <optgroup label="Lectrosonics">{(lectrosonicsProfiles || []).map(([k, p]) => <option key={k} value={k}>{p.name} ({p.band})</option>)}</optgroup>
        </>
    );

    return (
        <div className="space-y-6 relative">
            {/* Floating Calculate Button */}
            <div className="fixed bottom-8 right-8 z-[100] animate-in slide-in-from-bottom-10 duration-500">
                <button 
                    onClick={handleCalculate} 
                    disabled={isLoading}
                    className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase tracking-[0.2em] transition-all duration-300 shadow-[0_20px_50px_rgba(79,70,229,0.4)] hover:shadow-[0_25px_60px_rgba(79,70,229,0.6)] hover:-translate-y-1 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-wait text-sm border-2 border-white/20 backdrop-blur-md ${isLoading ? 'bg-slate-800' : 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white'}`}
                >
                    {isLoading ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Trial {Math.round(progress * 50)} / 50...</span>
                        </>
                    ) : (
                        <>
                            <span className="text-xl">⚡</span>
                            <span>CALCULATE PLAN</span>
                        </>
                    )}
                </button>
            </div>

            <Card>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <CardTitle className="!mb-0">🏢 Zonal Site Planning</CardTitle>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Multi-Equipment Spatial Coordination Engine</p>
                    </div>
                    <div className="flex gap-4 items-center">
                        <div className="flex flex-col items-end">
                            <label className="text-[9px] text-slate-500 font-black uppercase mb-1">Zones/Locations</label>
                            <input type="number" value={numZonesInput} onChange={e => handleNumZonesChange(e.target.value)} min="1" max="20" className="w-20 bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-center text-indigo-400 font-black" />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-950/50 rounded-xl border border-white/5">
                    <div className="lg:col-span-3">
                        <label className="text-[10px] text-slate-500 font-black uppercase mb-2 block tracking-widest">Zone Designation List</label>
                        <div className="flex flex-wrap gap-3">
                            {zoneConfigs.map((cfg, idx) => (
                                <div key={idx} className="flex bg-slate-800 rounded-lg border border-slate-700 overflow-hidden shadow-md group">
                                    <span className="bg-slate-700 px-2 flex items-center text-[10px] font-black text-slate-400">{idx + 1}</span>
                                    <input 
                                        type="text" 
                                        value={cfg.name} 
                                        onChange={e => handleZoneNameChange(idx, e.target.value)} 
                                        className="bg-transparent px-2 py-1 text-[11px] text-white font-bold outline-none w-32 focus:bg-indigo-900/30"
                                    />
                                    <button 
                                        onClick={() => handleAddGroup(idx)}
                                        className="px-2 bg-emerald-600/20 text-emerald-400 border-l border-white/5 hover:bg-emerald-600 hover:text-white transition-all text-[10px] font-black"
                                        title="Add Equipment to this Zone"
                                    >
                                        + GEAR
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-col justify-center items-end">
                        <label className="text-[10px] text-slate-500 font-black uppercase mb-1 block">Proximity Guard (m)</label>
                        <input type="number" value={proximityThreshold} onChange={e => setProximityThreshold(Number(e.target.value))} className="w-20 bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-center text-cyan-400 font-black" />
                    </div>
                </div>
            </Card>

            <Card>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <CardTitle className="!mb-0 text-sm tracking-widest text-indigo-300 uppercase font-black">📺 Type-Aware TV Grid</CardTitle>
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter mt-1">Prescribe specific channels for separation. Click to cycle states.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex gap-3 text-[8px] font-black uppercase overflow-x-auto pb-1 scrollbar-hide">
                            <div className="flex items-center gap-1.5 whitespace-nowrap"><div className="w-2 h-2 rounded bg-emerald-500/10 border border-emerald-500/30" /> <span className="text-slate-400">Available</span></div>
                            <div className="flex items-center gap-1.5 whitespace-nowrap"><div className="w-2 h-2 rounded bg-sky-400 border border-sky-300" /> <span className="text-sky-400">Mic Only</span></div>
                            <div className="flex items-center gap-1.5 whitespace-nowrap"><div className="w-2 h-2 rounded bg-amber-500 border border-amber-400" /> <span className="text-amber-500">IEM Only</span></div>
                            <div className="flex items-center gap-1.5 whitespace-nowrap"><div className="w-2 h-2 rounded bg-rose-600 border border-rose-500" /> <span className="text-rose-500">Blocked</span></div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleBlockAllChannels} className="text-[9px] font-black uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-1 rounded hover:bg-rose-600 hover:text-white transition-all">Block All</button>
                            <button onClick={handleResetChannels} className="text-[9px] font-black uppercase bg-slate-800 text-slate-400 border border-slate-700 px-2 py-1 rounded hover:bg-slate-700 hover:text-white transition-all">Clear All</button>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-11 gap-2 p-2 bg-slate-950/30 rounded-xl">
                    {allTvChannels.map((ch) => {
                        const state = channelStates[ch] || 'available';
                        const range = UK_TV_CHANNELS[ch];
                        
                        let channelClasses = 'p-1.5 text-center rounded-lg border-2 transition-all cursor-pointer select-none ';
                        if (state === 'blocked') channelClasses += 'bg-rose-600 border-rose-500 hover:bg-rose-500 shadow-lg';
                        else if (state === 'mic-only') channelClasses += 'bg-sky-400 border-sky-300 hover:bg-sky-300 shadow-lg';
                        else if (state === 'iem-only') channelClasses += 'bg-amber-500 border-amber-400 hover:bg-amber-400 shadow-lg';
                        else channelClasses += 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/50';

                        return (
                            <div key={ch} onClick={() => handleTvChannelCycle(ch)} className={channelClasses}>
                                <div className={`text-[10px] font-black ${state === 'available' ? 'text-emerald-400' : 'text-slate-900'}`}>CH {ch}</div>
                                <div className={`text-[8px] font-mono tracking-tighter ${state === 'available' ? 'text-slate-500' : 'text-white/60'}`}>{range[0]}-{range[1]}</div>
                                <div className={`mt-1 text-[7px] font-black uppercase ${state === 'available' ? 'text-white/10' : 'text-white/40'}`}>
                                    {state === 'mic-only' && 'MIC'}
                                    {state === 'iem-only' && 'IEM'}
                                    {state === 'blocked' && 'OFF'}
                                    {state === 'available' && '—'}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>

            <Card className="!bg-slate-900/80 border-indigo-500/30">
                <div className="flex justify-between items-center mb-6">
                    <CardTitle className="!mb-0 text-sm tracking-[0.2em] text-indigo-300 uppercase font-black">⚙️ Hardware Deployment Ledger</CardTitle>
                    <button onClick={() => handleAddGroup()} className={greenButton}>+ Add General Hardware Row</button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-white/5 shadow-2xl">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-950 text-[9px] uppercase font-black text-slate-500 tracking-widest border-b border-white/10">
                                <th className="p-4">Zone Assignment</th>
                                <th className="p-4">Hardware Group Name</th>
                                <th className="p-4">Hardware Profile</th>
                                <th className="p-4 w-16 text-center">Qty</th>
                                <th className="p-4">Type</th>
                                <th className="p-4">IMD Level</th>
                                <th className="p-4">HD Mode</th>
                                <th className="p-4">Custom Range</th>
                                <th className="p-4 text-center">Bespoke</th>
                                <th className="p-4 w-20 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {equipmentGroups.map((group, idx) => {
                                const activeTh = group.useManualParams 
                                    ? { fundamental: group.manualFundamental || 0, twoTone: group.manualTwoTone || 0, threeTone: group.manualThreeTone || 0 }
                                    : getFinalThresholds({ equipmentKey: group.equipmentKey || 'custom', compatibilityLevel: group.compatibilityLevel || 'standard' }, fullEquipmentDatabase, equipmentOverrides);

                                return (
                                    <tr key={idx} className="hover:bg-indigo-500/5 transition-colors group">
                                        <td className="p-2">
                                            <select 
                                                value={group.zoneIndex} 
                                                onChange={e => handleGroupChange(idx, 'zoneIndex', parseInt(e.target.value))}
                                                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-indigo-300 font-black"
                                            >
                                                {zoneConfigs.map((zc, zIdx) => <option key={zIdx} value={zIdx}>Zone {zIdx + 1}: {zc.name}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-2">
                                            <input 
                                                type="text" 
                                                value={group.name} 
                                                onChange={e => handleGroupChange(idx, 'name', e.target.value)} 
                                                placeholder="Group ID"
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white font-bold"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <select 
                                                value={group.equipmentKey} 
                                                onChange={e => handleGroupChange(idx, 'equipmentKey', e.target.value)}
                                                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300"
                                            >
                                                {renderEquipmentOptions()}
                                            </select>
                                        </td>
                                        <td className="p-2">
                                            <input 
                                                type="number" 
                                                value={group.count} 
                                                onChange={e => handleGroupChange(idx, 'count', parseInt(e.target.value) || 0)} 
                                                className="w-14 bg-slate-950 border border-slate-700 rounded px-1.5 py-1.5 text-xs text-center text-indigo-400 font-black"
                                            />
                                        </td>
                                        <td className="p-2">
                                            {group.equipmentKey === 'custom' ? (
                                                <select 
                                                    value={group.type || 'generic'} 
                                                    onChange={e => handleGroupChange(idx, 'type', e.target.value)}
                                                    className="w-full bg-slate-800 border border-blue-500/30 rounded px-2 py-1.5 text-[10px] uppercase font-black text-slate-200"
                                                >
                                                    <option value="generic">Gen</option>
                                                    <option value="mic">Mic</option>
                                                    <option value="iem">IEM</option>
                                                    <option value="comms">Com</option>
                                                    <option value="wmas">WMAS</option>
                                                </select>
                                            ) : (
                                                <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest px-2">Auto</span>
                                            )}
                                        </td>
                                        <td className="p-2">
                                            <div className="relative group/tooltip">
                                                <select 
                                                    value={group.compatibilityLevel} 
                                                    onChange={e => handleGroupChange(idx, 'compatibilityLevel', e.target.value)}
                                                    disabled={group.useManualParams}
                                                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[10px] uppercase font-black text-slate-400 disabled:opacity-30"
                                                >
                                                    <option value="standard">Standard</option>
                                                    <option value="aggressive">Aggressive</option>
                                                    <option value="robust">Robust</option>
                                                </select>
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block z-[200] animate-in fade-in zoom-in-95 duration-200">
                                                    <div className="bg-slate-950 border border-indigo-500/50 rounded-xl shadow-2xl backdrop-blur-xl whitespace-nowrap p-3">
                                                        <div className="flex gap-4 items-center">
                                                            <div className="flex flex-col">
                                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Fundamental</span>
                                                                <span className="text-[10px] font-mono font-bold text-indigo-300">{(activeTh.fundamental * 1000).toFixed(0)}kHz</span>
                                                            </div>
                                                            <div className="w-px h-4 bg-white/10" />
                                                            <div className="flex flex-col">
                                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">2-Tone</span>
                                                                <span className="text-[10px] font-mono font-bold text-rose-300">{(activeTh.twoTone * 1000).toFixed(0)}kHz</span>
                                                            </div>
                                                            <div className="w-px h-4 bg-white/10" />
                                                            <div className="flex flex-col">
                                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">3-Tone</span>
                                                                <span className="text-[10px] font-mono font-bold text-purple-300">{(activeTh.threeTone * 1000).toFixed(0)}kHz</span>
                                                            </div>
                                                        </div>
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-950" />
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-2">
                                            {fullEquipmentDatabase[group.equipmentKey || 'custom']?.recommendedThresholds?.threeTone === 0 && (
                                                <label className="flex items-center justify-center cursor-pointer group/lin">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={group.linearMode} 
                                                        onChange={e => handleGroupChange(idx, 'linearMode', e.target.checked)} 
                                                        className="w-4 h-4 rounded accent-cyan-500 bg-slate-900 border-slate-700" 
                                                    />
                                                    <div className="hidden group-hover/lin:block absolute bottom-full mb-2 z-50 bg-slate-950 border border-cyan-500/50 p-2 rounded text-[8px] text-cyan-200 uppercase font-black w-32 text-center shadow-2xl">
                                                        Forces 0kHz IMD guards. USE FOR DIGITAL ONLY.
                                                    </div>
                                                </label>
                                            )}
                                        </td>
                                        <td className="p-2">
                                            <div className="flex gap-2">
                                                <input 
                                                    type="number" step="0.001" value={group.customMin} 
                                                    onChange={e => handleGroupChange(idx, 'customMin', parseFloat(e.target.value))}
                                                    className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-1.5 text-[10px] text-cyan-400 font-mono text-center" 
                                                />
                                                <input 
                                                    type="number" step="0.001" value={group.customMax} 
                                                    onChange={e => handleGroupChange(idx, 'customMax', parseFloat(e.target.value))}
                                                    className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-1.5 text-[10px] text-cyan-400 font-mono text-center" 
                                                />
                                            </div>
                                        </td>
                                        <td className="p-2 text-center">
                                            <div className="flex flex-col items-center gap-1.5 justify-center">
                                                <input type="checkbox" checked={group.useManualParams} onChange={e => handleGroupChange(idx, 'useManualParams', e.target.checked)} className="w-4 h-4 accent-amber-500" />
                                                {group.useManualParams && (
                                                    <div className="flex gap-1 animate-in fade-in slide-in-from-top-1">
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[7px] text-slate-500 font-bold uppercase tracking-tighter">FF</span>
                                                            <input 
                                                                type="number" step="0.001" 
                                                                value={group.manualFundamental ?? ''} 
                                                                onChange={e => handleGroupChange(idx, 'manualFundamental', parseFloat(e.target.value))}
                                                                className="w-16 bg-slate-950 border border-amber-500/30 rounded p-0.5 text-[9px] text-amber-400 text-center font-mono" 
                                                            />
                                                        </div>
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[7px] text-slate-500 font-bold uppercase tracking-tighter">2T</span>
                                                            <input 
                                                                type="number" step="0.001" 
                                                                value={group.manualTwoTone ?? ''} 
                                                                onChange={e => handleGroupChange(idx, 'manualTwoTone', parseFloat(e.target.value))}
                                                                className="w-16 bg-slate-950 border border-amber-500/30 rounded p-0.5 text-[9px] text-amber-400 text-center font-mono" 
                                                            />
                                                        </div>
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[7px] text-slate-500 font-bold uppercase tracking-tighter">3T</span>
                                                            <input 
                                                                type="number" step="0.001" 
                                                                value={group.manualThreeTone ?? ''} 
                                                                onChange={e => handleGroupChange(idx, 'manualThreeTone', parseFloat(e.target.value))}
                                                                className="w-16 bg-slate-950 border border-amber-500/30 rounded p-0.5 text-[9px] text-amber-400 text-center font-mono" 
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-2 text-right">
                                            <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                                                <button 
                                                    onClick={() => handleDuplicateGroup(idx)} 
                                                    className="text-cyan-400 hover:text-cyan-300 font-black text-[10px] uppercase tracking-tighter"
                                                    title="Duplicate Row"
                                                >
                                                    Clone
                                                </button>
                                                <button 
                                                    onClick={() => handleRemoveGroup(idx)} 
                                                    className="text-rose-500 hover:text-rose-400 font-black text-[16px]"
                                                    title="Delete Row"
                                                >
                                                    &times;
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="mt-6 flex justify-between items-center">
                    <div className="bg-slate-950 px-4 py-2 rounded-xl border border-white/5">
                        <span className="text-[10px] text-slate-500 uppercase font-black">Total Requested Units:</span>
                        <span className="ml-2 text-lg text-white font-black">{equipmentGroups.reduce((a, b) => a + b.count, 0)}</span>
                    </div>
                    <button onClick={handleCalculate} disabled={isLoading} className={primaryButton}>
                        {isLoading ? 'DEEP SCAN IN PROGRESS...' : 'GENERATE MULTI-EQUIPMENT PLAN'}
                    </button>
                </div>
            </Card>

            <Card className="!bg-slate-900/80 border-rose-500/30">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <CardTitle className="!mb-0 text-sm tracking-[0.2em] text-rose-300 uppercase font-black">📌 Fixed Frequency Injections</CardTitle>
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter mt-1">Manually assign specific frequencies to zones (e.g., for fixed hardware).</p>
                    </div>
                    <button onClick={handleAddFixedFreq} className={greenButton}>+ Add Fixed Frequency</button>
                </div>

                {manualFrequencies.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-white/5 shadow-2xl">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-950 text-[9px] uppercase font-black text-slate-500 tracking-widest border-b border-white/10">
                                    <th className="p-4">Zone Assignment</th>
                                    <th className="p-4">Label / Designation</th>
                                    <th className="p-4">Frequency (MHz)</th>
                                    <th className="p-4">Type</th>
                                    <th className="p-4 w-20 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {manualFrequencies.map((freq) => (
                                    <tr key={freq.id} className="hover:bg-rose-500/5 transition-colors group">
                                        <td className="p-2">
                                            <select 
                                                value={freq.zoneIndex} 
                                                onChange={e => handleUpdateFixedFreq(freq.id, 'zoneIndex', parseInt(e.target.value))}
                                                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-rose-300 font-black"
                                            >
                                                {zoneConfigs.map((zc, zIdx) => <option key={zIdx} value={zIdx}>Zone {zIdx + 1}: {zc.name}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-2">
                                            <input 
                                                type="text" 
                                                value={freq.label || ''} 
                                                onChange={e => handleUpdateFixedFreq(freq.id, 'label', e.target.value)} 
                                                placeholder="e.g. Presenter Mic"
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white font-bold"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input 
                                                type="number" step="0.001"
                                                value={freq.value || ''} 
                                                onChange={e => handleUpdateFixedFreq(freq.id, 'value', parseFloat(e.target.value))} 
                                                className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-center text-cyan-400 font-mono font-black"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <select 
                                                value={freq.type || 'generic'} 
                                                onChange={e => handleUpdateFixedFreq(freq.id, 'type', e.target.value)}
                                                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[10px] uppercase font-black text-slate-200"
                                            >
                                                <option value="generic">Generic</option>
                                                <option value="mic">Mic</option>
                                                <option value="iem">IEM</option>
                                                <option value="comms">Comms</option>
                                            </select>
                                        </td>
                                        <td className="p-2 text-right">
                                            <button 
                                                onClick={() => handleRemoveFixedFreq(freq.id)} 
                                                className="text-rose-500 hover:text-rose-400 font-black text-[16px] opacity-0 group-hover:opacity-100 transition-opacity pr-2"
                                                title="Remove Fixed Frequency"
                                            >
                                                &times;
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-8 bg-slate-950/50 rounded-xl border border-dashed border-slate-700">
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">No fixed frequencies added.</p>
                    </div>
                )}
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <CardTitle className="!mb-0 text-sm font-black uppercase tracking-widest">📍 Distance Matrix (m)</CardTitle>
                        <div className="flex bg-slate-950 border border-indigo-500/30 rounded-lg p-1 items-center gap-2">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-2">Global Separation:</span>
                            <input 
                                type="number" 
                                value={globalDistInput} 
                                onChange={e => setGlobalDistInput(e.target.value)}
                                className="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-cyan-400 text-center outline-none" 
                            />
                            <button 
                                onClick={handleApplyGlobalDistance}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white text-[8px] font-black uppercase px-2 py-1 rounded transition-colors"
                            >
                                Apply All
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-slate-700 shadow-inner bg-black/20">
                        <table className="w-full text-[10px] border-collapse text-center">
                            <thead>
                                <tr className="bg-slate-950">
                                    <th className="p-2 border border-slate-800"></th>
                                    {zoneConfigs.map((z, i) => <th key={i} className="p-2 border border-slate-800 text-slate-500 font-black">{i+1}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {distances.map((row, rIdx) => (
                                    <tr key={rIdx}>
                                        <th className="p-2 border border-slate-800 bg-slate-950 text-slate-500 font-black">{rIdx+1}</th>
                                        {row.map((val, cIdx) => (
                                            <td key={cIdx} className="p-0 border border-slate-800">
                                                {rIdx === cIdx ? <div className="h-10 bg-slate-900/50" /> : <input type="number" value={val} onChange={e => handleDistanceChange(rIdx, cIdx, e.target.value)} className="w-full h-10 bg-transparent text-center font-mono text-cyan-400 outline-none focus:bg-indigo-600/10" />}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
                <Card>
                    <CardTitle className="text-sm font-black uppercase tracking-widest">⛓️ Manual IMD Links</CardTitle>
                    <div className="overflow-x-auto rounded-lg border border-slate-700 shadow-inner bg-black/20">
                        <table className="w-full text-[10px] border-collapse text-center">
                            <thead>
                                <tr className="bg-slate-950">
                                    <th className="p-2 border border-slate-800"></th>
                                    {zoneConfigs.map((z, i) => <th key={i} className="p-2 border border-slate-800 text-slate-500 font-black">{i+1}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {compatibilityMatrix.map((row, rIdx) => (
                                    <tr key={rIdx}>
                                        <th className="p-2 border border-slate-800 bg-slate-950 text-slate-500 font-black">{rIdx+1}</th>
                                        {row.map((val, cIdx) => (
                                            <td key={cIdx} className="p-1 border border-slate-800 text-center">
                                                {rIdx === cIdx ? '—' : <input type="checkbox" checked={val} onChange={() => handleMatrixChange(rIdx, cIdx)} className="w-3 h-3 accent-indigo-500" />}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            <div className="space-y-4">
                {(isLoading || results) && (
                    <div className="bg-slate-800/80 border border-blue-500/20 rounded-xl p-4 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex justify-between items-center mb-2.5">
                            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em]">
                                {isLoading ? `Deep Search Trial ${Math.round(progress * 50)} / 50...` : 'Total Zonal Spectral Yield'}
                            </span>
                            <span className="text-xs font-bold text-white font-mono">
                                {isLoading ? `${Math.round(progress * 100)}%` : `${totalFound} / ${totalRequested} Frequencies`}
                            </span>
                        </div>
                        <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-white/5 shadow-inner">
                            <div 
                                className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-full transition-all duration-300 shadow-[0_0_15px_rgba(99,102,241,0.5)]" 
                                style={{ width: `${Math.min(100, (isLoading ? progress : (totalFound / (totalRequested || 1))) * 100)}%` }}
                            />
                        </div>
                        {isLoading && (
                            <p className="mt-2 text-center text-[9px] text-slate-500 uppercase font-black tracking-widest animate-pulse">Running 50-Trial Spatially-Weighted Monte Carlo Simulation...</p>
                        )}
                    </div>
                )}
            </div>

            {results && (
                <Card className="!bg-slate-950 border-cyan-500/30">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                        <div>
                            <CardTitle className="!mb-0 text-cyan-400 uppercase tracking-widest text-sm font-black">Master Zonal Deployment Report</CardTitle>
                            <p className="text-[10px] text-slate-500 uppercase mt-1">Status: Coordination Complete - Use padlocks to preserve frequencies</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => handleGlobalLock(true)} className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase hover:bg-amber-500 hover:text-white transition-all">🔒 Lock All Results</button>
                            <button onClick={() => handleGlobalLock(false)} className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 border border-slate-600 text-[10px] font-black uppercase hover:bg-slate-600 transition-all">🔓 Unlock All Results</button>
                            <button onClick={() => setShowTabulation(!showTabulation)} className={actionButton}>{showTabulation ? 'Hide Table' : '📊 View Ledger'}</button>
                            <div className="relative">
                                <button 
                                    onClick={() => { setIsExportMenuOpen(!isExportMenuOpen); setIsWwbSubmenuOpen(false); }} 
                                    className={`${primaryButton} flex items-center gap-2`}
                                >
                                    <span>📤</span> EXPORT PLAN
                                    <span className={`transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`}>▼</span>
                                </button>
                                {isExportMenuOpen && (
                                    <div className="absolute top-full right-0 mt-2 bg-slate-800 border border-indigo-500/40 rounded-xl shadow-2xl z-[110] overflow-hidden min-w-[220px] animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="grid grid-cols-1 divide-y divide-white/5">
                                            {/* WWB SMART EXPORT SUBMENU */}
                                            <button onClick={() => setIsWwbSubmenuOpen(!isWwbSubmenuOpen)} className="w-full text-left p-3 hover:bg-indigo-600 transition-colors flex items-center justify-between bg-indigo-500/10">
                                                <div className="flex flex-col">
                                                    <span className="text-white font-bold text-[10px] uppercase tracking-wider">WWB Smart Export (.TXT)</span>
                                                    <span className="text-[8px] text-indigo-300 font-black">Grouped by Hardware Group</span>
                                                </div>
                                                <span className={`text-xs transition-transform ${isWwbSubmenuOpen ? 'rotate-90' : ''}`}>▶</span>
                                            </button>
                                            {isWwbSubmenuOpen && (
                                                <div className="bg-slate-950 border-l-2 border-indigo-500 py-1 animate-in slide-in-from-right-2 duration-200">
                                                    <button onClick={() => handleWwbSmartExport()} className="w-full text-left px-4 py-2 hover:bg-slate-800 text-[9px] font-bold text-slate-300 uppercase tracking-tighter">
                                                        &bull; Export Full Site List
                                                    </button>
                                                    {uniqueWwbGroups.map(group => (
                                                        <button 
                                                            key={group.key}
                                                            onClick={() => handleWwbSmartExport(group.key)}
                                                            className="w-full text-left px-4 py-2 hover:bg-slate-800 text-[9px] font-bold text-indigo-400 uppercase tracking-tighter border-t border-white/5"
                                                        >
                                                            &bull; Export {group.name} - {group.count} CH
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            <button onClick={() => handleExport('pdf')} className="w-full text-left p-3 hover:bg-indigo-600 transition-colors flex items-center justify-between group">
                                                <div className="flex flex-col">
                                                    <span className="text-white font-bold text-[10px] uppercase tracking-wider">PDF Document</span>
                                                </div>
                                                <span className="text-sm">📄</span>
                                            </button>
                                            <button onClick={() => handleExport('xls')} className="w-full text-left p-3 hover:bg-emerald-600 transition-colors flex items-center justify-between group">
                                                <div className="flex flex-col">
                                                    <span className="text-white font-bold text-[10px] uppercase tracking-wider">Excel (.XLS)</span>
                                                </div>
                                                <span className="text-sm">📊</span>
                                            </button>
                                            <button onClick={() => handleExport('csv')} className="w-full text-left p-3 hover:bg-blue-600 transition-colors flex items-center justify-between group">
                                                <div className="flex flex-col">
                                                    <span className="text-white font-bold text-[10px] uppercase tracking-wider">CSV File</span>
                                                </div>
                                                <span className="text-sm">📑</span>
                                            </button>
                                            <button onClick={() => handleExport('txt')} className="w-full text-left p-3 hover:bg-slate-600 transition-colors flex items-center justify-between group">
                                                <div className="flex flex-col">
                                                    <span className="text-white font-bold text-[10px] uppercase tracking-wider">Text (.TXT)</span>
                                                </div>
                                                <span className="text-sm">📄</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <button onClick={() => setResults(null)} className={secondaryButton}>Clear</button>
                        </div>
                    </div>
                    
                    {showTabulation && (
                        <div className="overflow-y-auto max-h-[400px] rounded-xl border border-white/10 mb-6 custom-scrollbar">
                            <table className="w-full text-left border-collapse text-[11px]">
                                <thead className="bg-slate-900 sticky top-0 z-10 shadow-sm">
                                    <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/10">
                                        <th className="p-4 cursor-pointer hover:bg-white/5" onClick={() => handleSort('freq')}>Frequency <SortArrow field="freq" /></th>
                                        <th className="p-4 cursor-pointer hover:bg-white/5" onClick={() => handleSort('label')}>Designation <SortArrow field="label" /></th>
                                        <th className="p-4 cursor-pointer hover:bg-white/5" onClick={() => handleSort('zone')}>Location <SortArrow field="zone" /></th>
                                        <th className="p-4 cursor-pointer hover:bg-white/5" onClick={() => handleSort('modelName')}>Hardware <SortArrow field="modelName" /></th>
                                        <th className="p-4 text-center">Status</th>
                                        <th className="p-4 text-center">Purchase</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {tabulatedData.map((row) => (
                                        <tr key={row.id} className="hover:bg-indigo-500/5 transition-colors group">
                                            <td className="p-4 font-mono text-cyan-400 font-bold">{row.freq.toFixed(3)}</td>
                                            <td className="p-4 text-white font-medium">{row.label}</td>
                                            <td className="p-4 text-indigo-300 font-bold uppercase tracking-tighter">{row.zone}</td>
                                            <td className="p-4 text-slate-400">{row.modelName} <span className="text-[10px] opacity-50">[{row.bandName}]</span></td>
                                            <td className="p-4 text-center text-sm">{row.locked ? '🔒' : '🔓'}</td>
                                            <td className="p-4">
                                                <div className="flex justify-center">
                                                    {row.affiliateUrl ? (
                                                        <a 
                                                            href={row.affiliateUrl} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded text-[9px] font-black text-emerald-400 uppercase tracking-tighter hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                                                        >
                                                            🛒 Order
                                                        </a>
                                                    ) : (
                                                        <span className="text-[8px] text-slate-600 font-black uppercase tracking-tighter italic opacity-30">N/A</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {results.zones.map((zone, zIdx) => (
                            <div key={zIdx} className="bg-slate-900/40 rounded-xl border border-white/5 p-4">
                                <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2">
                                    <h4 className="text-xs font-black text-indigo-400 uppercase">
                                        {zone.name} <span className="text-slate-500 ml-1">({zone.frequencies.length})</span>
                                    </h4>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleZoneLock(zIdx, true)} className="text-[9px] font-bold text-slate-500 hover:text-white" title="Lock Zone">🔒</button>
                                        <button onClick={() => handleZoneLock(zIdx, false)} className="text-[9px] font-bold text-slate-500 hover:text-white" title="Unlock Zone">🔓</button>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    {zone.frequencies.map(f => (
                                        <div key={f.id} className="flex items-center justify-between gap-2 p-1.5 bg-black/20 rounded-lg border border-white/5 group">
                                            <div className="flex items-center gap-2 flex-1 overflow-hidden">
                                                <button onClick={() => handleIndividualLock(f.id)} className={`text-[10px] flex-shrink-0 ${f.locked ? 'text-amber-500' : 'text-slate-600'}`}>
                                                    {f.locked ? '🔒' : '🔓'}
                                                </button>
                                                <div className="flex items-center gap-1 flex-1 min-w-0">
                                                    <input 
                                                        type="number" step="0.001" value={f.value.toFixed(3)} 
                                                        onChange={e => handleFrequencyValueChange(f.id, e.target.value)}
                                                        className="bg-transparent text-[11px] font-mono font-bold text-white w-20 outline-none flex-shrink-0" 
                                                    />
                                                    <div className="flex gap-0.5">
                                                        <button onClick={() => handleFrequencyStep(f.id, 'down')} className="text-[9px] bg-slate-700 text-white rounded px-1 hover:bg-indigo-600">-</button>
                                                        <button onClick={() => handleFrequencyStep(f.id, 'up')} className="text-[9px] bg-slate-700 text-white rounded px-1 hover:bg-indigo-600">+</button>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] text-slate-500 truncate" title={f.label}>{f.label}</span>
                                            </div>
                                            <button onClick={() => handleRemoveFrequency(f.id)} className="text-rose-500/30 hover:text-rose-500 opacity-100 transition-all flex-shrink-0 px-1">&times;</button>
                                        </div>
                                    ))}
                                    <button onClick={() => handleAddManualFrequency(zIdx)} className="w-full mt-2 py-1.5 border border-dashed border-slate-700 rounded-lg text-[9px] font-black text-slate-500 hover:border-indigo-500/50 hover:text-indigo-400 transition-all uppercase tracking-widest">+ Add Channel</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
};

export default React.memo(MultizoneTab);
