import React from 'react';
import { AppState } from '../types';
import { generateFrequencyReportPdf, exportToCsv } from '../services/reportService';

interface ReportingTabProps {
    state: AppState;
    projectName?: string;
}

const ReportingTab: React.FC<ReportingTabProps> = ({ state, projectName = 'Untitled Project' }) => {
    return (
        <div className="p-6 bg-slate-900 rounded-2xl border border-white/10 text-white">
            <h2 className="text-xl font-black uppercase tracking-widest mb-6">Reporting & Compliance</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-slate-950 rounded-xl border border-white/5">
                    <h3 className="font-bold text-lg mb-2">PDF Report</h3>
                    <p className="text-slate-400 text-sm mb-4">Generate a professional, printable frequency coordination report.</p>
                    <button 
                        onClick={() => generateFrequencyReportPdf(state, projectName)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold text-sm transition-all"
                    >
                        Generate PDF
                    </button>
                </div>

                <div className="p-6 bg-slate-950 rounded-xl border border-white/5">
                    <h3 className="font-bold text-lg mb-2">Export Data</h3>
                    <p className="text-slate-400 text-sm mb-4">Export frequency list to CSV for external software.</p>
                    <button 
                        onClick={() => exportToCsv(state, projectName)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold text-sm transition-all"
                    >
                        Export CSV
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReportingTab;
