import { EquipmentProfile, CompatibilityLevel } from './types';

export const WMAS_PRESET_PROFILES: any[] = [
    {
        id: 'generic-6mhz',
        name: 'Generic WMAS (6 MHz)',
        bandwidthMHz: 6,
        maxLinks: {
            'low-latency': 16,
            'standard': 32,
            'high-density': 64
        }
    },
    {
        id: 'generic-8mhz',
        name: 'Generic WMAS (8 MHz)',
        bandwidthMHz: 8,
        maxLinks: {
            'low-latency': 24,
            'standard': 48,
            'high-density': 96
        }
    }
];

export const US_TV_CHANNELS: Record<number, [number, number]> = {
    21: [512, 518], 22: [518, 524], 23: [524, 530], 24: [530, 536],
    25: [536, 542], 26: [542, 548], 27: [548, 554], 28: [554, 560],
    29: [560, 566], 30: [566, 572], 31: [572, 578], 32: [578, 584],
    33: [584, 590], 34: [590, 596], 35: [596, 602], 36: [602, 608],
};

export const UK_TV_CHANNELS: Record<number, [number, number]> = {
    21: [470, 478], 22: [478, 486], 23: [486, 494], 24: [494, 502],
    25: [502, 510], 26: [510, 518], 27: [518, 526], 28: [526, 534],
    29: [534, 542], 30: [542, 550], 31: [550, 558], 32: [558, 566],
    33: [566, 574], 34: [574, 582], 35: [582, 590], 36: [590, 598],
    37: [598, 606], 38: [606, 614], 39: [614, 622], 40: [622, 630],
    41: [630, 638], 42: [638, 646], 43: [646, 654], 44: [654, 662],
    45: [662, 670], 46: [670, 678], 47: [678, 686], 48: [686, 694], 49: [694, 702]
};

/**
 * --- YOUR PERMANENT INVENTORY (HARDCODED) ---
 */
export const USER_INVENTORY: Record<string, EquipmentProfile> = {
    'my-bespoke-mic-1': { 
        name: 'My Custom Mic Rack', 
        band: '470-608 MHz', 
        minFreq: 470.125, 
        maxFreq: 607.875, 
        tuningStep: 0.025, 
        type: 'mic', 
        isCustom: false,
        recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 } 
    },
    'my-bespoke-iem-1': { 
        name: 'My Custom IEM Rack', 
        band: '606-698 MHz', 
        minFreq: 606.125, 
        maxFreq: 697.875, 
        tuningStep: 0.025, 
        type: 'iem', 
        isCustom: false,
        recommendedThresholds: { fundamental: 0.375, twoTone: 0.250, threeTone: 0.050 } 
    },
};

/**
 * STRICT REGULATORY BLOCKADES (Talkback/Comms Modules)
 * Includes band edge frequencies.
 */
export const TALKBACK_FORBIDDEN_RANGES: { min: number, max: number }[] = [
    { min: 450.46875, max: 450.76875 },
    { min: 452.19375, max: 452.26875 },
    { min: 452.41875, max: 452.43125 },
    { min: 452.51875, max: 452.83125 },
    { min: 465.48125, max: 466.14375 },
    { min: 466.20625, max: 466.33125 },
    { min: 466.44375, max: 466.56875 },
    { min: 466.69375, max: 466.73125 }
];

export const TALKBACK_DEFINITIONS: Record<number, { min: number, max: number }> = {
    425: { min: 425.31875, max: 425.55625 },
    427: { min: 427.76875, max: 428.00625 },
    442: { min: 442.26875, max: 442.50625 },
    446: { min: 446.43125, max: 446.99375 },
    450: { min: 450.20625, max: 450.99375 },
    451: { min: 451.00625, max: 451.93125 },
    452: { min: 452.00625, max: 452.99325 },
    455: { min: 455.25625, max: 455.46875 },
    457: { min: 457.25625, max: 457.46875 },
    465: { min: 465.00625, max: 465.46875 },
    466: { min: 466.15625, max: 466.78125 },
    467: { min: 467.26875, max: 467.99325 },
    468: { min: 468.00625, max: 468.99325 },
    469: { min: 469.00625, max: 469.41875 }
};

