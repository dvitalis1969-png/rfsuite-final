import React, { useState } from 'react';
import { EquipmentProfile } from '../types';
import * as dbService from '../services/dbService';

interface CustomEquipmentManagerProps {
    customProfiles: EquipmentProfile[];
    setCustomProfiles: (profiles: EquipmentProfile[]) => void;
    onClose: () => void;
}

const emptyProfile: Omit<EquipmentProfile, 'id'> = {
    name: '',
    band: '',
    minFreq: 470,
    maxFreq: 608,
    tuningStep: 0.025,
    isCustom: true,
    affiliateUrl: '',
    recommendedThresholds: {
        fundamental: 0.350,
        twoTone: 0.100,
        threeTone: 0.100
    }
};

const CustomEquipmentManager: React.FC<CustomEquipmentManagerProps> = ({ customProfiles, setCustomProfiles, onClose }) => {
    const [editingProfile, setEditingProfile] = useState<Partial<EquipmentProfile>>(emptyProfile);
    const [isEditing, setIsEditing] = useState(false);

    const handleFieldChange = (field: keyof EquipmentProfile, value: string | number) => {
        setEditingProfile(p => ({ ...p, [field]: value }));
    };

    const handleThresholdChange = (field: 'fundamental' | 'twoTone' | 'threeTone', value: string) => {
        const numVal = parseFloat(value) || 0;
        setEditingProfile(p => ({
            ...p,
            recommendedThresholds: {
                ...(p.recommendedThresholds || emptyProfile.recommendedThresholds!),
                [field]: numVal
            }
        }));
    };

    const handleSave = async () => {
        if (!editingProfile.name || !editingProfile.band) {
            alert("Profile Name and Band are required.");
            return;
        }
        const profileToSave: EquipmentProfile = {
            id: editingProfile.id || `custom-${Date.now()}`,
            name: editingProfile.name,
            band: editingProfile.band,
            minFreq: Number(editingProfile.minFreq) || 0,
            maxFreq: Number(editingProfile.maxFreq) || 0,
            tuningStep: Number(editingProfile.tuningStep) || 0.025,
            isCustom: true,
            affiliateUrl: editingProfile.affiliateUrl,
            recommendedThresholds: {
                fundamental: editingProfile.recommendedThresholds?.fundamental ?? 0.350,
                twoTone: editingProfile.recommendedThresholds?.twoTone ?? 0.100,
                threeTone: editingProfile.recommendedThresholds?.threeTone ?? 0.100,
                fiveTone: 0,
                sevenTone: 0
            }
        };

        await dbService.saveCustomEquipment(profileToSave);
        const updatedProfiles = await dbService.getCustomEquipment();
        setCustomProfiles(updatedProfiles);
        setEditingProfile(emptyProfile);
        setIsEditing(false);
    };

    const handleEdit = (profile: EquipmentProfile) => {
        setEditingProfile(profile);
        setIsEditing(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this custom profile?")) {
            await dbService.deleteCustomEquipment(id);
            const updatedProfiles = await dbService.getCustomEquipment();
            setCustomProfiles(updatedProfiles);
        }
    };
    
    const cancelEdit = () => {
        setEditingProfile(emptyProfile);
        setIsEditing(false);
    }

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-indigo-500/30 rounded-xl shadow-2xl w-full max-w-4xl text-white">
                <div className="flex justify-between items-center p-4 border-b border-slate-700">
                    <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Custom Equipment Manager</h2>
                    {/* The 'x' was removed from here to be moved into the form box for mobile visibility */}
                </div>
                
                <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Form Section */}
                    <div className="lg:col-span-2 bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold text-indigo-300 flex items-center gap-2">
                                <span>{isEditing ? '📝' : '➕'}</span>
                                {isEditing ? 'Edit Profile' : 'Add New Profile'}
                            </h3>
                            {/* Repositioned Close Button - Now always visible at top of form */}
                            <button 
                                onClick={onClose} 
                                className="text-slate-400 hover:text-white text-3xl leading-none"
                                title="Close Manager"
                            >
                                &times;
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block">Profile Name</label>
                                <input type="text" value={editingProfile.name || ''} onChange={e => handleFieldChange('name', e.target.value)} placeholder="e.g., Shure AD Custom" className="w-full bg-slate-800 border border-indigo-500/30 rounded-md p-2 text-slate-200 text-sm focus:border-indigo-500 outline-none" />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block">Band Label</label>
                                <input type="text" value={editingProfile.band || ''} onChange={e => handleFieldChange('band', e.target.value)} placeholder="e.g., G56 (470-636 MHz)" className="w-full bg-slate-800 border border-indigo-500/30 rounded-md p-2 text-slate-200 text-sm focus:border-indigo-500 outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block">Min Freq (MHz)</label>
                                    <input type="number" step="0.001" value={editingProfile.minFreq || ''} onChange={e => handleFieldChange('minFreq', e.target.value)} className="w-full bg-slate-800 border border-indigo-500/30 rounded-md p-2 text-slate-200 font-mono text-sm" />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block">Max Freq (MHz)</label>
                                    <input type="number" step="0.001" value={editingProfile.maxFreq || ''} onChange={e => handleFieldChange('maxFreq', e.target.value)} className="w-full bg-slate-800 border border-indigo-500/30 rounded-md p-2 text-slate-200 font-mono text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block">Tuning Step (MHz)</label>
                                <input type="number" value={editingProfile.tuningStep || ''} step="0.025" onChange={e => handleFieldChange('tuningStep', e.target.value)} className="w-full bg-slate-800 border border-indigo-500/30 rounded-md p-2 text-slate-200 font-mono text-sm" />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block">Affiliate / Purchase URL</label>
                                <input type="text" value={editingProfile.affiliateUrl || ''} onChange={e => handleFieldChange('affiliateUrl', e.target.value)} placeholder="https://..." className="w-full bg-slate-800 border border-indigo-500/30 rounded-md p-2 text-slate-200 text-sm focus:border-indigo-500 outline-none" />
                            </div>

                            <div className="pt-2 border-t border-slate-700">
                                <h4 className="text-[10px] uppercase font-black text-indigo-400 mb-3 tracking-widest">Recommended Spacing (MHz)</h4>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="text-[9px] uppercase font-bold text-slate-500 mb-1 block">F-F</label>
                                        <input 
                                            type="number" 
                                            step="0.001" 
                                            value={editingProfile.recommendedThresholds?.fundamental ?? 0.350} 
                                            onChange={e => handleThresholdChange('fundamental', e.target.value)} 
                                            className="w-full bg-slate-800 border border-indigo-500/30 rounded-md p-2 text-indigo-300 font-mono text-xs text-center" 
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] uppercase font-bold text-slate-500 mb-1 block">2-Tone</label>
                                        <input 
                                            type="number" 
                                            step="0.001" 
                                            value={editingProfile.recommendedThresholds?.twoTone ?? 0.100} 
                                            onChange={e => handleThresholdChange('twoTone', e.target.value)} 
                                            className="w-full bg-slate-800 border border-indigo-500/30 rounded-md p-2 text-rose-300 font-mono text-xs text-center" 
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] uppercase font-bold text-slate-500 mb-1 block">3-Tone</label>
                                        <input 
                                            type="number" 
                                            step="0.001" 
                                            value={editingProfile.recommendedThresholds?.threeTone ?? 0.100} 
                                            onChange={e => handleThresholdChange('threeTone', e.target.value)} 
                                            className="w-full bg-slate-800 border border-indigo-500/30 rounded-md p-2 text-purple-300 font-mono text-xs text-center" 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-6">
                             <button onClick={handleSave} className="flex-1 px-4 py-2 rounded-lg font-bold bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg text-xs uppercase tracking-wider">
                                {isEditing ? 'Update Profile' : 'Save Profile'}
                            </button>
                            {isEditing && <button onClick={cancelEdit} className="px-4 py-2 rounded-lg font-bold bg-slate-700 text-white text-xs uppercase tracking-wider">Cancel</button>}
                        </div>
                    </div>

                    {/* Existing Profiles Section */}
                    <div className="lg:col-span-3 bg-slate-900/50 p-4 rounded-lg border border-slate-700 flex flex-col">
                         <h3 className="font-semibold mb-4 text-purple-300 flex items-center gap-2">
                            <span>📋</span>
                            Saved Profiles
                         </h3>
                         <div className="space-y-2 overflow-y-auto pr-2 flex-grow max-h-[500px] custom-scrollbar">
                            {customProfiles.length > 0 ? customProfiles.map(profile => (
                                <div key={profile.id} className="flex justify-between items-center bg-slate-800 p-3 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-all group">
                                    <div className="flex-1">
                                        <p className="font-bold text-slate-200">{profile.name}</p>
                                        <p className="text-[10px] text-slate-400 mb-2">{profile.band} | {profile.minFreq}-{profile.maxFreq} MHz</p>
                                        <div className="flex gap-3 text-[9px] font-mono">
                                            <span className="text-indigo-400">F-F: {profile.recommendedThresholds?.fundamental?.toFixed(3)}</span>
                                            <span className="text-rose-400">2T: {profile.recommendedThresholds?.twoTone?.toFixed(3)}</span>
                                            <span className="text-purple-400">3T: {profile.recommendedThresholds?.threeTone?.toFixed(3)}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEdit(profile)} className="px-3 py-1.5 text-[10px] font-black bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 rounded-lg hover:bg-cyan-600 hover:text-white transition-all uppercase">Edit</button>
                                        <button onClick={() => handleDelete(profile.id!)} className="px-3 py-1.5 text-[10px] font-black bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-600 hover:text-white transition-all uppercase">Delete</button>
                                    </div>
                                </div>
                            )) : (
                                <div className="flex flex-col items-center justify-center h-40 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
                                    <p className="text-sm italic">No custom profiles yet.</p>
                                    <p className="text-[10px] mt-1">Add one using the form on the left.</p>
                                </div>
                            )}
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomEquipmentManager;