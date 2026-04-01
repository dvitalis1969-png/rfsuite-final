import { ScanDataPoint } from '../types';

export interface SerialDevice {
    port: any;
    reader: any;
    writer: any;
    deviceType: 'tinysa';
    pendingRead?: Promise<any> | null;
}

export async function safeRead(device: SerialDevice) {
    if (!device.reader) {
        throw new Error('Serial port reader is not available. The device might be disconnected.');
    }
    if (!device.pendingRead) {
        device.pendingRead = device.reader.read();
    }
    try {
        const result = await device.pendingRead;
        device.pendingRead = null;
        return result;
    } catch (e) {
        device.pendingRead = null;
        throw e;
    }
}

export async function requestSerialPort(): Promise<any> {
    if (!('serial' in navigator)) {
        throw new Error('Web Serial API not supported in this browser.');
    }
    // @ts-ignore
    return await navigator.serial.requestPort();
}

export async function connectToTinySA(port: any, baudRate: number = 115200): Promise<SerialDevice> {
    try {
        await port.open({ baudRate });
    } catch (e: any) {
        if (e.name !== 'InvalidStateError' && !e.message?.includes('already open')) {
            throw e;
        }
    }
    
    if (!port.readable || !port.writable) {
        throw new Error('Serial port is not readable or writable. It might be disconnected or locked.');
    }

    // Many TinySA/NanoVNA devices require DTR/RTS to be set to send data
    try {
        // @ts-ignore
        await port.setSignals({ dataTerminalReady: true, requestToSend: true });
    } catch (e) {
        console.warn('Could not set DTR/RTS signals:', e);
    }

    const writer = port.writable.getWriter();
    
    try {
        // Send Ctrl+C and multiple newlines to clear any state and ensure we are at the prompt
        const encoder = new TextEncoder();
        // Send Ctrl+C, Esc, and Enter to break any current operation
        await writer.write(encoder.encode('\x03\x1B\r\n\r\n'));
        
        // Small delay for device to process
        await new Promise(resolve => setTimeout(resolve, 500));
        
        return { port, reader: port.readable.getReader(), writer, deviceType: 'tinysa' };
    } catch (e) {
        writer.releaseLock();
        throw e;
    }
}


export async function connectToDevice(port: any, baudRate: number, deviceType: 'tinysa'): Promise<SerialDevice> {
    return await connectToTinySA(port, baudRate);
}

export async function forceWakeUp(device: SerialDevice): Promise<void> {
    const { writer } = device;
    const encoder = new TextEncoder();
    
    if (device.deviceType === 'tinysa') {
        // TinySA wake-up
        const barrage = '\x03\x1B\r\n\x15\x03\r\n\x1B\r\n';
        await writer.write(encoder.encode(barrage));
        await new Promise(resolve => setTimeout(resolve, 300));
        await writer.write(encoder.encode('threads\r\n')); 
        await new Promise(resolve => setTimeout(resolve, 300));
        await writer.write(encoder.encode('\r\n\r\n'));
    }
}

export async function listenOnly(device: SerialDevice, durationMs: number = 2000, onRaw?: (data: string) => void): Promise<string> {
    if (isBusy) return "Busy...";
    isBusy = true;
    try {
        const decoder = new TextDecoder();
        let data = "";
        const timeoutPromise = new Promise(resolve => setTimeout(resolve, durationMs));
        
        const readPromise = (async () => {
            try {
                while (true) {
                    const { value, done } = await Promise.race([
                        safeRead(device),
                        new Promise<{value: undefined, done: boolean}>(resolve => setTimeout(() => resolve({value: undefined, done: true}), durationMs))
                    ]);
                    if (done || !value) break;
                    const chunk = decoder.decode(value, { stream: true });
                    data += chunk;
                    if (onRaw) {
                        const bytes = Array.from(value as Uint8Array);
                        const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join(' ');
                        const cleanChunk = chunk.replace(/[\r\n]+/g, ' ').trim();
                        onRaw(`LISTEN: ${cleanChunk || `[HEX: ${hex}]`}`);
                    }
                }
            } finally {}
        })();

        try {
            await Promise.race([readPromise, timeoutPromise]);
        } catch (err) {
            try { await device.reader?.cancel(); } catch (e) {}
            try { await readPromise; } catch (e) {}
            throw err;
        }
        
        try { await readPromise; } catch (e) {}
        return data;
    } finally {
        isBusy = false;
    }
}

