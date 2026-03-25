
import { ScanDataPoint } from '../types';

interface MockDevice {
    productName: string;
    serialNumber: string;
}

export class MockHardwareService {
    private intervalId: number | null = null;
    public isConnected: boolean = false;
    private onDataCallback: ((data: ScanDataPoint[]) => void) | null = null;

    connect(onData: (data: ScanDataPoint[]) => void): Promise<MockDevice> {
        return new Promise((resolve, reject) => {
            if (this.isConnected) {
                return reject(new Error("Already connected to a device."));
            }
            
            // Simulate user picking a device
            setTimeout(() => {
                console.log("MockHardware: Simulating connection...");
                this.isConnected = true;
                this.onDataCallback = onData;
                
                const mockDevice: MockDevice = {
                    productName: "Simulated RF Scanner v1.2",
                    serialNumber: `SIM-${Date.now()}`
                };

                this.startStreaming();
                resolve(mockDevice);
            }, 1500); // Simulate connection delay
        });
    }

    disconnect(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isConnected = false;
        this.onDataCallback = null;
        console.log("MockHardware: Disconnected.");
    }

    private startStreaming(): void {
        this.intervalId = window.setInterval(() => {
            if (this.onDataCallback) {
                const scanData = this.generateRealisticScanData();
                this.onDataCallback(scanData);
            }
        }, 500); // Stream new data every 500ms
    }

    private generateRealisticScanData(): ScanDataPoint[] {
        const data: ScanDataPoint[] = [];
        const startFreq = 470;
        const endFreq = 700;
        const step = 0.1; // 100 kHz steps

        const noiseFloor = -105;
        
        // Simulate some DTV channels
        const dtvChannels = [
            { freq: 473, width: 6, amp: -65 },
            { freq: 503, width: 6, amp: -70 },
            { freq: 521, width: 6, amp: -60 },
            { freq: 617, width: 6, amp: -75 },
        ];
        
        // Simulate some random noise spikes
        const noiseSpikes = [
            { freq: 550, amp: -80 },
            { freq: 650, amp: -85 },
        ];

        for (let freq = startFreq; freq <= endFreq; freq += step) {
            let amp = noiseFloor + (Math.random() - 0.5) * 5; // Base noise with jitter

            // Add DTV channels
            for (const channel of dtvChannels) {
                if (freq >= channel.freq && freq <= channel.freq + channel.width) {
                    // Simple box shape for DTV
                    const edgeTaper = Math.min(
                        (freq - channel.freq) / 1,
                        (channel.freq + channel.width - freq) / 1
                    );
                    const taperFactor = Math.min(1, edgeTaper);
                    amp = Math.max(amp, channel.amp + (Math.random() * 3) - (1 - taperFactor) * 10);
                }
            }

            // Add noise spikes
            for (const spike of noiseSpikes) {
                const dist = Math.abs(freq - spike.freq);
                if (dist < 0.5) {
                    amp = Math.max(amp, spike.amp - dist * 20 + Math.random() * 2);
                }
            }

            data.push({ freq: parseFloat(freq.toFixed(3)), amp });
        }

        return data;
    }
}
