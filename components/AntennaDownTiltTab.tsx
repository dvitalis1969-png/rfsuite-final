
import React, { useState, useMemo } from 'react';
import Card, { CardTitle } from './Card';

const inputLabelClass = "text-sm text-slate-400 mb-1 block";
const inputClass = "w-full bg-slate-900/60 border border-indigo-500/30 rounded-md p-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400";
const unitSelectClass = "bg-slate-700 text-slate-200 border-l border-indigo-500/30 rounded-r-md p-2 text-sm focus:outline-none";

const AntennaDownTiltTab: React.FC = () => {
    const [antennaHeight, setAntennaHeight] = useState('10');
    const [distance, setDistance] = useState('100');
    const [tiltAngle, setTiltAngle] = useState('5.7');
    const [unit, setUnit] = useState<'m' | 'ft'>('m');
    const [calculate, setCalculate] = useState<'distance' | 'angle'>('distance');

    const result = useMemo(() => {
        const h = parseFloat(antennaHeight);
        const d = parseFloat(distance);
        const a = parseFloat(tiltAngle);

        if (calculate === 'distance') {
            if (!isNaN(h) && !isNaN(a)) {
                return (h / Math.tan(a * Math.PI / 180)).toFixed(2);
            }
        }
        if (calculate === 'angle') {
            if (!isNaN(h) && !isNaN(d) && d > 0) {
                return (Math.atan(h / d) * 180 / Math.PI).toFixed(2);
            }
        }
        return '...';
    }, [antennaHeight, distance, tiltAngle, unit, calculate]);

    return (
        <Card fullWidth>
            <CardTitle>📐 Antenna Down-tilt Calculator</CardTitle>
            <p className="text-slate-300 mb-6 text-sm">
                Calculate the required down-tilt angle for a desired coverage distance, or vice-versa.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-6">
                    <div>
                        <label className={inputLabelClass}>Units</label>
                        <select value={unit} onChange={e => setUnit(e.target.value as any)} className={`${inputClass} max-w-xs`}>
                            <option value="m">Meters</option>
                            <option value="ft">Feet</option>
                        </select>
                    </div>
                    <div>
                        <label className={inputLabelClass}>Calculation Mode</label>
                        <select value={calculate} onChange={e => setCalculate(e.target.value as any)} className={`${inputClass} max-w-xs`}>
                            <option value="distance">Calculate Coverage Distance</option>
                            <option value="angle">Calculate Tilt Angle</option>
                        </select>
                    </div>
                    <div>
                        <label className={inputLabelClass}>Antenna Height ({unit})</label>
                        <input type="number" value={antennaHeight} onChange={e => setAntennaHeight(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                        <label className={inputLabelClass}>Tilt Angle (degrees)</label>
                        <input type="number" value={tiltAngle} onChange={e => setTiltAngle(e.target.value)} className={inputClass} disabled={calculate === 'angle'} />
                    </div>
                    <div>
                        <label className={inputLabelClass}>Coverage Distance ({unit})</label>
                        <input type="number" value={distance} onChange={e => setDistance(e.target.value)} className={inputClass} disabled={calculate === 'distance'} />
                    </div>

                    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 text-center">
                        <p className="text-sm text-slate-400 uppercase tracking-wider">
                            {calculate === 'distance' ? 'Calculated Distance' : 'Calculated Angle'}
                        </p>
                        <p className="text-4xl font-bold font-mono text-cyan-300 my-2 tracking-tighter">
                            {result}
                        </p>
                        <p className="text-xl text-slate-300">
                            {calculate === 'distance' ? unit : 'degrees'}
                        </p>
                    </div>
                </div>

                {/* SVG Visualization */}
                <div className="w-full h-96 bg-slate-900/50 rounded-lg p-4 flex items-center justify-center">
                    <svg viewBox="0 0 150 100" className="w-full h-full">
                        {/* Tower */}
                        <rect x="20" y="20" width="5" height="70" fill="#475569" />
                        <text x="15" y="15" fontSize="5" fill="#94a3b8">H</text>
                        {/* Ground */}
                        <line x1="0" y1="90" x2="150" y2="90" stroke="#64748b" strokeWidth="1" />
                        {/* Antenna */}
                        <path d="M 22.5 20 l 5 -3 v 6 l -5 -3" fill="#38bdf8" />
                        {/* Tilt line */}
                        <line x1="22.5" y1="20" x2="130" y2="90" stroke="#38bdf8" strokeWidth="0.5" strokeDasharray="2 2" />
                        <text x="135" y="90" fontSize="5" fill="#94a3b8">D</text>
                        {/* Horizontal line from antenna */}
                        <line x1="22.5" y1="20" x2="60" y2="20" stroke="#f59e0b" strokeWidth="0.5" strokeDasharray="1 1" />
                        {/* Arc for angle */}
                        <path d="M 42.5 20 A 20 20 0 0 1 37.1 29.5" fill="none" stroke="#f59e0b" strokeWidth="1" />
                        <text x="45" y="28" fontSize="5" fill="#f59e0b">{parseFloat(tiltAngle) || 0}°</text>
                    </svg>
                </div>
            </div>
        </Card>
    );
};

export default AntennaDownTiltTab;
