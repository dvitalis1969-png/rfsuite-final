
import React, { useState, useMemo } from 'react';
import Card, { CardTitle } from './Card';

const inputLabelClass = "text-sm text-slate-400 mb-1 block";
const inputClass = "w-full bg-slate-900/60 border border-indigo-500/30 rounded-md p-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400";
const unitSelectClass = "bg-slate-700 text-slate-200 border-l border-indigo-500/30 rounded-r-md p-2 text-sm focus:outline-none";

const FSPLTab: React.FC = () => {
  const [frequency, setFrequency] = useState('550');
  const [distance, setDistance] = useState('100');
  const [distanceUnit, setDistanceUnit] = useState<'m' | 'km' | 'ft' | 'miles'>('m');

  const fspl = useMemo(() => {
    const numFrequency = parseFloat(frequency) || 0;
    const numDistance = parseFloat(distance) || 0;

    let distanceInMeters: number;
    switch (distanceUnit) {
      case 'km': distanceInMeters = numDistance * 1000; break;
      case 'ft': distanceInMeters = numDistance * 0.3048; break;
      case 'miles': distanceInMeters = numDistance * 1609.34; break;
      default: distanceInMeters = numDistance;
    }
    
    // FSPL (dB) = 20log10(d) + 20log10(f) + 20log10(4π/c)
    // Simplified for d in meters and f in MHz: FSPL = 20log10(d) + 20log10(f) - 27.55
    if (distanceInMeters > 0 && numFrequency > 0) {
      return 20 * Math.log10(distanceInMeters) + 20 * Math.log10(numFrequency) - 27.55;
    }
    return 0;
  }, [frequency, distance, distanceUnit]);

  return (
    <Card fullWidth>
      <CardTitle>📉 Free Space Path Loss (FSPL) Calculator</CardTitle>
      <p className="text-slate-300 mb-6 text-sm">
        Calculate the signal loss between two antennas in an ideal, unobstructed environment.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <label className={inputLabelClass}>Frequency (MHz)</label>
            <input type="number" value={frequency} onChange={e => setFrequency(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={inputLabelClass}>Distance</label>
            <div className="flex">
              <input type="number" value={distance} onChange={e => setDistance(e.target.value)} className={`${inputClass} rounded-r-none`} />
              <select value={distanceUnit} onChange={e => setDistanceUnit(e.target.value as any)} className={unitSelectClass}>
                <option value="m">Meters</option>
                <option value="km">Kilometers</option>
                <option value="ft">Feet</option>
                <option value="miles">Miles</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center bg-slate-900/50 p-6 rounded-lg border border-slate-700">
          <div className="text-center">
            <p className="text-sm text-slate-400 uppercase tracking-wider">Calculated Path Loss</p>
            <p className="text-6xl font-bold font-mono text-cyan-300 my-2 tracking-tighter">
              {fspl.toFixed(2)}
            </p>
            <p className="text-2xl text-slate-300">dB</p>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default FSPLTab;