export const TALKBACK_FIXED_PAIRS: Record<number, number> = { 455: 468, 457: 467 };

export const DISCRETE_TALKBACK_PAIRS: Record<number, {tx: number, rx: number}[]> = {
    455: [
        { tx: 454.99375, rx: 468.36875 }, { tx: 455.00625, rx: 468.38125 }, { tx: 455.01875, rx: 468.04375 },
        { tx: 455.03125, rx: 468.05625 }, { tx: 455.09375, rx: 468.39375 }, { tx: 455.11875, rx: 468.41875 },
        { tx: 455.13125, rx: 468.43125 }, { tx: 455.19375, rx: 468.01875 }, { tx: 455.21875, rx: 468.49375 },
        { tx: 455.23125, rx: 468.50625 }, { tx: 455.28125, rx: 468.29375 }, { tx: 455.25625, rx: 468.19375 },
        { tx: 455.39375, rx: 468.33125 }, { tx: 455.41875, rx: 468.30625 }, { tx: 455.26875, rx: 468.18125 }
    ],
    457: [
        { tx: 457.25625, rx: 467.30625 }, { tx: 457.26875, rx: 467.31875 }, { tx: 457.28125, rx: 467.29375 },
        { tx: 457.29375, rx: 467.40625 }, { tx: 457.30625, rx: 467.36875 }, { tx: 457.31875, rx: 467.48125 },
        { tx: 457.33125, rx: 467.44375 }, { tx: 457.34375, rx: 467.38125 }, { tx: 457.35625, rx: 467.33125 },
        { tx: 457.36875, rx: 467.35625 }, { tx: 457.38125, rx: 467.45625 }, { tx: 457.39375, rx: 467.39375 },
        { tx: 457.40625, rx: 467.34375 }, { tx: 457.41875, rx: 467.49375 }, { tx: 457.43125, rx: 467.46875 },
        { tx: 457.44375, rx: 467.53125 }, { tx: 457.45625, rx: 467.51875 }, { tx: 457.46875, rx: 467.50625 }
    ]
};

export const CABLE_LOSS_DATA: Record<string, {name: string, data: Record<number, number>}> = {
    'RG-58': { name: 'RG-58/U', data: { 100: 4.5, 400: 10.1, 1000: 18.1 } },
    'RG-8X': { name: 'RG-8X (Mini-8)', data: { 100: 3.0, 400: 6.6, 1000: 12.0 } },
    'RG-213': { name: 'RG-213/U', data: { 100: 2.5, 400: 2.5, 1000: 9.8 } },
    'LMR-240': { name: 'Times Microwave LMR-240', data: { 150: 4.7, 450: 8.3, 900: 11.9 } },
    'LMR-400': { name: 'Times Microwave LMR-400', data: { 150: 2.7, 450: 4.8, 900: 6.8 } },
    'LMR-600': { name: 'Times Microwave LMR-600', data: { 150: 1.8, 450: 3.2, 900: 4.5 } },
};

export const COMPATIBILITY_PROFILES: Record<CompatibilityLevel, { label: string; fundamental: number; twoTone: number; threeTone: number; fiveTone: number; sevenTone: number; advanced: boolean; }> = {
    standard: { label: 'Standard', fundamental: 1.0, twoTone: 1.0, threeTone: 1.0, fiveTone: 1.0, sevenTone: 1.0, advanced: false },
    aggressive: { label: 'Aggressive', fundamental: 0.75, twoTone: 0.75, threeTone: 0.75, fiveTone: 1.0, sevenTone: 1.0, advanced: false },
    robust: { label: 'Robust', fundamental: 1.5, twoTone: 1.25, threeTone: 1.25, fiveTone: 1.25, sevenTone: 1.25, advanced: true },
};

/**
 * MASTER AUTHORITATIVE EQUIPMENT DATABASE
 * Updated Axient Digital and D6000 to 200kHz (0.200) Fundamental for High Density.
 */
