
import React, { useState, useMemo } from 'react';
import Card, { CardTitle } from './Card';

// UI components
const inputLabelClass = "text-sm text-slate-400 mb-1 block";
const inputClass = "w-full bg-slate-900/60 border border-indigo-500/30 rounded-md p-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400";
const unitSelectClass = "bg-slate-700 text-slate-200 border-l border-indigo-500/30 rounded-r-md p-2 text-sm focus:outline-none";

const LinkBudgetTab: React.FC = () => {
  // State for all inputs
  const [txPower, setTxPower] = useState('10');
  const [txPowerUnit, setTxPowerUnit] = useState<'mW' | 'dBm'>('mW');
  const [txCableLoss, setTxCableLoss] = useState('2');
  const [txAntennaGain, setTxAntennaGain] = useState('2.14');
  
  const [frequency, setFrequency] = useState('550');
  const [distance, setDistance] = useState('100');
  const [distanceUnit, setDistanceUnit] = useState<'m' | 'ft'>('m');

  const [rxAntennaGain, setRxAntennaGain] = useState('2.14');
  const [rxCableLoss, setRxCableLoss] = useState('2');
  const [receiverSensitivity, setReceiverSensitivity] = useState('-95');

  const results = useMemo(() => {
    const numTxPower = parseFloat(txPower) || 0;
    const numTxCableLoss = parseFloat(txCableLoss) || 0;
    const numTxAntennaGain = parseFloat(txAntennaGain) || 0;
    const numFrequency = parseFloat(frequency) || 0;
    const numDistance = parseFloat(distance) || 0;
    const numRxAntennaGain = parseFloat(rxAntennaGain) || 0;
    const numRxCableLoss = parseFloat(rxCableLoss) || 0;
    const numReceiverSensitivity = parseFloat(receiverSensitivity) || 0;

    // Calculations
    const txPowerDbm = txPowerUnit === 'mW' ? 10 * Math.log10(numTxPower) : numTxPower;
    const eirp = txPowerDbm - numTxCableLoss + numTxAntennaGain;
    
    const distanceInMeters = distanceUnit === 'ft' ? numDistance * 0.3048 : numDistance;
    // FSPL formula: 20 * log10(d) + 20 * log10(f) - 27.55 (d in meters, f in MHz)
    const fspl = (distanceInMeters > 0 && numFrequency > 0) 
      ? 20 * Math.log10(distanceInMeters) + 20 * Math.log10(numFrequency) - 27.55 
      : 0;

    const rssi = eirp - fspl + numRxAntennaGain - numRxCableLoss;
    const linkMargin = rssi - numReceiverSensitivity;

    return { txPowerDbm, eirp, fspl, rssi, linkMargin };
  }, [txPower, txPowerUnit, txCableLoss, txAntennaGain, frequency, distance, distanceUnit, rxAntennaGain, rxCableLoss, receiverSensitivity]);

  const getMarginColor = (margin: number) => {
    if (margin < 6) return 'text-red-400';
    if (margin < 12) return 'text-amber-400';
    return 'text-emerald-400';
  };

  return (
    <Card fullWidth>
      <CardTitle>🔧 RF Link Budget Calculator</CardTitle>
      <p className="text-slate-300 mb-6 text-sm">
        Estimate the received signal strength and operating margin of a wireless link.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-6">
          {/* Transmitter */}
          <section>
            <h3 className="font-semibold text-lg text-indigo-300 mb-3 border-b-2 border-indigo-500/20 pb-2">Transmitter</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={inputLabelClass}>Tx Power</label>
                <div className="flex">
                  <input type="number" value={txPower} onChange={e => setTxPower(e.target.value)} className={`${inputClass} rounded-r-none`} />
                  <select value={txPowerUnit} onChange={e => setTxPowerUnit(e.target.value as any)} className={unitSelectClass}>
                    <option>mW</option>
                    <option>dBm</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={inputLabelClass}>Tx Cable Loss (dB)</label>
                <input type="number" value={txCableLoss} onChange={e => setTxCableLoss(e.target.value)} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className={inputLabelClass}>Tx Antenna Gain (dBi)</label>
                <input type="number" value={txAntennaGain} onChange={e => setTxAntennaGain(e.target.value)} className={inputClass} />
              </div>
            </div>
          </section>

          {/* Path */}
          <section>
            <h3 className="font-semibold text-lg text-cyan-300 mb-3 border-b-2 border-cyan-500/20 pb-2">Path</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={inputLabelClass}>Frequency (MHz)</label>
                <input type="number" value={frequency} onChange={e => setFrequency(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={inputLabelClass}>Distance</label>
                 <div className="flex">
                  <input type="number" value={distance} onChange={e => setDistance(e.target.value)} className={`${inputClass} rounded-r-none`} />
                  <select value={distanceUnit} onChange={e => setDistanceUnit(e.target.value as any)} className={unitSelectClass}>
                    <option>m</option>
                    <option>ft</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* Receiver */}
          <section>
            <h3 className="font-semibold text-lg text-rose-300 mb-3 border-b-2 border-rose-500/20 pb-2">Receiver</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={inputLabelClass}>Rx Antenna Gain (dBi)</label>
                <input type="number" value={rxAntennaGain} onChange={e => setRxAntennaGain(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={inputLabelClass}>Rx Cable Loss (dB)</label>
                <input type="number" value={rxCableLoss} onChange={e => setRxCableLoss(e.target.value)} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className={inputLabelClass}>Receiver Sensitivity (dBm)</label>
                <input type="number" value={receiverSensitivity} onChange={e => setReceiverSensitivity(e.target.value)} className={inputClass} />
              </div>
            </div>
          </section>
        </div>

        {/* Results Section */}
        <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-700 h-fit sticky top-4">
          <h3 className="font-bold text-xl text-white mb-6 text-center">📊 Link Budget Results</h3>
          <div className="space-y-5">
            <ResultDisplay label="EIRP" value={`${results.eirp.toFixed(2)} dBm`} description="Effective Isotropic Radiated Power" />
            <ResultDisplay label="Path Loss (FSPL)" value={`${results.fspl.toFixed(2)} dB`} description="Free Space Path Loss" />
            <ResultDisplay label="Received Power (RSSI)" value={`${results.rssi.toFixed(2)} dBm`} description="Received Signal Strength Indicator" />
            <div className="border-t-2 border-indigo-500/30 my-4"></div>
            <div className="text-center">
              <p className="text-sm text-slate-400 uppercase tracking-wider">System Operating Margin</p>
              <p className={`text-5xl font-bold font-mono tracking-tighter my-2 ${getMarginColor(results.linkMargin)}`}>
                {results.linkMargin.toFixed(2)} dB
              </p>
              <p className={`text-sm font-semibold ${getMarginColor(results.linkMargin)}`}>
                {results.linkMargin < 6 && "Link Unreliable / Prone to Dropouts"}
                {results.linkMargin >= 6 && results.linkMargin < 12 && "Link is Marginal / Use with caution"}
                {results.linkMargin >= 12 && "Link is Robust"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

const ResultDisplay: React.FC<{ label: string; value: string; description: string }> = ({ label, value, description }) => (
    <div>
        <div className="flex justify-between items-baseline">
            <p className="text-lg text-slate-300">{label}</p>
            <p className="text-2xl font-mono text-cyan-300">{value}</p>
        </div>
        <p className="text-xs text-slate-500 -mt-1">{description}</p>
    </div>
);

export default LinkBudgetTab;
