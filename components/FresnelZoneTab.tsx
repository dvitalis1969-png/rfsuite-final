
import React, { useState, useMemo } from 'react';
import Card, { CardTitle } from './Card';

const inputLabelClass = "text-sm text-slate-400 mb-1 block";
const inputClass = "w-full bg-slate-900/60 border border-indigo-500/30 rounded-md p-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400";
const unitSelectClass = "bg-slate-700 text-slate-200 border-l border-indigo-500/30 rounded-r-md p-2 text-sm focus:outline-none";

const FresnelZoneTab: React.FC = () => {
    const [frequency, setFrequency] = useState('550');
    const [distance, setDistance] = useState('1');
    const [distanceUnit, setDistanceUnit] = useState<'km' | 'miles'>('km');

    const result = useMemo(() => {
        const numFrequency = parseFloat(frequency); // in MHz
        const numDistance = parseFloat(distance);

        if (isNaN(numFrequency) || isNaN(numDistance) || numFrequency <= 0 || numDistance <= 0) {
            return { radiusMeters: 0, radiusFeet: 0 };
        }

        const distanceKm = distanceUnit === 'miles' ? numDistance * 1.60934 : numDistance;
        const frequencyGhz = numFrequency / 1000;

        // Formula for 1st Fresnel Zone radius: r = 17.32 * sqrt(d / (4 * f)) where d is in km, f is in GHz
        const radiusMeters = 17.32 * Math.sqrt(distanceKm / (4 * frequencyGhz));
        const radiusFeet = radiusMeters * 3.28084;

        return { radiusMeters, radiusFeet };
    }, [frequency, distance, distanceUnit]);

    return (
        <Card fullWidth>
            <CardTitle>🌐 Fresnel Zone Calculator</CardTitle>
            <p className="text-slate-300 mb-6 text-sm">
                Calculate the radius of the first Fresnel Zone to ensure proper line-of-sight clearance for your RF link.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-6">
                    <div>
                        <label className={inputLabelClass}>Frequency (MHz)</label>
                        <input type="number" value={frequency} onChange={e => setFrequency(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                        <label className={inputLabelClass}>Link Distance</label>
                        <div className="flex">
                            <input type="number" value={distance} onChange={e => setDistance(e.target.value)} className={`${inputClass} rounded-r-none`} />
                            <select value={distanceUnit} onChange={e => setDistanceUnit(e.target.value as any)} className={unitSelectClass}>
                                <option value="km">Kilometers</option>
                                <option value="miles">Miles</option>
                            </select>
                        </div>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 text-center">
                        <p className="text-sm text-slate-400 uppercase tracking-wider">Fresnel Zone Radius (at midpoint)</p>
                        <p className="text-4xl font-bold font-mono text-cyan-300 my-2 tracking-tighter">
                            {result.radiusMeters.toFixed(2)} m
                        </p>
                        <p className="text-xl text-slate-300">
                            / {result.radiusFeet.toFixed(2)} ft
                        </p>
                    </div>
                </div>

                {/* SVG Visualization */}
                <div className="w-full h-64 bg-slate-900/50 rounded-lg p-4 flex items-center justify-center">
                    <svg viewBox="0 0 200 100" className="w-full h-full">
                        {/* Antennas */}
                        <path d="M 20 50 v -10 l 5 -5 l -10 0 l 5 5" fill="none" stroke="#94a3b8" strokeWidth="1" />
                        <path d="M 180 50 v -10 l 5 -5 l -10 0 l 5 5" fill="none" stroke="#94a3b8" strokeWidth="1" />
                        <text x="20" y="30" fontSize="5" fill="#94a3b8" textAnchor="middle">Tx</text>
                        <text x="180" y="30" fontSize="5" fill="#94a3b8" textAnchor="middle">Rx</text>
                        {/* Line of Sight */}
                        <line x1="20" y1="50" x2="180" y2="50" stroke="#38bdf8" strokeWidth="0.5" strokeDasharray="2 2" />
                        {/* Fresnel Zone Ellipse */}
                        <ellipse cx="100" cy="50" rx="80" ry="20" fill="rgba(22, 163, 74, 0.2)" stroke="#10b981" strokeWidth="0.5" />
                        {/* Radius Line and Text */}
                        <line x1="100" y1="30" x2="100" y2="50" stroke="#f59e0b" strokeWidth="1" />
                        <text x="105" y="40" fontSize="6" fill="#f59e0b" fontWeight="bold">
                            {result.radiusMeters.toFixed(1)}m
                        </text>
                        {/* Distance Line and Text */}
                        <line x1="20" y1="60" x2="180" y2="60" stroke="#94a3b8" strokeWidth="0.5" />
                        <line x1="20" y1="58" x2="20" y2="62" stroke="#94a3b8" strokeWidth="0.5" />
                        <line x1="180" y1="58" x2="180" y2="62" stroke="#94a3b8" strokeWidth="0.5" />
                        <text x="100" y="68" fontSize="5" fill="#94a3b8" textAnchor="middle">
                            {distance} {distanceUnit}
                        </text>
                    </svg>
                </div>
            </div>
        </Card>
    );
};

export default FresnelZoneTab;
