import React from 'react';
import Card, { CardTitle } from './Card';

interface PresetsTabProps {
    onLoadPreset: (frequencies: number[]) => void;
}

const PresetsTab: React.FC<PresetsTabProps> = ({ onLoadPreset }) => {
    return (
        <Card fullWidth>
            <CardTitle>🎛️ Equipment Presets</CardTitle>
            <p className="text-slate-300 mb-6 text-sm">Load pre-configured, compatible frequency sets for common wireless systems into the Analyzer.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 <div className="bg-slate-900/50 p-4 rounded-lg border border-indigo-500/20 text-center text-slate-400 col-span-full">
                    This feature is currently unavailable.
                </div>
            </div>
        </Card>
    );
};

export default PresetsTab;