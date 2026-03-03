import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Frequency, ScanDataPoint, WMASState } from '../types';
import Card, { CardTitle } from './Card';
import { US_TV_CHANNELS, UK_TV_CHANNELS } from '../constants';

interface SpectrumVisualizerProps {
    frequencies: Frequency[];
    scanData: ScanDataPoint[] | null;
    title?: string;
    onImportGenerator?: () => void;
    canImportGenerator?: boolean;
    onImportMultiBand?: () => void;
    canImportMultiBand?: boolean;
    wmasState?: WMASState;
    selectedWmasIds?: Set<string>;
}

const buttonBase = "px-3 py-2 rounded-md font-semibold uppercase tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transform active:translate-y-0.5 text-xs";
const primaryButton = `bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:brightness-110 ${buttonBase}`;
const secondaryButton = `bg-slate-700 text-slate-200 hover:bg-slate-600 ${buttonBase}`;
const dangerButton = `bg-rose-600 text-white hover:bg-rose-500 ${buttonBase}`;
const actionButton = `bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:brightness-110 ${buttonBase}`;
const multiBandButton = `bg-gradient-to-r from-teal-500 to-emerald-500 text-white hover:brightness-110 ${buttonBase}`;

const SIGNAL_CONFIG = {
    fundamental: { amp: -10, color: '#facc15', width: 2, label: 'Fundamental' }, // Yellow-400
    fundamentalIEM: { amp: -5, color: '#fb923c', width: 2, label: 'IEM Fundamental' }, // Orange-400
    wmas: { amp: -5, color: '#a855f7', width: 3, label: 'WMAS Carrier' }, // Purple-500
    twoTone: { amp: -30, color: '#f87171', width: 1, label: '2-Tone IMD' }, // Red-400
    threeTone: { amp: -45, color: '#c084fc', width: 1, label: '3-Tone IMD' }, // Purple-400
    
    scanData: { color: '#38bdf8', width: 1.5 }, // Sky-400
    gridMajor: 'rgba(99, 102, 241, 0.2)',
    gridMinor: 'rgba(99, 102, 241, 0.08)',
    fontColor: '#94a3b8',
    markerColor: '#f43f5e',
};

interface SignalPoint {
    freq: number;
    amp: number;
    type: 'Fundamental' | '2-Tone' | '3-Tone';
    data: any;
}

interface Tooltip {
    content: React.ReactNode;
    x: number;
    y: number;
}