export async function sendRawCommand(device: SerialDevice, command: string, onRaw?: (data: string) => void): Promise<string> {
    if (isBusy) return "Busy...";
    isBusy = true;
    
    const { writer } = device;
    try {
        await clearBuffer(device);
        const encoder = new TextEncoder();
        await writer.write(encoder.encode(command + '\r'));
        
        let data = "";
        const decoder = new TextDecoder();
        let timeoutId: any;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Command Timeout')), 10000);
        });

        const readPromise = (async () => {
            try {
                while (true) {
                    const { value, done } = await safeRead(device);
                    if (done) break;
                    
                    const chunk = decoder.decode(value, { stream: true });
                    data += chunk;
                    if (onRaw) {
                        const bytes = Array.from(value as Uint8Array);
                        const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join(' ');
                        const cleanChunk = chunk.replace(/[\r\n]+/g, ' ').trim();
                        onRaw(`RX: ${cleanChunk || `[HEX: ${hex}]`}`);
                    }
                    if (device.deviceType === 'tinysa' && data.trim().endsWith('ch>')) break;
                }
            } finally {
                clearTimeout(timeoutId);
            }
        })();

        try {
            await Promise.race([readPromise, timeoutPromise]);
        } catch (err) {
            try { await device.reader?.cancel(); } catch (e) {}
            try { await readPromise; } catch (e) {}
            throw err;
        }
        return data.trim();
    } catch (e: any) {
        return `Error: ${e.message}`;
    } finally {
        isBusy = false;
    }
}

export async function getDeviceVersion(device: SerialDevice, onRaw?: (data: string) => void): Promise<string | null> {
    const command = 'version';
    const response = await sendRawCommand(device, command, onRaw);
    if (response.includes('Error') || response === "Busy...") return null;
    
    return response.replace(/version/g, '').replace(/ch>/g, '').trim();
}

let isBusy = false;

export async function disconnectTinySA(device: SerialDevice): Promise<void> {
    isBusy = false;
    try {
        if (device.reader) {
            try { await device.reader?.cancel(); } catch (e) { console.warn('Reader cancel error:', e); }
            
            // Wait for active read functions to release the lock
            let retries = 10;
            while (device.reader && retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 50));
                retries--;
            }
            
            if (device.reader) {
                try { device.reader.releaseLock(); } catch (e) { console.warn('Reader release error:', e); }
                device.reader = null;
            }
        }
        if (device.writer) {
            // Just release the lock, closing the stream can sometimes hang
            try { device.writer.releaseLock(); } catch (e) { console.warn('Writer release error:', e); }
            device.writer = null;
        }
        if (device.port) {
            try { await device.port.close(); } catch (e) { console.warn('Port close error:', e); }
            device.port = null;
        }
    } catch (e) {
        console.error('Error during disconnect:', e);
    }
}

export async function clearBuffer(device: SerialDevice) {
    // Read whatever is available to clear the buffer
    try {
        while (true) {
            const { value, done } = await Promise.race([
                safeRead(device),
                new Promise<{value: undefined, done: boolean}>(resolve => setTimeout(() => resolve({value: undefined, done: true}), 200))
            ]);
            if (done || !value) break;
        }
    } catch (e) {}
}

