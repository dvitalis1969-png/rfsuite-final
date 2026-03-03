import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Frequency, ScanDataPoint, WMASState } from '../types';
import Card, { CardTitle } from './Card';
import { US_TV_CHANNELS, UK_TV_CHANNELS } from '../constants';

interface WaterfallTabProps {
    analyzerFrequencies: Frequency[];
    generatorFrequencies: Frequency[] | null;
    scanData: ScanDataPoint[] | null;
    wmasState?: WMASState;
}

const buttonBase = "w-full px-4 py-2.5 rounded-lg font-semibold uppercase tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transform active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed";
const primaryButton = `bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-b-4 border-blue-800 hover:border-blue-700 hover:brightness-110 ${buttonBase}`;
const dangerButton = `bg-gradient-to-r from-red-500 to-rose-500 text-white border-b-4 border-red-800 hover:border-red-700 hover:brightness-110 ${buttonBase}`;
const secondaryButton = `bg-slate-700 text-slate-200 border-b-4 border-slate-900 hover:border-slate-800 hover:bg-slate-600 ${buttonBase}`;
const successButton = `bg-gradient-to-r from-emerald-500 to-green-500 text-white border-b-4 border-emerald-800 hover:border-emerald-700 hover:brightness-110 ${buttonBase}`;

