
import React, { useState, useEffect } from 'react';
import { ScanDataPoint } from '../types';
import Card, { CardTitle } from './Card';
import { MockHardwareService } from '../services/mockHardwareService';

interface HardwareLinkTabProps {
    setScanData: (data: ScanDataPoint[] | null) => void;
}

const HardwareLinkTab: React.FC<HardwareLinkTabProps> = ({ setScanData }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [deviceInfo, setDeviceInfo] = useState<string | null>(null);
    const [status, setStatus] = useState('Ready to connect.');
    const [lastDataTimestamp, setLastDataTimestamp] = useState<Date | null>(null);

    // This would be a real hardware service in a full implementation
    const [hardwareService] = useState(() => new MockHardwareService());

    useEffect(() => {
        // Cleanup on unmount
        return () => {
            if (hardwareService.isConnected) {
                hardwareService.disconnect();
            }
        };
    }, [hardwareService]);

    const handleConnect = async () => {
        setStatus('Connecting...');
        try {
            // In a real app, this would use WebUSB: `await navigator.usb.requestDevice(...)`
            const connectedDevice = await hardwareService.connect(data => {
                setScanData(data);
                setLastDataTimestamp(new Date());
            });
            
            setIsConnected(true);
            setDeviceInfo(connectedDevice.productName);
            setStatus(`Streaming data from ${connectedDevice.productName}.`);

        } catch (error: any) {
            console.error("Connection failed:", error);
            setStatus(`Connection failed: ${error.message}`);
            setIsConnected(false);
            setDeviceInfo(null);
        }
    };

    const handleDisconnect = () => {
        hardwareService.disconnect();
        setIsConnected(false);
        setDeviceInfo(null);
        setStatus('Disconnected. Scan data is paused.');
        // We leave the last scan data in the app state intentionally
    };

    return (
        <Card fullWidth>
            <CardTitle>🔗 Hardware Analyzer Integration</CardTitle>
            <p className="text-slate-300 mb-6 text-sm">
                Connect to a compatible hardware spectrum analyzer to view live RF data in the Spectrum and Waterfall tabs. This is currently a simulation.
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
                    <p className="text-cyan-400/50">&gt; NOTE: This feature uses a mock hardware service to simulate a live data stream. In a real-world scenario, this would use the WebUSB API to connect to devices like an RF Explorer or TinySA.</p>
                </div>
            </div>
        </Card>
    );
};

export default HardwareLinkTab;
