import React, { useState, useMemo } from 'react';
import Card, { CardTitle } from './Card';
import { US_TV_CHANNELS, UK_TV_CHANNELS, US_DTV_DATABASE, UK_DTV_DATABASE, UK_GRID_REF_DATABASE } from '../constants';

const buttonBase = "px-6 py-3 rounded-lg font-bold uppercase tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transform active:translate-y-0.5 shadow-lg";
const primaryButton = `bg-gradient-to-r from-blue-500 to-cyan-600 text-white hover:brightness-110 shadow-blue-500/20 ${buttonBase}`;
const secondaryButton = `bg-slate-700 text-slate-200 border border-slate-600 hover:bg-slate-600 ${buttonBase}`;

const findOccupiedChannels = (loc: string, rgn: 'us' | 'uk', type: 'postcode' | 'ngr'): Set<number> => {
    const occupied = new Set<number>();
    if (!loc) return occupied;

    if (rgn === 'uk') {
        if (type === 'postcode') {
            const postcodeArea = loc.trim().toUpperCase().match(/^[A-Z]+/)?.[0];
            if (postcodeArea && UK_DTV_DATABASE[postcodeArea]) {
                UK_DTV_DATABASE[postcodeArea].forEach(ch => occupied.add(ch));
            }
        } else { // NGR
            const gridPrefix = loc.trim().toUpperCase().substring(0, 2);
            if (gridPrefix && UK_GRID_REF_DATABASE[gridPrefix]) {
                UK_GRID_REF_DATABASE[gridPrefix].forEach(ch => occupied.add(ch));
            }
        }
    } else { // US Logic
        const zipPrefix = loc.trim().substring(0, 3);
        if (zipPrefix && US_DTV_DATABASE[zipPrefix]) {
            US_DTV_DATABASE[zipPrefix].forEach(ch => occupied.add(ch));
        }
    }
    return occupied;
};

