
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Card, { CardTitle, Placeholder } from './Card';
import { DuplexPair, TalkbackIntermods, IntermodProduct, TalkbackSolution, Conflict, Frequency, Thresholds, TxType, TalkbackMode } from '../types';
import { calculateTalkbackIntermods, checkTalkbackCompatibility, toHz } from '../services/rfService';
import { DISCRETE_TALKBACK_PAIRS, TALKBACK_DEFINITIONS, TALKBACK_FIXED_PAIRS, TALKBACK_FORBIDDEN_RANGES_BY_COUNTRY } from '../constants';
import { EngagingLoadingState, CelebratorySuccessState } from './EngagingStates';

interface DuplexPairWithBw extends DuplexPair {
    txBw?: number;
    rxBw?: number;
}

const buttonBase = "px-6 py-2.5 rounded-lg font-semibold uppercase tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transform active:translate-y-0.5 text-xs";
const primaryButton = `bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-b-4 border-blue-800 hover:border-blue-700 hover:brightness-110 ${buttonBase} disabled:opacity-50`;
const secondaryButton = `bg-slate-700 text-slate-200 border-b-4 border-slate-900 hover:border-slate-800 hover:bg-slate-600 ${buttonBase}`;
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
        if (!isFocused.current) {
            setLocalString(value === 0 ? '' : value.toString());
        }
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

interface TalkbackTabProps {
    manualPairs: DuplexPair[];
    setManualPairs: React.Dispatch<React.SetStateAction<DuplexPair[]>>;
    results: DuplexPair[] | null;
    setResults: React.Dispatch<React.SetStateAction<DuplexPair[] | null>>;
}

