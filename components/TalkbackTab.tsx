
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Card, { CardTitle, Placeholder } from './Card';
import { DuplexPair, TalkbackIntermods, IntermodProduct, TalkbackSolution, Conflict, Frequency, Thresholds, TxType, TalkbackMode } from '../types';
import { calculateTalkbackIntermods, checkTalkbackCompatibility } from '../services/rfService';
import { DISCRETE_TALKBACK_PAIRS, TALKBACK_DEFINITIONS, TALKBACK_FIXED_PAIRS, TALKBACK_FORBIDDEN_RANGES } from '../constants';

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
    const [pairCount, setPairCount] = useState<number>(8);
    const [isCalculating, setIsCalculating] = useState(false);
    const [genProgress, setGenProgress] = useState(0);
    const [showTable, setShowTable] = useState(false);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [sortField, setSortField] = useState<string>('value');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [bulkAddCount, setBulkAddCount] = useState(4);
    
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

    const baseBands = mode === 'standard' ? STANDARD_BASE_BANDS : EUROPE_BASE_BANDS;
    const portBands = mode === 'standard' ? STANDARD_PORT_BANDS : EUROPE_PORT_BANDS;

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
                const numVal = (field === 'label' || field === 'id' || field === 'groupName' || field === 'locked' || field === 'active') 
                    ? value 
                    : (parseFloat(value) || 0);
                return { ...pair, [field]: numVal };
            }
            return pair;
        }));
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
            return TALKBACK_FORBIDDEN_RANGES.some(range => f >= (range.min - 0.000005) && f <= (range.max + 0.000005));
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
            if (isForbidden(cand.tx) || isForbidden(cand.rx)) return false;
            const currentTx = [...activeTxManual, ...plan.map(p => p.tx)];
            const currentVictims = [...fixedVictims, ...plan.flatMap(p => [p.tx, p.rx])];
            for (const v of currentVictims) {
                if (Math.abs(cand.tx - v) < SPACING_FF) return false;
                if (Math.abs(cand.rx - v) < SPACING_FF) return false;
            }
            if (Math.abs(cand.tx - cand.rx) < SPACING_FF) return false;
            const nextTxPool = [...currentTx, cand.tx];
            const products2T: number[] = [];
            const products3T: number[] = [];
            for (let i = 0; i < nextTxPool.length; i++) {
                const f1 = nextTxPool[i];
                for (let j = 0; j < nextTxPool.length; j++) {
                    if (i === j) continue;
                    const f2 = nextTxPool[j];
                    products2T.push(2 * f1 - f2);
                    for (let k = 0; k < nextTxPool.length; k++) {
                        if (k === i || k === j) continue;
                        const f3 = nextTxPool[k];
                        products3T.push(f1 + f2 - f3);
                    }
                }
            }
            const allVictims = [...currentVictims, cand.tx, cand.rx];
            for (const v of allVictims) {
                for (const p of products2T) if (Math.abs(v - p) < SPACING_IMD) return false;
                for (const p of products3T) if (Math.abs(v - p) < SPACING_IMD) return false;
            }
            return true;
        };

        const selectedTxBands: number[] = Array.from(txBands);
        const selectedRxBands: number[] = Array.from(rxBands);
        const txFreqPool: number[] = [];
        selectedTxBands.forEach(txB => {
            const partnerRxB = TALKBACK_FIXED_PAIRS[txB];
            if (partnerRxB && selectedRxBands.includes(partnerRxB)) {
                // Skip adding to txFreqPool, we will use discrete pairs
            } else {
                const def = TALKBACK_DEFINITIONS[txB];
                if (def) for (let f = def.min; f <= def.max + 0.000001; f += 0.0125) txFreqPool.push(parseFloat(f.toFixed(5)));
            }
        });
        const rxFreqPool: number[] = [];
        selectedRxBands.forEach(rxB => {
            const isPartner = selectedTxBands.some(txB => TALKBACK_FIXED_PAIRS[txB] === rxB);
            if (isPartner) {
                // Skip adding to rxFreqPool
            } else {
                const def = TALKBACK_DEFINITIONS[rxB];
                if (def) for (let f = def.min; f <= def.max + 0.000001; f += 0.0125) rxFreqPool.push(parseFloat(f.toFixed(5)));
            }
        });
        let fullPool: {tx: number, rx: number}[] = [];
        selectedTxBands.forEach(txB => {
            const partnerRxB = TALKBACK_FIXED_PAIRS[txB];
            if (partnerRxB && selectedRxBands.includes(partnerRxB)) {
                const discrete = DISCRETE_TALKBACK_PAIRS[txB];
                if (discrete) fullPool.push(...discrete);
            }
        });
        const sTx = txFreqPool.slice().sort(() => Math.random() - 0.5);
        const sRx = rxFreqPool.slice().sort(() => Math.random() - 0.5);
        if (sTx.length > 0 && sRx.length > 0) {
            for (let i = 0; i < Math.min(sTx.length, 3000); i++) fullPool.push({ tx: sTx[i], rx: sRx[i % sRx.length] });
        }
        if (fullPool.length === 0) { setIsCalculating(false); return; }
        let bestSolution: DuplexPair[] = [];
        const targetRemaining = Math.max(0, pairCount - lockedResults.length);
        for (let i = 0; i < 5000; i++) {
            const current: DuplexPair[] = [];
            const items = [...fullPool].sort(() => Math.random() - 0.5);
            for (const cand of items) {
                if (current.length >= targetRemaining) break;
                if (checkPairComp(cand, current)) {
                    current.push({ id: `G-${i}-${current.length}-${Date.now()}`, label: `CH ${current.length + 1 + lockedResults.length}`, tx: cand.tx, rx: cand.rx, groupName: 'Generated', locked: false, active: true });
                }
            }
            if (current.length > bestSolution.length) { bestSolution = current; if (bestSolution.length >= targetRemaining) break; }
            if (i % 500 === 0) setGenProgress(i / 5000);
        }
        setResults([...lockedResults, ...bestSolution]);
        setGenProgress(1);
        setIsCalculating(false);
    };

    const allActiveCarriers = useMemo(() => {
        const carriers: { value: number; label: string; type: 'tx' | 'rx'; groupName: string; bw: number }[] = [];
        manualPairs.forEach((p: DuplexPairWithBw) => {
            if (p.active === false) return;
            if (p.tx > 0) carriers.push({ value: p.tx, label: `${p.label} (Base TX)`, type: 'tx', groupName: p.groupName, bw: p.txBw || 0.0125 });
            if (p.rx > 0) carriers.push({ value: p.rx, label: `${p.label} (Port RX)`, type: 'rx', groupName: p.groupName, bw: p.rxBw || 0.0125 });
        });
        if (results) {
            results.forEach((p) => {
                if (p.active === false) return;
                if (p.tx > 0) carriers.push({ value: p.tx, label: `${p.label} (Base TX)`, type: 'tx', groupName: p.groupName, bw: 0.0125 });
                if (p.rx > 0) carriers.push({ value: p.rx, label: `${p.label} (Port RX)`, type: 'rx', groupName: p.groupName, bw: 0.0125 });
            });
        }
        return carriers;
    }, [results, manualPairs]);

    const handleRunAudit = () => {
        const freqList: Frequency[] = allActiveCarriers.map((c) => ({
            id: c.label,
            value: c.value,
            type: 'comms' as TxType,
            zoneIndex: 0
        }));
        const dummyDist = [[0]];
        const dummyMatrix = [[false]];
        const result = checkTalkbackCompatibility(freqList, dummyDist, dummyMatrix, mode);
        setDiagnosticConflicts(result.conflicts);
        setHasAnalyzed(true);
    };

    const handleSort = (field: string) => {
        if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDirection('asc'); }
    };

    const tabulatedData = useMemo(() => {
        return [...allActiveCarriers].sort((a: any, b: any) => {
            let valA = a[sortField]; let valB = b[sortField];
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [allActiveCarriers, sortField, sortDirection]);

    const handleExport = (format: 'pdf' | 'csv' | 'xls' | 'doc' | 'txt') => {
        setIsExportMenuOpen(false);
        const data = tabulatedData;
        const filename = `talkback_rf_plan_${new Date().toISOString().slice(0, 10)}`;
        if (format === 'csv' || format === 'xls') {
            let content = "Frequency (MHz),Label,Type,Group,Bandwidth (kHz)\n";
            data.forEach(c => content += `${c.value.toFixed(5)},"${c.label}",${c.type.toUpperCase()},"${c.groupName}",${(c.bw * 1000).toFixed(1)}\n`);
            const blob = new Blob([content], { type: format === 'xls' ? 'application/vnd.ms-excel' : 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `${filename}.${format}`; a.click();
        } else if (format === 'txt') {
            let content = "TALKBACK RF COORDINATION PLAN\n============================\n\n";
            data.forEach(c => content += `${c.value.toFixed(5)} MHz | ${c.label} | ${c.type.toUpperCase()} | ${c.groupName}\n`);
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `${filename}.txt`; a.click();
        } else if (format === 'doc') {
            let html = `<html><body><h1>Talkback RF Coordination Plan</h1><table border="1"><tr><th>Frequency (MHz)</th><th>Label</th><th>Type</th><th>Group</th></tr>${data.map(c => `<tr><td>${c.value.toFixed(5)}</td><td>${c.label}</td><td>${c.type.toUpperCase()}</td><td>${c.groupName}</td></tr>`).join('')}</table></body></html>`;
            const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `${filename}.doc`; a.click();
        } else if (format === 'pdf') {
            // @ts-ignore
            const { jsPDF } = window.jspdf; const doc = new jsPDF();
            doc.setFontSize(18); doc.text("Talkback RF Coordination Plan", 14, 20); doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
            const tableData = data.map(c => [c.value.toFixed(5), c.label, c.type.toUpperCase(), c.groupName, (c.bw * 1000).toFixed(1) + 'k']);
            // @ts-ignore
            doc.autoTable({ startY: 35, head: [['Frequency', 'Label', 'Type', 'Group', 'BW']], body: tableData, theme: 'striped', headStyles: { fillColor: [30, 41, 59] } });
            doc.save(`${filename}.pdf`);
        }
    };

    const intermods = useMemo(() => calculateTalkbackIntermods(allActiveCarriers.filter(c => c.type === 'tx').map(c => ({ value: c.value }))), [allActiveCarriers]);

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
        
        for (const fz of TALKBACK_FORBIDDEN_RANGES) { 
            // Bypass 450-453 MHz AND 465-467 MHz forbidden zones in Mainland Europe mode
            if (mode === 'europe') {
                const is450Range = fz.min >= 450 && fz.max <= 453;
                const is465Range = fz.min >= 465 && fz.max <= 467;
                if (is450Range || is465Range) continue;
            }
            if (mouseFreq >= (fz.min - 0.000005) && mouseFreq <= (fz.max + 0.000005)) return { text: `REGULATORY BLOCKADE`, subtext: `Forbidden in UK: ${fz.min.toFixed(5)}-${fz.max.toFixed(5)} MHz`, color: '#f87171' }; 
        }

        for (const c of allActiveCarriers) { if (Math.abs(mouseFreq - c.value) < hitThreshold) return { text: `${c.label}: ${c.value.toFixed(5)} MHz`, subtext: `Group: ${c.groupName}`, color: c.type === 'tx' ? INTERMOD_CONFIG.tx.color : INTERMOD_CONFIG.rx.color }; }
        if (showTwoTone) { for (const im of intermods.twoTone) if (Math.abs(mouseFreq - im.value) < hitThreshold) return { text: `2-Tone IMD: ${im.value.toFixed(5)} MHz`, subtext: `Formula: 2*${im.sources[0].toFixed(3)} - ${im.sources[1].toFixed(3)}`, color: INTERMOD_CONFIG.twoTone.color }; }
        if (showThreeTone) { for (const im of intermods.threeTone) if (Math.abs(mouseFreq - im.value) < hitThreshold) return { text: `3-Tone IMD: ${im.value.toFixed(5)} MHz`, subtext: `Formula: ${im.sources[0].toFixed(3)} + ${im.sources[1].toFixed(3)} - ${im.sources[2].toFixed(3)}`, color: INTERMOD_CONFIG.threeTone.color }; }
        return null;
    }, [mouseCoord, range, allActiveCarriers, intermods, showTwoTone, showThreeTone, isDragging, mode]);

    useEffect(() => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        const draw = () => {
            const { width, height } = canvas; const padding = { top: 50, right: 20, bottom: 40, left: 50 }; const chartWidth = width - padding.left - padding.right; const chartHeight = height - padding.top - padding.bottom; const maxDb = 0, minDb = -100;
            const freqToX = (f: number) => padding.left + ((f - range.min) / (range.max - range.min)) * chartWidth;
            const ampToY = (amp: number) => padding.top + chartHeight * (1 - (amp - minDb) / (maxDb - minDb));
            ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, width, height);
            ctx.strokeStyle = INTERMOD_CONFIG.grid; ctx.lineWidth = 1; ctx.font = '10px monospace'; ctx.fillStyle = INTERMOD_CONFIG.text; ctx.textAlign = 'right';
            for (let i = 0; i <= 10; i++) { const amp = minDb + (i * 10); const y = ampToY(amp); ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(width - padding.right, y); ctx.stroke(); ctx.fillText(`${amp}`, padding.left - 8, y + 4); }
            ctx.textAlign = 'center'; const freqRange = range.max - range.min; const numVert = Math.max(5, Math.min(10, Math.floor(chartWidth / 100)));
            for (let i = 0; i <= numVert; i++) { const f = range.min + (i * freqRange / numVert); const x = freqToX(f); ctx.beginPath(); ctx.moveTo(x, padding.top); ctx.lineTo(x, height - padding.bottom); ctx.stroke(); ctx.fillText(`${f.toFixed(1)}`, x, height - padding.bottom + 15); }
            ctx.fillStyle = 'rgba(239, 68, 68, 0.2)'; 
            TALKBACK_FORBIDDEN_RANGES.forEach(fz => { 
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
                        ctx.fillRect(xS, padding.top, xE - xS, chartHeight); ctx.save(); ctx.translate(xS + 2, padding.top + 10); ctx.rotate(Math.PI / 2); ctx.fillStyle = 'rgba(248, 113, 113, 0.6)'; ctx.font = 'bold 8px sans-serif'; ctx.fillText('Forbidden in UK', 0, 0); ctx.restore(); ctx.fillStyle = 'rgba(239, 68, 68, 0.2)'; 
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
    }, [range, allActiveCarriers, intermods, showTwoTone, showThreeTone, results, manualPairs, mode]);

    const SortArrow = ({ field }: { field: string }) => {
        if (sortField !== field) return <span className="ml-1 text-slate-500">↕</span>;
        return <span className="ml-1 text-amber-400 font-black">{sortDirection === 'asc' ? '▲' : '▼'}</span>;
    };

    return (
        <div className="space-y-4 max-w-[1400px] mx-auto">
            <Card>
                <div className="flex justify-between items-center mb-6">
                    <CardTitle className="!mb-0">1. Setup Base & Portable Bands</CardTitle>
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
                    </div>
                </div>

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
                            Portable Transmit (Rx) {mode === 'europe' ? '(Low Band)' : '(High Band)'}
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
            </Card>
            <Card>
                <CardTitle>2. Fixed Site Plan</CardTitle>
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {manualPairs.map((p: DuplexPairWithBw) => {
                        const active = p.active !== false;
                        return (
                        <div key={p.id} className={`bg-slate-900/40 p-3 rounded-xl border transition-all ${active ? 'border-white/5' : 'border-slate-800 opacity-60 grayscale-[0.5]'}`}>
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col items-center gap-1 group">
                                    <button onClick={() => updateManualPair(p.id, 'active', !active)} className={`w-10 h-6 rounded-full relative transition-colors ${active ? 'bg-emerald-500' : 'bg-slate-700'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${active ? 'left-1' : 'left-5'}`} /></button>
                                    <span className={`text-[8px] font-black uppercase ${active ? 'text-emerald-400' : 'text-slate-500'}`}>{active ? 'ON' : 'OFF'}</span>
                                </div>
                                <div className="grid grid-cols-[1fr,1fr,auto,auto,auto] gap-3 items-center flex-1">
                                    <div className="flex items-center gap-1 bg-slate-800 rounded px-2">
                                        <span className="text-[8px] text-yellow-500 font-black tracking-tighter uppercase">
                                            {mode === 'europe' ? 'Base Tx (Upper)' : 'Base Tx (Lower)'}
                                        </span>
                                        <ManualFreqInput value={p.tx} onChange={(val) => updateManualPair(p.id, 'tx', val)} className="w-full bg-transparent p-1 text-xs text-white font-mono outline-none font-bold" />
                                        <button onClick={() => handleFrequencyStep(p.id, 'tx', 'down')} className="text-slate-500 hover:text-white px-1 font-bold">-</button>
                                        <button onClick={() => handleFrequencyStep(p.id, 'tx', 'up')} className="text-slate-500 hover:text-white px-1 font-bold">+</button>
                                    </div>
                                    <div className="flex items-center gap-1 bg-slate-800 rounded px-2">
                                        <span className="text-[8px] text-cyan-500 font-black tracking-tighter uppercase">
                                            {mode === 'europe' ? 'Port Rx (Lower)' : 'Port Rx (Upper)'}
                                        </span>
                                        <ManualFreqInput value={p.rx} onChange={(val) => updateManualPair(p.id, 'rx', val)} className="w-full bg-transparent p-1 text-xs text-white font-mono outline-none font-bold" />
                                        <button onClick={() => handleFrequencyStep(p.id, 'rx', 'down')} className="text-slate-500 hover:text-white px-1 font-bold">-</button>
                                        <button onClick={() => handleFrequencyStep(p.id, 'rx', 'up')} className="text-slate-500 hover:text-white px-1 font-bold">+</button>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest text-center">BW (kHz)</span>
                                        <select value={p.txBw || 0.0125} onChange={e => { const val = parseFloat(e.target.value); setManualPairs(pairs => pairs.map(mp => mp.id === p.id ? { ...mp, txBw: val, rxBw: val } : mp)); }} className="bg-slate-800 border border-slate-700 rounded text-[10px] px-1.5 py-0.5 text-indigo-300 outline-none font-bold">
                                            <option value={0.0125}>12.5k</option><option value={0.025}>25k</option><option value={0.050}>50k</option>
                                        </select>
                                    </div>
                                    <button onClick={() => updateManualPair(p.id, 'locked', !p.locked)} className={`p-1.5 rounded transition-all ${p.locked ? 'text-amber-500 bg-amber-500/10' : 'text-slate-600 hover:text-slate-300'}`} title={p.locked ? "Unlock" : "Lock"}><span className="text-sm">{p.locked ? '🔒' : '🔓'}</span></button>
                                    <button onClick={() => removeManualPair(p.id)} className="text-red-400 p-2 font-bold text-lg hover:text-red-300 transition-colors">&times;</button>
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
                        <div className="flex justify-between items-center mb-1.5"><span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{isCalculating ? 'Searching Optimization Space...' : 'Spectral Yield'}</span><span className="text-xs font-bold text-white font-mono">{isCalculating ? `${Math.round(genProgress * 100)}%` : `${results?.length || 0} / ${pairCount} Pairs`}</span></div>
                        <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-white/5 shadow-inner"><div className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{ width: `${Math.min(100, (isCalculating ? genProgress : ((results?.length || 0) / pairCount)) * 100)}%` }} /></div>
                    </div>
                )}
            </div>

            {showTable && tabulatedData.length > 0 && (
                <Card className="!bg-slate-950 border-cyan-500/30 animate-in fade-in slide-in-from-top-2 duration-300">
                    <CardTitle className="!text-sm uppercase tracking-[0.2em] text-cyan-400">Numerical Spectral Allocation Ledger</CardTitle>
                    <div className="overflow-y-auto max-h-[400px] rounded-xl border border-white/10 custom-scrollbar shadow-inner">
                        <table className="w-full text-left border-collapse text-[11px]">
                            <thead className="bg-slate-900 sticky top-0 z-10"><tr className="uppercase font-black text-slate-500 border-b border-white/10"><th className="p-3 cursor-pointer select-none" onClick={() => handleSort('value')}>Frequency (MHz) <SortArrow field="value" /></th><th className="p-3 cursor-pointer select-none" onClick={() => handleSort('label')}>Designation <SortArrow field="label" /></th><th className="p-3 cursor-pointer select-none" onClick={() => handleSort('type')}>Type <SortArrow field="type" /></th><th className="p-3 cursor-pointer select-none" onClick={() => handleSort('groupName')}>Source Group <SortArrow field="groupName" /></th><th className="p-3 cursor-pointer select-none" onClick={() => handleSort('bw')}>Bandwidth <SortArrow field="bw" /></th></tr></thead>
                            <tbody className="divide-y divide-white/5">{tabulatedData.map((row, i) => (<tr key={i} className="hover:bg-cyan-500/5 transition-colors group"><td className="p-3 font-mono text-cyan-400 font-black text-sm">{row.value.toFixed(5)}</td><td className="p-3"><span className="text-white font-bold tracking-tight">{row.label}</span></td><td className="p-3"><span className={`px-2 py-0.5 rounded uppercase text-[8px] font-black border ${row.type === 'tx' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'}`}>{row.type === 'tx' ? 'Base Tx' : 'Port Rx'}</span></td><td className="p-3"><span className="text-indigo-300 font-black uppercase tracking-tighter">{row.groupName}</span></td><td className="p-3 font-mono text-slate-500">{(row.bw * 1000).toFixed(1)} kHz</td></tr>))}</tbody>
                        </table>
                    </div>
                </Card>
            )}

            <Card>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <div className="flex items-center gap-3"><CardTitle className="!mb-0">3. Intermod Physics Auditor</CardTitle>{results && results.length > 0 && (<button onClick={handleLockAllResults} className={`text-[10px] font-black tracking-widest px-2 py-1 rounded border-2 transition-all flex items-center gap-1.5 ${allResultsLocked ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/40' : 'bg-slate-700 text-slate-400 border-slate-600 hover:border-slate-500'}`} title={allResultsLocked ? "Unlock All" : "Lock All"}><span>{allResultsLocked ? '🔒' : '🔓'}</span>{allResultsLocked ? 'UNLOCK ALL' : 'LOCK ALL'}</button>)}<button onClick={handleRunAudit} className={primaryButton}>RUN SPECTRAL AUDIT</button></div>
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
                <div className="relative group"><canvas ref={canvasRef} width={1000} height={350} className={`w-full bg-slate-950 rounded-xl border border-blue-500/20 shadow-inner ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onPointerLeave={handlePointerUp} onWheel={handleWheel} />{activeHit && mouseCoord && !isDragging && (<div className="fixed z-[100] p-2.5 bg-slate-900/95 border border-white/20 rounded-lg shadow-2xl pointer-events-none backdrop-blur-md transform -translate-x-1/2 -translate-y-full" style={{ left: mouseCoord.clientX, top: mouseCoord.clientY - 12 }}><div className="flex flex-col gap-0.5"><div className="text-[11px] font-black uppercase tracking-tight" style={{ color: activeHit.color }}>{activeHit.text}</div><div className="text-[10px] text-slate-400 font-mono italic">{activeHit.subtext}</div></div><div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 border-r border-b border-white/20 transform rotate-45" /></div>)}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">{results?.map(p => { const active = p.active !== false; return (<div key={p.id} className={`p-3 bg-slate-800/80 border transition-all rounded-xl flex justify-between items-center group ${active ? 'border-white/5 hover:border-blue-500/30' : 'border-slate-800 opacity-60 grayscale-[0.5]'}`}><div className="flex items-center gap-3 flex-1 overflow-hidden"><div className="flex flex-col items-center gap-1 flex-shrink-0"><button onClick={() => handleResultActiveToggle(p.id)} className={`w-8 h-4 rounded-full relative transition-colors ${active ? 'bg-emerald-500' : 'bg-slate-700'}`}><div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${active ? 'left-0.5' : 'left-4.5'}`} /></button><span className={`text-[8px] font-black uppercase ${active ? 'text-emerald-400' : 'text-slate-500'}`}>{active ? 'ON' : 'OFF'}</span></div><div className="font-mono text-[11px] space-y-1 flex-1 min-w-0"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 flex-1 min-w-0"><span className="text-[10px] text-yellow-500 font-bold w-4 flex-shrink-0">T:</span><ManualFreqInput value={p.tx} onChange={(v) => handleResultChange(p.id, 'tx', v)} className="w-full bg-transparent p-0 text-white font-bold outline-none border-none text-[10px]" /></div><div className="flex gap-1 flex-shrink-0 transition-opacity"><button onClick={() => handleFrequencyStep(p.id, 'tx', 'down')} className="text-[9px] bg-slate-700 text-white rounded px-1 hover:bg-blue-600 font-bold">-</button><button onClick={() => handleFrequencyStep(p.id, 'tx', 'up')} className="text-[9px] bg-slate-700 text-white rounded px-1 hover:bg-blue-600 font-bold">+</button></div></div><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 flex-1 min-w-0"><span className="text-[10px] text-blue-500 font-bold w-4 flex-shrink-0">R:</span><ManualFreqInput value={p.rx} onChange={(v) => handleResultChange(p.id, 'rx', v)} className="w-full bg-transparent p-0 text-white font-bold outline-none border-none text-[11px]" /></div><div className="flex gap-1 flex-shrink-0 transition-opacity"><button onClick={() => handleFrequencyStep(p.id, 'rx', 'down')} className="text-[9px] bg-slate-700 text-white rounded px-1 hover:bg-blue-600 font-bold">-</button><button onClick={() => handleFrequencyStep(p.id, 'rx', 'up')} className="text-[9px] bg-slate-700 text-white rounded px-1 hover:bg-blue-600 font-bold">+</button></div></div></div></div><div className="flex items-center gap-2 ml-2 border-l border-white/10 pl-2 flex-shrink-0"><button onClick={() => handleResultLockToggle(p.id)} className={`p-1.5 rounded transition-all ${p.locked ? 'text-amber-500 bg-amber-500/10' : 'text-slate-600 hover:text-slate-300'}`} title={p.locked ? "Unlock" : "Lock"}><span className="text-sm">{p.locked ? '🔒' : '🔓'}</span></button><button onClick={() => handleRemoveResult(p.id)} className="text-red-400 hover:text-red-300 p-1 font-bold text-xl leading-none" title="Remove pair">&times;</button></div></div>);})}</div>
            </Card>
        </div>
    );
};

export default React.memo(TalkbackTab);
