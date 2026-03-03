import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Frequency, TabID, ScanDataPoint, Scene, FestivalAct, Plot, PlotState, DuplexPair, ZonalResult, TxType, ConstantSystemRequest, WMASState } from '../types';
import Card, { CardTitle } from './Card';
import { US_TV_CHANNELS, UK_TV_CHANNELS } from '../constants';
import * as dbService from '../services/dbService';

interface SpectrumFrequency extends Frequency {
    isTx?: boolean;
}

interface SpectrumTabProps {
    projectId?: number;
    analyzerFrequencies: Frequency[];
    generatorFrequencies: Frequency[] | null;
    scanData: ScanDataPoint[] | null;
    setScanData: (data: ScanDataPoint[] | null) => void;
    setInclusionRanges: (ranges: { min: number; max: number }[] | null) => void;
    setActiveTab: (tabId: TabID) => void;
    scenes: Scene[];
    festivalActs: FestivalAct[];
    constantSystems: ConstantSystemRequest[];
    houseSystems: ConstantSystemRequest[];
    talkbackPairs?: DuplexPair[] | null;
    talkbackManual?: DuplexPair[] | null;
    zonalResults?: ZonalResult[] | null;
    wmasState?: WMASState;
}

const buttonBase = "px-4 py-2 rounded-lg font-semibold uppercase tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transform active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed text-xs";
const primaryButton = `bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-b-4 border-blue-800 hover:border-blue-700 hover:brightness-110 ${buttonBase}`;
const dangerButton = `bg-gradient-to-r from-red-500 to-rose-500 text-white border-b-4 border-red-800 hover:border-red-700 hover:brightness-110 ${buttonBase}`;
const secondaryButton = `bg-slate-700 text-slate-200 border-b-4 border-slate-900 hover:border-slate-800 hover:bg-slate-600 ${buttonBase}`;
const actionButton = `bg-cyan-600/80 text-white border-b-4 border-cyan-800 hover:border-cyan-700 hover:bg-cyan-600 ${buttonBase}`;
const generatorButton = `bg-gradient-to-r from-amber-500 to-orange-500 text-white border-b-4 border-amber-800 hover:border-amber-700 hover:brightness-110 ${buttonBase}`;
const talkbackButton = `bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-b-4 border-cyan-800 hover:border-cyan-700 hover:bg-cyan-600 ${buttonBase}`;
const zonalButton = `bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-b-4 border-indigo-800 hover:border-indigo-700 hover:brightness-110 ${buttonBase}`;

const SIGNAL_CONFIG = {
    fundamental: { amp: -10, color: '#facc15', width: 2 },
    fundamentalIEM: { amp: -5, color: '#fb923c', width: 2 },
    fundamentalComms: { amp: -12, color: '#22d3ee', width: 2 },
    fundamentalWMAS: { amp: -5, color: '#a855f7', width: 3 },
    imd2: { amp: -35, color: '#f87171' },
    imd3: { amp: -55, color: '#c084fc' },
    scanData: { color: '#38bdf8', width: 1.5 },
    liveTrace: { color: '#fde047' },
    peakHold: { color: 'rgba(248, 113, 113, 0.4)' },
    gridMajor: 'rgba(59, 130, 246, 0.2)',
    fontColor: '#94a3b8',
};

interface TooltipHit {
    title: string;
    freq: number;
    sources?: number[];
    color: string;
    type: 'fundamental' | 'imd';
    txType?: TxType;
    dist?: number;
}

interface TooltipData {
    x: number;
    y: number;
    hits: TooltipHit[];
}

const parseScanData = async (file: File): Promise<ScanDataPoint[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const points: ScanDataPoint[] = [];
            const rows = text.split(/\r?\n/);
            
            rows.forEach(row => {
                const trimmedRow = row.trim();
                if (!trimmedRow || trimmedRow.startsWith('#') || trimmedRow.startsWith(';') || trimmedRow.startsWith('*')) return;
                const parts = trimmedRow.split(/[,;\t\s]+/)
                    .map(p => p.replace(/[a-zA-Z]/g, '').trim())
                    .filter(p => p !== '');
                if (parts.length >= 2) {
                    const freq = parseFloat(parts[0]);
                    const amp = parseFloat(parts[1]);
                    if (!isNaN(freq) && !isNaN(amp) && freq > 0) {
                        points.push({ freq, amp });
                    }
                }
            });
            if (points.length === 0) reject(new Error("No valid spectral data found."));
            else resolve(points.sort((a, b) => a.freq - b.freq));
        };
        reader.onerror = () => reject(new Error("File read error."));
        reader.readAsText(file);
    });
};

