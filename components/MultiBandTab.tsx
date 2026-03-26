import React, { useState, useMemo, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import Card, { CardTitle, Placeholder } from './Card';
import { InfoTooltip } from './InfoTooltip';
import { Frequency, Thresholds, EquipmentProfile, CompatibilityLevel, BandState, BandResult, TVChannelState, TxType, WMASState } from '../types';
import { generateCompatibleFreqs, getFinalThresholds } from '../services/rfService';
import { EQUIPMENT_DATABASE, COMPATIBILITY_PROFILES, UK_TV_CHANNELS } from '../constants';
import TvGrid from './TvGrid';

interface MultiBandTabProps {
    customEquipment: EquipmentProfile[];
    bands: BandState[];
    setBands: React.Dispatch<React.SetStateAction<BandState[]>>;
    results: BandResult[] | null;
    setResults: React.Dispatch<React.SetStateAction<BandResult[] | null>>;
    equipmentOverrides?: Record<string, Partial<Thresholds>>;
    wmasState?: WMASState;
}

const buttonBase = "px-6 py-2.5 rounded-lg font-semibold uppercase tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transform active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed";
const primaryButton = `bg-gradient-to-r from-blue-500 to-cyan-600 text-white border-b-4 border-blue-800 hover:border-blue-700 hover:brightness-110 ${buttonBase}`;
const secondaryButton = `bg-slate-700 text-slate-200 border-b-4 border-slate-900 hover:border-slate-800 hover:bg-slate-600 ${buttonBase}`;
const greenButton = `bg-emerald-500 text-white border-b-4 border-emerald-700 hover:bg-emerald-400 hover:border-emerald-600 ${buttonBase}`;
const dangerButton = `bg-red-600/80 text-white hover:bg-red-500/80 p-2 rounded-lg transition-all duration-200`;

const initialBandState: BandState = {
    id: `band-init`,
    min: '470.000',
    max: '550.000',
    count: '6',
    equipmentKey: 'custom',
    compatibilityLevel: 'standard',
    useManual: false,
    manualParams: {
        fundamental: '0.350',
        twoTone: '0.050',
        threeTone: '0.050'
    },
    type: 'generic'
};

const MultiBandTab: React.FC<MultiBandTabProps> = ({ customEquipment, bands, setBands, results, setResults, equipmentOverrides, wmasState }) => {
    const [tvChannelStates, setTvChannelStates] = useState<Record<number, TVChannelState>>({});
    const [isCalculating, setIsCalculating] = useState(false);

    const allTvChannels = Object.keys(UK_TV_CHANNELS).map(Number);

    const fullEquipmentDatabase = useMemo(() => {
        const customProfiles = customEquipment.reduce((acc, profile) => {
            acc[profile.id!] = profile;
            return acc;
        }, {} as Record<string, EquipmentProfile>);
        return { ...EQUIPMENT_DATABASE, ...customProfiles };
    }, [customEquipment]);

    const { shureProfiles, sennheiserProfiles, lectrosonicsProfiles, otherStandardProfiles } = useMemo(() => {
        const allEntries = Object.entries(fullEquipmentDatabase) as [string, EquipmentProfile][];
        const shure = allEntries.filter(([, p]) => p.name.toLowerCase().includes('shure'));
        const sennheiser = allEntries.filter(([, p]) => p.name.toLowerCase().includes('sennheiser'));
        const lectrosonics = allEntries.filter(([, p]) => p.name.toLowerCase().includes('lectrosonics'));
        const others = allEntries.filter(([k, p]) => 
            !p.isCustom && k !== 'custom' &&
            !p.name.toLowerCase().includes('shure') && 
            !p.name.toLowerCase().includes('sennheiser') &&
            !p.name.toLowerCase().includes('lectrosonics')
        );
        return { shureProfiles: shure, sennheiserProfiles: sennheiser, lectrosonicsProfiles: lectrosonics, otherStandardProfiles: others };
    }, [fullEquipmentDatabase]);

    const handleBandUpdate = (index: number, updates: Partial<BandState>) => {
        setBands(currentBands => currentBands.map((b, i) => {
            if (i !== index) return b;
            
            const updated = { ...b, ...updates };
            
            if (updates.equipmentKey && updates.equipmentKey !== 'custom') {
                const profile = fullEquipmentDatabase[updates.equipmentKey];
                if (profile) {
                    updated.min = profile.minFreq.toFixed(3);
                    updated.max = profile.maxFreq.toFixed(3);
                }
            }
            return updated;
        }));
    };

    const handleManualParamChange = (index: number, param: 'fundamental' | 'twoTone' | 'threeTone', value: string) => {
        setBands(currentBands => currentBands.map((b, i) => 
            i === index ? { ...b, manualParams: { ...b.manualParams, [param]: value } } : b
        ));
    };

    const addBand = () => {
        setBands([...bands, { ...initialBandState, id: `band-${Date.now()}` }]);
    };

    const removeBand = (index: number) => {
        setBands(bands.filter((_, i) => i !== index));
    };

    const handleTvChannelCycle = (channel: number) => {
        setTvChannelStates(prev => {
            const current = prev[channel] || 'available';
            let next: TVChannelState = 'available';
            if (current === 'available') next = 'mic-only';
            else if (current === 'mic-only') next = 'iem-only';
            else if (current === 'iem-only') next = 'blocked';
            else if (current === 'blocked') next = 'available';
            return { ...prev, [channel]: next };
        });
    };

    const handleBlockAllChannels = () => {
        const next: Record<number, TVChannelState> = {};
        allTvChannels.forEach(ch => {
            next[ch] = 'blocked';
        });
        setTvChannelStates(next);
    };

    const resetTvGrid = () => {
        setTvChannelStates({});
    };

    const getDerivedSpacing = (band: BandState) => {
        const dummyFreq: Frequency = { id: 'dummy', value: 0, equipmentKey: band.equipmentKey, compatibilityLevel: band.compatibilityLevel };
        return getFinalThresholds(dummyFreq, fullEquipmentDatabase, equipmentOverrides);
    };

    const coordinateBands = async () => {
        setIsCalculating(true);
        setResults(null);

        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            const bandResults: BandResult[] = bands.map((band, i) => {
                const min = parseFloat(band.min);
                const max = parseFloat(band.max);
                const count = parseInt(band.count, 10);
                const profile = fullEquipmentDatabase[band.equipmentKey];
                const eqType = band.equipmentKey === 'custom' ? (band.type || 'generic') : (profile?.type || 'generic');
                
                if (isNaN(min) || isNaN(max) || isNaN(count) || min >= max || count <= 0) {
                    return { 
                        name: `Band ${i + 1}`, 
                        range: 'Invalid Configuration', 
                        frequencies: [], 
                        params: 'Check Range/Count' 
                    };
                }

                const tvExclusions: {min: number, max: number}[] = [];
                Object.entries(tvChannelStates).forEach(([chStr, state]) => {
                    const ch = Number(chStr);
                    const range = UK_TV_CHANNELS[ch];
                    if (!range) return;
                    
                    const isExclusion = 
                        (state === 'blocked') ||
                        (eqType === 'mic' && state === 'iem-only') ||
                        (eqType === 'iem' && state === 'mic-only');
                    
                    if (isExclusion) {
                        tvExclusions.push({ min: range[0], max: range[1] });
                    }
                });

                if (wmasState && wmasState.nodes) {
                    wmasState.nodes.forEach(node => {
                        if (node.assignedBlock) {
                            tvExclusions.push({
                                min: node.assignedBlock.start,
                                max: node.assignedBlock.end
                            });
                        }
                    });
                }
                
                const tuningStep = profile?.tuningStep && profile.tuningStep > 0 ? profile.tuningStep : 0.025;
                
                const manualTh: Thresholds | undefined = band.useManual ? {
                    fundamental: parseFloat(band.manualParams.fundamental) || 0.35,
                    twoTone: parseFloat(band.manualParams.twoTone) || 0.05,
                    threeTone: parseFloat(band.manualParams.threeTone) || 0.05,
                    fiveTone: 0,
                    sevenTone: 0
                } : undefined;

                const freqs = generateCompatibleFreqs(
                    count, 
                    min, 
                    max, 
                    tuningStep, 
                    tvExclusions,
                    fullEquipmentDatabase,
                    band.equipmentKey,
                    band.compatibilityLevel,
                    equipmentOverrides,
                    manualTh
                );
                
                const thresholds = manualTh || getDerivedSpacing(band);
                const paramsDisplay = `F-F: ${(thresholds.fundamental*1000).toFixed(0)}k, 2T: ${(thresholds.twoTone*1000).toFixed(0)}k, 3T: ${(thresholds.threeTone*1000).toFixed(0)}k`;

                return {
                    name: `Band ${i + 1}`,
                    range: `${min.toFixed(3)}-${max.toFixed(3)} MHz`,
                    frequencies: freqs,
                    params: paramsDisplay
                };
            });
            
            setResults(bandResults);
        } catch (error) {
            console.error("Calculation failed:", error);
            toast.error("An error occurred during calculation. Please check your inputs.");
        } finally {
            setIsCalculating(false);
        }
    };

    const totalGenerated = results?.reduce((sum, r) => sum + r.frequencies.length, 0) || 0;

    return (
        <Card fullWidth>
            <CardTitle>
                🎛️ Multi-Band Coordination
                <InfoTooltip content="Coordinate multiple RF bands simultaneously. Each band can have its own equipment profile and spacing requirements while respecting global intermodulation constraints." />
            </CardTitle>
            <p className="text-slate-300 mb-4 text-sm">Coordinate frequencies across multiple RF bands simultaneously with granular equipment control.</p>

            <div className="space-y-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-[1fr,150px] gap-4 items-start">
                    <div className="space-y-4">
                        {bands.map((band, i) => {
                            const derived = getDerivedSpacing(band);
                            return (
                                <div key={band.id} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 relative">
                                    <div className="absolute top-2 right-2">
                                        <button onClick={() => removeBand(i)} className="text-slate-500 hover:text-red-400" title="Remove Band">&times;</button>
                                    </div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <h4 className="text-blue-300 text-sm font-bold">Band {i + 1} Configuration</h4>
                                        <InfoTooltip content={`Configure the parameters for RF Band ${i + 1}. You can select specific equipment profiles or define custom frequency ranges.`} />
                                    </div>
                                    
                                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-3">
                                        <div className="lg:col-span-2">
                                            <label className="text-slate-400 text-xs block mb-1">Equipment Profile</label>
                                            <select 
                                                value={band.equipmentKey} 
                                                onChange={e => handleBandUpdate(i, { equipmentKey: e.target.value })}
                                                className="w-full bg-slate-800 border border-blue-500/30 rounded-md p-2 text-slate-200 text-sm"
                                            >
                                                <optgroup label="General"><option value="custom">Custom / Generic</option></optgroup>
                                                {customEquipment.length > 0 && <optgroup label="My Custom">{customEquipment.map(p => <option key={p.id} value={p.id}>{p.name} - {p.band}</option>)}</optgroup>}
                                                <optgroup label="Shure">{shureProfiles.map(([key, p]) => <option key={key} value={key}>{p.name} - {p.band}</option>)}</optgroup>
                                                <optgroup label="Sennheiser">{sennheiserProfiles.map(([key, p]) => <option key={key} value={key}>{p.name} - {p.band}</option>)}</optgroup>
                                                <optgroup label="Lectrosonics">{lectrosonicsProfiles.map(([key, p]) => <option key={key} value={key}>{p.name} - {p.band}</option>)}</optgroup>
                                                {otherStandardProfiles.length > 0 && <optgroup label="Other">{otherStandardProfiles.map(([key, p]) => <option key={key} value={key}>{p.name} - {p.band}</option>)}</optgroup>}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-slate-400 text-xs block mb-1">Quantity</label>
                                            <input type="number" value={band.count} onChange={e => handleBandUpdate(i, { count: e.target.value })} min="1" className="w-full bg-slate-800 border border-blue-500/30 rounded-md p-2 text-slate-200 text-sm" />
                                        </div>
                                        <div>
                                            <label className="text-slate-400 text-xs flex items-center gap-1 mb-1">
                                                Compatibility
                                                <InfoTooltip content="Standard: Standard IMD spacing. More Robust: Increased spacing for critical systems. High Density: Reduced spacing for maximum channel count (requires linear equipment)." />
                                            </label>
                                            <select 
                                                value={band.compatibilityLevel} 
                                                onChange={e => handleBandUpdate(i, { compatibilityLevel: e.target.value as CompatibilityLevel })} 
                                                disabled={band.useManual}
                                                className="w-full bg-slate-800 border border-blue-500/30 rounded-md p-2 text-slate-200 text-sm disabled:opacity-50"
                                            >
                                                {Object.entries(COMPATIBILITY_PROFILES).map(([key, value]) => (
                                                    <option key={key} value={key}>{value.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className={`mt-4 p-3 rounded-lg border transition-all ${band.useManual ? 'bg-amber-950/20 border-amber-500/30' : 'bg-slate-800/40 border-slate-700/50'}`}>
                                        <div className="flex items-center justify-between mb-3">
                                            <label className="flex items-center gap-2 cursor-pointer group">
                                                <input 
                                                    type="checkbox" 
                                                    checked={band.useManual} 
                                                    onChange={e => handleBandUpdate(i, { useManual: e.target.checked })} 
                                                    className="w-4 h-4 rounded accent-amber-500 bg-slate-700"
                                                />
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${band.useManual ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-300'}`}>Bespoke Spacing Overrides</span>
                                            </label>
                                            {!band.useManual && <span className="text-[9px] text-slate-600 font-bold uppercase tracking-tighter">Using Profile Logic</span>}
                                        </div>
                                        
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[9px] text-slate-500 uppercase font-bold flex items-center gap-1">
                                                    F-F Guard (MHz)
                                                    <InfoTooltip content="Fundamental to Fundamental spacing. The minimum distance between two carrier frequencies." />
                                                </label>
                                                <input 
                                                    type="number" 
                                                    step="0.001" 
                                                    value={band.useManual ? band.manualParams.fundamental : derived.fundamental.toFixed(3)} 
                                                    readOnly={!band.useManual}
                                                    onChange={e => handleManualParamChange(i, 'fundamental', e.target.value)}
                                                    className={`w-full bg-slate-900 border rounded p-1.5 font-mono text-xs text-center transition-colors ${band.useManual ? 'border-amber-500/50 text-amber-300' : 'border-slate-700 text-slate-400'}`}
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[9px] text-slate-500 uppercase font-bold flex items-center gap-1">
                                                    2-Tone IMD (MHz)
                                                    <InfoTooltip content="2-Tone 3rd Order Intermodulation spacing. Protects against products generated by two transmitters." />
                                                </label>
                                                <input 
                                                    type="number" 
                                                    step="0.001" 
                                                    value={band.useManual ? band.manualParams.twoTone : derived.twoTone.toFixed(3)} 
                                                    readOnly={!band.useManual}
                                                    onChange={e => handleManualParamChange(i, 'twoTone', e.target.value)}
                                                    className={`w-full bg-slate-900 border rounded p-1.5 font-mono text-xs text-center transition-colors ${band.useManual ? 'border-amber-500/50 text-amber-300' : 'border-slate-700 text-slate-400'}`}
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[9px] text-slate-500 uppercase font-bold flex items-center gap-1">
                                                    3-Tone IMD (MHz)
                                                    <InfoTooltip content="3-Tone 3rd Order Intermodulation spacing. Protects against products generated by three transmitters." />
                                                </label>
                                                <input 
                                                    type="number" 
                                                    step="0.001" 
                                                    value={band.useManual ? band.manualParams.threeTone : derived.threeTone.toFixed(3)} 
                                                    readOnly={!band.useManual}
                                                    onChange={e => handleManualParamChange(i, 'threeTone', e.target.value)}
                                                    className={`w-full bg-slate-900 border rounded p-1.5 font-mono text-xs text-center transition-colors ${band.useManual ? 'border-amber-500/50 text-amber-300' : 'border-slate-700 text-slate-400'}`}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {band.equipmentKey === 'custom' && (
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                                            <div>
                                                <label className="text-slate-400 text-xs block mb-1">Lower (MHz)</label>
                                                <input type="number" value={band.min} onChange={e => handleBandUpdate(i, { min: e.target.value })} step="0.001" className="w-full bg-slate-800 border border-blue-500/30 rounded-md p-2 text-slate-200 text-sm" />
                                            </div>
                                            <div>
                                                <label className="text-slate-400 text-xs block mb-1">Upper (MHz)</label>
                                                <input type="number" value={band.max} onChange={e => handleBandUpdate(i, { max: e.target.value })} step="0.001" className="w-full bg-slate-800 border border-blue-500/30 rounded-md p-2 text-slate-200 text-sm" />
                                            </div>
                                            <div>
                                                <label className="text-slate-400 text-xs block mb-1">Band Category</label>
                                                <select 
                                                    value={band.type || 'generic'} 
                                                    onChange={e => handleBandUpdate(i, { type: e.target.value as TxType })}
                                                    className="w-full bg-slate-800 border border-blue-500/30 rounded-md p-2 text-slate-200 text-sm"
                                                >
                                                    <option value="generic">Generic</option>
                                                    <option value="mic">Mic</option>
                                                    <option value="iem">IEM</option>
                                                    <option value="comms">Comms</option>
                                                    <option value="wmas">WMAS</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
                <button onClick={addBand} className={`${greenButton} w-full mt-4 py-3 text-[10px] font-black uppercase tracking-[0.2em]`}>+ Add Band</button>
            </div>
            
            <div className="p-4 bg-slate-900/50 rounded-lg mb-4">
                <div className="flex justify-between items-center mb-3">
                    <CardTitle className="!mb-0 text-base">📺 Quad-State TV Grid</CardTitle>
                </div>
                <TvGrid 
                    tvRegion="uk"
                    tvStates={tvChannelStates}
                    setTvStates={setTvChannelStates}
                    tvChannelErpData={undefined}
                    handleTvChannelCycle={handleTvChannelCycle}
                    handleBlockAllTvChannels={handleBlockAllChannels}
                    handleClearTv={resetTvGrid}
                />
            </div>

            <div className="flex flex-col md:flex-row gap-3 mt-6">
                <button onClick={coordinateBands} disabled={isCalculating} className={`flex-1 ${primaryButton}`}>
                    {isCalculating ? 'Calculating...' : 'COORDINATE BANDS'}
                </button>
                <button onClick={() => setResults(null)} className={secondaryButton}>CLEAR RESULTS</button>
            </div>

            <div className="mt-6">
                <CardTitle>📊 Results</CardTitle>
                {isCalculating ? (
                    <div className="text-center text-slate-300 py-4">Calculating...</div>
                ) : results ? (
                    <div>
                        <div className="p-3 rounded-lg border bg-emerald-500/10 border-emerald-500/30 mb-4">
                            <p className="font-bold text-white">✓ Coordination Complete</p>
                            <p className="text-sm text-slate-300">Total Frequencies Generated: {totalGenerated}</p>
                        </div>
                        <div className="space-y-4">
                            {results.map((result, i) => (
                                <div key={i} className="bg-slate-900/50 p-4 rounded-lg">
                                    <h4 className="font-bold text-blue-400">{result.name} - <span className="text-sm text-slate-400 font-mono">{result.range}</span></h4>
                                    <p className="text-xs text-slate-500 font-mono mb-2">{result.params}</p>
                                    {result.frequencies.length > 0 ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                            {result.frequencies.map(f => (
                                                <div key={f.id} className="p-2 bg-slate-800 text-center rounded text-blue-300 font-mono text-sm">
                                                    {f.value > 0 ? f.value.toFixed(3) : <span className="text-red-400">FAIL</span>}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-amber-400 text-sm">Could not find compatible frequencies for this band.</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                     <Placeholder title="Ready to Coordinate" message="Configure bands and click 'Coordinate Bands'." />
                )}
            </div>
        </Card>
    );
};

export default React.memo(MultiBandTab);