export const EQUIPMENT_DATABASE: Record<string, EquipmentProfile> = {
    'custom': { name: 'Custom Range', band: 'User-defined', minFreq: 470.125, maxFreq: 697.875, tuningStep: 0.025, type: 'generic' },
    
    ...USER_INVENTORY,

    // --- SHURE AXIENT DIGITAL PSM (WMAS / NB) ---
    'shure-adpsm-g55': { name: 'Shure AD PSM', band: 'G55 (470-608 MHz)', minFreq: 470.125, maxFreq: 607.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 } },
    'shure-adpsm-g56': { name: 'Shure AD PSM', band: 'G56 (470-636 MHz)', minFreq: 470.125, maxFreq: 635.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 } },
    'shure-adpsm-x55': { name: 'Shure AD PSM (DME Adj)', band: 'X55 (941-960 MHz)', minFreq: 941.125, maxFreq: 959.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 } },
    'shure-adpsm-z16': { name: 'Shure AD PSM (1.2GHz)', band: 'Z16 (1240-1260 MHz)', minFreq: 1240.125, maxFreq: 1259.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 } },
    'shure-adpsm-z18': { name: 'Shure AD PSM (1.5GHz)', band: 'Z18 (1492-1525 MHz)', minFreq: 1492.125, maxFreq: 1524.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental:0.350, twoTone: 0.075, threeTone: 0.000 } },

    // --- SHURE AXIENT DIGITAL MIC (Linear Digital) ---
    'shure-ad-g56': { 
        name: 'Shure Axient Digital', 
        band: 'G56 (470-636 MHz)', 
        minFreq: 470.125, 
        maxFreq: 635.875, 
        tuningStep: 0.025, 
        type: 'mic', 
        recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 },
        affiliateUrl: 'https://www.sweetwater.com/shure-axient-digital/series'
    },
    'shure-ad-g57': { name: 'Shure Axient Digital', band: 'G57 (470-616 MHz)', minFreq: 470.125, maxFreq: 615.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 } },
    'shure-ad-k55': { name: 'Shure Axient Digital', band: 'K55 (606-694 MHz)', minFreq: 606.125, maxFreq: 693.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 } },
    'shure-ad-k4e': { name: 'Shure Axient Digital', band: 'K4E (606-666 MHz)', minFreq: 606.125, maxFreq: 665.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 } },

    // --- SHURE UR4S / UHF-R (Analogue) ---
    'shure-ur4s-g1': { name: 'Shure UR4S (Analogue)', band: 'G1 (470-530 MHz)', minFreq: 470.125, maxFreq: 529.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.325, twoTone: 0.175, threeTone: 0.05 } },
    'shure-ur4s-h4': { name: 'Shure UR4S (Analogue)', band: 'H4 (518-578 MHz)', minFreq: 518.125, maxFreq: 577.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.325, twoTone: 0.175, threeTone: 0.05 } },
    'shure-ur4s-k4e': { name: 'Shure UR4S (Analogue)', band: 'K4E (606-666 MHz)', minFreq: 606.125, maxFreq: 665.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.325, twoTone: 0.175, threeTone: 0.05 } },

    // --- SHURE ULX-D / QLX-D ---
    'shure-ulxd-g51': { name: 'Shure ULX-D', band: 'G51 (470-534 MHz)', minFreq: 470.125, maxFreq: 533.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 } },
    'shure-ulxd-k4e': { name: 'Shure ULX-D', band: 'K4E (606-666 MHz)', minFreq: 606.125, maxFreq: 665.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 } },
    'shure-ulxd-k51': { name: 'Shure ULX-D', band: 'K51 (606-670 MHz)', minFreq: 606.125, maxFreq: 669.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 } },
    'shure-ulxd-l50': { name: 'Shure ULX-D', band: 'L50 (632-696 MHz)', minFreq: 632.125, maxFreq: 695.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 } },
    'shure-ulxd-h50': { name: 'Shure ULX-D', band: 'H50 (534-598 MHz)', minFreq: 534.125, maxFreq: 597.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 } },

    // --- SHURE PSM 1000 / 900 ---
    'shure-psm1000-g10': { 
        name: 'Shure PSM 1000', 
        band: 'G10 (470-542 MHz)', 
        minFreq: 470.125, 
        maxFreq: 541.875, 
        tuningStep: 0.025, 
        type: 'iem', 
        recommendedThresholds: { fundamental: 0.375, twoTone: 0.250, threeTone: 0.050 },
        affiliateUrl: 'https://www.sweetwater.com/store/detail/P10T-G10--shure-p10t-wireless-transmitter-g10-band'
    },
    'shure-psm1000-j8E': { name: 'Shure PSM 1000', band: 'J8E (554-626 MHz)', minFreq: 554.125, maxFreq: 625.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.375, twoTone: 0.250, threeTone: 0.050 } },
    'shure-psm1000-k10E': { name: 'Shure PSM 1000', band: 'K10E (596-668 MHz)', minFreq: 596.125, maxFreq: 667.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.375, twoTone: 0.250, threeTone: 0.050 } },
    'shure-psm1000-l8': { name: 'Shure PSM 1000', band: 'L8 (626-698 MHz)', minFreq: 626.125, maxFreq: 697.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.375, twoTone: 0.250, threeTone: 0.050 } },
    'shure-psm900-l6E': { name: 'Shure PSM 900', band: 'L6E (656-692 MHz)', minFreq: 656.125, maxFreq: 691.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.375, twoTone: 0.275, threeTone: 0.050 } },
    'shure-psm900-k1E': { name: 'Shure PSM 900', band: 'K1E (596-632 MHz)', minFreq: 596.125, maxFreq: 631.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.375, twoTone: 0.275, threeTone: 0.050 } },
    
    // --- SENNHEISER DIGITAL 6000/9000 ---
    'sennheiser-d6000-a1a4': { name: 'Sennheiser Digital 6000', band: 'A1-A4 (470-558 MHz)', minFreq: 470.2, maxFreq: 557.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 } },
    'sennheiser-d6000-a5a8': { name: 'Sennheiser Digital 6000', band: 'A5-A8 (550-638 MHz)', minFreq: 550.125, maxFreq: 637.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 } },
    'sennheiser-d9000': { name: 'Sennheiser Digital 9000', band: '470-798 MHz', minFreq: 470.125, maxFreq: 797.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.35, twoTone: 0.050, threeTone: 0.000 } },

    // --- SENNHEISER 2000 SERIES MICS ---
    'sennheiser-2000-aw': { name: 'Sennheiser 2000 series', band: 'Aw (516-558 MHz)', minFreq: 516.125, maxFreq: 557.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.250, threeTone: 0.100 } },
    'sennheiser-2000-bw': { name: 'Sennheiser 2000 series', band: 'Bw (626-668 MHz)', minFreq: 626.125, maxFreq: 667.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.250, threeTone: 0.100 } },
    'sennheiser-2000-gw': { name: 'Sennheiser 2000 series', band: 'Gw (558-626 MHz)', minFreq: 558.125, maxFreq: 625.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.250, threeTone: 0.100 } },

    // --- SENNHEISER 2000 SERIES IEM ---
    'sennheiser-2000iem-aw': { name: 'Sennheiser 2000 IEM', band: 'Aw (516-558 MHz)', minFreq: 516.125, maxFreq: 557.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.400, twoTone: 0.250, threeTone: 0.100 } },
    'sennheiser-2000iem-bw': { name: 'Sennheiser 2000 IEM', band: 'Bw (626-668 MHz)', minFreq: 626.125, maxFreq: 667.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.400, twoTone: 0.250, threeTone: 0.100 } },
    'sennheiser-2000iem-gw': { name: 'Sennheiser 2000 IEM', band: 'Gw (558-626 MHz)', minFreq: 558.125, maxFreq: 625.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.400, twoTone: 0.250, threeTone: 0.100 } },

    // --- SENNHEISER EW-G4 ---
    'sennheiser-ewg4-gb': { 
        name: 'Sennheiser EW-G4', 
        band: 'GB (606-648 MHz)', 
        minFreq: 606.125, 
        maxFreq: 647.875, 
        tuningStep: 0.025, 
        type: 'mic', 
        recommendedThresholds: { fundamental: 0.400, twoTone: 0.250, threeTone: 0.100 },
        affiliateUrl: 'https://www.amazon.com/Sennheiser-EW-100-G4-835-S-A1/dp/B07B9S6P1C'
    },
    'sennheiser-ewg4-gbw': { name: 'Sennheiser EW-G4', band: 'GBw (606-678 MHz)', minFreq: 606.125, maxFreq: 677.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.250, threeTone: 0.100 } },
    'sennheiser-ewg4iem-gb': { name: 'Sennheiser EW-G4 IEM', band: 'GB (606-648 MHz)', minFreq: 606.125, maxFreq: 647.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.400, twoTone: 0.250, threeTone: 0.100 } },
    
    // --- SENNHEISER EW 300 G3 ---
    'sennheiser-ew300-g3mic-gb': { name: 'Sennheiser EW 300 G3 MIC', band: 'GB (606-648 MHz)', minFreq: 606.125, maxFreq: 647.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.250, threeTone: 0.100 } },
    'sennheiser-ew300-g3iem-g': { name: 'Sennheiser EW 300 G3 IEM', band: 'G (566-606 MHz)', minFreq: 566.125, maxFreq: 605.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.500, twoTone: 0.200, threeTone: 0.200 } },

    // --- LECTROSONICS ---
    'lectro-dsqd-a1b1': { name: 'Lectrosonics D-Squared', band: 'A1B1 (470.1-607.9 MHz)', minFreq: 470.1, maxFreq: 607.95, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 } },
    'lectro-venue-blk21': { name: 'Lectrosonics Venue', band: 'Blk 21 (537-563 MHz)', minFreq: 537.6, maxFreq: 563.1, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.250, threeTone: 0.100 } },

    // --- WISYCOM ---
    'wisycom-mtk952-uhf': { name: 'Wisycom MTK952', band: 'UHF (470-800 MHz)', minFreq: 470.125, maxFreq: 799.875, tuningStep: 0.005, type: 'iem', recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 } },
    'wisycom-mtk982-uhf': { name: 'Wisycom MTK982', band: 'UHF (470-800 MHz)', minFreq: 470.125, maxFreq: 799.875, tuningStep: 0.005, type: 'iem', recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 } },
    'wisycom-mrk16-uhf': { name: 'Wisycom MRK16 / MTP60', band: 'UHF (470-800 MHz)', minFreq: 470.125, maxFreq: 799.875, tuningStep: 0.005, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.050, threeTone: 0.000 } },
    'wisycom-mrk980-uhf': { name: 'Wisycom MRK980 / MTP61', band: 'UHF (470-800 MHz)', minFreq: 470.125, maxFreq: 799.875, tuningStep: 0.005, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.050, threeTone: 0.000 } },

    // --- SENNHEISER EW-DX ---
    'sennheiser-ewdx-q19': { name: 'Sennheiser EW-DX', band: 'Q1-9 (470-550 MHz)', minFreq: 470.2, maxFreq: 549.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.050, threeTone: 0.000 } },
    'sennheiser-ewdx-r19': { name: 'Sennheiser EW-DX', band: 'R1-9 (520-607 MHz)', minFreq: 520.125, maxFreq: 607.8, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.050, threeTone: 0.000 } },
    'sennheiser-ewdx-s110': { name: 'Sennheiser EW-DX', band: 'S1-10 (606-694 MHz)', minFreq: 606.2, maxFreq: 693.8, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.050, threeTone: 0.000 } },

    // --- SHURE SLX-D ---
    'shure-slxd-g58': { name: 'Shure SLX-D', band: 'G58 (470-514 MHz)', minFreq: 470.125, maxFreq: 513.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.100, threeTone: 0.025 } },
    'shure-slxd-h55': { name: 'Shure SLX-D', band: 'H55 (514-558 MHz)', minFreq: 514.125, maxFreq: 557.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.100, threeTone: 0.025 } },
    'shure-slxd-j52': { name: 'Shure SLX-D', band: 'J52 (558-602 MHz)', minFreq: 558.125, maxFreq: 601.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.100, threeTone: 0.025 } },

    // --- SONY DWX ---
    'sony-dwx-tv2129': { name: 'Sony DWX Digital', band: 'TV21-29 (470-542 MHz)', minFreq: 470.125, maxFreq: 541.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.050, threeTone: 0.000 } },
    'sony-dwx-tv3040': { name: 'Sony DWX Digital', band: 'TV30-40 (542-608 MHz)', minFreq: 542.125, maxFreq: 607.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.050, threeTone: 0.000 } },

    // --- AUDIO-TECHNICA 5000 ---
    'at-5000-de1': { name: 'Audio-Technica 5000 Series', band: 'DE1 (470-590 MHz)', minFreq: 470.125, maxFreq: 589.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.200, threeTone: 0.075 } },
    'at-5000-ef1': { name: 'Audio-Technica 5000 Series', band: 'EF1 (580-700 MHz)', minFreq: 580.125, maxFreq: 699.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.200, threeTone: 0.075 } },

    // --- DME / ENG SPECIALIZED ---
    'lectro-941-eng': { name: 'Lectrosonics DME ENG', band: '941 Block (941-960 MHz)', minFreq: 941.525, maxFreq: 959.825, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 } },
    'wisycom-dme-940': { name: 'Wisycom DME Broadcast', band: '940-960 MHz', minFreq: 940.125, maxFreq: 959.875, tuningStep: 0.005, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.050, threeTone: 0.000 } },

    // --- WMAS SYSTEMS (Wideband) ---
    // configured as CENTER frequencies for correct symmetric protection
    'sennheiser-wmas-6mhz': { name: 'Sennheiser WMAS (6 MHz Block)', band: 'UHF (470-694 MHz)', minFreq: 473, maxFreq: 691, tuningStep: 6, type: 'wmas', recommendedThresholds: { fundamental: 3.0, twoTone: 0, threeTone: 0 } },
    'sennheiser-wmas-8mhz': { name: 'Sennheiser WMAS (8 MHz Block)', band: 'UHF (470-694 MHz)', minFreq: 474, maxFreq: 690, tuningStep: 8, type: 'wmas', recommendedThresholds: { fundamental: 4.0, twoTone: 0, threeTone: 0 } },
    'shure-ad-wmas-6mhz': { name: 'Shure Axient Digital WMAS (6 MHz)', band: 'UHF (470-636 MHz)', minFreq: 473, maxFreq: 633, tuningStep: 6, type: 'wmas', recommendedThresholds: { fundamental: 3.0, twoTone: 0, threeTone: 0 } },
    'shure-ad-wmas-8mhz': { name: 'Shure Axient Digital WMAS (8 MHz)', band: 'UHF (470-636 MHz)', minFreq: 474, maxFreq: 632, tuningStep: 8, type: 'wmas', recommendedThresholds: { fundamental: 4.0, twoTone: 0, threeTone: 0 } }
};

export const US_DTV_DATABASE: Record<string, number[]> = {
    "902": [21, 23, 25], "100": [22, 24, 26, 30], "606": [21, 27, 28, 32],
    "941": [21, 22, 24, 30], "303": [23, 25, 29, 33], "752": [21, 26, 28, 32]
};

export const UK_DTV_DATABASE: Record<string, number[]> = {
    "SW": [21, 22, 23, 25, 26, 28, 30], "M": [21, 24, 27, 31], "EH": [21, 23, 26, 30],
    "B": [23, 26, 29, 32], "G": [22, 25, 28, 31], "L": [21, 24, 27, 30]
};

export const UK_GRID_REF_DATABASE: Record<string, number[]> = {
    "TQ": [21, 22, 23, 25, 26, 28, 30], "SJ": [21, 24, 27, 31], "NT": [21, 23, 26, 30],
    "SP": [23, 26, 29, 32], "NS": [22, 25, 28, 31], "SD": [21, 24, 27, 30]
};