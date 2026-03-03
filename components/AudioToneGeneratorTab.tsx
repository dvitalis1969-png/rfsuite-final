
import React, { useState, useRef, useEffect } from 'react';
import Card, { CardTitle } from './Card';

const inputLabelClass = "text-sm text-slate-400 mb-1 block";
const inputClass = "w-full bg-slate-900/60 border border-indigo-500/30 rounded-md p-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400";
const buttonBase = "px-4 py-2 rounded-lg font-semibold uppercase tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transform active:translate-y-0.5 text-sm";
const primaryButton = `bg-gradient-to-r from-indigo-500 to-purple-500 text-white ${buttonBase}`;
const dangerButton = `bg-red-600/80 text-white ${buttonBase}`;

const AudioToneGeneratorTab: React.FC = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [frequency, setFrequency] = useState(440);
    const [volume, setVolume] = useState(0.5);
    const [waveType, setWaveType] = useState<OscillatorType>('sine');

    const audioContextRef = useRef<AudioContext | null>(null);
    const oscillatorRef = useRef<OscillatorNode | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);

    useEffect(() => {
        return () => {
            // Cleanup on component unmount
            if (oscillatorRef.current) {
                oscillatorRef.current.stop();
            }
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
        };
    }, []);

    const togglePlay = () => {
        if (isPlaying) {
            // Stop
            if (oscillatorRef.current) {
                oscillatorRef.current.stop();
                oscillatorRef.current = null;
            }
            setIsPlaying(false);
        } else {
            // Start
            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const audioCtx = audioContextRef.current;

            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.type = waveType;
            oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.start();

            oscillatorRef.current = oscillator;
            gainNodeRef.current = gainNode;
            setIsPlaying(true);
        }
    };

    useEffect(() => {
        if (isPlaying && oscillatorRef.current && gainNodeRef.current && audioContextRef.current) {
            oscillatorRef.current.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime);
            gainNodeRef.current.gain.setValueAtTime(volume, audioContextRef.current.currentTime);
            oscillatorRef.current.type = waveType;
        }
    }, [frequency, volume, waveType, isPlaying]);

    return (
        <Card fullWidth>
            <CardTitle>🎵 Audio Tone Generator</CardTitle>
            <p className="text-slate-300 mb-6 text-sm">
                Generate a pure audio tone to test audio equipment and signal paths.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div>
                        <label className={inputLabelClass}>Frequency: <span className="font-mono text-indigo-300">{frequency} Hz</span></label>
                        <input
                            type="range"
                            min="20"
                            max="20000"
                            step="1"
                            value={frequency}
                            onChange={e => setFrequency(Number(e.target.value))}
                            className="w-full"
                        />
                    </div>
                    <div>
                        <label className={inputLabelClass}>Volume: <span className="font-mono text-indigo-300">{Math.round(volume * 100)}%</span></label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            onChange={e => setVolume(Number(e.target.value))}
                            className="w-full"
                        />
                    </div>
                    <div>
                        <label className={inputLabelClass}>Waveform</label>
                        <select value={waveType} onChange={e => setWaveType(e.target.value as OscillatorType)} className={inputClass}>
                            <option value="sine">Sine</option>
                            <option value="square">Square</option>
                            <option value="sawtooth">Sawtooth</option>
                            <option value="triangle">Triangle</option>
                        </select>
                    </div>
                </div>
                <div className="flex items-center justify-center">
                    <button onClick={togglePlay} className={`${isPlaying ? dangerButton : primaryButton} text-2xl w-48 h-48 rounded-full shadow-2xl`}>
                        {isPlaying ? 'STOP' : 'PLAY'}
                    </button>
                </div>
            </div>
        </Card>
    );
};

export default AudioToneGeneratorTab;
