
import React, { useState, useMemo } from 'react';
import Card, { CardTitle } from './Card';

const inputLabelClass = "text-sm text-slate-400 mb-1 block";
const inputClass = "w-full bg-slate-900/60 border border-indigo-500/30 rounded-md p-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono text-lg";

const DiversityPlacementTab: React.FC = () => {
    const [frequency, setFrequency] = useState('550');
    
    const wavelength = useMemo(() => {
        const freq = parseFloat(frequency);
        if (isNaN(freq) || freq <= 0) return 0;
        // c = 299.792458 mm/us (approx 300)
        return 299.792458 / freq; // Returns wavelength in meters
    }, [frequency]);

    const results = useMemo(() => {
        if (wavelength === 0) return null;
        return {
            quarter: wavelength / 4,
            half: wavelength / 2,
            full: wavelength,
            double: wavelength * 2,
            performance: wavelength * 8 // Standard recommendation for wide-area diversity
        };
    }, [wavelength]);

    return (
        <Card fullWidth>
            <CardTitle>📡 Diversity Antenna Spacing</CardTitle>
            <p className="text-slate-300 mb-6 text-sm">
                Calculate the optimal distance between diversity antennas to maximize signal decorrelation and avoid deep fades. Spacing is relative to the wavelength (&lambda;) of your operating frequency.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div>
                        <label className={inputLabelClass}>Frequency (MHz)</label>
                        <input 
                            type="number" 
                            step="0.001" 
                            value={frequency} 
                            onChange={e => setFrequency(e.target.value)} 
                            className={inputClass} 
                        />
                        <input 
                            type="range" 
                            min="400" 
                            max="1000" 
                            step="1" 
                            value={frequency} 
                            onChange={e => setFrequency(e.target.value)} 
                            className="w-full mt-4 accent-cyan-400" 
                        />
                    </div>

                    <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Wavelength (&lambda;)</span>
                            <span className="text-cyan-400 font-mono text-xl">{(wavelength * 100).toFixed(1)} cm</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500 text-xs">Total distance for one cycle at this frequency.</span>
                            <span className="text-slate-400 font-mono text-sm">{(wavelength * 39.3701).toFixed(1)} inches</span>
                        </div>
                    </div>

                    <div className="bg-indigo-900/20 border border-indigo-500/30 p-4 rounded-lg space-y-3">
                         <h4 className="text-indigo-300 font-bold text-sm uppercase flex items-center gap-2">
                            <span>💡</span> Engineering Best Practices
                         </h4>
                         <ul className="text-xs text-indigo-200/80 space-y-2 list-disc ml-4">
                            <li><strong>Minimum Spacing:</strong> Antennas should be at least 1/2 wavelength apart to provide basic diversity gain.</li>
                            <li><strong>Optimal Spacing:</strong> 1 full wavelength (&lambda;) is considered the standard for general purpose use.</li>
                            <li><strong>Wide Diversity:</strong> For large stages, spacing up to 8 wavelengths or several meters can improve coverage in complex multipath environments.</li>
                            <li><strong>Phase Nulls:</strong> Avoid spacing antennas at exact multiples of the wavelength if they are on the same cable run and mixed (uncommon in modern digital diversity receivers).</li>
                         </ul>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-white font-semibold mb-2">Recommended Spacings</h3>
                    {results && (
                        <div className="grid grid-cols-1 gap-3">
                             <SpacingRow label="1/4 Wavelength" value={results.quarter} lambda="1/4 &lambda;" color="text-slate-400" />
                             <SpacingRow label="Minimum (1/2 Wavelength)" value={results.half} lambda="1/2 &lambda;" color="text-amber-400" />
                             <SpacingRow label="Standard (1 Wavelength)" value={results.full} lambda="1 &lambda;" color="text-emerald-400" isHighlighted />
                             <SpacingRow label="Extended (2 Wavelengths)" value={results.double} lambda="2 &lambda;" color="text-blue-400" />
                             <SpacingRow label="High Performance (8 Wavelengths)" value={results.performance} lambda="8 &lambda;" color="text-purple-400" />
                        </div>
                    )}
                    
                    {/* Visualizer */}
                    <div className="mt-8 pt-4 border-t border-slate-700">
                        <div className="relative h-20 bg-slate-900/80 rounded-lg border border-slate-700 flex items-center px-8 overflow-hidden">
                            <div className="absolute left-8 flex flex-col items-center">
                                <div className="w-1 h-8 bg-cyan-500 rounded-full"></div>
                                <span className="text-[10px] text-cyan-500 mt-1 font-bold">ANT A</span>
                            </div>
                            <div className="flex-1 border-b border-dashed border-slate-600 mx-4 flex items-center justify-center">
                                <span className="bg-slate-900 px-2 text-[10px] text-slate-500 font-mono">Distance Based on &lambda;</span>
                            </div>
                            <div className="absolute right-8 flex flex-col items-center">
                                <div className="w-1 h-8 bg-rose-500 rounded-full"></div>
                                <span className="text-[10px] text-rose-500 mt-1 font-bold">ANT B</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
};

const SpacingRow: React.FC<{ label: string, value: number, lambda: string, color: string, isHighlighted?: boolean }> = ({ label, value, lambda, color, isHighlighted }) => (
    <div className={`p-3 rounded-lg border transition-all ${isHighlighted ? 'bg-indigo-500/10 border-indigo-500/50' : 'bg-slate-800/40 border-slate-700'}`}>
        <div className="flex justify-between items-center">
            <div>
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">{label}</p>
                <p className={`text-xl font-mono font-bold ${color}`}>{value < 1 ? (value * 100).toFixed(1) + ' cm' : value.toFixed(2) + ' m'}</p>
            </div>
            <div className="text-right">
                <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-full font-mono">{lambda}</span>
                <p className="text-xs text-slate-400 mt-1 font-mono">{(value * 39.3701).toFixed(1)}"</p>
            </div>
        </div>
    </div>
);

export default DiversityPlacementTab;
