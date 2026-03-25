import React from 'react';
import Card, { CardTitle } from './Card';
import { AppCategory } from '../types';
import { CATEGORY_GUIDES } from '../constants/guides';

interface UserGuideTabProps {
    activeApp: AppCategory | null;
}

const UserGuideTab: React.FC<UserGuideTabProps> = ({ activeApp }) => {
    if (!activeApp) return null;

    const sections = CATEGORY_GUIDES[activeApp] || [];

    return (
        <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
            <div className="text-center mb-10">
                <div className="inline-block px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[9px] font-black uppercase tracking-[0.4em] mb-4">
                    User Documentation
                </div>
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
                    How To Use The <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">{activeApp.replace(/^\w/, c => c.toUpperCase())}</span> Module
                </h2>
            </div>

            {sections.length === 0 ? (
                <Card className="text-center py-20">
                    <p className="text-slate-500 uppercase font-black tracking-widest text-sm">Documentation Pending for this module.</p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {sections.map((section, idx) => (
                        <Card key={idx} className="!p-8 hover:border-indigo-500/50 transition-all group">
                            <div className="flex flex-col md:flex-row gap-8">
                                <div className="flex-1">
                                    <h3 className="text-xl font-black text-white uppercase tracking-wider mb-4 flex items-center gap-3">
                                        <span className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-xs shadow-lg">{idx + 1}</span>
                                        {section.title}
                                    </h3>
                                    <p className="text-slate-400 text-sm leading-relaxed mb-8">
                                        {section.description}
                                    </p>

                                    <div className="space-y-6">
                                        <div>
                                            <h4 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                                                Step-by-Step Workflow
                                            </h4>
                                            <ul className="space-y-2.5">
                                                {section.steps.map((step, sIdx) => (
                                                    <li key={sIdx} className="flex gap-3 text-xs text-slate-300">
                                                        <span className="text-indigo-500 font-bold opacity-50">&bull;</span>
                                                        {step}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div>
                                            <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                Pro Engineering Tips
                                            </h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {section.tips.map((tip, tIdx) => (
                                                    <div key={tIdx} className="bg-slate-950/50 border border-emerald-500/10 rounded-xl p-3 text-[11px] text-slate-400 italic leading-relaxed group-hover:border-emerald-500/30 transition-all">
                                                        "{tip}"
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {section.physics && (
                                    <div className="md:w-64 flex-shrink-0">
                                        <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-2xl p-5 h-full relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-4 opacity-5 text-4xl">🧬</div>
                                            <h4 className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-3">Underlying Physics</h4>
                                            <p className="text-[10px] text-indigo-200/70 leading-relaxed font-mono">
                                                {section.physics}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <div className="bg-slate-900/30 border border-white/5 rounded-3xl p-8 text-center mt-12 mb-20">
                <p className="text-slate-500 text-xs font-medium uppercase tracking-[0.2em] mb-4">Still need assistance?</p>
                <div className="flex justify-center gap-4">
                    <button className="px-6 py-2 rounded-xl bg-slate-800 text-[10px] font-black uppercase text-white hover:bg-slate-700 transition-all border border-white/10">Download Full PDF Manual</button>
                    <button className="px-6 py-2 rounded-xl bg-indigo-600 text-[10px] font-black uppercase text-white hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20">Contact Tech Support</button>
                </div>
            </div>
        </div>
    );
};

export default UserGuideTab;
