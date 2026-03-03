
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    FestivalAct, ConstantSystemRequest, EquipmentRequest, ZoneConfig, Thresholds, EquipmentProfile, Frequency, Conflict, ScanDataPoint, TxType, CompatibilityLevel, SiteMapState, OptimizationReport, OptimizationSuggestion, BottleneckStats, TVChannelState, WMASState
} from '../types';
import { generateFestivalPlan, generateConstantFrequencies, generateHouseSystemsFrequencies, validateFestivalCompatibility, getCoordinationDiagnostics, CoordinationDiagnostic, getFinalThresholds, checkCompatibility } from '../services/rfService';
import { EQUIPMENT_DATABASE, COMPATIBILITY_PROFILES, UK_TV_CHANNELS, US_TV_CHANNELS, WMAS_PRESET_PROFILES } from '../constants';
import Card, { CardTitle } from './Card';
import SpectrumVisualizer from './SpectrumVisualizer';

// Helper to parse dates in multiple formats, specifically handling DD/MM/YYYY
const parseFlexibleDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    
    const cleanStr = dateStr.replace(/^["']|["']$/g, '').trim();
    const dmyMatch = cleanStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?$/);
    
    if (dmyMatch) {
        const [_, day, month, year, hour = '00', min = '00'] = dmyMatch;
        const isoStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${min.padStart(2, '0')}:00`;
        const date = new Date(isoStr);
        if (!isNaN(date.getTime())) return date;
    }
    
    const nativeParsed = new Date(cleanStr);
    return isNaN(nativeParsed.getTime()) ? new Date() : nativeParsed;
};

interface FestivalCoordinationTabProps {
    festivalActs: FestivalAct[];
    setFestivalActs: React.Dispatch<React.SetStateAction<FestivalAct[]>>;
    constantSystems: ConstantSystemRequest[];
    setConstantSystems: React.Dispatch<React.SetStateAction<ConstantSystemRequest[]>>;
    houseSystems: ConstantSystemRequest[];
    setHouseSystems: React.Dispatch<React.SetStateAction<ConstantSystemRequest[]>>;
    zoneConfigs: ZoneConfig[];
    setZoneConfigs: (configs: ZoneConfig[]) => void;
    numZones: number;
    setNumZones: (num: number) => void;
    distances: number[][];
    setDistances: (distances: number[][]) => void;
    initialThresholds: Thresholds;
    customEquipment: EquipmentProfile[];
    compatibilityMatrix: boolean[][];
    setCompatibilityMatrix: React.Dispatch<React.SetStateAction<boolean[][]>>;
    scanData: ScanDataPoint[] | null;
    siteMapState: SiteMapState;
    equipmentOverrides?: Record<string, Partial<Thresholds>>;
    tvChannelStates: Record<number, TVChannelState>;
    setTvChannelStates: (states: Record<number, TVChannelState>) => void;
    wmasState?: WMASState;
}

const buttonBase = "px-4 py-2 rounded-lg font-semibold uppercase tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transform active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed text-[10px]";
const primaryButton = `bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-b-4 border-blue-800 hover:border-blue-700 hover:brightness-110 ${buttonBase}`;
const generateButton = `bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 border-b-4 border-amber-700 hover:border-amber-600 hover:brightness-110 shadow-[0_0_20px_rgba(245,158,11,0.2)] ${buttonBase}`;
const secondaryButton = `bg-slate-700 text-slate-200 border-b-4 border-slate-900 hover:border-slate-800 hover:bg-slate-600 ${buttonBase}`;
const greenButton = `bg-green-500 text-white border-b-4 border-green-700 hover:bg-green-400 hover:border-green-600 ${buttonBase}`;
const actionButton = `bg-cyan-600/80 text-white border-b-4 border-cyan-800 hover:border-cyan-700 hover:bg-cyan-600 ${buttonBase}`;
const yellowButton = `bg-yellow-400 text-slate-950 border-b-4 border-yellow-700 hover:border-yellow-300 hover:border-yellow-600 shadow-[0_4px_12px_rgba(234,179,8,0.3)] ${buttonBase}`;

const ensureValidDate = (d: any): Date => {
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
};

const toDatetimeLocal = (d: any): string => {
    try {
        const date = ensureValidDate(d);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    } catch (e) {
        return new Date().toISOString().slice(0, 16);
    }
};

interface PlanRow {
    frequency: number;
    id: string;
    label: string;
    type: string;
    stage: string;
    times: string;
    equipment: string;
    band: string;
    status: string;
    equipmentKey?: string;
    affiliateUrl?: string;
}

const FrequencyGrid: React.FC<{ 
    frequencies?: Frequency[], 
    onToggleLock: (id: string) => void, 
    onValueChange: (id: string, value: string) => void,
    onLabelChange: (id: string, value: string) => void,
    onTypeChange: (id: string, value: TxType) => void,
    onRemove: (id: string) => void,
    onLockAll?: (lock: boolean) => void
}> = ({ frequencies, onToggleLock, onValueChange, onLabelChange, onTypeChange, onRemove, onLockAll }) => {
    if (!frequencies || frequencies.length === 0) return null;
    
    const allLocked = frequencies.every(f => f.locked);

    const getFreqStyle = (f: Frequency) => {
        if (f.value <= 0) return 'bg-red-500/10 border-red-500/30 text-red-300';
        switch (f.type) {
            case 'iem': return 'bg-rose-500/10 border-rose-500/30 text-rose-300';
            case 'comms': return 'bg-amber-500/10 border-amber-500/30 text-amber-300';
            default: return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
        }
    };

    return (
        <div className="mt-2 p-2 bg-black/30 rounded-xl border border-white/5 space-y-1">
            <div className="flex justify-between items-center px-1 mb-1 border-b border-white/5 pb-1">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Active Carriers</span>
                {onLockAll && (
                    <button 
                        onClick={() => onLockAll(!allLocked)}
                        className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border transition-all ${allLocked ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/40' : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-600 hover:text-white'}`}
                    >
                        {allLocked ? '🔓 Unlock All' : '🔒 Lock All'}
                    </button>
                )}
            </div>
            <div className="grid grid-cols-1 gap-1.5">
                {frequencies.map((f) => (
                    <div key={f.id} className={`flex items-center gap-2 p-1.5 rounded-lg border transition-all ${getFreqStyle(f)}`}>
                        <button onClick={() => onToggleLock(f.id)} className={`text-[10px] ${f.locked ? 'text-amber-400' : 'text-slate-500 opacity-50'}`}>{f.locked ? '🔒' : '🔓'}</button>
                        <input type="number" step="0.001" value={f.value ? f.value.toFixed(3) : ''} onChange={(e) => onValueChange(f.id, e.target.value)} className="bg-transparent font-mono text-[11px] font-bold outline-none w-16" />
                        <input type="text" value={f.label || ''} onChange={(e) => onLabelChange(f.id, e.target.value)} placeholder="Label" className="bg-transparent text-[10px] outline-none flex-1 opacity-70 truncate" />
                        <button onClick={(e) => onRemove(f.id)} className="text-red-400/50 hover:text-red-400 font-bold px-1">&times;</button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const RequestManager: React.FC<{
    requests: EquipmentRequest[],
    onUpdate: (requests: EquipmentRequest[]) => void,
    db: Record<string, EquipmentProfile>,
    overrides: Record<string, Partial<Thresholds>>,
    title: string,
    type: 'mic' | 'iem'
}> = ({ requests, onUpdate, db, overrides, title, type }) => {
    const handleAdd = () => {
        const defaultKey = type === 'iem' ? 'shure-psm1000-g10' : 'shure-ad-g56';
        onUpdate([...requests, { id: `req-${Date.now()}-${Math.random()}`, equipmentKey: defaultKey, count: 4, compatibilityLevel: 'standard', linearMode: false }]);
    };
    const handleRemove = (id: string) => onUpdate(requests.filter(r => r.id !== id));
    
    const handleFieldChange = (id: string, field: keyof EquipmentRequest, value: any) => {
        onUpdate(requests.map(r => {
            if (r.id !== id) return r;
            let updated = { ...r, [field]: value };
            
            if (field === 'equipmentKey') {
                const profile = db[value as string];
                if (profile && profile.recommendedThresholds?.threeTone !== 0) {
                    updated.linearMode = false;
                }
            }

            if (field === 'useManualParams' && value === true) {
                const standardTh = getFinalThresholds({ equipmentKey: r.equipmentKey, compatibilityLevel: 'standard' }, db, overrides);
                if (updated.manualFundamental === undefined) updated.manualFundamental = standardTh.fundamental;
                if (updated.manualTwoTone === undefined) updated.manualTwoTone = standardTh.twoTone;
                if (updated.manualThreeTone === undefined) updated.manualThreeTone = standardTh.threeTone;
            }
            return updated;
        }));
    };

    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center mb-1 px-1">
                <h5 className={`text-[10px] font-black uppercase tracking-widest ${type === 'mic' ? 'text-emerald-400' : 'text-rose-400'}`}>{title} Box</h5>
                <button onClick={handleAdd} className={`text-[9px] px-2 py-0.5 rounded font-bold transition-all border ${type === 'mic' ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-600' : 'bg-rose-600/20 text-rose-300 border-rose-500/30 hover:bg-rose-600'} hover:text-white`}>+ Add</button>
            </div>
            <div className="space-y-2">
                {requests.map(req => {
                    const activeTh = getFinalThresholds({ equipmentKey: req.equipmentKey, compatibilityLevel: req.compatibilityLevel }, db, overrides);
                    return (
                        <div key={req.id} className="bg-slate-900/60 p-2 rounded-xl border border-white/5 space-y-2">
                            <div className="grid grid-cols-[1fr,auto,auto] gap-2 items-center">
                                <select value={req.equipmentKey} onChange={e => handleFieldChange(req.id, 'equipmentKey', e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-1 py-1 text-[10px] text-slate-200">
                                    {(Object.entries(db) as [string, EquipmentProfile][])
                                        .filter(([k, p]) => {
                                            const pType = p.type || 'generic';
                                            return pType === type || pType === 'generic' || pType === 'wmas' || k === 'custom';
                                        })
                                        .map(([k, p]) => <option key={k} value={k}>{p.name} ({p.band})</option>)}
                                </select>
                                <div className="flex items-center gap-1 relative">
                                    <button 
                                        onClick={() => handleFieldChange(req.id, 'count', Math.max(0, req.count - 1))}
                                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded px-1.5 py-1 text-[10px] font-bold border border-slate-700"
                                    >-</button>
                                    <input type="number" value={req.count} onChange={e => handleFieldChange(req.id, 'count', parseInt(e.target.value) || 0)} className={`bg-slate-950 border border-slate-700 rounded px-1 py-1 text-[10px] font-bold text-center w-10 ${type === 'mic' ? 'text-emerald-400' : 'text-rose-400'}`} />
                                    <button 
                                        onClick={() => handleFieldChange(req.id, 'count', req.count + 1)}
                                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded px-1.5 py-1 text-[10px] font-bold border border-slate-700"
                                    >+</button>
                                    {db[req.equipmentKey]?.type === 'wmas' && <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[6px] text-purple-400 font-black bg-slate-900 px-1 uppercase tracking-tighter whitespace-nowrap">Systems</span>}
                                </div>
                                <button onClick={() => handleRemove(req.id)} className="text-red-400 hover:text-red-300 font-bold text-xs px-1">&times;</button>
                            </div>

                            <div className="flex items-center justify-between gap-2 px-1">
                                {db[req.equipmentKey]?.type === 'wmas' ? (
                                    <span className="text-[8px] font-black uppercase tracking-tighter text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded bg-purple-500/10">Wideband Block</span>
                                ) : (
                                    db[req.equipmentKey]?.recommendedThresholds?.threeTone === 0 ? (
                                        <label className="flex items-center gap-2 cursor-pointer group/lin">
                                            <span className={`text-[8px] font-black uppercase tracking-tighter ${req.linearMode ? 'text-cyan-400' : 'text-slate-600'}`}>HD Mode</span>
                                            <input type="checkbox" checked={req.linearMode} onChange={e => handleFieldChange(req.id, 'linearMode', e.target.checked)} className="w-3 h-3 accent-cyan-500" />
                                        </label>
                                    ) : (
                                        <div className="w-[60px]" />
                                    )
                                )}
                                <select 
                                    value={req.compatibilityLevel} 
                                    onChange={e => handleFieldChange(req.id, 'compatibilityLevel', e.target.value)} 
                                    disabled={req.useManualParams}
                                    className="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[9px] text-indigo-300 font-bold uppercase tracking-tighter disabled:opacity-30"
                                >
                                    <option value="standard">Standard</option>
                                    <option value="aggressive">Aggressive</option>
                                    <option value="robust">Robust</option>
                                </select>
                            </div>

                            {req.equipmentKey === 'custom' && (
                                <div className="grid grid-cols-2 gap-2 mt-1">
                                    <div className="flex flex-col">
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">Lower</span>
                                        <input 
                                            type="number" step="0.001" 
                                            value={req.customMin || ''} 
                                            onChange={e => handleFieldChange(req.id, 'customMin', parseFloat(e.target.value))}
                                            placeholder="470.0"
                                            className="bg-slate-950 border border-slate-700 rounded px-1.5 py-1.5 text-[10px] text-cyan-400 font-mono"
                                        />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">Upper</span>
                                        <input 
                                            type="number" step="0.001" 
                                            value={req.customMax || ''} 
                                            onChange={e => handleFieldChange(req.id, 'customMax', parseFloat(e.target.value))}
                                            placeholder="700.0"
                                            className="bg-slate-950 border border-slate-700 rounded px-1.5 py-1.5 text-[10px] text-cyan-400 font-mono"
                                        />
                                    </div>
                                </div>
                            )}
                            
                            <div className="flex items-center justify-between p-1">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <span className={`text-[8px] font-black uppercase tracking-tighter ${req.useManualParams ? 'text-amber-400' : 'text-slate-600'}`}>Bespoke Overrides</span>
                                    <input type="checkbox" checked={req.useManualParams} onChange={e => handleFieldChange(req.id, 'useManualParams', e.target.checked)} className="w-3 h-3 accent-amber-500" />
                                </label>
                            </div>

                            <div className={`grid grid-cols-3 gap-1.5 p-1.5 rounded-lg border transition-all ${req.useManualParams ? 'bg-amber-500/5 border-amber-500/20' : 'bg-black/20 border-white/5'}`}>
                                <div className="flex flex-col items-center">
                                    <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">FF</span>
                                    <input 
                                        type="number" step="0.001" 
                                        value={req.useManualParams ? req.manualFundamental : activeTh.fundamental} 
                                        readOnly={!req.useManualParams}
                                        onChange={e => handleFieldChange(req.id, 'manualFundamental', parseFloat(e.target.value))}
                                        className={`w-full bg-transparent text-center font-mono text-[10px] outline-none ${req.useManualParams ? 'text-amber-300' : 'text-slate-400'}`} 
                                    />
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">2T</span>
                                    <input 
                                        type="number" step="0.001" 
                                        value={req.useManualParams ? req.manualTwoTone : activeTh.twoTone} 
                                        readOnly={!req.useManualParams}
                                        onChange={e => handleFieldChange(req.id, 'manualTwoTone', parseFloat(e.target.value))}
                                        className={`w-full bg-transparent text-center font-mono text-[10px] outline-none ${req.useManualParams ? 'text-amber-300' : 'text-slate-400'}`} 
                                    />
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">3T</span>
                                    <input 
                                        type="number" step="0.001" 
                                        value={req.useManualParams ? req.manualThreeTone : activeTh.threeTone} 
                                        readOnly={!req.useManualParams}
                                        onChange={e => handleFieldChange(req.id, 'manualThreeTone', parseFloat(e.target.value))}
                                        className={`w-full bg-transparent text-center font-mono text-[10px] outline-none ${req.useManualParams ? 'text-amber-300' : 'text-slate-400'}`} 
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const ExcelToCsvConverter: React.FC<{ 
    onClose: () => void, 
    onSync: (acts: FestivalAct[]) => void,
    zoneConfigs: ZoneConfig[]
}> = ({ onClose, onSync, zoneConfigs }) => {
    const [selectedDate, setSelectedDate] = useState("2023-05-27");
    const [selectedDay, setSelectedDay] = useState("SATURDAY");
    const [isProcessing, setIsProcessing] = useState(false);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [workbookData, setWorkbookData] = useState<any[] | null>(null);
    const [columnMapping, setColumnMapping] = useState<Record<number, 'artist' | 'start' | 'end' | 'stage' | null>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);

    const DAYS = ["SATURDAY", "SUNDAY"];

    const runAnalysis = (rows: any[]) => {
        const formattedDate = selectedDate.split('-').reverse().join('/'); 
        const results: any[] = [];
        
        let currentStage = "";
        let inTargetDayBlock = false;
        let dayColBounds: { start: number, end: number } | null = null;
        let colIndexMap: Record<string, number> = { artist: -1, start: -1, end: -1, stage: -1 };

        // Aggressive stage detection keywords
        const STAGE_KEYWORDS = ["PIT", "XTRA", "STAGE", "TENT", "ROOM", "ARENA", "DOME", "FLOOR"];

        // Explicit user mappings override heuristics
        Object.entries(columnMapping).forEach(([idx, type]) => {
            if (type === 'artist') colIndexMap.artist = Number(idx);
            if (type === 'start') colIndexMap.start = Number(idx);
            if (type === 'end') colIndexMap.end = Number(idx);
            if (type === 'stage') colIndexMap.stage = Number(idx);
        });

        const formatExcelTime = (val: any) => {
            if (val === undefined || val === null || val === "") return null;
            let dateObj: Date;
            if (val instanceof Date) {
                dateObj = val;
            } else if (typeof val === 'number') {
                // @ts-ignore
                dateObj = XLSX.utils.parse_date(val);
            } else if (typeof val === 'string') {
                // Handle "14:00 - 15:00" single cell ranges
                const rangeMatch = val.match(/(\d{1,2}:\d{2}).*?(\d{1,2}:\d{2})/);
                if (rangeMatch) return [rangeMatch[1].padStart(5, '0'), rangeMatch[2].padStart(5, '0')];
                
                const timeMatch = val.match(/(\d{1,2}):(\d{2})/);
                if (timeMatch) return `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
                return null;
            } else return null;

            if (isNaN(dateObj.getTime())) return null;
            return `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
        };

        // Day detection
        if (Object.keys(columnMapping).length === 0) {
            for (let i = 0; i < Math.min(rows.length, 50); i++) {
                const row = rows[i];
                const rowStr = row.join(" ").toUpperCase();
                if (rowStr.includes("SATURDAY") && rowStr.includes("SUNDAY")) {
                    const satIdx = row.findIndex((c: any) => String(c).toUpperCase().includes("SATURDAY"));
                    const sunIdx = row.findIndex((c: any) => String(c).toUpperCase().includes("SUNDAY"));
                    if (selectedDay === "SATURDAY") {
                        dayColBounds = { start: satIdx, end: sunIdx };
                    } else {
                        dayColBounds = { start: sunIdx, end: row.length };
                    }
                    break;
                }
            }
        }

        // Processing rows
        rows.forEach((fullRow: any[]) => {
            const row = dayColBounds ? fullRow.slice(dayColBounds.start, dayColBounds.end) : fullRow;
            const rowText = row.join(" ").toUpperCase();
            
            if (!dayColBounds) {
                const dayMatch = DAYS.find(d => rowText.includes(d));
                if (dayMatch) {
                    inTargetDayBlock = (dayMatch === selectedDay);
                    if (!inTargetDayBlock) currentStage = "";
                    return;
                }
                if (!inTargetDayBlock && DAYS.some(d => row.some(cell => String(cell).toUpperCase().includes(d)))) return;
            }

            // Aggressive Stage Header Detection:
            const populatedCells = row.filter(c => String(c).trim().length > 0);
            if (colIndexMap.stage === -1) {
                const hasStageKeywords = STAGE_KEYWORDS.some(kw => rowText.includes(kw));
                if (populatedCells.length <= 3 && hasStageKeywords) {
                    const potentialStage = populatedCells.find(c => {
                        const s = String(c).toUpperCase();
                        return STAGE_KEYWORDS.some(kw => s.includes(kw));
                    });
                    if (potentialStage) {
                        currentStage = String(potentialStage).trim();
                        return;
                    }
                } else if (populatedCells.length === 1 && isNaN(parseFloat(String(populatedCells[0])))) {
                    const text = String(populatedCells[0]).trim();
                    if (!["ARTIST", "TIME", "STAGE", "START", "FINISH", "NOTES"].includes(text.toUpperCase())) {
                        currentStage = text;
                        return;
                    }
                }
            }

            if (colIndexMap.stage !== -1) {
                const mappedStage = String(row[colIndexMap.stage] || "").trim();
                if (mappedStage) currentStage = mappedStage;
            }

            if (!currentStage && Object.keys(columnMapping).length === 0) return;

            // Heuristic header detection
            if (Object.keys(columnMapping).length === 0) {
                if (rowText.includes("ARTIST") || rowText.includes("START") || rowText.includes("FINISH") || rowText.includes("END")) {
                    row.forEach((cell, idx) => {
                        const cStr = String(cell).toUpperCase();
                        if (cStr.includes("ARTIST") || cStr.includes("PERFORMER")) colIndexMap.artist = idx;
                        if (cStr.includes("START") || cStr.includes("ON-STAGE")) colIndexMap.start = idx;
                        if (cStr.includes("END") || cStr.includes("FINISH") || cStr.includes("OFF-STAGE")) colIndexMap.end = idx;
                    });
                    return;
                }
            }

            if (rowText.includes("DOORS OPEN") || rowText.includes("STAGE MANAGER") || rowText.includes("GENDER") || rowText.includes("ANNO") || rowText.includes("C/O")) return;

            let artist = "", start = "", end = "";

            if (colIndexMap.start !== -1 && colIndexMap.end !== -1) {
                artist = String(row[colIndexMap.artist] || "").trim();
                const startVal = formatExcelTime(row[colIndexMap.start]);
                const endVal = formatExcelTime(row[colIndexMap.end]);
                
                if (Array.isArray(startVal)) {
                    start = startVal[0];
                    end = startVal[1];
                } else {
                    start = (startVal as string) || "";
                    end = (endVal as string) || "";
                }
            } else {
                const timeCandidates: { val: string | string[], idx: number }[] = [];
                row.forEach((cell, idx) => {
                    const t = formatExcelTime(cell);
                    if (t) timeCandidates.push({ val: t, idx });
                });

                if (timeCandidates.length >= 1) {
                    artist = row.find((cell, idx) => 
                        cell && typeof cell === 'string' && 
                        !timeCandidates.some(tc => tc.idx === idx) &&
                        !String(cell).toUpperCase().includes("DOORS") &&
                        String(cell).length > 2
                    ) || "";
                    
                    const firstTime = timeCandidates[0];
                    if (Array.isArray(firstTime.val)) {
                        start = firstTime.val[0];
                        end = firstTime.val[1];
                    } else if (timeCandidates.length >= 2) {
                        const sorted = [...timeCandidates].sort((a,b) => a.idx - b.idx);
                        start = sorted[0].val as string;
                        end = sorted[1].val as string; 
                        const [hEnd] = end.split(':').map(Number);
                        if (hEnd === 0 && sorted.length > 2) end = sorted[2].val as string;
                    }
                }
            }

            if (artist && start && end && artist.toUpperCase() !== "ARTIST" && artist.toUpperCase() !== "PERFORMER") {
                results.push({
                    artist: artist.replace(/,/g, '').trim(),
                    stage: currentStage || "UNASSIGNED",
                    start: `${formattedDate} ${start}`,
                    end: `${formattedDate} ${end}`
                });
            }
        });

        setPreviewData(results);
    };

    // CRITICAL FIX: Add useEffect to run analysis whenever input state changes
    useEffect(() => {
        if (workbookData) {
            runAnalysis(workbookData);
        }
    }, [workbookData, columnMapping, selectedDate, selectedDay]);

    const handleUpload = (file: File) => {
        setIsProcessing(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                // @ts-ignore
                const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellStyles: true });
                
                let sheetName = workbook.SheetNames.find(n => n.toUpperCase() === "GRID");
                if (!sheetName) sheetName = workbook.SheetNames[0];
                
                const sheet = workbook.Sheets[sheetName];
                if (!sheet) throw new Error("Could not find a valid worksheet.");
                
                // @ts-ignore
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
                setWorkbookData(rows);
                setColumnMapping({}); 
            } catch (err: any) {
                alert("Upload failed: " + err.message);
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleMapColumn = (idx: number, type: 'artist' | 'start' | 'end' | 'stage') => {
        setColumnMapping(prev => {
            const next = { ...prev };
            if (type !== 'stage') {
                Object.keys(next).forEach(k => {
                    if (next[Number(k)] === type) next[Number(k)] = null;
                });
            }
            next[idx] = type;
            return next;
        });
    };

    const syncToPlan = () => {
        const defaultStage = zoneConfigs[0]?.name || "Main Stage";
        const acts: FestivalAct[] = previewData.map(d => ({
            id: `act-sync-${Date.now()}-${Math.random()}`,
            actName: d.artist,
            stage: d.stage === "UNASSIGNED" ? defaultStage : d.stage,
            startTime: parseFlexibleDate(d.start),
            endTime: parseFlexibleDate(d.end),
            active: true,
            micRequests: [
                { id: `req-m-${Date.now()}`, equipmentKey: 'shure-ad-g56', count: 4, compatibilityLevel: 'standard', linearMode: false }
            ],
            iemRequests: [
                { id: `req-i-${Date.now()}`, equipmentKey: 'shure-psm1000-g10', count: 4, compatibilityLevel: 'standard', linearMode: false }
            ],
            frequencies: []
        }));
        onSync(acts);
        onClose();
    };

    const downloadCsv = () => {
        const header = "Artist,Stage,Start,End\n";
        const body = previewData.map(d => `${d.artist},${d.stage},${d.start},${d.end}`).join("\n");
        const csvContent = header + body;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `running_order_${selectedDay.toLowerCase()}_${selectedDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border-2 border-indigo-500/40 rounded-3xl shadow-2xl w-full max-w-6xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[95vh]">
                <div className="p-6 border-b border-white/10 bg-indigo-500/10 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🧮</span>
                        <div>
                            <h3 className="text-lg font-black uppercase tracking-widest text-indigo-400">Running Order Pro-Converter</h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Interactive Multi-Format Mapping Engine</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-3xl leading-none">&times;</button>
                </div>
                
                <div className="p-6 flex flex-col lg:flex-row gap-6 overflow-hidden flex-1">
                    <div className="lg:w-1/4 space-y-6 shrink-0 flex flex-col">
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">1. Day Filter (if multiple blocks present)</label>
                                <div className="flex gap-2">
                                    {DAYS.map(d => (
                                        <button 
                                            key={d}
                                            onClick={() => {
                                                setSelectedDay(d);
                                                if (d === 'SATURDAY') setSelectedDate("2023-05-27");
                                                else setSelectedDate("2023-05-28");
                                            }}
                                            className={`flex-1 py-2 rounded-xl font-black text-[10px] border transition-all ${selectedDay === d ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-slate-800 border-white/5 text-slate-400 hover:bg-slate-700'}`}
                                        >
                                            {d}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">2. Map to Event Date</label>
                                <input 
                                    type="date" 
                                    value={selectedDate} 
                                    onChange={e => setSelectedDate(e.target.value)}
                                    className="w-full bg-slate-950 border border-indigo-500/30 rounded-xl p-3 text-white font-mono text-sm outline-none focus:border-indigo-500 shadow-inner" 
                                />
                            </div>
                        </div>

                        <div className="bg-slate-950/50 p-4 rounded-2xl border border-white/5 space-y-3">
                            <h4 className="text-[9px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Pro Mapping Controls
                            </h4>
                            <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                                Upload a standard <strong>Excel (.xlsx)</strong> or <strong>CSV (.csv)</strong> file. Map columns by clicking buttons. Mapping <strong>Stage</strong> overrides auto-detection.
                            </p>
                        </div>

                        <div className="pt-4 mt-auto">
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                accept=".xlsx,.csv" 
                                className="hidden" 
                                onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} 
                            />
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isProcessing}
                                className={`${primaryButton} w-full !py-4 !text-sm !rounded-2xl flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(59,130,246,0.2)]`}
                            >
                                {isProcessing ? <><span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span> PROCESSING...</> : (workbookData ? 'RE-UPLOAD FILE' : 'UPLOAD XLSX OR CSV FILE')}
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                        {/* RAW GRID MAPPER */}
                        {workbookData && (
                            <div className="flex-1 flex flex-col bg-black/40 rounded-2xl border border-white/5 overflow-hidden">
                                <div className="p-4 bg-slate-950/50 border-b border-white/5 flex justify-between items-center shrink-0">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Interactive Column Mapper (First 12 Rows)</span>
                                    <div className="flex gap-2">
                                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-indigo-500"></div><span className="text-[8px] text-indigo-400 font-black uppercase">Artist</span></div>
                                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-cyan-500"></div><span className="text-[8px] text-cyan-400 font-black uppercase">Start</span></div>
                                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-rose-500"></div><span className="text-[8px] text-rose-400 font-black uppercase">End</span></div>
                                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-emerald-500"></div><span className="text-[8px] text-emerald-400 font-black uppercase">Stage</span></div>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-auto custom-scrollbar">
                                    <table className="w-full text-left border-collapse text-[10px]">
                                        <thead className="bg-slate-900 sticky top-0 z-20">
                                            <tr>
                                                {workbookData[0].map((_: any, idx: number) => {
                                                    const mapped = columnMapping[idx];
                                                    return (
                                                        <th key={idx} className={`p-2 border-x border-white/5 min-w-[120px] transition-all ${mapped === 'artist' ? 'bg-indigo-500/20' : mapped === 'start' ? 'bg-cyan-500/20' : mapped === 'end' ? 'bg-rose-500/20' : mapped === 'stage' ? 'bg-emerald-500/20' : ''}`}>
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex gap-1">
                                                                    <button onClick={() => handleMapColumn(idx, 'artist')} className={`flex-1 py-1 rounded text-[8px] font-black border transition-all ${mapped === 'artist' ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-slate-800 border-white/10 text-slate-500 hover:text-slate-300'}`}>ARTIST</button>
                                                                    <button onClick={() => handleMapColumn(idx, 'stage')} className={`flex-1 py-1 rounded text-[8px] font-black border transition-all ${mapped === 'stage' ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg' : 'bg-slate-800 border-white/10 text-slate-500 hover:text-slate-300'}`}>STAGE</button>
                                                                </div>
                                                                <div className="flex gap-1">
                                                                    <button onClick={() => handleMapColumn(idx, 'start')} className={`flex-1 py-1 rounded text-[8px] font-black border transition-all ${mapped === 'start' ? 'bg-cyan-600 border-cyan-400 text-white shadow-lg' : 'bg-slate-800 border-white/10 text-slate-500 hover:text-slate-300'}`}>START</button>
                                                                    <button onClick={() => handleMapColumn(idx, 'end')} className={`flex-1 py-1 rounded text-[8px] font-black border transition-all ${mapped === 'end' ? 'bg-rose-600 border-rose-400 text-white shadow-lg' : 'bg-slate-800 border-white/10 text-slate-500 hover:text-slate-300'}`}>END</button>
                                                                </div>
                                                            </div>
                                                        </th>
                                                    );
                                                })}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {workbookData.slice(0, 12).map((row, rIdx) => (
                                                <tr key={rIdx} className="border-b border-white/5 hover:bg-white/5">
                                                    {row.map((cell: any, cIdx: number) => (
                                                        <td key={cIdx} className={`p-2 border-x border-white/5 font-mono text-slate-400 truncate max-w-[150px] ${columnMapping[cIdx] ? 'bg-white/5 text-white' : ''}`}>
                                                            {String(cell)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* FINAL PREVIEW */}
                        <div className="h-1/3 flex flex-col bg-slate-950/50 rounded-2xl border border-white/5 overflow-hidden">
                            <div className="p-3 bg-slate-900 border-b border-white/5 flex justify-between items-center">
                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Active Coordination Output Preview</span>
                                {previewData.length > 0 && <span className="text-[9px] font-black text-slate-500 uppercase">{previewData.length} Acts Found</span>}
                            </div>
                            <div className="flex-1 overflow-auto custom-scrollbar">
                                {previewData.length > 0 ? (
                                    <table className="w-full text-left border-collapse text-[10px]">
                                        <thead className="bg-slate-900/50 sticky top-0 z-10">
                                            <tr className="uppercase font-black text-slate-600">
                                                <th className="p-2">Artist</th>
                                                <th className="p-2">Stage</th>
                                                <th className="p-2">Start</th>
                                                <th className="p-2">End</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {previewData.map((row, i) => (
                                                <tr key={i} className="hover:bg-white/5 transition-colors">
                                                    <td className="p-2 text-white font-bold">{row.artist}</td>
                                                    <td className="p-2 text-indigo-300 font-bold tracking-tighter uppercase">{row.stage}</td>
                                                    <td className="p-2 font-mono text-cyan-400">{row.start}</td>
                                                    <td className="p-2 font-mono text-cyan-400">{row.end}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-700 text-[10px] font-black uppercase tracking-widest italic opacity-50">Upload a file and map columns to see results</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-slate-950 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
                    <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest">Flexible Engine V2.2 • Hybrid XLSX/CSV Mapping</p>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button onClick={onClose} className={secondaryButton}>Cancel</button>
                        <button 
                            disabled={previewData.length === 0}
                            onClick={downloadCsv}
                            className={`${actionButton} flex-1 sm:flex-none shadow-lg shadow-cyan-500/10`}
                        >
                            EXPORT CSV
                        </button>
                        <button 
                            disabled={previewData.length === 0}
                            onClick={syncToPlan}
                            className={`${primaryButton} !bg-gradient-to-r from-emerald-500 to-teal-500 !border-emerald-800 flex-1 sm:flex-none !py-3 !px-8 !text-xs shadow-[0_10px_30px_rgba(16,185,129,0.2)]`}
                        >
                            ⚡ SYNC DIRECTLY TO PLAN
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const FestivalCoordinationTab: React.FC<FestivalCoordinationTabProps> = ({
    festivalActs, setFestivalActs, constantSystems, setConstantSystems, houseSystems, setHouseSystems,
    zoneConfigs, setZoneConfigs, numZones, setNumZones, distances, setDistances,
    initialThresholds, customEquipment, compatibilityMatrix, 
    setCompatibilityMatrix,
    scanData, siteMapState, equipmentOverrides = {},
    tvChannelStates: initialTvStates = {}, setTvChannelStates, wmasState
}) => {
    const [activeSubTab, setActiveSubTab] = useState<'acts' | 'constant' | 'house'>('acts');
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState({ found: 0, processed: 0, total: 0, totalRequested: 0, status: '' });
    const [overlapMinutes, setOverlapMinutes] = useState(30);
    const [manualExclusions, setManualExclusions] = useState('');
    const [optimizationReport, setOptimizationReport] = useState<OptimizationReport | null>(null);
    const [isHudMinimized, setIsHudMinimized] = useState(false);
    const [tvRegion, setTvRegion] = useState<'uk' | 'us'>('uk');
    const [tvStates, setTvStates] = useState<Record<number, TVChannelState>>(initialTvStates);
    const [showTabulation, setShowTabulation] = useState(false);
    const [diagnosticConflicts, setDiagnosticConflicts] = useState<Conflict[]>([]);
    const [hasAnalyzed, setHasAnalyzed] = useState(false);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [numZonesInput, setNumZonesInput] = useState(numZones.toString());
    const [isConverterOpen, setIsConverterOpen] = useState(false);
    
    // Global Distance State
    const [globalDistInput, setGlobalDistInput] = useState<string>("150");

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [ledgerSort, setLedgerSort] = useState<{ field: keyof PlanRow, direction: 'asc' | 'desc' | null }>({ field: 'frequency', direction: 'asc' });
    const [ledgerFilters, setLedgerFilters] = useState<Partial<Record<keyof PlanRow, string>>>({});

    const [diagSelectedIds, setDiagSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        setNumZonesInput(numZones.toString());
    }, [numZones]);

    // Automatic synchronization between zoneConfigs (Topology) and the Constant/House system gear ledgers.
    useEffect(() => {
        const syncSystems = (currentSystems: ConstantSystemRequest[], setFn: (val: ConstantSystemRequest[]) => void) => {
            const sizeMismatch = currentSystems.length !== zoneConfigs.length;
            const nameMismatch = currentSystems.some((s, i) => zoneConfigs[i] && s.stageName !== zoneConfigs[i].name);
            
            if (sizeMismatch || nameMismatch) {
                const next = zoneConfigs.map((cfg, idx) => {
                    const existing = currentSystems[idx];
                    if (existing && existing.stageName === cfg.name) {
                        return existing;
                    }
                    if (existing) {
                        return { ...existing, stageName: cfg.name };
                    }
                    return { stageName: cfg.name, micRequests: [], iemRequests: [], frequencies: [] };
                });
                
                // Only update if the content actually changed
                const hasChanged = next.length !== currentSystems.length || 
                                 next.some((s, i) => s !== currentSystems[i]);

                if (hasChanged) {
                    setTimeout(() => setFn(next), 0);
                }
            }
        };

        syncSystems(constantSystems, setConstantSystems);
        syncSystems(houseSystems, setHouseSystems);
    }, [zoneConfigs, constantSystems, houseSystems, setConstantSystems, setHouseSystems]);

    const handleNumZonesChange = (val: string) => {
        setNumZonesInput(val);
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 20) {
            setNumZones(parsed);
        }
    };

    const handleApplyGlobalDistance = () => {
        const val = parseInt(globalDistInput, 10);
        if (isNaN(val)) return;
        const next = distances.map((row, rIdx) => 
            row.map((col, cIdx) => (rIdx === cIdx ? 0 : val))
        );
        setDistances(next);
    };

    const handleStageNameChange = (idx: number, newName: string) => {
        const oldName = zoneConfigs[idx].name;
        
        const nextZones = [...zoneConfigs];
        nextZones[idx] = { ...nextZones[idx], name: newName };
        setZoneConfigs(nextZones);

        const nextHouse = houseSystems.map((sys, sIdx) => 
            sIdx === idx ? { ...sys, stageName: newName } : sys
        );
        setHouseSystems(nextHouse);

        const nextConstants = constantSystems.map((sys, sIdx) => 
            sIdx === idx ? { ...sys, stageName: newName } : sys
        );
        setConstantSystems(nextConstants);

        setFestivalActs(prev => prev.map(act => 
            act.stage === oldName ? { ...act, stage: newName } : act
        ));
    };

    const fullEquipmentDatabase = useMemo((): Record<string, EquipmentProfile> => {
        const customProfiles = customEquipment.reduce((acc: Record<string, EquipmentProfile>, profile: EquipmentProfile) => { if (profile.id) acc[profile.id] = profile; return acc; }, {} as Record<string, EquipmentProfile>);
        return { ...EQUIPMENT_DATABASE, ...customProfiles };
    }, [customEquipment]);

    const rawTabulatedPlan = useMemo(() => {
        const rows: PlanRow[] = [];
        constantSystems.forEach(sys => {
            sys.frequencies?.forEach(f => {
                if (f.value <= 0) return;
                const profile = f.equipmentKey ? fullEquipmentDatabase[f.equipmentKey] : null;
                rows.push({ 
                    frequency: f.value, 
                    id: f.id, 
                    label: f.label || 'Static System', 
                    type: f.type || 'generic', 
                    stage: sys.stageName, 
                    times: 'Constant', 
                    equipment: profile?.name || f.equipmentKey || 'Custom Range', 
                    band: profile?.band.split(' ')[0] || 'Custom', 
                    status: f.locked ? '🔒' : '🔓', 
                    equipmentKey: f.equipmentKey,
                    affiliateUrl: profile?.affiliateUrl
                });
            });
        });
        houseSystems.forEach(sys => {
            sys.frequencies?.forEach(f => {
                if (f.value <= 0) return;
                const profile = f.equipmentKey ? fullEquipmentDatabase[f.equipmentKey] : null;
                rows.push({ 
                    frequency: f.value, 
                    id: f.id, 
                    label: f.label || 'House System', 
                    type: f.type || 'generic', 
                    stage: sys.stageName, 
                    times: 'House System', 
                    equipment: profile?.name || f.equipmentKey || 'Custom Range', 
                    band: profile?.band.split(' ')[0] || 'Custom', 
                    status: f.locked ? '🔒' : '🔓', 
                    equipmentKey: f.equipmentKey,
                    affiliateUrl: profile?.affiliateUrl
                });
            });
        });
        festivalActs.forEach(act => {
            act.frequencies?.forEach(f => {
                if (f.value <= 0) return;
                const profile = f.equipmentKey ? fullEquipmentDatabase[f.equipmentKey] : null;
                const start = new Date(act.startTime);
                const end = new Date(act.endTime);
                
                const day = String(start.getDate()).padStart(2, '0');
                const month = String(start.getMonth() + 1).padStart(2, '0');
                const year = start.getFullYear();
                const dateStr = `${day}/${month}/${year}`;
                
                const startTimeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                const endTimeStr = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                const timeDisplay = `${dateStr} ${startTimeStr} - ${endTimeStr}`;
 
                rows.push({ 
                    frequency: f.value, 
                    id: f.id, 
                    label: f.label || act.actName, 
                    type: f.type || 'generic', 
                    stage: act.stage, 
                    times: timeDisplay, 
                    equipment: profile?.name || f.equipmentKey || 'Custom Range', 
                    band: profile?.band.split(' ')[0] || 'Custom', 
                    status: f.locked ? '🔒' : '🔓', 
                    equipmentKey: f.equipmentKey,
                    affiliateUrl: profile?.affiliateUrl
                });
            });
        });

        if (wmasState && wmasState.nodes) {
            wmasState.nodes.forEach(node => {
                if (node.assignedBlock) {
                    const freq = (node.assignedBlock.start + node.assignedBlock.end) / 2;
                    const rangeStr = `${node.assignedBlock.start.toFixed(2)}-${node.assignedBlock.end.toFixed(2)} MHz`;
                    
                    let timeDisplay = 'Constant (WMAS)';
                    if (node.isHouseSystem === false && node.startTime && node.endTime) {
                        const start = new Date(node.startTime);
                        const end = new Date(node.endTime);
                        const day = String(start.getDate()).padStart(2, '0');
                        const month = String(start.getMonth() + 1).padStart(2, '0');
                        const dateStr = `${day}/${month}/${start.getFullYear()}`;
                        const startTimeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                        const endTimeStr = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                        timeDisplay = `${dateStr} ${startTimeStr} - ${endTimeStr}`;
                    }

                    const profile = WMAS_PRESET_PROFILES.find(p => p.id === node.profileId);
                    const equipmentName = profile ? `${profile.name} (${rangeStr})` : `WMAS Block (${rangeStr})`;

                    rows.push({
                        frequency: freq,
                        id: node.id,
                        label: node.name,
                        type: 'wmas',
                        stage: node.stage || (node.isHouseSystem !== false ? 'Global' : 'TBD'),
                        times: timeDisplay,
                        equipment: equipmentName,
                        band: node.assignedBlock.tvChannel ? `CH ${node.assignedBlock.tvChannel}` : 'Custom',
                        status: '🔒',
                        equipmentKey: node.profileId
                    });
                }
            });
        }

        return rows;
    }, [festivalActs, constantSystems, houseSystems, wmasState, fullEquipmentDatabase]);

    const processedTabulatedPlan = useMemo(() => {
        let result = [...rawTabulatedPlan];
        Object.entries(ledgerFilters).forEach(([field, filterVal]) => {
            if (!filterVal) return;
            const term = (filterVal as string).toLowerCase();
            result = result.filter(row => String(row[field as keyof PlanRow]).toLowerCase().includes(term));
        });
        if (ledgerSort.direction) {
            result.sort((a, b) => {
                const valA = a[ledgerSort.field], valB = b[ledgerSort.field];
                if (typeof valA === 'number' && typeof valB === 'number') return ledgerSort.direction === 'asc' ? valA - valB : valB - valA;
                return ledgerSort.direction === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
            });
        }
        return result;
    }, [rawTabulatedPlan, ledgerSort, ledgerFilters]);

    const uniqueWwbGroups = useMemo(() => {
        const groups: Record<string, { name: string, count: number }> = {};
        rawTabulatedPlan.forEach(f => {
            const key = f.equipmentKey || 'custom';
            if (!groups[key]) {
                groups[key] = { name: f.equipment || 'Unknown Hardware', count: 0 };
            }
            groups[key].count++;
        });
        return Object.entries(groups).map(([key, data]) => ({ key, ...data }));
    }, [rawTabulatedPlan]);

    const anyFrequenciesLocked = useMemo(() => {
        return [...constantSystems, ...houseSystems, ...festivalActs].some(ent => ent.frequencies?.some(f => f.locked));
    }, [festivalActs, constantSystems, houseSystems]);

    const handleLockAllSite = (lock: boolean) => {
        const update = (entity: any) => ({ ...entity, frequencies: entity.frequencies?.map((f: any) => ({ ...f, locked: lock })) });
        setFestivalActs(prev => prev.map(update));
        setConstantSystems(prev => prev.map(update));
        setHouseSystems(prev => prev.map(update));
    };

    const handleGenerate = async () => {
        setIsGenerating(true); setOptimizationReport(null);
        let reqTotal = 0;
        [...constantSystems, ...houseSystems, ...festivalActs].forEach(s => [...(s.micRequests || []), ...(s.iemRequests || [])].forEach(r => reqTotal += r.count));
        const manualEx = manualExclusions.split(',').map(s => { const parts = s.split('-').map(p => parseFloat(p.trim())); return parts.length === 2 ? { min: parts[0], max: parts[1] } : null; }).filter((x): x is { min: number, max: number } => x !== null);
        
        setProgress({ found: 0, processed: 0, total: 0, totalRequested: reqTotal, status: 'Initializing Engine...' });

        try {
            const newConstants = await generateConstantFrequencies(constantSystems, houseSystems, zoneConfigs, distances, fullEquipmentDatabase, manualEx, compatibilityMatrix, (p) => setProgress(prev => ({ ...prev, status: p.status || 'Calculating Static TX...' })), null, equipmentOverrides, tvStates, tvRegion, wmasState);
            setConstantSystems(newConstants);
            
            const newHouse = await generateHouseSystemsFrequencies(houseSystems, newConstants, zoneConfigs, distances, fullEquipmentDatabase, manualEx, compatibilityMatrix, (p) => setProgress(prev => ({ ...prev, status: p.status || 'Calculating House Systems...' })), null, equipmentOverrides, tvStates, tvRegion, wmasState);
            setHouseSystems(newHouse);
            
            const { results: plan, report } = await generateFestivalPlan(festivalActs, newConstants, newHouse, zoneConfigs, distances, overlapMinutes, fullEquipmentDatabase, manualEx, compatibilityMatrix, (p) => setProgress(prev => ({ ...p, totalRequested: reqTotal, status: p.status || prev.status })), undefined, null, equipmentOverrides, tvStates, tvRegion, wmasState);
            setFestivalActs(plan); setOptimizationReport(report);
            setIsHudMinimized(false);
        } catch (e) { console.error(e); } finally { setIsGenerating(false); }
    };

    const handleAnalyzeDiagnostic = () => {
        const isFilterActive = diagSelectedIds.size > 0;
        if (!isFilterActive) {
            alert("No focused Acts, House Systems or Constant Transmits selected for audit.");
            return;
        }

        const filteredActs = festivalActs.filter(a => diagSelectedIds.has(a.id));
        const filteredConstants = constantSystems.filter(s => diagSelectedIds.has(`const-${s.stageName}`));
        const filteredHouse = houseSystems.filter(s => diagSelectedIds.has(`house-${s.stageName}`));

        const pool = [...filteredActs, ...filteredConstants, ...filteredHouse].flatMap(e => e.frequencies || []).filter(f => f.value > 0);
        if (pool.length < 2) { alert("Insufficient focus data. Select >= 2 active channels to audit."); return; }
        
        const result = validateFestivalCompatibility(filteredActs, filteredConstants, filteredHouse, zoneConfigs, distances, fullEquipmentDatabase, compatibilityMatrix, overlapMinutes, equipmentOverrides, wmasState);
        setDiagnosticConflicts(result.conflicts); setHasAnalyzed(true);
    };

    const handleTvChannelCycle = (channel: number) => {
        setTvStates(prev => {
            const current = prev[channel] || 'available';
            let next: TVChannelState = 'available';
            if (current === 'available') next = 'mic-only';
            else if (current === 'mic-only') next = 'iem-only';
            else if (current === 'iem-only') next = 'blocked';
            else if (current === 'blocked') next = 'available';
            const nextMap = { ...prev, [channel]: next };
            if (setTvChannelStates) setTvChannelStates(nextMap);
            return nextMap;
        });
    };

    const handleBlockAllTvChannels = () => {
        const channelMap = tvRegion === 'uk' ? UK_TV_CHANNELS : US_TV_CHANNELS;
        const next: Record<number, TVChannelState> = {};
        Object.keys(channelMap).forEach(ch => {
            next[Number(ch)] = 'blocked';
        });
        setTvStates(next);
        if (setTvChannelStates) setTvChannelStates(next);
    };

    const handleClearTv = () => {
        setTvStates({});
        if (setTvChannelStates) setTvChannelStates({});
    };

    const handleWwbSmartExport = (eqKey?: string) => {
        setIsExportMenuOpen(false);
        let freqs = rawTabulatedPlan;
        let filename = `WWB_COORD_FESTIVAL_${new Date().toISOString().slice(0, 10)}`;
        if (eqKey) {
            freqs = freqs.filter(f => f.equipmentKey === eqKey);
            const group = uniqueWwbGroups.find(g => g.key === eqKey);
            const cleanedName = (group?.name || eqKey).replace(/\s+/g, '_').toUpperCase();
            filename += `_${cleanedName}`;
        }
        
        const content = freqs.map(f => f.frequency.toFixed(3)).join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportPlan = (format: 'pdf' | 'csv' | 'xlsx' | 'txt' | 'wwb') => {
        setIsExportMenuOpen(false);
        const filename = `festival_rf_plan_${new Date().toISOString().slice(0, 10)}`;
        
        if (format === 'wwb') {
            let csv = "Frequency,Name,Type,Band,RF Profile\n";
            processedTabulatedPlan.forEach(row => {
                const wwbType = row.type === 'iem' ? 'In-ear Monitor' : 'Frequency';
                const cleanedProfile = row.equipment.replace(/^Shure\s+/i, '').replace(/\s*\(.*?\)/g, '').trim();
                csv += `${row.frequency.toFixed(3)},"${row.label}","${wwbType}","${row.band}","${cleanedProfile}"\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}_WWB_Coordination.csv`;
            a.click();
        } else if (format === 'csv' || format === 'xlsx') {
            let csv = "ID,Label,Frequency,Type,Allocation,Times,Equipment\n";
            processedTabulatedPlan.forEach(row => {
                csv += `${row.id},"${row.label}",${row.frequency},${row.type},"${row.stage}","${row.times}","${row.equipment}"\n`;
            });
            const blob = new Blob([csv], { type: format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `${filename}.${format === 'xlsx' ? 'xls' : 'csv'}`; a.click();
        } else if (format === 'txt') {
            let txt = "FESTIVAL RF COORDINATION LEDGER\n================================\n\n";
            processedTabulatedPlan.forEach(row => {
                txt += `FREQ: ${row.frequency.toFixed(3)} MHz | ID: ${row.id} | LABEL: ${row.label} | TYPE: ${row.type} | STAGE: ${row.stage} | TIMES: ${row.times}\n`;
            });
            const blob = new Blob([txt], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `${filename}.txt`; a.click();
        } else if (format === 'pdf') {
            // @ts-ignore
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            doc.setFontSize(18);
            doc.text('Festival RF Coordination Ledger', 14, 20);
            doc.setFontSize(10);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
            const tableData = processedTabulatedPlan.map(row => [row.frequency.toFixed(3), row.label, row.type, row.stage, row.times, row.equipment]);
            // @ts-ignore
            doc.autoTable({ startY: 35, head: [['Freq', 'Label', 'Type', 'Allocation', 'Times', 'Equipment']], body: tableData, theme: 'grid', headStyles: { fillStyle: [30, 41, 59] }, alternateRowStyles: { fillStyle: [241, 245, 249] } });
            doc.save(`${filename}.pdf`);
        }
    };

    const handleFreqAction = (actId: string, freqId: string, action: 'lock' | 'remove' | 'value' | 'label' | 'type', newValue?: any) => {
        setFestivalActs(prev => prev.map(act => {
            if (act.id !== actId) return act;
            const nextFreqs = [...(act.frequencies || [])];
            if (action === 'remove') {
                return { ...act, frequencies: nextFreqs.filter(f => f.id !== freqId) };
            }
            const updatedFreqs = nextFreqs.map(f => {
                if (f.id !== freqId) return f;
                switch (action) {
                    case 'lock': return { ...f, locked: !f.locked };
                    case 'value': return { ...f, value: parseFloat(newValue) || 0 };
                    case 'label': return { ...f, label: newValue };
                    case 'type': return { ...f, type: newValue as TxType };
                    default: return f;
                }
            });
            return { ...act, frequencies: updatedFreqs };
        }));
    };

    const handleAddGlobalMics = () => {
        setFestivalActs(prev => prev.map(act => ({
            ...act,
            micRequests: [
                ...act.micRequests,
                { id: `req-global-mic-${Date.now()}-${Math.random()}`, equipmentKey: 'shure-ad-g56', count: 4, compatibilityLevel: 'standard', linearMode: false }
            ]
        })));
    };

    const handleAddGlobalIems = () => {
        setFestivalActs(prev => prev.map(act => ({
            ...act,
            iemRequests: [
                ...act.iemRequests,
                { id: `req-global-iem-${Date.now()}-${Math.random()}`, equipmentKey: 'shure-psm1000-g10', count: 4, compatibilityLevel: 'standard', linearMode: false }
            ]
        })));
    };

    const patchedAnalyzerFrequencies = useMemo(() => {
        const pool: Frequency[] = [];
        if (diagSelectedIds.size === 0) return [];
        
        constantSystems.forEach(s => {
            const id = `const-${s.stageName}`;
            if (diagSelectedIds.has(id)) {
                s.frequencies?.forEach(f => pool.push(f));
            }
        });
        houseSystems.forEach(s => {
            const id = `house-${s.stageName}`;
            if (diagSelectedIds.has(id)) {
                s.frequencies?.forEach(f => pool.push(f));
            }
        });
        festivalActs.forEach(a => {
            if (diagSelectedIds.has(a.id)) {
                a.frequencies?.forEach(f => pool.push(f));
            }
        });
        return pool.filter(f => f.value > 0);
    }, [constantSystems, houseSystems, festivalActs, diagSelectedIds]);

    const selectedWmasIds = useMemo(() => {
        const ids = new Set<string>();
        if (wmasState && wmasState.nodes) {
            wmasState.nodes.forEach(node => {
                if (diagSelectedIds.has(`wmas-${node.id}`)) {
                    ids.add(node.id);
                }
            });
        }
        return ids;
    }, [wmasState, diagSelectedIds]);

    const toggleFilterId = (id: string) => {
        setDiagSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleSortToggle = (field: keyof PlanRow) => {
        setLedgerSort(prev => {
            if (prev.field !== field) return { field, direction: 'asc' };
            if (prev.direction === 'asc') return { field, direction: 'desc' };
            if (prev.direction === 'desc') return { field, direction: null };
            return { field, direction: 'asc' };
        });
    };

    const SortIcon = ({ field }: { field: keyof PlanRow }) => {
        if (ledgerSort.field !== field || !ledgerSort.direction) return <span className="ml-1 opacity-20">⇅</span>;
        return <span className="ml-1 text-cyan-400 font-bold">{ledgerSort.direction === 'asc' ? '▲' : '▼'}</span>;
    };

    return (
        <div className="space-y-6 relative pb-20">
            {isConverterOpen && (
                <ExcelToCsvConverter 
                    onClose={() => setIsConverterOpen(false)} 
                    onSync={(newActs) => setFestivalActs(prev => [...prev, ...newActs])}
                    zoneConfigs={zoneConfigs}
                />
            )}
            
            <div className={`fixed bottom-4 right-4 z-[100] w-[calc(100vw-2rem)] sm:w-[340px] md:w-[400px] transition-all duration-500 transform ${isGenerating ? 'scale-95' : 'scale-100'}`}>
                <div className={`bg-slate-950/95 backdrop-blur-3xl border-2 shadow-[0_40px_120px_rgba(0,0,0,0.7)] rounded-2xl overflow-y-auto transition-all duration-300 ${isHudMinimized ? 'h-14' : 'h-auto max-h-[850px] md:max-h-[85vh]'} custom-scrollbar`} style={{ borderColor: optimizationReport ? (optimizationReport.shortfall === 0 ? '#10b981' : '#ef4444') : '#3b82f6' }}>
                    <div className={`sticky top-0 z-[110] flex items-center justify-between p-3.5 cursor-pointer select-none border-b border-white/10 ${optimizationReport ? (optimizationReport.shortfall === 0 ? 'bg-emerald-500/20' : 'bg-red-500/20') : 'bg-blue-600/20'}`} onClick={() => setIsHudMinimized(!isHudMinimized)}>
                        <div className="flex items-center gap-2">
                            <span className={`text-sm ${isGenerating ? 'animate-spin' : ''}`}>{isGenerating ? '⚙️' : (optimizationReport ? (optimizationReport.shortfall === 0 ? '✅' : '👨‍🔧') : '📊')}</span>
                            <h5 className="text-[10px] font-black uppercase tracking-[0.15em] text-white">Festival Command Center</h5>
                        </div>
                        <div className="flex items-center gap-2">
                            {optimizationReport && <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-sm ${optimizationReport.shortfall === 0 ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>{optimizationReport.found}/{optimizationReport.requested} OK</span>}
                            <button className="text-white opacity-60 hover:opacity-100 text-xl leading-none transition-opacity">{isHudMinimized ? '↑' : '↓'}</button>
                        </div>
                    </div>
                    {!isHudMinimized && (
                        <div className="p-4 space-y-4 overflow-y-visible">
                            <button onClick={handleGenerate} disabled={isGenerating} className={`${generateButton} w-full !py-4 !text-xs !rounded-xl flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(245,158,11,0.3)] ring-1 ring-amber-400/30`}>{isGenerating ? <><span className="w-4 h-4 border-2 border-slate-900/20 border-t-slate-900 rounded-full animate-spin"></span>COORDINATING SITE...</> : 'GENERATE SITE PLAN'}</button>
                            
                            {isGenerating && (
                                <div className="space-y-2 p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 animate-in fade-in duration-300">
                                    <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-indigo-300">
                                        <span>Engine Progress</span>
                                        <span className="font-mono">{Math.round((progress.processed / (progress.totalRequested || 1)) * 100)}%</span>
                                    </div>
                                    <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-white/5 shadow-inner">
                                        <div 
                                            className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300" 
                                            style={{ width: `${(progress.processed / (progress.totalRequested || 1)) * 100}%` }}
                                        />
                                    </div>
                                    <p className="text-[7px] text-slate-500 uppercase font-black text-center tracking-tighter">
                                        {progress.status || `Patching ${progress.processed} of ${progress.totalRequested} channels...`}
                                    </p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => handleLockAllSite(!anyFrequenciesLocked)} className={`${greenButton} !py-2.5 !text-[9px] !rounded-xl flex items-center justify-center gap-2`}><span className="text-xs">{anyFrequenciesLocked ? '🔓' : '🔒'}</span>{anyFrequenciesLocked ? 'UNLOCK ALL SITE' : 'LOCK ALL SITE'}</button>
                                <button onClick={() => setShowTabulation(!showTabulation)} className={`${greenButton} !py-2.5 !text-[9px] !rounded-xl flex items-center justify-center gap-2`}><span className="text-xs">📋</span> TABULATE PLAN</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <Card className="!p-4 !bg-slate-900 border-2 border-indigo-500/40 shadow-2xl relative z-10">
                <div className="flex flex-col xl:flex-row justify-between items-stretch gap-6 mb-6 pb-6 border-b border-white/5">
                    <div className="flex-1 space-y-4">
                        <div className="flex justify-between items-center">
                            <CardTitle className="!mb-0 text-2xl">Festival Setup & Topology</CardTitle>
                            <div className="flex items-center gap-4 bg-slate-950/50 p-2 rounded-xl border border-white/5">
                                <div className="flex flex-col items-end">
                                    <label className="text-[9px] text-slate-500 font-black uppercase mb-1">Total Site Stages</label>
                                    <div className="flex items-center bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
                                        <button onClick={() => handleNumZonesChange((Math.max(1, numZones - 1)).toString())} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-indigo-400 font-bold transition-all">-</button>
                                        <input type="number" value={numZonesInput} onChange={e => handleNumZonesChange(e.target.value)} className="w-12 bg-transparent text-center font-mono text-xs text-white font-bold outline-none" />
                                        <button onClick={() => handleNumZonesChange((Math.min(20, numZones + 1)).toString())} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-indigo-400 font-bold transition-all">+</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Stage Designation List */}
                        <div className="p-4 bg-slate-950/50 rounded-xl border border-white/5">
                            <label className="text-[10px] text-slate-500 font-black uppercase mb-3 block tracking-widest">Stage Designation Ledger</label>
                            <div className="flex flex-wrap gap-3">
                                {zoneConfigs.map((cfg, idx) => (
                                    <div key={idx} className="flex bg-slate-800 rounded-lg border border-slate-700 overflow-hidden shadow-md group">
                                        <span className="bg-slate-700 px-2 flex items-center text-[10px] font-black text-slate-400">{idx + 1}</span>
                                        <input 
                                            type="text" 
                                            value={cfg.name} 
                                            onChange={e => handleStageNameChange(idx, e.target.value)} 
                                            className="bg-transparent px-3 py-1.5 text-[11px] text-white font-bold outline-none w-40 focus:bg-indigo-900/30 transition-all"
                                            placeholder={`Stage ${idx + 1}`}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] text-slate-500 uppercase font-black mb-1 block">Time Overlap Buffer (min)</label>
                                <input type="number" value={overlapMinutes} onChange={e => setOverlapMinutes(parseInt(e.target.value) || 0)} className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-sm text-cyan-400 font-bold" />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 uppercase font-black mb-1 block">Manual Exclusions (MHz)</label>
                                <input value={manualExclusions} onChange={e => setManualExclusions(e.target.value)} placeholder="e.g. 500-505, 606.5-608" className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-xs font-mono text-slate-300" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-cyan-400">📍 Stage Distance Matrix (m)</h4>
                            <div className="flex bg-slate-950 border border-indigo-500/30 rounded-lg p-1 items-center gap-2">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-2">Global Separation:</span>
                                <input 
                                    type="number" 
                                    value={globalDistInput} 
                                    onChange={e => setGlobalDistInput(e.target.value)}
                                    className="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-cyan-400 text-center outline-none" 
                                />
                                <button 
                                    onClick={handleApplyGlobalDistance}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-[8px] font-black uppercase px-2 py-1 rounded transition-colors"
                                >
                                    Apply All
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-slate-700 bg-black/20">
                            <table className="w-full text-[10px] text-center border-collapse">
                                <thead>
                                    <tr className="bg-slate-950">
                                        <th className="p-3 border border-slate-800"></th>
                                        {zoneConfigs.map((z, i) => <th key={i} className="p-3 border border-slate-800 text-slate-500 font-black">{z.name}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {distances.map((row, rIdx) => (
                                        <tr key={rIdx}>
                                            <th className="p-3 border border-slate-800 bg-slate-950 text-slate-500 font-black text-left">{zoneConfigs[rIdx]?.name}</th>
                                            {row.map((val, cIdx) => (
                                                <td key={cIdx} className="p-0 border border-slate-800">
                                                    {rIdx === cIdx ? <div className="h-10 bg-slate-900/50" /> : <input type="number" value={val} onChange={e => {
                                                        const next = [...distances.map(r => [...r])];
                                                        next[rIdx][cIdx] = parseInt(e.target.value) || 0;
                                                        if (rIdx !== cIdx) next[cIdx][rIdx] = next[rIdx][cIdx];
                                                        setDistances(next);
                                                    }} className="w-full h-10 bg-transparent text-center font-mono text-cyan-400 outline-none focus:bg-indigo-600/10" />}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">⛓️ Manual Compatibility Links</h4>
                        <div className="overflow-x-auto rounded-xl border border-slate-700 bg-black/20">
                            <table className="w-full text-[10px] text-center border-collapse">
                                <thead>
                                    <tr className="bg-slate-950">
                                        <th className="p-3 border border-slate-800"></th>
                                        {zoneConfigs.map((z, i) => <th key={i} className="p-3 border border-slate-800 text-slate-500 font-black">{z.name}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {compatibilityMatrix.map((row, rIdx) => (
                                        <tr key={rIdx}>
                                            <th className="p-3 border border-slate-800 bg-slate-950 text-slate-500 font-black text-left">{zoneConfigs[rIdx]?.name}</th>
                                            {row.map((val, cIdx) => (
                                                <td key={cIdx} className="p-3 border border-slate-800 text-center">{rIdx === cIdx ? '—' : <input type="checkbox" checked={val} onChange={() => {
                                                    const next = compatibilityMatrix.map(r => [...r]);
                                                    next[rIdx][cIdx] = !next[rIdx][cIdx];
                                                    if (rIdx !== cIdx) next[cIdx][rIdx] = next[rIdx][cIdx];
                                                    setCompatibilityMatrix(next);
                                                }} className="w-4 h-4 accent-indigo-500" />}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </Card>

            <Card className="relative z-10">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <CardTitle className="!mb-0 text-base">📺 Quad-State TV Grid</CardTitle>
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter mt-1">Define protected whitespace. Click to cycle states.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex gap-3 text-[8px] font-black uppercase overflow-x-auto pb-1 scrollbar-hide">
                            <div className="flex items-center gap-1.5 whitespace-nowrap"><div className="w-2 h-2 rounded bg-emerald-500/10 border border-emerald-500/30" /> <span className="text-slate-400">Avail</span></div>
                            <div className="flex items-center gap-1.5 whitespace-nowrap"><div className="w-2 h-2 rounded bg-sky-400 border border-sky-300" /> <span className="text-sky-400">Mic Only</span></div>
                            <div className="flex items-center gap-1.5 whitespace-nowrap"><div className="w-2 h-2 rounded bg-amber-500 border border-amber-400" /> <span className="text-amber-500">IEM</span></div>
                            <div className="flex items-center gap-1.5 whitespace-nowrap"><div className="w-2 h-2 rounded bg-rose-600 border border-rose-500" /> <span className="text-rose-500">Blocked</span></div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleBlockAllTvChannels} className="text-[9px] font-black uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-1 rounded hover:bg-rose-600 hover:text-white transition-all">Block All</button>
                            <button onClick={handleClearTv} className="text-[9px] font-black uppercase bg-slate-800 text-slate-400 border border-slate-700 px-2 py-1 rounded hover:bg-slate-700 hover:text-white transition-all">Clear All</button>
                        </div>
                        <select value={tvRegion} onChange={e => setTvRegion(e.target.value as any)} className="bg-slate-800 text-xs border border-slate-700 rounded px-2 py-1 text-slate-200">
                            <option value="uk">UK (8MHz)</option>
                            <option value="us">US (6MHz)</option>
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-11 gap-2 p-2 bg-slate-950/30 rounded-xl">
                    {Object.entries(tvRegion === 'uk' ? UK_TV_CHANNELS : US_TV_CHANNELS).map(([chStr, [start, end]]) => {
                        const ch = parseInt(chStr);
                        const state = tvStates[ch] || 'available';
                        
                        let channelClasses = 'p-1.5 text-center rounded-lg border-2 transition-all cursor-pointer select-none ';
                        if (state === 'blocked') channelClasses += 'bg-rose-600 border-rose-500 hover:bg-rose-500 shadow-lg';
                        else if (state === 'mic-only') channelClasses += 'bg-sky-400 border-sky-300 hover:bg-sky-300 shadow-lg';
                        else if (state === 'iem-only') channelClasses += 'bg-amber-500 border-amber-400 hover:bg-amber-400 shadow-lg';
                        else channelClasses += 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/50';

                        return (
                            <button key={ch} onClick={() => handleTvChannelCycle(ch)} className={channelClasses}>
                                <div className={`text-[10px] font-black ${state === 'available' ? 'text-emerald-400' : 'text-slate-900'}`}>CH {ch}</div>
                                <div className={`text-[8px] font-mono tracking-tighter ${state === 'available' ? 'text-slate-500' : 'text-white/60'}`}>{start}-{end}</div>
                                <div className={`mt-1 text-[7px] font-black uppercase ${state === 'available' ? 'text-white/10' : 'text-white/40'}`}>
                                    {state === 'mic-only' && 'MIC'}
                                    {state === 'iem-only' && 'IEM'}
                                    {state === 'blocked' && 'OFF'}
                                    {state === 'available' && '—'}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </Card>

            {showTabulation && (
                <Card className="!bg-black/40 border-cyan-500/30 shadow-[0_0_50px_rgba(34,211,238,0.1)] relative z-20 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex justify-between items-center mb-4">
                        <CardTitle className="!mb-0 text-sm uppercase tracking-[0.2em] text-cyan-400">Authoritative Site RF Ledger</CardTitle>
                        <button onClick={() => setShowTabulation(false)} className="text-slate-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">&times; Close Ledger</button>
                    </div>
                    <div className="max-h-[600px] overflow-auto rounded-xl border border-white/5 shadow-inner custom-scrollbar">
                        <table className="w-full text-left border-collapse text-[10px]">
                            <thead className="bg-slate-900 sticky top-0 z-10 shadow-sm">
                                <tr className="uppercase font-black text-slate-500 border-b border-white/10">
                                    <th className="p-3 cursor-pointer" onClick={() => handleSortToggle('frequency')}>Freq <SortIcon field="frequency" /></th>
                                    <th className="p-3 cursor-pointer" onClick={() => handleSortToggle('label')}>Label <SortIcon field="label" /></th>
                                    <th className="p-3 cursor-pointer" onClick={() => handleSortToggle('type')}>Type <SortIcon field="type" /></th>
                                    <th className="p-3 cursor-pointer" onClick={() => handleSortToggle('stage')}>Stage <SortIcon field="stage" /></th>
                                    <th className="p-3 cursor-pointer" onClick={() => handleSortToggle('times')}>Date & Times <SortIcon field="times" /></th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3">Purchase</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {processedTabulatedPlan.map((row, i) => (
                                    <tr key={i} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-3 font-mono text-cyan-400 font-black">{row.frequency.toFixed(3)}</td>
                                        <td className="p-3 text-white font-bold">{row.label}</td>
                                        <td className="p-3"><span className={`px-1.5 py-0.5 rounded-[4px] uppercase text-[8px] font-black border ${row.type === 'iem' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>{row.type}</span></td>
                                        <td className="p-3 text-indigo-300 font-bold uppercase tracking-tighter">{row.stage}</td>
                                        <td className="p-3 font-mono text-slate-400">{row.times}</td>
                                        <td className="p-3 text-center text-sm">{row.status}</td>
                                        <td className="p-3">
                                            {row.affiliateUrl ? (
                                                <a 
                                                    href={row.affiliateUrl} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded text-[9px] font-black text-emerald-400 uppercase tracking-tighter hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                                                >
                                                    🛒 Order Gear
                                                </a>
                                            ) : (
                                                <span className="text-[8px] text-slate-600 font-black uppercase tracking-tighter italic opacity-30">N/A</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {processedTabulatedPlan.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-12 text-center text-slate-600 uppercase font-black tracking-widest italic opacity-50">No frequencies allocated in the site plan.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            <div className="bg-slate-800/50 p-2 rounded-lg flex flex-wrap gap-2 relative z-10">
                {(['acts', 'constant', 'house'] as const).map(tab => {
                    let styles = "";
                    if (tab === 'acts') {
                        styles = activeSubTab === tab 
                            ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' 
                            : 'bg-indigo-900/20 border-indigo-500/20 text-indigo-400 hover:bg-indigo-900/40';
                    } else if (tab === 'constant') {
                        styles = activeSubTab === tab 
                            ? 'bg-green-500 border-green-400 text-slate-950 shadow-lg' 
                            : 'bg-green-900/20 border-green-500/20 text-green-400 hover:bg-green-900/40';
                    } else if (tab === 'house') {
                        styles = activeSubTab === tab 
                            ? 'bg-blue-800 border-blue-600 text-white shadow-lg' 
                            : 'bg-blue-900/20 border-blue-500/20 text-blue-400 hover:bg-blue-900/40';
                    }
                    return (
                        <button key={tab} onClick={() => setActiveSubTab(tab)} className={`flex-1 py-2.5 rounded font-black uppercase tracking-widest text-[10px] transition-all border ${styles}`}>
                            {tab === 'acts' && '🎤 Performing Acts'}
                            {tab === 'constant' && '🛰️ Constant TX'}
                            {tab === 'house' && '📡 House Systems'}
                        </button>
                    );
                })}
            </div>

            {/* TAB ACTIONS */}
            {activeSubTab === 'acts' && (
                <div className="space-y-4 mt-4">
                    <div className="flex gap-2">
                        <button onClick={() => setFestivalActs([...festivalActs, { id: `act-${Date.now()}`, actName: `New Act`, stage: zoneConfigs[0]?.name || 'Stage 1', startTime: new Date(), endTime: new Date(Date.now() + 3600000), active: true, micRequests: [], iemRequests: [], frequencies: [] }])} className={`${yellowButton} flex-1`}>+ Add Act</button>
                        <button onClick={() => fileInputRef.current?.click()} className={`${actionButton} flex-1`}>Import CSV</button>
                        <button onClick={() => setIsConverterOpen(true)} className={`${actionButton} flex-1 !bg-indigo-600 border-indigo-400`}>🧮 EXCEL CONVERTER</button>
                        <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={e => {
                                const file = e.target.files?.[0]; if (!file) return;
                                const r = new FileReader(); r.onload = () => {
                                    const lines = (r.result as string).split('\n').slice(1).filter(l => l.trim());
                                    const newActs = lines.map(l => {
                                        const [name, stage, start, end] = l.split(',').map(s => s.replace(/^["']|["']$/g, '').trim());
                                        return { 
                                            id: `act-${Date.now()}-${Math.random()}`, 
                                            actName: name, 
                                            stage: stage || zoneConfigs[0]?.name || 'Stage 1', 
                                            startTime: parseFlexibleDate(start), 
                                            endTime: parseFlexibleDate(end), 
                                            active: true, 
                                            micRequests: [], 
                                            iemRequests: [], 
                                            frequencies: [] 
                                        } as FestivalAct;
                                    });
                                    setFestivalActs(prev => [...prev, ...newActs]);
                                }; r.readAsText(file);
                        }} />
                    </div>
                    
                    <div className="bg-slate-900/40 p-4 rounded-xl border border-indigo-500/20 flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Bulk Slot Initialization</span>
                            <span className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">Initialize equipment forms for every act in the current bill</span>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <button 
                                onClick={handleAddGlobalMics}
                                className="flex-1 md:flex-none px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-lg font-black uppercase tracking-widest text-[9px] border-b-4 border-emerald-800 shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2"
                            >
                                <span className="text-xs">🎤</span> + ADD 1x MIC SLOT TO ALL ACTS
                            </button>
                            <button 
                                onClick={handleAddGlobalIems}
                                className="flex-1 md:flex-none px-4 py-2.5 bg-gradient-to-r from-rose-600 to-pink-500 hover:from-rose-500 hover:to-pink-400 text-white rounded-lg font-black uppercase tracking-widest text-[9px] border-b-4 border-rose-800 shadow-lg shadow-rose-900/20 transition-all flex items-center justify-center gap-2"
                            >
                                <span className="text-xs">🎧</span> + ADD 1x IEM SLOT TO ALL ACTS
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SITE EXPORT & DISTRIBUTION CARD */}
            <Card className="!bg-slate-900 border-2 border-cyan-500/40 shadow-2xl relative z-40 mt-4">
                <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
                    <div className="flex-1 space-y-2">
                        <CardTitle className="!mb-0 text-cyan-400 text-sm uppercase tracking-[0.2em]">Site Export & Distribution</CardTitle>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">Generate authoritative coordination files for distribution or device import.</p>
                    </div>
                    <div className="w-full lg:w-auto">
                        <div className="relative">
                            <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className={`${actionButton} w-full lg:w-64 !py-3 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/10`}>
                                <span>📥</span> EXPORT RF PLAN <span className="text-[8px] opacity-60">▼</span>
                            </button>
                            {isExportMenuOpen && (
                                <div className="absolute top-full right-0 mt-2 bg-slate-800 border border-indigo-500/40 rounded-xl shadow-2xl z-[120] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200 divide-y divide-white/5">
                                    <div className="bg-indigo-500/15 p-2">
                                        <div className="px-2 py-1.5 flex items-center gap-2 mb-2 border-b border-indigo-500/20">
                                            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.1em]">WWB Smart Export (.TXT)</span>
                                        </div>
                                        <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto custom-scrollbar">
                                            <button onClick={() => handleWwbSmartExport()} className="w-full text-left px-3 py-2.5 hover:bg-indigo-600 rounded bg-indigo-500/30 text-[9px] font-black text-white uppercase tracking-tighter transition-all border border-indigo-400/20 shadow-sm">
                                                &bull; Full Site Frequency List
                                            </button>
                                            {uniqueWwbGroups.length > 0 ? uniqueWwbGroups.map(group => (
                                                <button 
                                                    key={group.key}
                                                    onClick={() => handleWwbSmartExport(group.key)}
                                                    className="w-full text-left px-3 py-2.5 hover:bg-slate-700 rounded bg-slate-950/60 border border-white/10 text-[9px] font-bold text-indigo-200 uppercase tracking-tighter transition-all"
                                                >
                                                    &bull; Export {group.name} - {group.count} CH
                                                </button>
                                            )) : (
                                                <div className="text-[8px] text-slate-500 px-3 py-2 italic">Coordinate site to populate hardware groups...</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 divide-y divide-white/5">
                                        <button onClick={() => handleExportPlan('pdf')} className="w-full text-left p-3.5 hover:bg-slate-700 transition-colors flex items-center justify-between">
                                            <span className="text-white font-bold text-[10px] uppercase tracking-wider">PDF Site Ledger</span>
                                            <span className="text-xs">📄</span>
                                        </button>
                                        <button onClick={() => handleExportPlan('xlsx')} className="w-full text-left p-3.5 hover:bg-slate-700 transition-colors flex items-center justify-between">
                                            <span className="text-white font-bold text-[10px] uppercase tracking-wider">Excel Spreadsheet</span>
                                            <span className="text-xs">📊</span>
                                        </button>
                                        <button onClick={() => handleExportPlan('txt')} className="w-full text-left p-3.5 hover:bg-slate-700 transition-colors flex items-center justify-between">
                                            <span className="text-white font-bold text-[10px] uppercase tracking-wider">Plain Text (.TXT)</span>
                                            <span className="text-xs">📄</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Card>

            {/* CONTENT LISTS */}
            {activeSubTab === 'acts' && (
                <div className="space-y-4 mt-4 animate-in fade-in duration-500 relative z-0">
                    {festivalActs.map(act => (
                        <Card key={act.id} className="!p-4 !bg-slate-900/80">
                            <div className="flex justify-between items-center mb-2">
                                <input value={act.actName} onChange={e => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, actName: e.target.value } : a))} className="bg-transparent font-bold text-lg text-white outline-none border-b border-white/10" />
                                <button onClick={() => setFestivalActs(prev => prev.filter(a => a.id !== act.id))} className="text-red-400 font-bold">&times;</button>
                            </div>

                            <div className="bg-black/40 border border-white/5 rounded-xl p-3 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Assigned Stage</label>
                                    <select 
                                        value={act.stage} 
                                        onChange={e => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, stage: e.target.value } : a))}
                                        className="bg-slate-900 border border-slate-700 rounded p-1.5 text-[10px] text-indigo-300 font-black uppercase tracking-tighter"
                                    >
                                        {zoneConfigs.map(z => <option key={z.name} value={z.name}>{z.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Start Time</label>
                                    <input 
                                        type="datetime-local" 
                                        value={toDatetimeLocal(act.startTime)}
                                        onChange={e => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, startTime: new Date(e.target.value) } : a))}
                                        className="bg-slate-900 border border-slate-700 rounded p-1.5 text-[10px] text-white font-mono"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Finish Time</label>
                                    <input 
                                        type="datetime-local" 
                                        value={toDatetimeLocal(act.endTime)}
                                        onChange={e => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, endTime: new Date(e.target.value) } : a))}
                                        className="bg-slate-900 border border-slate-700 rounded p-1.5 text-[10px] text-white font-mono"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
                                    <RequestManager title="Stage Mics" type="mic" requests={act.micRequests} onUpdate={(reqs) => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, micRequests: reqs } : a))} db={fullEquipmentDatabase} overrides={equipmentOverrides} />
                                    <FrequencyGrid frequencies={act.frequencies?.filter(f => f.type !== 'iem')} onToggleLock={id => handleFreqAction(act.id, id, 'lock')} onRemove={id => handleFreqAction(act.id, id, 'remove')} onValueChange={(id, v) => handleFreqAction(act.id, id, 'value', v)} onLabelChange={(id, v) => handleFreqAction(act.id, id, 'label', v)} onTypeChange={(id, v) => handleFreqAction(act.id, id, 'type', v)} />
                                </div>
                                <div className="p-3 bg-rose-500/5 rounded-xl border border-rose-500/20">
                                    <RequestManager title="Monitoring" type="iem" requests={act.iemRequests} onUpdate={(reqs) => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, iemRequests: reqs } : a))} db={fullEquipmentDatabase} overrides={equipmentOverrides} />
                                    <FrequencyGrid frequencies={act.frequencies?.filter(f => f.type === 'iem')} onToggleLock={id => handleFreqAction(act.id, id, 'lock')} onRemove={id => handleFreqAction(act.id, id, 'remove')} onValueChange={(id, v) => handleFreqAction(act.id, id, 'value', v)} onLabelChange={(id, v) => handleFreqAction(act.id, id, 'label', v)} onTypeChange={(id, v) => handleFreqAction(act.id, id, 'type', v)} />
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {activeSubTab === 'constant' && (
                <div className="space-y-4 mt-4 animate-in fade-in duration-500 relative z-0">
                    {constantSystems.map((sys, idx) => (
                        <Card key={idx} className="!p-4 !bg-slate-900/80">
                            <h4 className="font-bold text-indigo-400 mb-4 border-b border-white/5 pb-1 uppercase text-xs tracking-widest">{sys.stageName} - Static Gear</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
                                    <RequestManager title="Constant Mics" type="mic" requests={sys.micRequests} onUpdate={(reqs) => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, micRequests: reqs } : s))} db={fullEquipmentDatabase} overrides={equipmentOverrides} />
                                    <FrequencyGrid 
                                        frequencies={sys.frequencies?.filter(f => f.type === 'mic' || f.type === 'generic' || !f.type)} 
                                        onToggleLock={id => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, locked: !f.locked } : f) } : s))}
                                        onRemove={id => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.filter(f => f.id !== id) } : s))}
                                        onValueChange={(id, v) => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, value: parseFloat(v) || 0 } : f) } : s))}
                                        onLabelChange={(id, v) => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, label: v } : f) } : s))}
                                        onTypeChange={(id, v) => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, type: v } : f) } : s))}
                                    />
                                </div>
                                <div className="p-3 bg-rose-500/5 rounded-xl border border-rose-500/20">
                                    <RequestManager title="Monitoring" type="iem" requests={sys.iemRequests} onUpdate={(reqs) => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, iemRequests: reqs } : s))} db={fullEquipmentDatabase} overrides={equipmentOverrides} />
                                    <FrequencyGrid 
                                        frequencies={sys.frequencies?.filter(f => f.type === 'iem')} 
                                        onToggleLock={id => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, locked: !f.locked } : f) } : s))}
                                        onRemove={id => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.filter(f => f.id !== id) } : s))}
                                        onValueChange={(id, v) => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, value: parseFloat(v) || 0 } : f) } : s))}
                                        onLabelChange={(id, v) => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, label: v } : f) } : s))}
                                        onTypeChange={(id, v) => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, type: v } : f) } : s))}
                                    />
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {activeSubTab === 'house' && (
                <div className="space-y-4 mt-4 animate-in fade-in duration-500 relative z-0">
                    {houseSystems.map((sys, idx) => (
                        <Card key={idx} className="!p-4 !bg-slate-900/80">
                            <h4 className="font-bold text-yellow-400 mb-4 border-b border-white/5 pb-1 uppercase text-xs tracking-widest">{sys.stageName} - House Gear</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
                                    <RequestManager title="House Mics" type="mic" requests={sys.micRequests} onUpdate={(reqs) => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, micRequests: reqs } : s))} db={fullEquipmentDatabase} overrides={equipmentOverrides} />
                                    <FrequencyGrid 
                                        frequencies={sys.frequencies?.filter(f => f.type === 'mic' || f.type === 'generic' || !f.type)} 
                                        onToggleLock={id => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, locked: !f.locked } : f) } : s))}
                                        onRemove={id => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.filter(f => f.id !== id) } : s))}
                                        onValueChange={(id, v) => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, value: parseFloat(v) || 0 } : f) } : s))}
                                        onLabelChange={(id, v) => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, label: v } : f) } : s))}
                                        onTypeChange={(id, v) => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, type: v } : f) } : s))}
                                    />
                                </div>
                                <div className="p-3 bg-rose-500/5 rounded-xl border border-rose-500/20">
                                    <RequestManager title="Monitoring" type="iem" requests={sys.iemRequests} onUpdate={(reqs) => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, iemRequests: reqs } : s))} db={fullEquipmentDatabase} overrides={equipmentOverrides} />
                                    <FrequencyGrid 
                                        frequencies={sys.frequencies?.filter(f => f.type === 'iem')} 
                                        onToggleLock={id => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, locked: !f.locked } : f) } : s))}
                                        onRemove={id => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.filter(f => f.id !== id) } : s))}
                                        onValueChange={(id, v) => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, value: parseFloat(v) || 0 } : f) } : s))}
                                        onLabelChange={(id, v) => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, label: v } : f) } : s))}
                                        onTypeChange={(id, v) => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, type: v } : f) } : s))}
                                    />
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <div className="pt-6 relative z-0">
                <SpectrumVisualizer frequencies={patchedAnalyzerFrequencies} scanData={scanData} title="Unified Site Spectral View" wmasState={wmasState} selectedWmasIds={selectedWmasIds} />
                
                <div className="mt-4 bg-slate-900 border border-indigo-500/20 p-4 rounded-xl shadow-lg">
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="space-y-1">
                                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Master View Visibility & Diagnostics Filter</h4>
                                <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">Selected entities determine spectral plot visibility and focused audit logic.</p>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => {
                                        const allIds = new Set<string>([
                                            ...festivalActs.map(a => a.id),
                                            ...constantSystems.map(s => `const-${s.stageName}`),
                                            ...houseSystems.map(s => `house-${s.stageName}`),
                                            ...(wmasState?.nodes?.map(n => `wmas-${n.id}`) || [])
                                        ]);
                                        setDiagSelectedIds(allIds);
                                        setHasAnalyzed(false);
                                    }} 
                                    className="text-[9px] font-black text-slate-300 hover:text-indigo-400 uppercase px-3 py-1.5 bg-slate-800 rounded border border-indigo-500/20 transition-all shadow-sm"
                                >
                                    View All Site
                                </button>
                                <button 
                                    onClick={() => { setDiagSelectedIds(new Set()); setHasAnalyzed(false); }} 
                                    className="text-[9px] font-black text-slate-500 hover:text-rose-400 uppercase px-3 py-1.5 bg-slate-800 rounded border border-white/5 transition-all"
                                >
                                    Hide All / Clear Focus
                                </button>
                                <button onClick={handleAnalyzeDiagnostic} className={`${primaryButton} !py-1.5 !px-4`}>Run Focused Audit</button>
                            </div>
                        </div>
                        
                        <div className="space-y-6">
                            {wmasState && wmasState.nodes && wmasState.nodes.length > 0 && (
                                <div>
                                    <p className="text-[8px] font-black text-purple-500 uppercase mb-2 tracking-widest border-b border-purple-500/20 pb-1">Filter By WMAS Blocks:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {wmasState.nodes.map((node, idx) => {
                                            const id = `wmas-${node.id}`;
                                            const active = diagSelectedIds.has(id);
                                            return (
                                                <button 
                                                    key={idx} 
                                                    onClick={() => toggleFilterId(id)}
                                                    className={`px-2 py-1 rounded-md text-[9px] font-black transition-all border ${active ? 'bg-purple-600 border-purple-400 text-white shadow-lg' : 'bg-purple-900/10 border-purple-900/30 text-purple-600 hover:text-purple-400'}`}
                                                >
                                                    {node.name} (WMAS)
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {constantSystems.length > 0 && (
                                <div>
                                    <p className="text-[8px] font-black text-green-500 uppercase mb-2 tracking-widest border-b border-green-500/20 pb-1">Filter By Constant Transmits:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {constantSystems.map((sys, idx) => {
                                            const id = `const-${sys.stageName}`;
                                            const active = diagSelectedIds.has(id);
                                            return (
                                                <button 
                                                    key={idx} 
                                                    onClick={() => toggleFilterId(id)}
                                                    className={`px-2 py-1 rounded-md text-[9px] font-black transition-all border ${active ? 'bg-green-600 border-green-400 text-white shadow-lg' : 'bg-green-900/10 border-green-900/30 text-green-600 hover:text-green-400'}`}
                                                >
                                                    {sys.stageName} (Static)
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {houseSystems.length > 0 && (
                                <div>
                                    <p className="text-[8px] font-black text-blue-400 uppercase mb-2 tracking-widest border-b border-blue-400/20 pb-1">Filter By House Systems:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {houseSystems.map((sys, idx) => {
                                            const id = `house-${sys.stageName}`;
                                            const active = diagSelectedIds.has(id);
                                            return (
                                                <button 
                                                    key={idx} 
                                                    onClick={() => toggleFilterId(id)}
                                                    className={`px-2 py-1 rounded-md text-[9px] font-black transition-all border ${active ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-blue-900/10 border-blue-900/30 text-blue-600 hover:text-blue-400'}`}
                                                >
                                                    {sys.stageName} (House)
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {festivalActs.length > 0 && (
                                <div>
                                    <p className="text-[8px] font-black text-indigo-400 uppercase mb-2 tracking-widest border-b border-indigo-400/20 pb-1">Filter By Performing Acts:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {festivalActs.map(act => {
                                            const active = diagSelectedIds.has(act.id);
                                            return (
                                                <button 
                                                    key={act.id} 
                                                    onClick={() => toggleFilterId(act.id)}
                                                    className={`px-2 py-1 rounded-md text-[9px] font-black transition-all border ${active ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-indigo-900/10 border-indigo-900/30 text-indigo-400 hover:text-indigo-300'}`}
                                                >
                                                    {act.actName}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {hasAnalyzed && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-900 border-2 border-indigo-500/40 shadow-[0_40px_120px_rgba(0,0,0,0.8)] rounded-3xl w-full max-w-5xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className={`p-6 border-b border-white/10 flex justify-between items-center ${diagnosticConflicts.length === 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                            <div className="flex items-center gap-4">
                                <span className="text-2xl">{diagnosticConflicts.length === 0 ? '✅' : '⚠️'}</span>
                                <div>
                                    <h5 className={`text-lg font-black uppercase tracking-widest ${diagnosticConflicts.length === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {diagnosticConflicts.length === 0 ? 'Site Logic Validated' : 'Site Interaction Ledger'}
                                    </h5>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Diagnostic Audit for Selected Focus</p>
                                </div>
                            </div>
                            <button onClick={() => setHasAnalyzed(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all text-3xl leading-none">&times;</button>
                        </div>

                        <div className="p-6 max-h-[60vh] overflow-auto custom-scrollbar">
                            {diagnosticConflicts.length === 0 ? (
                                <div className="text-center py-20">
                                    <p className="text-lg text-emerald-100 font-medium mb-2">Zero Interactions Detected</p>
                                    <p className="text-sm text-slate-500 uppercase tracking-widest italic">The selected subset of the spectral plan satisfies all active interaction guard criteria.</p>
                                </div>
                            ) : (
                                <div className="rounded-xl border border-white/5 overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left border-collapse text-[11px]">
                                        <thead className="bg-slate-950">
                                            <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/10">
                                                <th className="p-4">Interaction Type</th>
                                                <th className="p-4">Affected Channel (Victim)</th>
                                                <th className="p-4">Source Clashes (Aggressors)</th>
                                                <th className="p-4">Closeness (Delta)</th>
                                                <th className="p-4">Engineering Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {diagnosticConflicts.map((c, i) => {
                                                const isFundamental = c.type.includes('Fundamental');
                                                return (
                                                    <tr key={i} className="hover:bg-white/5 transition-colors">
                                                        <td className="p-4">
                                                            <span className={`px-2 py-0.5 rounded uppercase text-[9px] font-black border ${isFundamental ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-purple-500/10 border-purple-500/20 text-purple-400'}`}>
                                                                {isFundamental ? 'Fundamental Clash' : 'Mixing Product (IMD)'}
                                                            </span>
                                                            <p className="text-[8px] text-slate-600 mt-1 uppercase font-bold">{c.type}</p>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-white font-black text-xs">{c.targetFreq.label || c.targetFreq.id}</span>
                                                                <span className="text-cyan-400 font-mono text-[10px]">{c.targetFreq.value.toFixed(3)} MHz</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="space-y-1">
                                                                {c.sourceFreqs.map((sf, sfIdx) => (
                                                                    <div key={sfIdx} className="flex items-center gap-2">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
                                                                        <span className="text-slate-300 font-bold">{sf.id}</span>
                                                                        <span className="text-slate-500 font-mono text-[9px]">({sf.value.toFixed(3)})</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td className="p-4 font-mono font-black text-rose-400 bg-rose-500/5">
                                                            {(c.diff * 1000).toFixed(1)} kHz
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="bg-slate-800/50 p-2 rounded border border-white/5 italic text-[10px] text-indigo-300 leading-snug">
                                                                {isFundamental 
                                                                    ? "Direct overlap detected. Frequencies must be spaced further apart or moved to separate stages." 
                                                                    : "Non-linear mixing detected. Shift one of the aggressor frequencies or reduce power if proximal."}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-slate-950 border-t border-white/10 flex justify-between items-center">
                            <div className="text-[10px] text-slate-600 uppercase font-black tracking-widest">
                                Report Generated: {new Date().toLocaleTimeString()}
                            </div>
                            <button onClick={() => setHasAnalyzed(false)} className={`${primaryButton} !px-8 !py-3`}>Close Ledger</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FestivalCoordinationTab;