const WaterfallTab: React.FC<WaterfallTabProps> = ({ analyzerFrequencies, generatorFrequencies, scanData, wmasState }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [freqs, setFreqs] = useState<Frequency[]>([]);
    const [range, setRange] = useState({ min: 470, max: 700 });
    const [updateRate, setUpdateRate] = useState(100);
    const [colorScheme, setColorScheme] = useState('thermal');
    const [overlayChannels, setOverlayChannels] = useState(true);
    const [region, setRegion] = useState('uk');

    const loadAnalyzerFreqs = useCallback(() => {
        if (analyzerFrequencies.filter(f=>f.value > 0).length === 0) {
            alert('No frequencies loaded in the Analyzer tab.');
            return;
        }
        setFreqs(analyzerFrequencies);
        const values = analyzerFrequencies.filter(f=>f.value > 0).map(f => f.value);
        const min = Math.floor(Math.min(...values) - 10);
        const max = Math.ceil(Math.max(...values) + 10);
        setRange({ min, max });
    }, [analyzerFrequencies]);
    
    const loadGeneratorFreqs = useCallback(() => {
        if (!generatorFrequencies || generatorFrequencies.length === 0) {
            alert('No frequencies available from the Generator tab. Please generate a list first.');
            return;
        }
        setFreqs(generatorFrequencies);
        const values = generatorFrequencies.map(f => f.value);
        const min = Math.floor(Math.min(...values) - 10);
        const max = Math.ceil(Math.max(...values) + 10);
        setRange({ min, max });
    }, [generatorFrequencies]);

    const clearWaterfall = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, []);

    const binnedScanData = useMemo(() => {
        const canvas = canvasRef.current;
        if (!scanData || !canvas) return null;
        const width = canvas.width;
        if (width === 0) return null;
    
        const bins: (number | null)[] = new Array(width).fill(null);
        const freqStep = (range.max - range.min) / width;
    
        let currentBinIndex = -1;
        let maxAmpInBin = -Infinity;
    
        for (const point of scanData) {
            if (point.freq < range.min || point.freq > range.max) continue;
            const binIndex = Math.floor((point.freq - range.min) / freqStep);
            
            if (binIndex !== currentBinIndex) {
                if (currentBinIndex !== -1 && maxAmpInBin > -Infinity) {
                    bins[currentBinIndex] = maxAmpInBin;
                }
                currentBinIndex = binIndex;
                maxAmpInBin = -Infinity;
            }
            maxAmpInBin = Math.max(maxAmpInBin, point.amp);
        }
        if (currentBinIndex !== -1 && maxAmpInBin > -Infinity) {
            bins[currentBinIndex] = maxAmpInBin;
        }
        return bins;
    }, [scanData, range, canvasRef.current?.width]);
    

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        let intervalId: number;

        const getWaterfallColor = (intensity: number, isIEM: boolean) => {
            intensity = Math.max(0, Math.min(1, intensity));
            if (isIEM && intensity > 0.5) {
                return `hsl( ${60 - intensity * 60}, 100%, ${50 + intensity * 25}%)`;
            }
            if (colorScheme === 'thermal') return `hsl( ${240 - intensity * 240}, 100%, ${intensity * 50}%)`;
            if (colorScheme === 'rainbow') return `hsl(${(1-intensity)*240}, 100%, 50%)`;
            if (colorScheme === 'grayscale') return `rgb(${Math.floor(intensity*255)},${Math.floor(intensity*255)},${Math.floor(intensity*255)})`;
            return `rgb(${Math.floor(intensity*100)}, ${Math.floor(intensity*150)}, ${Math.floor(100 + intensity*155)})`;
        };

        const render = () => {
            const { width, height } = canvas;
            if (width === 0 || height === 0) return;
            ctx.drawImage(canvas, 0, 0, width, height-1, 0, 1, width, height-1);
            
            const SIGNAL_BANDWIDTH = 0.200;
            const validFreqs = freqs.filter(f => f.value > 0);

            for (let x = 0; x < width; x++) {
                let intensity: number;
                let isIEM = false;

                if (binnedScanData) {
                    const amp = binnedScanData[x];
                    intensity = amp !== null ? Math.max(0, (amp + 100) / 100) : 0.05;
                } else {
                    const freqAtPixel = range.min + (x / width) * (range.max - range.min);
                    let simIntensity = 0.05 + Math.random() * 0.05;
                    validFreqs.forEach(f => {
                        let bw = SIGNAL_BANDWIDTH;
                        if (f.type === 'wmas') {
                            bw = 6;
                            if (f.equipmentKey && f.equipmentKey.includes('8mhz')) bw = 8;
                        }
                        if (Math.abs(f.value - freqAtPixel) <= bw / 2) {
                            simIntensity = Math.max(simIntensity, 0.95);
                             if (f.type === 'iem') {
                                isIEM = true;
                            }
                        }
                    });
                    intensity = simIntensity;
                }

                ctx.fillStyle = getWaterfallColor(intensity, isIEM);
                ctx.fillRect(x, 0, 1, 1);
            }
        };

        if (isRunning) intervalId = window.setInterval(render, updateRate);
        return () => clearInterval(intervalId);
    }, [isRunning, freqs, range, updateRate, colorScheme, binnedScanData]);
    
     useEffect(() => {
        const overlay = overlayRef.current;
        if (!overlay) return;
        const ctx = overlay.getContext('2d');
        if (!ctx) return;
        const { width, height } = overlay;
        ctx.clearRect(0, 0, width, height);

        if (!overlayChannels) return;

        const freqToX = (freq: number) => ((freq - range.min) / (range.max - range.min)) * width;
        const tvChannels = region === 'uk' ? UK_TV_CHANNELS : US_TV_CHANNELS;
        
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        Object.entries(tvChannels).forEach(([ch, [start, end]]) => {
            if (end >= range.min && start <= range.max) {
                const xStart = freqToX(start);
                const xEnd = freqToX(end);
                
                ctx.fillStyle = 'rgba(51, 65, 85, 0.5)'; 
                if (xEnd > xStart + 2) {
                    ctx.fillRect(xStart + 1, 4, xEnd - xStart - 2, height - 8);
                }

                ctx.fillStyle = '#e2e8f0'; 
                ctx.fillText(`CH ${ch}`, (xStart + xEnd) / 2, height / 2);
                
                ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
                ctx.beginPath();
                ctx.moveTo(xStart, height * 0.2);
                ctx.lineTo(xStart, height * 0.8);
                ctx.moveTo(xEnd, height * 0.2);
                ctx.lineTo(xEnd, height * 0.8);
                ctx.stroke();
            }
        });

        if (wmasState && wmasState.nodes) {
            wmasState.nodes.forEach(node => {
                if (node.assignedBlock && node.assignedBlock.end >= range.min && node.assignedBlock.start <= range.max) {
                    const xStart = freqToX(node.assignedBlock.start);
                    const xEnd = freqToX(node.assignedBlock.end);
                    
                    ctx.fillStyle = 'rgba(168, 85, 247, 0.3)';
                    if (xEnd > xStart + 2) {
                        ctx.fillRect(xStart + 1, 4, xEnd - xStart - 2, height - 8);
                    }
                    
                    ctx.fillStyle = '#f5f3ff';
                    ctx.font = 'bold 9px sans-serif';
                    ctx.fillText(`WMAS`, (xStart + xEnd) / 2, height / 2);
                }
            });
        }
    }, [overlayChannels, region, range, wmasState]);
    
    useEffect(() => {
        const canvases = [canvasRef.current, overlayRef.current];
        let observer: ResizeObserver;
        if(canvases[0] && canvases[1]) {
            observer = new ResizeObserver(() => {
                canvases.forEach(canvas => {
                    if (canvas) {
                        canvas.width = canvas.offsetWidth;
                        canvas.height = canvas.id === 'waterfall-canvas' ? 400 : 30;
                    }
                });
                clearWaterfall();
            });
            observer.observe(canvases[0]);
            return () => observer.disconnect();
        }
    },[clearWaterfall]);


    return (
        <Card fullWidth>
            <CardTitle>🌊 Waterfall Display</CardTitle>
            <p className="text-slate-300 mb-4 text-sm">
                Visualizes RF energy over time. Import scan data from the Spectrum tab for real-world analysis.
            </p>
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 p-4 bg-slate-900/50 rounded-lg mb-4">
                <button onClick={() => setIsRunning(true)} disabled={isRunning} className={primaryButton}>▶️ START</button>
                <button onClick={() => setIsRunning(false)} disabled={!isRunning} className={dangerButton}>⏹️ STOP</button>
                <button onClick={clearWaterfall} className={secondaryButton}>🧹 CLEAR</button>
                <button onClick={loadAnalyzerFreqs} className={successButton}>📥 Load from Analyzer</button>
                <button onClick={loadGeneratorFreqs} className={successButton}>📥 Load from Generator</button>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-900/50 rounded-lg mb-4">
                 <div>
                    <label className="text-slate-300 text-sm mb-1 block">Frequency Range (MHz)</label>
                    <div className="flex gap-2">
                        <input type="number" value={range.min} onChange={e => setRange(r => ({...r, min: Number(e.target.value)}))} className="w-full bg-slate-900/60 border border-blue-500/30 rounded-md p-2 text-slate-200" placeholder="Min" />
                        <input type="number" value={range.max} onChange={e => setRange(r => ({...r, max: Number(e.target.value)}))} className="w-full bg-slate-900/60 border border-blue-500/30 rounded-md p-2 text-slate-200" placeholder="Max" />
                    </div>
                </div>
                 <div>
                    <label className="text-slate-300 text-sm mb-1 block">Update Rate: {updateRate}ms</label>
                    <input type="range" min="50" max="500" value={updateRate} onChange={e => setUpdateRate(Number(e.target.value))} className="w-full" />
                </div>
                <div>
                    <label className="text-slate-300 text-sm mb-1 block">Color Scheme</label>
                    <select value={colorScheme} onChange={e => setColorScheme(e.target.value)} className="w-full bg-slate-900/60 border border-blue-500/30 rounded-md p-2 text-slate-200">
                        <option value="thermal">Thermal</option>
                        <option value="rainbow">Rainbow</option>
                        <option value="grayscale">Grayscale</option>
                        <option value="ocean">Ocean</option>
                    </select>
                </div>
                 <div>
                    <label className="text-slate-300 text-sm mb-1 block">Overlay Region</label>
                    <select value={region} onChange={e => setRegion(e.target.value)} className="w-full bg-slate-900/60 border border-blue-500/30 rounded-md p-2 text-slate-200">
                        <option value="uk">United Kingdom</option>
                        <option value="us">United States</option>
                    </select>
                </div>
            </div>
             <label className="flex items-center gap-3 cursor-pointer p-4 pb-2">
                <input type="checkbox" checked={overlayChannels} onChange={e => setOverlayChannels(e.target.checked)} className="w-5 h-5 accent-blue-400" />
                <span className="text-slate-300 font-semibold">Overlay TV Channels</span>
            </label>
            <div className="flex flex-col">
                <canvas ref={overlayRef} id="waterfall-overlay" className="w-full h-[30px] bg-slate-800 rounded-t-lg border border-blue-500/30 border-b-0"></canvas>
                <canvas ref={canvasRef} id="waterfall-canvas" className="w-full h-[400px] bg-black rounded-b-lg border border-blue-500/30"></canvas>
            </div>
        </Card>
    );
};

export default React.memo(WaterfallTab);