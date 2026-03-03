
import React, { useState, useRef, useEffect } from 'react';
import { Frequency } from '../types';
import Card, { CardTitle } from './Card';

interface ARSpectrumViewTabProps {
    analyzerFrequencies: Frequency[];
}

const ARSpectrumViewTab: React.FC<ARSpectrumViewTabProps> = ({ analyzerFrequencies }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string>('');

    const startCamera = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setCameraError("Your browser does not support camera access (getUserMedia API not found).");
            setIsCameraActive(false);
            return;
        }

        setStatusMessage('Requesting camera access...');
        
        const constraintsToTry = [
            { video: { facingMode: { exact: "environment" }, width: { ideal: 1280 } } },
            { video: { facingMode: "environment" } },
            { video: true }
        ];

        let stream: MediaStream | null = null;
        let lastError: any = null;

        for (const constraints of constraintsToTry) {
            try {
                setStatusMessage('Trying camera configuration...');
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                if (stream) {
                    lastError = null;
                    break;
                }
            } catch (err) {
                lastError = err;
                console.warn(`Failed to get camera with constraints:`, constraints, err);
            }
        }

        if (stream && videoRef.current) {
            videoRef.current.srcObject = stream;
            try {
                setStatusMessage('Starting video stream...');
                await videoRef.current.play();
                setCameraError(null);
                setIsCameraActive(true);
                setStatusMessage('');
            } catch (playError) {
                console.error("Error trying to play video:", playError);
                setCameraError("Failed to start video playback. Your browser may have blocked it. Please ensure autoplay is allowed for this site.");
                stream.getTracks().forEach(track => track.stop());
                setIsCameraActive(false);
                setStatusMessage('');
            }
        } else {
            console.error("All attempts to access camera failed.", lastError);
            let errorMessage = "Could not access any camera on your device.";
            if (lastError) {
                switch (lastError.name) {
                    case "NotAllowedError":
                    case "PermissionDeniedError":
                        errorMessage = "Camera permission was denied. Please allow camera access in your browser or system settings.";
                        break;
                    case "NotFoundError":
                    case "DevicesNotFoundError":
                        errorMessage = "No compatible camera was found on your device.";
                        break;
                    case "NotReadableError":
                    case "TrackStartError":
                        errorMessage = "The camera is currently in use by another application or the hardware has an issue.";
                        break;
                    case "OverconstrainedError":
                    case "ConstraintNotSatisfiedError":
                         errorMessage = "No camera supports the requested constraints (e.g., rear-facing). Trying another might work.";
                         break;
                    default:
                        errorMessage = `An unexpected error occurred: ${lastError.message}`;
                }
            }
            setCameraError(errorMessage);
            setIsCameraActive(false);
            setStatusMessage('');
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
            setIsCameraActive(false);
        }
    };

    useEffect(() => {
        if (isCameraActive) {
            const canvas = canvasRef.current;
            const video = videoRef.current;
            if (!canvas || !video) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            
            let animationFrameId: number;

            const renderOverlay = () => {
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                }
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // --- Mock Spectrogram at the bottom ---
                const spectrogramHeight = 80;
                const yPos = canvas.height - spectrogramHeight;
                ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
                ctx.fillRect(0, yPos, canvas.width, spectrogramHeight);
                ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
                ctx.strokeRect(0, yPos, canvas.width, spectrogramHeight);

                for (let i = 0; i < canvas.width; i+=2) {
                    const intensity = Math.random();
                    const h = intensity * spectrogramHeight;
                    ctx.fillStyle = `hsl(${240 - intensity * 120}, 100%, ${50 + intensity * 20}%)`;
                    ctx.fillRect(i, canvas.height - h, 2, h);
                }

                // --- Compass Ribbon ---
                ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
                ctx.fillRect(0, 0, canvas.width, 30);
                ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
                ctx.strokeRect(0, 0, canvas.width, 30);
                ctx.fillStyle = '#f0f9ff';
                ctx.font = '12px "Roboto Mono", monospace';
                ctx.textAlign = 'center';
                const headings = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
                for(let i = -8; i < 8; i++) {
                    const x = (canvas.width / 2) + i * 50;
                    const heading = headings[((i % 8) + 8) % 8];
                    ctx.fillText(heading, x, 20);
                }
                ctx.fillStyle = '#38bdf8';
                ctx.beginPath();
                ctx.moveTo(canvas.width/2, 5);
                ctx.lineTo(canvas.width/2 - 5, 25);
                ctx.lineTo(canvas.width/2 + 5, 25);
                ctx.closePath();
                ctx.fill();

                // --- Frequency Markers in "World Space" ---
                const validFrequencies = analyzerFrequencies.filter(f => f.value > 0);
                validFrequencies.forEach((f, i) => {
                    const x = (canvas.width / (validFrequencies.length + 1)) * (i + 1);
                    const y = (canvas.height / 2) - 50 + (i % 2 === 0 ? 20: -20);
                    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
                    ctx.strokeStyle = '#f87171';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.roundRect(x - 60, y - 20, 120, 40, 8);
                    ctx.fill();
                    ctx.stroke();

                    ctx.fillStyle = '#fca5a5';
                    ctx.font = 'bold 14px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(f.id, x, y);
                    ctx.font = '12px "Roboto Mono", monospace';
                    ctx.fillStyle = 'white';
                    ctx.fillText(`${f.value.toFixed(3)} MHz`, x, y + 15);
                });
                
                animationFrameId = requestAnimationFrame(renderOverlay);
            };
            
            renderOverlay();
            
            return () => cancelAnimationFrame(animationFrameId);
        }
    }, [isCameraActive, analyzerFrequencies]);

    useEffect(() => {
        return () => stopCamera();
    }, []);

    return (
        <Card fullWidth>
            <CardTitle>🕶️ Augmented Reality Spectrum View</CardTitle>
            <div className="bg-slate-900/50 p-4 rounded-lg">
                {!isCameraActive ? (
                    <div className="text-center py-10">
                        {statusMessage && (
                            <p className="text-cyan-300 mb-4 animate-pulse">{statusMessage}</p>
                        )}
                        {cameraError && (
                            <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-lg mb-6 max-w-lg mx-auto">
                                <h3 className="font-bold">Camera Error</h3>
                                <p className="text-sm">{cameraError}</p>
                            </div>
                        )}
                        <p className="text-slate-400 mb-4">This tool overlays RF information onto your device's camera feed.</p>
                        <button onClick={startCamera} className="px-6 py-3 rounded-lg font-semibold bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg">
                            Activate Camera
                        </button>
                    </div>
                ) : (
                    <div>
                        <div className="relative w-full h-[60vh] max-h-[700px] bg-black rounded-lg overflow-hidden border border-blue-500/30">
                            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                            <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
                        </div>
                        <button onClick={stopCamera} className="w-full mt-4 px-6 py-3 rounded-lg font-semibold bg-red-600/80 text-white">
                            Deactivate Camera
                        </button>
                    </div>
                )}
            </div>
        </Card>
    );
};

export default ARSpectrumViewTab;