export async function readTinySAScan(device: SerialDevice, startFreq: number, endFreq: number, points: number = 290, onStatus?: (status: string) => void, onRaw?: (data: string) => void): Promise<ScanDataPoint[]> {
    if (isBusy) return [];
    isBusy = true;
    
    const { writer } = device;
    
    try {
        if (onStatus) onStatus('Setting sweep range...');
        await clearBuffer(device);
        
        const encoder = new TextEncoder();
        await writer.write(encoder.encode(`sweep start ${Math.round(startFreq * 1000000)}\r`));
        await new Promise(r => setTimeout(r, 50));
        await writer.write(encoder.encode(`sweep stop ${Math.round(endFreq * 1000000)}\r`));
        await new Promise(r => setTimeout(r, 50));
        
        await clearBuffer(device);
        if (onStatus) onStatus('Requesting trace data...');
        await writer.write(encoder.encode('data 0\r'));

        const scanData: ScanDataPoint[] = [];
        const decoder = new TextDecoder();
        let buffer = '';
        
        let timeoutId: any;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                console.error('TinySA Trace Timeout. Buffer content:', buffer);
                reject(new Error('TinySA Trace Timeout'));
            }, 60000);
        });

        const readPromise = (async () => {
            try {
                while (true) {
                    const { value, done } = await safeRead(device);
                    if (done) break;
                    
                    const chunk = decoder.decode(value, { stream: true });
                    if (onRaw && value) {
                        onRaw(chunk.trim().slice(0, 50));
                    }

                    buffer += chunk;
                    
                    if (buffer.includes('ch>')) {
                        if (buffer.includes('? ch>')) {
                            throw new Error('Device rejected data command');
                        }
                        // Process whatever is left in the buffer before returning
                        const parts = buffer.replace('ch>', '').split(/\s+/);
                        for (const part of parts) {
                            if (part === 'data' || part === '0') continue;
                            const amp = parseFloat(part);
                            if (!isNaN(amp)) scanData.push({ freq: 0, amp });
                        }
                        return;
                    }

                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed) continue;

                        const parts = trimmed.split(/\s+/);
                        for (const part of parts) {
                            if (part === 'data' || part === '0') continue;
                            const amp = parseFloat(part);
                            if (!isNaN(amp)) {
                                scanData.push({ freq: 0, amp });
                            }
                        }
                    }
                }
            } finally {
                clearTimeout(timeoutId);
            }
        })();

        try {
            await Promise.race([readPromise, timeoutPromise]);
        } catch (err) {
            try { await device.reader?.cancel(); } catch (e) {}
            try { await readPromise; } catch (e) {}
            throw err;
        }
        
        const numPoints = scanData.length;
        if (numPoints > 0) {
            const step = (endFreq - startFreq) / Math.max(1, numPoints - 1);
            for (let i = 0; i < numPoints; i++) {
                scanData[i].freq = startFreq + (i * step);
            }
        }
        
        if (onStatus) onStatus(`Trace complete: ${numPoints} points`);
        return scanData;
    } catch (error: any) {
        let message = error.message;
        if (message.includes('The port is closed')) {
            message = 'TinySA device disconnected. Please reconnect the device.';
        }
        console.error('TinySA Read Error:', message);
        if (onStatus) onStatus(`Trace Error: ${message}`);
        return [];
    } finally {
        isBusy = false;
    }
}

