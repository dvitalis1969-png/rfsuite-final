
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Card, { CardTitle, Placeholder } from './Card';
import { DuplexPair, ZoneConfig, SiteMapState, ZonalResult, TxType, TalkbackIntermods, IntermodProduct, Conflict, Frequency, Thresholds, TalkbackMode } from '../types';
import { TALKBACK_DEFINITIONS, TALKBACK_FIXED_PAIRS, DISCRETE_TALKBACK_PAIRS, TALKBACK_FORBIDDEN_RANGES_BY_COUNTRY } from '../constants';
import { generateZonalTalkbackPairs, calculateTalkbackIntermods, checkTalkbackCompatibility } from '../services/rfService';

interface DuplexPairWithBw extends DuplexPair {
    txBw?: number;
    rxBw?: number;
    zoneIndex?: number;
}

const buttonBase = "px-4 py-2 rounded-lg font-bold uppercase tracking-wider transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transform active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed text-[10px]";
const primaryButton = `bg-gradient-to-r from-blue-600 to-cyan-600 text-white border-b-4 border-blue-800 hover:brightness-110 shadow-lg ${buttonBase}`;
const secondaryButton = `bg-slate-700 text-white border-b-4 border-slate-900 hover:bg-slate-600 ${buttonBase}`;
const actionButton = `bg-cyan-600/80 text-white border-b-4 border-cyan-800 hover:border-cyan-700 hover:bg-cyan-600 ${buttonBase}`;
const greenButton = `bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 ${buttonBase}`;

const INTERMOD_CONFIG = {
    tx: { color: '#fbbf24', amp: -10, label: 'Transmit (Tx)' },
    rx: { color: '#38bdf8', amp: -10, label: 'Receive (Rx)' },
    twoTone: { color: '#ef4444', amp: -50, label: '2-Tone IMD' },
    threeTone: { color: '#a855f7', amp: -75, label: '3-Tone IMD' },
    grid: 'rgba(59, 130, 246, 0.15)',
    text: '#94a3b8'
};

const STANDARD_BASE_BANDS = [457, 455, 446, 450, 451, 442, 425, 427, 452];
const STANDARD_PORT_BANDS = [467, 468, 469, 466, 465];

const EUROPE_BASE_BANDS = [465, 466, 467, 468, 469];
const EUROPE_PORT_BANDS = [446, 450, 451, 452, 455, 457, 458, 460];

const ManualFreqInput: React.FC<{
    value: number;
    onChange: (val: string) => void;
    className: string;
}> = ({ value, onChange, className }) => {
    const [localString, setLocalString] = useState<string>(value === 0 ? '' : value.toString());
    const isFocused = useRef(false);

    useEffect(() => {
        if (!isFocused.current) setLocalString(value === 0 ? '' : value.toString());
    }, [value]);

    return (
        <input
            type="text"
            inputMode="decimal"
            placeholder="0.00000"
            value={localString}
            onChange={(e) => {
                const val = e.target.value;
                if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                    setLocalString(val);
                    onChange(val);
                }
            }}
            onFocus={() => { isFocused.current = true; }}
            onBlur={() => {
                isFocused.current = false;
                const parsed = parseFloat(localString);
                if (!isNaN(parsed) && parsed !== 0) setLocalString(parsed.toFixed(5));
                else setLocalString('');
            }}
            className={className}
        />
    );
};

interface ZonalTalkbackZoneConfig {
    name: string;
    pairCount: number;
    txBands: Set<number>;
    rxBands: Set<number>;
    simplexTxBands?: Set<number>;
    simplexWalkieBands?: Set<number>;
    simplexTxCount?: number;
    simplexWalkieCount?: number;
    simplexTxBw?: number;
    simplexWalkieBw?: number;
    generationPriority?: ('duplex' | 'simplexTx' | 'simplexWalkie')[];
    duplexCustomMode?: 'standard' | 'custom';
    simplexCustomMode?: 'standard' | 'custom';
    customTxMin?: number;
    customTxMax?: number;
    customRxMin?: number;
    customRxMax?: number;
    simplexTxMin?: number;
    simplexTxMax?: number;
    simplexWalkieMin?: number;
    simplexWalkieMax?: number;
    customBw?: number;
}

interface ZonalTalkbackTabProps {
    numZones: number;
    setNumZones: (num: number) => void;
    zoneConfigs: ZoneConfig[];
    setZoneConfigs: (configs: ZoneConfig[]) => void;
    distances: number[][];
    setDistances: (distances: number[][]) => void;
    siteMapState: SiteMapState;
    compatibilityMatrix: boolean[][];
    setCompatibilityMatrix: React.Dispatch<React.SetStateAction<boolean[][]>>;
    results: ZonalResult[] | null;
    setResults: React.Dispatch<React.SetStateAction<ZonalResult[] | null>>;
}

