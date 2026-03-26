import React, { useState } from 'react';
import { UK_TV_CHANNELS, US_TV_CHANNELS } from '../constants';
import { TVChannelState } from '../types';
import { useTvLookup } from '../hooks/useTvLookup';

import { gridRefToWgs84, osgbToWgs84 } from '../src/lib/coordUtils';

interface TvGridProps {
    tvRegion: 'uk' | 'us';
    setTvRegion?: (region: 'uk' | 'us') => void;
    tvStates: Record<number, TVChannelState>;
    setTvStates: (states: Record<number, TVChannelState>) => void;
    tvChannelErpData?: Record<number, { maxErp: number, transmitterName: string, distance?: number }>;
    handleTvChannelCycle: (channel: number) => void;
    handleBlockAllTvChannels: () => void;
    handleClearTv: () => void;
    className?: string;
}

const TvGrid: React.FC<TvGridProps> = ({
    tvRegion,
    setTvRegion,
    tvStates,
    setTvStates,
    tvChannelErpData,
    handleTvChannelCycle,
    handleBlockAllTvChannels,
    handleClearTv,
    className = ""
}) => {
    const { handleLookup, isLocating, tvChannelErpData: hookErpData, setTvChannelErpData } = useTvLookup(tvRegion, setTvStates);
    const [coordType, setCoordType] = useState<'latlng' | 'osgb' | 'gridref'>('latlng');
    const [latInput, setLatInput] = useState('');
    const [lngInput, setLngInput] = useState('');
    const [osgbEasting, setOsgbEasting] = useState('');
    const [osgbNorthing, setOsgbNorthing] = useState('');
    const [gridRefInput, setGridRefInput] = useState('');

    const [infoChannel, setInfoChannel] = useState<number | null>(null);
    const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
    const [isLongPressTriggered, setIsLongPressTriggered] = useState(false);

    const handleTouchStart = (ch: number) => {
        setIsLongPressTriggered(false);
        const timer = setTimeout(() => {
            setIsLongPressTriggered(true);
            setInfoChannel(ch);
        }, 500);
        setLongPressTimer(timer);
    };

    const handleTouchMove = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            setLongPressTimer(null);
        }
    };

    const handleTouchEnd = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            setLongPressTimer(null);
        }
    };

    const handleClick = (ch: number, e: React.MouseEvent) => {
        if (isLongPressTriggered) {
            e.preventDefault();
            e.stopPropagation();
            setIsLongPressTriggered(false);
            return;
        }
        handleTvChannelCycle(ch);
    };

    const channels = tvRegion === 'uk' ? UK_TV_CHANNELS : US_TV_CHANNELS;

    const handleManualLookup = () => {
        let lat = 0, lng = 0;
        if (coordType === 'latlng') {
            lat = parseFloat(latInput);
            lng = parseFloat(lngInput);
        } else if (coordType === 'osgb') {
            const result = osgbToWgs84(parseFloat(osgbEasting), parseFloat(osgbNorthing));
            lat = result.lat;
            lng = result.lng;
        } else if (coordType === 'gridref') {
            const result = gridRefToWgs84(gridRefInput);
            if (!result) {
                alert("Invalid Grid Reference format. Example: TQ 300 800");
                return;
            }
            lat = result.lat;
            lng = result.lng;
        }
        handleLookup(lat, lng);
    };

    const handleLocateMe = () => {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                handleLookup(position.coords.latitude, position.coords.longitude);
            },
            (err) => {
                console.error("Geolocation error:", err);
                alert("Failed to get your location. Please check permissions.");
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    return (
        <div className={`space-y-4 ${className}`}>
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Quad-State TV Grid</h4>
                    <div className="flex gap-2">
                        {setTvRegion && (
                            <select value={tvRegion} onChange={e => setTvRegion(e.target.value as any)} className="bg-slate-800 text-[10px] border border-slate-700 rounded px-1 py-1 text-slate-200 font-bold outline-none">
                                <option value="uk">UK</option>
                                <option value="us">US</option>
                            </select>
                        )}
                        <button onClick={handleBlockAllTvChannels} className="text-[9px] font-black uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-1 rounded hover:bg-rose-600 hover:text-white transition-all">Block All</button>
                        <button onClick={() => { handleClearTv(); setTvChannelErpData({}); }} className="text-[9px] font-black uppercase bg-slate-800 text-slate-400 border border-slate-700 px-2 py-1 rounded hover:bg-slate-700 hover:text-white transition-all">Clear All</button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 bg-slate-900/50 p-2 rounded-lg border border-slate-700">
                    {tvRegion === 'uk' && (
                        <select 
                            value={coordType} 
                            onChange={(e) => setCoordType(e.target.value as any)}
                            className="bg-slate-800 text-[10px] border border-slate-700 rounded px-1 py-1 text-slate-200 font-bold outline-none"
                        >
                            <option value="latlng">Lat/Lng</option>
                            <option value="osgb">East/North</option>
                            <option value="gridref">Grid Ref</option>
                        </select>
                    )}
                    
                    {coordType === 'latlng' && (
                        <>
                            <input type="number" placeholder="51.507" value={latInput} onChange={e => setLatInput(e.target.value)} className="w-20 bg-slate-800 text-xs border border-slate-700 rounded px-1 py-1 text-slate-200 font-bold placeholder:text-slate-500" />
                            <input type="number" placeholder="-0.127" value={lngInput} onChange={e => setLngInput(e.target.value)} className="w-20 bg-slate-800 text-xs border border-slate-700 rounded px-1 py-1 text-slate-200 font-bold placeholder:text-slate-500" />
                        </>
                    )}

                    {coordType === 'osgb' && (
                        <>
                            <input type="number" placeholder="Eastings" value={osgbEasting} onChange={e => setOsgbEasting(e.target.value)} className="w-20 bg-slate-800 text-xs border border-slate-700 rounded px-1 py-1 text-slate-200 font-bold placeholder:text-slate-500" />
                            <input type="number" placeholder="Northings" value={osgbNorthing} onChange={e => setOsgbNorthing(e.target.value)} className="w-20 bg-slate-800 text-xs border border-slate-700 rounded px-1 py-1 text-slate-200 font-bold placeholder:text-slate-500" />
                        </>
                    )}

                    {coordType === 'gridref' && (
                        <input type="text" placeholder="TQ 300 800" value={gridRefInput} onChange={e => setGridRefInput(e.target.value)} className="w-24 bg-slate-800 text-xs border border-slate-700 rounded px-1 py-1 text-slate-200 font-bold placeholder:text-slate-500" />
                    )}

                    <button 
                        onClick={handleManualLookup} 
                        disabled={isLocating}
                        className={`text-xs font-black uppercase bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-1 rounded hover:bg-indigo-600 hover:text-white transition-all ${isLocating ? 'animate-pulse' : ''}`}
                    >
                        Lookup
                    </button>
                    <button 
                        onClick={handleLocateMe} 
                        disabled={isLocating}
                        className={`text-xs font-black uppercase bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-1 rounded hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-1.5 ${isLocating ? 'animate-pulse' : ''}`}
                    >
                        {isLocating ? <span className="w-2 h-2 border border-white/20 border-t-white rounded-full animate-spin" /> : '📍'}
                        {isLocating ? 'Locating...' : 'Locate Me'}
                    </button>
                </div>
                
                
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-11 gap-2">
                {Object.entries(channels).map(([chStr, [start, end]]) => {
                    const ch = parseInt(chStr);
                    const state = tvStates[ch] || 'available';
                    const erpData = tvChannelErpData?.[ch] || hookErpData?.[ch];

                    let channelClasses = 'p-1.5 text-center rounded-lg border-2 transition-all cursor-pointer select-none ';
                    if (state === 'blocked') channelClasses += 'bg-rose-600 border-rose-500 hover:bg-rose-500 shadow-lg';
                    else if (state === 'mic-only') channelClasses += 'bg-sky-400 border-sky-300 hover:bg-sky-300 shadow-lg';
                    else if (state === 'iem-only') channelClasses += 'bg-amber-500 border-amber-400 hover:bg-amber-400 shadow-lg';
                    else channelClasses += 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/50';

                    return (
                        <div key={ch} className="flex flex-col gap-1">
                            <button 
                                onClick={(e) => handleClick(ch, e)}
                                onTouchStart={() => handleTouchStart(ch)}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                                onTouchCancel={handleTouchEnd}
                                className={channelClasses} 
                                title={erpData ? `${erpData.transmitterName} (ERP: ${erpData.maxErp}kW${erpData.distance ? `, Dist: ${erpData.distance}km` : ''})` : `${start}-${end} MHz`}
                            >
                                <div className={`text-[10px] font-black ${state === 'available' ? 'text-emerald-400' : 'text-slate-900'}`}>{ch}</div>
                                <div className="mt-0.5 text-[7px] font-black uppercase text-white/40">
                                    {state === 'mic-only' && 'MIC'}
                                    {state === 'iem-only' && 'IEM'}
                                    {state === 'blocked' && 'OFF'}
                                    {state === 'available' && '—'}
                                </div>
                            </button>
                            {erpData && (
                                <div className="flex gap-0.5 h-1 w-full">
                                    <div className={`flex-1 rounded-sm ${erpData.maxErp > 40 ? 'bg-red-500' : 'bg-slate-800'}`} />
                                    <div className={`flex-1 rounded-sm ${erpData.maxErp > 1 && erpData.maxErp <= 40 ? 'bg-amber-400' : 'bg-slate-800'}`} />
                                    <div className={`flex-1 rounded-sm ${erpData.maxErp <= 1 ? 'bg-emerald-400' : 'bg-slate-800'}`} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            {infoChannel !== null && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setInfoChannel(null)}>
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-sm text-slate-200" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-4 text-indigo-400">Channel {infoChannel} Info</h3>
                        {tvChannelErpData?.[infoChannel] || hookErpData?.[infoChannel] ? (
                            <div className="space-y-2">
                                <p><span className="text-slate-500">Transmitter:</span> {(tvChannelErpData?.[infoChannel] || hookErpData?.[infoChannel])!.transmitterName}</p>
                                <p><span className="text-slate-500">Max ERP:</span> {(tvChannelErpData?.[infoChannel] || hookErpData?.[infoChannel])!.maxErp} kW</p>
                                {(tvChannelErpData?.[infoChannel] || hookErpData?.[infoChannel])!.distance && (
                                    <p><span className="text-slate-500">Distance:</span> {(tvChannelErpData?.[infoChannel] || hookErpData?.[infoChannel])!.distance} km</p>
                                )}
                            </div>
                        ) : (
                            <p className="text-slate-500">No transmitter data available for this channel.</p>
                        )}
                        <button onClick={() => setInfoChannel(null)} className="mt-6 w-full bg-indigo-600 text-white py-2 rounded-lg font-bold">Close</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TvGrid;