const TalkbackTab: React.FC<TalkbackTabProps> = ({ manualPairs, setManualPairs, results, setResults }) => {
    const [mode, setMode] = useState<TalkbackMode>('standard');
    const [txBands, setTxBands] = useState<Set<number>>(new Set());
    const [rxBands, setRxBands] = useState<Set<number>>(new Set());
    const [simplexTxBands, setSimplexTxBands] = useState<Set<number>>(new Set());
    const [simplexWalkieBands, setSimplexWalkieBands] = useState<Set<number>>(new Set());
    const [pairCount, setPairCount] = useState<number>(8);
    const [simplexTxCount, setSimplexTxCount] = useState<number>(2);
    const [simplexWalkieCount, setSimplexWalkieCount] = useState<number>(4);
    const [selectedCountry, setSelectedCountry] = useState<'UK' | 'USA' | 'Other'>('UK');
    
    // New state for enhancements
    const [simplexTxBw, setSimplexTxBw] = useState<number>(0.0125);
    const [simplexWalkieBw, setSimplexWalkieBw] = useState<number>(0.0125);
    const [generationPriority, setGenerationPriority] = useState<('duplex' | 'simplexTx' | 'simplexWalkie')[]>(['duplex', 'simplexTx', 'simplexWalkie']);
    
    const [isCalculating, setIsCalculating] = useState(false);
    const [genProgress, setGenProgress] = useState(0);
    const [showTable, setShowTable] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [sortField, setSortField] = useState<string>('tx');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [bulkAddCount, setBulkAddCount] = useState(4);
    const abortControllerRef = useRef<AbortController | null>(null);
    
    // Custom Range State
    const [customTxMin, setCustomTxMin] = useState<number>(414);
    const [customTxMax, setCustomTxMax] = useState<number>(415);
    const [customRxMin, setCustomRxMin] = useState<number>(424);
    const [customRxMax, setCustomRxMax] = useState<number>(425);
    const [customBw, setCustomBw] = useState<number>(0.0125);
    
    // Per-section custom modes
    const [duplexCustomMode, setDuplexCustomMode] = useState<'standard' | 'custom'>('custom');
    const [simplexCustomMode, setSimplexCustomMode] = useState<'standard' | 'custom'>('custom');
    
    // Simplex Custom Ranges
    const [simplexTxMin, setSimplexTxMin] = useState<number>(450);
    const [simplexTxMax, setSimplexTxMax] = useState<number>(453);
    const [simplexWalkieMin, setSimplexWalkieMin] = useState<number>(465);
    const [simplexWalkieMax, setSimplexWalkieMax] = useState<number>(467);

    // Auditor Custom Ranges
    const [customBaseRange, setCustomBaseRange] = useState({ min: 450, max: 464 });
    const [customSwRange, setCustomSwRange] = useState({ min: 464, max: 470 });

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

    // Audit State
    const [diagnosticConflicts, setDiagnosticConflicts] = useState<Conflict[]>([]);
    const [hasAnalyzed, setHasAnalyzed] = useState(false);

    const baseBands = mode === 'europe' ? EUROPE_BASE_BANDS : STANDARD_BASE_BANDS;
    const portBands = mode === 'europe' ? EUROPE_PORT_BANDS : STANDARD_PORT_BANDS;

    useEffect(() => {
        setCenterFreqInput(((range.min + range.max) / 2).toFixed(4));
    }, [range]);

    const handleBandChange = (band: number, type: 'tx' | 'rx') => {
        const setter = type === 'tx' ? setTxBands : setRxBands;
        setter(prev => {
            const newSet = new Set(prev);
            if (newSet.has(band)) newSet.delete(band);
            else newSet.add(band);
            return newSet;
        });
    };

    const handleSimplexBandChange = (band: number, type: 'tx' | 'walkie') => {
        const setter = type === 'tx' ? setSimplexTxBands : setSimplexWalkieBands;
        setter(prev => {
            const newSet = new Set(prev);
            if (newSet.has(band)) newSet.delete(band);
            else newSet.add(band);
            return newSet;
        });
    };

    const addManualPair = () => setManualPairs(p => [...p, { 
        id: `man-${Date.now()}-${Math.random()}`, 
        label: `Manual ${p.length + 1}`, 
        tx: 0, 
        rx: 0, 
        groupName: 'Manual', 
        locked: false, 
        active: true,
        txBw: 0.0125,
        rxBw: 0.0125
    } as DuplexPairWithBw]);

    const handleBulkAddManualPairs = () => {
        const count = Math.max(1, Math.min(50, bulkAddCount));
        const newBatch: DuplexPairWithBw[] = Array.from({ length: count }, (_, i) => ({
            id: `man-${Date.now()}-${i}-${Math.random()}`,
            label: `Manual ${manualPairs.length + i + 1}`,
            tx: 0,
            rx: 0,
            groupName: 'Manual',
            locked: false,
            active: true,
            txBw: 0.0125,
            rxBw: 0.0125
        }));
        setManualPairs(p => [...p, ...newBatch]);
    };

    const removeManualPair = (id: string) => setManualPairs(p => p.filter(pair => pair.id !== id));
    
    const updateManualPair = (id: string, field: string, value: any) => {
        setManualPairs(p => p.map(pair => {
            if (pair.id === id) {
                const isNumeric = (field === 'tx' || field === 'rx' || field === 'txBw' || field === 'rxBw') && typeof value !== 'boolean';
                const numVal = isNumeric ? (parseFloat(value) || 0) : value;
                return { ...pair, [field]: numVal };
            }
            return pair;
        }));
    };

    const handleToggleBase = (pairId: string, field: 'txIsBase' | 'rxIsBase') => {
        setResults(prev => prev ? prev.map(p => p.id === pairId ? { ...p, [field]: !p[field] } : p) : null);
    };

    const handleResultChange = (id: string, field: 'tx' | 'rx', value: string) => {
        const numVal = parseFloat(value) || 0;
        setResults(prev => prev ? prev.map(p => p.id === id ? { ...p, [field]: numVal } : p) : null);
    };
    
    const handleFrequencyStep = (pairId: string, field: 'tx' | 'rx', direction: 'up' | 'down') => {
        const step = 0.00625; 
        const updateLogic = (pairs: DuplexPair[]): DuplexPair[] => pairs.map(p => {
            if (p.id === pairId) {
                const typedField = field as 'tx' | 'rx';
                const currentVal = p[typedField] || 0;
                const newVal = parseFloat((direction === 'up' ? currentVal + step : currentVal - step).toFixed(5));
                return { ...p, [typedField]: newVal };
            }
            return p;
        });
        if (manualPairs.some(p => p.id === pairId)) setManualPairs(updateLogic);
        else setResults(current => current ? updateLogic(current) : null);
    };

    const handleResultLockToggle = (id: string) => {
        setResults(prev => prev ? prev.map(p => p.id === id ? { ...p, locked: !p.locked } : p) : null);
    };

    const handleResultActiveToggle = (id: string) => {
        setResults(prev => prev ? prev.map(p => p.id === id ? { ...p, active: p.active === false } : p) : null);
    };

    const handleRemoveResult = (id: string) => {
        setResults(prev => prev ? prev.filter(p => p.id !== id) : null);
    };

    const allResultsLocked = useMemo(() => {
        if (!results || results.length === 0) return false;
        return results.every(p => p.locked);
    }, [results]);

    const handleLockAllResults = () => {
        if (!results) return;
        const targetState = !allResultsLocked;
        setResults(results.map(p => ({ ...p, locked: targetState })));
    };

    const handleGenerate = async () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const abortController = new AbortController();
        abortControllerRef.current = abortController;
        const signal = abortController.signal;

        setIsCalculating(true);
        setGenProgress(0);
        await new Promise(r => setTimeout(r, 50));

        const SPACING_FF = 0.01875; 
        const SPACING_IMD = 0.0125; 

        const isForbidden = (f: number) => {
            // Disable 450-453 MHz AND 465-467 MHz forbidden zones in Mainland Europe mode
            if (mode === 'europe') {
                const is450Range = f >= 450 && f <= 453;
                const is465Range = f >= 465 && f <= 467;
                if (is450Range || is465Range) return false;
            }
            const forbiddenRanges = TALKBACK_FORBIDDEN_RANGES_BY_COUNTRY[selectedCountry] || [];
            return forbiddenRanges.some(range => f >= (range.min - 0.000005) && f <= (range.max + 0.000005));
        };

        const lockedResults = results?.filter(p => p.locked && p.active !== false) || [];
        const activeTxManual = [
            ...manualPairs.filter(p => p.tx > 0 && p.active !== false).map(p => p.tx),
            ...lockedResults.map(p => p.tx)
        ];
        const activeRxManual = [
            ...manualPairs.filter(p => p.rx > 0 && p.active !== false).map(p => p.rx),
            ...lockedResults.map(p => p.rx)
        ];
        const fixedVictims = [...activeTxManual, ...activeRxManual];

        const checkPairComp = (cand: {tx: number, rx: number}, plan: DuplexPair[]) => {
            const SPACING_FF_HZ = toHz(SPACING_FF);
            const SPACING_IMD_HZ = toHz(SPACING_IMD);

            if (cand.tx > 0 && isForbidden(cand.tx)) return false;
            if (cand.rx > 0 && isForbidden(cand.rx)) return false;

            const candTxHz = toHz(cand.tx);
            const candRxHz = toHz(cand.rx);

            const currentTx = [...activeTxManual, ...plan.filter(p => p.tx > 0).map(p => p.tx)];
            const currentVictims = [...fixedVictims, ...plan.flatMap(p => [p.tx, p.rx]).filter(f => f > 0)];
            const victimHzPool = currentVictims.map(f => toHz(f));

            // Fundamental Spacing
            for (const vHz of victimHzPool) {
                if (cand.tx > 0 && Math.abs(candTxHz - vHz) < SPACING_FF_HZ) return false;
                if (cand.rx > 0 && Math.abs(candRxHz - vHz) < SPACING_FF_HZ) return false;
            }
            if (cand.tx > 0 && cand.rx > 0 && Math.abs(candTxHz - candRxHz) < SPACING_FF_HZ) return false;

            // IMD Checks
            const nextTxPool = cand.tx > 0 ? [...currentTx, cand.tx] : currentTx;
            const txHzPool = nextTxPool.map(f => toHz(f));

            const allVictimHz = [...victimHzPool];
            if (cand.tx > 0) allVictimHz.push(candTxHz);
            if (cand.rx > 0) allVictimHz.push(candRxHz);

            for (let i = 0; i < txHzPool.length; i++) {
                const f1 = txHzPool[i];
                for (let j = 0; j < txHzPool.length; j++) {
                    if (i === j) continue;
                    const f2 = txHzPool[j];
                    const p2 = 2 * f1 - f2;
                    
                    // Skip if product lands on one of the sources (self-hit)
                    if (Math.abs(p2 - f1) < SPACING_IMD_HZ || Math.abs(p2 - f2) < SPACING_IMD_HZ) {
                        // Continue to 3-tone loop
                    } else {
                        for (const vHz of allVictimHz) {
                            if (Math.abs(vHz - p2) < SPACING_IMD_HZ) return false;
                        }
                    }

                    for (let k = j + 1; k < txHzPool.length; k++) {
                        if (k === i) continue;
                        const f3 = txHzPool[k];
                        const p3s = [f1 + f2 - f3, f1 + f3 - f2, f2 + f3 - f1];
                        for (const p3 of p3s) {
                            // Skip if product lands on one of the sources (self-hit)
                            if (Math.abs(p3 - f1) < SPACING_IMD_HZ || Math.abs(p3 - f2) < SPACING_IMD_HZ || Math.abs(p3 - f3) < SPACING_IMD_HZ) continue;

                            for (const vHz of allVictimHz) {
                                if (Math.abs(vHz - p3) < SPACING_IMD_HZ) return false;
                            }
                        }
                    }
                }
            }
            return true;
        };

        const selectedTxBands: number[] = Array.from(txBands);
        const selectedRxBands: number[] = Array.from(rxBands);
        const selectedSimplexTxBands: number[] = Array.from(simplexTxBands);
        const selectedSimplexWalkieBands: number[] = Array.from(simplexWalkieBands);
        
        const txFreqPool: number[] = [];
        const rxFreqPool: number[] = [];
        const simplexTxPool: number[] = [];
        const simplexWalkiePool: number[] = [];
        let fullPool: {tx: number, rx: number}[] = [];

        // DUPLEX POOL GENERATION
        if (mode === 'custom' && duplexCustomMode === 'custom') {
            const startOffset = customBw / 2;
            for (let f = customTxMin + startOffset; f <= customTxMax; f += customBw) {
                txFreqPool.push(parseFloat(f.toFixed(5)));
            }
            for (let f = customRxMin + startOffset; f <= customRxMax; f += customBw) {
                rxFreqPool.push(parseFloat(f.toFixed(5)));
            }
        } else {
            selectedTxBands.forEach(txB => {
                const partnerRxB = TALKBACK_FIXED_PAIRS[txB];
                if (partnerRxB && selectedRxBands.includes(partnerRxB)) {
                    // Skip adding to txFreqPool, we will use discrete pairs
                } else {
                    const def = TALKBACK_DEFINITIONS[txB];
                    if (def) for (let f = def.min; f <= def.max + 0.000001; f += 0.0125) txFreqPool.push(parseFloat(f.toFixed(5)));
                }
            });
            selectedRxBands.forEach(rxB => {
                const isPartner = selectedTxBands.some(txB => TALKBACK_FIXED_PAIRS[txB] === rxB);
                if (isPartner) {
                    // Skip adding to rxFreqPool
                } else {
                    const def = TALKBACK_DEFINITIONS[rxB];
                    if (def) for (let f = def.min; f <= def.max + 0.000001; f += 0.0125) rxFreqPool.push(parseFloat(f.toFixed(5)));
                }
            });
            selectedTxBands.forEach(txB => {
                const partnerRxB = TALKBACK_FIXED_PAIRS[txB];
                if (partnerRxB && selectedRxBands.includes(partnerRxB)) {
                    const discrete = DISCRETE_TALKBACK_PAIRS[txB];
                    if (discrete) fullPool.push(...discrete);
                }
            });
        }

        // SIMPLEX POOL GENERATION
        if (mode === 'custom' && simplexCustomMode === 'custom') {
            const txStartOffset = simplexTxBw / 2;
            for (let f = simplexTxMin + txStartOffset; f <= simplexTxMax; f += simplexTxBw) {
                simplexTxPool.push(parseFloat(f.toFixed(5)));
            }
            const walkieStartOffset = simplexWalkieBw / 2;
            for (let f = simplexWalkieMin + walkieStartOffset; f <= simplexWalkieMax; f += simplexWalkieBw) {
                simplexWalkiePool.push(parseFloat(f.toFixed(5)));
            }
        } else {
            selectedSimplexTxBands.forEach(b => {
                const def = TALKBACK_DEFINITIONS[b];
                if (def) for (let f = def.min; f <= def.max + 0.000001; f += 0.0125) simplexTxPool.push(parseFloat(f.toFixed(5)));
            });

            selectedSimplexWalkieBands.forEach(b => {
                const def = TALKBACK_DEFINITIONS[b];
                if (def) for (let f = def.min; f <= def.max + 0.000001; f += 0.0125) simplexWalkiePool.push(parseFloat(f.toFixed(5)));
            });
        }

        const sTx = txFreqPool.slice().sort(() => Math.random() - 0.5);
        const sRx = rxFreqPool.slice().sort(() => Math.random() - 0.5);
        if (sTx.length > 0 && sRx.length > 0) {
            for (let i = 0; i < Math.min(sTx.length, 3000); i++) fullPool.push({ tx: sTx[i], rx: sRx[i % sRx.length] });
        }
        
        const sSimplexTx = simplexTxPool.slice().sort(() => Math.random() - 0.5).map(f => ({ tx: f, rx: 0 }));
        const sSimplexWalkie = simplexWalkiePool.slice().sort(() => Math.random() - 0.5).map(f => ({ tx: 0, rx: f }));

        if (fullPool.length === 0 && sSimplexTx.length === 0 && sSimplexWalkie.length === 0) { setIsCalculating(false); return; }
        
        let bestSolution: DuplexPair[] = [];
        
        const lockedDuplex = lockedResults.filter(p => p.tx > 0 && p.rx > 0);
        const lockedSimplexTx = lockedResults.filter(p => p.tx > 0 && p.rx === 0);
        const lockedSimplexWalkie = lockedResults.filter(p => p.tx === 0 && p.rx > 0);

        const targetDuplex = Math.max(0, pairCount - lockedDuplex.length);
        const targetSimplexTx = Math.max(0, simplexTxCount - lockedSimplexTx.length);
        const targetSimplexWalkie = Math.max(0, simplexWalkieCount - lockedSimplexWalkie.length);

        for (let i = 0; i < 5000; i++) {
            if (signal.aborted) {
                setIsCalculating(false);
                setGenProgress(0);
                abortControllerRef.current = null;
                console.log('Calculation aborted');
                return;
            }
            const current: DuplexPair[] = [];
            
            // Try to add duplex pairs
            const items = [...fullPool].sort(() => Math.random() - 0.5);
            for (const cand of items) {
                if (current.filter(p => p.tx > 0 && p.rx > 0).length >= targetDuplex) break;
                if (checkPairComp(cand, current)) {
                    current.push({ id: `G-${i}-${current.length}-${Date.now()}`, label: `CH ${current.length + 1 + lockedResults.length}`, tx: cand.tx, rx: cand.rx, groupName: 'Generated', locked: false, active: true });
                }
            }
            
            // Try to add simplex Tx
            const itemsSimplexTx = [...sSimplexTx].sort(() => Math.random() - 0.5);
            for (const cand of itemsSimplexTx) {
                if (current.filter(p => p.tx > 0 && p.rx === 0).length >= targetSimplexTx) break;
                if (checkPairComp(cand, current)) {
                    current.push({ id: `G-STX-${i}-${current.length}-${Date.now()}`, label: `Simplex Tx ${current.filter(p => p.tx > 0 && p.rx === 0).length + 1 + lockedSimplexTx.length}`, tx: cand.tx, rx: cand.rx, groupName: 'Simplex Tx', locked: false, active: true });
                }
            }

            // Try to add simplex Walkie
            const itemsSimplexWalkie = [...sSimplexWalkie].sort(() => Math.random() - 0.5);
            for (const cand of itemsSimplexWalkie) {
                if (current.filter(p => p.tx === 0 && p.rx > 0).length >= targetSimplexWalkie) break;
                if (checkPairComp(cand, current)) {
                    current.push({ id: `G-SW-${i}-${current.length}-${Date.now()}`, label: `Walkie ${current.filter(p => p.tx === 0 && p.rx > 0).length + 1 + lockedSimplexWalkie.length}`, tx: cand.tx, rx: cand.rx, groupName: 'Walkie-Talkie', locked: false, active: true });
                }
            }

            if (current.length > bestSolution.length) { 
                bestSolution = current; 
                if (
                    current.filter(p => p.tx > 0 && p.rx > 0).length >= targetDuplex &&
                    current.filter(p => p.tx > 0 && p.rx === 0).length >= targetSimplexTx &&
                    current.filter(p => p.tx === 0 && p.rx > 0).length >= targetSimplexWalkie
                ) {
                    break;
                }
            }
            if (i % 500 === 0) {
                setGenProgress(i / 5000);
                await new Promise(r => setTimeout(r, 0));
            }
        }
        setResults([...lockedResults, ...bestSolution]);
        setGenProgress(1);
        setIsCalculating(false);
        setShowSuccess(true);
        abortControllerRef.current = null;
    };

    const allActiveCarriers = useMemo(() => {
        const carriers: { value: number; label: string; type: 'tx' | 'rx'; groupName: string; bw: number; isTx?: boolean }[] = [];
        manualPairs.forEach((p: DuplexPairWithBw) => {
            if (p.active === false) return;
            
            let txIsBase = p.txIsBase;
            let rxIsBase = p.rxIsBase;
            
            if (txIsBase === undefined && mode === 'custom') {
                txIsBase = p.tx >= customBaseRange.min && p.tx <= customBaseRange.max;
            }
            if (rxIsBase === undefined && mode === 'custom') {
                rxIsBase = p.rx >= customBaseRange.min && p.rx <= customBaseRange.max;
            }

            if (p.tx > 0) carriers.push({ value: p.tx, label: `${p.label} (Base TX)`, type: 'tx', groupName: p.groupName, bw: p.txBw || 0.0125, isTx: txIsBase });
            if (p.rx > 0) carriers.push({ value: p.rx, label: `${p.label} (Port RX)`, type: 'rx', groupName: p.groupName, bw: p.rxBw || 0.0125, isTx: rxIsBase });
        });
        if (results) {
            results.forEach((p) => {
                if (p.active === false) return;
                
                let txIsBase = p.txIsBase;
                let rxIsBase = p.rxIsBase;
                
                if (txIsBase === undefined && mode === 'custom') {
                    txIsBase = p.tx >= customBaseRange.min && p.tx <= customBaseRange.max;
                }
                if (rxIsBase === undefined && mode === 'custom') {
                    rxIsBase = p.rx >= customBaseRange.min && p.rx <= customBaseRange.max;
                }

                if (p.tx > 0) carriers.push({ value: p.tx, label: `${p.label} (Base TX)`, type: 'tx', groupName: p.groupName, bw: 0.0125, isTx: txIsBase });
                if (p.rx > 0) carriers.push({ value: p.rx, label: `${p.label} (Port RX)`, type: 'rx', groupName: p.groupName, bw: 0.0125, isTx: rxIsBase });
            });
        }
        return carriers;
    }, [results, manualPairs, mode, customBaseRange]);

    const handleRunAudit = () => {
        const freqList: Frequency[] = allActiveCarriers.map((c) => ({
            id: c.label,
            value: c.value,
            type: 'comms' as TxType,
            zoneIndex: 0,
            isTx: c.isTx
        }));
        const dummyDist = [[0]];
        const dummyMatrix = [[false]];
        const result = checkTalkbackCompatibility(freqList, dummyDist, dummyMatrix, mode, selectedCountry, customBaseRange);
        setDiagnosticConflicts(result.conflicts);
        setHasAnalyzed(true);
    };

    const yieldBreakdown = useMemo(() => {
        if (!results) return null;
        const duplex = results.filter(p => p.tx > 0 && p.rx > 0).length;
        const simplexTx = results.filter(p => p.tx > 0 && p.rx === 0).length;
        const simplexWalkie = results.filter(p => p.tx === 0 && p.rx > 0).length;
        return { duplex, simplexTx, simplexWalkie };
    }, [results]);

    const totalTarget = pairCount + simplexTxCount + simplexWalkieCount;
    const totalYield = (yieldBreakdown?.duplex || 0) + (yieldBreakdown?.simplexTx || 0) + (yieldBreakdown?.simplexWalkie || 0);

    const handleSort = (field: string) => {
        if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDirection('asc'); }
    };

    const tabulatedData = useMemo(() => {
        const pairs: { tx: number; rx: number; label: string; groupName: string; bw: number; type: string }[] = [];
        
        manualPairs.forEach(p => {
            if (p.active === false) return;
            let type = 'Duplex';
            if (p.tx > 0 && p.rx === 0) type = 'Simplex Base Tx';
            else if (p.tx === 0 && p.rx > 0) type = 'Simplex Walkie';
            pairs.push({
                tx: p.tx,
                rx: p.rx,
                label: p.label,
                groupName: p.groupName || 'Manual',
                bw: Math.max(p.txBw || 0, p.rxBw || 0) || 0.0125,
                type
            });
        });

        if (results) {
            results.forEach(p => {
                if (p.active === false) return;
                let type = 'Duplex';
                if (p.tx > 0 && p.rx === 0) type = 'Simplex Base Tx';
                else if (p.tx === 0 && p.rx > 0) type = 'Simplex Walkie';
                pairs.push({
                    tx: p.tx,
                    rx: p.rx,
                    label: p.label,
                    groupName: p.groupName,
                    bw: 0.0125,
                    type
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
    }, [manualPairs, results, sortField, sortDirection]);

    const handleExport = (format: 'pdf' | 'csv' | 'xls' | 'doc' | 'txt') => {
        setIsExportMenuOpen(false);
        const data = tabulatedData;
        const filename = `talkback_rf_plan_${new Date().toISOString().slice(0, 10)}`;
        if (format === 'csv' || format === 'xls') {
            let content = "Base Tx (MHz),Portable Rx (MHz),Type,Group,Bandwidth (kHz)\n";
            data.forEach(c => content += `${c.tx > 0 ? c.tx.toFixed(5) : '—'},${c.rx > 0 ? c.rx.toFixed(5) : '—'},${c.type},"${c.groupName}",${(c.bw * 1000).toFixed(1)}\n`);
            const blob = new Blob([content], { type: format === 'xls' ? 'application/vnd.ms-excel' : 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `${filename}.${format}`; a.click();
        } else if (format === 'txt') {
            let content = "TALKBACK RF COORDINATION PLAN\n============================\n\n";
            data.forEach(c => content += `Tx: ${c.tx > 0 ? c.tx.toFixed(5) : '—'} MHz | Rx: ${c.rx > 0 ? c.rx.toFixed(5) : '—'} MHz | ${c.type} | ${c.groupName}\n`);
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `${filename}.txt`; a.click();
        } else if (format === 'doc') {
            let html = `<html><body><h1>Talkback RF Coordination Plan</h1><table border="1"><tr><th>Base Tx (MHz)</th><th>Portable Rx (MHz)</th><th>Type</th><th>Group</th></tr>${data.map(c => `<tr><td>${c.tx > 0 ? c.tx.toFixed(5) : '—'}</td><td>${c.rx > 0 ? c.rx.toFixed(5) : '—'}</td><td>${c.type}</td><td>${c.groupName}</td></tr>`).join('')}</table></body></html>`;
            const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `${filename}.doc`; a.click();
        } else if (format === 'pdf') {
            // @ts-ignore
            const { jsPDF } = window.jspdf; const doc = new jsPDF();
            doc.setFontSize(18); doc.text("Talkback RF Coordination Plan", 14, 20); doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
            const tableData = data.map(c => [c.tx > 0 ? c.tx.toFixed(5) : '—', c.rx > 0 ? c.rx.toFixed(5) : '—', c.type, c.groupName, (c.bw * 1000).toFixed(1) + 'k']);
            // @ts-ignore
            doc.autoTable({ startY: 35, head: [['Base Tx', 'Port Rx', 'Type', 'Group', 'BW']], body: tableData, theme: 'striped', headStyles: { fillColor: [30, 41, 59] } });
            doc.save(`${filename}.pdf`);
        }
    };

    const intermods = useMemo(() => {
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
        const centerFreq = (range.min + range.max) / 2;
        setRange({ min: parseFloat((centerFreq - newSpan / 2).toFixed(5)), max: parseFloat((centerFreq + newSpan / 2).toFixed(5)) });
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

    const SectionToggle: React.FC<{
        mode: 'standard' | 'custom';
        onChange: (mode: 'standard' | 'custom') => void;
    }> = ({ mode, onChange }) => (
        <div className="flex bg-slate-900 border border-slate-700 rounded-lg p-0.5 shadow-inner">
            <button 
                onClick={() => onChange('standard')}
                className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${mode === 'standard' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
            >
                Standard
            </button>
            <button 
                onClick={() => onChange('custom')}
                className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${mode === 'custom' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
            >
                Custom
            </button>
        </div>
    );

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

        for (const c of allActiveCarriers) { if (Math.abs(mouseFreq - c.value) < hitThreshold) return { text: `${c.label}: ${c.value.toFixed(5)} MHz`, subtext: `Group: ${c.groupName}`, color: c.type === 'tx' ? INTERMOD_CONFIG.tx.color : INTERMOD_CONFIG.rx.color }; }
        if (showTwoTone) { for (const im of intermods.twoTone) if (Math.abs(mouseFreq - im.value) < hitThreshold) return { text: `2-Tone IMD: ${im.value.toFixed(5)} MHz`, subtext: `Formula: 2*${im.sources[0].toFixed(3)} - ${im.sources[1].toFixed(3)}`, color: INTERMOD_CONFIG.twoTone.color }; }
        if (showThreeTone) { for (const im of intermods.threeTone) if (Math.abs(mouseFreq - im.value) < hitThreshold) return { text: `3-Tone IMD: ${im.value.toFixed(5)} MHz`, subtext: `Formula: ${im.sources[0].toFixed(3)} + ${im.sources[1].toFixed(3)} - ${im.sources[2].toFixed(3)}`, color: INTERMOD_CONFIG.threeTone.color }; }
        return null;
    }, [mouseCoord, range, allActiveCarriers, intermods, showTwoTone, showThreeTone, isDragging, mode, selectedCountry]);

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
            ctx.textAlign = 'center'; const freqRange = range.max - range.min; const numVert = Math.max(5, Math.min(10, Math.floor(chartWidth / 100)));
            for (let i = 0; i <= numVert; i++) { const f = range.min + (i * freqRange / numVert); const x = freqToX(f); ctx.beginPath(); ctx.moveTo(x, padding.top); ctx.lineTo(x, height - padding.bottom); ctx.stroke(); ctx.fillText(`${f.toFixed(1)}`, x, height - padding.bottom + 15); }
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
                if (label) { ctx.save(); ctx.translate(x, y - 8); ctx.rotate(-Math.PI / 4); ctx.font = 'bold 9px monospace'; ctx.textAlign = 'left'; ctx.fillText(label, 0, 0); ctx.restore(); }
            };
            if (showThreeTone) intermods.threeTone.forEach(f => drawSignal(f.value, INTERMOD_CONFIG.threeTone.amp, INTERMOD_CONFIG.threeTone.color, 0.0125));
            if (showTwoTone) intermods.twoTone.forEach(f => drawSignal(f.value, INTERMOD_CONFIG.twoTone.amp, INTERMOD_CONFIG.twoTone.color, 0.0125));
            allActiveCarriers.forEach(c => drawSignal(c.value, INTERMOD_CONFIG.tx.amp, c.type === 'tx' ? '#fbbf24' : '#38bdf8', c.bw, c.label.split(' ')[0] + (c.type === 'tx' ? 'T' : 'R')));
            ctx.save(); ctx.translate(15, height/2); ctx.rotate(-Math.PI/2); ctx.textAlign = 'center'; ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = INTERMOD_CONFIG.text; ctx.fillText('AMPLITUDE (dBm)', 0, 0); ctx.restore();
            ctx.font = 'bold 10px sans-serif'; ctx.fillText('FREQUENCY (MHz)', width/2, height - 5);
        };
        draw();
    }, [range, allActiveCarriers, intermods, showTwoTone, showThreeTone, results, manualPairs, mode, dimensions, selectedCountry]);

    const SortArrow = ({ field }: { field: string }) => {
        if (sortField !== field) return <span className="ml-1 text-slate-500">↕</span>;
        return <span className="ml-1 text-amber-400 font-black">{sortDirection === 'asc' ? '▲' : '▼'}</span>;
    };

    return (
        <div className="space-y-4 mx-auto">
            <EngagingLoadingState 
                isOpen={isCalculating} 
                progress={genProgress * 100} 
            />
            <CelebratorySuccessState 
                isOpen={showSuccess} 
                onClose={() => setShowSuccess(false)} 
                frequenciesFound={results?.length || 0}
                frequenciesRequired={pairCount + simplexTxCount + simplexWalkieCount}
                stats={[
                    { label: 'Talkback Pairs Coordinated', value: results?.length || 0 }
                ]}
            />
            <Card>
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <CardTitle className="!mb-0">1. Setup Base & Portable Bands</CardTitle>
                        {mode === 'custom' && (
                            <SectionToggle mode={duplexCustomMode} onChange={setDuplexCustomMode} />
                        )}
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

                {mode === 'custom' && duplexCustomMode === 'custom' ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <h4 className="text-[10px] font-black text-slate-500 uppercase mb-2">Base Transmit (Tx) Range</h4>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 bg-slate-900 border border-slate-700 rounded p-2">
                                    <label className="text-[8px] text-slate-500 uppercase font-bold block mb-1">Min (MHz)</label>
                                    <input type="number" value={customTxMin} onChange={e => setCustomTxMin(parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-white font-mono text-sm focus:outline-none font-bold" />
                                </div>
                                <span className="text-slate-500 font-bold">-</span>
                                <div className="flex-1 bg-slate-900 border border-slate-700 rounded p-2">
                                    <label className="text-[8px] text-slate-500 uppercase font-bold block mb-1">Max (MHz)</label>
                                    <input type="number" value={customTxMax} onChange={e => setCustomTxMax(parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-white font-mono text-sm focus:outline-none font-bold" />
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4 className="text-[10px] font-black text-slate-500 uppercase mb-2">Portable Receive (Rx) Range</h4>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 bg-slate-900 border border-slate-700 rounded p-2">
                                    <label className="text-[8px] text-slate-500 uppercase font-bold block mb-1">Min (MHz)</label>
                                    <input type="number" value={customRxMin} onChange={e => setCustomRxMin(parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-white font-mono text-sm focus:outline-none font-bold" />
                                </div>
                                <span className="text-slate-500 font-bold">-</span>
                                <div className="flex-1 bg-slate-900 border border-slate-700 rounded p-2">
                                    <label className="text-[8px] text-slate-500 uppercase font-bold block mb-1">Max (MHz)</label>
                                    <input type="number" value={customRxMax} onChange={e => setCustomRxMax(parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-white font-mono text-sm focus:outline-none font-bold" />
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4 className="text-[10px] font-black text-slate-500 uppercase mb-2">Settings</h4>
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between bg-slate-900 border border-slate-700 rounded p-2">
                                    <label className="text-[9px] text-slate-400 uppercase font-bold">Bandwidth</label>
                                    <select value={customBw} onChange={e => setCustomBw(parseFloat(e.target.value))} className="bg-slate-800 text-white font-mono text-xs rounded px-2 py-1 outline-none">
                                        <option value={0.0125}>12.5 kHz</option>
                                        <option value={0.025}>25 kHz</option>
                                        <option value={0.050}>50 kHz</option>
                                    </select>
                                </div>
                                <div className="flex items-center justify-between bg-slate-900 border border-slate-700 rounded p-2">
                                    <label className="text-[9px] text-slate-400 uppercase font-bold">Target Pairs</label>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setPairCount(Math.max(1, pairCount - 1))} className="text-indigo-400 hover:text-indigo-300 font-bold">-</button>
                                        <span className="text-white font-mono text-sm font-bold w-6 text-center">{pairCount}</span>
                                        <button onClick={() => setPairCount(pairCount + 1)} className="text-indigo-400 hover:text-indigo-300 font-bold">+</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <h4 className="text-[10px] font-black text-slate-500 uppercase mb-2">
                                Base Transmit (Tx) {mode === 'europe' ? '(High Band)' : '(Low Band)'}
                            </h4>
                            <div className="flex flex-wrap gap-1.5">
                                {baseBands.map(b => (
                                    <button key={b} onClick={() => handleBandChange(b, 'tx')} className={`px-2 py-1 text-xs border-2 rounded font-bold transition-all ${txBands.has(b) ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-white'}`}>{b}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-[10px] font-black text-slate-500 uppercase mb-2">
                                Portable Receive (Rx) {mode === 'europe' ? '(Low Band)' : '(High Band)'}
                            </h4>
                            <div className="flex flex-wrap gap-1.5">
                                {portBands.map(b => (
                                    <button key={b} onClick={() => handleBandChange(b, 'rx')} className={`px-2 py-1 text-xs border-2 rounded font-bold transition-all ${rxBands.has(b) ? 'bg-rose-600 border-rose-400 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-white'}`}>{b}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-[10px] font-black text-slate-500 uppercase mb-2">Quantities</h4>
                            <div className="flex flex-col gap-2">
                                <label className="text-[9px] text-slate-400 uppercase font-bold">Target Duplex Pairs</label>
                                <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded overflow-hidden">
                                    <button onClick={() => setPairCount(Math.max(1, pairCount - 1))} className="p-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg></button>
                                    <input type="number" value={pairCount} onChange={e => setPairCount(parseInt(e.target.value) || 0)} className="w-full bg-transparent p-2 text-white font-mono text-sm focus:outline-none text-center font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                    <button onClick={() => setPairCount(pairCount + 1)} className="p-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg></button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </Card>
            <Card>
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <CardTitle className="!mb-0">1b. Setup Simplex Frequencies</CardTitle>
                        {mode === 'custom' && (
                            <SectionToggle mode={simplexCustomMode} onChange={setSimplexCustomMode} />
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    {mode === 'custom' && simplexCustomMode === 'custom' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="text-[10px] font-black text-slate-500 uppercase mb-2">Simplex Base Tx Range</h4>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-slate-900 border border-slate-700 rounded p-2">
                                        <label className="text-[8px] text-slate-500 uppercase font-bold block mb-1">Min (MHz)</label>
                                        <input type="number" value={simplexTxMin} onChange={e => setSimplexTxMin(parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-white font-mono text-sm focus:outline-none font-bold" />
                                    </div>
                                    <span className="text-slate-500 font-bold">-</span>
                                    <div className="flex-1 bg-slate-900 border border-slate-700 rounded p-2">
                                        <label className="text-[8px] text-slate-500 uppercase font-bold block mb-1">Max (MHz)</label>
                                        <input type="number" value={simplexTxMax} onChange={e => setSimplexTxMax(parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-white font-mono text-sm focus:outline-none font-bold" />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black text-slate-500 uppercase mb-2">Simplex Set-to-Set (Walkie) Range</h4>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-slate-900 border border-slate-700 rounded p-2">
                                        <label className="text-[8px] text-slate-500 uppercase font-bold block mb-1">Min (MHz)</label>
                                        <input type="number" value={simplexWalkieMin} onChange={e => setSimplexWalkieMin(parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-white font-mono text-sm focus:outline-none font-bold" />
                                    </div>
                                    <span className="text-slate-500 font-bold">-</span>
                                    <div className="flex-1 bg-slate-900 border border-slate-700 rounded p-2">
                                        <label className="text-[8px] text-slate-500 uppercase font-bold block mb-1">Max (MHz)</label>
                                        <input type="number" value={simplexWalkieMax} onChange={e => setSimplexWalkieMax(parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-white font-mono text-sm focus:outline-none font-bold" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <h4 className="text-[10px] font-black text-slate-500 uppercase mb-2">Simplex Presets</h4>
                                <div className="flex flex-col gap-2">
                                    <button onClick={() => { setSimplexTxBands(new Set([446])); setSimplexWalkieBands(new Set([467])); }} className="px-3 py-2 text-xs bg-slate-800 hover:bg-slate-700 text-white rounded font-bold">PMR446 / FRS</button>
                                    <button onClick={() => { setSimplexTxBands(new Set([457, 455])); setSimplexWalkieBands(new Set([467, 468])); }} className="px-3 py-2 text-xs bg-slate-800 hover:bg-slate-700 text-white rounded font-bold">Standard Talkback</button>
                                </div>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black text-slate-500 uppercase mb-2">Simplex Base Tx Frequencies</h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {[457, 455, 446, 447, 450, 451, 452].map(b => (
                                        <button key={b} onClick={() => handleSimplexBandChange(b, 'tx')} className={`px-2 py-1 text-xs border-2 rounded font-bold transition-all ${simplexTxBands.has(b) ? 'bg-amber-600 border-amber-400 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-white'}`}>{b}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black text-slate-500 uppercase mb-2">Simplex Set-to-Set (Walkie-Talkie)</h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {[467, 468, 469].map(b => (
                                        <button key={b} onClick={() => handleSimplexBandChange(b, 'walkie')} className={`px-2 py-1 text-xs border-2 rounded font-bold transition-all ${simplexWalkieBands.has(b) ? 'bg-purple-600 border-purple-400 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-white'}`}>{b}</button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="border-t border-slate-800 pt-4">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase mb-3">Quantities & Settings</h4>
                        <div className="flex flex-wrap items-center gap-x-8 gap-y-4 bg-slate-900/30 p-4 rounded-xl border border-white/5">
                            <div className="flex items-center gap-3">
                                <label className="text-[9px] text-slate-400 uppercase font-bold whitespace-nowrap">Target Base Tx</label>
                                <div className="flex items-center bg-slate-950 border border-slate-700 rounded overflow-hidden h-9">
                                    <button onClick={() => setSimplexTxCount(Math.max(0, simplexTxCount - 1))} className="px-2 h-full bg-slate-800 hover:bg-slate-700 text-indigo-400 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg></button>
                                    <input type="number" value={simplexTxCount} onChange={e => setSimplexTxCount(parseInt(e.target.value) || 0)} className="w-12 bg-transparent h-full text-white font-mono text-sm focus:outline-none text-center font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                    <button onClick={() => setSimplexTxCount(simplexTxCount + 1)} className="px-2 h-full bg-slate-800 hover:bg-slate-700 text-indigo-400 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg></button>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="text-[9px] text-slate-400 uppercase font-bold whitespace-nowrap">Target Walkie</label>
                                <div className="flex items-center bg-slate-950 border border-slate-700 rounded overflow-hidden h-9">
                                    <button onClick={() => setSimplexWalkieCount(Math.max(0, simplexWalkieCount - 1))} className="px-2 h-full bg-slate-800 hover:bg-slate-700 text-indigo-400 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg></button>
                                    <input type="number" value={simplexWalkieCount} onChange={e => setSimplexWalkieCount(parseInt(e.target.value) || 0)} className="w-12 bg-transparent h-full text-white font-mono text-sm focus:outline-none text-center font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                    <button onClick={() => setSimplexWalkieCount(simplexWalkieCount + 1)} className="px-2 h-full bg-slate-800 hover:bg-slate-700 text-indigo-400 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg></button>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="text-[9px] text-slate-400 uppercase font-bold whitespace-nowrap">Tx BW (MHz)</label>
                                <input type="number" step="0.001" value={simplexTxBw} onChange={e => setSimplexTxBw(parseFloat(e.target.value) || 0.0125)} className="w-20 bg-slate-950 border border-slate-700 rounded px-2 h-9 text-white font-mono text-xs outline-none focus:border-indigo-500" />
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="text-[9px] text-slate-400 uppercase font-bold whitespace-nowrap">Walkie BW (MHz)</label>
                                <input type="number" step="0.001" value={simplexWalkieBw} onChange={e => setSimplexWalkieBw(parseFloat(e.target.value) || 0.0125)} className="w-20 bg-slate-950 border border-slate-700 rounded px-2 h-9 text-white font-mono text-xs outline-none focus:border-indigo-500" />
                            </div>
                            <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                                <label className="text-[9px] text-slate-400 uppercase font-bold whitespace-nowrap">Priority</label>
                                <select value={generationPriority.join(',')} onChange={e => setGenerationPriority(e.target.value.split(',') as any)} className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 h-9 text-white text-xs outline-none focus:border-indigo-500">
                                    <option value="duplex,simplexTx,simplexWalkie">Duplex {'>'} Tx {'>'} Walkie</option>
                                    <option value="simplexTx,duplex,simplexWalkie">Tx {'>'} Duplex {'>'} Walkie</option>
                                    <option value="simplexWalkie,duplex,simplexTx">Walkie {'>'} Duplex {'>'} Tx</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>
            <Card>
                <CardTitle>2. Fixed Site Plan</CardTitle>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {manualPairs.map((p: DuplexPairWithBw) => {
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
                                    <div className="flex items-center gap-1.5 bg-slate-800 rounded px-2 h-8 w-[150px]">
                                        <button 
                                            onClick={() => updateManualPair(p.id, 'txIsBase', !(p.txIsBase ?? (mode === 'europe' ? p.tx > 464 : p.tx < 464)))}
                                            className={`text-[7px] font-black flex-shrink-0 px-1 py-0.5 rounded border transition-colors w-8 ${
                                                (p.txIsBase ?? (mode === 'europe' ? p.tx > 464 : p.tx < 464))
                                                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                                    : 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                                            }`}
                                            title="Toggle Base (Constant TX) vs SW (Intermittent)"
                                        >
                                            {(p.txIsBase ?? (mode === 'europe' ? p.tx > 464 : p.tx < 464)) ? 'BASE' : 'SW'}
                                        </button>
                                        <ManualFreqInput value={p.tx} onChange={(val) => updateManualPair(p.id, 'tx', val)} className="w-full bg-transparent text-[11px] text-white font-mono outline-none font-bold" />
                                        <div className="flex flex-col -gap-1">
                                            <button onClick={() => handleFrequencyStep(p.id, 'tx', 'up')} className="text-slate-500 hover:text-white text-[8px] leading-none">▲</button>
                                            <button onClick={() => handleFrequencyStep(p.id, 'tx', 'down')} className="text-slate-500 hover:text-white text-[8px] leading-none">▼</button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-3 flex-1">
                                    {/* Port Rx */}
                                    <div className="flex items-center gap-1.5 bg-slate-800 rounded px-2 h-8 w-[150px]">
                                        <button 
                                            onClick={() => updateManualPair(p.id, 'rxIsBase', !(p.rxIsBase ?? (mode === 'europe' ? p.rx > 464 : p.rx < 464)))}
                                            className={`text-[7px] font-black flex-shrink-0 px-1 py-0.5 rounded border transition-colors w-8 ${
                                                (p.rxIsBase ?? (mode === 'europe' ? p.rx > 464 : p.rx < 464))
                                                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                                    : 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                                            }`}
                                            title="Toggle Base (Constant TX) vs SW (Intermittent)"
                                        >
                                            {(p.rxIsBase ?? (mode === 'europe' ? p.rx > 464 : p.rx < 464)) ? 'BASE' : 'SW'}
                                        </button>
                                        <ManualFreqInput value={p.rx} onChange={(val) => updateManualPair(p.id, 'rx', val)} className="w-full bg-transparent text-[11px] text-white font-mono outline-none font-bold" />
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
                                                setManualPairs(pairs => pairs.map(mp => mp.id === p.id ? { ...mp, txBw: val, rxBw: val } : mp)); 
                                            }} 
                                            className="bg-transparent text-[10px] text-indigo-300 outline-none font-bold cursor-pointer"
                                        >
                                            <option value={0.0125}>12.5k</option>
                                            <option value={0.025}>25k</option>
                                            <option value={0.050}>50k</option>
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
                <div className="mt-4 flex flex-wrap gap-2 items-center border-t border-white/5 pt-4">
                    <button onClick={addManualPair} className={`${greenButton} flex-grow border-dashed`}>+ Add Single Manual Pair</button>
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg p-1">
                        <span className="text-[10px] text-slate-500 font-black uppercase px-2">Batch:</span>
                        <input type="number" min="1" max="50" value={bulkAddCount} onChange={e => setBulkAddCount(parseInt(e.target.value) || 1)} className="bg-slate-800 border border-slate-700 rounded w-12 p-1 text-center font-mono text-xs text-white" />
                        <button onClick={handleBulkAddManualPairs} className={`${primaryButton} !px-4 !py-1.5 !text-[10px]`}>Add Batch</button>
                    </div>
                </div>
            </Card>

            <div className="space-y-4">
                <div className="flex gap-4">
                    <button onClick={handleGenerate} disabled={isCalculating} className={`${primaryButton} w-full py-4 text-lg shadow-2xl uppercase tracking-widest`}>{isCalculating ? `COORDINATING SITE...` : 'CALCULATE SITE PLAN'}</button>
                    {isCalculating && (
                        <button onClick={() => abortControllerRef.current?.abort()} className={`${secondaryButton} !bg-red-600 hover:!bg-red-500 border-red-800 text-white px-8 py-4 text-lg uppercase tracking-widest`}>ABORT</button>
                    )}
                    <button onClick={() => setShowTable(!showTable)} className={`${secondaryButton} !w-auto flex items-center gap-2 px-6`}><span>📊</span> {showTable ? 'HIDE LEDGER' : 'TABULATE PLAN'}</button>
                    <div className="relative">
                        <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className={`${actionButton} h-full px-6 flex items-center gap-2`}><span>📥</span> EXPORT</button>
                        {isExportMenuOpen && (
                            <div className="absolute bottom-full right-0 mb-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-[110] overflow-hidden min-w-[220px] animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700 border-b border-white/5 transition-colors">PDF Report</button>
                                <button onClick={() => handleExport('xls')} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700 border-b border-white/5 transition-colors">Excel (.XLS)</button>
                                <button onClick={() => handleExport('doc')} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700 border-b border-white/5 transition-colors">Word (.DOC)</button>
                                <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700 border-b border-white/5 transition-colors">CSV Data</button>
                                <button onClick={() => handleExport('txt')} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors">Text (.TXT)</button>
                            </div>
                        )}
                    </div>
                </div>
                {(isCalculating || results) && (
                    <div className="bg-slate-800/80 border border-blue-500/20 rounded-lg p-3">
                        <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                                {isCalculating ? 'Searching Optimization Space...' : 'Spectral Yield Breakdown'}
                            </span>
                            <span className="text-xs font-bold text-white font-mono">
                                {isCalculating ? `${Math.round(genProgress * 100)}%` : (
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
                                style={{ width: `${Math.min(100, (isCalculating ? genProgress : (totalYield / totalTarget)) * 100)}%` }} 
                            />
                        </div>
                    </div>
                )}
            </div>

            {showTable && tabulatedData.length > 0 && (
                <Card className="!bg-slate-950 border-cyan-500/30 animate-in fade-in slide-in-from-top-2 duration-300">
                    <CardTitle className="!text-sm uppercase tracking-[0.2em] text-cyan-400">Numerical Spectral Allocation Ledger</CardTitle>
                    <div className="overflow-y-auto max-h-[400px] rounded-xl border border-white/10 custom-scrollbar shadow-inner">
                        <table className="w-full text-left border-collapse text-[11px]">
                            <thead className="bg-slate-900 sticky top-0 z-10"><tr className="uppercase font-black text-slate-500 border-b border-white/10"><th className="p-3 cursor-pointer select-none" onClick={() => handleSort('tx')}>Base Tx (MHz) <SortArrow field="tx" /></th><th className="p-3 cursor-pointer select-none" onClick={() => handleSort('rx')}>Portable Rx (MHz) <SortArrow field="rx" /></th><th className="p-3 cursor-pointer select-none" onClick={() => handleSort('type')}>Type <SortArrow field="type" /></th><th className="p-3 cursor-pointer select-none" onClick={() => handleSort('groupName')}>Source Group <SortArrow field="groupName" /></th><th className="p-3 cursor-pointer select-none" onClick={() => handleSort('bw')}>Bandwidth <SortArrow field="bw" /></th></tr></thead>
                            <tbody className="divide-y divide-white/5">{tabulatedData.map((row, i) => (<tr key={i} className="hover:bg-cyan-500/5 transition-colors group"><td className="p-3 font-mono text-cyan-400 font-black text-sm">{row.tx > 0 ? row.tx.toFixed(5) : '—'}</td><td className="p-3 font-mono text-blue-400 font-black text-sm">{row.rx > 0 ? row.rx.toFixed(5) : '—'}</td><td className="p-3"><span className="px-2 py-0.5 rounded uppercase text-[8px] font-black border bg-slate-800 border-slate-700 text-slate-300">{row.type}</span></td><td className="p-3"><span className="text-indigo-300 font-black uppercase tracking-tighter">{row.groupName}</span></td><td className="p-3 font-mono text-slate-500">{(row.bw * 1000).toFixed(1)} kHz</td></tr>))}</tbody>
                        </table>
                    </div>
                </Card>
            )}

            <Card>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        <CardTitle className="!mb-0">3. Intermod Physics Auditor</CardTitle>
                        <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl p-1 shadow-inner ml-2">
                            <span className="text-[10px] text-slate-500 font-black uppercase px-2">Country:</span>
                            <select 
                                value={selectedCountry} 
                                onChange={e => setSelectedCountry(e.target.value as any)}
                                className="bg-slate-800 text-white text-[10px] font-black uppercase rounded-lg px-3 py-1.5 outline-none border border-slate-700"
                            >
                                <option value="UK">UK</option>
                                <option value="USA">USA</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        {results && results.length > 0 && (
                            <button 
                                onClick={handleLockAllResults} 
                                className={`text-[10px] font-black tracking-widest px-2 py-1 rounded border-2 transition-all flex items-center gap-1.5 ${allResultsLocked ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/40' : 'bg-slate-700 text-slate-400 border-slate-600 hover:border-slate-500'}`}
                                title={allResultsLocked ? "Unlock All" : "Lock All"}
                            >
                                <span>{allResultsLocked ? '🔒' : '🔓'}</span>
                                {allResultsLocked ? 'UNLOCK ALL' : 'LOCK ALL'}
                            </button>
                        )}
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
                    <div className="flex flex-wrap items-center gap-4 bg-slate-900/80 p-2 rounded-xl border border-slate-700">
                        <div className="flex gap-4 pr-4 border-r border-slate-700/50"><label className="flex items-center gap-2 cursor-pointer group"><input type="checkbox" checked={showTwoTone} onChange={e => setShowTwoTone(e.target.checked)} className="w-4 h-4 rounded accent-red-500 bg-slate-700" /><span className="text-[10px] text-slate-400 font-bold uppercase group-hover:text-white transition-colors">2-Tone</span></label><label className="flex items-center gap-2 cursor-pointer group"><input type="checkbox" checked={showThreeTone} onChange={e => setShowThreeTone(e.target.checked)} className="w-4 h-4 rounded accent-purple-500 bg-slate-700" /><span className="text-[10px] text-slate-400 font-bold uppercase group-hover:text-white transition-colors">3-Tone</span></label></div>
                        <div className="flex items-center gap-2 pr-4 border-r border-slate-700/50"><span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Center</span><div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 shadow-inner"><button onClick={() => handleScroll('left')} className="p-1.5 px-2.5 rounded bg-slate-700/50 text-slate-300 hover:bg-slate-600 transition-colors text-xs font-bold">&larr;</button><input type="text" value={centerFreqInput} onChange={e => setCenterFreqInput(e.target.value)} onBlur={e => applyCenterFreq(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyCenterFreq(e.currentTarget.value)} className="w-20 bg-transparent text-white font-mono text-[10px] text-center font-bold outline-none focus:text-cyan-400" placeholder="0.0000" /><button onClick={() => handleScroll('right')} className="p-1.5 px-2.5 rounded bg-slate-700/50 text-slate-300 hover:bg-slate-600 transition-colors text-xs font-bold">&rarr;</button></div><div className="flex items-center gap-1.5 bg-slate-800/50 px-2 py-1.5 rounded-lg border border-slate-700/50"><span className="text-[8px] text-slate-500 font-black uppercase">Step</span><button onClick={() => handleCenterStepSizeChange('down')} className="text-slate-400 hover:text-white transition-colors">▼</button><span className="text-[10px] font-mono text-indigo-300 w-8 text-center font-bold">{centerStepMhz}</span><button onClick={() => handleCenterStepSizeChange('up')} className="text-slate-400 hover:text-white transition-colors">▲</button></div></div>
                        <div className="flex items-center gap-2"><span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Span</span><div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 shadow-inner"><button onClick={() => handleSpanChange('decrease')} className="px-2 py-1 text-white rounded text-[10px] font-black hover:bg-slate-600 transition-colors">-</button><span className="text-[10px] text-cyan-400 font-mono w-16 text-center font-black">{(range.max - range.min).toFixed(1)}M</span><button onClick={() => handleSpanChange('increase')} className="px-2 py-1 text-white rounded text-[10px] font-black hover:bg-slate-600 transition-colors">+</button></div><div className="flex items-center gap-1.5 bg-slate-800/50 px-2 py-1.5 rounded-lg border border-slate-700/50"><span className="text-[8px] text-slate-500 font-black uppercase">Step</span><button onClick={() => handleSpanStepSizeChange('down')} className="text-slate-400 hover:text-white transition-colors">▼</button><span className="text-[10px] font-mono text-indigo-300 w-8 text-center font-bold">{spanIncrementMhz}</span><button onClick={() => handleSpanStepSizeChange('up')} className="text-slate-400 hover:text-white transition-colors">▲</button></div></div>
                    </div>
                </div>
                {hasAnalyzed && (
                    <div className="mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className={`p-4 rounded-xl border-2 ${diagnosticConflicts.length === 0 ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-red-500/10 border-red-500/40'}`}>
                            <div className="flex justify-between items-center mb-3"><h5 className={`text-xs font-black uppercase tracking-widest ${diagnosticConflicts.length === 0 ? 'text-emerald-400' : 'text-red-400'}`}>{diagnosticConflicts.length === 0 ? '✓ Spectrum Compatibility Confirmed' : `⚠️ ${diagnosticConflicts.length} Interaction Clashes Detected`}</h5><button onClick={() => setHasAnalyzed(false)} className="text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest">&times; Dismiss Audit</button></div>
                            {diagnosticConflicts.length === 0 ? (<p className="text-[11px] text-emerald-200/70 italic">Current spectral configuration satisfies all fundamental (18.75kHz) and 3rd-order (12.5kHz) guard criteria for talkback operations.</p>) : (
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">{diagnosticConflicts.map((c, i) => (<div key={i} className="bg-black/30 p-2 rounded-lg border border-white/5 text-[10px] flex flex-col gap-1"><div className="flex justify-between font-black"><span className="text-red-400 uppercase">{c.type} Interaction</span><span className="text-slate-500 font-mono">Error: {(c.diff * 1000).toFixed(1)} kHz</span></div><p className="text-slate-300 leading-tight"><span className="text-cyan-400 font-bold">{c.targetFreq.id}</span> ({c.targetFreq.value.toFixed(5)}) {c.type.includes('Fundamental') ? ` too close to carrier ${c.sourceFreqs[0].id} (${c.sourceFreqs[0].value.toFixed(5)})` : ` hit by products of ${c.sourceFreqs.map(f => `${f.id}(${f.value.toFixed(5)})`).join(' and ')}`}</p></div>))}</div>
                            )}
                        </div>
                    </div>
                )}
                <div className="relative group"><canvas ref={canvasRef} className={`w-full h-[250px] md:h-[350px] bg-slate-950 rounded-xl border border-blue-500/20 shadow-inner ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onPointerLeave={handlePointerUp} onWheel={handleWheel} />{activeHit && mouseCoord && !isDragging && (<div className="fixed z-[100] p-2.5 bg-slate-900/95 border border-white/20 rounded-lg shadow-2xl pointer-events-none backdrop-blur-md transform -translate-x-1/2 -translate-y-full" style={{ left: mouseCoord.clientX, top: mouseCoord.clientY - 6 }}><div className="flex flex-col gap-0.5"><div className="text-[11px] font-black uppercase tracking-tight" style={{ color: activeHit.color }}>{activeHit.text}</div><div className="text-[10px] text-slate-400 font-mono italic">{activeHit.subtext}</div></div><div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 border-r border-b border-white/20 transform rotate-45" /></div>)}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">{results?.map(p => { const active = p.active !== false; return (<div key={p.id} className={`p-3 bg-slate-800/80 border transition-all rounded-xl flex justify-between items-center group ${active ? 'border-white/5 hover:border-blue-500/30' : 'border-slate-800 opacity-60 grayscale-[0.5]'}`}><div className="flex items-center gap-3 flex-1 overflow-hidden"><div className="flex flex-col items-center gap-1 flex-shrink-0"><button onClick={() => handleResultActiveToggle(p.id)} className={`w-8 h-4 rounded-full relative transition-colors ${active ? 'bg-emerald-500' : 'bg-slate-700'}`}><div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${active ? 'left-0.5' : 'left-4.5'}`} /></button><span className={`text-[8px] font-black uppercase ${active ? 'text-emerald-400' : 'text-slate-500'}`}>{active ? 'ON' : 'OFF'}</span></div><div className="font-mono text-[11px] space-y-1 flex-1 min-w-0"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 flex-1 min-w-0"><button onClick={() => handleToggleBase(p.id, 'txIsBase')} className={`text-[8px] font-black flex-shrink-0 px-1 py-0.5 rounded border transition-colors ${(p.txIsBase ?? (mode === 'europe' ? p.tx > 464 : p.tx < 464)) ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-blue-500/20 border-blue-500/40 text-blue-400'}`} title="Toggle Base (Constant TX) vs SW (Intermittent)">{(p.txIsBase ?? (mode === 'europe' ? p.tx > 464 : p.tx < 464)) ? 'BASE' : 'SW'}</button><ManualFreqInput value={p.tx} onChange={(v) => handleResultChange(p.id, 'tx', v)} className="w-full bg-transparent p-0 text-white font-bold outline-none border-none text-[10px]" /></div><div className="flex gap-1 flex-shrink-0 transition-opacity"><button onClick={() => handleFrequencyStep(p.id, 'tx', 'down')} className="text-[9px] bg-slate-700 text-white rounded px-1 hover:bg-blue-600 font-bold">-</button><button onClick={() => handleFrequencyStep(p.id, 'tx', 'up')} className="text-[9px] bg-slate-700 text-white rounded px-1 hover:bg-blue-600 font-bold">+</button></div></div><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 flex-1 min-w-0"><button onClick={() => handleToggleBase(p.id, 'rxIsBase')} className={`text-[8px] font-black flex-shrink-0 px-1 py-0.5 rounded border transition-colors ${(p.rxIsBase ?? (mode === 'europe' ? p.rx > 464 : p.rx < 464)) ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-blue-500/20 border-blue-500/40 text-blue-400'}`} title="Toggle Base (Constant TX) vs SW (Intermittent)">{(p.rxIsBase ?? (mode === 'europe' ? p.rx > 464 : p.rx < 464)) ? 'BASE' : 'SW'}</button><ManualFreqInput value={p.rx} onChange={(v) => handleResultChange(p.id, 'rx', v)} className="w-full bg-transparent p-0 text-white font-bold outline-none border-none text-[11px]" /></div><div className="flex gap-1 flex-shrink-0 transition-opacity"><button onClick={() => handleFrequencyStep(p.id, 'rx', 'down')} className="text-[9px] bg-slate-700 text-white rounded px-1 hover:bg-blue-600 font-bold">-</button><button onClick={() => handleFrequencyStep(p.id, 'rx', 'up')} className="text-[9px] bg-slate-700 text-white rounded px-1 hover:bg-blue-600 font-bold">+</button></div></div></div></div><div className="flex items-center gap-2 ml-2 border-l border-white/10 pl-2 flex-shrink-0"><button onClick={() => handleResultLockToggle(p.id)} className={`p-1.5 rounded transition-all ${p.locked ? 'text-amber-500 bg-amber-500/10' : 'text-slate-600 hover:text-slate-300'}`} title={p.locked ? "Unlock" : "Lock"}><span className="text-sm">{p.locked ? '🔒' : '🔓'}</span></button><button onClick={() => handleRemoveResult(p.id)} className="text-red-400 hover:text-red-300 p-1 font-bold text-xl leading-none" title="Remove pair">&times;</button></div></div>);})}</div>
            </Card>
        </div>
    );
};

export default React.memo(TalkbackTab);