export async function captureTinySAScreen(device: SerialDevice, onStatus?: (status: string) => void): Promise<string | null> {
    if (isBusy) return null;
    isBusy = true;
    
    const { writer } = device;
    
    try {
        if (onStatus) onStatus('Clearing buffer...');
        await clearBuffer(device);

        if (onStatus) onStatus('Sending capture command...');
        const command = "capture\r";
        const encoder = new TextEncoder();
        await writer.write(encoder.encode(command));

        let receivedBytes = 0;
        let totalBmpBytes = 153654; // Default for TinySA
        const chunks: Uint8Array[] = [];
        let foundBM = false;
        let accumulated = new Uint8Array(0);

        let timeoutId: any;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('TinySA Capture Timeout')), 30000);
        });

        const readPromise = (async () => {
            try {
                while (true) {
                    const { value, done } = await safeRead(device);
                    if (done) break;
                    
                    if (!foundBM) {
                        const merged = new Uint8Array(accumulated.length + value.length);
                        merged.set(accumulated);
                        merged.set(value, accumulated.length);
                        accumulated = merged;

                        let bmIndex = -1;
                        for (let i = 0; i < accumulated.length - 1; i++) {
                            if (accumulated[i] === 0x42 && accumulated[i+1] === 0x4D) {
                                bmIndex = i;
                                break;
                            }
                        }

                        if (bmIndex !== -1) {
                            foundBM = true;
                            const validData = accumulated.slice(bmIndex);
                            
                            // Try to read size from BMP header (offset 2, 4 bytes)
                            if (validData.length >= 6) {
                                const size = validData[2] | (validData[3] << 8) | (validData[4] << 16) | (validData[5] << 24);
                                if (size > 100000 && size < 1000000) {
                                    totalBmpBytes = size;
                                }
                            }
                            
                            chunks.push(validData);
                            receivedBytes += validData.length;
                            if (onStatus) onStatus(`Header found. Expecting ${totalBmpBytes} bytes...`);
                        } else {
                            if (onStatus) {
                                const hex = Array.from(accumulated.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ');
                                onStatus(`Searching... Got: ${hex}`);
                            }
                        }
                    } else {
                        chunks.push(value);
                        receivedBytes += value.length;
                        if (onStatus && receivedBytes % 10000 < value.length) {
                            onStatus(`Receiving: ${Math.round((receivedBytes / totalBmpBytes) * 100)}%`);
                        }
                    }
                    
                    if (foundBM && receivedBytes >= totalBmpBytes) break;
                }
            } finally {
                clearTimeout(timeoutId);
            }
        })();

        try {
            await Promise.race([readPromise, timeoutPromise]);
        } catch (err) {
            try { await device.reader?.cancel(); } catch (e) {}
            try { await readPromise; } catch (e) {}
            throw err;
        }

        if (receivedBytes < totalBmpBytes) {
            if (onStatus) onStatus(`Incomplete data: ${receivedBytes}/${totalBmpBytes}`);
            return null;
        }

        if (onStatus) onStatus('Processing image...');
        const fullData = new Uint8Array(totalBmpBytes);
        let offset = 0;
        for (const chunk of chunks) {
            const toCopy = Math.min(chunk.length, totalBmpBytes - offset);
            fullData.set(chunk.slice(0, toCopy), offset);
            offset += toCopy;
            if (offset >= totalBmpBytes) break;
        }

        const blob = new Blob([fullData], { type: 'image/bmp' });
        return new Promise((resolve) => {
            const fileReader = new FileReader();
            fileReader.onloadend = () => {
                if (onStatus) onStatus('Done');
                resolve(fileReader.result as string);
            };
            fileReader.readAsDataURL(blob);
        });
    } catch (error: any) {
        let message = error.message;
        if (message.includes('The port is closed')) {
            message = 'TinySA device disconnected. Please reconnect the device.';
        }
        console.error('TinySA Capture Error:', message);
        if (onStatus) onStatus(`Error: ${message}`);
        return null;
    } finally {
        isBusy = false;
    }
}

export function generateMockScanData(startFreq: number, endFreq: number, points: number = 200): ScanDataPoint[] {
    const data: ScanDataPoint[] = [];
    const step = (endFreq - startFreq) / points;
    
    // Create some "TV Channels" with higher noise
    const noiseBands = [
        { center: 500, width: 8, amp: -65 },
        { center: 550, width: 8, amp: -50 },
        { center: 620, width: 8, amp: -75 },
        { center: 680, width: 8, amp: -60 }
    ];

    for (let i = 0; i <= points; i++) {
        const freq = startFreq + i * step;
        // Base noise floor with high-frequency jitter
        let amp = -108 + Math.random() * 4; 

        noiseBands.forEach(band => {
            if (freq >= band.center - band.width/2 && freq <= band.center + band.width/2) {
                // Add structured noise within TV bands
                const dist = Math.abs(freq - band.center) / (band.width / 2);
                const shape = Math.cos(dist * Math.PI / 2);
                amp = band.amp + (shape * 15) + (Math.random() * 8);
            }
        });

        // Add some random spikes (mics) that persist or flicker
        if (Math.random() > 0.99) {
            amp = -35 + Math.random() * 15;
        }

        data.push({ freq, amp });
    }

    return data;
}
