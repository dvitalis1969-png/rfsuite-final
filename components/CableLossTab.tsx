
import React, { useState, useMemo } from 'react';
import Card, { CardTitle } from './Card';
import { CABLE_LOSS_DATA } from '../constants';

const inputLabelClass = "text-sm text-slate-400 mb-1 block";
const inputClass = "w-full bg-slate-900/60 border border-indigo-500/30 rounded-md p-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400";
const unitSelectClass = "bg-slate-700 text-slate-200 border-l border-indigo-500/30 rounded-r-md p-2 text-sm focus:outline-none";

const CableLossTab: React.FC = () => {
    const [cableType, setCableType] = useState('LMR-400');
    const [length, setLength] = useState('50');
    const [lengthUnit, setLengthUnit] = useState<'ft' | 'm'>('ft');
    const [frequency, setFrequency] = useState('550');

    const totalLoss = useMemo(() => {
        const cableData = CABLE_LOSS_DATA[cableType]?.data;
        if (!cableData) return 0;

        const numLength = parseFloat(length);
        const numFreq = parseFloat(frequency);
        if (isNaN(numLength) || isNaN(numFreq) || numLength <= 0 || numFreq <= 0) return 0;

        const sortedFreqs = Object.keys(cableData).map(Number).sort((a, b) => a - b);
        let lossPer100ft: number;

        if (numFreq <= sortedFreqs[0]) {
            lossPer100ft = cableData[sortedFreqs[0]];
        } else if (numFreq >= sortedFreqs[sortedFreqs.length - 1]) {
            lossPer100ft = cableData[sortedFreqs[sortedFreqs.length - 1]];
        } else {
            // Linear interpolation
            let lowerFreq = sortedFreqs[0], upperFreq = sortedFreqs[1];
            for (let i = 0; i < sortedFreqs.length - 1; i++) {
                if (numFreq >= sortedFreqs[i] && numFreq <= sortedFreqs[i + 1]) {
                    lowerFreq = sortedFreqs[i];
                    upperFreq = sortedFreqs[i + 1];
                    break;
                }
            }
            const lowerLoss = cableData[lowerFreq];
            const upperLoss = cableData[upperFreq];
            const freqRatio = (numFreq - lowerFreq) / (upperFreq - lowerFreq);
            lossPer100ft = lowerLoss + freqRatio * (upperLoss - lowerLoss);
        }

        const lengthInFeet = lengthUnit === 'm' ? numLength * 3.28084 : numLength;
        return (lossPer100ft / 100) * lengthInFeet;

    }, [cableType, length, lengthUnit, frequency]);

    return (
        <Card fullWidth>
            <CardTitle>📉 Cable Loss Calculator</CardTitle>
            <p className="text-slate-300 mb-6 text-sm">
                Estimate the signal attenuation (loss) for a specific length of common coaxial cable at a given frequency. Loss data is based on manufacturer specifications per 100 ft.
            </p>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-6">
                    <div>
                        <label className={inputLabelClass}>Cable Type</label>
                        <select value={cableType} onChange={e => setCableType(e.target.value)} className={inputClass}>
                            {Object.entries(CABLE_LOSS_DATA).map(([key, value]) => (
                                <option key={key} value={key}>{value.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={inputLabelClass}>Cable Length</label>
                        <div className="flex">
                            <input type="number" value={length} onChange={e => setLength(e.target.value)} className={`${inputClass} rounded-r-none`} />
                            <select value={lengthUnit} onChange={e => setLengthUnit(e.target.value as any)} className={unitSelectClass}>
                                <option value="ft">Feet</option>
                                <option value="m">Meters</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className={inputLabelClass}>Frequency (MHz)</label>
                        <input type="number" value={frequency} onChange={e => setFrequency(e.target.value)} className={inputClass} />
                    </div>
                </div>
                <div className="flex items-center justify-center bg-slate-900/50 p-6 rounded-lg border border-slate-700 h-full">
                  <div className="text-center">
                    <p className="text-sm text-slate-400 uppercase tracking-wider">Total Calculated Loss</p>
                    <p className="text-6xl font-bold font-mono text-rose-400 my-2 tracking-tighter">
                      {totalLoss.toFixed(2)}
                    </p>
                    <p className="text-2xl text-slate-300">dB</p>
                  </div>
                </div>
            </div>
        </Card>
    );
};

export default CableLossTab;
