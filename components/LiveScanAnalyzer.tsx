import React, { useState, useRef, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { ScanDataPoint, TVChannelState } from '../types';
import { UK_TV_CHANNELS, US_TV_CHANNELS } from '../constants';
import Card, { CardTitle } from './Card';
import { HardwareSetupGuide } from './HardwareSetupGuide';
import { db, auth } from '../src/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { InfoTooltip } from './InfoTooltip';

interface LiveScanAnalyzerProps {
    scanData: ScanDataPoint[] | null;
    tvRegion: 'uk' | 'us';
    tvChannelStates: Record<number, TVChannelState>;
    onBlockChannel: (channel: number, state: TVChannelState) => void;
    onBulkUpdateChannels: (updates: Record<number, TVChannelState>) => void;
    onSimulate: () => void;
    threshold: number;
    onThresholdChange: (value: number) => void;
    onScanDataUpdate?: (data: ScanDataPoint[]) => void;
    className?: string;
}

import { requestSerialPort, connectToTinySA, readTinySAScan, SerialDevice, getDeviceVersion } from '../services/serialService';

const LiveScanAnalyzer: React.FC<LiveScanAnalyzerProps> = ({
    scanData,
    tvRegion,
    tvChannelStates,
    onBlockChannel,
    onBulkUpdateChannels,
    onSimulate,
    threshold,
    onThresholdChange,
    onScanDataUpdate,
    className = ""
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [showTvGrid, setShowTvGrid] = useState(true);
    const [showMaxHold, setShowMaxHold] = useState(true);
    const [maxHoldData, setMaxHoldData] = useState<ScanDataPoint[]>([]);
    const [isDraggingThreshold, setIsDraggingThreshold] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const [panStartX, setPanStartX] = useState<number | null>(null);
    const [panStartMinFreq, setPanStartMinFreq] = useState<number | null>(null);
    const [panStartMaxFreq, setPanStartMaxFreq] = useState<number | null>(null);
    const [hoverFreq, setHoverFreq] = useState<number | null>(null);
    const [hoverAmp, setHoverAmp] = useState<number | null>(null);

    const channels = tvRegion === 'uk' ? UK_TV_CHANNELS : US_TV_CHANNELS;
    const tvMinFreq = useMemo(() => Math.min(...Object.values(channels).map(c => c[0])), [channels]);
    const tvMaxFreq = useMemo(() => Math.max(...Object.values(channels).map(c => c[1])), [channels]);
    
    const [displayMinFreq, setDisplayMinFreq] = useState<number>(tvMinFreq);
    const [displayMaxFreq, setDisplayMaxFreq] = useState<number>(tvMaxFreq);

    // Hardware Connection State
    const [device, setDevice] = useState<SerialDevice | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [refreshRate, setRefreshRate] = useState(1000); // ms
    const [scanStatus, setScanStatus] = useState<string>('');
    const [debugLogs, setDebugLogs] = useState<string[]>([]);
    const [hardwareVersion, setHardwareVersion] = useState<string | null>(null);
    const [baudRate, setBaudRate] = useState<number>(115200);
    const [rawLog, setRawLog] = useState<string[]>([]);
    const [manualCommand, setManualCommand] = useState<string>('');
    const [isPaused, setIsPaused] = useState<boolean>(false);
    const [isBaudScanning, setIsBaudScanning] = useState<boolean>(false);
    const [isSharing, setIsSharing] = useState<boolean>(false);
    const [showTerminal, setShowTerminal] = useState<boolean>(false);
    const [showSetup, setShowSetup] = useState<boolean>(false);
    const [showTinySAScreen, setShowTinySAScreen] = useState<boolean>(false);
    const [deviceType, setDeviceType] = useState<'tinysa'>('tinysa');
    const [showShareModal, setShowShareModal] = useState<boolean>(false);
    const [shareMeta, setShareMeta] = useState({ location: '', festival: '', stage: '', notes: '' });

    const handleShareScanClick = () => {
        if (!auth.currentUser) return;
        setShowShareModal(true);
    };

    const confirmShareScan = async () => {
        if (!canvasRef.current || !auth.currentUser) return;
        setIsSharing(true);
        try {
            const imageData = canvasRef.current.toDataURL('image/jpeg', 0.8);
            
            // Downsample scan data for storage to avoid exceeding Firestore limits
            let rawScanData = null;
            if (scanData && scanData.length > 0) {
                // Keep max 500 points to stay well under 1MB limit
                const step = Math.max(1, Math.floor(scanData.length / 500));
                const downsampled = scanData.filter((_, i) => i % step === 0);
                rawScanData = JSON.stringify(downsampled);
            }

            await addDoc(collection(db, 'plots'), {
                userId: auth.currentUser.uid,
                userName: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Anonymous',
                timestamp: Date.now(),
                projectId: 'global',
                imageData,
                description: `Live Scan Capture (${displayMinFreq.toFixed(1)} - ${displayMaxFreq.toFixed(1)} MHz)`,
                location: shareMeta.location,
                festival: shareMeta.festival,
                stage: shareMeta.stage,
                notes: shareMeta.notes,
                comments: [],
                ...(rawScanData ? { rawScanData } : {})
            });
            addLog('Scan shared to Plot Gallery successfully!');
            setShowShareModal(false);
            setShareMeta({ location: '', festival: '', stage: '', notes: '' });
        } catch (error: any) {
            console.error('Error sharing scan:', error);
            addLog(`Failed to share scan: ${error.message}`);
        } finally {
            setIsSharing(false);
        }
    };

    const addLog = (msg: string) => {
        setDebugLogs(prev => [msg, ...prev].slice(0, 5));
    };

    const addRawLog = (data: string) => {
        setRawLog(prev => [data, ...prev].slice(0, 10));
    };

    const handleConnect = async () => {
        setIsConnecting(true);
        setHardwareVersion(null);
        console.log(`Attempting to connect to ${deviceType}...`);
        let port: any = null;
        try {
            if (!('serial' in navigator)) {
                throw new Error('Web Serial API is not supported in this browser. Please use Chrome or Edge.');
            }
            
            port = await requestSerialPort();
            console.log(`Port selected, opening connection at ${baudRate} baud...`);
            
            const { connectToDevice } = await import('../services/serialService');
            const dev = await connectToDevice(port, baudRate, deviceType);
            
            console.log(`${deviceType} serial port opened`);
            addLog('Serial Port Opened. Waking up...');
            
            // Wake up device
            const { forceWakeUp } = await import('../services/serialService');
            await forceWakeUp(dev);
            addLog('Wake up command sent.');
            
            // Set device immediately so UI shows we are connected
            setDevice(dev);

            // Try to get version
            try {
                const version = await getDeviceVersion(dev, (raw) => addRawLog(raw));
                if (version) {
                    setHardwareVersion(version);
                    addLog(`Device Identified: ${version}`);
                } else {
                    addLog('Identification timed out. Device might be busy.');
                }
            } catch (vErr) {
                console.warn('Version check failed:', vErr);
                addLog('Identification failed. Proceeding anyway.');
            }
        } catch (err: any) {
            console.error('Failed to connect:', err);
            if (port) {
                try { await port.close(); } catch (e) {}
            }
            if (err.name === 'SecurityError' || err.message.includes('permissions policy')) {
                toast.error(`Permission Error: The browser is blocking access to the USB port. Ensure you are using the app in a full browser tab and a desktop browser like Chrome.`);
            } else if (err.name === 'NotFoundError') {
                // User cancelled
            } else {
                toast.error(`Failed to connect: ${err.message}`);
            }
        } finally {
            setIsConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        if (device) {
            const { disconnectTinySA } = await import('../services/serialService');
            await disconnectTinySA(device);
            setDevice(null);
            setHardwareVersion(null);
            addLog('Disconnected');
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (device) {
                import('../services/serialService').then(({ disconnectTinySA }) => {
                    disconnectTinySA(device).catch(console.error);
                });
            }
        };
    }, [device]);

    // Continuous Refresh Loop
    useEffect(() => {
        if (!device) return;

        let active = true;
        let iteration = 0;
        const loop = async () => {
            while (active && device) {
                if (isPaused) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    continue;
                }
                try {
                    // 1. Read Scan Data
                    if (onScanDataUpdate) {
                        let data: ScanDataPoint[] = [];
                        if (deviceType === 'tinysa') {
                            data = await readTinySAScan(device, displayMinFreq, displayMaxFreq, 290, (status) => {
                                setScanStatus(status);
                            }, (raw) => addRawLog(raw));
                        }
                        
                        if (data && data.length > 0) {
                            onScanDataUpdate(data);
                        } else {
                            addLog('Scan returned no data');
                        }
                    }
                    iteration++;
                } catch (err: any) {
                    console.error('TinySA Loop Error:', err);
                    addLog(`Loop Error: ${err.message}`);
                }
                // Wait for refresh rate
                await new Promise(resolve => setTimeout(resolve, refreshRate));
            }
        };

        loop();
        return () => { active = false; };
    }, [device, displayMinFreq, displayMaxFreq, refreshRate, onScanDataUpdate, isPaused]);

    // Reset display range when region changes
    useEffect(() => {
        setDisplayMinFreq(tvMinFreq);
        setDisplayMaxFreq(tvMaxFreq);
    }, [tvMinFreq, tvMaxFreq]);

    const minAmp = -110;
    const maxAmp = -20;

    // Update Max Hold Data
    useEffect(() => {
        if (!scanData || scanData.length === 0) return;
        
        setMaxHoldData(prev => {
            if (prev.length === 0 || prev.length !== scanData.length) return [...scanData];
            return prev.map((p, i) => ({
                freq: p.freq,
                amp: Math.max(p.amp, scanData[i].amp)
            }));
        });
    }, [scanData]);

    const handleResetMaxHold = () => setMaxHoldData([]);

    const getX = (freq: number, width: number) => {
        return ((freq - displayMinFreq) / (displayMaxFreq - displayMinFreq)) * width;
    };

    const getY = (amp: number, height: number) => {
        return height - ((amp - minAmp) / (maxAmp - minAmp)) * height;
    };

    const getFreqFromX = (x: number, width: number) => {
        return displayMinFreq + (x / width) * (displayMaxFreq - displayMinFreq);
    };

    const getAmpFromY = (y: number, height: number) => {
        return minAmp + ((height - y) / height) * (maxAmp - minAmp);
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resize = () => {
            if (containerRef.current) {
                canvas.width = containerRef.current.clientWidth;
                canvas.height = 320; 
                draw();
            }
        };

        const draw = () => {
            const { width, height } = canvas;
            ctx.clearRect(0, 0, width, height);

            // Draw Background Grid (Dot Grid)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            const stepX = width / 10;
            const stepY = height / 10;
            for (let x = 0; x <= width; x += stepX) {
                for (let y = 0; y <= height; y += stepY) {
                    ctx.beginPath();
                    ctx.arc(x, y, 0.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Draw Major Grid Lines
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.lineWidth = 1;
            for (let i = 1; i < 10; i++) {
                // Vertical
                ctx.beginPath();
                ctx.moveTo(i * stepX, 0);
                ctx.lineTo(i * stepX, height);
                ctx.stroke();
                // Horizontal
                ctx.beginPath();
                ctx.moveTo(0, i * stepY);
                ctx.lineTo(width, i * stepY);
                ctx.stroke();
            }
            
            // Amplitude Labels (Y-axis)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.font = '9px "JetBrains Mono", monospace';
            for (let amp = minAmp; amp <= maxAmp; amp += 10) {
                const y = getY(amp, height);
                ctx.fillText(`${amp}`, 5, y + 3);
            }

            // TV Grid Overlay
            if (showTvGrid) {
                Object.entries(channels).forEach(([chStr, [start, end]]) => {
                    // Only draw if it overlaps with the display range
                    if (end < displayMinFreq || start > displayMaxFreq) return;

                    const ch = parseInt(chStr);
                    const xStart = getX(start, width);
                    const xEnd = getX(end, width);
                    const state = tvChannelStates[ch] || 'available';
                    
                    ctx.fillStyle = state === 'blocked' ? 'rgba(244, 63, 94, 0.08)' : 
                                   state === 'mic-only' ? 'rgba(56, 189, 248, 0.08)' :
                                   state === 'iem-only' ? 'rgba(245, 158, 11, 0.08)' :
                                   'rgba(16, 185, 129, 0.03)';
                    
                    ctx.fillRect(xStart, 0, xEnd - xStart, height);
                    
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
                    ctx.beginPath();
                    ctx.moveTo(xStart, 0);
                    ctx.lineTo(xStart, height);
                    ctx.stroke();

                    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
                    ctx.font = 'bold 8px sans-serif';
                    ctx.fillText(chStr, xStart + 2, height - 5);
                });
            }

            // Draw Max Hold Data (Yellow)
            if (showMaxHold && maxHoldData.length > 0) {
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)'; // Amber/Yellow
                ctx.lineWidth = 1;
                let started = false;
                maxHoldData.forEach((p) => {
                    if (p.freq < displayMinFreq || p.freq > displayMaxFreq) return;
                    const x = getX(p.freq, width);
                    const y = getY(p.amp, height);
                    if (!started) {
                        ctx.moveTo(x, y);
                        started = true;
                    } else {
                        ctx.lineTo(x, y);
                    }
                });
                ctx.stroke();
            }

            // Draw Live Scan Data (Cyan with Glow)
            if (scanData && scanData.length > 0) {
                // Glow effect
                ctx.shadowBlur = 8;
                ctx.shadowColor = 'rgba(34, 211, 238, 0.5)';
                
                ctx.beginPath();
                ctx.strokeStyle = '#22d3ee'; // Cyan
                ctx.lineWidth = 1.5;
                ctx.lineJoin = 'round';

                let started = false;
                let firstX = 0;
                let lastX = width;

                scanData.forEach((p) => {
                    if (p.freq < displayMinFreq || p.freq > displayMaxFreq) return;
                    const x = getX(p.freq, width);
                    const y = getY(p.amp, height);
                    if (!started) {
                        ctx.moveTo(x, y);
                        firstX = x;
                        started = true;
                    } else {
                        ctx.lineTo(x, y);
                        lastX = x;
                    }
                });
                ctx.stroke();
                
                // Reset shadow
                ctx.shadowBlur = 0;

                // Fill under the curve
                if (started) {
                    ctx.lineTo(lastX, height);
                    ctx.lineTo(firstX, height);
                    const gradient = ctx.createLinearGradient(0, 0, 0, height);
                    gradient.addColorStop(0, 'rgba(34, 211, 238, 0.15)');
                    gradient.addColorStop(1, 'rgba(34, 211, 238, 0)');
                    ctx.fillStyle = gradient;
                    ctx.fill();
                }
            }

            // Draw Threshold Line
            const thresholdY = getY(threshold, height);
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)'; // Amber
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, thresholdY);
            ctx.lineTo(width, thresholdY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Threshold Label
            ctx.fillStyle = '#f59e0b';
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            ctx.fillText(`LIMIT: ${threshold}dBm`, width - 100, thresholdY - 5);
            
            // Draggable handle
            ctx.beginPath();
            ctx.arc(width - 5, thresholdY, 4, 0, Math.PI * 2);
            ctx.fill();

            // Digital Readouts (Analyzer Style)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.font = '10px "JetBrains Mono", monospace';
            ctx.fillText(`REF: ${maxAmp}dBm`, 10, 20);
            ctx.fillText(`10dB/DIV`, 10, 35);
            
            ctx.textAlign = 'left';
            ctx.fillText(`START: ${displayMinFreq.toFixed(1)}MHz`, 10, height - 10);
            ctx.textAlign = 'right';
            ctx.fillText(`STOP: ${displayMaxFreq.toFixed(1)}MHz`, width - 10, height - 10);
            ctx.textAlign = 'center';
            ctx.fillText(`CENTER: ${((displayMinFreq + displayMaxFreq) / 2).toFixed(1)}MHz`, width / 2, height - 10);
        };

        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, [scanData, maxHoldData, tvRegion, tvChannelStates, threshold, showTvGrid, showMaxHold, displayMinFreq, displayMaxFreq]);

    const handleMouseDown = (e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const thresholdY = getY(threshold, rect.height);
        
        if (Math.abs(y - thresholdY) < 15) {
            setIsDraggingThreshold(true);
        } else {
            setIsPanning(true);
            setPanStartX(x);
            setPanStartMinFreq(displayMinFreq);
            setPanStartMaxFreq(displayMaxFreq);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setHoverFreq(getFreqFromX(x, rect.width));
        setHoverAmp(getAmpFromY(y, rect.height));

        if (isDraggingThreshold) {
            const newAmp = Math.round(getAmpFromY(y, rect.height));
            onThresholdChange(Math.max(minAmp, Math.min(maxAmp, newAmp)));
        } else if (isPanning && panStartX !== null && panStartMinFreq !== null && panStartMaxFreq !== null) {
            const dx = x - panStartX;
            const freqSpan = panStartMaxFreq - panStartMinFreq;
            const df = -(dx / rect.width) * freqSpan;
            
            // Prevent panning beyond absolute TV limits
            let newMin = panStartMinFreq + df;
            let newMax = panStartMaxFreq + df;
            
            if (newMin < tvMinFreq) {
                newMin = tvMinFreq;
                newMax = tvMinFreq + freqSpan;
            }
            if (newMax > tvMaxFreq) {
                newMax = tvMaxFreq;
                newMin = tvMaxFreq - freqSpan;
            }

            setDisplayMinFreq(newMin);
            setDisplayMaxFreq(newMax);
        }
    };

    const handleMouseUp = () => {
        setIsDraggingThreshold(false);
        setIsPanning(false);
        setPanStartX(null);
        setPanStartMinFreq(null);
        setPanStartMaxFreq(null);
    };

    return (
        <Card className={`relative z-10 flex flex-col ${className}`}>
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-1">
                        <CardTitle className="!mb-0 text-base flex items-center">
                            📡 Live Site Scan Integration
                            <InfoTooltip content="Connect a TinySA device via USB to view real-time RF spectrum data. The amber line sets the threshold above which frequencies are considered occupied." />
                        </CardTitle>
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">
                            Real-time spectrum analysis. Drag amber line to set exclusion threshold.
                        </p>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded text-[8px] text-amber-400 font-bold uppercase tracking-widest flex items-center gap-1 mt-0.5">
                        <span className="text-[10px]">⚠️</span> Requires Chrome, Edge, or Opera (Safari/Firefox not supported)
                    </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap justify-start sm:justify-end w-full">
                    <div className="flex items-center gap-2 bg-slate-900/50 border border-white/5 rounded-lg px-2 py-1 flex-shrink-0">
                        <div className="flex items-center">
                            <span className="text-[8px] text-slate-500 font-bold mr-1">START</span>
                            <input 
                                type="number" 
                                value={displayMinFreq} 
                                onChange={e => setDisplayMinFreq(Number(e.target.value))}
                                className="bg-transparent text-[10px] text-white w-12 outline-none font-mono"
                            />
                        </div>
                        <div className="w-px h-3 bg-white/10" />
                        <div className="flex items-center">
                            <span className="text-[8px] text-slate-500 font-bold mr-1">STOP</span>
                            <input 
                                type="number" 
                                value={displayMaxFreq} 
                                onChange={e => setDisplayMaxFreq(Number(e.target.value))}
                                className="bg-transparent text-[10px] text-white w-12 outline-none font-mono"
                            />
                        </div>
                        <div className="w-px h-3 bg-white/10" />
                        <button 
                            onClick={() => { setDisplayMinFreq(tvMinFreq); setDisplayMaxFreq(tvMaxFreq); }} 
                            className="text-[8px] font-black uppercase px-2 py-0.5 bg-blue-900 text-white rounded hover:bg-blue-800 transition-all shadow-md"
                            title="Reset to full range"
                        >
                            RST
                        </button>
                    </div>

                    <div className="flex bg-slate-800/50 rounded-lg p-0.5 border border-white/5 flex-shrink-0">
                        <button 
                            onClick={() => setShowTvGrid(!showTvGrid)}
                            className={`text-[8px] font-black uppercase px-2 py-1 rounded transition-all ${showTvGrid ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            TV Grid
                        </button>
                        <button 
                            onClick={() => setShowMaxHold(!showMaxHold)}
                            className={`text-[8px] font-black uppercase px-2 py-1 rounded transition-all ${showMaxHold ? 'bg-amber-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Max Hold
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button 
                            onClick={handleResetMaxHold}
                            className="text-[8px] font-black uppercase px-2 py-1 bg-blue-900 text-white rounded hover:bg-blue-800 transition-all shadow-md"
                        >
                            Reset Max
                        </button>
                        <div className="h-4 w-px bg-white/10 mx-1" />
                        <button 
                            onClick={handleShareScanClick}
                            disabled={isSharing || !auth.currentUser}
                            className="text-[8px] font-black uppercase px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-500 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            title={!auth.currentUser ? "Log in to share scans" : "Share to Plot Gallery"}
                        >
                            {isSharing ? 'Sharing...' : 'Share Scan'}
                        </button>
                        <div className="h-4 w-px bg-white/10 mx-1" />
                        <button 
                            onClick={() => {
                                const nextStates = { ...tvChannelStates };
                                let count = 0;
                                Object.entries(channels).forEach(([chStr]) => {
                                    const ch = parseInt(chStr);
                                    if (nextStates[ch] === 'blocked') {
                                        nextStates[ch] = 'available';
                                        count++;
                                    }
                                });
                                onBulkUpdateChannels(nextStates);
                            }}
                            className="text-[8px] font-black uppercase px-2 py-1 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded transition-all shadow-md border border-emerald-500/30"
                            title="Clear all blocked channels"
                        >
                            Reset Blocks
                        </button>
                    </div>

                    <div className="flex flex-col items-center ml-auto sm:ml-0">
                        <div className="text-[10px] font-mono text-cyan-400 bg-black/40 px-2 py-1 rounded border border-white/5 min-w-[160px] text-center">
                            {hoverFreq ? `${hoverFreq.toFixed(3)} MHz` : '---.--- MHz'} | {hoverAmp ? `${hoverAmp.toFixed(1)} dBm` : '--.- dBm'}
                        </div>
                        {scanStatus && (
                            <div className="text-[7px] font-mono text-cyan-500/70 mt-0.5 uppercase tracking-tighter">
                                {scanStatus}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div 
                ref={containerRef} 
                className={`relative bg-black/60 rounded-xl border border-white/10 overflow-hidden flex-grow ${isPanning ? 'cursor-grabbing' : 'cursor-crosshair'}`}
                style={{ minHeight: '300px' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                {!scanData && !device && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm z-20">
                        <div className="text-center">
                            <div className="text-3xl mb-2">🔌</div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No Hardware Connected</p>
                            <p className="text-[9px] text-slate-600 uppercase mt-1">Connect TinySA or RF Explorer via USB to start live scan</p>
                        </div>
                    </div>
                )}
                
                <div className="flex h-full">
                    <div className="flex-1 relative">
                        <canvas 
                            ref={canvasRef} 
                            className="w-full h-full block"
                        />
                    </div>
                </div>
            </div>

            <div className="mt-4 flex flex-col gap-4">
                <div className="bg-slate-900 p-3 rounded-xl border border-indigo-500/30 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="flex items-center gap-3 min-w-[200px]">
                            <div className="w-3 h-6 bg-indigo-500 rounded-full animate-pulse" />
                            <h4 className="text-[14px] font-black text-white uppercase tracking-widest">Hardware Connection</h4>
                        </div>
                        
                        <div className="flex-1 flex items-center justify-end gap-3">
                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${device ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-800 text-slate-500'}`}>
                                {device ? '● Online' : '○ Offline'}
                            </div>
                            
                            {device && (
                                <div className="text-[12px] font-bold text-indigo-300 flex items-center gap-2 px-3">
                                    {hardwareVersion || 'Identifying...'}
                                    {isPaused && <span className="text-[10px] text-amber-500 ml-2 font-black uppercase tracking-widest">[Paused]</span>}
                                </div>
                            )}

                            {!device ? (
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-lg border border-indigo-500/30">
                                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">Speed:</span>
                                        <select 
                                            value={baudRate}
                                            onChange={(e) => setBaudRate(Number(e.target.value))}
                                            className="bg-transparent text-[12px] text-white outline-none font-mono font-bold cursor-pointer"
                                        >
                                            <option value={9600}>9600</option>
                                            <option value={57600}>57600</option>
                                            <option value={115200}>115200</option>
                                            <option value={500000}>500000</option>
                                            <option value={921600}>921600</option>
                                        </select>
                                    </div>
                                    <button 
                                        onClick={async () => {
                                            setIsBaudScanning(true);
                                            addLog('Starting Speed Scan...');
                                            const speeds = [57600, 115200, 9600, 921600];
                                            const { connectToTinySA, sendRawCommand, disconnectTinySA } = await import('../services/serialService');
                                            
                                            try {
                                                // @ts-ignore
                                                const port = await navigator.serial.requestPort();
                                                
                                                for (const speed of speeds) {
                                                    addLog(`Testing ${speed} baud...`);
                                                    setBaudRate(speed);
                                                    let dev: any = null;
                                                    try {
                                                        dev = await connectToTinySA(port, speed);
                                                        const { forceWakeUp } = await import('../services/serialService');
                                                        await forceWakeUp(dev);
                                                        
                                                        const res = await sendRawCommand(dev, '', (raw) => addRawLog(`[${speed}] ${raw}`));
                                                        if (res.includes('ch>')) {
                                                            addLog(`SUCCESS! Found speed: ${speed}`);
                                                            setDevice(dev);
                                                            setShowTinySAScreen(true);
                                                            setIsBaudScanning(false);
                                                            return;
                                                        }
                                                        await disconnectTinySA(dev);
                                                    } catch (e: any) {
                                                        addLog(`${speed} failed: ${e.message}`);
                                                        if (dev) {
                                                            await disconnectTinySA(dev);
                                                        } else {
                                                            try { await port.close(); } catch (err) {}
                                                        }
                                                    }
                                                }
                                                addLog('Speed Scan Finished. No device found.');
                                            } catch (e: any) {
                                                addLog(`Scan Error: ${e.message}`);
                                            } finally {
                                                setIsBaudScanning(false);
                                            }
                                        }}
                                        disabled={isBaudScanning}
                                        className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all whitespace-nowrap"
                                    >
                                        {isBaudScanning ? 'Scanning...' : 'Auto-Detect'}
                                    </button>
                                    <select 
                                        value={deviceType}
                                        onChange={(e) => {
                                            const newType = e.target.value as 'tinysa';
                                            setDeviceType(newType);
                                            setBaudRate(115200);
                                        }}
                                        className="bg-slate-800 border border-indigo-500/30 text-white rounded-lg px-2 py-1.5 text-[10px] font-black uppercase tracking-widest outline-none focus:border-indigo-500"
                                    >
                                        <option value="tinysa">TinySA</option>
                                    </select>
                                    <button 
                                        onClick={handleConnect}
                                        disabled={isConnecting}
                                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/40 rounded-lg text-[10px] font-black text-white uppercase tracking-widest transition-all disabled:opacity-50 whitespace-nowrap"
                                    >
                                        {isConnecting ? 'Connecting...' : 'Connect'}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setIsPaused(!isPaused)}
                                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all shadow-lg whitespace-nowrap ${isPaused ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20' : 'bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white border border-amber-500/30'}`}
                                    >
                                        {isPaused ? 'Resume' : 'Pause'}
                                    </button>
                                    <button 
                                        onClick={handleDisconnect}
                                        className="px-4 py-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap"
                                    >
                                        Disconnect
                                    </button>
                                </div>
                            )}

                            <div className="h-6 w-px bg-white/10 mx-1" />

                            <button
                                onClick={() => setShowTerminal(!showTerminal)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all whitespace-nowrap ${showTerminal ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}`}
                            >
                                {showTerminal ? 'Hide Terminal' : 'Terminal'}
                            </button>
                            <button
                                onClick={() => setShowSetup(!showSetup)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all whitespace-nowrap ${showSetup ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}`}
                            >
                                {showSetup ? 'Hide Setup' : 'Setup Guide'}
                            </button>
                            
                            {!device && (
                                <button 
                                    onClick={onSimulate}
                                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-white/5 rounded-lg text-[9px] font-black text-slate-400 hover:text-white uppercase tracking-widest transition-all whitespace-nowrap"
                                >
                                    {scanData ? 'Stop Demo' : 'Demo'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {showTerminal && (
                    <div className="bg-slate-900 p-4 rounded-xl border border-indigo-500/30 shadow-lg">
                        <div className="grid grid-cols-1 gap-4 mb-4">
                            {device && (
                                <div className="flex flex-wrap gap-2 md:col-span-2 mb-2">
                                    <button 
                                        onClick={async () => {
                                            if (!device) return;
                                            addLog('Attempting Wake Up...');
                                            const { forceWakeUp } = await import('../services/serialService');
                                            await forceWakeUp(device);
                                            addLog('Wake up sequence sent.');
                                        }}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-lg shadow-indigo-600/20"
                                    >
                                        Wake Up
                                    </button>
                                    <button 
                                        onClick={async () => {
                                            if (!device) return;
                                            addLog('Listening for 3s...');
                                            const { listenOnly } = await import('../services/serialService');
                                            const data = await listenOnly(device, 3000, (raw) => addRawLog(raw));
                                            if (data) {
                                                addLog(`Heard ${data.length} chars. Device is talking!`);
                                            } else {
                                                addLog('Silence. No data received.');
                                            }
                                        }}
                                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-lg"
                                    >
                                        Listen Test
                                    </button>
                                    <button 
                                        onClick={async () => {
                                            if (!device) return;
                                            setIsPaused(true);
                                            addLog('Pinging Device...');
                                            const { sendRawCommand } = await import('../services/serialService');
                                            const res = await sendRawCommand(device, '', (raw) => addRawLog(raw));
                                            if (res.includes('ch>')) {
                                                addLog('Ping Success: Device Ready');
                                            } else {
                                                addLog('Ping: No prompt received');
                                            }
                                        }}
                                        className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 rounded-xl text-[10px] font-black uppercase transition-all"
                                    >
                                        Ping
                                    </button>
                                    <button 
                                        onClick={async () => {
                                            if (!device) return;
                                            addLog('Requesting Help Menu...');
                                            const { sendRawCommand } = await import('../services/serialService');
                                            const res = await sendRawCommand(device, 'help', (raw) => addRawLog(raw));
                                            addLog(`Help: ${res.slice(0, 50)}...`);
                                        }}
                                        className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 rounded-xl text-[10px] font-black uppercase transition-all"
                                    >
                                        Get Help
                                    </button>
                                    <button 
                                        onClick={async () => {
                                            if (!device) return;
                                            addLog('Sending Aggressive Reset...');
                                            const encoder = new TextEncoder();
                                            await device.writer.write(encoder.encode('\x03\r\n\x03\r\n\x03\r\nreset\r\n'));
                                            addLog('Reset sequence sent.');
                                        }}
                                        className="px-4 py-2 bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white border border-amber-500/30 rounded-xl text-[10px] font-black uppercase transition-all"
                                    >
                                        Force Reset
                                    </button>
                                </div>
                            )}
                            {device && (
                                <div className="flex flex-wrap gap-2 md:col-span-2 mb-2">
                                <input 
                                    type="text"
                                    value={manualCommand}
                                    onChange={(e) => setManualCommand(e.target.value)}
                                    onKeyDown={async (e) => {
                                        if (e.key === 'Enter' && manualCommand) {
                                            const cmd = manualCommand;
                                            setManualCommand('');
                                            addLog(`Manual Cmd: ${cmd}`);
                                            const { sendRawCommand } = await import('../services/serialService');
                                            const res = await sendRawCommand(device, cmd, (raw) => addRawLog(raw));
                                            addLog(`Response: ${res.slice(0, 50)}...`);
                                        }
                                    }}
                                    placeholder="Type manual command (e.g. info, help, scan) and press Enter"
                                    className="flex-1 bg-black/60 border border-indigo-500/30 rounded-lg px-4 py-2 text-emerald-400 font-mono text-[11px] outline-none focus:border-indigo-500 transition-all"
                                />
                                <button 
                                    onClick={async () => {
                                        if (!manualCommand) return;
                                        const cmd = manualCommand;
                                        setManualCommand('');
                                        addLog(`Manual Cmd: ${cmd}`);
                                        const { sendRawCommand } = await import('../services/serialService');
                                        const res = await sendRawCommand(device, cmd, (raw) => addRawLog(raw));
                                        addLog(`Response: ${res.slice(0, 50)}...`);
                                    }}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase"
                                >
                                    Send
                                </button>
                            </div>
                        )}
                        </div>

                        <div className="bg-black/80 rounded-xl border-2 border-indigo-500/20 p-4 font-mono text-[11px] text-emerald-400 h-[200px] overflow-y-auto relative shadow-inner">
                            <div className="sticky top-0 right-0 float-right flex gap-2 z-10">
                                <button 
                                    onClick={() => setRawLog([])}
                                    className="bg-slate-800 hover:bg-slate-700 text-[7px] text-white uppercase font-black px-2 py-1 rounded shadow-lg"
                                >
                                    Clear
                                </button>
                                <div className="bg-indigo-500 text-[8px] text-white uppercase font-black px-2 py-1 rounded shadow-lg">
                                    Raw Serial Stream
                                </div>
                            </div>
                            {rawLog.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-700 gap-2">
                                    <div className="w-8 h-8 border-2 border-slate-800 border-t-slate-600 rounded-full animate-spin" />
                                    <span className="italic text-[11px] font-bold uppercase tracking-widest">Listening for data...</span>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {rawLog.map((log, i) => (
                                        <div key={i} className="border-l-2 border-emerald-500/20 pl-3 py-0.5 hover:bg-white/5 transition-colors">
                                            <span className="text-emerald-500/20 mr-3 font-bold">[{rawLog.length - i}]</span>
                                            {log}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {showSetup && (
                    <HardwareSetupGuide />
                )}
            </div>

            {showShareModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl">
                        <h3 className="text-lg font-bold text-white mb-4">Share Live Scan</h3>
                        <p className="text-slate-400 text-sm mb-4">Add details to help others find this scan in the Plot Gallery.</p>
                        
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Location / Venue</label>
                                <input 
                                    type="text" 
                                    value={shareMeta.location}
                                    onChange={(e) => setShareMeta({...shareMeta, location: e.target.value})}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                                    placeholder="e.g. O2 Arena, London"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Festival / Event Name</label>
                                <input 
                                    type="text" 
                                    value={shareMeta.festival}
                                    onChange={(e) => setShareMeta({...shareMeta, festival: e.target.value})}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                                    placeholder="e.g. Glastonbury"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Stage</label>
                                <input 
                                    type="text" 
                                    value={shareMeta.stage}
                                    onChange={(e) => setShareMeta({...shareMeta, stage: e.target.value})}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                                    placeholder="e.g. Main Stage"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Notes</label>
                                <textarea 
                                    value={shareMeta.notes}
                                    onChange={(e) => setShareMeta({...shareMeta, notes: e.target.value})}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none h-20 resize-none"
                                    placeholder="Any additional notes about this scan..."
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setShowShareModal(false)} 
                                className="px-4 py-2 rounded-lg text-sm font-bold text-slate-300 hover:bg-slate-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmShareScan} 
                                disabled={isSharing}
                                className="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
                            >
                                {isSharing ? 'Sharing...' : 'Share to Gallery'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
};

export default LiveScanAnalyzer;
