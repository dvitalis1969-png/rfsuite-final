import React, { useState, useMemo } from 'react';
import Card, { CardTitle } from './Card';
import { Zone, ZoneConfig, Frequency, FestivalAct, ConstantSystemRequest } from '../types';

interface MultiStageTabProps {
    isLinked: boolean;
    numZones: number;
    zoneConfigs: ZoneConfig[];
    distances: number[][];
    setDistances: (distances: number[][]) => void;
    results: { zones: Zone[], spares: { mics: Frequency[], iems: Frequency[] } } | null;
    siteMapActive: boolean;
    festivalActs: FestivalAct[];
    constantSystems: ConstantSystemRequest[];
    houseSystems: ConstantSystemRequest[];
}

const buttonBase = "px-6 py-2.5 rounded-lg font-semibold uppercase tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transform active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed";
const primaryButton = `bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-b-4 border-indigo-800 hover:border-indigo-700 hover:brightness-110 ${buttonBase}`;

const MultiStageTab: React.FC<MultiStageTabProps> = ({ isLinked, numZones, zoneConfigs, distances, setDistances, results, siteMapActive, festivalActs, constantSystems, houseSystems }) => {
    const [showTable, setShowTable] = useState(false);
    const [globalDistInput, setGlobalDistInput] = useState<string>("150");

    const handleDistanceChange = (row: number, col: number, value: string) => {
        const newDistances = [...distances.map(r => [...r])];
        const numValue = parseInt(value, 10) || 0;
        newDistances[row][col] = numValue;
        if (row !== col) { // Ensure diagonal remains 0
            newDistances[col][row] = numValue; // Maintain symmetry
        }
        setDistances(newDistances);
    };

    const handleApplyGlobalDistance = () => {
        const val = parseInt(globalDistInput, 10);
        if (isNaN(val)) return;
        const next = distances.map((row, rIdx) => 
            row.map((col, cIdx) => (rIdx === cIdx ? 0 : val))
        );
        setDistances(next);
    };

    const tabulatedData = useMemo(() => {
        const freqMap = new Map<number, { freq: Frequency, sources: string[] }>();

        const addFreqToMap = (freq: Frequency, sourceString: string) => {
            if (freq.value > 0) {
                if (!freqMap.has(freq.value)) {
                    freqMap.set(freq.value, { freq, sources: [sourceString] });
                } else {
                    const existingEntry = freqMap.get(freq.value)!;
                    if (!existingEntry.sources.includes(sourceString)) {
                        existingEntry.sources.push(sourceString);
                    }
                }
            }
        };

        // Process Acts
        (festivalActs || []).forEach(act => {
            (act.frequencies || []).forEach(freq => {
                const sourceString = `${act.actName} (${act.stage})`;
                addFreqToMap(freq, sourceString);
            });
        });

        // Process Constant Systems
        (constantSystems || []).forEach(sys => {
            (sys.frequencies || []).forEach(freq => {
                const sourceString = `Constant (${sys.stageName})`;
                addFreqToMap(freq, sourceString);
            });
        });

        // Process House Systems
        (houseSystems || []).forEach(sys => {
            (sys.frequencies || []).forEach(freq => {
                const sourceString = `House (${sys.stageName})`;
                addFreqToMap(freq, sourceString);
            });
        });
        
        return Array.from(freqMap.values())
            .sort((a, b) => a.freq.value - b.freq.value);

    }, [festivalActs, constantSystems, houseSystems]);
    
    const hasDataToTabulate = useMemo(() => {
        const hasActs = (festivalActs || []).some(act => act.frequencies && act.frequencies.length > 0);
        const hasConst = (constantSystems || []).some(sys => sys.frequencies && sys.frequencies.length > 0);
        const hasHouse = (houseSystems || []).some(sys => sys.frequencies && sys.frequencies.length > 0);
        return hasActs || hasConst || hasHouse;
    }, [festivalActs, constantSystems, houseSystems]);

    return (
        <Card fullWidth>
            <CardTitle>🌍 Inter-Zone Distance Matrix</CardTitle>
            <p className="text-slate-300 mb-4 text-sm">
                Complete the grid by entering the distance between each zone in meters. This data can be used by the Multizone calculator if linked.
            </p>

            <div className="flex flex-col md:flex-row gap-4 p-4 bg-slate-900/50 rounded-lg mb-4">
                <div className="flex-1">
                    <label htmlFor="num-zones" className="text-slate-300 text-xs mb-1 block uppercase font-black">Number of Zones</label>
                    <input
                        id="num-zones"
                        type="number"
                        value={numZones}
                        readOnly
                        disabled
                        className="w-full bg-slate-800/80 border border-indigo-500/30 rounded-md p-2 text-slate-400 cursor-not-allowed font-bold"
                    />
                    {isLinked && <p className="text-[10px] text-cyan-400 mt-1 uppercase font-black tracking-tighter">Controlled by Multizone tab.</p>}
                </div>
                {!siteMapActive && (
                    <div className="flex-1 bg-slate-950 border border-indigo-500/30 rounded-lg p-2 flex flex-col justify-center">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-2 mb-1">Global Separation (m):</label>
                        <div className="flex gap-2 items-center">
                            <input 
                                type="number" 
                                value={globalDistInput} 
                                onChange={e => setGlobalDistInput(e.target.value)}
                                className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs font-mono text-cyan-400 outline-none" 
                            />
                            <button 
                                onClick={handleApplyGlobalDistance}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase px-4 py-2 rounded transition-colors shadow-lg"
                            >
                                Apply All
                            </button>
                        </div>
                    </div>
                )}
            </div>
            
            {siteMapActive && (
                <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 mb-4 text-center">
                    <p className="font-semibold text-cyan-300">Distances are being automatically calculated from the Site Map tab.</p>
                </div>
            )}
            
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-center">
                    <thead>
                        <tr>
                            <th className="p-2 border border-slate-700 bg-slate-800"></th>
                            {zoneConfigs.map((config, index) => (
                                <th key={index} className="p-2 border border-slate-700 bg-slate-800 text-slate-300 font-semibold whitespace-nowrap">
                                    {config.name || `Zone ${index + 1}`}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {distances.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                                <th className="p-2 border border-slate-700 bg-slate-800 text-slate-300 font-semibold whitespace-nowrap">
                                    {zoneConfigs[rowIndex]?.name || `Zone ${rowIndex + 1}`}
                                </th>
                                {row.map((distance, colIndex) => (
                                    <td key={colIndex} className="p-1 border border-slate-700">
                                        <input
                                            type="number"
                                            value={distance}
                                            onChange={e => handleDistanceChange(rowIndex, colIndex, e.target.value)}
                                            disabled={rowIndex === colIndex || siteMapActive}
                                            min="0"
                                            className={`w-full h-full text-center bg-transparent text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded-sm ${
                                                rowIndex === colIndex ? 'bg-slate-800/50 cursor-not-allowed' : 'bg-slate-900/60'
                                            } ${siteMapActive ? 'cursor-not-allowed opacity-70' : ''}`}
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-between items-center mt-6">
                <button 
                    onClick={() => setShowTable(s => !s)} 
                    disabled={!hasDataToTabulate}
                    className={primaryButton}
                >
                    {showTable ? 'Hide Table' : '📊 Tabulate Data'}
                </button>
                <p className="text-sm text-slate-400 text-right">
                    Tabulation data is sourced from the Festival Planning tab.
                </p>
            </div>

            {showTable && hasDataToTabulate && (
                <div className="mt-6">
                    <CardTitle>Festival Frequency Allocation</CardTitle>
                    <div className="overflow-y-auto max-h-96 border border-slate-700 rounded-lg">
                        <table className="w-full text-left">
                            <thead className="sticky top-0">
                                <tr className="bg-slate-800">
                                    <th className="p-3 text-sm font-semibold text-slate-300 tracking-wider">Frequency (MHz)</th>
                                    <th className="p-3 text-sm font-semibold text-slate-300 tracking-wider">Assigned To</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {tabulatedData.map(({ freq, sources }) => (
                                    <tr key={freq.id || freq.value} className="bg-slate-900/50 hover:bg-slate-800/50">
                                        <td className="p-3 font-mono text-cyan-300">{freq.value.toFixed(3)}</td>
                                        <td className="p-3 text-slate-300">{sources.join(', ')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </Card>
    );
};

export default MultiStageTab;