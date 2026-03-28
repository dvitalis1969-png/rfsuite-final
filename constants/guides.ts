
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
            title: "Festival Coordination: The Masterclass",
            description: "Welcome to the pinnacle of large-scale RF planning. Standard calculators treat your entire festival site as a single, crowded room, leading to artificial spectrum exhaustion. We built this engine differently. We treat your venue as a physical, spatiotemporal landscape. By understanding the exact distances between your stages and the times acts are performing, our engine 'recycles' frequencies, achieving massive reuse that would otherwise be mathematically impossible. Prepare to coordinate like a true RF architect.",
            steps: [
                "1. INITIALIZE STAGES: Scroll to the 'Stages / Zones' section. Click the '+ Add Stage' button. Provide a unique name (e.g., 'Main Stage', 'Acoustic Tent'). Repeat for every physical location.",
                "2. POPULATE EQUIPMENT: For each stage, click '+ Add Equipment'. Select the exact Make and Model from our database. Enter the number of channels required. Our engine automatically loads the 'Physics Profile' for each device, including filter width and IMD characteristics.",
                "3. MAP THE VENUE: Scroll to the 'Distance Matrix (m)'. This is the most critical step. Enter the physical distance (in meters) between every stage pair. Accurate distances are vital—the engine uses the Inverse Square Law to calculate signal attenuation between stages.",
                "4. DEFINE TEMPORAL OVERLAP: Use the 'Time Overlap' feature to indicate if stages are active simultaneously. If stages are never active at the same time, the engine will automatically recycle frequencies, doubling your capacity.",
                "5. SET GLOBAL CONSTRAINTS: Go to 'TV Channel & Global Exclusions'. Select your region to automatically block active local DTV broadcasts. Use 'Manual Exclusions' to lock out specific frequencies (e.g., venue security, local emergency services).",
                "6. INJECT FIXED FREQUENCIES: If touring bands bring their own locked gear, use 'Fixed Frequency Injections' to force the engine to work around their immovable frequencies.",
                "7. EXECUTE COORDINATION: Click the 'GENERATE FESTIVAL PLAN' button. Our Monte Carlo stochastic algorithm will run thousands of simulations to find the plan with the highest possible Signal-to-Noise Ratio (SNR) headroom.",
                "8. REVIEW & EXPORT: Once the calculation finishes, review the 'Coordination Results' dashboard. When satisfied, click 'Export CSV' to generate the master frequency plan for your stage managers."
            ],
            tips: [
                "The 500m Rule: A stage 500m away is effectively invisible to local receivers. Maximize your distance matrix to unlock 100% frequency reuse.",
                "If the engine struggles, try changing the Global Settings 'Compatibility Profile' to 'Robust' (safer, fewer freqs) or 'Aggressive' (tighter spacing, more freqs).",
                "Use 'Compatibility Links' for stages that share an antenna backbone or are within the same 'RF Line of Sight'."
            ],
            physics: "We model signal propagation using the Friis Transmission Equation. As distance increases, interference energy drops exponentially. Once an aggressor signal drops below the 'Capture Effect' threshold of the victim receiver (approx. 18.75kHz for high-quality FM/Digital), the receiver completely ignores it. We calculate a unique 'Interference Matrix' for every stage-to-stage pair based on this distance-weighted attenuation, dynamically relaxing IMD constraints where physics allows."
        }
    ],
    multizone: [
        {
            title: "Exhibition & High-Density Coordination: The Masterclass",
            description: "Trade shows, corporate campuses, and exhibition halls are RF warzones. You are tasked with cramming hundreds of wireless channels into a single building, often with exhibitors bringing rogue, uncoordinated gear. This module is your ultimate weapon. It treats every booth or breakout room as an isolated 'RF Island', utilizing structural shielding and proximity logic to squeeze more gear into the air than any standard calculator could ever permit.",
            steps: [
                "1. DEFINE ZONES: Scroll to 'Exhibition Zones & Booths'. Click '+ Add Zone' for every booth, breakout room, or area requiring wireless. Name them clearly (e.g., 'Booth 101', 'Room A').",
                "2. CONFIGURE EQUIPMENT: Add equipment to each zone. If you are deploying 20 identical breakout rooms, use the 'Clone Group' feature to instantly duplicate your standard gear rack across multiple zones—saving you hours of manual entry.",
                "3. DEFINE PROXIMITY: Scroll to the 'Distance Matrix (m)'. In indoor environments, walls and structures absorb RF energy. Enter the physical distances between booths. The engine uses this to calculate 'Walk-over' interference, allowing booths that are far apart to safely reuse the same spectrum.",
                "4. LOCK VIP FREQUENCIES: If a major exhibitor arrives with a rack of gear locked to specific frequencies, use 'Fixed Frequency Injections' to assign their exact frequencies to their zone. The engine will seamlessly weave the rest of the show around them.",
                "5. SET GLOBAL EXCLUSIONS: Block out local DTV channels in the 'TV Channel' section. Use 'Manual Exclusions' to globally ban specific frequencies (like venue-wide security comms) from being assigned to any booth.",
                "6. EXECUTE CALCULATION: Click 'GENERATE MULTI-EQUIPMENT PLAN'. The engine will perform a highly aggressive, high-density combinatorial analysis, prioritizing Signal-to-Noise Ratio (SNR) protection over total IMD elimination—the only way to survive a trade show.",
                "7. EXPORT INDIVIDUAL PLANS: The master CSV is great for you, but exhibitors only care about their own gear. Use the 'WWB Group Export' or individual zone exports to hand each booth their own custom, pre-validated frequency file."
            ],
            tips: [
                "Use the 'Global Separation' tool above the Distance Matrix to quickly set a default baseline distance (e.g., 15m) between all booths, then manually adjust the adjacent ones.",
                "Coordination for trade shows is a battle of 'SNR Protection'. The noise floor is incredibly high. Ensure your transmitters are close to their receivers to overcome the ambient RF hash.",
                "If you run out of spectrum, switch your digital gear to 'Linear Mode' (if supported, like Shure Axient). This bypasses legacy IMD floors and increases yield by up to 40%."
            ],
            physics: "This module relies on Free-Space Path Loss (FSPL) combined with structural attenuation assumptions. By calculating the energy drop-off between booths, the engine determines the exact moment a signal from Booth A drops below the noise floor of Booth B. Once that threshold is crossed, the engine safely reassigns that exact same frequency to Booth B, maximizing spectral efficiency."
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
        },
        {
            title: "Visual Tuning Preview",
            description: "The Preview button allows you to visualize the theoretical intermodulation (IMD) footprint of a specific equipment profile before you even deploy it. This helps you stress-test your frequency plan against potential interference.",
            steps: [
                "Ensure you have active frequencies in your analyzer to see the IMD interactions.",
                "Navigate to the Equipment Library.",
                "Find the equipment profile you want to test and click 'Preview'.",
                "Switch to the Analyzer tab in the Real-time Analysis module.",
                "Observe the dashed 'ghost' markers on the spectrum analyzer canvas—these represent the IMD products generated by the previewed equipment.",
                "Use this to identify potential interference with your active frequencies."
            ],
            tips: [
                "Ensure you have active frequencies in your analyzer to see the IMD interactions.",
                "Use the status bar at the top of the Analyzer to clear the preview when you're done."
            ],
            physics: "The preview models 3rd-order IMD products (2f1-f2 and f1+f2-f3) generated by the interaction between the previewed frequency and your existing active carriers."
        }
    ],
    comms: [
        {
            title: "Talkback & Zonal Comms: The Masterclass",
            description: "Communication systems (like Riedel Bolero, Clear-Com, or analog two-ways) are the 'bullies' of the RF world. Their base stations transmit continuously at incredibly high power (often up to 2 Watts). If placed too close to your delicate wireless microphones, they will generate massive intermodulation products that destroy your audio. This module is engineered specifically to isolate and coordinate these high-power systems, keeping your comms crystal clear and your microphones safe.",
            steps: [
                "1. DEFINE BANDS: At the top, define your 'Base TX Band' (the frequencies the base station blasts out to the beltpacks) and your 'Port RX Band' (the frequencies the beltpacks whisper back to the base). Keep these bands as far apart as physically possible.",
                "2. CONFIGURE ZONES: Scroll to 'Talkback Zones'. For a single setup, just use one zone. For massive events (Olympics, multi-stage festivals), click '+ Add Zone' for every physical location that has a base station (e.g., 'Main Stage Comms', 'Broadcast Compound').",
                "3. ADD CHANNELS: Inside each Zone, click '+ Add TX' for your continuous base station transmitters, and '+ Add RX' for your beltpack receivers.",
                "4. DEFINE PROXIMITY: Scroll to the 'Distance Matrix (m)' and enter the physical distance between your comms zones. This is critical for our 'IMD Compatibility Relaxation' algorithm. If two base stations are more than 25 meters apart, the engine can drastically relax the spacing rules and reuse spectrum.",
                "5. SET GLOBAL EXCLUSIONS: Block out local DTV channels and enter any 'Manual Exclusions' (like local police or aviation frequencies) that you must absolutely avoid.",
                "6. EXECUTE CALCULATION: Click 'GENERATE ZONAL PLAN'. The engine will calculate a master plan that reuses frequencies across distant zones while keeping local zones completely, mathematically intermod-free.",
                "7. EXPORT RESULTS: Review the 'Coordination Results' for a zone-by-zone breakdown, and export your CSV for deployment."
            ],
            tips: [
                "Receiver sensitivity is your priority. A tiny -95dBm IMD product can break the squelch of a base station and cause maddening 'Static' noise in everyone's headset. Give your RX band the cleanest spectrum.",
                "Maintain at least 150kHz of offset between base TX carriers. This minimizes heat build-up and non-linear mixing inside your expensive antenna combiners.",
                "Distance is your ultimate weapon. Moving a base station antenna just 10 meters further away from your microphone receivers can solve 90% of your intermod problems."
            ],
            physics: "Mixing efficiency follows a non-linear power curve. At 25 meters, the energy from a 50mW beltpack has dropped by approximately 53dB compared to its level at 10cm. This is the 'Conversion Loss Boundary'. If aggressor signals reach the non-linear stage (the receiver front-end) at levels below -40dBm, the resulting 3rd-order IMD products sit safely below the thermal noise floor of professional receivers. Our engine dynamically calculates this boundary, relaxing IMD constraints for distant zones to unlock unprecedented spectral density."
        },
        {
            title: "The Physics of Frequency Reuse Offsets",
            description: "Harness the power of precision frequency offsets based on real-world Adjacent Channel Rejection (ACR) measurements. Not all reuse is equal; we use specific scientific benchmarks to determine the minimum safe distance for different frequency offsets.",
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
        },
        {
            title: "Visual Tuning Preview",
            description: "The Preview button allows you to visualize the theoretical intermodulation (IMD) footprint of a specific equipment profile before you even deploy it. This helps you stress-test your frequency plan against potential interference.",
            steps: [
                "Ensure you have active frequencies in your analyzer to see the IMD interactions.",
                "Navigate to the Equipment Library.",
                "Find the equipment profile you want to test and click 'Preview'.",
                "Switch to the Analyzer tab in the Real-time Analysis module.",
                "Observe the dashed 'ghost' markers on the spectrum analyzer canvas—these represent the IMD products generated by the previewed equipment.",
                "Use this to identify potential interference with your active frequencies."
            ],
            tips: [
                "Ensure you have active frequencies in your analyzer to see the IMD interactions.",
                "Use the status bar at the top of the Analyzer to clear the preview when you're done."
            ],
            physics: "The preview models 3rd-order IMD products (2f1-f2 and f1+f2-f3) generated by the interaction between the previewed frequency and your existing active carriers."
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
    ],
    network: [
        {
            title: "Community Network",
            description: "Connect with other RF professionals, share knowledge, and collaborate on projects.",
            steps: [
                "Post updates, questions, or share RF plots.",
                "Like and comment on posts from other users.",
                "Attach images or select plots from your gallery to share."
            ],
            tips: [
                "Engage with the community to learn new techniques and best practices.",
                "Share your successful coordination plots to help others."
            ]
        }
    ]
};
