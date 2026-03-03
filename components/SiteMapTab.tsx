import React, { useState, useRef, useEffect } from 'react';
import Card, { CardTitle, Placeholder } from './Card';
import { ZoneConfig, SiteMapState, AppCategory } from '../types';

interface SiteMapContext {
    zones: ZoneConfig[];
    map: SiteMapState;
    setMap: (state: SiteMapState) => void;
    setDist: (distances: number[][]) => void;
}

interface SiteMapTabProps {
    festivalState: SiteMapContext;
    multizoneState: SiteMapContext;
    activeApp?: AppCategory | null;
}

const buttonBase = "px-4 py-2 rounded-lg font-semibold uppercase tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transform active:translate-y-0.5";
const primaryButton = `bg-gradient-to-r from-indigo-500 to-purple-500 text-white ${buttonBase}`;
const secondaryButton = `bg-slate-700 text-slate-200 hover:bg-slate-600 ${buttonBase}`;
const dangerButton = `bg-red-600/80 text-white hover:bg-red-500/80 ${buttonBase}`;

const SiteMapTab: React.FC<SiteMapTabProps> = ({ festivalState, multizoneState, activeApp }) => {
    // Determine initial context based on the active application
    const [activeContext, setActiveContext] = useState<'festival' | 'multizone'>(() => {
        if (activeApp === 'multizone') return 'multizone';
        return 'festival';
    });
    
    // Sync context if the user switches apps while the tab remains mounted (unlikely but robust)
    useEffect(() => {
        if (activeApp === 'multizone') setActiveContext('multizone');
        else if (activeApp === 'coordination') setActiveContext('festival');
    }, [activeApp]);

    // Select data based on context
    const current = activeContext === 'festival' ? festivalState : multizoneState;
    
    // SAFETY CHECK: Ensure state objects are not null/undefined to prevent destructuring crashes
    if (!current || !current.map) {
        return (
            <Card fullWidth>
                <Placeholder title="Data Error" message="Site Map configuration is missing for this project context." />
            </Card>
        );
    }

    const { zones: zoneConfigs, map: siteMapState, setMap: setSiteMapState, setDist: setDistances } = current;
    const { image, scale, positions: rawPositions } = siteMapState;
    const positions = rawPositions || [];
    
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
    const [scalingStep, setScalingStep] = useState(0); 
    const [scalePoints, setScalePoints] = useState<{ x: number, y: number }[]>([]);
    const [isDistanceModalOpen, setIsDistanceModalOpen] = useState(false);
    const [distanceInputValue, setDistanceInputValue] = useState("");

    // Auto-calculate distances when positions or scale change for the ACTIVE context
    useEffect(() => {
        if (!scale || !positions || positions.length < 2 || positions.length !== zoneConfigs.length) return;
        
        const numZones = zoneConfigs.length;
        const newDistances = Array(numZones).fill(0).map(() => Array(numZones).fill(0));
        
        for (let i = 0; i < numZones; i++) {
            for (let j = i + 1; j < numZones; j++) {
                if (positions[i] && positions[j]) {
                    const dx = positions[i].x - positions[j].x;
                    const dy = positions[i].y - positions[j].y;
                    const pixelDist = Math.sqrt(dx * dx + dy * dy);
                    const meterDist = (pixelDist / scale.pixels) * scale.meters;
                    newDistances[i][j] = Math.round(meterDist);
                    newDistances[j][i] = Math.round(meterDist);
                }
            }
        }
        setDistances(newDistances);
    }, [scale, positions, zoneConfigs.length, setDistances]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setSiteMapState({ ...siteMapState, image: event.target?.result as string, scale: null });
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };
    
    const handleDragStart = (e: React.MouseEvent | React.TouchEvent, index: number) => {
        // Prevent default if it's a touch event to stop scrolling
        if ('touches' in e) {
            // We set the dragging index and the browser handles the rest via onTouchMove
        } else {
            e.preventDefault();
        }
        setDraggingIndex(index);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (draggingIndex === null || !mapContainerRef.current) return;
        const rect = mapContainerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        updatePosition(x, y, rect.width, rect.height);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (draggingIndex === null || !mapContainerRef.current) return;
        const touch = e.touches[0];
        const rect = mapContainerRef.current.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        // Critically important for mobile dragging: prevent the page from scrolling while we drag an icon
        if (e.cancelable) e.preventDefault();
        
        updatePosition(x, y, rect.width, rect.height);
    };

    const updatePosition = (x: number, y: number, width: number, height: number) => {
        const newPositions = [...positions];
        newPositions[draggingIndex!] = { x: Math.max(0, Math.min(x, width)), y: Math.max(0, Math.min(y, height)) };
        setSiteMapState({ ...siteMapState, positions: newPositions });
    };

    const handleMapClick = (e: React.MouseEvent) => {
        if (scalingStep === 0 || !mapContainerRef.current) return;
        const rect = mapContainerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (scalingStep === 1) { setScalePoints([{ x, y }]); setScalingStep(2); } 
        else if (scalingStep === 2) { setScalePoints(prev => [...prev, { x, y }]); setIsDistanceModalOpen(true); setScalingStep(0); }
    };

    const handleDistanceSubmit = () => {
        const meters = parseFloat(distanceInputValue);
        if (!isNaN(meters) && meters > 0 && scalePoints.length === 2) {
            const [p1, p2] = scalePoints;
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const pixelDist = Math.sqrt(dx*dx + dy*dy);
            setSiteMapState({...siteMapState, scale: {pixels: pixelDist, meters}});
        }
        setIsDistanceModalOpen(false); setScalePoints([]); setDistanceInputValue("");
    };

    const handleClearMap = () => {
        setSiteMapState({ image: null, positions: [], scale: null });
        setDistances(Array(zoneConfigs.length).fill(0).map(() => Array(zoneConfigs.length).fill(0)));
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <Card fullWidth>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <CardTitle className="!mb-0">📍 Site Map Visual Planner</CardTitle>
                    <p className="text-slate-400 text-xs mt-1">Place {activeContext === 'festival' ? 'stages' : 'booths'} on your map to auto-calculate spatial separation.</p>
                </div>
                <div className="bg-slate-900/80 p-1 rounded-lg border border-slate-700 flex gap-1 shadow-inner">
                    <button 
                        onClick={() => setActiveContext('festival')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeContext === 'festival' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Music Festival
                    </button>
                    <button 
                        onClick={() => setActiveContext('multizone')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeContext === 'multizone' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Exhibition/Booth
                    </button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-900/50 rounded-lg mb-4 border border-slate-800">
                <div className="md:col-span-2">
                    <label className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2 block">Upload {activeContext === 'festival' ? 'Festival' : 'Venue'} Map Image</label>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-700 file:text-slate-300 hover:file:bg-slate-600"/>
                </div>
                <div className="flex gap-2 items-end">
                    <button onClick={() => {setScalingStep(1); setScalePoints([]);}} disabled={!image || scalingStep > 0} className={`${primaryButton} disabled:opacity-50 flex-grow !text-xs`}>Set Scale</button>
                    {image && <button onClick={handleClearMap} className={`${dangerButton} flex-shrink-0`} title="Clear Current Map"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg></button>}
                </div>
                 <div className="text-center p-2 bg-slate-800 rounded-lg border border-slate-700">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Calibration</p>
                    <p className="font-mono text-cyan-300 text-xs">{scale ? `${scale.meters.toFixed(1)}m / ${scale.pixels.toFixed(0)}px` : 'Not Calibrated'}</p>
                </div>
            </div>

            <div 
                ref={mapContainerRef} 
                className="relative w-full h-[550px] bg-slate-900 rounded-xl border border-slate-700 overflow-hidden shadow-inner cursor-default touch-none" 
                onMouseMove={handleMouseMove} 
                onMouseUp={() => setDraggingIndex(null)} 
                onMouseLeave={() => setDraggingIndex(null)} 
                onTouchMove={handleTouchMove}
                onTouchEnd={() => setDraggingIndex(null)}
                onClick={handleMapClick}
            >
                {image ? <img src={image} className="w-full h-full object-contain pointer-events-none no-invert" alt="Map Layer"/> : <div className="flex items-center justify-center h-full text-slate-600 font-mono italic">Upload a map and place your {activeContext === 'festival' ? 'stages' : 'exhibition booths'}...</div>}
                {scalingStep > 0 && <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-2 rounded-full text-xs font-black shadow-2xl animate-bounce">Click Point {scalingStep} of 2 on the Map</div>}
                {image && zoneConfigs.map((zone, index) => {
                    const pos = positions[index] || { x: 50 + index * 30, y: 50 + index * 30 };
                    return (
                        <div key={index} className="absolute" style={{ left: `${pos.x}px`, top: `${pos.y}px` }}>
                            <div 
                                className={`absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 ${activeContext === 'festival' ? 'bg-indigo-500' : 'bg-purple-500'} rounded-full border-2 border-white shadow-xl cursor-grab active:cursor-grabbing ring-2 ring-black/20 z-10 touch-none`} 
                                onMouseDown={(e) => handleDragStart(e, index)}
                                onTouchStart={(e) => handleDragStart(e, index)}
                            />
                            <div className="absolute left-6 top-1/2 -translate-y-1/2 whitespace-nowrap bg-slate-900/90 px-2 py-1 rounded border border-white/10 shadow-lg pointer-events-none"><span className="text-white font-black text-[10px] uppercase tracking-tighter">{zone.name}</span></div>
                        </div>
                    );
                })}
                {scalePoints.map((p, i) => <div key={i} className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 bg-yellow-400 rounded-full border-2 border-black" style={{left: p.x, top: p.y}} />)}
                {scalePoints.length === 2 && <svg className="absolute top-0 left-0 w-full h-full pointer-events-none"><line x1={scalePoints[0].x} y1={scalePoints[0].y} x2={scalePoints[1].x} y2={scalePoints[1].y} stroke="#facc15" strokeWidth="2" strokeDasharray="6,4" /></svg>}
                {isDistanceModalOpen && <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50"><div className="bg-slate-800 p-6 rounded-xl shadow-2xl border border-blue-500/30 max-w-sm w-full"><h3 className="text-lg font-bold text-white mb-4">Set Calibration</h3><p className="text-slate-400 text-xs mb-4">Enter the real-world distance between the two points in meters.</p><div className="flex gap-2 items-center mb-6"><input type="number" value={distanceInputValue} onChange={e => setDistanceInputValue(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-md p-3 text-white font-mono" placeholder="Distance (m)"/><span className="text-slate-500 font-bold">m</span></div><div className="flex gap-3"><button onClick={handleDistanceSubmit} className={`${primaryButton} flex-1`}>Apply</button><button onClick={() => {setIsDistanceModalOpen(false); setScalingStep(0);}} className={`${secondaryButton} flex-1`}>Cancel</button></div></div></div>}
            </div>
        </Card>
    );
};

export default SiteMapTab;