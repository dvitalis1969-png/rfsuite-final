
import React, { useState, useRef, useEffect, useMemo } from 'react';
import Card, { CardTitle } from './Card';

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 500;
const SPECTRUM_HEIGHT = 220;
const BASE_NOISE_FLOOR = -105;
const MIXING_DIST_LIMIT = 40; // Meters where mixing becomes negligible

interface Station {
    id: string;
    freq: number;
    powerMw: number; // 10, 50, 250
    color: string;
    pos: { x: number, y: number };
}

interface IMDProduct {
    val: number;
    power: number;
    sources: string[];
    type: '2-Tone' | '3-Tone';
}

const TalkbackProximityTab: React.FC = () => {
    const [stations, setStations] = useState<Station[]>([
        { id: 'TX-1', freq: 457.250, powerMw: 50, color: '#fbbf24', pos: { x: 200, y: 150 } },
        { id: 'TX-2', freq: 457.450, powerMw: 50, color: '#38bdf8', pos: { x: 200, y: 350 } },
        { id: 'TX-3', freq: 458.125, powerMw: 10, color: '#10b981', pos: { x: 800, y: 250 } }
    ]);
    
    const [rxPos, setRxPos] = useState({ x: 500, y: 250 });
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [viewScale, setViewScale] = useState(4); // px per meter
    const [squelch, setSquelch] = useState(-90);
    const [isRunning, setIsRunning] = useState(true);

    const mapRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handlePointerDown = (id: string) => setDraggingId(id);
    const handlePointerUp = () => setDraggingId(null);
    
    const handlePointerMove = (e: React.PointerEvent) => {
        if (!draggingId || !mapRef.current) return;
        const rect = mapRef.current.getBoundingClientRect();
        const x = Math.max(20, Math.min(MAP_WIDTH - 20, e.clientX - rect.left));
        const y = Math.max(20, Math.min(MAP_HEIGHT - 20, e.clientY - rect.top));
        
        if (draggingId === 'RX') {
            setRxPos({ x, y });
        } else {
            setStations(prev => prev.map(s => s.id === draggingId ? { ...s, pos: { x, y } } : s));
        }
    };

    // Physics Engine
    const simData = useMemo(() => {
        // 1. Calculate Carrier Levels at RX
        const carriers = stations.map(s => {
            const dx = (s.pos.x - rxPos.x) / viewScale;
            const dy = (s.pos.y - rxPos.y) / viewScale;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Power at source (dBm)
            const pTxDbm = 10 * Math.log10(s.powerMw);
            // Inverse Square Law: -20log10(d)
            const pRx = pTxDbm - (20 * Math.log10(Math.max(0.1, dist)));
            
            return { ...s, dist, pRx };
        });

        // 2. Multi-Source IMD Logic (3rd Order: 2f1 - f2)
        // We check every pair for mixing potential
        const imds: IMDProduct[] = [];
        for (let i = 0; i < carriers.length; i++) {
            for (let j = 0; j < carriers.length; j++) {
                if (i === j) continue;
                const s1 = carriers[i];
                const s2 = carriers[j];
                
                // Distance between transmitters (Source Mixing)
                const dTx = Math.sqrt(Math.pow(s1.pos.x - s2.pos.x, 2) + Math.pow(s1.pos.y - s2.pos.y, 2)) / viewScale;
                
                // Mixing Efficiency (Source-side mixing in the rack/cables)
                const sourceMixingPotential = Math.max(0, 1 - (dTx / MIXING_DIST_LIMIT));
                
                // Receiver-side mixing (Saturation from strong inputs)
                const rxMixingPotential = (Math.max(0, (s1.pRx + 80) / 80) * Math.max(0, (s2.pRx + 80) / 80));

                const combinedMixing = Math.max(sourceMixingPotential, rxMixingPotential);
                
                if (combinedMixing > 0.05) {
                    const val = 2 * s1.freq - s2.freq;
                    // IMD power logic: 2*P1 + P2 - Offset (simplified)
                    // As carriers get stronger, IMD grows 3x faster
                    const imdPower = (s1.pRx * 0.6 + s2.pRx * 0.4) - (30 * (1 - combinedMixing));
                    
                    imds.push({
                        val,
                        power: Math.max(BASE_NOISE_FLOOR, imdPower),
                        sources: [s1.id, s2.id],
                        type: '2-Tone'
                    });
                }
            }
        }

        const highestInterference = imds.length > 0 ? Math.max(...imds.map(im => im.power)) : BASE_NOISE_FLOOR;
        const bestCarrier = carriers.length > 0 ? Math.max(...carriers.map(c => c.pRx)) : BASE_NOISE_FLOOR;
        const snr = bestCarrier - Math.max(squelch, highestInterference);

        return { carriers, imds, snr, interferenceLevel: highestInterference };
    }, [stations, rxPos, viewScale, squelch]);

    // Canvas Rendering
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        let rafId: number;
        const render = () => {
            const { width, height } = canvas;
            const pad = { top: 40, right: 30, bottom: 40, left: 60 };
            const chartW = width - pad.left - pad.right;
            const chartH = height - pad.top - pad.bottom;

            const minF = 456.0, maxF = 459.0, rangeF = maxF - minF;
            const minP = -110, maxP = 10, rangeP = maxP - minP;

            const fToX = (f: number) => pad.left + ((f - minF) / rangeF) * chartW;
            const pToY = (p: number) => pad.top + chartH * (1 - (p - minP) / rangeP);

            ctx.fillStyle = '#020617';
            ctx.fillRect(0, 0, width, height);

            // Grid
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 1;
            ctx.font = '10px monospace';
            ctx.textAlign = 'right';
            ctx.fillStyle = '#475569';
            for (let p = minP; p <= maxP; p += 20) {
                const y = pToY(p);
                ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
                ctx.fillText(`${p}`, pad.left - 8, y + 4);
            }
            ctx.textAlign = 'center';
            for (let f = minF; f <= maxF; f += 0.5) {
                const x = fToX(f);
                ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, height - pad.bottom); ctx.stroke();
                ctx.fillText(f.toFixed(1), x, height - pad.bottom + 15);
            }

            // Trace (Background Noise)
            ctx.beginPath();
            ctx.strokeStyle = '#0f172a';
            for (let x = 0; x < chartW; x++) {
                const noise = BASE_NOISE_FLOOR + (Math.random() * 4 - 2);
                if (x === 0) ctx.moveTo(pad.left + x, pToY(noise)); else ctx.lineTo(pad.left + x, pToY(noise));
            }
            ctx.stroke();

            // Squelch
            const sqY = pToY(squelch);
            ctx.strokeStyle = '#f43f5e';
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(pad.left, sqY); ctx.lineTo(width - pad.right, sqY); ctx.stroke();
            ctx.setLineDash([]);

            // Draw Peaks
            const drawPeak = (f: number, p: number, color: string, label: string, isImd: boolean) => {
                const x = fToX(f);
                const y = pToY(p);
                if (x < pad.left || x > width - pad.right) return;

                const jitter = isRunning ? (Math.random() * 1.5 - 0.75) : 0;
                
                const grad = ctx.createLinearGradient(0, y, 0, height - pad.bottom);
                grad.addColorStop(0, color + 'aa');
                grad.addColorStop(1, color + '00');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.moveTo(x - 20, height - pad.bottom);
                ctx.quadraticCurveTo(x, y + jitter, x + 20, height - pad.bottom);
                ctx.fill();

                ctx.strokeStyle = color;
                ctx.lineWidth = isImd ? 1 : 2;
                ctx.beginPath(); ctx.moveTo(x, height - pad.bottom); ctx.lineTo(x, y + jitter); ctx.stroke();

                ctx.fillStyle = color;
                ctx.font = `bold ${isImd ? '8px' : '10px'} sans-serif`;
                ctx.fillText(label, x, y - (isImd ? 12 : 18));
            };

            simData.imds.forEach(im => drawPeak(im.val, im.power, '#ef4444', 'IMD', true));
            simData.carriers.forEach(c => drawPeak(c.freq, c.pRx, c.color, c.id, false));

            if (isRunning) rafId = requestAnimationFrame(render);
        };
        render();
        return () => cancelAnimationFrame(rafId);
    }, [simData, squelch, isRunning]);

    const addStation = () => {
        const id = `TX-${stations.length + 1}`;
        const colors = ['#fbbf24', '#38bdf8', '#10b981', '#f472b6', '#a78bfa', '#f87171'];
        setStations([...stations, {
            id,
            freq: 457.250 + (stations.length * 0.2),
            powerMw: 50,
            color: colors[stations.length % colors.length],
            pos: { x: Math.random() * 800 + 100, y: Math.random() * 300 + 100 }
        }]);
    };

    const removeStation = (id: string) => setStations(stations.filter(s => s.id !== id));

    const updateStation = (id: string, field: keyof Station, val: any) => {
        setStations(stations.map(s => s.id === id ? { ...s, [field]: val } : s));
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar Controls */}
            <div className="lg:col-span-1 space-y-4">
                <Card className="!p-4 h-full flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-black text-xs uppercase tracking-widest text-indigo-400">Environment</h3>
                        <button onClick={addStation} className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-3 py-1 rounded-md transition-colors">+ ADD TX</button>
                    </div>

                    <div className="flex-grow overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                        {stations.map(s => (
                            <div key={s.id} className="bg-slate-900/80 border border-slate-700 p-3 rounded-xl space-y-2 group">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-xs" style={{ color: s.color }}>{s.id}</span>
                                    <button onClick={() => removeStation(s.id)} className="text-slate-600 hover:text-red-400 text-xs">&times;</button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[8px] text-slate-500 uppercase font-black block">Freq (MHz)</label>
                                        <input 
                                            type="number" step="0.025" value={s.freq} 
                                            onChange={e => updateStation(s.id, 'freq', parseFloat(e.target.value))}
                                            className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-[10px] font-mono text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[8px] text-slate-500 uppercase font-black block">Power (mW)</label>
                                        <select 
                                            value={s.powerMw} 
                                            onChange={e => updateStation(s.id, 'powerMw', parseInt(e.target.value))}
                                            className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-[10px] font-mono text-white"
                                        >
                                            <option value={10}>10mW</option>
                                            <option value={50}>50mW</option>
                                            <option value={250}>250mW</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-800 space-y-4">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] text-slate-500 uppercase font-black">Squelch Threshold</label>
                                <span className="text-xs font-mono text-rose-400">{squelch}dBm</span>
                            </div>
                            <input type="range" min="-110" max="-40" value={squelch} onChange={e => setSquelch(Number(e.target.value))} className="w-full accent-rose-500" />
                        </div>
                        
                        <div className="bg-black/40 p-4 rounded-xl border border-white/5 space-y-4">
                             <div className="flex justify-between items-center">
                                <span className="text-[9px] text-slate-500 uppercase font-black">Link SNR</span>
                                <span className={`text-xl font-mono font-black ${simData.snr > 20 ? 'text-emerald-400' : simData.snr > 10 ? 'text-amber-400' : 'text-rose-500'}`}>
                                    {Math.max(0, simData.snr).toFixed(1)} <span className="text-[10px]">dB</span>
                                </span>
                             </div>
                             <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className={`h-full transition-all duration-500 ${simData.snr > 20 ? 'bg-emerald-500' : simData.snr > 10 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, simData.snr * 2)}%` }} />
                             </div>
                             <p className="text-[9px] text-slate-500 text-center italic">
                                {simData.snr < 10 ? "⚠️ Squelch break risk" : "✓ Link is operational"}
                             </p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Main Interactive Stage */}
            <div className="lg:col-span-3 space-y-4">
                <Card className="!p-0 overflow-hidden relative">
                    <div 
                        ref={mapRef}
                        className="relative w-full bg-[#0a0f1e] cursor-crosshair touch-none"
                        style={{ height: MAP_HEIGHT }}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                    >
                        {/* Dynamic Grid */}
                        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: `radial-gradient(#38bdf8 1px, transparent 1px)`, backgroundSize: `${20 * viewScale}px ${20 * viewScale}px` }}></div>

                        {/* TX Interference Radii (Auras) */}
                        {stations.map(s => {
                            // Radius where signal hits -85dBm (typical squelch)
                            const txDbm = 10 * Math.log10(s.powerMw);
                            const radiusMeters = Math.pow(10, (txDbm + 85) / 20);
                            const radiusPx = radiusMeters * viewScale;
                            
                            return (
                                <div 
                                    key={`aura-${s.id}`}
                                    className="absolute rounded-full pointer-events-none transition-all duration-300 border border-dashed opacity-20"
                                    style={{
                                        width: radiusPx * 2,
                                        height: radiusPx * 2,
                                        left: s.pos.x - radiusPx,
                                        top: s.pos.y - radiusPx,
                                        borderColor: s.color,
                                        background: `radial-gradient(circle, ${s.color}22 0%, transparent 70%)`
                                    }}
                                />
                            );
                        })}

                        {/* Mixing Danger Zones (Where TX units are too close) */}
                        <svg className="absolute inset-0 pointer-events-none w-full h-full opacity-30">
                            {stations.map((s1, i) => stations.slice(i+1).map(s2 => {
                                const dist = Math.sqrt(Math.pow(s1.pos.x - s2.pos.x, 2) + Math.pow(s1.pos.y - s2.pos.y, 2)) / viewScale;
                                if (dist < MIXING_DIST_LIMIT) {
                                    return <line key={`${s1.id}-${s2.id}`} x1={s1.pos.x} y1={s1.pos.y} x2={s2.pos.x} y2={s2.pos.y} stroke="#ef4444" strokeWidth="4" strokeDasharray="4 4" />;
                                }
                                return null;
                            }))}
                        </svg>

                        {/* Station Icons */}
                        {stations.map(s => (
                            <div 
                                key={s.id}
                                onPointerDown={() => handlePointerDown(s.id)}
                                className={`absolute z-20 group cursor-grab active:cursor-grabbing transition-transform ${draggingId === s.id ? 'scale-110 shadow-2xl' : ''}`}
                                style={{ left: s.pos.x - 16, top: s.pos.y - 16 }}
                            >
                                <div className="flex flex-col items-center">
                                    <div className="w-8 h-8 rounded-lg bg-slate-800 border-2 flex items-center justify-center text-xs shadow-xl transition-colors" style={{ borderColor: s.color }}>
                                        🛰️
                                    </div>
                                    <div className="mt-1 bg-slate-950 px-1.5 py-0.5 rounded border border-white/10 text-[8px] font-black text-white uppercase shadow-lg">
                                        {s.id}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Reference Receiver Node */}
                        <div 
                            onPointerDown={() => handlePointerDown('RX')}
                            className={`absolute z-30 cursor-grab active:cursor-grabbing transition-all ${draggingId === 'RX' ? 'scale-125' : ''}`}
                            style={{ left: rxPos.x - 20, top: rxPos.y - 20 }}
                        >
                             <div className={`w-10 h-10 rounded-full border-2 flex flex-col items-center justify-center shadow-2xl transition-colors ${simData.snr < 10 ? 'bg-rose-600 border-rose-400 animate-pulse' : 'bg-indigo-600 border-indigo-400'}`}>
                                <span className="text-[10px] font-black text-white">RX</span>
                                <span className="text-[7px] text-white/70 font-bold">MONITOR</span>
                             </div>
                        </div>

                        {/* Telemetry HUD */}
                        <div className="absolute top-4 right-4 bg-slate-950/60 backdrop-blur-md border border-white/10 p-3 rounded-xl pointer-events-none min-w-[180px]">
                            <h5 className="text-[9px] font-black text-slate-500 uppercase mb-2">Live RX Telemetry</h5>
                            <div className="space-y-1.5">
                                {simData.carriers.map(c => (
                                    <div key={c.id} className="flex justify-between items-center text-[10px]">
                                        <span className="font-bold" style={{ color: c.color }}>{c.id}</span>
                                        <span className="text-slate-400 font-mono">{c.pRx.toFixed(1)} dBm</span>
                                    </div>
                                ))}
                                <div className="border-t border-white/5 mt-2 pt-1 flex justify-between items-center text-[10px]">
                                    <span className="text-red-400 font-black uppercase tracking-tighter">Peak IMD</span>
                                    <span className="text-red-400 font-mono">{simData.interferenceLevel.toFixed(1)} dBm</span>
                                </div>
                            </div>
                        </div>

                        <div className="absolute bottom-4 left-4 bg-black/40 px-3 py-1 rounded text-[10px] font-mono text-slate-500">
                             Physics Mode: Inverse Square Law (Free Space) + 3rd Order Mixing
                        </div>
                    </div>

                    <div className="border-t border-slate-800">
                        <canvas 
                            ref={canvasRef}
                            width={2000}
                            height={SPECTRUM_HEIGHT * 2}
                            className="w-full h-[220px] bg-[#020617]"
                        />
                    </div>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-indigo-500/20">
                         <h4 className="text-[11px] font-black text-indigo-300 uppercase mb-2 flex items-center gap-2">
                             <span>🧬</span> Harmonic Mixing Model
                         </h4>
                         <p className="text-[10px] text-slate-400 leading-relaxed italic">
                             IMD products are calculated using combinatorial analysis ($2f_1 - f_2$). Mixing efficiency is spatially weighted: sources closer to each other contribute more energy to the non-linear mixing stages.
                         </p>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-rose-500/20">
                         <h4 className="text-[11px] font-black text-rose-300 uppercase mb-2 flex items-center gap-2">
                             <span>📉</span> Path Loss Calculation
                         </h4>
                         <p className="text-[10px] text-slate-400 leading-relaxed italic">
                             Standard free-space loss of 6dB per doubling of distance is enforced. Squelch margin is computed by subtracting the highest spectral interference spike from the primary carrier level at the RX node.
                         </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TalkbackProximityTab;
