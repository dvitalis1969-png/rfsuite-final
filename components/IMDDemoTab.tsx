
import React, { useState, useMemo, useRef, useEffect } from 'react';
import Card, { CardTitle } from './Card';

const inputLabelClass = "text-sm text-slate-400 mb-1 block";
const inputClass = "w-full bg-slate-900/60 border border-indigo-500/30 rounded-md p-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono";

const IMDDemoTab: React.FC = () => {
    const [f1, setF1] = useState(500.0);
    const [f2, setF2] = useState(505.0);
    const [f3, setF3] = useState(512.0);
    
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const imds = useMemo(() => {
        const A = f1;
        const B = f2;
        const C = f3;

        const results = [
            // 2-Tone 3rd Order
            { value: 2 * A - B, type: '2-Tone', label: '2A - B', sources: [A, B] },
            { value: 2 * B - A, type: '2-Tone', label: '2B - A', sources: [B, A] },
            { value: 2 * A - C, type: '2-Tone', label: '2A - C', sources: [A, C] },
            { value: 2 * C - A, type: '2-Tone', label: '2C - A', sources: [C, A] },
            { value: 2 * B - C, type: '2-Tone', label: '2B - C', sources: [B, C] },
            { value: 2 * C - B, type: '2-Tone', label: '2C - B', sources: [C, B] },
            // 3-Tone 3rd Order
            { value: A + B - C, type: '3-Tone', label: 'A + B - C', sources: [A, B, C] },
            { value: A + C - B, type: '3-Tone', label: 'A + C - B', sources: [A, C, B] },
            { value: B + C - A, type: '3-Tone', label: 'B + C - A', sources: [B, C, A] },
        ];

        return results.sort((a, b) => a.value - b.value);
    }, [f1, f2, f3]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const render = () => {
            const width = canvas.width;
            const height = canvas.height;
            const padding = { top: 40, bottom: 40, left: 20, right: 20 };
            const chartHeight = height - padding.top - padding.bottom;
            
            // Calculate Range
            const allFreqs = [f1, f2, f3, ...imds.map(i => i.value)];
            const min = Math.min(...allFreqs) - 5;
            const max = Math.max(...allFreqs) + 5;
            const range = max - min;

            const freqToX = (f: number) => padding.left + ((f - min) / range) * (width - padding.left - padding.right);

            ctx.clearRect(0, 0, width, height);

            // BG
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, width, height);

            // Grid
            ctx.strokeStyle = '#334155';
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(0, height - padding.bottom);
            ctx.lineTo(width, height - padding.bottom);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw IMDs first (background)
            imds.forEach(imd => {
                const x = freqToX(imd.value);
                const color = imd.type === '2-Tone' ? '#f87171' : '#c084fc';
                
                // Adjusted amplitudes: 2-Tone is higher (30% down from top) vs 3-Tone (60% down from top)
                const targetY = imd.type === '2-Tone' 
                    ? padding.top + chartHeight * 0.35 
                    : padding.top + chartHeight * 0.65;

                ctx.strokeStyle = color;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x, height - padding.bottom);
                ctx.lineTo(x, targetY);
                ctx.stroke();

                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(x, targetY, 3, 0, Math.PI * 2);
                ctx.fill();

                ctx.font = '10px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(imd.label, x, targetY - 10);
            });

            // Draw Fundamentals
            [f1, f2, f3].forEach((f, i) => {
                const x = freqToX(f);
                const color = '#facc15';
                
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(x, height - padding.bottom);
                ctx.lineTo(x, padding.top);
                ctx.stroke();

                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(x, padding.top, 5, 0, Math.PI * 2);
                ctx.fill();

                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(String.fromCharCode(65 + i), x, padding.top - 10);
            });

            // X-Axis Scale
            ctx.fillStyle = '#94a3b8';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            for (let i = 0; i <= 5; i++) {
                const f = min + (range / 5) * i;
                ctx.fillText(f.toFixed(1), freqToX(f), height - 15);
            }
        };

        render();
    }, [f1, f2, f3, imds]);

    return (
        <Card fullWidth>
            <CardTitle>🧪 3-Frequency IMD Demonstration</CardTitle>
            <p className="text-slate-300 mb-6 text-sm">
                Visualize how 3rd-order intermodulation products are generated from three source frequencies. Cluster effects are clearly visible when source frequencies are close together.
            </p>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Controls */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="space-y-4 bg-slate-900/50 p-4 rounded-lg border border-indigo-500/20">
                        <div>
                            <label className={inputLabelClass}>Frequency A (MHz)</label>
                            <input type="number" step="0.001" value={f1} onChange={e => setF1(parseFloat(e.target.value) || 0)} className={inputClass} />
                            <input type="range" min="400" max="600" step="0.1" value={f1} onChange={e => setF1(parseFloat(e.target.value))} className="w-full mt-2 accent-yellow-400" />
                        </div>
                        <div>
                            <label className={inputLabelClass}>Frequency B (MHz)</label>
                            <input type="number" step="0.001" value={f2} onChange={e => setF2(parseFloat(e.target.value) || 0)} className={inputClass} />
                            <input type="range" min="400" max="600" step="0.1" value={f2} onChange={e => setF2(parseFloat(e.target.value))} className="w-full mt-2 accent-yellow-400" />
                        </div>
                        <div>
                            <label className={inputLabelClass}>Frequency C (MHz)</label>
                            <input type="number" step="0.001" value={f3} onChange={e => setF3(parseFloat(e.target.value) || 0)} className={inputClass} />
                            <input type="range" min="400" max="600" step="0.1" value={f3} onChange={e => setF3(parseFloat(e.target.value))} className="w-full mt-2 accent-yellow-400" />
                        </div>
                    </div>
                    
                    <div className="p-4 rounded-lg bg-indigo-900/20 border border-indigo-500/30 text-xs text-indigo-300 leading-relaxed">
                        <p className="font-bold mb-1">💡 What are you seeing?</p>
                        <ul className="list-disc ml-4 space-y-1">
                            <li><span className="text-yellow-400 font-bold">Yellow</span>: Source frequencies (Fundamentals).</li>
                            <li><span className="text-red-400 font-bold">Red (Higher)</span>: 2-Tone products (e.g. 2A - B). Higher power levels.</li>
                            <li><span className="text-purple-400 font-bold">Purple (Lower)</span>: 3-Tone products (e.g. A + B - C). Generally lower power levels.</li>
                        </ul>
                    </div>
                </div>

                {/* Visualization & Table */}
                <div className="lg:col-span-8 space-y-6">
                    <canvas 
                        ref={canvasRef} 
                        width={800} 
                        height={300} 
                        className="w-full h-[300px] bg-slate-900 rounded-lg border border-slate-700 shadow-inner"
                    />

                    <div className="overflow-x-auto rounded-lg border border-slate-700">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-800 text-slate-300 uppercase font-bold text-xs tracking-wider">
                                <tr>
                                    <th className="p-3">Product Type</th>
                                    <th className="p-3 text-center">Formula</th>
                                    <th className="p-3 text-right">Result (MHz)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {imds.map((imd, idx) => (
                                    <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                                        <td className="p-3 font-semibold">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${imd.type === '2-Tone' ? 'bg-red-900/50 text-red-300' : 'bg-purple-900/50 text-purple-300'}`}>
                                                {imd.type}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center font-mono text-slate-400">{imd.label}</td>
                                        <td className="p-3 text-right font-mono text-cyan-300">{imd.value.toFixed(4)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default IMDDemoTab;
