import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Frequency, Thresholds, AnalysisResult, Conflict, Scene, TxType, FrequencySnapshot, ScanDataPoint, BandResult, TVChannelState, WMASState } from '../types';
import { checkCompatibility, checkCompatibilityTimeline } from '../services/rfService';
import { exportToJson, importFromJson } from '../services/fileService';
import Card, { CardTitle, Placeholder } from './Card';
import SpectrumVisualizer from './SpectrumVisualizer';

const FrequencyValueInput: React.FC<{
    value: number;
    onChange: (val: string) => void;
    className: string;
}> = ({ value, onChange, className }) => {
    const [localString, setLocalString] = useState<string>(value === 0 ? '' : value.toString());
    const isFocused = useRef(false);

    useEffect(() => {
        if (!isFocused.current) {
            setLocalString(value === 0 ? '' : value.toString());
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
            setLocalString(val);
            onChange(val);
        }
    };

    const handleBlur = () => {
        isFocused.current = false;
        const parsed = parseFloat(localString);
        if (!isNaN(parsed) && parsed !== 0) setLocalString(parsed.toFixed(3));
        else setLocalString('');
    };

    return (
        <input
            type="text"
            inputMode="decimal"
            placeholder="0.000"
            value={localString}
            onChange={handleChange}
            onFocus={() => { isFocused.current = true; }}
            onBlur={handleBlur}
            className={className}
        />
    );
};

interface AnalyzerTabProps {
    frequencies: Frequency[];
    setFrequencies: (freqs: Frequency[]) => void;
    thresholds: Thresholds;
    setThresholds: (thresholds: Thresholds) => void;
    scenes: Scene[];
    snapshots: FrequencySnapshot[];
    setSnapshots: React.Dispatch<React.SetStateAction<FrequencySnapshot[]>>;
    scanData: ScanDataPoint[] | null;
    generatorFrequencies?: Frequency[] | null;
    multiBandResults?: BandResult[] | null;
    tvChannelStates?: Record<number, TVChannelState>;
    setTvChannelStates?: React.Dispatch<React.SetStateAction<Record<number, TVChannelState>>>;
    wmasState?: WMASState;
}

const buttonBase = "px-5 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 border disabled:opacity-50";
const primaryButton = `bg-indigo-600 border-indigo-400 text-white hover:bg-indigo-500 shadow-lg ${buttonBase}`;
const secondaryButton = `bg-slate-800 border-white/10 text-slate-300 hover:bg-slate-700 hover:text-white ${buttonBase}`;
const actionButton = `bg-cyan-600 border-cyan-400 text-white hover:bg-cyan-500 ${buttonBase}`;
const dangerButton = `bg-rose-600 border-rose-400 text-white hover:bg-rose-500 ${buttonBase}`;

const AnalyzerTab: React.FC<AnalyzerTabProps> = ({ frequencies, setFrequencies, thresholds, setThresholds, scenes, snapshots = [], setSnapshots, scanData, generatorFrequencies, multiBandResults, tvChannelStates, setTvChannelStates, wmasState }) => {
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [advancedAnalysis, setAdvancedAnalysis] = useState(false);
    const [timelineAware, setTimelineAware] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
    const [newSnapshotName, setNewSnapshotName] = useState('');

    const handleFrequencyChange = useCallback((id: string, field: 'value' | 'label' | 'type', value: string | number) => {
        setFrequencies(frequencies.map(f => f.id === id ? { ...f, [field]: field === 'value' ? parseFloat(value as string) || 0 : value } : f));
    }, [frequencies, setFrequencies]);

    const handleLockToggle = useCallback((id: string) => {
        setFrequencies(frequencies.map(f => f.id === id ? { ...f, locked: !f.locked } : f));
    }, [frequencies, setFrequencies]);
    
    const addFrequency = () => {
        setFrequencies([...frequencies, { id: `F${frequencies.length + 1}`, value: 0, label: '', locked: false, type: 'generic' }]);
    };
    
    const removeFrequency = (id: string) => {
        setFrequencies(frequencies.filter(f => f.id !== id).map((f, i) => ({ ...f, id: `F${i + 1}` })));
    };

    const handleThresholdChange = (key: keyof Thresholds, value: string) => {
        setThresholds({ ...thresholds, [key]: parseFloat(value) || 0 });
    };

    const analyzeFrequencies = () => {
        const activeFreqs = frequencies.filter(f => f.value > 0);
        if (activeFreqs.length < 2) {
            alert('Insufficient data. Provide ≥2 active carriers.');
            return;
        }
        const ruleBufferedFreqs = activeFreqs.map(f => ({ ...f, manualThresholds: thresholds }));
        const result = timelineAware ? checkCompatibilityTimeline(ruleBufferedFreqs, thresholds, scenes) : checkCompatibility(ruleBufferedFreqs, thresholds);
        setAnalysisResult(result);
    };

    const clearAnalyzer = () => {
        setFrequencies(frequencies.map(f => ({...f, value: 0, label: '', type: 'generic'})));
        setAnalysisResult(null);
    };
    
    const handleSaveToFile = () => exportToJson({ frequencies: frequencies.filter(f => f.value > 0), thresholds, tvChannelStates }, 'rf_workspace.rflist');

    const handleLoadFromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const data = await importFromJson<{frequencies: Frequency[], thresholds: Thresholds, tvChannelStates?: Record<number, TVChannelState>}>(file);
            if (data.frequencies) setFrequencies(data.frequencies);
            if (data.thresholds) setThresholds(data.thresholds);
            if (data.tvChannelStates && setTvChannelStates) setTvChannelStates(data.tvChannelStates);
        } catch (error) { alert("Load failed."); }
    };

    const handleImportGenerator = () => {
        if (!generatorFrequencies) return;
        const valid = generatorFrequencies.filter(f => f.value > 0);
        const current = frequencies.filter(f => f.value > 0);
        const next = valid.map((f, i) => ({ id: `F${current.length + i + 1}`, value: f.value, label: f.label || 'GEN', type: f.type || 'generic', locked: false }));
        setFrequencies([...current, ...next]);
    };

    const handleImportMultiBand = () => {
        if (!multiBandResults) return;
        const valid = multiBandResults.flatMap(b => b.frequencies).filter(f => f.value > 0);
        const current = frequencies.filter(f => f.value > 0);
        const next = valid.map((f, i) => ({ id: `F${current.length + i + 1}`, value: f.value, label: f.label || 'MB', type: f.type || 'generic', locked: false }));
        setFrequencies([...current, ...next]);
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <div className="flex justify-between items-center mb-8">
                        <div className="flex flex-col">
                            <CardTitle className="!mb-0 !border-b-0 !pb-0 text-white">Active Workspace</CardTitle>
                            <span className="text-[9px] font-black uppercase text-slate-500 tracking-[0.2em] mt-1">Numerical Spectral Entry</span>
                        </div>
                        <button onClick={() => setIsSnapshotModalOpen(true)} className={`${actionButton} flex items-center gap-2 py-2`}>
                            <span className="text-sm">💾</span> Snapshots
                        </button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-8 p-3 bg-slate-950/40 rounded-2xl border border-white/5 shadow-inner">
                        <input type="file" ref={fileInputRef} accept=".rflist,.json" className="hidden" onChange={handleLoadFromFile} />
                        <button onClick={() => fileInputRef.current?.click()} className={secondaryButton}>📂 Load</button>
                        <button onClick={handleSaveToFile} className={secondaryButton}>💾 Save</button>
                        <div className="w-px h-5 bg-white/5 mx-2 self-center" />
                        <button onClick={clearAnalyzer} className={dangerButton}>Reset</button>
                    </div>

                    <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-3 custom-scrollbar">
                        {frequencies.map((f) => (
                            <div key={f.id} className="grid grid-cols-[auto,1fr,2fr,auto,auto,auto] gap-2 items-center group bg-slate-950/20 p-1.5 rounded-xl border border-transparent hover:border-white/5 transition-all">
                                <label className="text-slate-600 font-mono text-[9px] w-8 text-center font-bold">{f.id}</label>
                                <FrequencyValueInput
                                    value={f.value}
                                    onChange={(val) => handleFrequencyChange(f.id, 'value', val)}
                                    className="bg-slate-900 border border-white/5 rounded-lg p-2 text-indigo-400 text-xs font-bold font-mono focus:border-indigo-500 outline-none text-center shadow-inner"
                                />
                                <input
                                    type="text"
                                    placeholder="Label"
                                    value={f.label || ''}
                                    onChange={(e) => handleFrequencyChange(f.id, 'label', e.target.value)}
                                    className="bg-slate-900 border border-white/5 rounded-lg p-2 text-slate-300 text-xs font-bold focus:border-indigo-500 outline-none shadow-inner"
                                />
                                <select value={f.type || 'generic'} onChange={e => handleFrequencyChange(f.id, 'type', e.target.value)} className="bg-slate-800 border border-white/5 rounded-lg p-2 text-slate-400 text-[9px] font-black uppercase tracking-tighter">
                                    <option value="mic">Mic</option>
                                    <option value="iem">IEM</option>
                                    <option value="comms">Com</option>
                                    <option value="wmas">WMAS</option>
                                </select>
                                <button onClick={() => handleLockToggle(f.id)} className={`p-2 rounded-xl transition-all border ${f.locked ? 'bg-amber-500/10 border-amber-500/40 text-amber-500' : 'bg-slate-900 border-white/10 text-slate-600 hover:text-white'}`}>
                                    {f.locked ? '🔒' : '🔓'}
                                </button>
                                <button onClick={() => removeFrequency(f.id)} className="text-rose-500/30 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                        ))}
                    </div>
                    <button onClick={addFrequency} className="w-full mt-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] bg-slate-900 border border-dashed border-slate-700 text-slate-500 hover:border-indigo-500/50 hover:text-indigo-400 transition-all">+ Add Channel Entry</button>

                    <div className="mt-12 mb-6 flex flex-col">
                        <CardTitle className="!mb-0 !border-b-0 !pb-0 text-white">Logic Parameters</CardTitle>
                        <span className="text-[9px] font-black uppercase text-slate-500 tracking-[0.2em] mt-1">Intermodulation Guard Guards</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                        {['fundamental', 'twoTone', 'threeTone'].map((key) => (
                            <div key={key} className="bg-slate-950/40 p-3 rounded-2xl border border-white/5">
                                <label className="text-slate-500 text-[8px] uppercase font-black mb-2 block tracking-widest text-center">{key === 'fundamental' ? 'Base F-F' : key === 'twoTone' ? '2-Tone' : '3-Tone'}</label>
                                <input type="number" value={(thresholds as any)[key]} onChange={e => handleThresholdChange(key as any, e.target.value)} step="0.001" className="w-full bg-slate-900 border border-white/5 rounded-xl p-2.5 text-indigo-300 text-xs font-black text-center font-mono shadow-inner" />
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input type="checkbox" checked={timelineAware} onChange={e => setTimelineAware(e.target.checked)} className="w-4 h-4 rounded accent-indigo-500 bg-slate-800" />
                            <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest group-hover:text-indigo-300 transition-colors">Timeline-Aware Validation</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input type="checkbox" checked={advancedAnalysis} onChange={e => setAdvancedAnalysis(e.target.checked)} className="w-4 h-4 rounded accent-indigo-500 bg-slate-800" />
                            <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest group-hover:text-indigo-300 transition-colors">Higher-Order Product Audit</span>
                        </label>
                    </div>

                    <button onClick={analyzeFrequencies} className={`w-full mt-8 ${primaryButton} py-4 text-xs shadow-[0_20px_50px_rgba(79,70,229,0.2)]`}>RUN SITE COMPATIBILITY AUDIT</button>
                </Card>

                <Card>
                    <div className="flex justify-between items-center mb-8">
                        <div className="flex flex-col">
                            <CardTitle className="!mb-0 !border-b-0 !pb-0 text-white">Analysis Log</CardTitle>
                            <span className="text-[9px] font-black uppercase text-slate-500 tracking-[0.2em] mt-1">Real-time Spectral Diagnostics</span>
                        </div>
                    </div>
                    {!analysisResult ? (
                        <Placeholder title="Engine Standby" message='Provide active carriers and click "RUN AUDIT" to check for IMD and spectral conflicts.' />
                    ) : (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className={`p-6 rounded-3xl border-2 mb-6 flex items-center justify-between ${analysisResult.conflicts.length === 0 ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.1)]' : 'bg-rose-500/10 border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.1)]'}`}>
                                <div>
                                    <p className={`text-2xl font-black uppercase tracking-tighter ${analysisResult.conflicts.length === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {analysisResult.conflicts.length === 0 ? 'Site Compatible' : 'Conflicts Found'}
                                    </p>
                                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mt-1">
                                        {frequencies.filter(f=>f.value > 0).length} Carriers • {analysisResult.conflicts.length} Violations
                                    </p>
                                </div>
                                <span className="text-4xl">{analysisResult.conflicts.length === 0 ? '✅' : '⚠️'}</span>
                            </div>
                            <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-3 custom-scrollbar">
                                {analysisResult.conflicts.length === 0 ? (
                                    <div className="text-slate-600 text-center py-20 text-xs font-medium uppercase tracking-widest italic opacity-50">Spectral environment matches mathematical model constraints.</div>
                                ) : (
                                    analysisResult.conflicts.slice(0, 50).map((c, i) => (
                                        <div key={i} className="bg-slate-950/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-2 group hover:bg-slate-900 transition-colors">
                                            <div className="flex justify-between items-center">
                                                <span className={`px-2 py-0.5 rounded-lg uppercase text-[8px] font-black border ${c.type.includes('Fundamental') ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' : 'bg-purple-500/20 text-purple-400 border-purple-500/40'}`}>
                                                    {c.type}
                                                </span>
                                                <span className="font-mono text-[9px] text-slate-600 font-bold">Delta: {c.diff.toFixed(4)} MHz</span>
                                            </div>
                                            <p className="text-[11px] font-bold text-slate-300 leading-relaxed">
                                                <span className="text-white">{c.targetFreq.id}</span>
                                                {c.type.includes('Fundamental') 
                                                    ? ` too close to ${c.sourceFreqs[0].id}`
                                                    : ` hit by products of ${c.sourceFreqs.map(f => f.id).join(' + ')}`
                                                }
                                                {c.sceneName && <span className="text-indigo-400 text-[9px] font-black ml-2">[{c.sceneName}]</span>}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </Card>
            </div>
            
            <SpectrumVisualizer 
                frequencies={frequencies} 
                scanData={scanData} 
                title="Unified Spectral Visualization"
                onImportGenerator={handleImportGenerator}
                canImportGenerator={!!generatorFrequencies && generatorFrequencies.length > 0}
                onImportMultiBand={handleImportMultiBand}
                canImportMultiBand={!!multiBandResults && multiBandResults.length > 0}
                wmasState={wmasState}
            />

            {isSnapshotModalOpen && createPortal(
                <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-3xl shadow-[0_80px_200px_rgba(0,0,0,1)] w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center p-6 bg-slate-950">
                            <h3 className="font-black text-xs uppercase tracking-[0.3em] text-white">Workspace Manager</h3>
                            <button onClick={() => setIsSnapshotModalOpen(false)} className="text-slate-500 hover:text-white text-2xl transition-colors">&times;</button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="bg-indigo-500/5 p-4 rounded-2xl border border-indigo-500/20">
                                <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block mb-2">Capture Current State</label>
                                <div className="flex gap-2">
                                    <input type="text" value={newSnapshotName} onChange={e => setNewSnapshotName(e.target.value)} placeholder="e.g. Daytime Plot..." className="flex-1 bg-slate-950 border border-white/10 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-indigo-500" />
                                    <button onClick={() => { if(newSnapshotName.trim()){ setSnapshots([{ id: `snap-${Date.now()}`, name: newSnapshotName.trim(), createdAt: new Date(), frequencies: frequencies.filter(f=>f.value > 0) }, ...snapshots]); setNewSnapshotName(''); } }} className={primaryButton}>Save</button>
                                </div>
                            </div>
                            <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                                {snapshots.length === 0 ? <p className="text-center py-10 text-slate-600 text-[10px] font-black uppercase tracking-widest">No saved snapshots</p> : snapshots.map(s => (
                                    <div key={s.id} className="bg-slate-950 border border-white/5 p-3 rounded-2xl flex justify-between items-center group">
                                        <div>
                                            <p className="text-[11px] font-black text-white uppercase tracking-wider">{s.name}</p>
                                            <p className="text-[9px] text-slate-600 font-bold">{s.frequencies.length} CH • {new Date(s.createdAt).toLocaleTimeString()}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => { setFrequencies(s.frequencies); setIsSnapshotModalOpen(false); }} className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded-lg text-[9px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all">Load</button>
                                            <button onClick={() => setSnapshots(prev => prev.filter(snap => snap.id !== s.id))} className="text-rose-500/30 hover:text-rose-500 p-2">&times;</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>, document.body
            )}
        </div>
    );
};

export default React.memo(AnalyzerTab);