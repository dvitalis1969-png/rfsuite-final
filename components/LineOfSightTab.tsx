
import React, { useState, useMemo } from 'react';
import Card, { CardTitle } from './Card';

const inputLabelClass = "text-sm text-slate-400 mb-1 block";
const inputClass = "w-full bg-slate-900/60 border border-indigo-500/30 rounded-md p-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400";
const unitSelectClass = "bg-slate-700 text-slate-200 border-l border-indigo-500/30 rounded-r-md p-2 text-sm focus:outline-none";

const LineOfSightTab: React.FC = () => {
    const [h1, setH1] = useState('10');
    const [h2, setH2] = useState('10');
    const [distance, setDistance] = useState('20');
    const [unit, setUnit] = useState<'metric' | 'imperial'>('metric');

    const result = useMemo(() => {
        const height1 = parseFloat(h1);
        const height2 = parseFloat(h2);
        const dist = parseFloat(distance);

        if (isNaN(height1) || isNaN(height2) || isNaN(dist)) {
            return { maxDistance: 0, isClear: false, clearance: 0 };
        }

        if (unit === 'metric') {
            // h in meters, d in km. Formula: d = 4.12 * (sqrt(h1) + sqrt(h2))
            const maxDistance = 4.12 * (Math.sqrt(height1) + Math.sqrt(height2));
            const isClear = dist <= maxDistance;
            const clearance = maxDistance - dist;
            return { maxDistance, isClear, clearance };
        } else {
            // h in feet, d in miles. Formula: d = 1.41 * (sqrt(h1) + sqrt(h2))
            const maxDistance = 1.41 * (Math.sqrt(height1) + Math.sqrt(height2));
            const isClear = dist <= maxDistance;
            const clearance = maxDistance - dist;
            return { maxDistance, isClear, clearance };
        }
    }, [h1, h2, distance, unit]);

    const units = unit === 'metric' ? { height: 'm', dist: 'km' } : { height: 'ft', dist: 'miles' };

    return (
        <Card fullWidth>
            <CardTitle>🌍 Line of Sight Calculator</CardTitle>
            <p className="text-slate-300 mb-6 text-sm">
                Determine if a clear line of sight (LOS) exists between two antennas, taking the curvature of the Earth into account (using the 4/3 Earth radius model for standard atmospheric refraction).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-6">
                    <div>
                        <label className={inputLabelClass}>Units</label>
                        <select value={unit} onChange={e => setUnit(e.target.value as any)} className={`${inputClass} max-w-xs`}>
                            <option value="metric">Metric (meters, km)</option>
                            <option value="imperial">Imperial (feet, miles)</option>
                        </select>
                    </div>
                    <div>
                        <label className={inputLabelClass}>Antenna 1 Height ({units.height})</label>
                        <input type="number" value={h1} onChange={e => setH1(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                        <label className={inputLabelClass}>Antenna 2 Height ({units.height})</label>
                        <input type="number" value={h2} onChange={e => setH2(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                        <label className={inputLabelClass}>Distance Between Antennas ({units.dist})</label>
                        <input type="number" value={distance} onChange={e => setDistance(e.target.value)} className={inputClass} />
                    </div>
                </div>

                <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-700 h-full flex flex-col justify-center text-center">
                    <p className={`text-3xl font-bold mb-2 ${result.isClear ? 'text-emerald-400' : 'text-red-400'}`}>
                        {result.isClear ? '✓ Line of Sight is Clear' : '✗ Line of Sight is Obstructed'}
                    </p>
                    <p className="text-slate-300">
                        Max LOS distance for these heights is <span className="font-bold text-white">{result.maxDistance.toFixed(2)} {units.dist}</span>.
                    </p>
                    <p className="text-slate-400 text-sm mt-1">
                        Clearance: <span className={`font-semibold ${result.clearance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{result.clearance.toFixed(2)} {units.dist}</span>
                    </p>

                    <svg viewBox="0 0 200 100" className="w-full mt-4">
                        <path d="M 0 100 Q 100 80 200 100" fill="rgba(30, 41, 59, 0.5)" stroke="#334155" />
                        <line x1="20" y1={98 - parseFloat(h1)/5} x2="20" y2="98" stroke="#94a3b8" strokeWidth="1" />
                        <line x1="180" y1={98 - parseFloat(h2)/5} x2="180" y2="98" stroke="#94a3b8" strokeWidth="1" />
                        <line x1="20" y1={98 - parseFloat(h1)/5} x2="180" y2={98 - parseFloat(h2)/5} stroke={result.isClear ? "#34d399" : "#f87171"} strokeWidth="1" strokeDasharray="2 2" />
                        <text x="20" y={90 - parseFloat(h1)/5} fontSize="5" fill="#e2e8f0" textAnchor="middle">{h1}{units.height}</text>
                        <text x="180" y={90 - parseFloat(h2)/5} fontSize="5" fill="#e2e8f0" textAnchor="middle">{h2}{units.height}</text>
                    </svg>
                </div>
            </div>
        </Card>
    );
};

export default LineOfSightTab;
