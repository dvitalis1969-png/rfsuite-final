
import React, { useState, useEffect } from 'react';
import Card, { CardTitle } from './Card';

const inputLabelClass = "text-sm text-slate-400 mb-1 block";
const inputClass = "w-full bg-slate-900/60 border border-indigo-500/30 rounded-md p-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono text-lg";

const VSWRTab: React.FC = () => {
    const [vswr, setVswr] = useState('1.5');
    const [returnLoss, setReturnLoss] = useState('13.98');
    const [reflCoeff, setReflCoeff] = useState('0.200');
    const [lastChanged, setLastChanged] = useState<'vswr' | 'rl' | 'rc'>('vswr');

    useEffect(() => {
        if (lastChanged !== 'vswr') return;
        const numVswr = parseFloat(vswr);
        if (!isNaN(numVswr) && numVswr >= 1) {
            const rc = (numVswr - 1) / (numVswr + 1);
            const rl = -20 * Math.log10(rc);
            setReflCoeff(rc.toFixed(3));
            setReturnLoss(rl.toFixed(2));
        }
    }, [vswr, lastChanged]);

    useEffect(() => {
        if (lastChanged !== 'rl') return;
        const numRl = parseFloat(returnLoss);
        if (!isNaN(numRl) && numRl >= 0) {
            const rc = Math.pow(10, -numRl / 20);
            const vs = (1 + rc) / (1 - rc);
            setReflCoeff(rc.toFixed(3));
            setVswr(vs.toFixed(3));
        }
    }, [returnLoss, lastChanged]);

    useEffect(() => {
        if (lastChanged !== 'rc') return;
        const numRc = parseFloat(reflCoeff);
        if (!isNaN(numRc) && numRc >= 0 && numRc < 1) {
            const vs = (1 + numRc) / (1 - numRc);
            const rl = -20 * Math.log10(numRc);
            setVswr(vs.toFixed(3));
            setReturnLoss(rl.toFixed(2));
        }
    }, [reflCoeff, lastChanged]);

    return (
        <Card fullWidth>
            <CardTitle>🔄 VSWR &amp; Return Loss Calculator</CardTitle>
            <p className="text-slate-300 mb-6 text-sm">
                Convert between VSWR, Return Loss (dB), and Reflection Coefficient (Γ). Changing any value will update the others.
            </p>
            <div className="space-y-6 max-w-md mx-auto">
                <div>
                    <label className={inputLabelClass}>VSWR</label>
                    <input type="number" min="1" step="0.01" value={vswr} onChange={e => { setVswr(e.target.value); setLastChanged('vswr'); }} className={inputClass} />
                </div>
                <div>
                    <label className={inputLabelClass}>Return Loss (dB)</label>
                    <input type="number" min="0" step="0.01" value={returnLoss} onChange={e => { setReturnLoss(e.target.value); setLastChanged('rl'); }} className={inputClass} />
                </div>
                <div>
                    <label className={inputLabelClass}>Reflection Coefficient (Γ)</label>
                    <input type="number" min="0" max="1" step="0.001" value={reflCoeff} onChange={e => { setReflCoeff(e.target.value); setLastChanged('rc'); }} className={inputClass} />
                </div>
            </div>
        </Card>
    );
};

export default VSWRTab;
