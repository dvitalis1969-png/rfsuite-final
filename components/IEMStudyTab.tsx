import React, { useState, useRef, useEffect, useMemo } from 'react';
import Card, { CardTitle } from './Card';

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 600;
const SPECTRUM_HEIGHT = 450;
const BASE_NOISE_FLOOR = -105; 

// OB Simulator Data Structures
interface Transmitter {
    id: string;
    freq: number;
    powerMw: number;
    active: boolean;
}

interface Antenna {
    id: string;
    type: 'Dipole' | 'Colinear';
    relX: number; // relative to truck center
    relY: number; // relative to truck center
    transmitters: Transmitter[];
}

interface OBVehicle {
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    length: number;
    rotation: number; // in degrees
    color: string;
    antennas: Antenna[];
}

interface IMDProduct {
    val: number;
    power: number;
    formula: string;
    type: '2-Tone' | '3-Tone';
    sourceIds: string[];
}

const IEMStudyTab: React.FC = () => {
    // Initial Setup: 2 OB Trucks in a compound
    const [vehicles, setVehicles] = useState<OBVehicle[]>([
        {
            id: 'OB-1',
            name: 'Unit 1 (Primary)',
            x: 400,
            y: 300,
            width: 60,
            length: 160,
            rotation: 0,
            color: '#1e293b',
            antennas: [
                {
                    id: 'ANT-1A',
                    type: 'Colinear',
                    relX: 0,
                    relY: -40,
                    transmitters: [
                        { id: 'TX-1', freq: 457.250, powerMw: 50, active: true },
                        { id: 'TX-2', freq: 457.475, powerMw: 50, active: true },
                        { id: 'TX-3', freq: 457.900, powerMw: 50, active: true }
                    ]
                },
                {
                    id: 'ANT-1B',
                    type: 'Dipole',
                    relX: 0,
                    relY: 40,
                    transmitters: [
                        { id: 'TX-4', freq: 458.125, powerMw: 25, active: true }
                    ]
                }
            ]
        },
        {
            id: 'OB-2',
            name: 'Broadcaster B',
            x: 550,
            y: 300,
            width: 60,
            length: 140,
            rotation: 15,
            color: '#0f172a',
            antennas: [
                {
                    id: 'ANT-2A',
                    type: 'Colinear',
                    relX: 0,
                    relY: -30,
                    transmitters: [
                        { id: 'TX-5', freq: 455.025, powerMw: 50, active: true },
                        { id: 'TX-6', freq: 455.350, powerMw: 50, active: true }
                    ]
                }
            ]
        }
    ]);

    const [draggingObj, setDraggingObj] = useState<{ type: 'vehicle' | 'antenna', vId: string, aId?: string } | null>(null);
    const [viewScale, setViewScale] = useState(4); // px per meter (physics constant)
    const [mapZoom, setMapZoom] = useState(0.8); // Visual zoom factor for UI
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 }); // Global map translation
    const [isRunning, setIsRunning] = useState(true);
    const [showLabels, setShowLabels] = useState(true);
    const [squelch, setSquelch] = useState(-95);
    const [selectedRbw, setSelectedRbw] = useState<number>(0.025); // 25kHz
    const [tuningStep, setTuningStep] = useState<number>(0.0125); 
    const [refLevel, setRefLevel] = useState<number>(0);
    const [showFloatingMonitor, setShowFloatingMonitor] = useState(true);

    const [isAutoView, setIsAutoView] = useState(true);
    const [centerFreq, setCenterFreq] = useState(457.0);
    const [spanMhz, setSpanMhz] = useState(10.0);
    
    const mapRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Multi-touch tracking
    const activePointers = useRef<Map<number, { x: number, y: number }>>(new Map());

    // --- Interaction Handlers ---

    const handlePointerDown = (e: React.PointerEvent, vId?: string, aId?: string) => {
        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        
        // Single finger on an object starts object drag
        if (activePointers.current.size === 1 && vId) {
            setDraggingObj(aId ? { type: 'antenna', vId, aId } : { type: 'vehicle', vId });
        }
        
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!mapRef.current) return;
        const rect = mapRef.current.parentElement?.getBoundingClientRect();
        if (!rect) return;

        const prevPos = activePointers.current.get(e.pointerId);
        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        // TWO FINGER PANNING
        if (activePointers.current.size === 2 && prevPos) {
            const dx = e.clientX - prevPos.x;
            const dy = e.clientY - prevPos.y;
            // Divide by pointers count to smoothen aggregate motion
            setPanOffset(prev => ({ x: prev.x + dx / 2, y: prev.y + dy / 2 }));
            return;
        }

        // SINGLE FINGER OBJECT DRAGGING
        if (draggingObj && activePointers.current.size === 1) {
            // Coordinate conversion: Adjust for scale AND pan
            const x = (e.clientX - rect.left - panOffset.x) / mapZoom;
            const y = (e.clientY - rect.top - panOffset.y) / mapZoom;

            if (draggingObj.type === 'vehicle') {
                setVehicles(prev => prev.map(v => v.id === draggingObj.vId ? { ...v, x, y } : v));
            } else if (draggingObj.type === 'antenna' && draggingObj.aId) {
                setVehicles(prev => {
                    const vehicle = prev.find(v => v.id === draggingObj.vId);
                    if (!vehicle) return prev;

                    const dx = x - vehicle.x;
                    const dy = y - vehicle.y;
                    const rad = -(vehicle.rotation * Math.PI) / 180;
                    
                    const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
                    const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

                    const newRelX = Math.max(-vehicle.width/2, Math.min(vehicle.width/2, localX));
                    const newRelY = Math.max(-vehicle.length/2, Math.min(vehicle.length/2, localY));

                    return prev.map(v => {
                        if (v.id !== draggingObj.vId) return v;
                        return {
                            ...v,
                            antennas: v.antennas.map(a => a.id === draggingObj.aId ? { ...a, relX: newRelX, relY: newRelY } : a)
                        };
                    });
                });
            }
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        activePointers.current.delete(e.pointerId);
        if (activePointers.current.size === 0) {
            setDraggingObj(null);
        }
    };

    // --- Simulation Engine ---

    const simData = useMemo(() => {
        const flattenedCarriers: any[] = [];
        vehicles.forEach(v => {
            const rad = (v.rotation * Math.PI) / 180;
            v.antennas.forEach(a => {
                const absX = v.x + (a.relX * Math.cos(rad) - a.relY * Math.sin(rad));
                const absY = v.y + (a.relX * Math.sin(rad) + a.relY * Math.cos(rad));
                
                a.transmitters.forEach(tx => {
                    if (!tx.active) return;
                    
                    const dx = (absX - 600) / viewScale;
                    const dy = (absY - 300) / viewScale;
                    const distToProbe = Math.sqrt(dx * dx + dy * dy);
                    const pTxDbm = 10 * Math.log10(tx.powerMw);
                    const pRx = pTxDbm - (20 * Math.log10(Math.max(0.5, distToProbe)));

                    flattenedCarriers.push({
                        ...tx,
                        vId: v.id,
                        aId: a.id,
                        absX,
                        absY,
                        pRx,
                        pTxDbm
                    });
                });
            });
        });

        const imds: IMDProduct[] = [];

        const getIsolation = (s1: any, s2: any) => {
            const dAnt = Math.sqrt(Math.pow(s1.absX - s2.absX, 2) + Math.pow(s1.absY - s2.absY, 2)) / viewScale;
            const baseIso = (s1.aId === s2.aId) ? 18 : (s1.vId === s2.vId ? 25 : 50);

            if (dAnt >= 25) return 140; 
            const maxPenalty = 110 - baseIso;
            const distanceFactor = dAnt / 25; 
            return baseIso + (distanceFactor * maxPenalty);
        };

        const probeRx = (sourceMixingLevel: number, sourceX: number, sourceY: number) => {
            const dxP = (sourceX - 600) / viewScale;
            const dyP = (sourceY - 300) / viewScale;
            const distP = Math.sqrt(dxP * dxP + dyP * dyP);
            return sourceMixingLevel - (20 * Math.log10(Math.max(1, distP)));
        };

        for (let i = 0; i < flattenedCarriers.length; i++) {
            for (let j = 0; j < flattenedCarriers.length; j++) {
                if (i === j) continue;
                const s1 = flattenedCarriers[i], s2 = flattenedCarriers[j];
                const isolation2t = getIsolation(s1, s2);
                const val2t = 2 * s1.freq - s2.freq;
                const baseMixingLevel2t = (s1.pTxDbm + s2.pTxDbm) / 2;
                const imdSourcePower2t = baseMixingLevel2t - isolation2t; 
                const pImdRx2t = probeRx(imdSourcePower2t, (s1.absX + s2.absX) / 2, (s1.absY + s2.absY) / 2);

                if (pImdRx2t > -115) {
                    imds.push({
                        val: val2t,
                        power: pImdRx2t,
                        formula: `2(${s1.id})-${s2.id}`,
                        type: '2-Tone',
                        sourceIds: [s1.id, s2.id]
                    });
                }

                if (flattenedCarriers.length >= 3) {
                    for (let k = j + 1; k < flattenedCarriers.length; k++) {
                        if (k === i || k === j) continue;
                        const s3 = flattenedCarriers[k];
                        const val3t = s1.freq + s2.freq - s3.freq;
                        const iso12 = getIsolation(s1, s2);
                        const iso13 = getIsolation(s1, s3);
                        const iso23 = getIsolation(s2, s3);
                        const avgIso = (iso12 + iso13 + iso23) / 3;
                        const baseMixingLevel3t = (s1.pTxDbm + s2.pTxDbm + s3.pTxDbm) / 3;
                        const imdSourcePower3t = baseMixingLevel3t - avgIso;
                        const centerX = (s1.absX + s2.absX + s3.absX) / 3;
                        const centerY = (s1.absY + s2.absY + s3.absY) / 3;
                        const pImdRx3t = probeRx(imdSourcePower3t, centerX, centerY);

                        if (pImdRx3t > -115) {
                            imds.push({
                                val: val3t,
                                power: pImdRx3t,
                                formula: `${s1.id}+${s2.id}-${s3.id}`,
                                type: '3-Tone',
                                sourceIds: [s1.id, s2.id, s3.id]
                            });
                        }
                    }
                }
            }
        }

        const highestInterference = imds.length > 0 ? Math.max(...imds.map(im => im.power)) : BASE_NOISE_FLOOR;
        const bestCarrier = flattenedCarriers.length > 0 ? Math.max(...flattenedCarriers.map(c => c.pRx)) : BASE_NOISE_FLOOR;
        const snr = bestCarrier - Math.max(squelch, highestInterference);

        return { carriers: flattenedCarriers, imds, snr };
    }, [vehicles, viewScale, squelch]);

    // Unique antenna global positions for distance mapping
    const uniqueAntennas = useMemo(() => {
        const ants: { id: string, x: number, y: number, type: string, vehicleName: string }[] = [];
        const seen = new Set<string>();
        vehicles.forEach(v => {
            const rad = (v.rotation * Math.PI) / 180;
            v.antennas.forEach(a => {
                if (!seen.has(a.id)) {
                    const absX = v.x + (a.relX * Math.cos(rad) - a.relY * Math.sin(rad));
                    const absY = v.y + (a.relX * Math.sin(rad) + a.relY * Math.cos(rad));
                    ants.push({ id: a.id, x: absX, y: absY, type: a.type, vehicleName: v.name });
                    seen.add(a.id);
                }
            });
        });
        return ants;
    }, [vehicles]);

    // --- Visual Auto-Scaling ---
    useEffect(() => {
        if (isAutoView && simData.carriers.length > 0) {
            const allFreqs = [...simData.carriers.map(c => c.freq), ...simData.imds.map(im => im.val)];
            const minF = Math.min(...allFreqs);
            const maxF = Math.max(...allFreqs);
            const range = maxF - minF;
            const padding = Math.max(0.5, range * 0.4);
            setCenterFreq((minF + maxF) / 2);
            setSpanMhz(range + padding);
        }
    }, [simData.carriers, simData.imds, isAutoView]);

    // --- Spectrum Rendering ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        let rafId: number;
        const render = () => {
            const { width, height } = canvas;
            const pad = { top: 75, right: 30, bottom: 100, left: 110 };
            const chartW = width - pad.left - pad.right;
            const chartH = height - pad.top - pad.bottom;
            const minF = centerFreq - spanMhz / 2;
            const maxF = centerFreq + spanMhz / 2;
            const maxP = refLevel;
            const minP = refLevel - 110; 
            const dbRange = maxP - minP;

            const fToX = (f: number) => pad.left + ((f - minF) / spanMhz) * chartW;
            const pToY = (p: number) => pad.top + chartH * (1 - (p - minP) / dbRange);

            ctx.fillStyle = '#020617'; 
            ctx.fillRect(0, 0, width, height);

            ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
            ctx.lineWidth = 1;
            ctx.font = 'bold 20px "Roboto Mono"';
            ctx.fillStyle = '#64748b';
            ctx.textAlign = 'right';
            for (let p = minP; p <= maxP; p += 10) {
                const y = pToY(p);
                if (y >= pad.top && y <= pad.top + chartH) {
                    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
                    ctx.fillText(`${p.toFixed(0)}`, pad.left - 15, y + 7);
                }
            }

            ctx.textAlign = 'center';
            const numTicks = 10;
            for (let i = 0; i <= numTicks; i++) {
                const f = minF + (spanMhz / numTicks) * i;
                const x = fToX(f);
                ctx.beginPath(); ctx.moveTo(x, pad.top); 
                ctx.lineTo(x, height - pad.bottom); ctx.stroke();
                ctx.fillText(f.toFixed(spanMhz < 1 ? 3 : 2), x, pad.top + chartH + 35);
            }

            const chartW_floor = Math.floor(chartW);
            const tracePoints: number[] = new Array(chartW_floor).fill(BASE_NOISE_FLOOR);
            const traceColors: string[] = new Array(chartW_floor).fill('#34d399');
            const carrierSmoothed: number[] = new Array(chartW_floor).fill(BASE_NOISE_FLOOR);
            const imdSmoothed: number[] = new Array(chartW_floor).fill(BASE_NOISE_FLOOR);

            const getPowerAtX = (f: number, p: number, bw: number, pixelX: number, isImd: boolean) => {
                const centerXPx = (f - minF) / spanMhz * chartW;
                const radiusPx = (bw / spanMhz) * chartW;
                const dist = Math.abs(pixelX - centerXPx) / (radiusPx || 1);
                const sharpness = isImd ? 2.5 : 1.8;
                const main = Math.exp(-Math.pow(dist, 2) * sharpness);
                const skirt = Math.exp(-Math.pow(dist, 2) * 0.08) * 0.03;
                return BASE_NOISE_FLOOR + (p - BASE_NOISE_FLOOR) * Math.max(main, skirt);
            };

            for (let x = 0; x < chartW_floor; x++) {
                let maxCarrierAtX = BASE_NOISE_FLOOR;
                simData.carriers.forEach(c => {
                    const p = getPowerAtX(c.freq, c.pRx, selectedRbw, x, false);
                    if (p > maxCarrierAtX) maxCarrierAtX = p;
                });
                carrierSmoothed[x] = maxCarrierAtX;

                let maxImdAtX = BASE_NOISE_FLOOR;
                simData.imds.forEach(im => {
                    const p = getPowerAtX(im.val, im.power, selectedRbw, x, true);
                    if (p > maxImdAtX) maxImdAtX = p;
                });
                imdSmoothed[x] = maxImdAtX;

                const maxPAtX = Math.max(maxCarrierAtX, maxImdAtX);
                const jitter = isRunning ? (Math.random() * 6 - 3) : 0;
                tracePoints[x] = maxPAtX + jitter;
                
                const isImdActive = maxImdAtX > BASE_NOISE_FLOOR + 15;
                const isCompromised = maxImdAtX > maxCarrierAtX - 50;

                if (isImdActive && isCompromised) {
                    traceColors[x] = '#a855f7'; 
                } else if (maxCarrierAtX > BASE_NOISE_FLOOR + 2) {
                    traceColors[x] = '#ffff00'; 
                } else {
                    traceColors[x] = '#34d399'; 
                }
            }

            ctx.fillStyle = 'rgba(255, 255, 0, 0.4)';
            ctx.beginPath();
            ctx.moveTo(pad.left, pad.top + chartH);
            for (let x = 0; x < chartW_floor; x++) ctx.lineTo(pad.left + x, pToY(carrierSmoothed[x]));
            ctx.lineTo(pad.left + chartW, pad.top + chartH); ctx.fill();

            ctx.fillStyle = 'rgba(147, 51, 234, 0.7)'; 
            ctx.beginPath();
            ctx.moveTo(pad.left, pad.top + chartH);
            for (let x = 0; x < chartW_floor; x++) ctx.lineTo(pad.left + x, pToY(imdSmoothed[x]));
            ctx.lineTo(pad.left + chartW, pad.top + chartH); ctx.fill();

            ctx.lineWidth = 3; ctx.lineJoin = 'round';
            let currentLineColor = traceColors[0];
            ctx.beginPath(); ctx.strokeStyle = currentLineColor; ctx.moveTo(pad.left, pToY(tracePoints[0]));

            for (let i = 1; i < chartW_floor; i++) {
                const x = pad.left + i; const y = pToY(tracePoints[i]); const pixelColor = traceColors[i];
                if (pixelColor !== currentLineColor) {
                    ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.strokeStyle = pixelColor; ctx.moveTo(x, y);
                    currentLineColor = pixelColor;
                } else ctx.lineTo(x, y);
            }
            ctx.stroke();

            ctx.fillStyle = '#10b981'; ctx.font = 'bold 11px "Roboto Mono"'; ctx.textAlign = 'left';
            ctx.fillText(`REF ${refLevel.toFixed(1)} dBm`, pad.left, pad.top - 40);
            ctx.textAlign = 'right'; ctx.fillText(`RBW ${(selectedRbw * 1000).toFixed(1)} kHz`, width - pad.right, pad.top - 40);
            ctx.textAlign = 'center'; ctx.font = 'bold 12px "Roboto Mono"';
            ctx.fillText(`SPAN ${spanMhz.toFixed(3)} MHz`, width / 2, pad.top - 40);
            ctx.font = 'bold 16px "Roboto Mono"';
            ctx.fillText(`CENTER ${centerFreq.toFixed(4)} MHz`, width / 2, height - 15);

            ctx.strokeStyle = '#f43f5e'; ctx.setLineDash([5, 5]);
            ctx.beginPath(); ctx.moveTo(pad.left, pToY(squelch)); ctx.lineTo(width - pad.right, pToY(squelch)); ctx.stroke();
            ctx.setLineDash([]);

            if (showLabels) {
                simData.carriers.forEach(c => {
                    if (c.pRx > minP + 10) {
                        ctx.fillStyle = '#ffff00'; ctx.font = 'black 10px "Roboto Mono"';
                        ctx.fillText(c.id, fToX(c.freq), pToY(c.pRx) - 22);
                    }
                });
            }

            if (isRunning) rafId = requestAnimationFrame(render);
        };
        render();
        return () => cancelAnimationFrame(rafId);
    }, [simData, isRunning, centerFreq, spanMhz, refLevel, selectedRbw, showLabels, squelch]);

    // --- Data Management Functions ---

    const addTruck = () => {
        const newId = `OB-${vehicles.length + 1}`;
        setVehicles(prev => [...prev, {
            id: newId,
            name: `Truck ${prev.length + 1}`,
            x: 200 + (prev.length * 100),
            y: 100 + (prev.length * 50),
            width: 60,
            length: 150,
            rotation: 0,
            color: '#1e293b',
            antennas: []
        }]);
    };

    const centerUnits = () => {
        if (vehicles.length === 0) return;
        const avgX = vehicles.reduce((sum, v) => sum + v.x, 0) / vehicles.length;
        const avgY = vehicles.reduce((sum, v) => sum + v.y, 0) / vehicles.length;
        const dx = 600 - avgX;
        const dy = 300 - avgY;
        setVehicles(prev => prev.map(v => ({ ...v, x: v.x + dx, y: v.y + dy })));
        setPanOffset({ x: 0, y: 0 }); // Reset pan on center
    };

    const addAntenna = (vId: string, type: 'Dipole' | 'Colinear') => {
        setVehicles(prev => prev.map(veh => {
            if (veh.id !== vId) return veh;
            const count = veh.antennas.length;
            const offset = (count * 15) % 40;
            const newAnt: Antenna = { 
                id: `ANT-${veh.id}-${Date.now()}`, 
                type, 
                relX: offset - 15, 
                relY: (count * 15) - 30, 
                transmitters: [] 
            };
            return { ...veh, antennas: [...veh.antennas, newAnt] };
        }));
    };

    const addTransmitter = (vId: string, aId: string) => {
        setVehicles(prev => prev.map(veh => {
            if (veh.id !== vId) return veh;
            return {
                ...veh,
                antennas: veh.antennas.map(ant => {
                    if (ant.id !== aId) return ant;
                    const nextId = `TX-${ant.transmitters.length + 1}-${Math.random().toString(36).substring(2,3).toUpperCase()}`;
                    const nextFreq = 457.0 + (ant.transmitters.length * 0.125);
                    return {
                        ...ant,
                        transmitters: [...ant.transmitters, {
                            id: nextId,
                            freq: nextFreq,
                            powerMw: 50,
                            active: true
                        }]
                    };
                })
            };
        }));
    };

    const updateVehicleRotation = (vId: string, rot: number) => {
        setVehicles(prev => prev.map(v => v.id === vId ? { ...v, rotation: rot } : v));
    };

    // Helper for floating monitor drawing
    const renderMiniMap = () => {
        const miniScale = 0.25; // 25% scale for mini map
        return (
            <div className="relative w-full h-full">
                {vehicles.map(v => (
                    <div 
                        key={`mini-${v.id}`}
                        className="absolute rounded border border-white/40 shadow-lg"
                        style={{
                            left: v.x * miniScale - (v.width * miniScale) / 2,
                            top: v.y * miniScale - (v.length * miniScale) / 2,
                            width: v.width * miniScale,
                            height: v.length * miniScale,
                            backgroundColor: v.color,
                            transform: `rotate(${v.rotation}deg)`,
                            transformOrigin: 'center center'
                        }}
                    >
                        <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-1 h-0.5 bg-white/20 rounded-full" />
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap bg-black/80 px-1.5 py-0.5 rounded text-[8px] font-black text-white uppercase tracking-tighter border border-white/10 shadow-xl z-20">
                            {v.name}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-6 relative">
            {/* FLOATING COMPOUND MONITOR */}
            <div 
                className={`fixed bottom-8 right-8 z-[100] transition-all duration-500 transform ${showFloatingMonitor ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-full opacity-0 pointer-events-none scale-90'}`}
            >
                <div className="bg-slate-900/90 backdrop-blur-xl border-2 border-indigo-500/40 rounded-2xl shadow-2xl overflow-hidden w-[340px] group">
                    <div className="bg-indigo-900/40 px-3 py-2.5 border-b border-white/10 flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200 flex items-center gap-2">
                            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></span>
                            Compound Monitor
                        </span>
                        <button 
                            onClick={() => setShowFloatingMonitor(false)} 
                            className="w-6 h-6 flex items-center justify-center rounded-full bg-black/30 hover:bg-red-500/80 text-white transition-all text-sm leading-none"
                        >
                            &times;
                        </button>
                    </div>
                    <div className="p-4 bg-black/40 aspect-[1200/600] relative overflow-hidden flex items-center justify-center">
                        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: `radial-gradient(#38bdf8 1px, transparent 1px)`, backgroundSize: `10px 10px` }}></div>
                        <div className="w-full h-full relative">
                            {renderMiniMap()}
                        </div>
                    </div>
                    <div className="px-3 py-2 border-t border-white/5 flex justify-between bg-slate-900/50">
                        <span className="text-[8px] text-slate-500 uppercase font-black">Live Orientation Tracking</span>
                        <span className="text-[8px] text-indigo-400 font-mono">{vehicles.length} Units Active</span>
                    </div>
                </div>
            </div>

            {!showFloatingMonitor && (
                <button 
                    onClick={() => setShowFloatingMonitor(true)}
                    className="fixed bottom-8 right-8 z-[100] bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-full shadow-2xl transition-all border-2 border-indigo-400 animate-in fade-in zoom-in slide-in-from-right-4"
                    title="Show Compound Monitor"
                >
                    <span className="text-xl">🚚</span>
                </button>
            )}

            {/* COMPOUND MAP */}
            <Card className="!p-0 overflow-hidden relative border-2 border-indigo-500/20 shadow-2xl rounded-2xl bg-[#020617]">
                <div className="bg-slate-900/90 p-4 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-20">
                    <div className="space-y-1">
                        <h3 className="text-sm font-black uppercase tracking-[0.4em] text-indigo-400">OB Compound Layout</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Two-finger drag to PAN view. Single-finger drag for OBJECTS.</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Viewport Controls */}
                        <div className="flex bg-slate-800 rounded-lg p-1 border border-white/5 shadow-inner mr-2">
                            <button onClick={() => setMapZoom(prev => Math.max(0.1, prev - 0.1))} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-all font-black">-</button>
                            <div className="px-3 flex items-center justify-center font-mono text-[10px] text-cyan-400 font-black min-w-[60px]">{Math.round(mapZoom * 100)}%</div>
                            <button onClick={() => setMapZoom(prev => Math.min(3.0, prev + 0.1))} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-all font-black">+</button>
                        </div>
                        
                        <button onClick={centerUnits} className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest text-white shadow-lg transition-all" title="Shift all vehicles to center of logically visible area">🎯 Center Units</button>
                        <button onClick={() => { setMapZoom(0.8); setPanOffset({ x: 0, y: 0 }); }} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest text-white shadow-lg transition-all">Reset View</button>
                        <button onClick={addTruck} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-[10px] font-black uppercase tracking-widest text-white shadow-lg transition-all">+ Add Vehicle</button>
                    </div>
                </div>

                <div className="relative w-full h-[600px] overflow-hidden bg-black/40 touch-none">
                    <div 
                        ref={mapRef} 
                        className="absolute top-0 left-0 cursor-crosshair transition-transform duration-75"
                        style={{ 
                            width: MAP_WIDTH, 
                            height: MAP_HEIGHT,
                            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${mapZoom})`,
                            transformOrigin: '0 0'
                        }}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onPointerDown={(e) => handlePointerDown(e)}
                    >
                        {/* Grid Layer */}
                        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `radial-gradient(#38bdf8 1px, transparent 1px)`, backgroundSize: `${20 * viewScale}px ${20 * viewScale}px` }}></div>
                        
                        {/* Compound Probe */}
                        <div className="absolute left-[600px] top-[300px] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none z-50">
                            <div className="w-6 h-6 border-2 border-emerald-500 rounded-full flex items-center justify-center bg-emerald-500/10">
                                <div className="w-1 h-1 bg-emerald-500 rounded-full animate-ping"></div>
                            </div>
                            <span className="text-[8px] font-black text-emerald-400 uppercase mt-1 tracking-widest bg-black/80 px-1 rounded">Measurement Probe</span>
                        </div>

                        {/* Distance Ledger Lines */}
                        <svg className="absolute inset-0 pointer-events-none w-full h-full">
                            {uniqueAntennas.map((a1, i) => uniqueAntennas.slice(i + 1).map((a2, j) => {
                                const dx = (a1.x - a2.x) / viewScale;
                                const dy = (a1.y - a2.y) / viewScale;
                                const dist = Math.sqrt(dx * dx + dy * dy);
                                if (dist < 0.1 || dist > 30) return null;
                                const midX = (a1.x + a2.x) / 2;
                                const midY = (a1.y + a2.y) / 2;
                                const isInteractionDanger = dist < 25;
                                return (
                                    <g key={`${a1.id}-${a2.id}`}>
                                        <line x1={a1.x} y1={a1.y} x2={a2.x} y2={a2.y} stroke={isInteractionDanger ? "rgba(239, 68, 68, 0.4)" : "rgba(99, 102, 241, 0.25)"} strokeWidth="1.5" strokeDasharray="4 3" />
                                        <rect x={midX - 18} y={midY - 9} width="36" height="18" rx="5" fill="#0f172a" stroke={isInteractionDanger ? "rgba(239, 68, 68, 0.5)" : "rgba(99, 102, 241, 0.4)"} strokeWidth="1" />
                                        <text x={midX} y={midY + 4} fill={isInteractionDanger ? "#f87171" : "#818cf8"} fontSize="9" textAnchor="middle" fontWeight="900" className="font-mono">{dist.toFixed(1)}m</text>
                                    </g>
                                );
                            }))}
                        </svg>

                        {/* Render Vehicles */}
                        {vehicles.map(v => (
                            <div 
                                key={v.id} 
                                onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, v.id); }}
                                className={`absolute select-none cursor-grab active:cursor-grabbing transition-shadow ${draggingObj?.vId === v.id && !draggingObj.aId ? 'z-40' : 'z-20'}`}
                                style={{ 
                                    left: v.x - v.width/2, 
                                    top: v.y - v.length/2,
                                    width: v.width,
                                    height: v.length,
                                    transform: `rotate(${v.rotation}deg)`,
                                    transformOrigin: 'center center'
                                }}
                            >
                                <div className="relative w-full h-full group">
                                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-white/10 px-2 py-0.5 rounded text-[8px] font-black text-white uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity" style={{ transform: `rotate(${-v.rotation}deg)` }}>
                                        {v.name}
                                    </div>
                                    <div 
                                        className={`w-full h-full rounded-xl border-2 transition-all shadow-xl overflow-hidden ${draggingObj?.vId === v.id && !draggingObj.aId ? 'border-indigo-400 scale-105 shadow-indigo-500/20' : 'border-white/10'}`}
                                        style={{ backgroundColor: v.color }}
                                    >
                                        <div className="w-full h-full opacity-10" style={{ backgroundImage: 'linear-gradient(45deg, #fff 25%, transparent 25%, transparent 75%, #fff 75%, #fff), linear-gradient(45deg, #fff 25%, transparent 25%, transparent 75%, #fff 75%, #fff)', backgroundSize: '10px 10px', backgroundPosition: '0 0, 5px 5px' }}></div>
                                        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-white/20 rounded-full"></div>
                                    </div>

                                    {v.antennas.map(a => (
                                        <div 
                                            key={a.id}
                                            onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, v.id, a.id); }}
                                            className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-crosshair group/ant ${draggingObj?.aId === a.id ? 'z-50' : 'z-30'}`}
                                            style={{ left: v.width/2 + a.relX, top: v.length/2 + a.relY, transform: `translate(-50%, -50%) rotate(${-v.rotation}deg)` }}
                                        >
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${a.type === 'Colinear' ? 'bg-cyan-500 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-amber-500 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)]'} border-2 scale-75 group-hover/ant:scale-100`}>
                                                <span className="text-[10px]">{a.type === 'Colinear' ? '📶' : '📡'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* SPATIAL PROXIMITY LEDGER */}
                <div className="bg-slate-950 border-t border-indigo-500/20 p-4">
                    <div className="flex justify-between items-center mb-4 text-center">
                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] w-full">Spatial Proximity Ledger</h4>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-white/5 custom-scrollbar">
                        <table className="w-full text-[10px] text-center border-collapse">
                            <thead>
                                <tr className="bg-slate-900">
                                    <th className="p-2 border border-slate-800"></th>
                                    {uniqueAntennas.map(a => (
                                        <th key={a.id} className="p-2 border border-slate-800 text-slate-300 font-bold uppercase tracking-tighter min-w-[70px]">
                                            {a.id.split('-').pop()?.slice(-4)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {uniqueAntennas.map((a1, i) => (
                                    <tr key={a1.id} className="hover:bg-indigo-500/5 transition-colors">
                                        <th className="p-2 border border-slate-800 bg-slate-900 text-slate-400 font-bold text-left uppercase whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span>{a1.id.split('-').pop()?.slice(-4)}</span>
                                                <span className="text-[7px] opacity-40 font-black tracking-tighter truncate max-w-[80px]">{a1.vehicleName}</span>
                                            </div>
                                        </th>
                                        {uniqueAntennas.map((a2, j) => {
                                            const dx = (a1.x - a2.x) / viewScale;
                                            const dy = (a1.y - a2.y) / viewScale;
                                            const dist = Math.sqrt(dx * dx + dy * dy);
                                            const isSelf = a1.id === a2.id;
                                            const isInteraction = dist < 25 && !isSelf;

                                            return (
                                                <td 
                                                    key={a2.id} 
                                                    className={`p-2 border border-slate-800 font-mono transition-all ${
                                                        isSelf ? 'bg-slate-900/30 opacity-20' : 
                                                        isInteraction ? 'text-rose-400 bg-rose-500/10 font-black shadow-[inset_0_0_10px_rgba(244,63,94,0.1)]' : 
                                                        'text-slate-500'
                                                    }`}
                                                >
                                                    {isSelf ? '—' : dist.toFixed(2)}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                                {uniqueAntennas.length === 0 && (
                                    <tr>
                                        <td colSpan={100} className="p-8 text-center text-slate-600 italic">No antennas deployed on rooftops.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Card>

            {/* INTERACTION ANALYZER */}
            <Card className="!p-0 border-indigo-500/20 shadow-2xl overflow-hidden rounded-2xl">
                <div className="bg-slate-950 p-5 border-b border-white/10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full bg-cyan-500 animate-pulse`}></div>
                        <h3 className="text-sm font-black uppercase tracking-[0.5em] text-indigo-300">Interaction Analyzer</h3>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-6 bg-black/40 p-3 rounded-2xl border border-white/5 shadow-inner">
                        <div className="flex flex-col pr-6 border-r border-white/10">
                            <span className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Resolution (RBW)</span>
                            <div className="flex bg-slate-800 rounded-lg p-0.5 mt-1.5 border border-white/5">
                                {[0.0125, 0.025, 0.200].map(val => (
                                    <button key={val} onClick={() => setSelectedRbw(val)} className={`px-2.5 py-1.5 rounded text-[9px] font-black transition-all ${selectedRbw === val ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                                        {val * 1000}k
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col pr-6 border-r border-white/10">
                            <span className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Headroom (Ref)</span>
                            <div className="flex bg-slate-800 rounded-lg p-0.5 mt-1.5 border border-white/5">
                                {[-20, 0, 20].map(val => (
                                    <button key={val} onClick={() => setRefLevel(val)} className={`px-2.5 py-1.5 rounded text-[9px] font-black transition-all ${refLevel === val ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                                        {val > 0 ? '+' : ''}{val}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col pr-6 border-r border-white/10">
                            <span className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Manual Span</span>
                            <div className="flex items-center gap-1 mt-1.5">
                                <button onClick={() => { setIsAutoView(false); setSpanMhz(s => Math.max(0.1, s * 1.2)); }} className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-black border border-white/5 transition-colors shadow-lg">-</button>
                                <span className="text-[10px] font-mono text-cyan-400 w-12 text-center font-black">{spanMhz.toFixed(2)}</span>
                                <button onClick={() => { setIsAutoView(false); setSpanMhz(s => Math.max(0.1, s * 0.8)); }} className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-black border border-white/5 transition-colors shadow-lg">+</button>
                            </div>
                        </div>

                        <div className="flex flex-col pr-6 border-r border-white/10">
                            <span className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Center Frequency</span>
                            <div className="flex items-center bg-slate-900 border border-indigo-500/20 rounded-lg px-2 py-1.5 mt-1.5 shadow-inner">
                                <input 
                                    type="number" 
                                    step={tuningStep} 
                                    value={centerFreq} 
                                    onChange={e => { setIsAutoView(false); setCenterFreq(parseFloat(e.target.value) || 0); }} 
                                    className="w-24 bg-transparent text-[11px] text-cyan-300 font-mono outline-none font-bold text-center" 
                                />
                                <span className="text-[9px] text-slate-600 font-bold ml-1">MHz</span>
                            </div>
                        </div>

                        <div className="flex flex-col">
                            <span className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Scaling Mode</span>
                            <button onClick={() => setIsAutoView(!isAutoView)} className={`px-4 py-2 rounded-lg text-[9px] font-black transition-all mt-1.5 border ${isAutoView ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_10px_rgba(79,70,229,0.4)]' : 'bg-slate-800 border-slate-700 text-slate-50'}`}>
                                {isAutoView ? 'AUTO-TRACK' : 'MANUAL'}
                            </button>
                        </div>
                    </div>
                </div>
                <div className="relative group">
                    <canvas ref={canvasRef} width={2400} height={SPECTRUM_HEIGHT * 2} className="w-full h-[450px] bg-black" />
                </div>
            </Card>

            {/* CONSOLE CONTROL */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 !p-6 border-indigo-500/20 shadow-2xl bg-slate-900/90">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-6">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">OB Compound Fleet Manager</h4>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input type="checkbox" checked={isRunning} onChange={e => setIsRunning(e.target.checked)} className="w-4 h-4 rounded accent-indigo-500" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Live Trace</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input type="checkbox" checked={showLabels} onChange={e => setShowLabels(e.target.checked)} className="w-4 h-4 rounded accent-indigo-500" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">OSD Labels</span>
                            </label>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {vehicles.map(v => (
                            <div key={v.id} className="p-4 bg-black border border-slate-800 rounded-2xl space-y-4 hover:border-indigo-500/40 transition-all">
                                <div className="flex justify-between items-center">
                                    <input value={v.name} onChange={e => setVehicles(prev => prev.map(item => item.id === v.id ? { ...item, name: e.target.value } : item))} className="bg-transparent text-sm font-black text-indigo-400 uppercase outline-none focus:text-white" />
                                    <button onClick={() => setVehicles(prev => prev.filter(item => item.id !== v.id))} className="text-slate-700 hover:text-red-500 font-bold">&times;</button>
                                </div>

                                <div className="bg-slate-900/50 p-3 rounded-xl border border-white/5">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[9px] font-black text-slate-500 uppercase">Vehicle Orientation</span>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="number" 
                                                value={Math.round(v.rotation)} 
                                                onChange={e => updateVehicleRotation(v.id, Number(e.target.value))}
                                                className="w-12 bg-black border border-slate-700 rounded text-center font-mono text-[10px] text-cyan-400"
                                            />
                                            <span className="text-[9px] text-slate-600 font-bold">deg</span>
                                        </div>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="0" max="360" 
                                        value={v.rotation} 
                                        onChange={e => updateVehicleRotation(v.id, Number(e.target.value))} 
                                        className="w-full accent-indigo-500" 
                                    />
                                </div>
                                
                                <div className="space-y-4">
                                    {v.antennas.map(a => (
                                        <div key={a.id} className={`p-3 bg-slate-900 rounded-xl border-l-4 transition-all ${a.type === 'Colinear' ? 'border-cyan-500 shadow-[inset_4px_0_10px_-2px_rgba(6,182,212,0.2)]' : 'border-amber-500 shadow-[inset_4px_0_10px_-2px_rgba(245,158,11,0.2)]'} space-y-3`}>
                                            <div className="flex justify-between items-center">
                                                <span className={`text-[9px] font-black uppercase tracking-widest ${a.type === 'Colinear' ? 'text-cyan-400' : 'text-amber-400'}`}>{a.type} ARRAY</span>
                                                <div className="flex gap-2">
                                                    <button onClick={() => addTransmitter(v.id, a.id)} className="text-[8px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded hover:text-white transition-colors">+ TX CHANNEL</button>
                                                    <button onClick={() => {
                                                        setVehicles(prev => prev.map(veh => veh.id === v.id ? { ...veh, antennas: veh.antennas.filter(ant => ant.id !== a.id) } : veh));
                                                    }} className="text-[8px] bg-red-950/30 text-red-500/50 px-1.5 py-0.5 rounded hover:bg-red-600 hover:text-white transition-colors">&times;</button>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                {a.transmitters.map(tx => (
                                                    <div key={tx.id} className="grid grid-cols-[1fr,65px,auto] gap-2 items-center bg-black/40 p-1.5 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                                                        <div className="flex items-center gap-2">
                                                            <button onClick={() => {
                                                                setVehicles(prev => prev.map(veh => veh.id === v.id ? { ...veh, antennas: veh.antennas.map(ant => ant.id === a.id ? { ...ant, transmitters: ant.transmitters.map(t => t.id === tx.id ? { ...t, active: !t.active } : t) } : ant) } : veh));
                                                            }} className={`w-2.5 h-2.5 rounded-full transition-all ${tx.active ? (a.type === 'Colinear' ? 'bg-cyan-500 shadow-[0_0_8px_#06b6d4]' : 'bg-amber-500 shadow-[0_0_8px_#f59e0b]') : 'bg-slate-800'}`}></button>
                                                            <input type="number" step={tuningStep} value={tx.freq} onChange={e => {
                                                                const val = parseFloat(e.target.value) || 0;
                                                                setVehicles(prev => prev.map(veh => veh.id === v.id ? { ...veh, antennas: veh.antennas.map(ant => ant.id === a.id ? { ...ant, transmitters: ant.transmitters.map(t => t.id === tx.id ? { ...t, freq: val } : t) } : ant) } : veh));
                                                            }} className="bg-transparent text-[10px] font-mono text-slate-200 outline-none w-full" />
                                                        </div>
                                                        <select 
                                                            value={tx.powerMw} 
                                                            onChange={e => {
                                                                const val = parseInt(e.target.value);
                                                                setVehicles(prev => prev.map(veh => veh.id === v.id ? { ...veh, antennas: veh.antennas.map(ant => ant.id === a.id ? { ...ant, transmitters: ant.transmitters.map(t => t.id === tx.id ? { ...t, powerMw: val } : t) } : ant) } : veh));
                                                            }}
                                                            className="bg-slate-900 border-none text-[8px] text-slate-400 font-mono focus:text-cyan-300 outline-none p-0 h-4"
                                                        >
                                                            <option value={10}>10mW</option>
                                                            <option value={25}>25mW</option>
                                                            <option value={50}>50mW</option>
                                                            <option value={100}>100mW</option>
                                                            <option value={250}>250mW</option>
                                                            <option value={1000}>1W</option>
                                                            <option value={5000}>5W</option>
                                                        </select>
                                                        <button onClick={() => {
                                                            setVehicles(prev => prev.map(veh => veh.id === v.id ? { ...veh, antennas: veh.antennas.map(ant => ant.id === a.id ? { ...ant, transmitters: ant.transmitters.filter(t => t.id !== tx.id) } : ant) } : veh));
                                                        }} className="text-slate-700 hover:text-red-400 font-black px-1 transition-colors">&times;</button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                <div className="pt-2">
                                    <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-2 px-1">Roof Mounting:</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button 
                                            onClick={() => addAntenna(v.id, 'Dipole')} 
                                            className="flex items-center justify-center gap-2 py-2 bg-amber-600/10 border border-amber-500/30 rounded-xl text-[9px] font-black text-amber-500 uppercase hover:bg-amber-600 hover:text-white transition-all shadow-sm"
                                        >
                                            <span className="text-xs">📡</span> + Add Dipole
                                        </button>
                                        <button 
                                            onClick={() => addAntenna(v.id, 'Colinear')} 
                                            className="flex items-center justify-center gap-2 py-2 bg-cyan-600/10 border border-cyan-500/30 rounded-xl text-[9px] font-black text-cyan-400 uppercase hover:bg-cyan-600 hover:text-white transition-all shadow-sm"
                                        >
                                            <span className="text-xs">📶</span> + Add Colinear
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                <div className="space-y-6">
                    <Card className="!p-6 border-emerald-500/20 shadow-2xl bg-slate-900/90 h-full">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Compound Health Analysis</h4>
                        <div className="space-y-4">
                            <div className="bg-black/40 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                                <div className="space-y-1">
                                    <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Worst-Case SNR</span>
                                    <p className="text-[8px] text-slate-600 uppercase italic">Margin above IMD clusters</p>
                                </div>
                                <span className={`text-3xl font-mono font-black ${simData.snr > 15 ? 'text-emerald-400' : simData.snr > 5 ? 'text-amber-400' : 'text-rose-500'}`}>
                                    {Math.max(0, simData.snr).toFixed(1)} <span className="text-xs">dB</span>
                                </span>
                            </div>
                            <div className="p-4 bg-slate-950 rounded-2xl border border-indigo-500/10 space-y-3">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Simulation Notes</span>
                                <div className="space-y-2">
                                    <p className="text-[9px] text-slate-500 leading-relaxed">• IMD behavior triggers at <strong>25m</strong> separation.</p>
                                    <p className="text-[9px] text-slate-500 leading-relaxed">• Carriers calculated at <strong>600, 300</strong> (Compound Center).</p>
                                    <p className="text-[9px] text-slate-500 leading-relaxed">• Orientation affects spatial gain and mixing efficiency.</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8">
                             <div className="flex justify-between items-center mb-2">
                                <label className="text-[10px] text-slate-500 uppercase font-black">Probe Sensitivity</label>
                                <span className="text-xs font-mono text-rose-400">{squelch} dBm</span>
                            </div>
                            <input type="range" min="-115" max="-40" value={squelch} onChange={e => setSquelch(Number(e.target.value))} className="w-full accent-rose-500" />
                        </div>
                    </Card>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
                <div className="bg-slate-900/50 p-8 rounded-3xl border border-indigo-500/10 hover:border-indigo-500/30 transition-all shadow-inner">
                    <h4 className="text-[12px] font-black text-indigo-300 uppercase mb-4 flex items-center gap-3 tracking-widest"><span>📦</span> High-Density Cluster Modelling</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed italic font-medium">Coordinate dozen of talkback channels by visualizing the "coupler effect" of antennas shared across a colinear array. Moving trucks further apart reduces the efficiency of the inter-vehicle mixing products.</p>
                </div>
                <div className="bg-slate-900/50 p-8 rounded-3xl border border-purple-500/10 hover:border-purple-500/30 transition-all shadow-inner">
                    <h4 className="text-[12px] font-black text-purple-300 uppercase mb-4 flex items-center gap-3 tracking-widest"><span>🧬</span> Roof-Top Shielding Logic</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed italic font-medium">This model assumes basic roof-top path loss. Dipoles have naturally higher isolation between vehicles than colinear arrays, which often act as passive reflectors for nearby energetic transmitters.</p>
                </div>
            </div>
        </div>
    );
};

export default IEMStudyTab;