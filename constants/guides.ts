
import { AppCategory } from '../types';

export interface GuideSection {
    title: string;
    description: string;
    steps: string[];
    tips: string[];
    physics?: string;
}

export const CATEGORY_GUIDES: Record<AppCategory, GuideSection[]> = {
    calculator: [
        {
            title: "The Analytical Workspace vs. Standard Calculators",
            description: "Most web-based RF tools use static 'one-size-fits-all' guard bands that lead to spectral waste. Our Analytical Workspace performs real-time combinatorial analysis, modeling every possible carrier interaction. This creates a 'Virtual Spectrum' where you can stress-test high-density plans against the laws of non-linear physics before a single transmitter is powered on.",
            steps: [
                "Enter frequencies with 1Hz precision to model exact hardware tuning.",
                "Assign labels to map your digital twin to physical rack positions.",
                "Utilize 'Linear Mode' for modern digital systems like Shure Axient, bypassing legacy IMD floors to increase yield by up to 40%.",
                "Run the Audit to visualize SNR (Signal-to-Noise Ratio) probability."
            ],
            tips: [
                "Use the 'Seed' function to reset to scientifically vetted guard parameters.",
                "Take snapshots to iterate through multiple 'What-If' scenarios without losing your baseline."
            ],
            physics: "The engine models the 3rd-order 'Ghost Signals' (2f1-f2 and f1+f2-f3) generated in the non-linear junctions of antenna multicouplers and receiver front-ends. By calculating the power sum of these products, we predict interference probability with laboratory accuracy."
        },
        {
            title: "Monte Carlo Stochastic Seeking",
            description: "When the spectral puzzle exceeds human capacity, our engine employs a Monte Carlo search algorithm. While other tools use 'Brute Force' which often hits dead ends in crowded spectrum, our engine seeks the 'Path of Least Resistance', finding solutions that maintain the highest possible Signal-to-Noise headroom for every channel.",
            steps: [
                "Define 'Immutable' constraints—fixed frequencies that the engine must work around.",
                "Set your target yield. The engine will run 5,000 internal trials per request.",
                "Monitor the 'Yield vs. Density' ledger to identify which equipment profiles are causing spectral bottlenecks."
            ],
            tips: [
                "If yield is low, try 'Aggressive' spacing for non-critical channels like tech-comms.",
                "Our 'Symmetry Logic' ensures that even in high-density modes, your carriers remain centered in their assigned filters."
            ]
        }
    ],
    coordination: [
        {
            title: "Spatiotemporal Site Architecture",
            description: "Standard planners treat a venue as a single point in space; we treat it as a physical landscape. By defining the distance between stages, the engine applies the Inverse Square Law to 'Recycle' frequencies. This allows for massive frequency reuse across a site that would be mathematically impossible in a non-spatial coordinator.",
            steps: [
                "Use the 'Spatial Map' to drag-and-drop stages onto your site diagram.",
                "Configure 'Time Overlap' buffers. Frequencies are automatically released and recycled the moment an act finishes their set.",
                "The engine calculates a unique 'Interference Matrix' for every stage-to-stage pair based on distance-weighted attenuation."
            ],
            tips: [
                "Distance is your best filter. A stage 500m away is effectively invisible to your local receivers, allowing 100% frequency reuse.",
                "Use 'Compatibility Links' for stages that share an antenna backbone or are within the same 'RF Line of Sight'."
            ],
            physics: "The coordinator models signal propagation using the Friis Transmission Equation. As distance increases, the interference energy drops below the 'Capture Effect' threshold of the receiver (approx. 18.75kHz for high-quality FM/Digital), allowing for the safe deployment of overlapping carriers at range."
        }
    ],
    multizone: [
        {
            title: "High-Density Architectural Coordination",
            description: "Designed for exhibition halls and corporate campuses where hundreds of channels must exist within a small footprint. This module treats every booth or room as an 'RF Island', utilizing structural shielding and proximity logic to squeeze more gear into the air than any other tool available on the web.",
            steps: [
                "Grid your venue map. Proximity between adjacent booths is the primary source of 'Walk-over' interference.",
                "Deploy 'Cloned Groups' to quickly assign standard gear racks to multiple locations.",
                "Apply 'Proximity Guard' values—typically 10m for indoor environments with standard partition walls."
            ],
            tips: [
                "Coordination for trade shows is a battle of 'SNR Protection' rather than total IMD elimination.",
                "The 'WWB Group Export' allows you to provide each exhibitor with their own custom, pre-validated frequency file."
            ]
        }
    ],
    analysis: [
        {
            title: "Visual Verification Laboratory",
            description: "A high-fidelity bridge between your mathematical plan and the physical reality of the airwaves. While most tools show static lines, our 'Live Trace' simulation models real-world carrier skirts and noise floors. View your 'Ghost Products' overlaid on real-world noise for instant troubleshooting of onsite anomalies.",
            steps: [
                "Import CSV/TXT scan data from handheld scanners like RF Explorer or TinySA.",
                "Toggle 'Load Gen' to see where your coordinated carriers sit relative to the noise floor.",
                "Enable '2-Tone' and '3-Tone' overlays. If an IMD line matches a real-world energy spike, your hardware is mixing.",
                "Use 'Peak Hold' to catch intermittent 'Rogue' interference from roving ENG crews or bad cables."
            ],
            tips: [
                "Use 'Snap-to-Signal' tooltips for precise, Hz-level investigation of interference spikes.",
                "Narrow your span to <1MHz to check the skirts of your digital carriers for 'Slope Leakage'."
            ]
        }
    ],
    comms: [
        {
            title: "Talkback & The 25m Spatial Rule",
            description: "Communication systems are the 'Victims' of the RF world. Because base station transmitters are often high-power (up to 2W) and continuous, intermodulation is a severe risk. Based on empirical field tests, mixing efficiency for IMD drops below the noise floor beyond 25m of separation. This app automatically 'Relaxes' constraints for zones outside this boundary, allowing for extreme spectral density.",
            steps: [
                "Set your 'Base Tx' (to beltpacks) and 'Port Rx' (back to base) bands.",
                "Ensure 'Zone Distances' reflect the physical reality of your compound.",
                "Audit the results with the 'Intermod Physics Auditor' to visualize the 3rd-order collision space."
            ],
            tips: [
                "Receiver sensitivity is your priority. A -95dBm IMD product can break the squelch of a base station and cause 'Static' noise.",
                "Maintain at least 150kHz of offset between base TX carriers to minimize heat build-up and non-linear mixing in antenna combiners."
            ],
            physics: "Mixing efficiency follows a non-linear power curve. At 25m, the energy from a 50mW beltpack has dropped by approx. 53dB compared to the level at 10cm. This is the 'Conversion Loss' boundary: if aggressor signals reach the non-linear stage at levels below -40dBm, the resulting IMD products sit safely below the thermal noise floor of professional receivers."
        },
        {
            title: "The Physics of Frequency Reuse Offsets",
            description: "Harness the power of precision frequency offsets based on real-world ACR (Adjacent Channel Rejection) measurements. Not all reuse is equal; we use specific scientific benchmarks to determine the minimum safe distance for different frequency offsets.",
            steps: [
                "25kHz Offset: The 'Critical Limit'. Requires >400m of separation due to standard receiver filter slopes.",
                "50kHz - 100kHz Offset: The 'Buffer Zone'. Safe for stages 75m to 150m apart.",
                "150kHz Offset: The 'Reuse Sweet Spot'. Our measurements show this provides ~40dB of isolation advantage, allowing reuse at only 25m."
            ],
            tips: [
                "Use the 150kHz rule to pack 'Wireless Intercom' channels on separate trucks in a dense OB compound.",
                "Check the 'Audit Ledger' to see which 'Spatial Rejections' occurred—this highlights your site's physical bottlenecks."
            ],
            physics: "These methods are derived from the 'Capture Effect' of FM and digital signals. By ensuring the interfering signal is at least 20dB below the wanted signal at a given frequency offset, the receiver can successfully 'Capture' and demodulate the clean audio without interference."
        }
    ],
    toolkit: [
        {
            title: "High-Fidelity Physics Simulators",
            description: "A sandbox for visualizing complex RF interactions. These tools allow you to 'See' the invisible energy interactions that cause hardware failure.",
            steps: [
                "Co-Channel Lab: Drag the interferer to see the 'Capture Effect' radius. Toggle the Wanted Mic ON/OFF to see how squelch dynamics change.",
                "IMD Physics Demo: Manipulate three source carriers and watch as 3rd-order intermod products 'grow' and 'shrink' in the spectrum.",
                "Proximity Simulator: Model high-density OB compounds. Move trucks and antennas to see how spatial isolation prevents transmitter mixing."
            ],
            tips: [
                "The Co-Channel Lab is the best way to explain 'Safe Separation' to stage managers.",
                "In the IMD Demo, cluster the frequencies close together to see the exponential increase in spectral congestion."
            ],
            physics: "These sims model 3rd Order Intermodulation (2f1-f2) and the conversion loss of non-linear junctions. We use a 3dB slope for IMD growth—for every 1dB increase in transmitter power, the IMD product grows by 3dB."
        },
        {
            title: "RF Link & Path Planning",
            description: "Authoritative calculators for mission-critical link engineering. Use these to validate your antenna placements before deployment.",
            steps: [
                "Link Budget: Account for every dB in your signal chain—from TX power and cable loss to free-space attenuation and RX sensitivity.",
                "FSPL: Calculate the 'Natural' thinning of signal over distance in clear air.",
                "Line of Sight: Determine if the Earth's curvature will block your signal. This uses the 4/3 Earth Radius model for atmospheric refraction."
            ],
            tips: [
                "A 'Link Margin' of 12dB is the industry standard for stable professional wireless.",
                "Remember that cable loss often accounts for more signal drop than the air gap itself in short runs."
            ],
            physics: "Path loss is calculated using the Friis Transmission Equation: Pr = Pt + Gt + Gr + 20log10(λ/4πd). The Line of Sight tool accounts for the 'Radio Horizon', which is roughly 15% further than the visual horizon due to atmospheric refraction."
        },
        {
            title: "Antenna & Line Diagnostics",
            description: "Engineering utilities for hardware health and placement optimization.",
            steps: [
                "Diversity Spacing: Find the exact physical distance (m/cm) for antenna placement based on the wavelength (λ) of your frequency.",
                "Antenna Down-Tilt: Use trigonometry to calculate the correct mechanical tilt for targeted coverage on a field or audience area.",
                "VSWR & Return Loss: Convert reflected power measurements into health metrics for your antenna feed lines."
            ],
            tips: [
                "Spacing antennas at 1λ (full wavelength) provides the most reliable decorrelation for diversity systems.",
                "High VSWR (>2.0:1) usually indicates a faulty connector, water in the cable, or a crushed shield."
            ],
            physics: "Diversity logic is based on the 'Spatial Correlation Coefficient'. Antennas spaced at 1/2 wavelength begin to see different phase states, while 1 wavelength provides enough separation for the signals to be considered 'uncorrelated' in most multipath environments."
        }
    ],
    hardware: [
        {
            title: "The Authoritative Logic Library",
            description: "Manage the 'Physics Profiles' of your gear. Unlike tools that hide their logic, we give you full control over the engine's 'Brain'. Define how aggressive your guards should be based on your specific deployment environment.",
            steps: [
                "Customize 'FF Guard' (Fundamental-to-Fundamental). Standard is 350kHz for analogue, 200kHz for digital.",
                "Set IMD guards—100kHz for 'Robust' touring, 50kHz for 'Aggressive' festival environments.",
                "Use the 'Global Patch' to add a safety buffer to your entire inventory before a high-stakes show."
            ],
            tips: [
                "The 'Permanent Inventory' (USER_INVENTORY) in the source code is your touring 'Bible'. Hardcode your rack there to bypass browser cache clears.",
                "High-end digital systems like Sennheiser D6000 or Shure AD can often operate with 'Zero' 3-Tone guard if linear mode is properly configured."
            ]
        }
    ],
    tour: [
        {
            title: "Touring Synchronization Engine",
            description: "Designed for acts traveling across multiple regions with a fixed equipment rack. This module distinguishes between 'Constant Transmits' (gear that stays the same every day) and 'Local Requirements' (gear that adapts to the local RF environment).",
            steps: [
                "Define your 'Constant Transmits'—these are coordinated first and remain locked across all tour stops.",
                "Add 'Tour Stops' for every venue on your itinerary.",
                "Group stops into 'Clusters' if they share the same RF environment (e.g., multiple shows in the same city).",
                "Configure local TV channel white space for each cluster to ensure legal compliance at every stop."
            ],
            tips: [
                "Constant Transmits are the 'Anchor' of your tour. Ensure they are coordinated with 'Robust' spacing to handle varying noise floors.",
                "Use the 'Calculate Tour Plan' button to run a global coordination that respects your global constants while optimizing for local white space."
            ],
            physics: "The engine uses a tiered coordination approach. Tier 1 (Constants) is calculated as a site-wide immutable block. Tier 2 (Local) is then calculated using the Tier 1 block as fixed aggressors, while also respecting the local TV channel masks defined for that specific cluster."
        }
    ],
    wmas: [
        {
            title: "WMAS Coordination",
            description: "Wireless Multichannel Audio Systems (WMAS) use wideband blocks instead of narrowband carriers. This module helps you allocate these blocks efficiently.",
            steps: [
                "Define your WMAS Nodes (e.g., 'Main Stage WMAS').",
                "Select a profile (e.g., Sennheiser 6MHz or 8MHz).",
                "Choose a mode (Low Latency, Standard, High Density) which affects link capacity.",
                "Use 'Auto-Assign' to find available blocks based on TV channel availability and spectrum data."
            ],
            tips: [
                "WMAS blocks are treated as exclusions for narrowband systems to prevent interference.",
                "Ensure your TV channel data is accurate for the location."
            ]
        }
    ]
};
