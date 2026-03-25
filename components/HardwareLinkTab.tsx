
import React, { useState, useEffect, useRef } from 'react';
import { ScanDataPoint } from '../types';
import Card, { CardTitle } from './Card';
import { requestSerialPort, connectToTinySA, readTinySAScan, SerialDevice } from '../services/serialService';

interface HardwareLinkTabProps {
    setScanData: (data: ScanDataPoint[] | null) => void;
}

const HardwareLinkTab: React.FC<HardwareLinkTabProps> = ({ setScanData }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [deviceInfo, setDeviceInfo] = useState<string | null>(null);
    const [status, setStatus] = useState('Ready to connect.');
    const [lastDataTimestamp, setLastDataTimestamp] = useState<Date | null>(null);
    const deviceRef = useRef<SerialDevice | null>(null);
    const intervalRef = useRef<number | null>(null);

    useEffect(() => {
        // Cleanup on unmount
        return () => {
            handleDisconnect();
        };
    }, []);

    const handleConnect = async () => {
        setStatus('Connecting...');
        try {
            const port = await requestSerialPort();
            const device = await connectToTinySA(port);
            deviceRef.current = device;
            
            setIsConnected(true);
            setDeviceInfo("TinySA Connected");
            setStatus(`Streaming data from TinySA.`);

            // Use a recursive timeout instead of setInterval for async tasks
            const streamLoop = async () => {
                if (!deviceRef.current) return;
                
                try {
                    const data = await readTinySAScan(deviceRef.current, 470, 700, 200);
                    if (data && data.length > 0) {
                        setScanData(data);
                        setLastDataTimestamp(new Date());
                    }
                } catch (e) {
                    console.error("Error reading data:", e);
                    // Don't disconnect immediately on one error, maybe it's transient
                }
                
                if (deviceRef.current) {
                    intervalRef.current = window.setTimeout(streamLoop, 100);
                }
            };
            
            streamLoop();

        } catch (error: any) {
            console.error("Connection failed:", error);
            setStatus(`Connection failed: ${error.message}`);
            setIsConnected(false);
            setDeviceInfo(null);
        }
    };

    const handleDisconnect = async () => {
        if (intervalRef.current) {
            clearTimeout(intervalRef.current);
            intervalRef.current = null;
        }
        if (deviceRef.current) {
            try {
                const { disconnectTinySA } = await import('../services/serialService');
                await disconnectTinySA(deviceRef.current);
            } catch (e) {
                console.error("Error during disconnect:", e);
            }
            deviceRef.current = null;
        }
        setIsConnected(false);
        setDeviceInfo(null);
        setStatus('Disconnected. Scan data is paused.');
    };

    return (
        <Card fullWidth>
            <CardTitle>🔗 Hardware Analyzer Integration</CardTitle>
            <p className="text-slate-300 mb-6 text-sm">
                Connect to a compatible hardware spectrum analyzer to view live RF data in the Spectrum and Waterfall tabs.
            </p>
            <div className="bg-slate-900/50 p-6 rounded-lg border border-indigo-500/30 max-w-lg mx-auto text-center">
                <div className="mb-6">
                    <p className="text-sm text-slate-400 uppercase tracking-wider">Connection Status</p>
                    <p className={`text-2xl font-bold my-2 ${isConnected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`}>
                        {isConnected ? `CONNECTED` : `DISCONNECTED`}
                    </p>
                    {deviceInfo && <p className="text-sm text-slate-300 font-mono">{deviceInfo}</p>}
                </div>
                
                {isConnected ? (
                    <button onClick={handleDisconnect} className="w-full px-6 py-3 rounded-lg font-semibold bg-red-600/80 text-white shadow-lg">
                        Disconnect
                    </button>
                ) : (
                    <button onClick={handleConnect} className="w-full px-6 py-3 rounded-lg font-semibold bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg">
                        Connect to Hardware
                    </button>
                )}
                
                <div className="mt-6 border-t border-slate-700 pt-4 text-left text-xs text-slate-500 font-mono space-y-2">
                    <p>&gt; {status}</p>
                    {lastDataTimestamp && <p>&gt; Last data packet received: {lastDataTimestamp.toLocaleTimeString()}</p>}
                </div>
            </div>
        </Card>
    );
};

export default HardwareLinkTab;
