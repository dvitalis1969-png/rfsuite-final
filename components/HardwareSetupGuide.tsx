import React from 'react';

export const HardwareSetupGuide: React.FC = () => {
    return (
        <div className="bg-slate-900 p-6 rounded-xl border border-indigo-500/30 shadow-lg text-slate-300">
            <h2 className="text-xl font-black text-white uppercase tracking-widest mb-6">Hardware Setup & Troubleshooting</h2>
            
            <div className="space-y-6">
                <section>
                    <h3 className="text-sm font-bold text-indigo-400 uppercase mb-2">1. Prerequisites</h3>
                    <ul className="list-disc list-inside text-xs space-y-1 text-slate-400">
                        <li>A TinySA, TinySA Ultra, or RF Explorer.</li>
                        <li>A high-quality USB data cable (charging-only cables will not work).</li>
                        <li>A Chromium-based browser (Google Chrome, Microsoft Edge, Brave, or Opera).</li>
                        <li>For RF Explorer: Ensure you have the Silicon Labs CP210x USB to UART Bridge drivers installed.</li>
                    </ul>
                </section>

                <section className="bg-rose-900/10 border border-rose-500/20 p-4 rounded-lg">
                    <h3 className="text-sm font-bold text-rose-400 uppercase mb-2">⚠️ Mandatory Device Configuration</h3>
                    <div className="space-y-4">
                        <div>
                            <p className="text-xs font-bold text-slate-200 mb-1">TinySA:</p>
                            <p className="text-xs text-slate-300 mb-2">For the app to communicate with your TinySA, it must be in <strong>USB mode</strong>.</p>
                            <ol className="list-decimal list-inside text-xs space-y-1 text-slate-400">
                                <li>On your TinySA screen, tap <strong>CONFIG</strong>.</li>
                                <li>Tap <strong>SERIAL</strong>.</li>
                                <li>Ensure it is set to <strong>USB</strong>.</li>
                                <li>If it was set to "SERIAL", change it to "USB" and reboot the device if prompted.</li>
                            </ol>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-200 mb-1">RF Explorer:</p>
                            <p className="text-xs text-slate-300 mb-2">Ensure your RF Explorer is powered on and connected via USB. The app uses a <strong>500,000 baud rate</strong> for communication.</p>
                        </div>
                    </div>
                </section>

                <section>
                    <h3 className="text-sm font-bold text-indigo-400 uppercase mb-2">2. Connecting to the App</h3>
                    <ol className="list-decimal list-inside text-xs space-y-1 text-slate-400">
                        <li>Plug your TinySA into your computer via USB.</li>
                        <li>Click the <strong>"Connect"</strong> button in the app.</li>
                        <li>A browser popup will appear. Select your device (usually "USB Serial Device") and click <strong>"Connect"</strong>.</li>
                        <li>Once connected, the app will automatically wake the device and begin streaming data.</li>
                    </ol>
                </section>

                <section>
                    <h3 className="text-sm font-bold text-indigo-400 uppercase mb-2">3. Troubleshooting</h3>
                    <div className="text-xs space-y-2 text-slate-400">
                        <p><strong>"I click Connect, but nothing happens":</strong> Check your browser (must be Chrome/Edge/Opera) and ensure you are using a data-capable USB cable.</p>
                        <p><strong>"The device connects, but I see no data":</strong> Double-check the TinySA USB mode setting (CONFIG → SERIAL → USB). This is the #1 cause of this issue.</p>
                        <p><strong>"Permission Denied":</strong> Ensure no other software is currently using the TinySA port.</p>
                    </div>
                </section>
            </div>
        </div>
    );
};