const WhiteSpaceTab: React.FC = () => {
    const [region, setRegion] = useState('uk');
    const [locationType, setLocationType] = useState<'postcode' | 'ngr'>('postcode');
    const [occupiedChannels, setOccupiedChannels] = useState<Set<number>>(new Set());
    const [location, setLocation] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const currentChannels = useMemo(() => {
        return region === 'uk' ? UK_TV_CHANNELS : US_TV_CHANNELS;
    }, [region]);

    const totalChannels = Object.keys(currentChannels).length;
    const occupiedCount = occupiedChannels.size;
    const availableCount = totalChannels - occupiedCount;

    const safeRanges = useMemo(() => {
        const ranges: string[] = [];
        Object.entries(currentChannels).forEach(([chStr, rangeVal]) => {
            const [start, end] = rangeVal as [number, number];
            const ch = Number(chStr);
            if (!occupiedChannels.has(ch)) {
                ranges.push(`${start} - ${end} MHz (Ch ${ch})`);
            }
        });
        return ranges;
    }, [occupiedChannels, currentChannels]);
    
    const toggleChannel = (ch: number) => {
        setOccupiedChannels(prev => {
            const next = new Set(prev);
            if (next.has(ch)) {
                next.delete(ch);
            } else {
                next.add(ch);
            }
            return next;
        });
    };

    const handleFetchByLocation = () => {
        setIsLoading(true);
        setHasSearched(false);
    
        const processLocation = (loc: string, type: 'postcode' | 'ngr') => {
            if (!loc) {
                alert(`Please enter a ${region === 'us' ? 'Zip Code' : 'location'}.`);
                setIsLoading(false);
                return;
            }
    
            try {
                setTimeout(() => {
                    const data = findOccupiedChannels(loc, region as 'us' | 'uk', type);
                    setOccupiedChannels(data);
                    setHasSearched(true);
                    setIsLoading(false);
                }, 600);
            } catch (error: any) {
                alert(`Error processing location data: ${error.message}`);
                setIsLoading(false);
            }
        };
        
        if (location) {
             processLocation(location, region === 'uk' ? locationType : 'postcode');
             return;
        }
    
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser. Please enter a location manually.');
            setIsLoading(false);
            return;
        }
        
        const createProxyUrl = (targetUrl: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    let foundLocation;
                    if (region === 'us') {
                        const geoApiUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
                        const response = await fetch(createProxyUrl(geoApiUrl));
                        if (!response.ok) throw new Error('Could not reverse geocode your location.');
                        const data = await response.json();
                        foundLocation = data.postcode;
                    } else { // UK
                        const postcodeApiUrl = `https://api.postcodes.io/postcodes?lon=${longitude}&lat=${latitude}`;
                        const response = await fetch(createProxyUrl(postcodeApiUrl));
                        if (!response.ok) throw new Error('Could not reverse geocode your location.');
                        const data = await response.json();
                        if (data.result && data.result.length > 0) {
                            foundLocation = data.result[0].postcode;
                        } else {
                            throw new Error('No postcode found for your current location.');
                        }
                    }
                    
                    if (foundLocation) {
                        setLocation(foundLocation);
                        setLocationType('postcode'); 
                        processLocation(foundLocation, 'postcode');
                    } else {
                        throw new Error('Could determine a Zip/Postcode from your location.');
                    }
                } catch (error: any) {
                    alert(`Geolocation Error: ${error.message}. Please enter manually.`);
                    setIsLoading(false);
                }
            },
            (error) => { 
                setIsLoading(false);
                alert("Geolocation failed. Please enter manually.");
            }
        );
    };

    const handleRegionChange = (newRegion: string) => {
        setRegion(newRegion);
        setLocationType('postcode');
        setOccupiedChannels(new Set());
        setLocation('');
        setHasSearched(false);
    };
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
                <Card>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-300">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <CardTitle className="!mb-0">Whitespace Finder</CardTitle>
                    </div>

                    <div className="space-y-4">
                         <div>
                            <label className="text-sm text-slate-400 mb-1 block">Region</label>
                            <select value={region} onChange={(e) => handleRegionChange(e.target.value)} className="w-full bg-slate-800 border border-blue-500/30 rounded-md p-2 text-slate-200">
                                <option value="uk">United Kingdom</option>
                                <option value="us">United States</option>
                            </select>
                        </div>
                        {region === 'uk' && (
                             <div>
                                <label className="text-sm text-slate-400 mb-1 block">Location Type</label>
                                <select value={locationType} onChange={(e) => setLocationType(e.target.value as any)} className="w-full bg-slate-800 border border-blue-500/30 rounded-md p-2 text-slate-200">
                                    <option value="postcode">Postcode</option>
                                    <option value="ngr">National Grid Reference</option>
                                </select>
                            </div>
                        )}
                        <div>
                            <label htmlFor="location-input" className="text-sm text-slate-400 mb-1 block">
                                {region === 'us' ? 'Zip Code' : (locationType === 'postcode' ? 'Postcode' : 'Grid Reference')}
                            </label>
                            <input
                                id="location-input"
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder={region === 'us' ? 'e.g., 90210' : (locationType === 'postcode' ? 'e.g., SW1A' : 'e.g., TQ30')}
                                className="w-full bg-slate-800 border border-blue-500/30 rounded-md p-2 text-slate-200"
                            />
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-3 mt-4">
                        <button onClick={handleFetchByLocation} disabled={isLoading} className={primaryButton}>
                            {isLoading ? 'Searching...' : 'Find Whitespace'}
                        </button>
                         <button onClick={() => setOccupiedChannels(new Set())} className={secondaryButton}>
                            Clear Selections
                        </button>
                    </div>
                </Card>

                {region === 'uk' && (
                    <Card className="!bg-slate-800/50 border-blue-500/20">
                        <h4 className="text-sm font-bold text-blue-300 mb-2 flex items-center gap-2">
                            <span>ℹ️</span> Important Note
                        </h4>
                        <div className="text-xs text-slate-400 space-y-2 leading-relaxed">
                            <p>
                                <strong>How this tool works:</strong> This whitespace finder provides estimates based on a simplified, static database of major regional DTV transmitters. It is intended for quick reference and does not account for low-power local relays or temporary frequency restrictions.
                            </p>
                            <p>
                                <strong>For Professional UK Coordination:</strong> Please use the official Ofcom PMSE portal. The <em>UHF Mic Planner</em> tool within the portal provides detailed, authoritative analysis based on specific Postcodes, National Grid References, or Location Names.
                            </p>
                            <div className="pt-2">
                                <a 
                                    href="https://pmse.ofcom.org.uk/" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="block w-full text-center py-2 px-3 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-500/30 rounded text-blue-300 font-semibold transition-colors"
                                >
                                    Access Ofcom PMSE Portal &rarr;
                                </a>
                                <p className="text-[10px] text-center mt-1 text-slate-500">
                                    * A valid PMSE account login is required to use the official planner.
                                </p>
                            </div>
                        </div>
                    </Card>
                )}
            </div>

            <div className="lg:col-span-2 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-800/50 p-4 rounded-lg text-center border border-slate-700">
                        <p className="text-sm text-slate-400">Total Channels</p>
                        <p className="text-3xl font-bold text-white">{totalChannels}</p>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-lg text-center border border-slate-700">
                        <p className="text-sm text-slate-400">Occupied Channels</p>
                        <p className="text-3xl font-bold text-red-400">{occupiedCount}</p>
                    </div>
                     <div className="bg-slate-800/50 p-4 rounded-lg text-center border border-slate-700">
                        <p className="text-sm text-slate-400">Available Channels</p>
                        <p className="text-3xl font-bold text-emerald-400">{availableCount}</p>
                    </div>
                </div>

                <Card>
                    <CardTitle>Available TV Channels</CardTitle>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-11 gap-2">
                        {Object.entries(currentChannels).map(([chStr, range]) => {
                            const ch = Number(chStr);
                            const isOccupied = occupiedChannels.has(ch);
                            
                            let channelClasses = 'p-2 text-center rounded-lg border-2 transition-all cursor-pointer ';
                            if (isOccupied) {
                                channelClasses += 'bg-red-500/20 border-red-500/50 hover:bg-red-500/30';
                            } else {
                                channelClasses += 'bg-emerald-500/20 border-emerald-500/50 hover:bg-yellow-500/20 hover:border-yellow-500';
                            }

                            return (
                                <div key={ch} onClick={() => toggleChannel(ch)} className={channelClasses} title={`${range[0]}-${range[1]} MHz`}>
                                    <div className="font-bold text-white text-base">CH {ch}</div>
                                    <div className="text-xs text-slate-400">{range[0]}-{range[1]}</div>
                                </div>
                            );
                        })}
                    </div>
                    {hasSearched && occupiedCount === 0 && (
                        <div className="mt-4 p-3 bg-emerald-900/40 border border-emerald-500/30 rounded-lg text-center text-emerald-300">
                            No occupied channels found for this location in the database. All channels are marked as available.
                        </div>
                    )}
                </Card>
                 <Card>
                    <CardTitle>Safe Operating Ranges</CardTitle>
                    {safeRanges.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-center">
                            {safeRanges.map((range, i) => (
                                <div key={i} className="bg-slate-700/50 p-2 rounded text-emerald-300 font-mono text-sm">{range}</div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-amber-400 bg-amber-900/40 p-4 rounded-lg">
                            No safe operating ranges found.
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default React.memo(WhiteSpaceTab);