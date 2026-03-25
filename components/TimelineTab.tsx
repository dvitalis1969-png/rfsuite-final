
import React, { useState } from 'react';
import { Frequency, Scene } from '../types';
import Card, { CardTitle } from './Card';

interface TimelineTabProps {
    frequencies: Frequency[];
    scenes: Scene[];
    setScenes: React.Dispatch<React.SetStateAction<Scene[]>>;
}

const buttonBase = "px-4 py-2 rounded-lg font-semibold uppercase tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transform active:translate-y-0.5 text-sm";
const primaryButton = `bg-gradient-to-r from-indigo-500 to-purple-500 text-white ${buttonBase}`;
const secondaryButton = `bg-slate-700 text-slate-200 hover:bg-slate-600 ${buttonBase}`;
const actionButton = `bg-cyan-600/80 text-white hover:bg-cyan-600 ${buttonBase}`;
const dangerButton = `bg-red-600/80 text-white hover:bg-red-500/80 ${buttonBase}`;

const TimelineTab: React.FC<TimelineTabProps> = ({ frequencies, scenes, setScenes }) => {
    const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
    const [newSceneName, setNewSceneName] = useState('');

    const selectedScene = scenes.find(s => s.id === selectedSceneId);

    const addScene = () => {
        if (!newSceneName.trim()) {
            alert("Please enter a name for the new scene.");
            return;
        }
        const newScene: Scene = {
            id: `scene-${Date.now()}`,
            name: newSceneName.trim(),
            activeFrequencyIds: new Set(),
        };
        setScenes([...scenes, newScene]);
        setNewSceneName('');
        setSelectedSceneId(newScene.id);
    };

    const deleteScene = (id: string) => {
        if (window.confirm("Are you sure you want to delete this scene?")) {
            setScenes(scenes.filter(s => s.id !== id));
            if (selectedSceneId === id) {
                setSelectedSceneId(null);
            }
        }
    };

    const toggleFrequencyInScene = (freqId: string) => {
        if (!selectedSceneId) return;
        setScenes(currentScenes => 
            currentScenes.map(scene => {
                if (scene.id === selectedSceneId) {
                    const newActiveIds = new Set(scene.activeFrequencyIds);
                    if (newActiveIds.has(freqId)) {
                        newActiveIds.delete(freqId);
                    } else {
                        newActiveIds.add(freqId);
                    }
                    return { ...scene, activeFrequencyIds: newActiveIds };
                }
                return scene;
            })
        );
    };

    const handleExport = () => {
        if (scenes.length === 0) {
            alert('No scenes to export.');
            return;
        }
        let csvContent = "data:text/csv;charset=utf-8,Scene Name,Frequency ID,Frequency Label,Frequency (MHz)\n";
        scenes.forEach(scene => {
            scene.activeFrequencyIds.forEach(freqId => {
                const freq = frequencies.find(f => f.id === freqId);
                if (freq) {
                    csvContent += `"${scene.name}","${freq.id}","${freq.label || ''}",${freq.value}\n`;
                }
            });
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "rf_timeline.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const rows = text.split('\n').filter(row => row.trim() !== '').slice(1); // Skip header
            
            const scenesMap = new Map<string, Scene>();
            rows.forEach(row => {
                const [sceneName, freqId] = row.split(',').map(c => c.trim().replace(/"/g, ''));
                if (sceneName && freqId) {
                    if (!scenesMap.has(sceneName)) {
                        scenesMap.set(sceneName, {
                            id: `scene-import-${Date.now()}-${scenesMap.size}`,
                            name: sceneName,
                            activeFrequencyIds: new Set(),
                        });
                    }
                    if (frequencies.some(f => f.id === freqId)) {
                        scenesMap.get(sceneName)!.activeFrequencyIds.add(freqId);
                    }
                }
            });
            const newScenes = Array.from(scenesMap.values());
            setScenes(newScenes);
            alert(`Imported ${newScenes.length} scenes.`);
        };
        reader.readAsText(file);
    };


    return (
        <Card fullWidth>
            <CardTitle>🗓️ Timeline / Cue List Manager</CardTitle>
            <p className="text-slate-300 mb-4 text-sm">
                Define scenes for your event and assign active wireless channels to each one. This enables timeline-aware conflict checking in the Analyzer tab.
            </p>
             <div className="flex gap-2 mb-4">
                <input type="file" id="csv-timeline-import" className="hidden" accept=".csv" onChange={handleImport} />
                <label htmlFor="csv-timeline-import" className={`${actionButton} cursor-pointer`}>Import CSV</label>
                <button onClick={handleExport} className={actionButton}>Export CSV</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Scene List */}
                <div className="md:col-span-1 bg-slate-900/50 p-4 rounded-lg">
                    <h3 className="font-semibold text-indigo-300 mb-3">Scenes</h3>
                    <div className="flex gap-2 mb-4">
                        <input 
                            type="text" 
                            value={newSceneName}
                            onChange={e => setNewSceneName(e.target.value)}
                            placeholder="New Scene Name"
                            className="w-full bg-slate-800 border border-indigo-500/30 rounded-md p-2 text-slate-200 text-sm"
                        />
                        <button onClick={addScene} className={`${primaryButton} text-xs`}>Add</button>
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                        {scenes.map(scene => (
                            <div 
                                key={scene.id} 
                                onClick={() => setSelectedSceneId(scene.id)}
                                className={`flex justify-between items-center p-2 rounded-md cursor-pointer transition-colors ${selectedSceneId === scene.id ? 'bg-indigo-500/80' : 'bg-slate-800 hover:bg-slate-700'}`}
                            >
                                <span className="font-medium">{scene.name}</span>
                                <button onClick={(e) => {e.stopPropagation(); deleteScene(scene.id)}} className={`${dangerButton} !p-1 !text-xs`}>
                                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Frequency Assignment */}
                <div className="md:col-span-2 bg-slate-900/50 p-4 rounded-lg">
                    <h3 className="font-semibold text-purple-300 mb-3">
                        Active Frequencies for: <span className="text-white">{selectedScene?.name || 'No Scene Selected'}</span>
                    </h3>
                    {!selectedScene ? (
                        <div className="text-center text-slate-400 py-10">Select a scene to assign frequencies.</div>
                    ) : (
                        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-2">
                            {frequencies.map(freq => (
                                <label key={freq.id} className="flex items-center gap-4 p-2 rounded-md bg-slate-800 hover:bg-slate-700/50 cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        checked={selectedScene.activeFrequencyIds.has(freq.id)}
                                        onChange={() => toggleFrequencyInScene(freq.id)}
                                        className="w-5 h-5 accent-indigo-400"
                                    />
                                    <div className="flex-1 grid grid-cols-3 items-center">
                                         <span className="font-semibold text-slate-300">{freq.id}</span>
                                         <span className="font-mono text-cyan-300">{freq.value > 0 ? `${freq.value.toFixed(3)} MHz` : 'Not Set'}</span>
                                         <span className="text-slate-400 truncate">{freq.label || 'No Label'}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
};

export default TimelineTab;
