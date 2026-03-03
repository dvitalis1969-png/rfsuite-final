
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Frequency, Thresholds, EquipmentProfile, CompatibilityLevel, Scene, GeneratorRequest, TxType, TVChannelState, WMASState } from '../types';
import { resolveGeneratorRequests, getCoordinationDiagnostics, CoordinationDiagnostic, getFinalThresholds } from '../services/rfService';
import Card, { CardTitle, Placeholder } from './Card';
import { EQUIPMENT_DATABASE, UK_TV_CHANNELS, US_TV_CHANNELS, COMPATIBILITY_PROFILES } from '../constants';

const ManualFreqInput: React.FC<{
    value: number;
    onChange: (val: number) => void;
    className: string;
}> = ({ value, onChange, className }) => {
    const [localString, setLocalString] = useState<string>(value === 0 ? '' : value.toString());
    const isFocused = useRef(false);

    useEffect(() => {
        if (!isFocused.current) {
            setLocalString(value === 0 ? '' : value.toString());
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
            setLocalString(val);
            const parsed = parseFloat(val);
            if (!isNaN(parsed)) {
                onChange(parsed);
            } else if (val === '') {
                onChange(0);
            }
        }
    };

    const handleBlur = () => {
        isFocused.current = false;
        const parsed = parseFloat(localString);
        if (!isNaN(parsed) && parsed !== 0) {
            setLocalString(parsed.toFixed(3));
        } else {
            setLocalString('');
        }
    };

    return (
        <input
            type="text"
            inputMode="decimal"
            placeholder="MHz"
            value={localString}
            onChange={handleChange}
            onFocus={() => { isFocused.current = true; }}
            onBlur={handleBlur}
            className={className}
        />
    );
};

interface GeneratorTabProps {
    initialThresholds: Thresholds;
    generatedFrequencies: Frequency[] | null; 
    setGeneratorFrequencies: (freqs: Frequency[] | null) => void;
    customEquipment: EquipmentProfile[];
    onManageCustomEquipment: () => void;
    inclusionRanges: { min: number; max: number }[] | null;
    setInclusionRanges: (ranges: { min: number; max: number }[] | null) => void;
    frequencies: Frequency[];
    scenes: Scene[];
    requests: GeneratorRequest[]; 
    setRequests: React.Dispatch<React.SetStateAction<GeneratorRequest[]>>; 
    exclusions: string; 
    setExclusions: (ex: string) => void; 
    useGlobalThresholds: boolean;
    setUseGlobalThresholds: (use: boolean) => void;
    globalThresholds: { fundamental: string; twoTone: string; threeTone: string };
    setGlobalThresholds: React.Dispatch<React.SetStateAction<{ fundamental: string; twoTone: string; threeTone: string }>>;
    manualConstraints?: Frequency[];
    setManualConstraints?: React.Dispatch<React.SetStateAction<Frequency[]>>;
    ignoreManualIMD: boolean;
    setIgnoreManualIMD: (ignore: boolean) => void;
    siteThresholds: Thresholds;
    setSiteThresholds: (th: Thresholds) => void;
    equipmentOverrides?: Record<string, Partial<Thresholds>>;
    tvChannelStates?: Record<number, TVChannelState>;
    setTvChannelStates?: (states: Record<number, TVChannelState>) => void;
    tvRegion?: 'uk' | 'us';
    setTvRegion?: (region: 'uk' | 'us') => void;
    wmasState?: WMASState;
}

const buttonBase = "px-6 py-2.5 rounded-lg font-semibold uppercase tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transform active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed";
const primaryButton = `bg-gradient-to-r from-blue-500 to-cyan-600 text-white hover:brightness-110 shadow-lg shadow-blue-500/20 ${buttonBase}`;
const secondaryButton = `bg-slate-700 text-slate-200 border border-slate-600 hover:bg-slate-600 ${buttonBase}`;
const greenButton = `bg-green-500 text-white border-b-4 border-green-700 hover:bg-green-400 hover:border-green-600 ${buttonBase}`;
const dangerButton = `bg-red-600/80 text-white hover:bg-red-500/80 ${buttonBase}`;
const generateButton = `bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 border-b-4 border-amber-700 hover:border-amber-600 hover:brightness-110 shadow-[0_0_20px_rgba(245,158,11,0.2)] ${buttonBase}`;

const GeneratorTab: React.FC<GeneratorTabProps> = ({
    initialThresholds,
    generatedFrequencies,
    setGeneratorFrequencies,
    customEquipment,
    onManageCustomEquipment,
    inclusionRanges,
    setInclusionRanges,
    frequencies,
    scenes,
    requests,
    setRequests,
    exclusions,
    setExclusions,
    useGlobalThresholds,
    setUseGlobalThresholds,
    globalThresholds,
    setGlobalThresholds,
    manualConstraints = [],
    setManualConstraints,
    ignoreManualIMD,
    setIgnoreManualIMD,
    siteThresholds,
    setSiteThresholds,
    equipmentOverrides,
    tvChannelStates: initialTvStates = {},
    setTvChannelStates: setInitialTvStates,
    tvRegion: initialRegion = 'uk',
    setTvRegion: setInitialRegion,
    wmasState
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [advancedAnalysis, setAdvancedAnalysis] = useState(false);
    const [diagnostic, setDiagnostic] = useState<CoordinationDiagnostic | null>(null);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [isWwbSubmenuOpen, setIsWwbSubmenuOpen] = useState(false);
    
    const [tvRegion, setTvRegion] = useState<'uk' | 'us'>(initialRegion);
    const [tvStates, setTvStates] = useState<Record<number, TVChannelState>>(initialTvStates);

    // Sync internal state with props when they change (avoiding setState in render)
    useEffect(() => {
        setTvRegion(initialRegion);
    }, [initialRegion]);

    useEffect(() => {
        setTvStates(initialTvStates);
    }, [initialTvStates]);

    const fullEquipmentDatabase = useMemo(() => {
        const customProfiles = customEquipment.reduce((acc, profile) => {
            acc[profile.id!] = profile;
            return acc;
        }, {} as Record<string, EquipmentProfile>);
        return { ...EQUIPMENT_DATABASE, ...customProfiles };
    }, [customEquipment]);

    const { shureProfiles, sennheiserProfiles, lectrosonicsProfiles, otherStandardProfiles } = useMemo(() => {
        const allEntries = Object.entries(fullEquipmentDatabase) as [string, EquipmentProfile][];
        const shure = allEntries.filter(([, p]) => p.name.toLowerCase().includes('shure'));
        const sennheiser = allEntries.filter(([, p]) => p.name.toLowerCase().includes('sennheiser'));
        const lectrosonics = allEntries.filter(([, p]) => p.name.toLowerCase().includes('lectrosonics'));
        const others = allEntries.filter(([k, p]) => 
            !p.isCustom && k !== 'custom' &&
            !p.name.toLowerCase().includes('shure') && 
            !p.name.toLowerCase().includes('sennheiser') &&
            !p.name.toLowerCase().includes('lectrosonics')
        );
        return { shureProfiles: shure, sennheiserProfiles: sennheiser, lectrosonicsProfiles: lectrosonics, otherStandardProfiles: others };
    }, [fullEquipmentDatabase]);

    const currentTvChannels = useMemo(() => {
        return tvRegion === 'uk' ? UK_TV_CHANNELS : US_TV_CHANNELS;
    }, [tvRegion]);

    const parseExclusionString = (exStr: string): {min: number, max: number}[] => {
        return exStr.split(/[,;\n]/)
            .map(s => s.trim())
            .filter(s => s)
            .map(rangeStr => {
                const parts = rangeStr.split(/[-–]/);
                if (parts.length === 2) {
                    const min = parseFloat(parts[0]);
                    const max = parseFloat(parts[1]);
                    if (!isNaN(min) && !isNaN(max) && min < max) {
                        return { min, max };
                    }
                }
                return null;
            })
            .filter((r): r is {min: number, max: number} => r !== null);
    };

    const addManualConstraint = () => {
        if (!setManualConstraints) return;
        const newConstraint: Frequency = {
            id: `SITE-${manualConstraints.length + 1}-${Math.random().toString(36).substring(2,5).toUpperCase()}`,
            value: 0,
            label: 'Site Mic',
            type: 'mic',
            locked: true,
            equipmentKey: 'custom',
            compatibilityLevel: 'standard'
        };
        setManualConstraints([...manualConstraints, newConstraint]);
    };

    const removeManualConstraint = (index: number) => {
        if (!setManualConstraints) return;
        setManualConstraints(manualConstraints.filter((_, i) => i !== index));
    };

    const updateManualConstraint = (index: number, field: keyof Frequency, value: any) => {
        if (!setManualConstraints) return;
        setManualConstraints(manualConstraints.map((f, i) => {
            if (i !== index) return f;
            return { ...f, [field]: value };
        }));
    };

    const updateSiteThresholds = (field: keyof Thresholds, value: string) => {
        const numVal = parseFloat(value) || 0;
        setSiteThresholds({ ...siteThresholds, [field]: numVal });
    };

    const handleAddRequest = () => {
        const newRequest: GeneratorRequest = {
            id: Date.now(),
            key: 'shure-ad-g56',
            label: '',
            count: '8',
            customMin: '470.000',
            customMax: '636.000',
            compatibilityLevel: 'standard',
            linearMode: false,
            type: 'mic'
        };
        setRequests(prev => [...prev, newRequest]);
    };

    const handleRemoveRequest = (id: number) => {
        setRequests(prev => prev.filter(req => req.id !== id));
    };

    const handleUpdateRequest = (id: number, field: keyof GeneratorRequest, value: any) => {
        setRequests(prev => prev.map(req => {
            if (req.id === id) {
                let updated = { ...req, [field]: value };

                if (field === 'useManualParams' && value === true) {
                    const standardTh = getFinalThresholds(
                        { equipmentKey: req.key, compatibilityLevel: 'standard' },
                        fullEquipmentDatabase,
                        equipmentOverrides
                    );
                    if (updated.manualFundamental === undefined) updated.manualFundamental = standardTh.fundamental;
                    if (updated.manualTwoTone === undefined) updated.manualTwoTone = standardTh.twoTone;
                    if (updated.manualThreeTone === undefined) updated.manualThreeTone = standardTh.threeTone;
                }

                if (field === 'key' && value !== 'custom') {
                    const profile = fullEquipmentDatabase[value as string];
                    if (profile) {
                        updated.customMin = profile.minFreq.toFixed(3);
                        updated.customMax = profile.maxFreq.toFixed(3);
                        if (profile.recommendedThresholds?.threeTone !== 0) {
                            updated.linearMode = false;
                        }
                    }
                }
                return updated;
            }
            return req;
        }));
    };

    const handleTvChannelCycle = (channel: number) => {
        const current = tvStates[channel] || 'available';
        let next: TVChannelState = 'available';
        if (current === 'available') next = 'mic-only';
        else if (current === 'mic-only') next = 'iem-only';
        else if (current === 'iem-only') next = 'blocked';
        else if (current === 'blocked') next = 'available';
        
        const nextMap = { ...tvStates, [channel]: next };
        setTvStates(nextMap);
        if (setInitialTvStates) setInitialTvStates(nextMap);
    };

    const handleBlockAllTvChannels = () => {
        const next: Record<number, TVChannelState> = {};
        Object.keys(currentTvChannels).forEach(ch => {
            next[Number(ch)] = 'blocked';
        });
        setTvStates(next);
        if (setInitialTvStates) setInitialTvStates(next);
    };

    const clearTv = () => {
        setTvStates({});
        if (setInitialTvStates) setInitialTvStates({});
    };

    const handleGenerate = async () => {
        setIsLoading(true);
        setDiagnostic(null);
        setProgress(0);
        await new Promise(resolve => setTimeout(resolve, 50));

        const parsedExclusions = parseExclusionString(exclusions);
        
        // Add WMAS blocks as exclusions
        if (wmasState && wmasState.nodes) {
            wmasState.nodes.forEach(node => {
                if (node.assignedBlock) {
                    parsedExclusions.push({
                        min: node.assignedBlock.start,
                        max: node.assignedBlock.end
                    });
                }
            });
        }
        
        const preparedRequests = requests.map(req => {
            return {
                ...req,
                id: String(req.id),
                count: Number(req.count) || 0,
                customMin: Number(req.customMin) || 0,
                customMax: Number(req.customMax) || 0,
                manualFundamental: req.useManualParams ? Number(req.manualFundamental) : undefined,
                manualTwoTone: req.useManualParams ? Number(req.manualTwoTone) : undefined,
                manualThreeTone: req.useManualParams ? Number(req.manualThreeTone) : undefined,
            }
        });

        // SITE COORDINATION: Unified pool check
        const lockedConstraints = generatedFrequencies?.filter(f => f.locked && !manualConstraints.some(m => m.id === f.id)) || [];

        try {
            const results = await resolveGeneratorRequests(
                preparedRequests,
                lockedConstraints,
                fullEquipmentDatabase,
                parsedExclusions,
                inclusionRanges,
                advancedAnalysis,
                useGlobalThresholds,
                (p) => setProgress(p),
                manualConstraints,
                equipmentOverrides,
                globalThresholds,
                ignoreManualIMD,
                tvStates,
                tvRegion,
                siteThresholds
            );

            // The engine now returns the FULL unified pool
            setGeneratorFrequencies(results);

            const totalRequested: number = requests.reduce((s, r) => s + (Number(r.count) || 0), 0);
            const totalFound: number = results.filter(f => f.sourceRequestId).length;
            
            const diag = getCoordinationDiagnostics(
                totalRequested, 
                totalFound, 
                470, 700, 
                parsedExclusions, 
                useGlobalThresholds ? { fundamental: parseFloat(globalThresholds.fundamental), twoTone: parseFloat(globalThresholds.twoTone), threeTone: parseFloat(globalThresholds.threeTone), fiveTone: 0, sevenTone: 0 } : initialThresholds
            );
            setDiagnostic(diag);

        } catch (e) {
            console.error("Site coordination failed:", e);
            alert("An error occurred during site calculation.");
        } finally {
            setIsLoading(false);
        }
    };
    
    // FIX: Cast Object.entries to the expected type to resolve "unknown" property errors
    const resultsCategorized = useMemo<{ manual: Frequency[], allocations: Record<string, Frequency[]> }>(() => {
        if (!generatedFrequencies) return { manual: [], allocations: {} };
        const manual = generatedFrequencies.filter(f => !f.sourceRequestId);
        const allocations = generatedFrequencies.reduce((acc, freq) => {
            if (!freq.sourceRequestId) return acc;
            const reqId = freq.sourceRequestId;
            if (!acc[reqId]) acc[reqId] = [];
            acc[reqId].push(freq);
            return acc;
        }, {} as Record<string, Frequency[]>);
        return { manual, allocations };
    }, [generatedFrequencies]);

    const handleLockToggle = (id: string) => {
        setGeneratorFrequencies(
            (generatedFrequencies || []).map(f => f.id === id ? { ...f, locked: !f.locked } : f)
        );
    };

    const handleRemoveFrequency = (id: string) => {
        if (!generatedFrequencies) return;
        setGeneratorFrequencies(generatedFrequencies.filter(f => f.id !== id));
    };

    const handleExport = (format: 'pdf' | 'csv' | 'xls' | 'doc' | 'txt' | 'wwb') => {
        setIsExportMenuOpen(false);
        if (!generatedFrequencies || generatedFrequencies.length === 0) return;

        const filename = `unified_rf_coordination_${new Date().toISOString().slice(0, 10)}`;
        const sortedFreqs = [...generatedFrequencies].sort((a, b) => a.value - b.value);

        if (format === 'wwb') {
            let csv = "Frequency,Name,Type,Band,RF Profile\n";
            sortedFreqs.forEach(f => {
                const req = requests.find(r => String(r.id) === f.sourceRequestId);
                const profile = fullEquipmentDatabase[f.equipmentKey || 'custom'];
                const wwbType = f.type === 'iem' ? 'In-ear Monitor' : 'Frequency';
                const cleanedProfile = profile?.name.replace(/^Shure\s+/i, '').replace(/\s*\(.*?\)/g, '').trim() || 'Generic';
                const label = f.label || (req?.label ? `${req.label} CH` : 'Generated CH');
                csv += `${f.value.toFixed(3)},"${label}","${wwbType}","${profile?.band.split(' ')[0] || 'Custom'}","${cleanedProfile}"\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `${filename}_WWB.csv`; a.click();
        } else if (format === 'csv' || format === 'xls') {
            let content = "Frequency (MHz),Label,Type,Equipment,Source\n";
            sortedFreqs.forEach(f => {
                const source = f.sourceRequestId ? 'New Allocation' : 'Existing Site';
                const profile = fullEquipmentDatabase[f.equipmentKey || 'custom'];
                content += `${f.value.toFixed(3)},"${f.label || ''}",${f.type},"${profile?.name || 'Generic'}","${source}"\n`;
            });
            const blob = new Blob([content], { type: format === 'xls' ? 'application/vnd.ms-excel' : 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `${filename}.${format}`; a.click();
        } else if (format === 'txt') {
            let txt = "UNIFIED RF COORDINATION LEDGER\n==============================\n\n";
            sortedFreqs.forEach(f => {
                txt += `${f.value.toFixed(3)} MHz | ${f.label || 'CH'} | ${f.type} | ${f.sourceRequestId ? 'NEW' : 'SITE'}\n`;
            });
            const blob = new Blob([txt], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `${filename}.txt`; a.click();
        } else if (format === 'pdf') {
            // @ts-ignore
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.setFontSize(18); doc.text("Unified RF Site Plan", 14, 20);
            const tableData = sortedFreqs.map(f => [f.value.toFixed(3), f.label || '—', f.type || 'generic', f.sourceRequestId ? 'New' : 'Site Mic']);
            // @ts-ignore
            doc.autoTable({ startY: 35, head: [['Frequency', 'Label', 'Type', 'Origin']], body: tableData, theme: 'striped' });
            doc.save(`${filename}.pdf`);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">
                <Card className="!hover:translate-y-0 !hover:shadow-xl border-2 border-indigo-500/20">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <CardTitle className="!mb-0">✍️ Existing Site Frequencies</CardTitle>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Manual Constraints & Protected Channels</p>
                        </div>
                        <label className="flex items-center gap-3 cursor-pointer p-2 bg-rose-500/10 rounded-lg border border-rose-500/20">
                            <input 
                                type="checkbox" 
                                checked={ignoreManualIMD} 
                                onChange={e => setIgnoreManualIMD(e.target.checked)} 
                                className="w-4 h-4 rounded accent-rose-500" 
                            />
                            <div className="flex flex-col">
                                <span className="text-rose-300 text-[10px] font-black uppercase tracking-tighter leading-none">Parameters Unknown</span>
                                <span className="text-[8px] text-slate-500 font-bold uppercase mt-0.5">Use Fundamental Spacing Only</span>
                            </div>
                        </label>
                    </div>

                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 mb-6 custom-scrollbar">
                        {manualConstraints.map((freq, i) => (
                            <div key={freq.id || i} className="grid grid-cols-[auto,1fr,2fr,auto,auto] gap-3 items-center bg-slate-900/50 p-2.5 rounded-xl border border-white/5 group hover:border-indigo-500/30 transition-all">
                                <label className="text-[9px] text-slate-600 font-mono w-6 text-center font-bold">{i + 1}</label>
                                <ManualFreqInput 
                                    value={freq.value} 
                                    onChange={val => updateManualConstraint(i, 'value', val)}
                                    className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-indigo-300 text-xs font-black font-mono focus:ring-1 focus:ring-indigo-500 outline-none shadow-inner"
                                />
                                <input 
                                    type="text" 
                                    placeholder="Label (e.g. Site Mic 1)" 
                                    value={freq.label || ''} 
                                    onChange={e => updateManualConstraint(i, 'label', e.target.value)}
                                    className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-300 text-xs font-bold w-full"
                                />
                                <select 
                                    value={freq.type || 'mic'} 
                                    onChange={e => updateManualConstraint(i, 'type', e.target.value)}
                                    className="bg-slate-800 border border-slate-700 rounded p-2 text-slate-400 text-[9px] font-black uppercase tracking-tighter"
                                >
                                    <option value="mic">Mic</option><option value="iem">IEM</option><option value="generic">Gen</option>
                                </select>
                                <button onClick={() => removeManualConstraint(i)} className="text-red-400/50 hover:text-red-400 transition-colors p-1 text-2xl leading-none">&times;</button>
                            </div>
                        ))}
                        {manualConstraints.length === 0 && (
                            <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-2xl bg-black/20">
                                <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest">No Existing Site Frequencies Entered</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="p-4 bg-slate-950/50 border border-white/5 rounded-2xl mb-4">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Site Protection Parameters</span>
                            {ignoreManualIMD && <span className="text-[8px] text-rose-400 font-black uppercase">IMD Disabled</span>}
                        </div>
                        <div className={`grid grid-cols-3 gap-4 transition-opacity ${ignoreManualIMD ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
                            <div className="flex flex-col">
                                <label className="text-[8px] text-slate-500 font-black uppercase tracking-tighter text-center mb-1">Fundamental</label>
                                <input type="number" step="0.001" value={siteThresholds.fundamental} onChange={e => updateSiteThresholds('fundamental', e.target.value)} className="bg-slate-900 border border-indigo-500/30 rounded text-xs text-amber-300 text-center font-mono py-2" />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-[8px] text-slate-500 font-black uppercase tracking-tighter text-center mb-1">2-Tone IMD</label>
                                <input type="number" step="0.001" value={siteThresholds.twoTone} onChange={e => updateSiteThresholds('twoTone', e.target.value)} className="bg-slate-900 border border-indigo-500/30 rounded text-xs text-amber-300 text-center font-mono py-2" />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-[8px] text-slate-500 font-black uppercase tracking-tighter text-center mb-1">3-Tone IMD</label>
                                <input type="number" step="0.001" value={siteThresholds.threeTone} onChange={e => updateSiteThresholds('threeTone', e.target.value)} className="bg-slate-900 border border-indigo-500/30 rounded text-xs text-amber-300 text-center font-mono py-2" />
                            </div>
                        </div>
                    </div>

                    <button onClick={addManualConstraint} className={`w-full py-3 text-[10px] font-black uppercase tracking-[0.2em] ${greenButton}`}>+ ADD SITE FREQUENCY FOR PROTECTION</button>
                </Card>

                <Card className="!hover:translate-y-0 !hover:shadow-xl">
                    <CardTitle>📡 Batch Allocations</CardTitle>
                    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-3 custom-scrollbar">
                        {requests.map((req, idx) => (
                            <div key={req.id} className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 relative group transition-all hover:border-blue-500/30">
                                <div className="flex justify-between items-center mb-4">
                                     <input
                                        type="text"
                                        value={req.label || ''}
                                        onChange={e => handleUpdateRequest(Number(req.id), 'label', e.target.value)}
                                        placeholder={`Batch Group #${idx + 1}`}
                                        className="font-black text-lg text-blue-300 bg-transparent outline-none focus:border-b border-blue-400 flex-grow mr-4 uppercase tracking-tight"
                                    />
                                    <div className="flex items-center gap-3">
                                        {fullEquipmentDatabase[req.key]?.recommendedThresholds?.threeTone === 0 && (
                                            <label className="flex items-center gap-2 cursor-pointer bg-cyan-600/10 border border-cyan-500/30 px-3 py-1.5 rounded-lg">
                                                <span className="text-cyan-300 text-[10px] font-black uppercase tracking-widest">HD Mode</span>
                                                <input type="checkbox" checked={req.linearMode} onChange={e => handleUpdateRequest(Number(req.id), 'linearMode', e.target.checked)} className="w-4 h-4 rounded accent-cyan-400" />
                                            </label>
                                        )}
                                        <button onClick={() => handleRemoveRequest(Number(req.id))} className="text-rose-500 hover:text-rose-400 font-bold text-xl leading-none">&times;</button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                    <div className="md:col-span-2">
                                        <label className="text-[10px] text-slate-500 uppercase font-black mb-1 block">Hardware Profile</label>
                                        <select value={req.key} onChange={e => handleUpdateRequest(Number(req.id), 'key', e.target.value)} className="w-full bg-slate-800 border border-blue-500/30 rounded-lg p-2.5 text-slate-200 text-sm">
                                            <optgroup label="General"><option value="custom">Custom Range / Generic</option></optgroup>
                                            <optgroup label="Shure">{shureProfiles.map(([key, p]) => <option key={key} value={key}>{p.name}</option>)}</optgroup>
                                            <optgroup label="Sennheiser">{sennheiserProfiles.map(([key, p]) => <option key={key} value={key}>{p.name}</option>)}</optgroup>
                                            <optgroup label="Lectrosonics">{lectrosonicsProfiles.map(([key, p]) => <option key={key} value={key}>{p.name}</option>)}</optgroup>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 uppercase font-black mb-1 block">Device Type</label>
                                        <select 
                                            value={req.type || 'mic'} 
                                            onChange={e => handleUpdateRequest(Number(req.id), 'type', e.target.value)} 
                                            className="w-full bg-slate-800 border border-blue-500/30 rounded-lg p-2.5 text-slate-200 text-sm font-black uppercase"
                                        >
                                            <option value="mic">Mic</option>
                                            <option value="iem">IEM</option>
                                            <option value="comms">Comms</option>
                                            <option value="generic">Generic</option>
                                            <option value="wmas">WMAS</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 uppercase font-black mb-1 block">Quantity</label>
                                        <input type="number" value={req.count} onChange={e => handleUpdateRequest(Number(req.id), 'count', e.target.value)} className="w-full bg-slate-800 border border-blue-500/30 rounded-lg p-2.5 text-slate-200 text-sm font-black" />
                                    </div>
                                </div>

                                {req.key === 'custom' && (
                                    <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-slate-950/40 rounded-lg border border-white/5 animate-in slide-in-from-top-2">
                                        <div>
                                            <label className="text-[9px] text-slate-500 uppercase font-black mb-1 block">Lower Limit (MHz)</label>
                                            <input type="number" step="0.001" value={req.customMin} onChange={e => handleUpdateRequest(Number(req.id), 'customMin', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs font-mono text-cyan-400 font-bold" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] text-slate-500 uppercase font-black mb-1 block">Upper Limit (MHz)</label>
                                            <input type="number" step="0.001" value={req.customMax} onChange={e => handleUpdateRequest(Number(req.id), 'customMax', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs font-mono text-cyan-400 font-bold" />
                                        </div>
                                    </div>
                                )}

                                <div className="border-t border-white/5 pt-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <input type="checkbox" checked={req.useManualParams} onChange={e => handleUpdateRequest(Number(req.id), 'useManualParams', e.target.checked)} className="w-4 h-4 rounded accent-amber-500" />
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${req.useManualParams ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-400'}`}>Bespoke IMD Spacing For This Group</span>
                                        </label>
                                        {!req.useManualParams && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-slate-500 uppercase font-black">Profile Mode:</span>
                                                <select 
                                                    value={req.compatibilityLevel} 
                                                    onChange={e => handleUpdateRequest(Number(req.id), 'compatibilityLevel', e.target.value as CompatibilityLevel)} 
                                                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[9px] text-indigo-300 font-black uppercase"
                                                >
                                                    {Object.entries(COMPATIBILITY_PROFILES).map(([key, value]) => (<option key={key} value={key}>{value.label}</option>))}
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    {req.useManualParams ? (
                                        <div className="grid grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-1">
                                            <div className="flex flex-col">
                                                <label className="text-[8px] text-slate-500 uppercase font-black mb-1 text-center">F-F Guard</label>
                                                <input type="number" step="0.001" value={req.manualFundamental} onChange={e => handleUpdateRequest(Number(req.id), 'manualFundamental', e.target.value)} className="bg-slate-950 border border-amber-500/30 rounded p-2 text-xs font-mono text-amber-400 text-center font-bold" />
                                            </div>
                                            <div className="flex flex-col">
                                                <label className="text-[8px] text-slate-500 uppercase font-black mb-1 text-center">2-Tone Guard</label>
                                                <input type="number" step="0.001" value={req.manualTwoTone} onChange={e => handleUpdateRequest(Number(req.id), 'manualTwoTone', e.target.value)} className="bg-slate-950 border border-amber-500/30 rounded p-2 text-xs font-mono text-amber-400 text-center font-bold" />
                                            </div>
                                            <div className="flex flex-col">
                                                <label className="text-[8px] text-slate-500 uppercase font-black mb-1 text-center">3-Tone Guard</label>
                                                <input type="number" step="0.001" value={req.manualThreeTone} onChange={e => handleUpdateRequest(Number(req.id), 'manualThreeTone', e.target.value)} className="bg-slate-950 border border-amber-500/30 rounded p-2 text-xs font-mono text-amber-400 text-center font-bold" />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-3 gap-3 opacity-40">
                                            {(() => {
                                                const th = getFinalThresholds({ equipmentKey: req.key, compatibilityLevel: req.compatibilityLevel }, fullEquipmentDatabase, equipmentOverrides);
                                                return (
                                                    <>
                                                        <div className="flex flex-col"><label className="text-[8px] text-slate-600 uppercase font-black mb-1 text-center">F-F</label><div className="bg-slate-950 border border-white/5 rounded p-2 text-xs font-mono text-slate-500 text-center font-bold">{th.fundamental.toFixed(3)}</div></div>
                                                        <div className="flex flex-col"><label className="text-[8px] text-slate-600 uppercase font-black mb-1 text-center">2-Tone</label><div className="bg-slate-950 border border-white/5 rounded p-2 text-xs font-mono text-slate-500 text-center font-bold">{th.twoTone.toFixed(3)}</div></div>
                                                        <div className="flex flex-col"><label className="text-[8px] text-slate-600 uppercase font-black mb-1 text-center">3-Tone</label><div className="bg-slate-950 border border-white/5 rounded p-2 text-xs font-mono text-slate-500 text-center font-bold">{th.threeTone.toFixed(3)}</div></div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    <button onClick={handleAddRequest} className={`w-full mt-6 py-4 rounded-xl font-black ${primaryButton} transition-all uppercase tracking-widest`}>+ ADD NEW HARDWARE GROUP</button>
                </Card>
            </div>
            <div className="lg:col-span-4 flex flex-col gap-6">
                <Card>
                    <CardTitle>⚙️ Site Parameters</CardTitle>
                    <div className="space-y-6">
                        <div>
                            <label className="text-xs text-slate-500 uppercase font-black mb-2 block">Custom Exclusions (MHz)</label>
                            <textarea value={exclusions} onChange={e => setExclusions(e.target.value)} rows={3} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-200 text-sm font-mono" placeholder="e.g. 482.000-485.500" />
                        </div>
                        
                        <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700">
                            <label className="text-xs text-slate-300 font-bold uppercase mb-4 block">TV Channel Blockade</label>
                            <div className="grid grid-cols-4 gap-2">
                                {Object.entries(currentTvChannels).map(([chStr, range]) => {
                                    const ch = Number(chStr);
                                    const state = tvStates[ch] || 'available';
                                    return (
                                        <button key={ch} onClick={() => handleTvChannelCycle(ch)} className={`p-1.5 text-center rounded-lg border-2 transition-all text-[10px] font-black ${state === 'blocked' ? 'bg-rose-600 border-rose-500 shadow-lg shadow-rose-500/20' : state === 'mic-only' ? 'bg-sky-500 border-sky-400 shadow-lg shadow-sky-500/20' : state === 'iem-only' ? 'bg-amber-500 border-amber-400 shadow-lg shadow-amber-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>{ch}</button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                     <button onClick={handleGenerate} disabled={isLoading} className={`w-full mt-8 ${generateButton} !py-4 text-lg font-black tracking-[0.2em]`}>
                        {isLoading ? `SEEKING COEXISTENCE...` : 'CALCULATE UNIFIED PLAN'}
                     </button>
                </Card>

                <Card className="flex-grow !hover:translate-y-0 !hover:shadow-xl overflow-visible">
                    <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-3">
                        <CardTitle className="!mb-0 text-lg font-black flex items-center gap-2"><span>📊</span> Plan Yield</CardTitle>
                        {generatedFrequencies && (
                            <div className="relative">
                                <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="text-[9px] font-black tracking-widest px-3 py-1.5 rounded-lg border-2 border-cyan-500/50 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-600 hover:text-white transition-all">EXPORT</button>
                                {isExportMenuOpen && (
                                    <div className="absolute top-full right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-[110] overflow-hidden min-w-[180px] animate-in slide-in-from-top-2">
                                        <button onClick={() => handleExport('pdf')} className="w-full text-left p-3 hover:bg-indigo-600 text-[10px] font-black text-white uppercase border-b border-white/5">PDF Plan</button>
                                        <button onClick={() => handleExport('wwb')} className="w-full text-left p-3 hover:bg-indigo-600 text-[10px] font-black text-white uppercase border-b border-white/5">WWB Inventory</button>
                                        <button onClick={() => handleExport('csv')} className="w-full text-left p-3 hover:bg-indigo-600 text-[10px] font-black text-white uppercase">CSV Data</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="space-y-4 py-8">
                            <div className="text-center text-[10px] text-slate-500 font-black uppercase animate-pulse tracking-widest">Processing Unified Interactions... {Math.round(progress * 100)}%</div>
                            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-gradient-to-r from-blue-400 to-cyan-500 transition-all duration-300" style={{ width: `${progress * 100}%` }}></div></div>
                        </div>
                    ) : (resultsCategorized.manual.length > 0 || Object.entries(resultsCategorized.allocations).length > 0) ? (
                        <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-3 custom-scrollbar">
                             {/* SITE ENVIRONMENT SECTION */}
                             {resultsCategorized.manual.length > 0 && (
                                 <div className="bg-rose-500/5 p-4 rounded-xl border border-rose-500/20">
                                     <h4 className="text-[10px] font-black text-rose-400 tracking-widest uppercase mb-3 border-b border-rose-500/20 pb-2">Protected Site Environment</h4>
                                     <div className="grid grid-cols-2 gap-2">
                                         {resultsCategorized.manual.map(f => (
                                             <div key={f.id} className="bg-black/30 p-2 rounded-lg font-mono text-[11px] text-rose-300 font-bold border border-rose-500/10 flex justify-between">
                                                 <span>{f.value.toFixed(3)}</span>
                                                 <span className="text-[8px] opacity-40 uppercase">{f.label || 'Site'}</span>
                                             </div>
                                         ))}
                                     </div>
                                 </div>
                             )}

                             {/* ALLOCATIONS SECTION */}
                             {(Object.entries(resultsCategorized.allocations) as [string, Frequency[]][]).map(([reqId, freqs]) => {
                                const req = requests.find(r => String(r.id) === reqId);
                                return (
                                    <div key={reqId} className="bg-indigo-500/5 p-4 rounded-xl border border-indigo-500/20">
                                        <h4 className="text-[10px] font-black text-indigo-400 tracking-widest uppercase mb-3 border-b border-indigo-500/20 pb-2 flex justify-between">
                                            <span>{req?.label || 'New Group'}</span>
                                            <span className="text-slate-500 font-mono lowercase">{freqs.length} CH</span>
                                        </h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            {freqs.map(f => (
                                                <div key={f.id} className="bg-black/30 p-2 rounded-lg font-mono text-[11px] text-cyan-300 font-black border border-cyan-500/10 flex justify-between items-center group/freq">
                                                    <span>{f.value.toFixed(3)}</span>
                                                    <button onClick={() => handleLockToggle(f.id)} className={`text-[10px] ${f.locked ? 'text-amber-500' : 'text-slate-700 opacity-20 group-hover/freq:opacity-100'}`}>{f.locked ? '🔒' : '🔓'}</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                             })}
                        </div>
                    ) : (
                        <Placeholder title="Engine Ready" message="Configure site constraints and batch groups then click 'CALCULATE UNIFIED PLAN'." />
                    )}
                </Card>
            </div>
        </div>
    );
};

export default React.memo(GeneratorTab);
