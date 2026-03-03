import React, { useState, useRef, useMemo, useEffect } from 'react';
import Card, { CardTitle } from './Card';

const InterferenceDemoTab: React.FC = () => {
    // Spatial state
    const [interfererPos, setInterfererPos] = useState({ x: 700, y: 300 });
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Dynamic Scale state: px per meter
    // Set to 3.0 to allow 75m (225px) to fit comfortably on screen alongside the receiver
    const [viewScale, setViewScale] = useState<number>(3);

    // RF state - Defaulting to 550.000 MHz
    const [wantedFreq, setWantedFreq] = useState(550.000);
    const [interfererFreq, setInterfererFreq] = useState(550.000);
    const [isWantedMicOn, setIsWantedMicOn] = useState(true);
    
    const offsetKhz = useMemo(() => Math.round(Math.abs(wantedFreq - interfererFreq) * 1000), [interfererFreq, wantedFreq]);

    // Set initial position to exactly 75m right of the receiver on mount
    useEffect(() => {
        if (containerRef.current) {
            const width = containerRef.current.clientWidth;
            const height = containerRef.current.clientHeight;
            const rx = width / 2;
            const ry = height / 2;
            
            // The user requested a default distance of 75m
            const targetDistMeters = 75;
            const targetDistPx = targetDistMeters * viewScale;
            
            // Place it to the right of the receiver. 
            // We use a slight vertical offset to keep it in the "Upper Right" quadrant
            // but prioritize the 75m horizontal distance.
            let posX = rx + targetDistPx;
            let posY = ry - 50; // Slightly above center line

            // Boundary safety: Ensure it's not off-screen
            const padding = 60;
            if (posX > width - padding) posX = width - padding;
            if (posY < padding) posY = padding;

            setInterfererPos({ x: posX, y: posY });
        }
    }, []);

    /**
     * AUTHORITATIVE PHYSICS DATA
     */
    const getInterferenceRadiusMeters = (offset: number): number => {
        // Table for Wanted Mic OFF (High sensitivity / Squelch break risk)
        const offData = [
            { offset: 0, dist: 500 },
            { offset: 50, dist: 400 },
            { offset: 100, dist: 320 },
            { offset: 125, dist: 220 },
            { offset: 150, dist: 70 },
            { offset: 175, dist: 25 },
            { offset: 200, dist: 2 },
            { offset: 350, dist: 0 }
        ];

        // Table for Wanted Mic ON (Robust capture effect)
        const onData = [
            { offset: 0, dist: 85 },
            { offset: 25, dist: 30 },
            { offset: 50, dist: 15 },
            { offset: 75, dist: 10 },
            { offset: 100, dist: 8 },
            { offset: 125, dist: 5 },
            { offset: 150, dist: 2 },
            { offset: 175, dist: 1 },
            { offset: 200, dist: 0 } 
        ];

        const activeTable = isWantedMicOn ? onData : offData;
        return interpolate(offset, activeTable);
    };

    const interpolate = (val: number, points: { offset: number, dist: number }[]): number => {
        if (val <= points[0].offset) return points[0].dist;
        if (val >= points[points.length - 1].offset) return points[points.length - 1].dist;

        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            if (val >= p1.offset && val <= p2.offset) {
                const ratio = (val - p1.offset) / (p2.offset - p1.offset);
                return p1.dist + ratio * (p2.dist - p1.dist);
            }
        }
        return 0;
    };

    const interferenceRadiusMeters = useMemo(() => getInterferenceRadiusMeters(offsetKhz), [offsetKhz, isWantedMicOn]);
    const interferenceRadiusPixels = interferenceRadiusMeters * viewScale;

    // Receiver position (Centered)
    const receiverPos = useMemo(() => {
        if (!containerRef.current) return { x: 450, y: 325 };
        return { 
            x: containerRef.current.clientWidth / 2, 
            y: containerRef.current.clientHeight / 2 
        };
    }, [containerRef.current?.clientWidth, containerRef.current?.clientHeight]);

    const distancePixels = useMemo(() => {
        const dx = interfererPos.x - receiverPos.x;
        const dy = interfererPos.y - receiverPos.y;
        return Math.sqrt(dx * dx + dy * dy);
    }, [interfererPos, receiverPos]);

    const distanceMeters = distancePixels / viewScale;
    const isInterfering = distanceMeters <= interferenceRadiusMeters;

    const updatePosition = (clientX: number, clientY: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        setInterfererPos({
            x: Math.max(0, Math.min(clientX - rect.left, rect.width)),
            y: Math.max(0, Math.min(clientY - rect.top, rect.height))
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        updatePosition(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        updatePosition(touch.clientX, touch.clientY);
    };

    const stepFreq = (dir: 'up' | 'down') => {
        const step = 0.025; 
        setInterfererFreq(prev => parseFloat((dir === 'up' ? prev + step : prev - step).toFixed(3)));
    };

    const stepWantedFreq = (dir: 'up' | 'down') => {
        const step = 0.025; 
        setWantedFreq(prev => parseFloat((dir === 'up' ? prev + step : prev - step).toFixed(3)));
    };

    const handleZoom = (type: 'in' | 'out') => {
        setViewScale(prev => {
            const factor = type === 'in' ? 1.2 : 0.8;
            const next = prev * factor;
            return Math.max(0.2, Math.min(25, next));
        });
    };

    return (
        <div className="space-y-4">
            <Card fullWidth>
                <CardTitle>📡 Authoritative Co-Channel Sandbox</CardTitle>
                <p className="text-slate-300 mb-6 text-sm">
                    Interact with spatial placement and carrier capture effects. This simulator models <strong>Co-Channel and frequency offset Interference</strong> boundaries.
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-1 space-y-4">
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Controls</h4>
                            
                            <div className="space-y-6">
                                <div>
                                    <label className="text-xs text-slate-400 block mb-2 font-bold uppercase">View Zoom</label>
                                    <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 gap-1">
                                        <button onClick={() => handleZoom('out')} className="flex-1 py-1.5 text-lg font-bold rounded bg-slate-700 hover:bg-slate-600">-</button>
                                        <div className="flex-[2] flex items-center justify-center text-[10px] font-mono text-indigo-300">{viewScale.toFixed(2)} px/m</div>
                                        <button onClick={() => handleZoom('in')} className="flex-1 py-1.5 text-lg font-bold rounded bg-slate-700 hover:bg-slate-600">+</button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-3 bg-slate-800/80 rounded-lg border border-white/5">
                                        <label className="flex items-center justify-between cursor-pointer group">
                                            <span className="text-xs text-slate-400 uppercase font-black tracking-tighter">Wanted Mic Power</span>
                                            <div 
                                                onClick={() => setIsWantedMicOn(!isWantedMicOn)}
                                                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${isWantedMicOn ? 'bg-emerald-500' : 'bg-slate-600'}`}
                                            >
                                                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isWantedMicOn ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </div>
                                        </label>
                                        <p className="text-[9px] text-slate-500 mt-2 italic leading-tight">
                                            {isWantedMicOn ? "Carrier Present: Using ON-mode protection table." : "Squelch Mode: Using OFF-mode sensitivity table."}
                                        </p>
                                    </div>

                                    {/* Interferer to Receiver Distance Box */}
                                    <div>
                                        <label className="text-xs text-slate-400 uppercase font-bold mb-1 block">Interferer to Rx</label>
                                        <div className="text-center font-mono text-cyan-400 bg-black/40 py-2.5 rounded border border-indigo-500/20 font-black text-xl shadow-inner">
                                            {distanceMeters.toFixed(1)} <span className="text-[10px] text-slate-500 uppercase tracking-tighter">m</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs text-slate-400 uppercase font-bold mb-1 block">Wanted Freq (MHz)</label>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => stepWantedFreq('down')} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-600">-</button>
                                            <div className="flex-1 text-center font-mono text-emerald-400 bg-black/40 py-1.5 rounded border border-emerald-500/20">{wantedFreq.toFixed(3)}</div>
                                            <button onClick={() => stepWantedFreq('up')} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-600">+</button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-400 uppercase font-bold mb-1 block">Interferer (MHz)</label>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => stepFreq('down')} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-600">-</button>
                                            <div className="flex-1 text-center font-mono text-cyan-400 bg-black/40 py-1.5 rounded border border-indigo-500/20">{interfererFreq.toFixed(3)}</div>
                                            <button onClick={() => stepFreq('up')} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-600">+</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-amber-950/30 border border-amber-500/30 p-4 rounded-xl space-y-3">
                            <h5 className="text-amber-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                <span>ℹ️</span> System Information
                            </h5>
                            <p className="text-[10px] text-amber-200/80 leading-relaxed font-medium">
                                Results model <span className="text-white font-bold">Analogue-to-Analogue</span> interference. 
                            </p>
                            <p className="text-[10px] text-amber-200/80 leading-relaxed font-medium">
                                 <span className="text-white font-bold">Analogue-to-Digital</span> and <span className="text-white font-bold">Digital-to-Digital</span> systems yield significantly more robust results.
                            </p>
                        </div>
                    </div>

                    <div className="lg:col-span-3">
                        <div 
                            ref={containerRef}
                            className="relative w-full h-[650px] bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden cursor-default select-none shadow-2xl touch-none"
                            style={{ touchAction: 'none' }}
                            onMouseMove={handleMouseMove}
                            onMouseUp={() => setIsDragging(false)}
                            onMouseLeave={() => setIsDragging(false)}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={() => setIsDragging(false)}
                        >
                            <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(#38bdf8 1px, transparent 1px), linear-gradient(90deg, #38bdf8 1px, transparent 1px)', backgroundSize: `${Math.max(10, viewScale * 25)}px ${Math.max(10, viewScale * 25)}px` }}></div>

                            {/* PERSISTENT STATUS MONITOR (Top-Left Static Diagram) - Solid white border & white text */}
                            <div className="absolute top-6 left-6 z-30 p-4 bg-slate-900/30 border border-white rounded-2xl pointer-events-none min-w-[220px] select-none">
                                <h5 className="text-[10px] font-black text-white uppercase tracking-widest mb-4 flex justify-between items-center">
                                    <span>Primary Link Status</span>
                                    <span className={`px-1.5 py-0.5 rounded-md ${isWantedMicOn ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {isWantedMicOn ? 'ACTIVE' : 'IDLE'}
                                    </span>
                                </h5>
                                <div className="flex items-center gap-3">
                                    {/* Mini Receiver */}
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="w-10 h-6 bg-slate-800 rounded border border-slate-600 flex items-center justify-center">
                                            <div className="text-[8px] font-bold text-emerald-400">RX</div>
                                        </div>
                                        <span className="text-[9px] font-black text-white uppercase">Station</span>
                                    </div>
                                    
                                    {/* Static 10m Link Line */}
                                    <div className="flex-1 h-px border-b border-dashed border-white/50 relative flex items-center justify-center min-w-[60px]">
                                         <span className="absolute -top-3 text-[10px] font-mono font-bold text-white bg-slate-900/40 px-1 rounded">10m REF</span>
                                    </div>

                                    {/* Mini Wanted Mic - Only this element captures clicks */}
                                    <div 
                                        onClick={() => setIsWantedMicOn(!isWantedMicOn)}
                                        className={`flex flex-col items-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95 pointer-events-auto ${isWantedMicOn ? 'opacity-100' : 'opacity-30'}`}
                                        title="Toggle Wanted Mic Power"
                                    >
                                        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm shadow-lg transition-colors ${isWantedMicOn ? 'bg-emerald-600 border-emerald-400' : 'bg-slate-700 border-slate-500'}`}>🎤</div>
                                        <span className={`text-[10px] font-mono font-black ${isWantedMicOn ? 'text-emerald-400' : 'text-white/60'}`}>{wantedFreq.toFixed(3)} MHz</span>
                                    </div>
                                </div>
                                <div className="mt-4 pt-3 border-t border-white/20 text-[10px] text-white italic leading-tight">
                                    * This diagram shows the fixed 10m protected link status.
                                </div>
                            </div>

                            {/* Interference Zone */}
                            <div 
                                className={`absolute rounded-full transition-all duration-500 ease-out flex items-center justify-center pointer-events-none ${isInterfering ? 'bg-red-500/20 border-red-500/60 shadow-[0_0_80px_rgba(239,68,68,0.4)] animate-pulse' : 'bg-indigo-500/5 border-indigo-500/30'}`}
                                style={{ width: interferenceRadiusPixels * 2, height: interferenceRadiusPixels * 2, left: receiverPos.x - interferenceRadiusPixels, top: receiverPos.y - interferenceRadiusPixels, borderStyle: isInterfering ? 'solid' : 'dashed', borderWidth: '2px' }}
                            />

                            {/* Receiver */}
                            <div className="absolute flex flex-col items-center gap-2" style={{ left: receiverPos.x - 32, top: receiverPos.y - 16 }}>
                                <div className="w-16 h-8 bg-slate-800 rounded border border-slate-600 flex items-center justify-center">
                                    <div className="text-[10px] font-bold text-emerald-400">RX</div>
                                </div>
                                <span className="text-[9px] font-black text-slate-500 uppercase">Receiver</span>
                            </div>

                            {/* Draggable Interferer */}
                            <div className="absolute z-10 cursor-grab active:cursor-grabbing group touch-none" style={{ left: interfererPos.x - 25, top: interfererPos.y - 25, touchAction: 'none' }} onMouseDown={() => setIsDragging(true)} onTouchStart={() => setIsDragging(true)}>
                                <div className="absolute left-14 -top-6 bg-slate-800/90 border border-cyan-500/50 rounded-lg p-3 shadow-2xl backdrop-blur-xl pointer-events-none min-w-[120px]">
                                    <div className="flex justify-between items-baseline">
                                        <p className="text-sm font-mono text-cyan-400 font-black">{interfererFreq.toFixed(3)}</p>
                                        <p className="text-[10px] text-cyan-600 font-mono">MHz</p>
                                    </div>
                                    <div className="mt-1 pt-1 border-t border-slate-700 flex justify-between text-[10px]">
                                        <span className="text-slate-500">Offset:</span>
                                        <span className="text-amber-400 font-bold">{offsetKhz} kHz</span>
                                    </div>
                                </div>
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isInterfering ? 'bg-red-600 border-red-400 text-white' : 'bg-slate-800 border-cyan-500 text-cyan-400'} border-2 shadow-2xl`}>🎤</div>
                            </div>

                            <svg className="absolute inset-0 pointer-events-none w-full h-full">
                                {/* Line to Interferer */}
                                <line x1={interfererPos.x} y1={interfererPos.y} x2={receiverPos.x} y2={receiverPos.y} stroke={isInterfering ? '#f87171' : '#334155'} strokeWidth="1.5" strokeDasharray="6 4" />
                                <rect x={(interfererPos.x + receiverPos.x) / 2 - 25} y={(interfererPos.y + receiverPos.y) / 2 - 12} width="50" height="18" rx="4" fill="#0f172a" fillOpacity="0.9" />
                                <text x={(interfererPos.x + receiverPos.x) / 2} y={(interfererPos.y + receiverPos.y) / 2 + 1} fill={isInterfering ? '#f87171' : '#94a3b8'} fontSize="11" textAnchor="middle" className="font-mono font-black">{distanceMeters.toFixed(1)}m</text>
                            </svg>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default InterferenceDemoTab;