const SpectrumVisualizer: React.FC<SpectrumVisualizerProps> = ({ frequencies, scanData, title = "Spectrum Analyzer", onImportGenerator, canImportGenerator, onImportMultiBand, canImportMultiBand, wmasState, selectedWmasIds }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [range, setRange] = useState({ min: 470, max: 700 });
    const [centerFreqInput, setCenterFreqInput] = useState<string>(((470 + 700) / 2).toFixed(4));
    const [centerStepMhz, setCenterStepMhz] = useState('1.0');
    const [spanIncrementMhz, setSpanIncrementMhz] = useState('5.0');
    const [overlayChannels, setOverlayChannels] = useState(false);
    const [region, setRegion] = useState('uk');
    const [tooltip, setTooltip] = useState<Tooltip | null>(null);
    
    // Drag State
    const [isDragging, setIsDragging] = useState(false);
    const [dragState, setDragState] = useState<{ startX: number, startMin: number, startMax: number } | null>(null);

    // Focus Guard to prevent state updates from overwriting user typing
    const isCenterFreqFocused = useRef(false);

    // Visibility Toggles
    const [showTwoTone, setShowTwoTone] = useState(true);
    const [showThreeTone, setShowThreeTone] = useState(true);
    const [showLabels, setShowLabels] = useState(true);

    const calculatedSignals = useRef<SignalPoint[]>([]);

    useEffect(() => {
        // Sync the text input only if the user is not actively focused on it
        if (!isCenterFreqFocused.current) {
            setCenterFreqInput(((range.min + range.max) / 2).toFixed(4));
        }
    }, [range]);

    // Auto-range on first load
    useEffect(() => {
        const validFreqs = frequencies.filter(f => f.value > 0);
        if (validFreqs.length > 0) {
            const values = validFreqs.map(f => f.value);
            const min = Math.min(...values);
            const max = Math.max(...values);
            if (range.min === 470 && range.max === 700) {
                setRange({ 
                    min: Math.floor(min - 5), 
                    max: Math.ceil(max + 5) 
                });
            }
        }
    }, [frequencies]);

    useMemo(() => {
        const signals: SignalPoint[] = [];
        const validFreqs = frequencies.filter(f => f.value > 0);
        validFreqs.forEach(f => {
            signals.push({
                freq: f.value,
                amp: f.type === 'iem' ? SIGNAL_CONFIG.fundamentalIEM.amp : SIGNAL_CONFIG.fundamental.amp,
                type: 'Fundamental',
                data: f
            });
        });
        if (validFreqs.length >= 2) {
            for (let i = 0; i < validFreqs.length; i++) {
                for (let j = 0; j < validFreqs.length; j++) {
                    if (i === j) continue;
                    const product = 2 * validFreqs[i].value - validFreqs[j].value;
                    signals.push({ freq: product, amp: SIGNAL_CONFIG.twoTone.amp, type: '2-Tone', data: { product, sources: [validFreqs[i], validFreqs[j]] } });
                }
            }
            for (let i = 0; i < validFreqs.length; i++) {
                for (let j = 0; j < validFreqs.length; j++) {
                    if (i === j) continue;
                    for (let k = 0; k < validFreqs.length; k++) {
                        if (k === i || k === j) continue;
                        const product = validFreqs[i].value + validFreqs[j].value - validFreqs[k].value;
                        signals.push({ freq: product, amp: SIGNAL_CONFIG.threeTone.amp, type: '3-Tone', data: { product, sources: [validFreqs[i], validFreqs[j], validFreqs[k]] } });
                    }
                }
            }
        }
        calculatedSignals.current = signals;
    }, [frequencies]);

    const handleScroll = (direction: 'left' | 'right') => {
        const step = parseFloat(centerStepMhz) || 1.0;
        const shift = direction === 'left' ? -step : step;
        setRange(currentRange => ({ 
            min: parseFloat((currentRange.min + shift).toFixed(4)), 
            max: parseFloat((currentRange.max + shift).toFixed(4)) 
        }));
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
        } else {
            // Restore current state if input is invalid
            setCenterFreqInput(((range.min + range.max) / 2).toFixed(4));
        }
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (e.button !== 0) return;
        setIsDragging(true);
        setDragState({
            startX: e.clientX,
            startMin: range.min,
            startMax: range.max
        });
        (e.target as Element).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDragging || !dragState || !canvasRef.current) {
            handleHoverTooltip(e);
            return;
        }
        const deltaX = e.clientX - dragState.startX;
        const canvasWidth = canvasRef.current.clientWidth;
        const span = dragState.startMax - dragState.startMin;
        const freqShift = (deltaX / canvasWidth) * span;
        setRange({
            min: parseFloat((dragState.startMin - freqShift).toFixed(5)),
            max: parseFloat((dragState.startMax - freqShift).toFixed(5))
        });
        setTooltip(null);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
        setIsDragging(false);
        setDragState(null);
        (e.target as Element).releasePointerCapture(e.pointerId);
    };

    const handleHoverTooltip = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const padding = { top: 60, left: 45, right: 15 };
        const chartWidth = canvas.width - padding.left - padding.right;
        const x = event.clientX - rect.left; 
        const y = event.clientY - rect.top;
        const mouseFreq = range.min + ((x - padding.left) / chartWidth) * (range.max - range.min);
        const threshold = (8 / chartWidth) * (range.max - range.min);
        let closestSig: SignalPoint | null = null;
        let minDist = Infinity;
        const visibleSignals = calculatedSignals.current.filter(s => (s.type === 'Fundamental' || (s.type === '2-Tone' && showTwoTone) || (s.type === '3-Tone' && showThreeTone)));
        for (const sig of visibleSignals) {
            const dist = Math.abs(sig.freq - mouseFreq);
            const adjustedDist = sig.type === 'Fundamental' ? dist * 0.5 : dist;
            if (dist < threshold && adjustedDist < minDist) { minDist = adjustedDist; closestSig = sig; }
        }
        if (closestSig) {
            const snapX = padding.left + ((closestSig.freq - range.min) / (range.max - range.min)) * chartWidth;
            let content = closestSig.type === 'Fundamental' ? (
                <div className="text-xs">
                    <div className="font-bold text-yellow-400">{closestSig.data.label || closestSig.data.id}</div>
                    {closestSig.data.label && <div className="text-[10px] text-slate-400">ID: {closestSig.data.id}</div>}
                    <div>{closestSig.freq.toFixed(3)} MHz</div>
                </div>
            ) : (
                <div className="text-xs"><div className={`font-bold ${closestSig.type === '2-Tone' ? 'text-red-400' : 'text-purple-400'}`}>{closestSig.type} IMD</div><div>Src: {closestSig.data.sources.map((s: Frequency) => (s.label || s.id)).join(', ')}</div><div>Prod: {closestSig.freq.toFixed(5)} MHz</div></div>
            );
            setTooltip({ content, x: snapX, y });
        } else setTooltip(null);
    };

    const binnedScanData = useMemo(() => {
        const canvas = canvasRef.current;
        if (!scanData || !canvas) return null;
        const chartWidth = canvas.width - 60;
        if (chartWidth <= 0) return null;
        const binnedData: (number | null)[] = new Array(chartWidth).fill(null);
        if (scanData.length === 0) return binnedData;
        const startIndex = scanData.findIndex(p => p.freq >= range.min);
        if (startIndex === -1 && scanData[scanData.length - 1].freq < range.min) return binnedData;
        const viewSpan = range.max - range.min;
        for (let i = (startIndex === -1 ? 0 : startIndex); i < scanData.length; i++) {
            const point = scanData[i];
            if (point.freq > range.max) break;
            const x = Math.floor(((point.freq - range.min) / viewSpan) * chartWidth);
            if (x >= 0 && x < chartWidth) { if (binnedData[x] === null || point.amp > binnedData[x]!) binnedData[x] = point.amp; }
        }
        let lastVal = -100;
        for(let i=0; i<chartWidth; i++) { if (binnedData[i] === null) binnedData[i] = lastVal; else lastVal = binnedData[i]!; }
        return binnedData;
    }, [scanData, range, canvasRef.current?.width]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;
        let animationFrameId: number;
        const render = () => {
            const { width, height } = canvas;
            const padding = { top: 60, right: 15, bottom: 55, left: 45 };
            const chartWidth = width - padding.left - padding.right;
            const chartHeight = height - padding.top - padding.bottom;
            const maxDb = 0, minDb = -110, dbRange = maxDb - minDb;
            const freqToX = (freq: number) => padding.left + ((freq - range.min) / (range.max - range.min)) * chartWidth;
            const ampToY = (amp: number) => padding.top + chartHeight * (1 - ((Math.max(minDb, Math.min(maxDb, amp))) - minDb) / dbRange);
            ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, width, height);
            ctx.lineWidth = 1; ctx.font = `10px "Roboto Mono", monospace`;
            for (let i = 0; i <= 10; i++) {
                const amp = maxDb - i * 10; if (amp < minDb) break;
                const y = ampToY(amp); ctx.strokeStyle = i === 0 ? 'rgba(255,255,255,0.1)' : SIGNAL_CONFIG.gridMajor; ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(width - padding.right, y); ctx.stroke(); ctx.fillStyle = SIGNAL_CONFIG.fontColor; ctx.textAlign = 'right'; ctx.fillText(`${amp}`, padding.left - 5, y + 3);
            }
            const freqRange = range.max - range.min; const numVertLines = Math.max(2, Math.min(12, Math.floor(chartWidth / 60)));
            for (let i = 0; i <= numVertLines; i++) { const freq = range.min + i * (freqRange / numVertLines); const x = freqToX(freq); ctx.strokeStyle = SIGNAL_CONFIG.gridMajor; ctx.beginPath(); ctx.moveTo(x, padding.top); ctx.lineTo(x, height - padding.bottom); ctx.stroke(); ctx.fillStyle = SIGNAL_CONFIG.fontColor; ctx.textAlign = 'center'; ctx.fillText(`${freq.toFixed(freqRange < 2 ? 3 : freqRange < 10 ? 2 : 1)}`, x, height - padding.bottom + 15); }
            if (overlayChannels) {
                const tvChannels = region === 'uk' ? UK_TV_CHANNELS : US_TV_CHANNELS; ctx.textAlign = 'left';
                Object.entries(tvChannels).forEach(([ch, [start, end]]) => { if (end >= range.min && start <= range.max) { const xStart = Math.max(padding.left, freqToX(start)); const xEnd = Math.min(width - padding.right, freqToX(end)); if (xEnd > xStart) { ctx.fillStyle = 'rgba(59, 130, 246, 0.08)'; ctx.fillRect(xStart, padding.top, xEnd - xStart, chartHeight); ctx.fillStyle = 'rgba(96, 165, 250, 0.5)'; ctx.fillText(`CH ${ch}`, xStart + 4, padding.top + 12); } } });
            }
            if (wmasState && wmasState.nodes) {
                ctx.textAlign = 'left';
                wmasState.nodes.forEach(node => {
                    if (selectedWmasIds && !selectedWmasIds.has(node.id)) return;
                    
                    if (node.assignedBlock && node.assignedBlock.end >= range.min && node.assignedBlock.start <= range.max) {
                        const xS = Math.max(padding.left, freqToX(node.assignedBlock.start));
                        const xE = Math.min(width - padding.right, freqToX(node.assignedBlock.end));
                        if (xE > xS) {
                            ctx.fillStyle = 'rgba(168, 85, 247, 0.15)';
                            ctx.fillRect(xS, padding.top, xE - xS, chartHeight);
                            
                            ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
                            ctx.lineWidth = 1;
                            ctx.strokeRect(xS, padding.top, xE - xS, chartHeight);

                            ctx.fillStyle = 'rgba(192, 132, 252, 1)';
                            ctx.font = 'bold 10px sans-serif';
                            let label = `WMAS: ${node.name}`;
                            if (node.actName) label += ` (${node.actName})`;
                            if (node.stage) label += ` @ ${node.stage}`;
                            ctx.fillText(label, xS + 4, padding.top + 24);
                        }
                    }
                });
            }
            if (binnedScanData) {
                ctx.beginPath(); ctx.lineWidth = SIGNAL_CONFIG.scanData.width; ctx.strokeStyle = SIGNAL_CONFIG.scanData.color; let started = false;
                for (let i = 0; i < binnedScanData.length; i++) { const val = binnedScanData[i]; if (val !== null) { const x = padding.left + i; const y = ampToY(val); if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y); } }
                ctx.stroke();
            }
            const drawSignalStick = (sig: SignalPoint, config: any) => { if (sig.freq < range.min || sig.freq > range.max) return; const x = Math.floor(freqToX(sig.freq)) + 0.5; const y = ampToY(sig.amp); const bottomY = height - padding.bottom; ctx.strokeStyle = config.color; ctx.lineWidth = config.width; ctx.beginPath(); ctx.moveTo(x, bottomY); ctx.lineTo(x, y); ctx.stroke(); ctx.fillStyle = config.color; ctx.beginPath(); ctx.arc(x, y, config.width + 1, 0, Math.PI * 2); ctx.fill(); };
            calculatedSignals.current.forEach(sig => { if (sig.type === '3-Tone' && showThreeTone) drawSignalStick(sig, SIGNAL_CONFIG.threeTone); });
            calculatedSignals.current.forEach(sig => { if (sig.type === '2-Tone' && showTwoTone) drawSignalStick(sig, SIGNAL_CONFIG.twoTone); });
            calculatedSignals.current.forEach(sig => {
                if (sig.type === 'Fundamental') {
                    if (sig.data.type === 'wmas') {
                        let bw = 6;
                        if (sig.data.equipmentKey && sig.data.equipmentKey.includes('8mhz')) bw = 8;
                        const halfBw = bw / 2;
                        const startFreq = sig.freq - halfBw;
                        const endFreq = sig.freq + halfBw;
                        
                        if (endFreq >= range.min && startFreq <= range.max) {
                            const xS = Math.max(padding.left, freqToX(startFreq));
                            const xE = Math.min(width - padding.right, freqToX(endFreq));
                            if (xE > xS) {
                                ctx.fillStyle = 'rgba(168, 85, 247, 0.2)';
                                ctx.fillRect(xS, padding.top, xE - xS, chartHeight);
                                ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
                                ctx.lineWidth = 1;
                                ctx.strokeRect(xS, padding.top, xE - xS, chartHeight);
                                if (showLabels) {
                                    ctx.fillStyle = '#d8b4fe';
                                    ctx.textAlign = 'center';
                                    ctx.font = 'bold 9px sans-serif';
                                    ctx.fillText(`WMAS`, (xS + xE) / 2, padding.top + 20);
                                }
                            }
                        }
                    } else {
                        const config = sig.data.type === 'iem' ? SIGNAL_CONFIG.fundamentalIEM : SIGNAL_CONFIG.fundamental; 
                        drawSignalStick(sig, config);
                        if (showLabels && sig.freq >= range.min && sig.freq <= range.max) { const x = freqToX(sig.freq); const y = ampToY(sig.amp); ctx.save(); ctx.translate(x, y - 8); ctx.rotate(-Math.PI / 4); ctx.fillStyle = config.color; ctx.textAlign = 'left'; ctx.font = 'bold 10px sans-serif'; ctx.fillText(sig.data.label || sig.data.id, 0, 0); ctx.restore(); }
                    }
                }
            });
            ctx.fillStyle = SIGNAL_CONFIG.fontColor; ctx.font = '10px "Roboto Mono", monospace';
            const labelY = height - 12; ctx.textAlign = 'left'; ctx.fillText(`CENTER ${((range.min + range.max) / 2).toFixed(3)} MHz`, padding.left, labelY); ctx.textAlign = 'center'; ctx.fillText(`SPAN ${(range.max - range.min).toFixed(3)} MHz`, width / 2, labelY); ctx.textAlign = 'right'; ctx.fillText(`RBW 30 kHz`, width - padding.right, labelY);
        };
        const rafCallback = () => { render(); if (isRunning) animationFrameId = requestAnimationFrame(rafCallback); };
        if (isRunning) animationFrameId = requestAnimationFrame(rafCallback); else render();
        return () => cancelAnimationFrame(animationFrameId);
    }, [isRunning, range, overlayChannels, region, binnedScanData, showTwoTone, showThreeTone, showLabels, wmasState, selectedWmasIds]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if(canvas) {
            const resizeObserver = new ResizeObserver(() => { canvas.width = canvas.offsetWidth; canvas.height = 500; });
            resizeObserver.observe(canvas); return () => resizeObserver.disconnect();
        }
    }, []);

    return (
        <Card fullWidth>
            <CardTitle>{title}</CardTitle>
            
            <div className="bg-slate-900/50 p-3 rounded-lg mb-3 space-y-3">
                <div className="flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex gap-2">
                        {onImportGenerator && <button onClick={onImportGenerator} disabled={!canImportGenerator} className={`${actionButton} border border-cyan-600/50`}>📥 Import Generator</button>}
                        {onImportMultiBand && <button onClick={onImportMultiBand} disabled={!canImportMultiBand} className={`${multiBandButton} border border-teal-600/50`}>📥 Import Multi-Band</button>}
                        <button onClick={() => setIsRunning(!isRunning)} className={isRunning ? dangerButton : primaryButton}>{isRunning ? 'Stop Trace' : 'Start Trace'}</button>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 bg-slate-800/80 p-2 rounded-xl border border-slate-700">
                        <div className="flex gap-4 pr-4 border-r border-slate-700/50">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input type="checkbox" checked={showLabels} onChange={e => setShowLabels(e.target.checked)} className="w-4 h-4 rounded accent-indigo-500 bg-slate-700" />
                                <span className="text-[10px] text-slate-400 font-bold uppercase group-hover:text-white transition-colors">Labels</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input type="checkbox" checked={showTwoTone} onChange={e => setShowTwoTone(e.target.checked)} className="w-4 h-4 rounded accent-red-500 bg-slate-700" />
                                <span className="text-[10px] text-slate-400 font-bold uppercase group-hover:text-white transition-colors">2-Tone</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input type="checkbox" checked={showThreeTone} onChange={e => setShowThreeTone(e.target.checked)} className="w-4 h-4 rounded accent-purple-500 bg-slate-700" />
                                <span className="text-[10px] text-slate-400 font-bold uppercase group-hover:text-white transition-colors">3-Tone</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input type="checkbox" checked={overlayChannels} onChange={e => setOverlayChannels(e.target.checked)} className="w-4 h-4 rounded accent-blue-500 bg-slate-700" />
                                <span className="text-[10px] text-slate-400 font-bold uppercase group-hover:text-white transition-colors">TV</span>
                            </label>
                        </div>
                        
                        <div className="flex items-center gap-2 pr-4 border-r border-slate-700/50">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Center</span>
                            <div className="flex items-center bg-slate-700 rounded-lg p-0.5 border border-slate-600 shadow-inner">
                                <button onClick={() => handleScroll('left')} className="p-1.5 px-2.5 rounded bg-slate-600/50 text-slate-300 hover:bg-slate-500 transition-colors text-xs font-bold">&larr;</button>
                                <input 
                                    type="text" 
                                    value={centerFreqInput} 
                                    onChange={e => setCenterFreqInput(e.target.value)} 
                                    onFocus={() => { isCenterFreqFocused.current = true; }}
                                    onBlur={e => { isCenterFreqFocused.current = false; applyCenterFreq(e.target.value); }} 
                                    onKeyDown={e => e.key === 'Enter' && applyCenterFreq(e.currentTarget.value)} 
                                    className="w-20 bg-transparent text-white font-mono text-[10px] text-center font-bold outline-none focus:text-cyan-400" 
                                    placeholder="0.0000" 
                                />
                                <button onClick={() => handleScroll('right')} className="p-1.5 px-2.5 rounded bg-slate-600/50 text-slate-300 hover:bg-slate-500 transition-colors text-xs font-bold">&rarr;</button>
                            </div>
                            <div className="flex items-center gap-1.5 bg-slate-700/50 px-2 py-1.5 rounded-lg border border-slate-600/50">
                                <span className="text-[8px] text-slate-500 font-black uppercase">Step</span>
                                <button onClick={() => handleCenterStepSizeChange('down')} className="text-slate-400 hover:text-white transition-colors">▼</button>
                                <span className="text-[10px] font-mono text-indigo-300 w-8 text-center font-bold">{centerStepMhz}</span>
                                <button onClick={() => handleCenterStepSizeChange('up')} className="text-slate-400 hover:text-white transition-colors">▲</button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Span</span>
                            <div className="flex items-center bg-slate-700 rounded-lg p-0.5 border border-slate-600 shadow-inner">
                                <button onClick={() => handleSpanChange('decrease')} className="px-2 py-1 text-white rounded text-[10px] font-black hover:bg-slate-500 transition-colors">-</button>
                                <span className="text-[10px] text-cyan-400 font-mono w-16 text-center font-black">{(range.max - range.min).toFixed(1)}M</span>
                                <button onClick={() => handleSpanChange('increase')} className="px-2 py-1 text-white rounded text-[10px] font-black hover:bg-slate-500 transition-colors">+</button>
                            </div>
                            <div className="flex items-center gap-1.5 bg-slate-700/50 px-2 py-1.5 rounded-lg border border-slate-600/50">
                                <span className="text-[8px] text-slate-500 font-black uppercase">Step</span>
                                <button onClick={() => handleSpanStepSizeChange('down')} className="text-slate-400 hover:text-white transition-colors">▼</button>
                                <span className="text-[10px] font-mono text-indigo-300 w-8 text-center font-bold">{spanIncrementMhz}</span>
                                <button onClick={() => handleSpanStepSizeChange('up')} className="text-slate-400 hover:text-white transition-colors">▲</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative w-full h-[500px] bg-black rounded-lg border border-indigo-500/30 overflow-hidden shadow-inner">
                {tooltip && (
                    <div 
                        className="absolute z-20 p-2.5 text-white bg-slate-800/95 border border-indigo-400/50 rounded-lg shadow-xl pointer-events-none backdrop-blur-sm" 
                        style={{ 
                            left: tooltip.x - 12, 
                            top: tooltip.y + 12,
                            transform: 'translateX(-100%)' 
                        }}
                    >
                        {tooltip.content}
                    </div>
                )}
                <canvas 
                    ref={canvasRef} 
                    className={`w-full h-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                />
            </div>
        </Card>
    );
};

export default SpectrumVisualizer;