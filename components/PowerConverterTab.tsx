
import React, { useState, useEffect } from 'react';
import Card, { CardTitle } from './Card';

const inputLabelClass = "text-sm text-slate-400 mb-1 block";
const inputClass = "w-full bg-slate-900/60 border border-indigo-500/30 rounded-md p-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono text-lg";

const PowerConverterTab: React.FC = () => {
    const [dbm, setDbm] = useState('0');
    const [dbw, setDbw] = useState('-30.00');
    const [watts, setWatts] = useState('1.000e-3');
    const [volts, setVolts] = useState('0.224');
    const [dbuv, setDbuv] = useState('107.00');
    const [lastChanged, setLastChanged] = useState<'dbm' | 'dbw' | 'watts' | 'volts' | 'dbuv'>('dbm');

    useEffect(() => {
        if (lastChanged === 'dbm') {
            const numDbm = parseFloat(dbm);
            if (!isNaN(numDbm)) {
                const newWatts = Math.pow(10, (numDbm - 30) / 10);
                const newVolts = Math.sqrt(newWatts * 50);
                const newDbw = numDbm - 30;
                const newDbuv = 20 * Math.log10(newVolts * 1e6);
                setWatts(newWatts.toExponential(3));
                setVolts(newVolts.toFixed(3));
                setDbw(newDbw.toFixed(2));
                setDbuv(isFinite(newDbuv) ? newDbuv.toFixed(2) : '');
            }
        }
    }, [dbm, lastChanged]);

    useEffect(() => {
        if (lastChanged === 'dbw') {
            const numDbw = parseFloat(dbw);
            if (!isNaN(numDbw)) {
                const newWatts = Math.pow(10, numDbw / 10);
                const newVolts = Math.sqrt(newWatts * 50);
                const newDbm = numDbw + 30;
                const newDbuv = 20 * Math.log10(newVolts * 1e6);
                setWatts(newWatts.toExponential(3));
                setVolts(newVolts.toFixed(3));
                setDbm(newDbm.toFixed(2));
                setDbuv(isFinite(newDbuv) ? newDbuv.toFixed(2) : '');
            }
        }
    }, [dbw, lastChanged]);

    useEffect(() => {
        if (lastChanged === 'watts') {
            const numWatts = parseFloat(watts);
            if (!isNaN(numWatts) && numWatts >= 0) {
                const newVolts = Math.sqrt(numWatts * 50);
                setVolts(newVolts.toFixed(3));
                if (numWatts > 0) {
                    const newDbm = 10 * Math.log10(numWatts) + 30;
                    const newDbw = 10 * Math.log10(numWatts);
                    const newDbuv = 20 * Math.log10(newVolts * 1e6);
                    setDbm(newDbm.toFixed(2));
                    setDbw(newDbw.toFixed(2));
                    setDbuv(isFinite(newDbuv) ? newDbuv.toFixed(2) : '');
                } else {
                    setDbm('');
                    setDbw('');
                    setDbuv('');
                }
            }
        }
    }, [watts, lastChanged]);

    useEffect(() => {
        if (lastChanged === 'volts') {
            const numVolts = parseFloat(volts);
            if (!isNaN(numVolts) && numVolts >= 0) {
                const newWatts = Math.pow(numVolts, 2) / 50;
                setWatts(newWatts.toExponential(3));
                if (newWatts > 0) {
                    const newDbm = 10 * Math.log10(newWatts) + 30;
                    const newDbw = 10 * Math.log10(newWatts);
                    const newDbuv = 20 * Math.log10(numVolts * 1e6);
                    setDbm(newDbm.toFixed(2));
                    setDbw(newDbw.toFixed(2));
                    setDbuv(isFinite(newDbuv) ? newDbuv.toFixed(2) : '');
                } else {
                    setDbm('');
                    setDbw('');
                    setDbuv('');
                }
            }
        }
    }, [volts, lastChanged]);

    useEffect(() => {
        if (lastChanged === 'dbuv') {
            const numDbuv = parseFloat(dbuv);
            if (!isNaN(numDbuv)) {
                const newVolts = Math.pow(10, numDbuv / 20) / 1e6;
                setVolts(newVolts.toFixed(3));
                if (newVolts > 0) {
                    const newWatts = Math.pow(newVolts, 2) / 50;
                    const newDbm = 10 * Math.log10(newWatts) + 30;
                    const newDbw = 10 * Math.log10(newWatts);
                    setWatts(newWatts.toExponential(3));
                    setDbm(newDbm.toFixed(2));
                    setDbw(newDbw.toFixed(2));
                } else {
                     setWatts('0.000e+0');
                     setDbm('');
                     setDbw('');
                }
            }
        }
    }, [dbuv, lastChanged]);

    return (
        <Card fullWidth>
            <CardTitle>⚡ Power Converter</CardTitle>
            <p className="text-slate-300 mb-6 text-sm">
                Convert between dBm, dBW, Watts, Volts (50Ω), and dBuV (50Ω). Changing any value will update the others.
            </p>
            <div className="space-y-6 max-w-md mx-auto">
                <div>
                    <label className={inputLabelClass}>Power (dBm)</label>
                    <input type="number" value={dbm} onChange={e => { setDbm(e.target.value); setLastChanged('dbm'); }} className={inputClass} />
                </div>
                 <div>
                    <label className={inputLabelClass}>Power (dBW)</label>
                    <input type="number" value={dbw} onChange={e => { setDbw(e.target.value); setLastChanged('dbw'); }} className={inputClass} />
                </div>
                <div>
                    <label className={inputLabelClass}>Power (Watts)</label>
                    <input type="text" value={watts} onChange={e => { setWatts(e.target.value); setLastChanged('watts'); }} className={inputClass} />
                </div>
                <div>
                    <label className={inputLabelClass}>Voltage (Volts @ 50Ω)</label>
                    <input type="number" value={volts} onChange={e => { setVolts(e.target.value); setLastChanged('volts'); }} className={inputClass} />
                </div>
                 <div>
                    <label className={inputLabelClass}>Voltage (dBuV @ 50Ω)</label>
                    <input type="number" value={dbuv} onChange={e => { setDbuv(e.target.value); setLastChanged('dbuv'); }} className={inputClass} />
                </div>
            </div>
        </Card>
    );
};

export default PowerConverterTab;