const ZonalTalkbackTab: React.FC<ZonalTalkbackTabProps> = ({
    numZones, setNumZones, zoneConfigs: appZoneConfigs,
    distances, setDistances, siteMapState, compatibilityMatrix, setCompatibilityMatrix,
    results, setResults
}) => {
    const [mode, setMode] = useState<TalkbackMode>('standard');
    const [selectedCountry, setSelectedCountry] = useState<string>('UK');
    const [talkbackZoneConfigs, setTalkbackZoneConfigs] = useState<ZonalTalkbackZoneConfig[]>([]);
    const [manualPairs, setManualPairs] = useState<DuplexPairWithBw[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [sortField, setSortField] = useState<string>('tx');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [bulkAddCount, setBulkAddCount] = useState(4);
    const [bulkAddZone, setBulkAddZone] = useState(-1);
    const [numZonesInput, setNumZonesInput] = useState(numZones.toString());
    const [globalDistInput, setGlobalDistInput] = useState<string>("50");
    const abortControllerRef = useRef<AbortController | null>(null);

    const baseBands = mode === 'europe' ? EUROPE_BASE_BANDS : STANDARD_BASE_BANDS;
    const portBands = mode === 'europe' ? EUROPE_PORT_BANDS : STANDARD_PORT_BANDS;

    useEffect(() => { setNumZonesInput(numZones.toString()); }, [numZones]);

    const handleNumZonesChange = (val: string) => {
        setNumZonesInput(val);
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 20) setNumZones(parsed);
    };

    const handleApplyGlobalDistance = () => {
        const val = parseInt(globalDistInput, 10);
        if (isNaN(val)) return;
        const next = distances.map((row, rIdx) => row.map((col, cIdx) => (rIdx === cIdx ? 0 : val)));
        setDistances(next);
    };

    const handleDistanceMatrixChange = (row: number, col: number, value: string) => {
        const next = distances.map(r => [...r]);
        const val = parseInt(value, 10) || 0;
        next[row][col] = val;
        if (row !== col) next[col][row] = val;
        setDistances(next);
    };

    const handleMatrixChange = (row: number, col: number) => {
        const next = compatibilityMatrix.map(r => [...r]);
        next[row][col] = !next[row][col];
        if (row !== col) next[col][row] = next[row][col];
        setCompatibilityMatrix(next);
    };

    const yieldBreakdown = useMemo(() => {
        if (!results) return null;
        let duplex = 0;
        let simplexTx = 0;
        let simplexWalkie = 0;
        results.forEach(z => {
            z.pairs.forEach(p => {
                if (p.tx > 0 && p.rx > 0) duplex++;
                else if (p.tx > 0 && p.rx === 0) simplexTx++;
                else if (p.tx === 0 && p.rx > 0) simplexWalkie++;
            });
        });
        return { duplex, simplexTx, simplexWalkie };
    }, [results]);

    const totalTarget = useMemo(() => {
        return talkbackZoneConfigs.reduce((sum, c) => sum + (c.pairCount || 0) + (c.simplexTxCount || 0) + (c.simplexWalkieCount || 0), 0);
    }, [talkbackZoneConfigs]);

    const totalYield = (yieldBreakdown?.duplex || 0) + (yieldBreakdown?.simplexTx || 0) + (yieldBreakdown?.simplexWalkie || 0);

    const handleSort = (field: string) => {
        if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDirection('asc'); }
    };

    const SortArrow = ({ field }: { field: string }) => {
        if (sortField !== field) return <span className="ml-1 text-slate-500">↕</span>;
        return <span className="ml-1 text-amber-400 font-black">{sortDirection === 'asc' ? '▲' : '▼'}</span>;
    };
    
    const [range, setRange] = useState({ min: 429.8, max: 484.8 });
    const [centerFreqInput, setCenterFreqInput] = useState<string>("457.3000");
    const [centerStepMhz, setCenterStepMhz] = useState('1.0');
    const [spanIncrementMhz, setSpanIncrementMhz] = useState('5.0');
    const [showTwoTone, setShowTwoTone] = useState(true);
    const [showThreeTone, setShowThreeTone] = useState(true);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragState, setDragState] = useState<{ startX: number, startMin: number, startMax: number } | null>(null);
    const [mouseCoord, setMouseCoord] = useState<{ clientX: number, clientY: number, internalX: number } | null>(null);
    const [showTable, setShowTable] = useState(false);
    const [customBaseRange, setCustomBaseRange] = useState({ min: 450, max: 464 });
    const [customSwRange, setCustomSwRange] = useState({ min: 464, max: 470 });

    // Auditor State Tracking
    const isCenterFreqFocused = useRef(false);

    useEffect(() => {
        if (!isCenterFreqFocused.current) {
            setCenterFreqInput(((range.min + range.max) / 2).toFixed(4));
        }
    }, [range]);

    // Audit State
    const [diagnosticConflicts, setDiagnosticConflicts] = useState<Conflict[]>([]);
    const [hasAnalyzed, setHasAnalyzed] = useState(false);

    const totalGenerated = useMemo(() => results ? results.reduce((sum, z) => sum + (z.pairs?.length || 0), 0) : 0, [results]);
    const totalRequired = useMemo(() => talkbackZoneConfigs.reduce((sum, c) => sum + c.pairCount, 0), [talkbackZoneConfigs]);

    useEffect(() => {
        setTalkbackZoneConfigs(currentConfigs => {
            const newConfigs: ZonalTalkbackZoneConfig[] = [];
            for (let i = 0; i < numZones; i++) {
                const appConfig = appZoneConfigs[i];
                if (!appConfig) continue;
                const existingConfig = currentConfigs[i] || currentConfigs.find(c => c.name === appConfig.name);
                newConfigs.push({ 
                    name: appConfig.name, 
                    pairCount: appConfig.count || 4, 
                    txBands: existingConfig?.txBands ?? new Set<number>(), 
                    rxBands: existingConfig?.rxBands ?? new Set<number>(),
                    simplexTxBands: existingConfig?.simplexTxBands ?? new Set<number>(),
                    simplexWalkieBands: existingConfig?.simplexWalkieBands ?? new Set<number>(),
                    simplexTxCount: existingConfig?.simplexTxCount ?? 0,
                    simplexWalkieCount: existingConfig?.simplexWalkieCount ?? 0,
                    simplexTxBw: existingConfig?.simplexTxBw ?? 0.0125,
                    simplexWalkieBw: existingConfig?.simplexWalkieBw ?? 0.0125,
                    generationPriority: existingConfig?.generationPriority ?? ['duplex', 'simplexTx', 'simplexWalkie'],
                    duplexCustomMode: existingConfig?.duplexCustomMode ?? 'standard',
                    simplexCustomMode: existingConfig?.simplexCustomMode ?? 'standard',
                    customTxMin: existingConfig?.customTxMin ?? 414,
                    customTxMax: existingConfig?.customTxMax ?? 415,
                    customRxMin: existingConfig?.customRxMin ?? 424,
                    customRxMax: existingConfig?.customRxMax ?? 425,
                    simplexTxMin: existingConfig?.simplexTxMin ?? 450,
                    simplexTxMax: existingConfig?.simplexTxMax ?? 451,
                    simplexWalkieMin: existingConfig?.simplexWalkieMin ?? 469,
                    simplexWalkieMax: existingConfig?.simplexWalkieMax ?? 470,
                    customBw: existingConfig?.customBw ?? 0.0125
                });
            }
            return newConfigs;
        });
    }, [numZones, appZoneConfigs]);

    const addManualPair = () => setManualPairs(p => [...p, { id: `man-${Date.now()}-${Math.random()}`, label: `Manual ${p.length + 1}`, tx: 0, rx: 0, groupName: 'Manual', locked: false, active: true, txBw: 0.0125, rxBw: 0.0125, zoneIndex: -1 } as DuplexPairWithBw]);

    const handleBulkAddManualPairs = () => {
        const count = Math.max(1, Math.min(50, bulkAddCount));
        const newBatch: DuplexPairWithBw[] = Array.from({ length: count }, (_, i) => ({ id: `man-${Date.now()}-${i}-${Math.random()}`, label: `Manual ${manualPairs.length + i + 1}`, tx: 0, rx: 0, groupName: 'Manual', locked: false, active: true, txBw: 0.0125, rxBw: 0.0125, zoneIndex: bulkAddZone }));
        setManualPairs(p => [...p, ...newBatch]);
    };

    const removeManualPair = (id: string) => setManualPairs(p => p.filter(pair => pair.id !== id));

    const updateManualPair = (id: string, field: string, value: any) => {
        setManualPairs(p => p.map(pair => {
            if (pair.id === id) {
                const isNumeric = (field === 'tx' || field === 'rx' || field === 'txBw' || field === 'rxBw' || field === 'zoneIndex') && typeof value !== 'boolean';
                const numVal = isNumeric ? (parseFloat(value) ?? (field === 'zoneIndex' ? -1 : 0)) : value;
                return { ...pair, [field]: numVal };
            }
            return pair;
        }));
    };

    const handleToggleBase = (zoneIdx: number, pairId: string, field: 'txIsBase' | 'rxIsBase') => {
        setResults(prev => prev ? prev.map((z, idx) => idx === zoneIdx ? { ...z, pairs: z.pairs.map(p => p.id === pairId ? { ...p, [field]: !p[field] } : p) } : z) : null);
    };

    const handleResultFrequencyChange = (zoneIdx: number, pairId: string, field: 'tx' | 'rx', value: string) => {
        const numVal = parseFloat(value) || 0;
        setResults(prev => prev ? prev.map((z, idx) => idx === zoneIdx ? { ...z, pairs: z.pairs.map(p => p.id === pairId ? { ...p, [field]: numVal } : p) } : z) : null);
    };

    const handleFrequencyStep = (pairId: string, field: 'tx' | 'rx', direction: 'up' | 'down') => {
        const step = 0.00625;
        const updateLogic = (pairs: any[]): any[] => pairs.map(p => p.id === pairId ? { ...p, [field]: parseFloat(((p[field] || 0) + (direction === 'up' ? step : -step)).toFixed(5)) } : p);
        if (manualPairs.some(p => p.id === pairId)) setManualPairs(updateLogic);
        else setResults(current => current ? current.map(z => ({ ...z, pairs: updateLogic(z.pairs) })) : null);
    };

    const handleCalculate = async () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        setIsLoading(true); setProgress(0); await new Promise(resolve => setTimeout(resolve, 50));
        const serviceConfigs = talkbackZoneConfigs.map(c => ({ 
            name: c.name, 
            pairCount: c.pairCount, 
            txBands: Array.from(c.txBands), 
            rxBands: Array.from(c.rxBands), 
            simplexTxBands: Array.from(c.simplexTxBands || []),
            simplexWalkieBands: Array.from(c.simplexWalkieBands || []),
            simplexTxCount: c.simplexTxCount || 0,
            simplexWalkieCount: c.simplexWalkieCount || 0,
            simplexTxBw: c.simplexTxBw || 0.0125,
            simplexWalkieBw: c.simplexWalkieBw || 0.0125,
            generationPriority: c.generationPriority,
            duplexCustomMode: c.duplexCustomMode || 'standard',
            simplexCustomMode: c.simplexCustomMode || 'standard',
            customTxMin: c.customTxMin, 
            customTxMax: c.customTxMax, 
            customRxMin: c.customRxMin, 
            customRxMax: c.customRxMax, 
            simplexTxMin: c.simplexTxMin,
            simplexTxMax: c.simplexTxMax,
            simplexWalkieMin: c.simplexWalkieMin,
            simplexWalkieMax: c.simplexWalkieMax,
            customBw: c.customBw 
        }));
        try {
            const zonalResults = await generateZonalTalkbackPairs(
                serviceConfigs, 
                0.01875, 
                distances, 
                compatibilityMatrix, 
                results, 
                manualPairs,
                (p) => setProgress(p), 
                mode, 
                selectedCountry,
                customBaseRange,
                abortController.signal
            );
            setResults(zonalResults);
        } catch (error: any) { 
            if (error.message === 'Calculation aborted by user') {
                console.log('Calculation aborted');
            } else {
                console.error(error); 
                alert("Error in zonal calculation."); 
            }
        } finally { 
            setIsLoading(false); 
            setProgress(1); 
            abortControllerRef.current = null;
        }
    };

    const handleLockToggle = (zoneIdx: number, pairId: string) => {
        setResults(prev => prev ? prev.map((z, idx) => idx === zoneIdx ? { ...z, pairs: z.pairs.map(p => p.id === pairId ? { ...p, locked: !p.locked } : p) } : z) : null);
    };

    const handleActiveToggle = (zoneIdx: number, pairId: string) => {
        setResults(prev => prev ? prev.map((z, idx) => idx === zoneIdx ? { ...z, pairs: z.pairs.map(p => { if (p.id === pairId) return { ...p, active: p.active === false }; return p; }) } : z) : null);
    };

    const handleRemoveResult = (zoneIdx: number, pairId: string) => {
        setResults(prev => prev ? prev.map((z, idx) => idx === zoneIdx ? { ...z, pairs: z.pairs.filter(p => p.id !== pairId) } : z) : null);
    };

    const handleZoneActiveToggle = (zoneIdx: number) => {
        if (!results) return;
        const targetZone = results[zoneIdx];
        const zoneManual = manualPairs.filter(p => p.zoneIndex === zoneIdx);
        const currentlyActive = targetZone.pairs.some(p => p.active !== false) || zoneManual.some(p => p.active !== false);
        const nextState = !currentlyActive;
        setResults(prev => prev ? prev.map((z, idx) => idx === zoneIdx ? { ...z, pairs: z.pairs.map(p => ({ ...p, active: nextState })) } : z) : null);
        setManualPairs(prev => prev.map(p => p.zoneIndex === zoneIdx ? { ...p, active: nextState } : p));
    };

    const handleZoneLockAllToggle = (zoneIdx: number) => {
        if (!results) return;
        const targetZone = results[zoneIdx]; const anyUnlocked = targetZone.pairs.some(p => !p.locked); const nextState = anyUnlocked;
        setResults(prev => prev ? prev.map((z, idx) => idx === zoneIdx ? { ...z, pairs: z.pairs.map(p => ({ ...p, locked: nextState })) } : z) : null);
    };

    const allActiveCarriers = useMemo(() => {
        const carriers: { value: number; label: string; type: 'tx' | 'rx'; zoneName: string; bw: number; zoneIndex: number; isTx?: boolean }[] = [];
        manualPairs.forEach((p, idx) => {
            if (p.active === false) return;
            const zoneName = p.zoneIndex !== undefined && p.zoneIndex !== -1 && talkbackZoneConfigs[p.zoneIndex] ? talkbackZoneConfigs[p.zoneIndex].name.toUpperCase() : 'SITE-WIDE';
            
            let txIsBase = p.txIsBase;
            let rxIsBase = p.rxIsBase;
            
            if (txIsBase === undefined && mode === 'custom') {
                txIsBase = p.tx >= customBaseRange.min && p.tx <= customBaseRange.max;
            }
            if (rxIsBase === undefined && mode === 'custom') {
                rxIsBase = p.rx >= customBaseRange.min && p.rx <= customBaseRange.max;
            }

            if (p.tx > 0) carriers.push({ value: p.tx, label: `M${idx + 1}T`, type: 'tx', zoneName, bw: p.txBw || 0.0125, zoneIndex: p.zoneIndex ?? -1, isTx: txIsBase });
            if (p.rx > 0) carriers.push({ value: p.rx, label: `M${idx + 1}R`, type: 'rx', zoneName, bw: p.rxBw || 0.0125, zoneIndex: p.zoneIndex ?? -1, isTx: rxIsBase });
        });
        if (results) {
            results.forEach((z, zIdx) => {
                z.pairs.forEach((p, pIdx) => {
                    if (p.active === false) return;
                    
                    let txIsBase = p.txIsBase;
                    let rxIsBase = p.rxIsBase;
                    
                    if (txIsBase === undefined && mode === 'custom') {
                        txIsBase = p.tx >= customBaseRange.min && p.tx <= customBaseRange.max;
                    }
                    if (rxIsBase === undefined && mode === 'custom') {
                        rxIsBase = p.rx >= customBaseRange.min && p.rx <= customBaseRange.max;
                    }

                    if (p.tx > 0) carriers.push({ value: p.tx, label: `Z${zIdx + 1}P${pIdx + 1}T`, type: 'tx', zoneName: z.zoneName, bw: p.txBw || 0.0125, zoneIndex: zIdx, isTx: txIsBase });
                    if (p.rx > 0) carriers.push({ value: p.rx, label: `Z${zIdx + 1}P${pIdx + 1}R`, type: 'rx', zoneName: z.zoneName, bw: p.rxBw || 0.0125, zoneIndex: zIdx, isTx: rxIsBase });
                });
            });
        }
        return carriers;
    }, [results, manualPairs, talkbackZoneConfigs, mode, customBaseRange]);

    const handleRunAudit = () => {
        const freqList: Frequency[] = allActiveCarriers.map((c) => ({ id: c.label, value: c.value, type: 'comms' as TxType, zoneIndex: c.zoneIndex, isTx: c.isTx }));
        const result = checkTalkbackCompatibility(freqList, distances, compatibilityMatrix, mode, selectedCountry, customBaseRange);
        setDiagnosticConflicts(result.conflicts);
        setHasAnalyzed(true);
    };

    const intermods = useMemo(() => {
        // Only include carriers that are explicitly tagged as Base (isTx: true) 
        // OR those that fall into the heuristic range if no explicit tag is present.
        const baseCarriers = allActiveCarriers.filter(c => {
            if (c.isTx !== undefined) return c.isTx;
            if (mode === 'custom') {
                return c.value >= customBaseRange.min && c.value <= customBaseRange.max;
            }
            if (mode === 'europe') return c.value > 464;
            return c.value < 464;
        });
        return calculateTalkbackIntermods(baseCarriers.map(c => ({ value: c.value })));
    }, [allActiveCarriers, mode, customBaseRange]);

    const handleScroll = (direction: 'left' | 'right') => {
        const step = parseFloat(centerStepMhz) || 1.0;
        const shift = direction === 'left' ? -step : step;
        setRange(r => ({ min: r.min + shift, max: r.max + shift }));
    };
    
    const handleSpanChange = (direction: 'increase' | 'decrease') => {
        const spanStep = parseFloat(spanIncrementMhz) || 1.0;
        const currentSpan = range.max - range.min;
        let newSpan = direction === 'decrease' ? Math.max(0.1, currentSpan - spanStep) : currentSpan + spanStep;
        const centerFreqVal = (range.min + range.max) / 2;
        setRange({ min: parseFloat((centerFreqVal - newSpan / 2).toFixed(5)), max: parseFloat((centerFreqVal + newSpan / 2).toFixed(5)) });
    };

    const handleCenterStepSizeChange = (direction: 'up' | 'down') => {
        const current = parseFloat(centerStepMhz) || 1.0;
        const step = current >= 10 ? 5.0 : current >= 1 ? 1.0 : 0.1;
        const next = direction === 'up' ? current + step : Math.max(0.1, current - step);
        setCenterStepMhz(next.toFixed(1));
    };

    const handleSpanStepSizeChange = (direction: 'up' | 'down') => {
        const current = parseFloat(spanIncrementMhz) || 1.0;
        const step = current >= 10 ? 5.0 : current >= 1 ? 1.0 : 0.1;
        const next = direction === 'up' ? current + step : Math.max(0.1, current - step);
        setSpanIncrementMhz(next.toFixed(1));
    };

    const applyCenterFreq = (value: string) => {
        const newCenter = parseFloat(value);
        if (!isNaN(newCenter)) {
            const currentSpan = range.max - range.min;
            setRange({ min: parseFloat((newCenter - currentSpan / 2).toFixed(5)), max: parseFloat((newCenter + currentSpan / 2).toFixed(5)) });
        } else setCenterFreqInput(((range.min + range.max) / 2).toFixed(4));
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (e.button !== 0) return;
        setIsDragging(true); setDragState({ startX: e.clientX, startMin: range.min, startMax: range.max });
        (e.target as Element).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDragging || !dragState || !canvasRef.current) { handlePointerHover(e); return; }
        const deltaX = e.clientX - dragState.startX; const canvasWidth = canvasRef.current.clientWidth; const span = dragState.startMax - dragState.startMin; const freqShift = (deltaX / canvasWidth) * span;
        setRange({ min: parseFloat((dragState.startMin - freqShift).toFixed(5)), max: parseFloat((dragState.startMax - freqShift).toFixed(5)) });
        setMouseCoord(null);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => { setIsDragging(false); setDragState(null); (e.target as Element).releasePointerCapture(e.pointerId); };

    const handlePointerHover = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current; if (!canvas) return;
        const rect = canvas.getBoundingClientRect(); const scaleX = canvas.width / rect.width; const internalX = (e.clientX - rect.left) * scaleX;
        setMouseCoord({ clientX: e.clientX, clientY: e.clientY, internalX });
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (!canvasRef.current) return; e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9; const currentSpan = range.max - range.min; const newSpan = currentSpan * zoomFactor; const center = (range.min + range.max) / 2;
        setRange({ min: parseFloat((center - newSpan / 2).toFixed(5)), max: parseFloat((center + newSpan / 2).toFixed(5)) });
    };

    const activeHit = useMemo(() => {
        if (!mouseCoord || !canvasRef.current || isDragging) return null;
        const { internalX } = mouseCoord; const padding = { top: 50, right: 20, bottom: 40, left: 50 }; const chartWidth = canvasRef.current.width - padding.left - padding.right;
        if (internalX < padding.left || internalX > padding.left + chartWidth) return null;
        const freqRange = range.max - range.min; const mouseFreq = range.min + ((internalX - padding.left) / chartWidth) * freqRange; const hitThreshold = (18 / chartWidth) * freqRange;
        
        const forbiddenRanges = TALKBACK_FORBIDDEN_RANGES_BY_COUNTRY[selectedCountry] || [];
        for (const fz of forbiddenRanges) { 
            // Bypass 450-453 MHz AND 465-467 MHz forbidden zones in Mainland Europe mode
            if (mode === 'europe') {
                const is450Range = fz.min >= 450 && fz.max <= 453;
                const is465Range = fz.min >= 465 && fz.max <= 467;
                if (is450Range || is465Range) continue;
            }
            if (mouseFreq >= (fz.min - 0.000005) && mouseFreq <= (fz.max + 0.000005)) return { text: `REGULATORY BLOCKADE`, subtext: `Forbidden in ${selectedCountry}: ${fz.min.toFixed(5)}-${fz.max.toFixed(5)} MHz`, color: '#f87171' }; 
        }
        
        for (const c of allActiveCarriers) { if (Math.abs(mouseFreq - c.value) < hitThreshold) return { text: `${c.label}: ${c.value.toFixed(5)} MHz`, subtext: `Zone: ${c.zoneName}`, color: c.type === 'tx' ? INTERMOD_CONFIG.tx.color : INTERMOD_CONFIG.rx.color }; }
        if (showTwoTone) { for (const im of intermods.twoTone) if (Math.abs(mouseFreq - im.value) < hitThreshold) return { text: `2-Tone IMD: ${im.value.toFixed(5)} MHz`, subtext: `Formula: 2*${im.sources[0].toFixed(3)} - ${im.sources[1].toFixed(3)}`, color: INTERMOD_CONFIG.twoTone.color }; }
        if (showThreeTone) { for (const im of intermods.threeTone) if (Math.abs(mouseFreq - im.value) < hitThreshold) return { text: `3-Tone IMD: ${im.value.toFixed(5)} MHz`, subtext: `Formula: ${im.sources[0].toFixed(3)} + ${im.sources[1].toFixed(3)} - ${im.sources[2].toFixed(3)}`, color: INTERMOD_CONFIG.threeTone.color }; }
        return null;
    }, [mouseCoord, range, allActiveCarriers, intermods, showTwoTone, showThreeTone, isDragging, mode, selectedCountry]);

    const tabulatedData = useMemo(() => {
        const pairs: { tx: number; rx: number; label: string; zoneName: string; bw: number; type: string }[] = [];
        
        manualPairs.forEach((p, idx) => {
            if (p.active === false) return;
            const zoneName = p.zoneIndex !== undefined && p.zoneIndex !== -1 && talkbackZoneConfigs[p.zoneIndex] ? talkbackZoneConfigs[p.zoneIndex].name.toUpperCase() : 'SITE-WIDE';
            let type = 'Duplex';
            if (p.tx > 0 && p.rx === 0) type = 'Simplex Base Tx';
            else if (p.tx === 0 && p.rx > 0) type = 'Simplex Walkie';
            pairs.push({
                tx: p.tx,
                rx: p.rx,
                label: `M${idx + 1}`,
                zoneName,
                bw: Math.max(p.txBw || 0, p.rxBw || 0) || 0.0125,
                type
            });
        });

        if (results) {
            results.forEach((z, zIdx) => {
                z.pairs.forEach((p, pIdx) => {
                    if (p.active === false) return;
                    let type = 'Duplex';
                    if (p.tx > 0 && p.rx === 0) type = 'Simplex Base Tx';
                    else if (p.tx === 0 && p.rx > 0) type = 'Simplex Walkie';
                    pairs.push({
                        tx: p.tx,
                        rx: p.rx,
                        label: `Z${zIdx + 1}P${pIdx + 1}`,
                        zoneName: z.zoneName,
                        bw: 0.0125,
                        type
                    });
                });
            });
        }

        return pairs.sort((a: any, b: any) => {
            let valA = a[sortField]; let valB = b[sortField];
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [manualPairs, results, talkbackZoneConfigs, sortField, sortDirection]);

    const handleExport = (format: 'pdf' | 'csv' | 'xls' | 'doc' | 'txt') => {
        setIsExportMenuOpen(false); const data = tabulatedData; const filename = `zonal_talkback_rf_plan_${new Date().toISOString().slice(0, 10)}`;
        if (format === 'csv' || format === 'xls') {
            let content = "Base Tx (MHz),Portable Rx (MHz),Type,Assigned Zone,Bandwidth (kHz)\n";
            data.forEach(c => content += `${c.tx > 0 ? c.tx.toFixed(5) : '—'},${c.rx > 0 ? c.rx.toFixed(5) : '—'},${c.type},"${c.zoneName}",${(c.bw * 1000).toFixed(1)}\n`);
            const blob = new Blob([content], { type: format === 'xls' ? 'application/vnd.ms-excel' : 'text/csv' });
            const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${filename}.${format}`; a.click();
        } else if (format === 'pdf') {
            // @ts-ignore
            const { jsPDF } = window.jspdf; const doc = new jsPDF();
            doc.setFontSize(18); doc.text("Zonal Talkback RF Plan", 14, 20); doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
            const tableData = data.map(c => [c.tx > 0 ? c.tx.toFixed(5) : '—', c.rx > 0 ? c.rx.toFixed(5) : '—', c.type, c.zoneName, (c.bw * 1000).toFixed(1) + 'k']);
            // @ts-ignore
            doc.autoTable({ startY: 35, head: [['Base Tx', 'Port Rx', 'Type', 'Zone', 'BW']], body: tableData, theme: 'striped', headStyles: { fillColor: [79, 70, 229] } });
            doc.save(`${filename}.pdf`);
        }
    };

    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const canvas = canvasRef.current; if (!canvas) return;
        const observer = new ResizeObserver(() => {
            requestAnimationFrame(() => {
                if (!canvas) return;
                canvas.width = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
                setDimensions({ width: canvas.offsetWidth, height: canvas.offsetHeight });
            });
        });
        observer.observe(canvas);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        const draw = () => {
            const { width, height } = canvas; const padding = { top: 50, right: 20, bottom: 40, left: 50 }; const chartWidth = width - padding.left - padding.right; const chartHeight = height - padding.top - padding.bottom; const maxDb = 0, minDb = -100;
            if (chartWidth <= 0 || chartHeight <= 0) return;
            const freqToX = (f: number) => padding.left + ((f - range.min) / (range.max - range.min)) * chartWidth;
            const ampToY = (amp: number) => padding.top + chartHeight * (1 - (amp - minDb) / (maxDb - minDb));
            ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, width, height);
            ctx.strokeStyle = INTERMOD_CONFIG.grid; ctx.lineWidth = 1; ctx.font = '10px monospace'; ctx.fillStyle = INTERMOD_CONFIG.text; ctx.textAlign = 'right';
            for (let i = 0; i <= 10; i++) { const amp = minDb + (i * 10); const y = ampToY(amp); ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(width - padding.right, y); ctx.stroke(); ctx.fillText(`${amp}`, padding.left - 8, y + 4); }
            ctx.textAlign = 'center'; const freqRange = range.max - range.min;
            for (let i = 0; i <= 10; i++) { const f = range.min + (i * freqRange / 10); const x = freqToX(f); ctx.beginPath(); ctx.moveTo(x, padding.top); ctx.lineTo(x, height - padding.bottom); ctx.stroke(); ctx.fillText(`${f.toFixed(1)}`, x, height - padding.bottom + 15); }
            ctx.fillStyle = 'rgba(239, 68, 68, 0.2)'; 
            const forbiddenRanges = TALKBACK_FORBIDDEN_RANGES_BY_COUNTRY[selectedCountry] || [];
            forbiddenRanges.forEach(fz => { 
                // Bypass 450-453 MHz AND 465-467 MHz forbidden zones in Mainland Europe mode
                if (mode === 'europe') {
                    const is450Range = fz.min >= 450 && fz.max <= 453;
                    const is465Range = fz.min >= 465 && fz.max <= 467;
                    if (is450Range || is465Range) return;
                }
                
                if (fz.max >= range.min && fz.min <= range.max) { 
                    const xS = Math.max(padding.left, freqToX(fz.min)); 
                    const xE = Math.min(width - padding.right, freqToX(fz.max)); 
                    if (xE > xS) { 
                        ctx.fillRect(xS, padding.top, xE - xS, chartHeight); ctx.save(); ctx.translate(xS + 2, padding.top + 10); ctx.rotate(Math.PI / 2); ctx.fillStyle = 'rgba(248, 113, 113, 0.6)'; ctx.font = 'bold 8px sans-serif'; ctx.fillText(`Forbidden in ${selectedCountry}`, 0, 0); ctx.restore(); ctx.fillStyle = 'rgba(239, 68, 68, 0.2)'; 
                    } 
                } 
            });
            const drawSignal = (freq: number, amp: number, color: string, bw: number, label?: string) => {
                if (freq < range.min - bw || freq > range.max + bw) return;
                const x = freqToX(freq); const y = ampToY(amp); const bottomY = height - padding.bottom; const halfBwPx = Math.max(1, (bw / freqRange) * chartWidth / 2);
                ctx.fillStyle = color + '33'; ctx.beginPath(); ctx.moveTo(x - halfBwPx * 2, bottomY); ctx.lineTo(x - halfBwPx, y + 10); ctx.lineTo(x + halfBwPx, y + 10); ctx.lineTo(x + halfBwPx * 2, bottomY); ctx.closePath(); ctx.fill();
                ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, Math.min(halfBwPx * 2, 4)); ctx.beginPath(); ctx.moveTo(x, bottomY); ctx.lineTo(x, y); ctx.stroke();
                ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, ctx.lineWidth + 1, 0, Math.PI * 2); ctx.fill();
                if (label) { ctx.save(); ctx.translate(x, y - 10); ctx.rotate(-Math.PI / 4); ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(label, 0, 0); ctx.restore(); }
            };
            if (showThreeTone) intermods.threeTone.forEach(f => drawSignal(f.value, INTERMOD_CONFIG.threeTone.amp, INTERMOD_CONFIG.threeTone.color, 0.0125));
            if (showTwoTone) intermods.twoTone.forEach(f => drawSignal(f.value, INTERMOD_CONFIG.twoTone.amp, INTERMOD_CONFIG.twoTone.color, 0.0125));
            allActiveCarriers.forEach(c => drawSignal(c.value, INTERMOD_CONFIG.tx.amp, c.type === 'tx' ? INTERMOD_CONFIG.tx.color : INTERMOD_CONFIG.rx.color, c.bw, c.label));
        };
        draw();
    }, [range, allActiveCarriers, intermods, showTwoTone, showThreeTone, mode, dimensions, selectedCountry]);

    const SectionToggle: React.FC<{
        label: string;
        mode: 'standard' | 'custom';
        onChange: (mode: 'standard' | 'custom') => void;
    }> = ({ label, mode, onChange }) => (
        <div className="flex items-center justify-between bg-slate-950/50 p-2 rounded-lg border border-white/5">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
            <div className="flex bg-slate-900 rounded-md p-0.5 border border-slate-800">
                <button
                    onClick={() => onChange('standard')}
                    className={`px-3 py-1 rounded text-[8px] font-black uppercase transition-all ${mode === 'standard' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    Standard
                </button>
                <button
                    onClick={() => onChange('custom')}
                    className={`px-3 py-1 rounded text-[8px] font-black uppercase transition-all ${mode === 'custom' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    Custom
                </button>
            </div>
        </div>
    );

    return (
        <div className="space-y-4 mx-auto">
             <Card>
                <div className="flex justify-between items-center mb-6">
                    <CardTitle className="!mb-0">1. Configure Zonal Bands</CardTitle>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg p-1">
                            <span className="text-[10px] text-slate-500 font-black uppercase px-2">Number of Zones:</span>
                            <input 
                                type="number" 
                                min="1" 
                                max="20" 
                                value={numZonesInput} 
                                onChange={e => handleNumZonesChange(e.target.value)} 
                                className="bg-slate-800 border border-slate-700 rounded w-12 p-1 text-center font-mono text-xs text-white outline-none" 
                            />
                        </div>
                        <div className="flex bg-slate-900 border border-indigo-500/30 rounded-xl p-1 shadow-inner overflow-hidden">
                            <button 
                                onClick={() => setMode('standard')}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${mode === 'standard' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Standard (UK/USA)
                            </button>
                            <button 
                                onClick={() => setMode('europe')}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${mode === 'europe' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Band Reversal
                            </button>
                            <button 
                                onClick={() => setMode('custom')}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${mode === 'custom' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Custom Range
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {talkbackZoneConfigs.map((cfg, zIdx) => (
                    <div key={zIdx} className="bg-slate-900/50 p-4 rounded-xl border border-white/5 space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-xs font-black text-indigo-300 uppercase tracking-widest">{zIdx + 1}: {cfg.name}</h4>
                            <div className="flex items-center gap-2">
                                <label className="text-[9px] text-slate-500 font-bold">Qty</label>
                                <div className="flex items-center bg-slate-950 border border-slate-700 rounded overflow-hidden">
                                    <button onClick={() => setTalkbackZoneConfigs(prev => prev.map((c, i) => i === zIdx ? { ...c, pairCount: Math.max(0, c.pairCount - 1) } : c))} className="p-1 bg-slate-800 hover:bg-slate-700 text-indigo-400 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-2 w-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M19 9l-7 7-7-7" /></svg></button>
                                    <input type="number" value={cfg.pairCount} onChange={e => setTalkbackZoneConfigs(prev => prev.map((c, i) => i === zIdx ? { ...c, pairCount: parseInt(e.target.value) || 0 } : c))} className="w-8 bg-transparent text-center text-[10px] text-indigo-400 font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" /><button onClick={() => setTalkbackZoneConfigs(prev => prev.map((c, i) => i === zIdx ? { ...c, pairCount: c.pairCount + 1 } : c))} className="p-1 bg-slate-800 hover:bg-slate-700 text-indigo-400 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-2 w-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 15l7-7 7 7" /></svg></button>
                                </div>
                            </div>
                        </div>
                        
                        {mode === 'custom' && (
                            <div className="space-y-3">
                                <SectionToggle 
                                    label="Duplex Custom Ranges" 
                                    mode={cfg.duplexCustomMode || 'standard'} 
                                    onChange={(m) => setTalkbackZoneConfigs(prev => prev.map((c, i) => i === zIdx ? { ...c, duplexCustomMode: m } : c))}
                                />
                                
                                {cfg.duplexCustomMode === 'custom' && (
                                    <div className="space-y-3 p-3 bg-slate-950/30 rounded-lg border border-white/5">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Base Tx Range</span>
                                                <div className="flex items-center gap-1">
                                                    <input type="number" value={cfg.customTxMin} onChange={e => setTalkbackZoneConfigs(prev => prev.map((c, i) => i === zIdx ? { ...c, customTxMin: parseFloat(e.target.value) || 0 } : c))} className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white font-mono outline-none" placeholder="Min" />
                                                    <span className="text-slate-500 font-bold">-</span>
                                                    <input type="number" value={cfg.customTxMax} onChange={e => setTalkbackZoneConfigs(prev => prev.map((c, i) => i === zIdx ? { ...c, customTxMax: parseFloat(e.target.value) || 0 } : c))} className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white font-mono outline-none" placeholder="Max" />
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Port Rx Range</span>
                                                <div className="flex items-center gap-1">
                                                    <input type="number" value={cfg.customRxMin} onChange={e => setTalkbackZoneConfigs(prev => prev.map((c, i) => i === zIdx ? { ...c, customRxMin: parseFloat(e.target.value) || 0 } : c))} className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white font-mono outline-none" placeholder="Min" />
                                                    <span className="text-slate-500 font-bold">-</span>
                                                    <input type="number" value={cfg.customRxMax} onChange={e => setTalkbackZoneConfigs(prev => prev.map((c, i) => i === zIdx ? { ...c, customRxMax: parseFloat(e.target.value) || 0 } : c))} className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white font-mono outline-none" placeholder="Max" />
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Bandwidth</span>
                                            <select value={cfg.customBw} onChange={e => setTalkbackZoneConfigs(prev => prev.map((c, i) => i === zIdx ? { ...c, customBw: parseFloat(e.target.value) } : c))} className="bg-slate-800 border border-slate-700 text-white font-mono text-xs rounded px-2 py-1 outline-none w-full">
                                                <option value={0.0125}>12.5 kHz</option>
                                                <option value={0.025}>25 kHz</option>
                                                <option value={0.050}>50 kHz</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {mode !== 'custom' || cfg.duplexCustomMode === 'standard' ? (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                        Base Tx {mode === 'europe' ? '(High)' : '(Low)'}
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                        {baseBands.map(b => (
                                            <button key={b} onClick={() => { setTalkbackZoneConfigs(prev => prev.map((c, i) => { if (i !== zIdx) return c; const next = new Set<number>(c.txBands); if (next.has(b)) next.delete(b); else next.add(b); return { ...c, txBands: next }; })); }} className={`px-1.5 py-0.5 text-[9px] border rounded font-bold transition-all ${cfg.txBands.has(b) ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{b}</button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                        Port Rx {mode === 'europe' ? '(Low)' : '(High)'}
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                        {portBands.map(b => (
                                            <button key={b} onClick={() => { setTalkbackZoneConfigs(prev => prev.map((c, i) => { if (i !== zIdx) return c; const next = new Set<number>(c.rxBands); if (next.has(b)) next.delete(b); else next.add(b); return { ...c, rxBands: next }; })); }} className={`px-1.5 py-0.5 text-[9px] border rounded font-bold transition-all ${cfg.rxBands.has(b) ? 'bg-rose-600 border-rose-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{b}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : null}
                        
                        <div className="border-t border-slate-800 pt-3 mt-3">
                            <div className="flex justify-between items-center mb-2">
                                <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Simplex Frequencies</h5>
                                <div className="flex gap-4">
                                    <div className="flex items-center gap-2">
                                        <label className="text-[9px] text-slate-500 font-bold">Base Tx</label>
                                        <div className="flex items-center bg-slate-950 border border-slate-700 rounded overflow-hidden">
                                            <button onClick={() => setTalkbackZoneConfigs(prev => prev.map((c, i) => i === zIdx ? { ...c, simplexTxCount: Math.max(0, (c.simplexTxCount || 0) - 1) } : c))} className="p-0.5 bg-slate-800 hover:bg-slate-700 text-amber-400 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-2 w-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M19 9l-7 7-7-7" /></svg></button>
                                            <input type="number" value={cfg.simplexTxCount || 0} onChange={e => setTalkbackZoneConfigs(prev => prev.map((c, i) => i === zIdx ? { ...c, simplexTxCount: parseInt(e.target.value) || 0 } : c))} className="w-6 bg-transparent text-center text-[9px] text-amber-400 font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                            <button onClick={() => setTalkbackZoneConfigs(prev => prev.map((c, i) => i === zIdx ? { ...c, simplexTxCount: (c.simplexTxCount || 0) + 1 } : c))} className="p-0.5 bg-slate-800 hover:bg-slate-700 text-amber-400 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-2 w-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 15l7-7 7 7" /></svg></button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-[9px] text-slate-500 font-bold">Walkie</label>
                                        <div className="flex items-center bg-slate-950 border border-slate-700 rounded overflow-hidden">
                                            <button onClick={() => setTalkbackZoneConfigs(prev => prev.map((c, i) => i === zIdx ? { ...c, simplexWalkieCount: Math.max(0, (c.simplexWalkieCount || 0) - 1) } : c))} className="p-0.5 bg-slate-800 hover:bg-slate-700 text-purple-400 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-2 w-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M19 9l-7 7-7-7" /></svg></button>
                                            <input type="number" value={cfg.simplexWalkieCount || 0} onChange={e => setTalkbackZoneConfigs(prev => prev.map((c, i) => i === zIdx ? { ...c, simplexWalkieCount: parseInt(e.target.value) || 0 } : c))} className="w-6 bg-transparent text-center text-[9px] text-purple-400 font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                            <button onClick={() => setTalkbackZoneConfigs(prev => prev.map((c, i) => i === zIdx ? { ...c, simplexWalkieCount: (c.simplexWalkieCount || 0) + 1 } : c))} className="p-0.5 bg-slate-800 hover:bg-slate-700 text-purple-400 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-2 w-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 15l7-7 7 7" /></svg></button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {mode === 'custom' && (
                                <div className="space-y-3 mb-3">
                                    <SectionToggle 
                                        label="Simplex Custom Ranges" 
                                        mode={cfg.simplexCustomMode || 'standard'} 
                                        onChange={(m) => setTalkbackZoneConfigs(prev => prev.map((c, i) => i === zIdx ? { ...c, simplexCustomMode: m } : c))}
                                    />
                                    
                                    {cfg.simplexCustomMode === 'custom' && (
                                        <div className="space-y-3 p-3 bg-slate-950/30 rounded-lg border border-white/5">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Simplex Tx Range</span>
                                                    <div className="flex items-center gap-1">
                                                        <input type="number" value={cfg.simplexTxMin} onChange={e => setTalkbackZoneConfigs(prev => prev.map((c, i) => i === zIdx ? { ...c, simplexTxMin: parseFloat(e.target.value) || 0 } : c))} className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white font-mono outline-none" placeholder="Min" />
                                                        <span className="text-slate-500 font-bold">-</span>
                                                        <input type="number" value={cfg.simplexTxMax} onChange={e => setTalkbackZoneConfigs(prev => prev.map((c, i) => i === zIdx ? { ...c, simplexTxMax: parseFloat(e.target.value) || 0 } : c))} className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white font-mono outline-none" placeholder="Max" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Walkie Range</span>
                                                    <div className="flex items-center gap-1">
                                                        <input type="number" value={cfg.simplexWalkieMin} onChange={e => setTalkbackZoneConfigs(prev => prev.map((c, i) => i === zIdx ? { ...c, simplexWalkieMin: parseFloat(e.target.value) || 0 } : c))} className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white font-mono outline-none" placeholder="Min" />
                                                        <span className="text-slate-500 font-bold">-</span>
                                                        <input type="number" value={cfg.simplexWalkieMax} onChange={e => setTalkbackZoneConfigs(prev => prev.map((c, i) => i === zIdx ? { ...c, simplexWalkieMax: parseFloat(e.target.value) || 0 } : c))} className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white font-mono outline-none" placeholder="Max" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Simplex Tx BW</span>
                                                    <select value={cfg.simplexTxBw} onChange={e => setTalkbackZoneConfigs(prev => prev.map((c, i) => i === zIdx ? { ...c, simplexTxBw: parseFloat(e.target.value) } : c))} className="bg-slate-800 border border-slate-700 text-white font-mono text-xs rounded px-2 py-1 outline-none w-full">
                                                        <option value={0.0125}>12.5 kHz</option>
                                                        <option value={0.025}>25 kHz</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Walkie BW</span>
                                                    <select value={cfg.simplexWalkieBw} onChange={e => setTalkbackZoneConfigs(prev => prev.map((c, i) => i === zIdx ? { ...c, simplexWalkieBw: parseFloat(e.target.value) } : c))} className="bg-slate-800 border border-slate-700 text-white font-mono text-xs rounded px-2 py-1 outline-none w-full">
                                                        <option value={0.0125}>12.5 kHz</option>
                                                        <option value={0.025}>25 kHz</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {mode !== 'custom' || cfg.simplexCustomMode === 'standard' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Base Tx Bands</span>
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {[457, 455, 446, 447, 450, 451, 452].map(b => (
                                                <button key={b} onClick={() => { setTalkbackZoneConfigs(prev => prev.map((c, i) => { if (i !== zIdx) return c; const next = new Set<number>(c.simplexTxBands || new Set<number>()); if (next.has(b)) next.delete(b); else next.add(b); return { ...c, simplexTxBands: next }; })); }} className={`px-1.5 py-0.5 text-[9px] border rounded font-bold transition-all ${(cfg.simplexTxBands || new Set<number>()).has(b) ? 'bg-amber-600 border-amber-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{b}</button>
                                            ))}
                                        </div>
                                        <input type="number" step="0.001" value={cfg.simplexTxBw || 0.0125} onChange={e => setTalkbackZoneConfigs(prev => prev.map((c, i) => i === zIdx ? { ...c, simplexTxBw: parseFloat(e.target.value) || 0.0125 } : c))} placeholder="Tx BW (MHz)" className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-white font-mono text-[9px]" />
                                    </div>
                                    <div>
                                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Walkie-Talkie</span>
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {[467, 468, 469].map(b => (
                                                <button key={b} onClick={() => { setTalkbackZoneConfigs(prev => prev.map((c, i) => { if (i !== zIdx) return c; const next = new Set<number>(c.simplexWalkieBands || new Set<number>()); if (next.has(b)) next.delete(b); else next.add(b); return { ...c, simplexWalkieBands: next }; })); }} className={`px-1.5 py-0.5 text-[9px] border rounded font-bold transition-all ${(cfg.simplexWalkieBands || new Set<number>()).has(b) ? 'bg-purple-600 border-purple-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{b}</button>
                                            ))}
                                        </div>
                                        <input type="number" step="0.001" value={cfg.simplexWalkieBw || 0.0125} onChange={e => setTalkbackZoneConfigs(prev => prev.map((c, i) => i === zIdx ? { ...c, simplexWalkieBw: parseFloat(e.target.value) || 0.0125 } : c))} placeholder="Walkie BW (MHz)" className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-white font-mono text-[9px]" />
                                    </div>
                                </div>
                            ) : null}
                            <div className="mt-2">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Priority</span>
                                <select value={cfg.generationPriority?.join(',') || 'duplex,simplexTx,simplexWalkie'} onChange={e => setTalkbackZoneConfigs(prev => prev.map((c, i) => i === zIdx ? { ...c, generationPriority: e.target.value.split(',') as any } : c))} className="bg-slate-950 border border-slate-700 text-white text-[9px] rounded p-1 w-full">
                                    <option value="duplex,simplexTx,simplexWalkie">Duplex {'>'} Tx {'>'} Walkie</option>
                                    <option value="simplexTx,duplex,simplexWalkie">Tx {'>'} Duplex {'>'} Walkie</option>
                                    <option value="simplexWalkie,duplex,simplexTx">Walkie {'>'} Duplex {'>'} Tx</option>
                                </select>
                            </div>
                        </div>
                    </div>))}
                </div>
            </Card>
             <Card>
                <CardTitle>2. Fixed Site Plan</CardTitle>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {manualPairs.map((p, idx) => { 
                        const active = p.active !== false; 
                        return (
                            <div key={p.id} className={`bg-slate-900/40 p-2 rounded-lg border transition-all ${active ? 'border-white/5' : 'border-slate-800 opacity-60 grayscale-[0.5]'}`}>
                                <div className="flex items-center gap-3">
                                    {/* Toggle Button next to Base Tx */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button 
                                            onClick={() => updateManualPair(p.id, 'active', !active)} 
                                            className={`w-8 h-4 rounded-full relative transition-colors ${active ? 'bg-emerald-500' : 'bg-slate-700'}`}
                                            title={active ? "Deactivate" : "Activate"}
                                        >
                                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${active ? 'left-0.5' : 'left-4.5'}`} />
                                        </button>
                                        
                                        {/* Base Tx */}
                                        <div className="flex items-center gap-1.5 bg-slate-800 rounded px-2 h-8 w-[140px]">
                                            <button 
                                                onClick={() => updateManualPair(p.id, 'txIsBase', !(p.txIsBase ?? (mode === 'europe' ? p.tx > 464 : p.tx < 464)))}
                                                className={`text-[7px] font-black uppercase leading-none w-8 px-1 py-0.5 rounded border transition-colors ${
                                                    (p.txIsBase ?? (mode === 'europe' ? p.tx > 464 : p.tx < 464))
                                                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                                        : 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                                                }`}
                                                title="Toggle Base (Constant TX) vs SW (Intermittent)"
                                            >
                                                {(p.txIsBase ?? (mode === 'europe' ? p.tx > 464 : p.tx < 464)) ? 'Base' : 'SW'}
                                            </button>
                                            <ManualFreqInput value={p.tx} onChange={v => updateManualPair(p.id, 'tx', v)} className="w-full bg-transparent text-[11px] text-white font-mono outline-none font-bold" />
                                            <div className="flex flex-col -gap-1">
                                                <button onClick={() => handleFrequencyStep(p.id, 'tx', 'up')} className="text-slate-500 hover:text-white text-[8px] leading-none">▲</button>
                                                <button onClick={() => handleFrequencyStep(p.id, 'tx', 'down')} className="text-slate-500 hover:text-white text-[8px] leading-none">▼</button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 flex-1">
                                        {/* Port Rx */}
                                        <div className="flex items-center gap-1.5 bg-slate-800 rounded px-2 h-8 w-[140px]">
                                            <button 
                                                onClick={() => updateManualPair(p.id, 'rxIsBase', !(p.rxIsBase ?? (mode === 'europe' ? p.rx > 464 : p.rx < 464)))}
                                                className={`text-[7px] font-black uppercase leading-none w-8 px-1 py-0.5 rounded border transition-colors ${
                                                    (p.rxIsBase ?? (mode === 'europe' ? p.rx > 464 : p.rx < 464))
                                                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                                        : 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                                                }`}
                                                title="Toggle Base (Constant TX) vs SW (Intermittent)"
                                            >
                                                {(p.rxIsBase ?? (mode === 'europe' ? p.rx > 464 : p.rx < 464)) ? 'Base' : 'SW'}
                                            </button>
                                            <ManualFreqInput value={p.rx} onChange={v => updateManualPair(p.id, 'rx', v)} className="w-full bg-transparent text-[11px] text-white font-mono outline-none font-bold" />
                                            <div className="flex flex-col -gap-1">
                                                <button onClick={() => handleFrequencyStep(p.id, 'rx', 'up')} className="text-slate-500 hover:text-white text-[8px] leading-none">▲</button>
                                                <button onClick={() => handleFrequencyStep(p.id, 'rx', 'down')} className="text-slate-500 hover:text-white text-[8px] leading-none">▼</button>
                                            </div>
                                        </div>

                                        {/* BW Dropdown next to frequencies */}
                                        <div className="flex items-center gap-1.5 bg-slate-800 rounded px-2 h-8">
                                            <span className="text-[7px] text-slate-500 font-black uppercase">BW</span>
                                            <select 
                                                value={p.txBw || 0.0125} 
                                                onChange={e => { 
                                                    const val = parseFloat(e.target.value); 
                                                    updateManualPair(p.id, 'txBw', val);
                                                    updateManualPair(p.id, 'rxBw', val);
                                                }} 
                                                className="bg-transparent text-[10px] text-indigo-300 outline-none font-bold cursor-pointer"
                                            >
                                                <option value={0.0125}>12.5k</option>
                                                <option value={0.025}>25k</option>
                                                <option value={0.050}>50k</option>
                                            </select>
                                        </div>

                                        {/* Zone Selector */}
                                        <div className="flex items-center gap-1.5 bg-slate-800 rounded px-2 h-8">
                                            <span className="text-[7px] text-slate-500 font-black uppercase">Zone</span>
                                            <select 
                                                value={p.zoneIndex} 
                                                onChange={e => updateManualPair(p.id, 'zoneIndex', e.target.value)} 
                                                className="bg-transparent text-[10px] text-indigo-300 outline-none font-bold cursor-pointer"
                                            >
                                                <option value={-1}>Site-Wide</option>
                                                {talkbackZoneConfigs.map((z, i) => <option key={i} value={i}>{z.name}</option>)}
                                            </select>
                                        </div>

                                        {/* Lock & Remove */}
                                        <div className="flex items-center gap-1 ml-auto">
                                            <button 
                                                onClick={() => updateManualPair(p.id, 'locked', !p.locked)} 
                                                className={`p-1.5 rounded transition-all ${p.locked ? 'text-amber-500 bg-amber-500/10' : 'text-slate-600 hover:text-slate-300'}`} 
                                                title={p.locked ? "Unlock" : "Lock"}
                                            >
                                                <span className="text-xs">{p.locked ? '🔒' : '🔓'}</span>
                                            </button>
                                            <button 
                                                onClick={() => removeManualPair(p.id)} 
                                                className="text-red-400 p-1.5 font-bold text-lg hover:text-red-300 transition-colors leading-none"
                                                title="Remove"
                                            >
                                                &times;
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 items-center border-t border-white/5 pt-4"><button onClick={addManualPair} className={`${greenButton} flex-grow border-dashed`}>+ Add Single Manual Pair</button><div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg p-1"><span className="text-[10px] text-slate-500 font-black uppercase px-2">Batch:</span><input type="number" min="1" max="50" value={bulkAddCount} onChange={e => setBulkAddCount(parseInt(e.target.value) || 1)} className="bg-slate-800 border border-slate-700 rounded w-12 p-1 text-center font-mono text-xs text-white" /><select value={bulkAddZone} onChange={e => setBulkAddZone(parseInt(e.target.value))} className="bg-slate-800 border border-slate-700 rounded p-1 text-[10px] text-indigo-300 font-bold"><option value={-1}>Site-Wide</option>{talkbackZoneConfigs.map((z, i) => <option key={i} value={i}>{z.name}</option>)}</select><button onClick={handleBulkAddManualPairs} className={`${primaryButton} !px-4 !py-1.5 !text-[10px]`}>Add Batch</button></div></div>
            </Card>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><Card><div className="flex justify-between items-center mb-4"><CardTitle className="!mb-0 text-sm font-black uppercase tracking-widest">📍 Distance Matrix (m)</CardTitle><div className="flex bg-slate-950 border border-indigo-500/30 rounded-lg p-1 items-center gap-2"><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-2">Global Separation:</span><input type="number" value={globalDistInput} onChange={e => setGlobalDistInput(e.target.value)} className="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-cyan-400 text-center outline-none" /><button onClick={handleApplyGlobalDistance} className="bg-indigo-600 hover:bg-indigo-500 text-white text-[8px] font-black uppercase px-2 py-1 rounded transition-colors">Apply All</button></div></div><div className="overflow-x-auto rounded-lg border border-slate-700 shadow-inner bg-black/20"><table className="w-full text-[10px] border-collapse text-center"><thead><tr className="bg-slate-950"><th className="p-2 border border-slate-800"></th>{talkbackZoneConfigs.map((z, i) => <th key={i} className="p-2 border border-slate-800 text-slate-500 font-black">{i+1}</th>)}</tr></thead><tbody>{distances.map((row, rIdx) => (<tr key={rIdx}><th className="p-2 border border-slate-800 bg-slate-950 text-slate-500 font-black">{rIdx+1}</th>{row.map((val, cIdx) => (<td key={cIdx} className="p-0 border border-slate-800">{rIdx === cIdx ? <div className="h-10 bg-slate-900/50" /> : <input type="number" value={val} onChange={e => handleDistanceMatrixChange(rIdx, cIdx, e.target.value)} className="w-full h-10 bg-transparent text-center font-mono text-cyan-400 outline-none focus:bg-indigo-600/10" />}</td>))}</tr>))}</tbody></table></div></Card><Card><CardTitle className="text-sm font-black uppercase tracking-widest">⛓️ Manual IMD Links</CardTitle><div className="overflow-x-auto rounded-lg border border-slate-700 shadow-inner bg-black/20"><table className="w-full text-[10px] border-collapse text-center"><thead><tr className="bg-slate-950"><th className="p-2 border border-slate-800"></th>{talkbackZoneConfigs.map((z, i) => <th key={i} className="p-2 border border-slate-800 text-slate-500 font-black">{i+1}</th>)}</tr></thead><tbody>{compatibilityMatrix.map((row, rIdx) => (<tr key={rIdx}><th className="p-2 border border-slate-800 bg-slate-950 text-slate-500 font-black">{rIdx+1}</th>{row.map((val, cIdx) => (<td key={cIdx} className="p-1 border border-slate-800 text-center">{rIdx === cIdx ? '—' : <input type="checkbox" checked={val} onChange={() => handleMatrixChange(rIdx, cIdx)} className="w-3 h-3 accent-indigo-500" />}</td>))}</tr>))}</tbody></table></div></Card></div>
             <div className="space-y-4"><div className="flex gap-4"><button onClick={handleCalculate} disabled={isLoading} className={`${primaryButton} w-full py-4 text-lg uppercase tracking-widest`}>{isLoading ? `COORDINATING ZONES...` : 'CALCULATE SITE PLAN'}</button>{isLoading && (<button onClick={() => abortControllerRef.current?.abort()} className={`${secondaryButton} !bg-red-600 hover:!bg-red-500 border-red-800 text-white px-8 py-4 text-lg uppercase tracking-widest`}>ABORT</button>)}<button onClick={() => setShowTable(!showTable)} className={`${secondaryButton} !w-auto flex items-center gap-2 px-6`}><span>📊</span> {showTable ? 'HIDE LEDGER' : 'TABULATE DATA'}</button><div className="relative"><button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className={`${actionButton} h-full px-6 flex items-center gap-2`}><span>📥</span> EXPORT</button>{isExportMenuOpen && (<div className="absolute bottom-full right-0 mb-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-[110] overflow-hidden min-w-[220px] animate-in fade-in slide-in-from-bottom-2 duration-200"><button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700 border-b border-white/5 transition-colors">PDF Report</button><button onClick={() => handleExport('xls')} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700 border-b border-white/5 transition-colors">Excel (.XLS)</button></div>)}</div></div>            {(isLoading || results) && (
                <div className="bg-slate-800/80 border border-blue-500/20 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                            {isLoading ? 'Coordinate Seeking In Progress...' : 'Total Zonal Spectral Yield Breakdown'}
                        </span>
                        <span className="text-xs font-bold text-white font-mono">
                            {isLoading ? `${Math.round(progress * 100)}%` : (
                                <div className="flex items-center gap-2">
                                    <span className="text-amber-400">{yieldBreakdown?.simplexTx} Simplex Base Tx</span>
                                    <span className="text-slate-600">/</span>
                                    <span className="text-purple-400">{yieldBreakdown?.simplexWalkie} Simplex Set-to-Set</span>
                                    <span className="text-slate-600">/</span>
                                    <span className="text-blue-400">{yieldBreakdown?.duplex} Duplex Pairs</span>
                                    <span className="text-slate-500 ml-3 bg-slate-900 px-2 py-0.5 rounded border border-white/5">
                                        Total: {totalYield} / {totalTarget}
                                    </span>
                                </div>
                            )}
                        </span>
                    </div>
                    <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-white/5 shadow-inner">
                        <div 
                            className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                            style={{ width: `${Math.min(100, (isLoading ? progress : (totalYield / (totalTarget || 1))) * 100)}%` }} 
                        />
                    </div>
                </div>
            )}
</div>
             {showTable && tabulatedData.length > 0 && (<Card className="!bg-slate-950 border-cyan-500/30 animate-in fade-in slide-in-from-top-2 duration-300"><CardTitle className="!text-sm uppercase tracking-[0.2em] text-cyan-400">Numerical Spectral Allocation Ledger</CardTitle><div className="overflow-y-auto max-h-[400px] rounded-xl border border-white/10 custom-scrollbar shadow-inner"><table className="w-full text-left border-collapse text-[11px]"><thead className="bg-slate-900 sticky top-0 z-10"><tr className="uppercase font-black text-slate-500 border-b border-white/10"><th className="p-3 cursor-pointer select-none" onClick={() => handleSort('tx')}>Base Tx (MHz) <SortArrow field="tx" /></th><th className="p-3 cursor-pointer select-none" onClick={() => handleSort('rx')}>Portable Rx (MHz) <SortArrow field="rx" /></th><th className="p-3 cursor-pointer select-none" onClick={() => handleSort('type')}>Type <SortArrow field="type" /></th><th className="p-3 cursor-pointer select-none" onClick={() => handleSort('zoneName')}>Zone <SortArrow field="zoneName" /></th><th className="p-3 cursor-pointer select-none" onClick={() => handleSort('bw')}>Bandwidth <SortArrow field="bw" /></th></tr></thead><tbody className="divide-y divide-white/5">{tabulatedData.map((row, i) => (<tr key={i} className="hover:bg-cyan-500/5 transition-colors group"><td className="p-3 font-mono text-cyan-400 font-black text-sm">{row.tx > 0 ? row.tx.toFixed(5) : '—'}</td><td className="p-3 font-mono text-blue-400 font-black text-sm">{row.rx > 0 ? row.rx.toFixed(5) : '—'}</td><td className="p-3"><span className="px-2 py-0.5 rounded uppercase text-[8px] font-black border bg-slate-800 border-slate-700 text-slate-300">{row.type}</span></td><td className="p-3"><span className="text-indigo-300 font-black uppercase tracking-tighter">{row.zoneName}</span></td><td className="p-3 font-mono text-slate-500">{(row.bw * 1000).toFixed(1)} kHz</td></tr>))}</tbody></table></div></Card>)}
             <Card><div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">                    <div className="flex items-center gap-3">
                        <CardTitle className="!mb-0">3. Intermod Physics Auditor</CardTitle>
                        <div className="bg-slate-900/40 p-1.5 rounded-xl border border-white/5 flex items-center gap-3 ml-2">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-2">Country</span>
                            <div className="flex bg-slate-950/50 p-1 rounded-lg gap-1 border border-white/5">
                                {['UK', 'USA', 'Other'].map((country) => (
                                    <button
                                        key={country}
                                        onClick={() => setSelectedCountry(country)}
                                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${selectedCountry === country ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        {country}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button onClick={handleRunAudit} className={primaryButton}>RUN SPECTRAL AUDIT</button>
                    </div>

                    {mode === 'custom' && (
                        <div className="flex items-center gap-4 bg-slate-900/60 p-2 px-4 rounded-xl border border-indigo-500/20">
                            <div className="flex items-center gap-3">
                                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Auditor Base TX Range:</span>
                                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-700">
                                    <input 
                                        type="number" 
                                        value={customBaseRange.min} 
                                        onChange={e => setCustomBaseRange(prev => ({ ...prev, min: parseFloat(e.target.value) || 0 }))}
                                        className="w-16 bg-transparent text-white font-mono text-[10px] text-center outline-none"
                                        placeholder="Min"
                                    />
                                    <span className="text-slate-600 font-bold">-</span>
                                    <input 
                                        type="number" 
                                        value={customBaseRange.max} 
                                        onChange={e => setCustomBaseRange(prev => ({ ...prev, max: parseFloat(e.target.value) || 0 }))}
                                        className="w-16 bg-transparent text-white font-mono text-[10px] text-center outline-none"
                                        placeholder="Max"
                                    />
                                </div>
                            </div>
                            <div className="w-px h-4 bg-slate-700" />
                            <div className="flex items-center gap-3">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Auditor SW Range:</span>
                                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-700">
                                    <input 
                                        type="number" 
                                        value={customSwRange.min} 
                                        onChange={e => setCustomSwRange(prev => ({ ...prev, min: parseFloat(e.target.value) || 0 }))}
                                        className="w-16 bg-transparent text-white font-mono text-[10px] text-center outline-none"
                                        placeholder="Min"
                                    />
                                    <span className="text-slate-600 font-bold">-</span>
                                    <input 
                                        type="number" 
                                        value={customSwRange.max} 
                                        onChange={e => setCustomSwRange(prev => ({ ...prev, max: parseFloat(e.target.value) || 0 }))}
                                        className="w-16 bg-transparent text-white font-mono text-[10px] text-center outline-none"
                                        placeholder="Max"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
<div className="flex flex-wrap items-center gap-4 bg-slate-900/80 p-2 rounded-xl border border-slate-700"><div className="flex gap-4 pr-4 border-r border-slate-700/50"><label className="flex items-center gap-2 cursor-pointer group"><input type="checkbox" checked={showTwoTone} onChange={e => setShowTwoTone(e.target.checked)} className="w-4 h-4 rounded accent-red-500 bg-slate-700" /><span className="text-[10px] text-slate-400 font-bold uppercase">2T</span></label><label className="flex items-center gap-2 cursor-pointer group"><input type="checkbox" checked={showThreeTone} onChange={e => setShowThreeTone(e.target.checked)} className="w-4 h-4 rounded accent-purple-500 bg-slate-700" /><span className="text-[10px] text-slate-400 font-bold uppercase">3T</span></label></div><div className="flex items-center gap-2 pr-4 border-r border-slate-700/50"><span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Center</span><div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 shadow-inner"><button onClick={() => handleScroll('left')} className="p-1.5 px-2.5 rounded bg-slate-700/50 text-slate-300 hover:bg-slate-600 transition-colors text-xs font-bold">&larr;</button><input type="text" value={centerFreqInput} onChange={e => setCenterFreqInput(e.target.value)} onFocus={() => { isCenterFreqFocused.current = true; }} onBlur={e => { isCenterFreqFocused.current = false; applyCenterFreq(e.target.value); }} onKeyDown={e => e.key === 'Enter' && applyCenterFreq(e.currentTarget.value)} className="w-20 bg-transparent text-white font-mono text-[10px] text-center font-bold outline-none focus:text-cyan-400" placeholder="0.0000" /><button onClick={() => handleScroll('right')} className="p-1.5 px-2.5 rounded bg-slate-700/50 text-slate-300 hover:bg-slate-600 transition-colors text-xs font-bold">&rarr;</button></div><div className="flex items-center gap-1.5 bg-slate-800/50 px-2 py-1.5 rounded-lg border border-slate-700/50"><span className="text-[8px] text-slate-500 font-black uppercase">Step</span><button onClick={() => handleCenterStepSizeChange('down')} className="text-slate-400 hover:text-white transition-colors">▼</button><span className="text-[10px] font-mono text-indigo-300 w-8 text-center font-bold">{centerStepMhz}</span><button onClick={() => handleCenterStepSizeChange('up')} className="text-slate-400 hover:text-white transition-colors">▲</button></div></div><div className="flex items-center gap-2"><span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Span</span><div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 shadow-inner"><button onClick={() => handleSpanChange('decrease')} className="px-2 py-1 text-white rounded text-[10px] font-black hover:bg-slate-600 transition-colors">-</button><span className="text-[10px] text-cyan-400 font-mono w-16 text-center font-black">{(range.max - range.min).toFixed(1)}M</span><button onClick={() => handleSpanChange('increase')} className="px-2 py-1 text-white rounded text-[10px] font-black hover:bg-slate-600 transition-colors">+</button></div><div className="flex items-center gap-1.5 bg-slate-800/50 px-2 py-1.5 rounded-lg border border-slate-700/50"><span className="text-[8px] text-slate-500 font-black uppercase">Step</span><button onClick={() => handleSpanStepSizeChange('down')} className="text-slate-400 hover:text-white transition-colors">▼</button><span className="text-[10px] font-mono text-indigo-300 w-8 text-center font-bold">{spanIncrementMhz}</span><button onClick={() => handleSpanStepSizeChange('up')} className="text-slate-400 hover:text-white transition-colors">▲</button></div></div></div></div>
                {hasAnalyzed && (<div className="mb-4 animate-in fade-in slide-in-from-top-2 duration-300"><div className={`p-4 rounded-xl border-2 ${diagnosticConflicts.length === 0 ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-red-500/10 border-red-500/40'}`}><div className="flex justify-between items-center mb-3"><h5 className={`text-xs font-black uppercase tracking-widest ${diagnosticConflicts.length === 0 ? 'text-emerald-400' : 'text-red-400'}`}>{diagnosticConflicts.length === 0 ? '✓ Multi-Zone Isolation Confirmed' : `⚠️ ${diagnosticConflicts.length} Zonal Interaction Clashes`}</h5><button onClick={() => setHasAnalyzed(false)} className="text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest">&times; Dismiss Audit</button></div>{diagnosticConflicts.length === 0 ? (<p className="text-[11px] text-emerald-200/70 italic">Spectral analysis confirms zero interaction between all active zones under standard 18.75kHz fundamental and 12.5kHz IMD guard parameters.</p>) : (<div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">{diagnosticConflicts.map((c, i) => (<div key={i} className="bg-black/30 p-2 rounded-lg border border-white/5 text-[10px] flex flex-col gap-1"><div className="flex justify-between font-black"><span className="text-red-400 uppercase">{c.type} Interaction</span><span className="text-slate-500 font-mono">Error: {(c.diff * 1000).toFixed(1)} kHz</span></div><p className="text-slate-300 leading-tight"><span className="text-indigo-400 font-bold">{c.targetFreq.id}</span> ({c.targetFreq.value.toFixed(5)}) {c.type.includes('Fundamental') ? ` too close to carrier ${c.sourceFreqs[0].id} (${c.sourceFreqs[0].value.toFixed(5)})` : ` hit by products of ${c.sourceFreqs.map(f => `${f.id}(${f.value.toFixed(5)})`).join(' and ')}`}</p></div>))}</div>)}</div></div>)}
                <div className="relative group">
                    <canvas 
                        ref={canvasRef} 
                        className={`w-full h-[250px] md:h-[350px] bg-slate-950 rounded-xl border border-blue-500/20 shadow-inner ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        onWheel={handleWheel}
                    />
                    {activeHit && mouseCoord && !isDragging && (
                        <div 
                            className="fixed z-[100] p-2.5 bg-slate-900/95 border border-white/20 rounded-lg shadow-2xl pointer-events-none backdrop-blur-md transform -translate-x-1/2 -translate-y-full" 
                            style={{ left: mouseCoord.clientX, top: mouseCoord.clientY - 6 }}
                        >
                            <div className="flex flex-col gap-0.5">
                                <div className="text-[11px] font-black uppercase tracking-tight" style={{ color: activeHit.color }}>{activeHit.text}</div>
                                <div className="text-[10px] text-slate-400 font-mono italic">{activeHit.subtext}</div>
                            </div>
                            <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 border-r border-b border-white/20 transform rotate-45" />
                        </div>
                    )}
                </div>
                
                {/* REINSTATED CALCULATED RESULTS PER ZONE */}
                <div className="mt-6 space-y-6">
                    {results?.map((z, zIdx) => (
                        <div key={zIdx} className="bg-slate-900/40 rounded-2xl border border-white/5 p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2">
                                <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest">{z.zoneName} Coordination Yield</h4>
                                <div className="flex gap-2">
                                    <button onClick={() => handleZoneLockAllToggle(zIdx)} className="text-[9px] font-black bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded hover:bg-slate-700 transition-colors">TOGGLE LOCKS</button>
                                    <button onClick={() => handleZoneActiveToggle(zIdx)} className="text-[9px] font-black bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded hover:bg-slate-700 transition-colors">TOGGLE RF</button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {z.pairs.map(p => {
                                    const active = p.active !== false;
                                    return (
                                        <div key={p.id} className={`p-3 bg-slate-800/80 border transition-all rounded-xl flex justify-between items-center group ${active ? 'border-white/5 hover:border-indigo-500/30' : 'border-slate-800 opacity-60 grayscale-[0.5]'}`}>
                                            <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                                                    <button onClick={() => handleActiveToggle(zIdx, p.id)} className={`w-8 h-4 rounded-full relative transition-colors ${active ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                                                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${active ? 'left-0.5' : 'left-4.5'}`} />
                                                    </button>
                                                    <span className={`text-[8px] font-black uppercase ${active ? 'text-emerald-400' : 'text-slate-500'}`}>{active ? 'ON' : 'OFF'}</span>
                                                </div>
                                                <div className="font-mono text-[10px] space-y-1.5 flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-1.5 bg-black/20 rounded p-1">
                                                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                            <button 
                                                                onClick={() => handleToggleBase(zIdx, p.id, 'txIsBase')}
                                                                className={`text-[8px] font-black flex-shrink-0 px-1 py-0.5 rounded border transition-colors ${
                                                                    (p.txIsBase ?? (mode === 'europe' ? p.tx > 464 : p.tx < 464))
                                                                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                                                        : 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                                                                }`}
                                                                title="Toggle Base (Constant TX) vs SW (Intermittent)"
                                                            >
                                                                {(p.txIsBase ?? (mode === 'europe' ? p.tx > 464 : p.tx < 464)) ? 'BASE' : 'SW'}
                                                            </button>
                                                            <ManualFreqInput value={p.tx} onChange={(v) => handleResultFrequencyChange(zIdx, p.id, 'tx', v)} className="w-full bg-transparent p-0 text-white font-bold outline-none border-none text-[10px]" />
                                                        </div>
                                                        <div className="flex gap-0.5 transition-opacity flex-shrink-0">
                                                            <button onClick={() => handleFrequencyStep(p.id, 'tx', 'down')} className="text-[8px] bg-slate-700 text-white rounded px-1 hover:bg-blue-600">-</button>
                                                            <button onClick={() => handleFrequencyStep(p.id, 'tx', 'up')} className="text-[8px] bg-slate-700 text-white rounded px-1 hover:bg-blue-600">+</button>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-1.5 bg-black/20 rounded p-1">
                                                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                            <button 
                                                                onClick={() => handleToggleBase(zIdx, p.id, 'rxIsBase')}
                                                                className={`text-[8px] font-black flex-shrink-0 px-1 py-0.5 rounded border transition-colors ${
                                                                    (p.rxIsBase ?? (mode === 'europe' ? p.rx > 464 : p.rx < 464))
                                                                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                                                        : 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                                                                }`}
                                                                title="Toggle Base (Constant TX) vs SW (Intermittent)"
                                                            >
                                                                {(p.rxIsBase ?? (mode === 'europe' ? p.rx > 464 : p.rx < 464)) ? 'BASE' : 'SW'}
                                                            </button>
                                                            <ManualFreqInput value={p.rx} onChange={(v) => handleResultFrequencyChange(zIdx, p.id, 'rx', v)} className="w-full bg-transparent p-0 text-white font-bold outline-none border-none text-[10px]" />
                                                        </div>
                                                        <div className="flex gap-0.5 transition-opacity flex-shrink-0">
                                                            <button onClick={() => handleFrequencyStep(p.id, 'rx', 'down')} className="text-[8px] bg-slate-700 text-white rounded px-1 hover:bg-blue-600">-</button>
                                                            <button onClick={() => handleFrequencyStep(p.id, 'rx', 'up')} className="text-[8px] bg-slate-700 text-white rounded px-1 hover:bg-blue-600">+</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 ml-1.5 border-l border-white/10 pl-1.5 flex-shrink-0">
                                                <button onClick={() => handleLockToggle(zIdx, p.id)} className={`p-1 rounded transition-all ${p.locked ? 'text-amber-500 bg-amber-500/10' : 'text-slate-600 hover:text-slate-300'}`} title={p.locked ? "Unlock" : "Lock"}
                                                >
                                                    <span className="text-xs">{p.locked ? '🔒' : '🔓'}</span>
                                                </button>
                                                <button onClick={() => handleRemoveResult(zIdx, p.id)} className="text-red-400 hover:text-red-300 p-1 font-bold text-lg leading-none" title="Remove pair">&times;</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
};

export default ZonalTalkbackTab;