const SpectrumTab: React.FC<SpectrumTabProps> = ({ projectId, analyzerFrequencies, generatorFrequencies, scanData, setScanData, setInclusionRanges, setActiveTab, scenes, festivalActs, constantSystems, houseSystems, talkbackPairs, talkbackManual, zonalResults, wmasState }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [range, setRange] = useState({ min: 470, max: 700 });
    const [displayMode, setDisplayMode] = useState<'line' | 'filled'>('line');
    const [noiseFloor, setNoiseFloor] = useState(-95);
    const [showPeakHold, setShowPeakHold] = useState(false);
    const [overlayChannels, setOverlayChannels] = useState(false);
    const [showGenerator, setShowGenerator] = useState(false);
    const [showTalkback, setShowTalkback] = useState(false);
    const [showZonal, setShowZonal] = useState(false);
    const [region, setRegion] = useState('uk');
    const [centerFreqInput, setCenterFreqInput] = useState<string>(((470 + 700) / 2).toFixed(4));
    const [isFestivalMode, setIsFestivalMode] = useState(false);
    const [selectedActIds, setSelectedActIds] = useState<Set<string>>(new Set());
    const [tooltip, setTooltip] = useState<TooltipData | null>(null);

    const [visualBw, setVisualBw] = useState(0.200);
    const [freqStep, setFreqStep] = useState<number>(0.025); 
    const [spanStep, setSpanStep] = useState<number>(1.0); 

    const [isDragging, setIsDragging] = useState(false);
    const [dragState, setDragState] = useState<{ startX: number, startMin: number, startMax: number } | null>(null);

    const peakHoldData = useRef<number[]>([]);
    
    const isCenterFreqFocused = useRef(false);

    const hasTalkback = useMemo(() => (talkbackPairs && talkbackPairs.length > 0) || (talkbackManual && talkbackManual.length > 0), [talkbackPairs, talkbackManual]);
    const hasZonal = useMemo(() => zonalResults && zonalResults.some(z => z.pairs.length > 0), [zonalResults]);

    const freqsToDisplay = useMemo(() => {
        let pool: SpectrumFrequency[] = [];
        if (isFestivalMode) {
            // Performing Acts
            festivalActs.forEach(act => {
                if (selectedActIds.has(act.id)) {
                    act.frequencies?.forEach((f) => {
                        if (f.value > 0) pool.push({ ...f, id: f.id, label: f.label, isTx: true });
                    });
                }
            });
            // Constant Transmits
            constantSystems.forEach(sys => {
                if (selectedActIds.has(`const-${sys.stageName}`)) {
                    sys.frequencies?.forEach(f => {
                        if (f.value > 0) pool.push({ ...f, isTx: true });
                    });
                }
            });
            // House Systems
            houseSystems.forEach(sys => {
                if (selectedActIds.has(`house-${sys.stageName}`)) {
                    sys.frequencies?.forEach(f => {
                        if (f.value > 0) pool.push({ ...f, isTx: true });
                    });
                }
            });
        } else {
            analyzerFrequencies.forEach(f => pool.push({ ...f, isTx: true }));
            if (showGenerator && generatorFrequencies) {
                generatorFrequencies.forEach(f => pool.push({ ...f, isTx: true }));
            }
            if (showTalkback) {
                if (talkbackPairs) talkbackPairs.forEach((p, i) => {
                    if (p.tx > 0) pool.push({ id: `TB ${i+1} Tx`, value: p.tx, type: 'comms', isTx: true });
                    if (p.rx > 0) pool.push({ id: `TB ${i+1} Rx`, value: p.rx, type: 'comms', isTx: false });
                });
                if (talkbackManual) talkbackManual.forEach((p, i) => {
                    if (p.tx > 0) pool.push({ id: `TB Man ${i+1} Tx`, value: p.tx, type: 'comms', isTx: true });
                    if (p.rx > 0) pool.push({ id: `TB Man ${i+1} Rx`, value: p.rx, type: 'comms', isTx: false });
                });
            }
            if (showZonal && zonalResults) {
                zonalResults.forEach((z, zIdx) => {
                    z.pairs.forEach((p, pIdx) => {
                        if (p.tx > 0) pool.push({ id: `Z${zIdx+1} TB ${pIdx+1} Tx`, value: p.tx, type: 'comms', isTx: true });
                        if (p.rx > 0) pool.push({ id: `Z${zIdx+1} TB ${pIdx+1} Rx`, value: p.rx, type: 'comms', isTx: false });
                    });
                });
            }
        }
        return pool.filter(f => f.value > 0);
    }, [isFestivalMode, selectedActIds, analyzerFrequencies, generatorFrequencies, talkbackPairs, talkbackManual, zonalResults, festivalActs, constantSystems, houseSystems, showGenerator, showTalkback, showZonal]);

    const imdProducts = useMemo(() => {
        const list: { val: number; type: '2t' | '3t'; sources: number[] }[] = [];
        const base = freqsToDisplay.filter(f => f.isTx !== false).map(f => f.value);
        if (base.length < 2) return list;
        for (let i = 0; i < base.length; i++) {
            for (let j = 0; j < base.length; j++) {
                if (i === j) continue;
                list.push({ val: 2 * base[i] - base[j], type: '2t', sources: [base[i], base[j]] });
            }
        }
        if (base.length >= 3) {
            for (let i = 0; i < base.length; i++) {
                for (let j = i + 1; j < base.length; j++) {
                    for (let k = 0; k < base.length; k++) {
                        if (k === i || k === j) continue;
                        const product = base[i] + base[j] - base[k];
                        list.push({ val: product, type: '3t', sources: [base[i], base[j], base[k]] });
                    }
                }
            }
        }
        return list;
    }, [freqsToDisplay]);

    useEffect(() => {
        if (!isCenterFreqFocused.current) {
            setCenterFreqInput(((range.min + range.max) / 2).toFixed(4));
        }
    }, [range.min, range.max]);

    const handleScroll = (dir: 'left' | 'right') => {
        setRange(prev => {
            const shift = dir === 'left' ? -freqStep : freqStep;
            return { min: prev.min + shift, max: prev.max + shift };
        });
    };

    const handleSpan = (dir: 'in' | 'out') => {
        setRange(prev => {
            const center = (prev.min + prev.max) / 2;
            const currentSpan = prev.max - prev.min;
            const newSpan = dir === 'in' 
                ? Math.max(0.025, currentSpan - spanStep) 
                : currentSpan + spanStep;
            return { min: center - newSpan / 2, max: center + newSpan / 2 };
        });
    };

    const applyCenterFreq = (val: string) => {
        const c = parseFloat(val);
        if (!isNaN(c)) {
            setRange(prev => {
                const span = prev.max - prev.min;
                return { min: c - span / 2, max: c + span / 2 };
            });
        } else {
            setCenterFreqInput(((range.min + range.max) / 2).toFixed(4));
        }
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (e.button !== 0) return;
        setIsDragging(true);
        setDragState({ startX: e.clientX, startMin: range.min, startMax: range.max });
        (e.target as Element).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDragging || !dragState || !canvasRef.current) { handleHoverTooltip(e); return; }
        const deltaX = e.clientX - dragState.startX;
        const canvasWidth = canvasRef.current.clientWidth;
        const span = dragState.startMax - dragState.startMin;
        const freqShift = (deltaX / canvasWidth) * span;
        setRange({ min: parseFloat((dragState.startMin - freqShift).toFixed(5)), max: parseFloat((dragState.startMax - freqShift).toFixed(5)) });
        setTooltip(null);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => { setIsDragging(false); setDragState(null); (e.target as Element).releasePointerCapture(e.pointerId); };
    const handlePointerLeave = (e: React.PointerEvent<HTMLCanvasElement>) => { setIsDragging(false); setDragState(null); setTooltip(null); (e.target as Element).releasePointerCapture(e.pointerId); };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const data = await parseScanData(file);
            setScanData(data);
            const min = data[0].freq;
            const max = data[data.length - 1].freq;
            setRange({ min: Math.floor(min - 5), max: Math.ceil(max + 5) });
        } catch (err: any) { alert(`Error parsing scan file: ${err.message}`); }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleHoverTooltip = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const padding = { top: 60, right: 20, bottom: 50, left: 50 };
        const scaleX = canvas.width / rect.width;
        const internalX = x * scaleX;
        const scaleY = canvas.height / rect.height;
        const internalY = y * scaleY;
        const chartWidth = canvas.width - padding.left - padding.right;
        if (internalX < padding.left || internalX > canvas.width - padding.right || internalY < padding.top || internalY > canvas.height - padding.bottom) {
            setTooltip(null); return;
        }
        const mouseFreq = range.min + ((internalX - padding.left) / chartWidth) * (range.max - range.min);
        const hitThreshold = (8 / chartWidth) * (range.max - range.min);
        const hits: TooltipHit[] = [];
        freqsToDisplay.forEach(f => {
            const dist = Math.abs(f.value - mouseFreq);
            if (dist < hitThreshold) {
                hits.push({ title: f.label || f.id, freq: f.value, color: f.type === 'iem' ? SIGNAL_CONFIG.fundamentalIEM.color : (f.type === 'comms' ? SIGNAL_CONFIG.fundamentalComms.color : SIGNAL_CONFIG.fundamental.color), type: 'fundamental', txType: f.type, dist });
            }
        });
        imdProducts.forEach(p => {
            const dist = Math.abs(p.val - mouseFreq);
            if (dist < hitThreshold) {
                hits.push({ title: p.type === '2t' ? '2-Tone IMD' : '3-Tone IMD', freq: p.val, sources: p.sources, color: p.type === '2t' ? SIGNAL_CONFIG.imd2.color : SIGNAL_CONFIG.imd3.color, type: 'imd', dist });
            }
        });
        if (hits.length > 0) {
            hits.sort((a, b) => {
                if (a.type === 'fundamental' && b.type === 'imd') return -1;
                if (a.type === 'imd' && b.type === 'fundamental') return 1;
                return (a.dist || 0) - (b.dist || 0);
            });
            const primaryHit = hits[0];
            const hitFreqX = padding.left + ((primaryHit.freq - range.min) / (range.max - range.min)) * chartWidth;
            const snapCssX = hitFreqX / scaleX;
            setTooltip({ x: snapCssX, y: e.clientY - rect.top, hits: hits.slice(0, 5) });
        } else setTooltip(null);
    };

    const formatPreciseFreq = (freq: number, txType?: TxType, hitType?: 'fundamental' | 'imd') => {
        if (hitType === 'imd') return freq.toFixed(5);
        if (txType === 'comms') return freq.toFixed(5);
        if (txType === 'mic' || txType === 'iem') return freq.toFixed(3);
        return freq.toFixed(4); 
    };

    const binnedScanDataArray = useMemo(() => {
        const canvas = canvasRef.current;
        if (!scanData || !canvas) return null;
        const padding = { top: 60, right: 20, bottom: 50, left: 50 };
        const chartWidth = canvas.width - padding.left - padding.right;
        if (chartWidth <= 0) return null;
        const bins: number[] = new Array(chartWidth).fill(noiseFloor);
        const viewSpan = range.max - range.min;
        const startIndex = scanData.findIndex(p => p.freq >= range.min - 1);
        if (startIndex === -1 && scanData[scanData.length - 1].freq < range.min) return bins;
        for (let i = Math.max(0, startIndex); i < scanData.length; i++) {
            const point = scanData[i];
            if (point.freq > range.max + 1) break;
            const x = Math.floor(((point.freq - range.min) / viewSpan) * chartWidth);
            if (x >= 0 && x < chartWidth) { if (point.amp > bins[x]) bins[x] = point.amp; }
        }
        return bins;
    }, [scanData, range, noiseFloor, canvasRef.current?.width]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;
        let animationFrameId: number;
        const render = () => {
            const { width, height } = canvas;
            const padding = { top: 60, right: 20, bottom: 50, left: 50 };
            const chartWidth = width - padding.left - padding.right;
            const chartHeight = height - padding.top - padding.bottom;
            if (chartWidth <= 0) return;
            const maxDb = 0, minDb = -110, dbRange = maxDb - minDb;
            const freqToX = (f: number) => padding.left + ((f - range.min) / (range.max - range.min)) * chartWidth;
            const ampToY = (a: number) => padding.top + chartHeight * (1 - (a - minDb) / dbRange);
            if (peakHoldData.current.length !== chartWidth) { peakHoldData.current = new Array(chartWidth).fill(minDb); }
            ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, width, height);
            ctx.strokeStyle = SIGNAL_CONFIG.gridMajor; ctx.lineWidth = 1; ctx.font = '10px monospace'; ctx.fillStyle = SIGNAL_CONFIG.fontColor; ctx.textAlign = 'right';
            for (let i = 0; i <= 10; i++) { const db = maxDb - i * 10; const y = ampToY(db); ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(width - padding.right, y); ctx.stroke(); ctx.fillText(`${db}`, padding.left - 8, y + 4); }
            const freqRange = range.max - range.min; const numVert = 10; ctx.textAlign = 'center';
            for (let i = 0; i <= numVert; i++) { const f = range.min + i * (freqRange / numVert); const x = freqToX(f); ctx.beginPath(); ctx.moveTo(x, padding.top); ctx.lineTo(x, height - padding.bottom); ctx.stroke(); ctx.fillText(`${f.toFixed(1)}`, x, height - padding.bottom + 15); }
            if (overlayChannels) { 
                const chans = region === 'uk' ? UK_TV_CHANNELS : US_TV_CHANNELS; ctx.fillStyle = 'rgba(59, 130, 246, 0.05)'; ctx.textAlign = 'left'; 
                Object.entries(chans).forEach(([ch, [s, e]]) => { if (e >= range.min && s <= range.max) { const xS = Math.max(padding.left, freqToX(s)); const xE = Math.min(width - padding.right, freqToX(e)); if (xE > xS) { ctx.fillRect(xS, padding.top, xE - xS, chartHeight); ctx.fillStyle = 'rgba(96, 165, 250, 0.3)'; ctx.fillText(`CH ${ch}`, xS + 4, padding.top + 12); ctx.fillStyle = 'rgba(59, 130, 246, 0.05)'; } } }); 
            }

            // Draw WMAS Blocks from coordinated frequencies
            freqsToDisplay.forEach(f => {
                if (f.type === 'wmas') {
                    let bw = 6;
                    if (f.equipmentKey && f.equipmentKey.includes('8mhz')) bw = 8;
                    const halfBw = bw / 2;
                    const startFreq = f.value - halfBw;
                    const endFreq = f.value + halfBw;
                    
                    if (endFreq >= range.min && startFreq <= range.max) {
                        const xS = Math.max(padding.left, freqToX(startFreq));
                        const xE = Math.min(width - padding.right, freqToX(endFreq));
                        
                        if (xE > xS) {
                            ctx.fillStyle = 'rgba(168, 85, 247, 0.2)';
                            ctx.fillRect(xS, padding.top, xE - xS, chartHeight);
                            ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
                            ctx.lineWidth = 1;
                            ctx.strokeRect(xS, padding.top, xE - xS, chartHeight);
                            ctx.fillStyle = 'rgba(192, 132, 252, 0.8)';
                            ctx.textAlign = 'center';
                            ctx.font = 'bold 10px sans-serif';
                            ctx.fillText(`WMAS ${f.label || ''}`, (xS + xE) / 2, padding.top + 35);
                        }
                    }
                }
            });

            if (wmasState && wmasState.nodes) {
                ctx.fillStyle = 'rgba(168, 85, 247, 0.1)'; ctx.textAlign = 'left';
                wmasState.nodes.forEach(node => {
                    if (node.assignedBlock && node.assignedBlock.end >= range.min && node.assignedBlock.start <= range.max) {
                        const xS = Math.max(padding.left, freqToX(node.assignedBlock.start));
                        const xE = Math.min(width - padding.right, freqToX(node.assignedBlock.end));
                        if (xE > xS) {
                            ctx.fillRect(xS, padding.top, xE - xS, chartHeight);
                            ctx.fillStyle = 'rgba(192, 132, 252, 0.6)';
                            ctx.fillText(`WMAS: ${node.name}`, xS + 4, padding.top + 24);
                            ctx.fillStyle = 'rgba(168, 85, 247, 0.1)';
                        }
                    }
                });
            }
            const liveTrace: number[] = new Array(chartWidth).fill(noiseFloor);
            if (binnedScanDataArray) { for (let i = 0; i < chartWidth; i++) liveTrace[i] = binnedScanDataArray[i]; }
            else { for (let i = 0; i < chartWidth; i++) liveTrace[i] = noiseFloor + (Math.random() * 4 - 2); }
            const drawGaussianPeaks = (peakList: { val: number; baseAmp: number }[]) => {
                peakList.forEach(f => {
                    const jitter = isRunning ? (Math.random() * 2.5 - 1.25) : 0; const peakAmp = f.baseAmp + jitter; const pxWidth = (visualBw / freqRange) * chartWidth; const centerPx = ((f.val - range.min) / freqRange) * chartWidth;
                    const startX = Math.floor(centerPx - pxWidth * 2); const endX = Math.ceil(centerPx + pxWidth * 2);
                    for (let i = Math.max(0, startX); i <= Math.min(chartWidth - 1, endX); i++) {
                        const distPx = Math.abs(i - centerPx); const normDist = pxWidth > 0.5 ? distPx / pxWidth : 0; let shapeFactor = Math.exp(-Math.pow(normDist * 2.5, 2));
                        if (isRunning && shapeFactor > 0.02) { shapeFactor = Math.max(0, shapeFactor + (Math.random() * 0.1 - 0.05) * shapeFactor); }
                        const carrierContribution = noiseFloor + (peakAmp - noiseFloor) * shapeFactor; const microJitter = isRunning && shapeFactor > 0.1 ? (Math.random() * 1.5 - 0.75) : 0; liveTrace[i] = Math.max(liveTrace[i], carrierContribution + microJitter);
                    }
                });
            };
            drawGaussianPeaks(freqsToDisplay.map(f => ({ val: f.value, baseAmp: f.type === 'iem' ? SIGNAL_CONFIG.fundamentalIEM.amp : (f.type === 'comms' ? SIGNAL_CONFIG.fundamentalComms.amp : (f.type === 'wmas' ? SIGNAL_CONFIG.fundamentalWMAS.amp : SIGNAL_CONFIG.fundamental.amp)) })));
            drawGaussianPeaks(imdProducts.filter(p => p.type === '2t').map(p => ({ val: p.val, baseAmp: SIGNAL_CONFIG.imd2.amp })));
            drawGaussianPeaks(imdProducts.filter(p => p.type === '3t').map(p => ({ val: p.val, baseAmp: SIGNAL_CONFIG.imd3.amp })));
            if (showPeakHold) {
                for (let i = 0; i < chartWidth; i++) peakHoldData.current[i] = Math.max(peakHoldData.current[i], liveTrace[i]);
                ctx.beginPath(); ctx.strokeStyle = SIGNAL_CONFIG.peakHold.color; ctx.lineWidth = 1;
                for (let i = 0; i < chartWidth; i++) { const x = padding.left + i; const y = ampToY(peakHoldData.current[i]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
                ctx.stroke();
            }
            ctx.beginPath(); ctx.strokeStyle = isRunning || scanData ? SIGNAL_CONFIG.scanData.color : '#64748b'; ctx.lineWidth = 2;
            if (displayMode === 'filled') ctx.fillStyle = isRunning || scanData ? 'rgba(56, 189, 248, 0.15)' : 'rgba(100, 116, 139, 0.15)';
            for (let i = 0; i < chartWidth; i++) { const x = padding.left + i; const y = ampToY(liveTrace[i]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
            if (displayMode === 'filled') { ctx.lineTo(padding.left + chartWidth, height - padding.bottom); ctx.lineTo(padding.left, height - padding.bottom); ctx.fill(); }
            ctx.stroke();
            ctx.save();
            freqsToDisplay.forEach(f => {
                const x = freqToX(f.value);
                if (x >= padding.left && x <= width - padding.right) { ctx.translate(x, padding.top + 10); ctx.rotate(-Math.PI / 4); ctx.fillStyle = f.type === 'iem' ? SIGNAL_CONFIG.fundamentalIEM.color : (f.type === 'comms' ? SIGNAL_CONFIG.fundamentalComms.color : (f.type === 'wmas' ? SIGNAL_CONFIG.fundamentalWMAS.color : SIGNAL_CONFIG.fundamental.color)); ctx.font = 'bold 9px sans-serif'; ctx.fillText(f.label || f.id, 0, 0); ctx.setTransform(1, 0, 0, 1, 0, 0); }
            });
            ctx.restore();
            if (isRunning) animationFrameId = requestAnimationFrame(render);
        };
        if (isRunning) animationFrameId = requestAnimationFrame(render); else render();
        return () => cancelAnimationFrame(animationFrameId);
    }, [isRunning, range, displayMode, noiseFloor, showPeakHold, overlayChannels, region, scanData, freqsToDisplay, imdProducts, freqStep, spanStep, visualBw, binnedScanDataArray, wmasState]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if(canvas) {
            const observer = new ResizeObserver(() => { canvas.width = canvas.offsetWidth; canvas.height = 500; });
            observer.observe(canvas); return () => observer.disconnect();
        }
    }, []);

    const toggleSelection = (id: string) => {
        setSelectedActIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <Card fullWidth className="!p-4">
            <div className="flex flex-col lg:flex-row gap-4 mb-4">
                <div className="flex-1 space-y-4">
                    <CardTitle className="!mb-0">Professional Spectrum Analyzer</CardTitle>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                        <button onClick={() => setIsRunning(!isRunning)} className={isRunning ? dangerButton : primaryButton}>
                            {isRunning ? 'STOP TRACE' : 'START TRACE'}
                        </button>
                        <button onClick={() => { peakHoldData.current = []; }} className={secondaryButton}>CLEAR PEAK</button>
                        <button onClick={() => { setIsFestivalMode(!isFestivalMode); }} className={`${actionButton} ${isFestivalMode ? '!bg-indigo-600' : ''}`}>
                            {isFestivalMode ? 'EXIT FESTIVAL' : 'FESTIVAL MODE'}
                        </button>
                        <button onClick={() => setShowGenerator(!showGenerator)} className={`${generatorButton} ${showGenerator ? 'brightness-125 ring-2 ring-white/20' : ''}`} disabled={!generatorFrequencies || generatorFrequencies.length === 0}>
                            {showGenerator ? 'HIDE GEN' : 'LOAD GEN'}
                        </button>
                        <button onClick={() => setShowTalkback(!showTalkback)} className={`${talkbackButton} ${showTalkback ? 'brightness-125 ring-2 ring-white/20' : ''}`} disabled={!hasTalkback}>
                            {showTalkback ? 'HIDE TB' : 'LOAD TB'}
                        </button>
                        <button onClick={() => setShowZonal(!showZonal)} className={`${zonalButton} ${showZonal ? 'brightness-125 ring-2 ring-white/20' : ''}`} disabled={!hasZonal}>
                            {showZonal ? 'HIDE ZONAL' : 'LOAD ZONAL'}
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                        <button onClick={() => fileInputRef.current?.click()} className={secondaryButton}>IMPORT SCAN</button>
                        <button onClick={() => setScanData(null)} disabled={!scanData} className={dangerButton}>CLEAR SCAN</button>
                    </div>
                </div>
                <div className="lg:w-[400px] bg-slate-900/50 p-3 rounded-xl border border-slate-700 grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                        <label className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Display Mode</label>
                        <select value={displayMode} onChange={e => setDisplayMode(e.target.value as any)} className="w-full bg-slate-800 text-[10px] p-1.5 rounded border border-slate-600 text-slate-200">
                            <option value="line">Vector Line</option>
                            <option value="filled">Solid Fill</option>
                        </select>
                    </div>
                    <div className="col-span-1">
                        <label className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Noise Floor</label>
                        <input type="number" value={noiseFloor} onChange={e => setNoiseFloor(Number(e.target.value))} className="w-full bg-slate-800 text-[10px] p-1.5 rounded border border-slate-600 text-cyan-400 font-mono" />
                    </div>
                    <div className="col-span-1">
                        <label className="text-[9px] text-indigo-400 uppercase font-black block mb-1">Signal BW</label>
                        <div className="flex bg-slate-800 rounded border border-slate-600 p-0.5">
                            {[200, 25, 12.5].map(val => (
                                <button 
                                    key={val}
                                    onClick={() => setVisualBw(val / 1000)}
                                    className={`flex-1 py-1 rounded text-[9px] font-mono transition-all ${visualBw === val/1000 ? 'bg-indigo-600 text-white shadow-inner' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    {val}k
                                </button>
                            ))}
                        </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={showPeakHold} onChange={e => setShowPeakHold(e.target.checked)} className="w-3 h-3 accent-red-500" />
                        <span className="text-[9px] text-slate-400 uppercase font-bold">Peak Hold</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={overlayChannels} onChange={e => setOverlayChannels(e.target.checked)} className="w-3 h-3 accent-blue-500" />
                        <span className="text-[9px] text-slate-400 uppercase font-bold">TV Overlay</span>
                    </label>
                </div>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 mb-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <button onClick={() => handleScroll('left')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-300">◀</button>
                    <div className="flex flex-col items-center px-4 border-x border-slate-700">
                        <span className="text-[9px] text-slate-500 uppercase font-black">Center Frequency</span>
                        <input 
                            type="text" 
                            value={centerFreqInput} 
                            onChange={e => setCenterFreqInput(e.target.value)} 
                            onFocus={() => { isCenterFreqFocused.current = true; }}
                            onBlur={e => { isCenterFreqFocused.current = false; applyCenterFreq(e.target.value); }} 
                            onKeyDown={e => e.key === 'Enter' && applyCenterFreq(e.currentTarget.value)} 
                            className="bg-transparent text-center font-mono text-white text-sm outline-none focus:text-cyan-400 w-32" 
                        />
                    </div>
                    <button onClick={() => handleScroll('right')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-300">▶</button>
                    <div className="flex flex-col items-center ml-2 border-l border-slate-700 pl-4">
                         <span className="text-[9px] text-slate-500 uppercase font-black">Freq Step (MHz)</span>
                         <input type="number" step="0.025" min="0.001" value={freqStep} onChange={e => setFreqStep(Math.max(0.001, parseFloat(e.target.value) || 0.025))} className="bg-transparent text-center font-mono text-cyan-400 text-sm outline-none w-16" />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => handleSpan('out')} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-bold text-slate-300 border border-slate-700">SPAN +</button>
                    <button onClick={() => handleSpan('in')} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-bold text-slate-300 border border-slate-700">SPAN -</button>
                    <div className="flex flex-col items-center ml-2 border-l border-slate-700 pl-4 pr-4">
                         <span className="text-[9px] text-slate-500 uppercase font-black">Span Step (MHz)</span>
                         <input type="number" step="0.025" min="0.001" value={spanStep} onChange={e => setSpanStep(Math.max(0.001, parseFloat(e.target.value) || 0.025))} className="bg-transparent text-center font-mono text-indigo-400 text-sm outline-none w-16" />
                    </div>
                    <div className="flex flex-col items-center ml-2 border-l border-slate-700 pl-4">
                        <span className="text-[9px] text-slate-500 uppercase font-black">Current Span</span>
                        <div className="text-cyan-500 font-mono text-sm">{(range.max - range.min).toFixed(3)} MHz</div>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] text-slate-500 font-mono">Range: {range.min.toFixed(2)} - {range.max.toFixed(2)} MHz</p>
                </div>
            </div>

            {isFestivalMode && (
                <div className="bg-slate-900/80 border border-indigo-500/30 p-4 rounded-xl mb-4 animate-in slide-in-from-top-2 space-y-4">
                    <div>
                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Performing Acts
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {festivalActs.map(act => (
                                <button key={act.id} onClick={() => toggleSelection(act.id)} className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${selectedActIds.has(act.id) ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}>{act.actName}</button>
                            ))}
                            {festivalActs.length === 0 && <span className="text-[9px] text-slate-600 italic">No acts defined in Coordination tab.</span>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-white/5">
                        <div>
                            <h4 className="text-[10px] font-black text-green-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Constant Transmits
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {constantSystems.map(sys => {
                                    const id = `const-${sys.stageName}`;
                                    return (
                                        <button key={id} onClick={() => toggleSelection(id)} className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-all ${selectedActIds.has(id) ? 'bg-green-600 border-green-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}>{sys.stageName}</button>
                                    );
                                })}
                                {constantSystems.length === 0 && <span className="text-[9px] text-slate-600 italic">No static gear requests.</span>}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> House Systems
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {houseSystems.map(sys => {
                                    const id = `house-${sys.stageName}`;
                                    return (
                                        <button key={id} onClick={() => toggleSelection(id)} className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-all ${selectedActIds.has(id) ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}>{sys.stageName}</button>
                                    );
                                })}
                                {houseSystems.length === 0 && <span className="text-[9px] text-slate-600 italic">No house gear defined.</span>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="relative group">
                <canvas 
                    ref={canvasRef} 
                    className={`w-full h-[500px] bg-black rounded-2xl border border-blue-500/30 shadow-2xl ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onPointerLeave={handlePointerLeave}
                />
                
                {tooltip && (
                    <div 
                        className="absolute z-50 p-3 text-white bg-slate-900/95 border rounded-lg shadow-xl pointer-events-none backdrop-blur-md transform -translate-y-full -translate-x-1/2 mt-[-15px] min-w-[200px] divide-y divide-white/10" 
                        style={{ left: tooltip.x, top: tooltip.y, borderColor: `${tooltip.hits[0].color}80` }}
                    >
                        <div className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-70">Spectral Hit Details</div>
                        {tooltip.hits.map((hit, hIdx) => (
                            <div key={hIdx} className="py-2 first:pt-1 last:pb-1">
                                <div className="flex justify-between items-center gap-4 mb-1">
                                    <span className="font-bold text-sm" style={{ color: hit.color }}>{hit.title}</span>
                                    <span className="font-mono text-xs text-white">
                                        {formatPreciseFreq(hit.freq, hit.txType, hit.type)} MHz
                                    </span>
                                </div>
                                {hit.sources && (
                                    <div className="mt-1">
                                        <div className="flex flex-wrap gap-1">
                                            {hit.sources.map((s, idx) => (
                                                <span key={idx} className="bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[10px] text-slate-300 border border-white/5">{s.toFixed(3)}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 border-r border-b transform rotate-45" style={{ borderColor: `${tooltip.hits[0].color}80` }}></div>
                    </div>
                )}
            </div>
        </Card>
    );
};

export default React.memo(SpectrumTab);