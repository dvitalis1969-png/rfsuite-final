
import React, { useState, useMemo } from 'react';
import { analyzeFrequencySet, ForensicsResult } from '../services/frequencyAnalysisService';
import { Activity, Shield, Zap, Search, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

const FrequencyForensicsTab: React.FC = () => {
    const [rawInput, setRawInput] = useState<string>('');
    const [frequencies, setFrequencies] = useState<number[]>([]);
    const [analysis, setAnalysis] = useState<ForensicsResult | null>(null);
    const [equipmentType, setEquipmentType] = useState<'analogue' | 'digital'>('analogue');

    const handleAnalyze = () => {
        // Parse frequencies from input (handle commas, spaces, newlines)
        const parsed = rawInput
            .split(/[\s,\n]+/)
            .map(s => parseFloat(s))
            .filter(n => !isNaN(n) && n > 0);
        
        // Preserve duplicates as requested by user
        const sorted = [...parsed].sort((a, b) => a - b);
        setFrequencies(sorted);
        
        if (sorted.length >= 2) {
            const result = analyzeFrequencySet(sorted, equipmentType);
            setAnalysis(result);
        } else {
            setAnalysis(null);
        }
    };

    const handleClear = () => {
        setRawInput('');
        setFrequencies([]);
        setAnalysis(null);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Section */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Search size={120} className="text-indigo-500" />
                </div>
                
                <div className="relative z-10 max-w-2xl">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-indigo-500/20 rounded-lg">
                            <Search className="text-indigo-400" size={24} />
                        </div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Frequency Forensics</h2>
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed">
                        Reverse engineer any frequency set to uncover the original coordination parameters. 
                        Paste your list below to detect channel spacing, IMD safety margins, and original equipment profiles.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Input Section */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Paste Frequencies (MHz)
                            </label>
                            
                            {/* Equipment Toggle */}
                            <div className="flex bg-slate-950 rounded-lg p-1 border border-white/5">
                                <button
                                    onClick={() => setEquipmentType('analogue')}
                                    className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${
                                        equipmentType === 'analogue' 
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                                            : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                >
                                    Analogue
                                </button>
                                <button
                                    onClick={() => setEquipmentType('digital')}
                                    className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${
                                        equipmentType === 'digital' 
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                                            : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                >
                                    Digital
                                </button>
                            </div>
                        </div>

                        <textarea
                            value={rawInput}
                            onChange={(e) => setRawInput(e.target.value)}
                            placeholder="e.g. 470.200, 470.850, 471.600..."
                            className="w-full h-64 bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm font-mono text-indigo-300 focus:border-indigo-500/50 outline-none transition-all resize-none"
                        />
                        
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={handleAnalyze}
                                disabled={!rawInput.trim()}
                                className="flex-grow py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20"
                            >
                                Analyze Set
                            </button>
                            <button
                                onClick={handleClear}
                                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
                            >
                                Clear
                            </button>
                        </div>
                    </div>

                    {frequencies.length > 0 && (
                        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    Parsed List ({frequencies.length})
                                </h3>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {frequencies.map((f, i) => {
                                    const isDuplicate = frequencies.filter(freq => freq === f).length > 1;
                                    return (
                                        <div key={i} className={`border rounded-lg p-2 text-center transition-all ${
                                            isDuplicate 
                                                ? 'bg-rose-500/20 border-rose-500/50 shadow-lg shadow-rose-500/10' 
                                                : 'bg-slate-950/50 border-white/5'
                                        }`}>
                                            <div className="flex flex-col">
                                                <span className={`text-xs font-mono ${isDuplicate ? 'text-rose-300' : 'text-slate-300'}`}>
                                                    {f.toFixed(3)}
                                                </span>
                                                {isDuplicate && (
                                                    <span className="text-[8px] font-black uppercase text-rose-500 mt-1">Duplicate</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Results Section */}
                <div className="lg:col-span-7 space-y-6">
                    {!analysis ? (
                        <div className="h-full flex flex-col items-center justify-center bg-slate-900/30 border border-dashed border-white/10 rounded-3xl p-12 text-center">
                            <Info size={48} className="text-slate-700 mb-4" />
                            <h3 className="text-lg font-bold text-slate-500 mb-2">Awaiting Data</h3>
                            <p className="text-slate-600 text-sm max-w-xs">
                                Enter at least two frequencies to begin the forensic analysis.
                            </p>
                        </div>
                    ) : (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-6"
                        >
                            {/* Safety Verdict Header */}
                            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="flex items-center gap-6">
                                    <div className={`p-4 rounded-2xl ${
                                        analysis.safetyVerdict === 'Extremely Safe' ? 'bg-emerald-500/20 text-emerald-400' :
                                        analysis.safetyVerdict === 'Very Safe' ? 'bg-blue-500/20 text-blue-400' :
                                        analysis.safetyVerdict === 'Safe' ? 'bg-indigo-500/20 text-indigo-400' :
                                        analysis.safetyVerdict === 'Tight' ? 'bg-amber-500/20 text-amber-400' :
                                        'bg-rose-500/20 text-rose-400'
                                    }`}>
                                        <Shield size={32} />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Safety Verdict</div>
                                        <div className="text-3xl font-black text-white">{analysis.safetyVerdict}</div>
                                    </div>
                                </div>
                                <div className="w-full md:w-64">
                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                                        <span>Safety Score</span>
                                        <span>{analysis.safetyScore}%</span>
                                    </div>
                                    <div className="h-2 bg-slate-950 rounded-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${analysis.safetyScore}%` }}
                                            className={`h-full ${
                                                analysis.safetyScore >= 90 ? 'bg-emerald-500' :
                                                analysis.safetyScore >= 75 ? 'bg-blue-500' :
                                                analysis.safetyScore >= 60 ? 'bg-indigo-500' :
                                                analysis.safetyScore >= 40 ? 'bg-amber-500' :
                                                'bg-rose-500'
                                            }`}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Spacing Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <StatCard 
                                    label="Channel Spacing" 
                                    value={`${analysis.channelSpacing.toFixed(3)} MHz`} 
                                    icon={<Activity size={18} />}
                                    description="The tightest gap between any two carriers."
                                />
                                <StatCard 
                                    label="2-Tone Spacing" 
                                    value={`${analysis.twoTone3rd.toFixed(3)} MHz`} 
                                    icon={<Zap size={18} />}
                                    description="Safety margin for 3rd order 2-tone products (2f1-f2)."
                                />
                                <StatCard 
                                    label="3-Tone Spacing" 
                                    value={`${analysis.threeTone3rd.toFixed(3)} MHz`} 
                                    icon={<Zap size={18} />}
                                    description="Safety margin for 3rd order 3-tone products (f1+f2-f3)."
                                />
                                <StatCard 
                                    label="5th Order Spacing" 
                                    value={`${analysis.fiveTone.toFixed(3)} MHz`} 
                                    icon={<Zap size={18} />}
                                    description="Safety margin for 5th order products (3f1-2f2)."
                                />
                                <StatCard 
                                    label="7th Order Spacing" 
                                    value={`${analysis.sevenTone.toFixed(3)} MHz`} 
                                    icon={<Zap size={18} />}
                                    description="Safety margin for 7th order products (4f1-3f2)."
                                />
                            </div>

                            {/* Analysis Insights */}
                            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-6">Forensic Insights</h3>
                                <div className="space-y-4">
                                    {analysis.conflicts > 0 && (
                                        <InsightItem 
                                            condition={false}
                                            passText=""
                                            failText={`CRITICAL: ${analysis.conflicts} direct IMD hits detected. This coordination will fail in ${equipmentType} mode.`}
                                        />
                                    )}
                                    {frequencies.some((f, i) => frequencies.indexOf(f) !== i) && (
                                        <InsightItem 
                                            condition={false}
                                            passText=""
                                            failText="CRITICAL: Duplicate frequencies detected. This coordination is invalid and will cause immediate interference."
                                        />
                                    )}
                                    <InsightItem 
                                        condition={analysis.channelSpacing >= (equipmentType === 'analogue' ? 0.35 : 0.30)}
                                        passText={`${equipmentType === 'analogue' ? 'Standard' : 'Healthy'} channel spacing detected for ${equipmentType} systems.`}
                                        failText={`Tight channel spacing for ${equipmentType} equipment. High risk of sideband interference.`}
                                    />
                                    <InsightItem 
                                        condition={analysis.twoTone3rd >= (equipmentType === 'analogue' ? 0.10 : 0.05)}
                                        passText={`2-Tone safety margins are healthy for ${equipmentType} transmitters.`}
                                        failText={`Aggressive 2-Tone spacing. ${equipmentType === 'analogue' ? 'High risk for analogue mixing.' : 'Requires linear digital transmitters.'}`}
                                    />
                                    <InsightItem 
                                        condition={analysis.threeTone3rd >= (equipmentType === 'analogue' ? 0.05 : 0.025)}
                                        passText={`3-Tone safety margins are healthy for ${equipmentType} setups.`}
                                        failText={`Tight 3-Tone spacing. ${equipmentType === 'analogue' ? 'Risky for analogue intermodulation.' : 'High-density digital coordination detected.'}`}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
};

const StatCard: React.FC<{ label: string; value: string; icon: React.ReactNode; description: string }> = ({ label, value, icon, description }) => (
    <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-5 group hover:border-indigo-500/30 transition-all">
        <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-slate-950/50 rounded-lg text-indigo-400 group-hover:text-indigo-300 transition-colors">
                {icon}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
        </div>
        <div className="text-xl font-black text-white mb-2">{value}</div>
        <p className="text-[10px] text-slate-500 leading-tight">{description}</p>
    </div>
);

const InsightItem: React.FC<{ condition: boolean; passText: string; failText: string }> = ({ condition, passText, failText }) => (
    <div className="flex gap-4 items-start">
        <div className={`mt-1 p-1 rounded-full ${condition ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
            {condition ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
            {condition ? passText : failText}
        </p>
    </div>
);

export default FrequencyForensicsTab;
