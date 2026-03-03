
import { 
    Frequency, Thresholds, AnalysisResult, Conflict, Scene, 
    FestivalAct, ConstantSystemRequest, ZoneConfig, EquipmentProfile, 
    TxType, CompatibilityLevel, ZonalResult, DuplexPair, IntermodProduct,
    GeneratorRequest, EquipmentRequest, TalkbackIntermods, Zone,
    OptimizationReport, OptimizationSuggestion, BottleneckStats, TVChannelState, TalkbackMode, TourPlanningState, WMASState
} from '../types';
import { COMPATIBILITY_PROFILES, DISCRETE_TALKBACK_PAIRS, TALKBACK_DEFINITIONS, TALKBACK_FIXED_PAIRS, UK_TV_CHANNELS, US_TV_CHANNELS, TALKBACK_FORBIDDEN_RANGES } from '../constants';

/**
 * AUTHORITATIVE PRECISION UTILS
 */
const toHz = (mhz: number) => Math.round(mhz * 1000000);

const shuffleArray = <T>(array: T[]): T[] => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = arr[i];
        arr[j] = temp;
        arr[i] = temp;
    }
    return arr;
};

const FESTIVAL_SPATIAL_IMD_LIMIT = 10;
const FESTIVAL_SPATIAL_FF_LIMIT = 500;

const getDistanceWeightedFundamental = (distance: number): number => {
    if (distance >= 500) return 0.000;
    if (distance >= 400) return 0.050;
    if (distance >= 100) return 0.100; // Increased safety for medium distances
    if (distance >= 70)  return 0.150;
    if (distance >= 25)  return 0.175;
    if (distance >= 2)   return 0.200;
    return 0.350; 
};

export interface CoordinationDiagnostic {
    isHealthy: boolean;
    found: number;
    requested: number;
    efficiency: number;
    warnings: string[];
    suggestions: string[];
}

export const getCoordinationDiagnostics = (
    totalRequested: number,
    totalFound: number,
    minFreq: number,
    maxFreq: number,
    exclusions: { min: number, max: number }[],
    thresholds: Thresholds
): CoordinationDiagnostic => {
    const efficiency = totalRequested > 0 ? Math.round((totalFound / totalRequested) * 100) : 100;
    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (totalFound < totalRequested) {
        warnings.push(`Coordination shortfall: ${totalRequested - totalFound} carriers could not be placed.`);
        suggestions.push("Check for localized TV channel interference or high-power talkback blockades.");
        suggestions.push("Try reducing IMD spacing to 'Aggressive' for the affected equipment groups.");
    }

    if (efficiency < 100 && efficiency > 0) {
        suggestions.push("Consider using Linear/Digital mode for Axient Digital or D6000 systems to ignore IMD.");
    }

    return {
        isHealthy: totalFound >= totalRequested,
        found: totalFound,
        requested: totalRequested,
        efficiency,
        warnings,
        suggestions
    };
};

const getCandidates = (min: number, max: number, step: number, exclusions: {min: number, max: number}[], inclusions: {min: number, max: number}[] | null): number[] => {
    const pool: number[] = [];
    const minHz = toHz(min);
    const maxHz = toHz(max);
    const stepHz = toHz(step || 0.025);

    for (let currentHz = minHz; currentHz <= maxHz; currentHz += stepHz) {
        const v = currentHz / 1000000;
        if (exclusions.some(e => v >= (e.min - 0.0001) && v <= (e.max + 0.0001))) continue;
        if (inclusions && inclusions.length > 0 && !inclusions.some(i => v >= (i.min - 0.0001) && (i.max + 0.0001) >= v)) continue;
        pool.push(v);
    }
    return pool;
};

/**
 * ENGINE 1: TALKBACK SPECIALIZED PHYSICS (NARROWBAND)
 */
const isTalkbackCompatibleMutual = (
    candidateValue: number,
    pool: (Frequency & { isTx?: boolean })[],
    distances: number[][],
    candidateZoneIdx: number,
    matrix: boolean[][],
    isCandidateTx: boolean = false
): { conflicts: Conflict[] } => {
    const conflicts: Conflict[] = [];
    const candHz = toHz(candidateValue);
    const targetFreq = { id: 'candidate', value: candidateValue, type: 'comms' as TxType, isTx: isCandidateTx };
    
    const FF_HZ = toHz(0.01875);
    const IMD_HZ = toHz(0.0125);

    const poolWithMeta = pool.map(f => ({
        ...f,
        hz: toHz(f.value),
        zIdx: f.zoneIndex ?? 0
    }));

    for (let i = 0; i < poolWithMeta.length; i++) {
        const f1 = poolWithMeta[i];
        
        // 1. Fundamental Check
        const diff = Math.abs(candHz - f1.hz);
        if (diff < FF_HZ) {
            conflicts.push({ type: 'Talkback Fundamental Clash', product: f1.value, sourceFreqs: [f1], targetFreq, diff: diff / 1000000 });
            return { conflicts };
        }

        // 2. IMD Checks (Symmetrical)
        // Defend against -1 indices which represent "Site Wide" or "Global"
        const interactsC1 = (candidateZoneIdx < 0 || f1.zIdx < 0) 
            ? true 
            : (distances[candidateZoneIdx]?.[f1.zIdx] < 25 || matrix[candidateZoneIdx]?.[f1.zIdx]);
        
        // A. Candidate as Victim
        if (interactsC1) {
            for (let j = 0; j < poolWithMeta.length; j++) {
                if (i === j) continue;
                const f2 = poolWithMeta[j];
                const interactsC2 = (candidateZoneIdx < 0 || f2.zIdx < 0)
                    ? true
                    : (distances[candidateZoneIdx]?.[f2.zIdx] < 25 || matrix[candidateZoneIdx]?.[f2.zIdx]);
                const interacts12 = (f1.zIdx < 0 || f2.zIdx < 0)
                    ? true
                    : (distances[f1.zIdx]?.[f2.zIdx] < 25 || matrix[f1.zIdx]?.[f2.zIdx]);

                if (interactsC2 && interacts12) {
                    // Only isTx carriers (Constant Transmits) generate intermods
                    if (f1.isTx && f2.isTx) {
                        // 2-Tone
                        const p2 = 2 * f1.hz - f2.hz;
                        if (Math.abs(candHz - p2) < IMD_HZ) {
                            conflicts.push({ type: 'Talkback 2-Tone IMD (Victim)', product: p2 / 1000000, sourceFreqs: [f1, f2], targetFreq, diff: Math.abs(candHz - p2) / 1000000 });
                            return { conflicts };
                        }

                        // 3-Tone
                        for (let k = j + 1; k < poolWithMeta.length; k++) {
                            if (k === i) continue;
                            const f3 = poolWithMeta[k];
                            if (!f3.isTx) continue;
                            const interactsC3 = (candidateZoneIdx < 0 || f3.zIdx < 0)
                                ? true
                                : (distances[candidateZoneIdx]?.[f3.zIdx] < 25 || matrix[candidateZoneIdx]?.[f3.zIdx]);
                            const interacts13 = (f1.zIdx < 0 || f3.zIdx < 0)
                                ? true
                                : (distances[f1.zIdx]?.[f3.zIdx] < 25 || matrix[f1.zIdx]?.[f3.zIdx]);
                            const interacts23 = (f2.zIdx < 0 || f3.zIdx < 0)
                                ? true
                                : (distances[f2.zIdx]?.[f3.zIdx] < 25 || matrix[f2.zIdx]?.[f3.zIdx]);

                            if (interactsC3 && interacts13 && interacts23) {
                                const p3 = f1.hz + f2.hz - f3.hz;
                                if (Math.abs(candHz - p3) < IMD_HZ) {
                                    conflicts.push({ type: 'Talkback 3-Tone IMD (Victim)', product: p3 / 1000000, sourceFreqs: [f1, f2, f3], targetFreq, diff: Math.abs(candHz - p3) / 1000000 });
                                    return { conflicts };
                                }
                            }
                        }
                    }
                }
            }
        }

        // B. Candidate as Aggressor (If candidate isTx)
        // Physics logic: Constant Tx (Base) hits intermittent Rx (Portable)
        if (isCandidateTx && interactsC1 && f1.isTx) {
            for (let j = 0; j < poolWithMeta.length; j++) {
                if (i === j) continue;
                const fVictim = poolWithMeta[j];
                
                const interactsCVictim = (candidateZoneIdx < 0 || fVictim.zIdx < 0)
                    ? true
                    : (distances[candidateZoneIdx]?.[fVictim.zIdx] < 25 || matrix[candidateZoneIdx]?.[fVictim.zIdx]);
                const interacts1Victim = (f1.zIdx < 0 || fVictim.zIdx < 0)
                    ? true
                    : (distances[f1.zIdx]?.[fVictim.zIdx] < 25 || matrix[f1.zIdx]?.[fVictim.zIdx]);
                
                if (interactsCVictim && interacts1Victim) {
                    // 2-Tone: 2*Cand - f1
                    const p2A = 2 * candHz - f1.hz;
                    if (Math.abs(fVictim.hz - p2A) < IMD_HZ) {
                        conflicts.push({ type: 'Talkback 2-Tone IMD (Aggressor)', product: p2A / 1000000, sourceFreqs: [targetFreq, f1], targetFreq: fVictim, diff: Math.abs(fVictim.hz - p2A) / 1000000 });
                        return { conflicts };
                    }
                    // 2-Tone: 2*f1 - Cand
                    const p2B = 2 * f1.hz - candHz;
                    if (Math.abs(fVictim.hz - p2B) < IMD_HZ) {
                        conflicts.push({ type: 'Talkback 2-Tone IMD (Aggressor)', product: p2B / 1000000, sourceFreqs: [f1, targetFreq], targetFreq: fVictim, diff: Math.abs(fVictim.hz - p2B) / 1000000 });
                        return { conflicts };
                    }

                    // 3-Tone: Cand + f1 - f2 (where f2 is another Tx)
                    for (let k = 0; k < poolWithMeta.length; k++) {
                        if (k === i || k === j) continue;
                        const f2 = poolWithMeta[k];
                        if (!f2.isTx) continue;
                        
                        const interactsC2 = (candidateZoneIdx < 0 || f2.zIdx < 0)
                            ? true
                            : (distances[candidateZoneIdx]?.[f2.zIdx] < 25 || matrix[candidateZoneIdx]?.[f2.zIdx]);
                        const interacts12 = (f1.zIdx < 0 || f2.zIdx < 0)
                            ? true
                            : (distances[f1.zIdx]?.[f2.zIdx] < 25 || matrix[f1.zIdx]?.[f2.zIdx]);
                        const interacts2Victim = (f2.zIdx < 0 || fVictim.zIdx < 0)
                            ? true
                            : (distances[f2.zIdx]?.[fVictim.zIdx] < 25 || matrix[f2.zIdx]?.[fVictim.zIdx]);

                        if (interactsC2 && interacts12 && interacts2Victim) {
                            // Cand + f1 - f2
                            const p3A = candHz + f1.hz - f2.hz;
                            if (Math.abs(fVictim.hz - p3A) < IMD_HZ) {
                                conflicts.push({ type: 'Talkback 3-Tone IMD (Aggressor)', product: p3A / 1000000, sourceFreqs: [targetFreq, f1, f2], targetFreq: fVictim, diff: Math.abs(fVictim.hz - p3A) / 1000000 });
                                return { conflicts };
                            }
                            // f1 + f2 - Cand
                            const p3B = f1.hz + f2.hz - candHz;
                            if (Math.abs(fVictim.hz - p3B) < IMD_HZ) {
                                conflicts.push({ type: 'Talkback 3-Tone IMD (Aggressor)', product: p3B / 1000000, sourceFreqs: [f1, f2, targetFreq], targetFreq: fVictim, diff: Math.abs(fVictim.hz - p3B) / 1000000 });
                                return { conflicts };
                            }
                        }
                    }
                }
            }
        }
    }
    return { conflicts };
};

/**
 * ENGINE 2: BROADSIDE PHYSICS (MICS/IEMS/GENERIC)
 */
const isExhaustiveCompatibleMutual = (
    candidateValue: number, 
    candidateTh: Thresholds, 
    candidateZoneIdx: number,
    pool: Frequency[], 
    distances: number[][],
    db: Record<string, EquipmentProfile>,
    globalOverrides?: Record<string, Partial<Thresholds>>,
    imdLimit: number = FESTIVAL_SPATIAL_IMD_LIMIT,
    candidateLinearMode: boolean = false,
    matrix?: boolean[][]
): { conflicts: Conflict[], reason?: 'fundamental' | 'imd2' | 'imd3' } => {
    const conflicts: Conflict[] = [];
    if (candidateValue <= 0) return { conflicts };
    
    const candidateHz = toHz(candidateValue);
    const targetFreq: Frequency = { 
        id: 'candidate', 
        value: candidateValue, 
        manualThresholds: candidateTh, 
        zoneIndex: candidateZoneIdx, 
        linearMode: candidateLinearMode 
    };

    const poolWithTh = pool.map(f => ({
        ...f,
        hz: toHz(f.value),
        th: f.manualThresholds || getFinalThresholds(f, db, globalOverrides),
        zoneIdx: f.zoneIndex ?? 0,
        isDigital: !!f.linearMode
    }));

    // 1. FUNDAMENTAL CHECK (SYMMETRICAL)
    for (const f1 of poolWithTh) {
        // Defensive check for -1 index (Global/Site-wide)
        const isGlobal = candidateZoneIdx < 0 || f1.zoneIdx < 0;
        const dist_C1 = isGlobal ? 0 : (distances[candidateZoneIdx]?.[f1.zoneIdx] ?? 0);
        const isManuallyLinked = isGlobal ? true : (matrix && matrix[candidateZoneIdx]?.[f1.zoneIdx]);
        
        if (dist_C1 < FESTIVAL_SPATIAL_FF_LIMIT || isManuallyLinked) {
            const distRuleFreq = getDistanceWeightedFundamental(dist_C1);
            const mutualFF_Hz = Math.max(1, toHz(Math.max(candidateTh.fundamental, f1.th.fundamental, distRuleFreq)));
            const fontDiffHz = Math.abs(candidateHz - f1.hz);
            if (fontDiffHz < mutualFF_Hz) {
                conflicts.push({ type: 'Fundamental', product: f1.value, sourceFreqs: [f1], targetFreq, diff: fontDiffHz / 1000000 });
                return { conflicts, reason: 'fundamental' };
            }
        }
    }

    // 2. IMD CHECK (TWO-WAY SYMMETRICAL WITH 10M CLUSTER RULE)
    const candTwoToneThHz = candidateLinearMode ? 0 : toHz(candidateTh.twoTone);
    const candThreeToneThHz = candidateLinearMode ? 0 : toHz(candidateTh.threeTone);

    for (let i = 0; i < poolWithTh.length; i++) {
        const f1 = poolWithTh[i];

        for (let j = 0; j < poolWithTh.length; j++) {
            if (i === j) continue;
            const f2 = poolWithTh[j];
            
            // --- A. CANDIDATE AS VICTIM (Sources f1 and f2) ---
            const isGlobal_12 = f1.zoneIdx < 0 || f2.zoneIdx < 0;
            const dist_12 = isGlobal_12 ? 0 : (distances[f1.zoneIdx]?.[f2.zoneIdx] ?? 0);
            const linked_12 = isGlobal_12 ? true : (matrix && matrix[f1.zoneIdx]?.[f2.zoneIdx]);
            
            if (dist_12 < imdLimit || linked_12) {
                if (candTwoToneThHz > 0 && !(candidateLinearMode && f1.isDigital && f2.isDigital)) {
                    const p2 = 2 * f1.hz - f2.hz;
                    const diffHz = Math.abs(candidateHz - p2);
                    if (diffHz < candTwoToneThHz) {
                        conflicts.push({ type: '2-Tone IMD (Victim)', product: p2 / 1000000, sourceFreqs: [f1, f2], targetFreq, diff: diffHz / 1000000 });
                        return { conflicts, reason: 'imd2' };
                    }
                }
            }

            // --- B. CANDIDATE AS AGGRESSOR (Cand and f1 hit Victim f2) ---
            const isGlobal_C1 = candidateZoneIdx < 0 || f1.zoneIdx < 0;
            const dist_C1 = isGlobal_C1 ? 0 : (distances[candidateZoneIdx]?.[f1.zoneIdx] ?? 0);
            const linked_C1 = isGlobal_C1 ? true : (matrix && matrix[candidateZoneIdx]?.[f1.zoneIdx]);

            if (dist_C1 < imdLimit || linked_C1) {
                const f2TwoToneThHz = f2.isDigital ? 0 : toHz(f2.th.twoTone);
                if (f2TwoToneThHz > 0 && !(f2.isDigital && candidateLinearMode && f1.isDigital)) {
                    const pA = 2 * candidateHz - f1.hz;
                    const diffHzA = Math.abs(f2.hz - pA);
                    if (diffHzA < f2TwoToneThHz) {
                        conflicts.push({ type: '2-Tone IMD (Aggressor)', product: pA / 1000000, sourceFreqs: [targetFreq, f1], targetFreq: f2, diff: diffHzA / 1000000 });
                        return { conflicts, reason: 'imd2' };
                    }
                    const pB = 2 * f1.hz - candidateHz;
                    const diffHzB = Math.abs(f2.hz - pB);
                    if (diffHzB < f2TwoToneThHz) {
                        conflicts.push({ type: '2-Tone IMD (Aggressor)', product: pB / 1000000, sourceFreqs: [f1, targetFreq], targetFreq: f2, diff: diffHzB / 1000000 });
                        return { conflicts, reason: 'imd2' };
                    }
                }
            }

            // --- 3-TONE ANALYSIS (STRICT 10M CLUSTER RULE) ---
            for (let k = 0; k < poolWithTh.length; k++) {
                if (k === i || k === j) continue;
                const f3 = poolWithTh[k];

                // A. Candidate as Victim: Sources f1, f2, f3 must form a 10m cluster
                const isGlobal_13 = f1.zoneIdx < 0 || f3.zoneIdx < 0;
                const isGlobal_23 = f2.zoneIdx < 0 || f3.zoneIdx < 0;
                const dist_13 = isGlobal_13 ? 0 : (distances[f1.zoneIdx]?.[f3.zoneIdx] ?? 0);
                const dist_23 = isGlobal_23 ? 0 : (distances[f2.zoneIdx]?.[f3.zoneIdx] ?? 0);
                const linked_13 = isGlobal_13 ? true : (matrix && matrix[f1.zoneIdx]?.[f3.zoneIdx]);
                const linked_23 = isGlobal_23 ? true : (matrix && matrix[f2.zoneIdx]?.[f3.zoneIdx]);
                
                const clusterSources = (dist_12 < imdLimit || linked_12) && 
                                     (dist_13 < imdLimit || linked_13) && 
                                     (dist_23 < imdLimit || linked_23);

                if (clusterSources) {
                    if (candThreeToneThHz > 0 && !(candidateLinearMode && f1.isDigital && f2.isDigital && f3.isDigital)) {
                        const p3 = f1.hz + f2.hz - f3.hz;
                        const diffHz = Math.abs(candidateHz - p3);
                        if (diffHz < candThreeToneThHz) {
                            conflicts.push({ type: '3-Tone IMD (Victim)', product: p3 / 1000000, sourceFreqs: [f1, f2, f3], targetFreq, diff: diffHz / 1000000 });
                            return { conflicts, reason: 'imd3' };
                        }
                    }
                }

                // B. Candidate as Aggressor: Sources Cand, f1, f2 must form a 10m cluster to hit Victim f3
                const isGlobal_C2 = candidateZoneIdx < 0 || f2.zoneIdx < 0;
                const dist_C2 = isGlobal_C2 ? 0 : (distances[candidateZoneIdx]?.[f2.zoneIdx] ?? 0);
                const linked_C2 = isGlobal_C2 ? true : (matrix && matrix[candidateZoneIdx]?.[f2.zoneIdx]);
                
                const clusterAggressors = (dist_C1 < imdLimit || linked_C1) && 
                                        (dist_C2 < imdLimit || linked_C2) && 
                                        (dist_12 < imdLimit || linked_12);

                if (clusterAggressors) {
                    const f3ThreeToneThHz = f3.isDigital ? 0 : toHz(f3.th.threeTone);
                    if (f3ThreeToneThHz > 0 && !(f3.isDigital && candidateLinearMode && f1.isDigital && f2.isDigital)) {
                        // Scenario: Cand + f1 - f2 hitting f3
                        const p3A = candidateHz + f1.hz - f2.hz;
                        const diffHz3A = Math.abs(f3.hz - p3A);
                        if (diffHz3A < f3ThreeToneThHz) {
                            conflicts.push({ type: '3-Tone IMD (Aggressor)', product: p3A / 1000000, sourceFreqs: [targetFreq, f1, f2], targetFreq: f3, diff: diffHz3A / 1000000 });
                            return { conflicts, reason: 'imd3' };
                        }
                        // Scenario: f1 + f2 - Cand hitting f3
                        const p3B = f1.hz + f2.hz - candidateHz;
                        const diffHz3B = Math.abs(f3.hz - p3B);
                        if (diffHz3B < f3ThreeToneThHz) {
                            conflicts.push({ type: '3-Tone IMD (Aggressor)', product: p3B / 1000000, sourceFreqs: [f1, f2, targetFreq], targetFreq: f3, diff: diffHz3B / 1000000 });
                            return { conflicts, reason: 'imd3' };
                        }
                    }
                }
            }
        }
    }
    return { conflicts };
};

const getEquipmentAwareExclusions = (
    baseExclusions: {min: number, max: number}[],
    eqType: TxType,
    triStates: Record<number, TVChannelState> | undefined,
    region: 'uk' | 'us'
) => {
    const final = [...baseExclusions];
    if (!triStates) return final;
    const channelMap = region === 'uk' ? UK_TV_CHANNELS : US_TV_CHANNELS;
    Object.entries(triStates).forEach(([chStr, state]) => {
        const ch = Number(chStr);
        const range = channelMap[ch];
        if (!range) return;
        const isExclusion = (state === 'blocked') || (eqType === 'mic' && state === 'iem-only') || (eqType === 'iem' && state === 'mic-only');
        if (isExclusion) final.push({ min: range[0], max: range[1] });
    });
    return final;
};

export const getFinalThresholds = (freq: Partial<Frequency>, db: Record<string, EquipmentProfile>, globalOverrides?: Record<string, Partial<Thresholds>>): Thresholds => {
    if (freq.manualThresholds) return freq.manualThresholds;
    const equipmentKey = freq.equipmentKey || 'custom';
    const profile = db[equipmentKey] || db['custom'];
    const level = freq.compatibilityLevel || 'standard';
    
    const base: Thresholds = {
        fundamental: profile?.recommendedThresholds?.fundamental ?? 0.35,
        twoTone: profile?.recommendedThresholds?.twoTone ?? 0.075,
        threeTone: profile?.recommendedThresholds?.threeTone ?? 0.05,
        fiveTone: 0, sevenTone: 0,
    };

    if (globalOverrides && globalOverrides[equipmentKey]) {
        const u = globalOverrides[equipmentKey];
        if (u.fundamental !== undefined) base.fundamental = u.fundamental;
        if (u.twoTone !== undefined) base.twoTone = u.twoTone;
        if (u.threeTone !== undefined) base.threeTone = u.threeTone;
    }

    const result: Thresholds = { ...base };
    if (level === 'aggressive') {
        result.fundamental = Math.max(0.2, base.fundamental - 0.050);
        result.twoTone = Math.max(0.0, base.twoTone - 0.025);
        result.threeTone = Math.max(0.0, base.threeTone - 0.050);
    } else if (level === 'robust') {
        result.fundamental = base.fundamental + 0.050;
        result.twoTone = base.twoTone + 0.025;
        result.threeTone = base.threeTone + 0.050;
    }
    return result;
};

export const checkCompatibility = (freqs: Frequency[], thresholds: Thresholds): AnalysisResult => {
    const conflicts: Conflict[] = [];
    const validFreqs = freqs.filter(f => f.value > 0);
    for (let i = 0; i < validFreqs.length; i++) {
        const fTarget = validFreqs[i];
        const pool = validFreqs.filter((_, idx) => idx !== i);
        const dummyDist = [[0]];
        const { conflicts: issues } = isExhaustiveCompatibleMutual(fTarget.value, thresholds, 0, pool.map(p => ({ ...p, zoneIndex: p.zoneIndex ?? 0 })), dummyDist, {}, undefined, 10, fTarget.linearMode);
        issues.forEach(issue => {
            issue.targetFreq = { id: fTarget.id, value: fTarget.value, type: fTarget.type, label: fTarget.label };
            conflicts.push(issue);
        });
    }
    return { conflicts, totalChecks: validFreqs.length };
};

/**
 * ENTRY POINT: TALKBACK AUDIT
 */
export const checkTalkbackCompatibility = (freqs: Frequency[], distances: number[][], matrix: boolean[][], mode: TalkbackMode = 'standard'): AnalysisResult => {
    const conflicts: Conflict[] = [];
    const validFreqs = freqs.filter(f => f.value > 0);
    
    const taggedFreqs = validFreqs.map(f => {
        // Tag based on explicit label or implied type
        let isBase = f.label?.toLowerCase().includes('base') || f.label?.toLowerCase().includes('tx');
        if (!isBase) {
            // Heuristic: if no label, guess based on mode and frequency
            if (mode === 'europe') {
                isBase = f.value > 460;
            } else {
                isBase = f.value < 460;
            }
        }
        return {
            ...f,
            isTx: isBase
        };
    });

    for (let i = 0; i < taggedFreqs.length; i++) {
        const fTarget = taggedFreqs[i];

        // 1. Regulatory Check
        const inForbidden = TALKBACK_FORBIDDEN_RANGES.some(range => {
            // Disable 450-453 MHz AND 465-467 MHz forbidden zones in Mainland Europe mode
            if (mode === 'europe') {
                const is450Range = range.min >= 450 && range.max <= 453;
                const is465Range = range.min >= 465 && range.max <= 467;
                if (is450Range || is465Range) return false;
            }
            return fTarget.value >= (range.min - 0.000005) && fTarget.value <= (range.max + 0.000005);
        });
        
        if (inForbidden) {
            conflicts.push({
                type: 'Regulatory Violation',
                product: fTarget.value,
                sourceFreqs: [],
                targetFreq: fTarget,
                diff: 0
            });
        }

        // 2. Interaction Checks
        const pool = taggedFreqs.filter((_, idx) => idx !== i);
        const { conflicts: issues } = isTalkbackCompatibleMutual(fTarget.value, pool, distances, fTarget.zoneIndex ?? 0, matrix, fTarget.isTx);
        issues.forEach(issue => {
            issue.targetFreq = { id: fTarget.id, value: fTarget.value, type: fTarget.type, label: fTarget.label };
            conflicts.push(issue);
        });
    }
    return { conflicts, totalChecks: validFreqs.length };
};

export const checkCompatibilityTimeline = (freqs: Frequency[], thresholds: Thresholds, scenes: Scene[]): AnalysisResult => {
    const allConflicts: Conflict[] = [];
    let totalChecks = 0;
    if (!scenes || scenes.length === 0) return checkCompatibility(freqs, thresholds);
    scenes.forEach(scene => {
        const sceneFreqs = freqs.filter(f => scene.activeFrequencyIds.has(f.id));
        if (sceneFreqs.length > 1) {
            const result = checkCompatibility(sceneFreqs, thresholds);
            result.conflicts.forEach(c => { allConflicts.push({ ...c, sceneName: scene.name }); });
            totalChecks += result.totalChecks;
        }
    });
    return { conflicts: allConflicts, totalChecks };
};

export const generateCompatibleFreqs = (
    count: number, min: number, max: number, step: number, exclusions: { min: number, max: number }[],
    db: Record<string, EquipmentProfile>, equipmentKey: string, level: CompatibilityLevel,
    globalOverrides?: Record<string, Partial<Thresholds>>, manualThresholds?: Thresholds
): Frequency[] => {
    const thresholds = manualThresholds || getFinalThresholds({ equipmentKey, compatibilityLevel: level }, db, globalOverrides);
    const profile = db[equipmentKey] || db['custom'];
    const candidates = shuffleArray(getCandidates(min, max, step || 0.025, exclusions, null));
    const results: Frequency[] = [];
    const dummyDist = [[0]];
    for (const val of candidates) {
        if (results.length >= count) break;
        if (isExhaustiveCompatibleMutual(val, thresholds, 0, results, dummyDist, db, globalOverrides, 10, false).conflicts.length === 0) {
            results.push({ id: `MB-${results.length + 1}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`, value: val, equipmentKey, compatibilityLevel: level, manualThresholds: manualThresholds ? thresholds : undefined, type: profile?.type || 'generic' });
        }
    }
    return results;
};

export const generateMultizoneFrequencies = async (
    groups: ZoneConfig[],
    db: Record<string, EquipmentProfile>,
    compatibilityMatrix: boolean[][],
    distances: number[][],
    previousResults: { zones: Zone[] } | null,
    tvExclusions: { min: number, max: number }[],
    globalOverrides?: Record<string, Partial<Thresholds>>,
    triStateChannels?: Record<number, TVChannelState>,
    region: 'uk' | 'us' = 'uk',
    onProgress?: (p: number) => void,
    manualFrequencies: Frequency[] = []
): Promise<{ zones: Zone[], spares: { mics: Frequency[], iems: Frequency[] } }> => {
    const MAX_TRIALS = 50; 
    let bestTotalFound = -1;
    let bestResult: { zones: Zone[] } | null = null;
    const totalRequested = groups.reduce((a, b) => a + b.count, 0);
    const siteWidePreserved = [
        ...(previousResults?.zones.flatMap(z => z.frequencies || []).filter(f => f.locked && f.value > 0) || []),
        ...manualFrequencies.map(f => ({ ...f, locked: true }))
    ];
    const uniqueZoneIndices = Array.from(new Set(groups.map(g => g.zoneIndex ?? 0))).sort((a, b) => a - b);
    for (let trial = 0; trial < MAX_TRIALS; trial++) {
        const allResolvedFreqs: Frequency[] = [...siteWidePreserved]; 
        const lockedPool = [...siteWidePreserved];
        const zoneResultsMap = new Map<number, Frequency[]>();
        let currentTrialTotal = 0;
        for (let i = 0; i < groups.length; i++) {
            const config = groups[i];
            const zIdx = config.zoneIndex ?? 0;
            const equipmentKey = config.equipmentKey || 'custom';
            const thresholds = config.useManualParams ? { fundamental: config.manualFundamental ?? 0.35, twoTone: config.manualTwoTone ?? 0.05, threeTone: config.manualThreeTone ?? 0.05, fiveTone: 0, sevenTone: 0 } : getFinalThresholds({ equipmentKey, compatibilityLevel: config.compatibilityLevel || 'standard' }, db, globalOverrides);
            const profile = db[equipmentKey] || db['custom'];
            const eqType = config.type || profile?.type || 'generic';
            const groupFreqs: Frequency[] = [];
            for (let j = 0; j < lockedPool.length; j++) {
                const f = lockedPool[j];
                if (f.label === config.name && f.zoneIndex === zIdx && groupFreqs.length < config.count) {
                    groupFreqs.push(f); lockedPool.splice(j, 1); j--;
                }
            }
            const targetToGenerate = Math.max(0, config.count - groupFreqs.length);
            if (targetToGenerate > 0) {
                const minFreq = (equipmentKey === 'custom' && config.customMin) ? config.customMin : profile.minFreq;
                const maxFreq = (equipmentKey === 'custom' && config.customMax) ? config.customMax : profile.maxFreq;
                const finalExclusions = getEquipmentAwareExclusions(tvExclusions, eqType as any, triStateChannels, region);
                let candidates = getCandidates(minFreq, maxFreq, profile?.tuningStep || 0.025, finalExclusions, null);
                candidates = shuffleArray(candidates);
                for (const val of candidates) {
                    if (groupFreqs.length >= config.count) break;
                    if (isExhaustiveCompatibleMutual(val, thresholds, zIdx, allResolvedFreqs, distances, db, globalOverrides, 10, config.linearMode, compatibilityMatrix).conflicts.length === 0) {
                        const newFreq: Frequency = { id: `Z${zIdx + 1}-T${trial}-G${i + 1}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`, value: val, locked: false, equipmentKey, compatibilityLevel: config.compatibilityLevel || 'standard', manualThresholds: config.useManualParams ? thresholds : undefined, zoneIndex: zIdx, label: config.name, type: eqType as TxType, linearMode: config.linearMode };
                        groupFreqs.push(newFreq); allResolvedFreqs.push(newFreq);
                    }
                }
            }
            const existingInZone = zoneResultsMap.get(zIdx) || [];
            zoneResultsMap.set(zIdx, [...existingInZone, ...groupFreqs]);
            currentTrialTotal += groupFreqs.length;
        }
        
        // Add any remaining locked frequencies that didn't match a group
        for (const f of lockedPool) {
            const zIdx = f.zoneIndex ?? 0;
            const existingInZone = zoneResultsMap.get(zIdx) || [];
            if (!existingInZone.some(existing => existing.id === f.id)) {
                zoneResultsMap.set(zIdx, [...existingInZone, f]);
            }
        }

        if (currentTrialTotal > bestTotalFound) {
            bestTotalFound = currentTrialTotal;
            const allZIndices = Array.from(new Set([...uniqueZoneIndices, ...Array.from(zoneResultsMap.keys())])).sort((a, b) => a - b);
            const trialZones: Zone[] = allZIndices.map(zIdx => ({ name: groups.find(g => g.zoneIndex === zIdx)?.name || `Zone ${zIdx + 1}`, frequencies: zoneResultsMap.get(zIdx) || [] }));
            bestResult = { zones: trialZones };
        }
        if (onProgress) onProgress((trial + 1) / MAX_TRIALS);
        if (bestTotalFound >= totalRequested) break;
        if (trial % 5 === 0) await new Promise(r => setTimeout(r, 0));
    }
    return { zones: bestResult?.zones || [], spares: { mics: [], iems: [] } };
};

/**
 * REWRITTEN: UNIFIED POOL COORD ENGINE
 * Now treats site frequencies as full intermod actors instead of isolated blocks.
 * UPDATED: Added multi-trial loop to ensure yield matches request count.
 */
export const resolveGeneratorRequests = async (
    requests: GeneratorRequest[],
    lockedConstraints: Frequency[],
    db: Record<string, EquipmentProfile>,
    exclusions: { min: number, max: number }[],
    inclusions: { min: number, max: number }[] | null,
    advanced: boolean,
    useGlobalThresholds: boolean,
    onProgress: (p: number) => void,
    manualConstraints: Frequency[],
    globalOverrides?: Record<string, Partial<Thresholds>>,
    generatorGlobalThresholds?: { fundamental: string; twoTone: string; threeTone: string },
    ignoreManualIMD: boolean = false,
    triStates?: Record<number, TVChannelState>,
    region: 'uk' | 'us' = 'uk',
    siteThresholds?: Thresholds
): Promise<Frequency[]> => {
    
    const MAX_TRIALS = 50; 
    let bestTotalFound = -1;
    let bestPool: Frequency[] = [];
    
    const totalToFind = requests.reduce((s, r) => s + (parseInt(String(r.count)) || 0), 0);
    const dummyDist = [[0]];
    const runNonce = Math.random().toString(36).substring(2, 6).toUpperCase();

    for (let trial = 0; trial < MAX_TRIALS; trial++) {
        // START WITH THE UNIFIED POOL: Every frequency currently on site is a potential IMD aggressor or victim
        const unifiedPool: Frequency[] = [...manualConstraints, ...lockedConstraints].map(f => {
            const profile = db[f.equipmentKey || 'custom'] || db['custom'];
            
            // USE PROVIDED SITE THRESHOLDS OR FALLBACK
            let thToUse: Thresholds;
            if (ignoreManualIMD) {
                thToUse = { fundamental: siteThresholds?.fundamental || f.manualThresholds?.fundamental || profile?.recommendedThresholds?.fundamental || 0.35, twoTone: 0, threeTone: 0, fiveTone: 0, sevenTone: 0 };
            } else {
                thToUse = siteThresholds || f.manualThresholds || getFinalThresholds(f, db, globalOverrides);
            }

            return {
                ...f,
                zoneIndex: f.zoneIndex ?? 0,
                manualThresholds: thToUse
            };
        });

        let currentTrialFound = 0;

        // Optimization: Shuffle request order each trial to explore better packing combinations
        const trialRequests = trial % 10 === 0 ? requests : shuffleArray(requests);

        for (let i = 0; i < trialRequests.length; i++) {
            const req = trialRequests[i];
            const count = parseInt(String(req.count)) || 0;
            const alreadyFoundForThisReq = unifiedPool.filter(f => f.sourceRequestId === String(req.id)).length;
            const targetToFind = Math.max(0, count - alreadyFoundForThisReq);
            
            let reqThresholds: Thresholds;
            if (useGlobalThresholds && generatorGlobalThresholds) {
                reqThresholds = { fundamental: parseFloat(generatorGlobalThresholds.fundamental) || 0.35, twoTone: parseFloat(generatorGlobalThresholds.twoTone) || 0.05, threeTone: parseFloat(generatorGlobalThresholds.threeTone) || 0.05, fiveTone: 0, sevenTone: 0 };
            } else if (req.useManualParams === true) {
                reqThresholds = { fundamental: parseFloat(String(req.manualFundamental)) || 0.35, twoTone: parseFloat(String(req.manualTwoTone)) || 0.05, threeTone: parseFloat(String(req.manualThreeTone)) || 0.00, fiveTone: 0, sevenTone: 0 };
            } else {
                reqThresholds = getFinalThresholds({ equipmentKey: req.key, compatibilityLevel: req.compatibilityLevel }, db, globalOverrides);
            }

            const profile = db[req.key] || db['custom'];
            const tuningStep = profile?.tuningStep || 0.025;
            const typeToUse = req.type || (profile?.type as TxType) || 'generic';
            const finalExclusions = getEquipmentAwareExclusions(exclusions, typeToUse, triStates, region);
            
            let candidates = getCandidates(parseFloat(String(req.customMin)), parseFloat(String(req.customMax)), tuningStep, finalExclusions, inclusions);
            candidates = shuffleArray(candidates);
            
            let foundForThisReq = 0;
            for (const val of candidates) {
                if (foundForThisReq >= targetToFind) break;
                
                const unifiedCheck = isExhaustiveCompatibleMutual(
                    val, 
                    reqThresholds, 
                    0, 
                    unifiedPool, 
                    dummyDist, 
                    db, 
                    globalOverrides, 
                    10, 
                    req.linearMode
                );

                if (unifiedCheck.conflicts.length === 0) {
                    const f: Frequency = { 
                        id: `R${runNonce}-T${trial}-G${i}-${foundForThisReq}`, 
                        value: val, 
                        type: typeToUse, 
                        sourceRequestId: String(req.id), 
                        equipmentKey: req.key, 
                        compatibilityLevel: req.compatibilityLevel, 
                        label: req.label ? `${req.label} ${alreadyFoundForThisReq + foundForThisReq + 1}` : undefined, 
                        manualThresholds: (useGlobalThresholds || req.useManualParams) ? reqThresholds : undefined, 
                        zoneIndex: 0, 
                        locked: false, 
                        linearMode: req.linearMode 
                    };
                    unifiedPool.push(f);
                    foundForThisReq++;
                    currentTrialFound++;
                }
            }
        }

        if (currentTrialFound > bestTotalFound) {
            bestTotalFound = currentTrialFound;
            bestPool = unifiedPool;
        }

        onProgress((trial + 1) / MAX_TRIALS);
        if (bestTotalFound >= totalToFind) break;
        if (trial % 5 === 0) await new Promise(r => setTimeout(r, 0));
    }

    return bestPool;
};

export const generateConstantFrequencies = async (
    constant: ConstantSystemRequest[], house: ConstantSystemRequest[], zoneConfigs: ZoneConfig[], distances: number[][],
    db: Record<string, EquipmentProfile>, exclusions: { min: number, max: number }[], matrix: boolean[][], onProgress?: (p: any) => void,
    inclusionRanges?: { min: number, max: number }[] | null, globalOverrides?: Record<string, Partial<Thresholds>>, triStates?: Record<number, TVChannelState>, region: 'uk' | 'us' = 'uk',
    wmasState?: WMASState
): Promise<ConstantSystemRequest[]> => {
    const results: ConstantSystemRequest[] = [];
    const siteFreqs: Frequency[] = [];
    const runNonce = Math.random().toString(36).substring(2, 6).toUpperCase();
    constant.forEach(s => s.frequencies?.forEach(f => { if (f.locked && f.value > 0) siteFreqs.push(f); }));
    house.forEach(s => s.frequencies?.forEach(f => { if (f.locked && f.value > 0) siteFreqs.push(f); }));

    const globalExclusions = [...exclusions];
    if (wmasState && wmasState.nodes) {
        wmasState.nodes.forEach(node => {
            if (node.assignedBlock && (node.isHouseSystem !== false)) {
                globalExclusions.push({ min: node.assignedBlock.start, max: node.assignedBlock.end });
            }
        });
    }

    for (let i = 0; i < constant.length; i++) {
        const sys = constant[i];
        const zoneIdx = zoneConfigs.findIndex(z => z.name === sys.stageName);
        const newFreqs: Frequency[] = (sys.frequencies || []).filter(f => f.locked && f.value > 0);
        const buckets: {reqs: EquipmentRequest[], type: 'mic' | 'iem'}[] = [ { reqs: sys.micRequests || [], type: 'mic' }, { reqs: sys.iemRequests || [], type: 'iem' } ];
        for (const bucket of buckets) {
            for (const req of bucket.reqs) {
                const thresholds = req.useManualParams ? { fundamental: req.manualFundamental || 0.35, twoTone: req.manualTwoTone || 0.05, threeTone: req.manualThreeTone || 0.05, fiveTone: 0, sevenTone: 0 } : getFinalThresholds({ equipmentKey: req.equipmentKey, compatibilityLevel: req.compatibilityLevel }, db, globalOverrides);
                const profile = db[req.equipmentKey] || db['custom'];
                const minFreq = (req.equipmentKey === 'custom' && req.customMin) ? req.customMin : profile.minFreq;
                const maxFreq = (req.equipmentKey === 'custom' && req.customMax) ? req.customMax : profile.maxFreq;
                const targetToFind = Math.max(0, req.count - newFreqs.filter(f => f.sourceRequestId === req.id).length);
                
                // Determine actual type (respect WMAS)
                const actualType = profile?.type === 'wmas' ? 'wmas' : bucket.type;

                if (targetToFind > 0) {
                    const finalExclusions = getEquipmentAwareExclusions(globalExclusions, actualType, triStates, region);
                    let candidates = shuffleArray(getCandidates(minFreq, maxFreq, profile?.tuningStep || 0.025, finalExclusions, inclusionRanges || null));
                    let found = 0;
                    for (const val of candidates) {
                        if (found >= targetToFind) break;
                        if (isExhaustiveCompatibleMutual(val, thresholds, zoneIdx, siteFreqs, distances, db, globalOverrides, 10, req.linearMode, matrix).conflicts.length === 0) {
                            const f: Frequency = { id: `C-${runNonce}-${sys.stageName}-${newFreqs.length}`, label: sys.stageName, value: val, type: actualType, sourceRequestId: req.id, manualThresholds: req.useManualParams ? thresholds : undefined, equipmentKey: req.equipmentKey, source: 'constant' as const, zoneIndex: zoneIdx, locked: false, linearMode: req.linearMode };
                            newFreqs.push(f); siteFreqs.push(f); found++;
                            
                            // Prevent UI blocking every few placements
                            if (found % 10 === 0) await new Promise(r => setTimeout(r, 0));
                        }
                    }
                }
            }
        }
        results.push({ ...sys, frequencies: newFreqs });
        onProgress?.({ found: 0, processed: i + 1, total: constant.length, status: `Configuring ${sys.stageName}...` });
    }
    return results;
};

export const generateTourFrequencies = async (
    state: TourPlanningState,
    db: Record<string, EquipmentProfile>,
    equipmentOverrides: Record<string, Partial<Thresholds>>,
    onProgress?: (p: number) => void
): Promise<{ globalConstantFreqs: Frequency[], clusterResults: Record<string, { constantFreqs: Frequency[], localFreqs: Frequency[] }> }> => {
    const { constantSystems, clusters, region } = state;
    const clusterResults: Record<string, { constantFreqs: Frequency[], localFreqs: Frequency[] }> = {};

    if (onProgress) onProgress(0.05);

    // 1. Use Global TV Exclusions for Constant Transmits (Touring Rack)
    const globalTvStates: Record<number, TVChannelState> = state.globalTvChannelStates || {};

    // 2. Calculate Global Constant Transmits (Touring Rack)
    // We use the master constantSystems.frequencies as the starting point for locks
    const constantResults = await generateConstantFrequencies(
        [{ ...constantSystems, frequencies: constantSystems.frequencies || [] }],
        [], 
        [{ name: constantSystems.stageName, count: 0 }], 
        [[0]], 
        db,
        [], 
        [[true]], 
        undefined,
        null,
        equipmentOverrides,
        globalTvStates, 
        region
    );

    const globalConstantFreqs = constantResults[0].frequencies || [];
    
    if (onProgress) onProgress(0.2);

    if (clusters.length === 0) {
        if (onProgress) onProgress(1);
        return { globalConstantFreqs, clusterResults };
    }

    for (let i = 0; i < clusters.length; i++) {
        const cluster = clusters[i];
        
        // Use the global constants for this cluster
        const clusterConstantFreqs = globalConstantFreqs;

        // 2. Calculate Local Requests for THIS cluster
        const genRequests = cluster.localRequests.map(req => {
            const profile = db[req.equipmentKey] || db['custom'];
            const minFreq = (req.equipmentKey === 'custom' && req.customMin) ? req.customMin : profile.minFreq;
            const maxFreq = (req.equipmentKey === 'custom' && req.customMax) ? req.customMax : profile.maxFreq;
            const typeToUse = req.type || (profile?.type as TxType) || 'generic';

            return {
                id: req.id,
                key: req.equipmentKey,
                count: req.count,
                customMin: minFreq,
                customMax: maxFreq,
                compatibilityLevel: req.compatibilityLevel,
                linearMode: req.linearMode,
                useManualParams: req.useManualParams,
                manualFundamental: req.manualFundamental,
                manualTwoTone: req.manualTwoTone,
                manualThreeTone: req.manualThreeTone,
                type: typeToUse
            };
        });

        const lockedLocals = (cluster.localFrequencies || []).filter(f => f.locked);

        const clusterLocalFreqs = await resolveGeneratorRequests(
            genRequests,
            clusterConstantFreqs, 
            db,
            [], 
            null, 
            true, 
            false, 
            () => {}, 
            lockedLocals, 
            equipmentOverrides,
            undefined,
            false, 
            cluster.tvChannelStates,
            region
        );

        // resolveGeneratorRequests returns the full pool (lockedLocals + clusterConstantFreqs + newLocals)
        // We need to extract only the local ones
        const localOnly = clusterLocalFreqs.filter(f => !clusterConstantFreqs.some(cf => cf.id === f.id));

        clusterResults[cluster.id] = {
            constantFreqs: clusterConstantFreqs,
            localFreqs: localOnly
        };

        if (onProgress) onProgress(0.2 + ((i + 1) / clusters.length) * 0.8);
    }

    return { globalConstantFreqs, clusterResults };
};

export const generateHouseSystemsFrequencies = async (
    house: ConstantSystemRequest[], constants: ConstantSystemRequest[], zoneConfigs: ZoneConfig[], distances: number[][],
    db: Record<string, EquipmentProfile>, exclusions: { min: number, max: number }[], matrix: boolean[][], onProgress?: (p: any) => void,
    inclusionRanges?: { min: number, max: number }[] | null, globalOverrides?: Record<string, Partial<Thresholds>>, triStates?: Record<number, TVChannelState>, region: 'uk' | 'us' = 'uk',
    wmasState?: WMASState
): Promise<ConstantSystemRequest[]> => {
    const results: ConstantSystemRequest[] = [];
    const siteFreqs: Frequency[] = [];
    constants.forEach(s => s.frequencies?.forEach(f => { if (f.value > 0) siteFreqs.push(f); }));
    house.forEach(s => s.frequencies?.forEach(f => { if (f.locked && f.value > 0) siteFreqs.push(f); }));
    const runNonce = Math.random().toString(36).substring(2, 6).toUpperCase();

    const globalExclusions = [...exclusions];
    if (wmasState && wmasState.nodes) {
        wmasState.nodes.forEach(node => {
            if (node.assignedBlock && (node.isHouseSystem !== false)) {
                globalExclusions.push({ min: node.assignedBlock.start, max: node.assignedBlock.end });
            }
        });
    }

    for (let i = 0; i < house.length; i++) {
        const sys = house[i];
        const zoneIdx = zoneConfigs.findIndex(z => z.name === sys.stageName);
        const newFreqs: Frequency[] = (sys.frequencies || []).filter(f => f.locked && f.value > 0);
        const buckets: {reqs: EquipmentRequest[], type: 'mic' | 'iem'}[] = [ { reqs: sys.micRequests || [], type: 'mic' }, { reqs: sys.iemRequests || [], type: 'iem' } ];
        for (const bucket of buckets) {
            for (const req of bucket.reqs) {
                const thresholds = req.useManualParams ? { fundamental: req.manualFundamental || 0.35, twoTone: req.manualTwoTone || 0.05, threeTone: req.manualThreeTone || 0.05, fiveTone: 0, sevenTone: 0 } : getFinalThresholds({ equipmentKey: req.equipmentKey, compatibilityLevel: req.compatibilityLevel }, db, globalOverrides);
                const profile = db[req.equipmentKey] || db['custom'];
                const minFreq = (req.equipmentKey === 'custom' && req.customMin) ? req.customMin : profile.minFreq;
                const maxFreq = (req.equipmentKey === 'custom' && req.customMax) ? req.customMax : profile.maxFreq;
                const targetToFind = Math.max(0, req.count - newFreqs.filter(f => f.sourceRequestId === req.id).length);
                
                // Determine actual type (respect WMAS)
                const actualType = profile?.type === 'wmas' ? 'wmas' : bucket.type;

                if (targetToFind > 0) {
                    const finalExclusions = getEquipmentAwareExclusions(globalExclusions, actualType, triStates, region);
                    let candidates = shuffleArray(getCandidates(minFreq, maxFreq, profile?.tuningStep || 0.025, finalExclusions, inclusionRanges || null));
                    let found = 0;
                    for (const val of candidates) {
                        if (found >= targetToFind) break;
                        if (isExhaustiveCompatibleMutual(val, thresholds, zoneIdx, siteFreqs, distances, db, globalOverrides, 10, req.linearMode, matrix).conflicts.length === 0) {
                            const f: Frequency = { id: `H-${runNonce}-${sys.stageName}-${newFreqs.length}`, label: sys.stageName, value: val, type: actualType, sourceRequestId: req.id, manualThresholds: req.useManualParams ? thresholds : undefined, equipmentKey: req.equipmentKey, source: 'house' as const, zoneIndex: zoneIdx, locked: false, linearMode: req.linearMode };
                            newFreqs.push(f); siteFreqs.push(f); found++;
                            
                            // Yield to browser
                            if (found % 10 === 0) await new Promise(r => setTimeout(r, 0));
                        }
                    }
                }
            }
        }
        results.push({ ...sys, frequencies: newFreqs });
        onProgress?.({ found: 0, processed: i + 1, total: house.length, status: `Patching House ${sys.stageName}...` });
    }
    return results;
};

export const generateFestivalPlan = async (
    acts: FestivalAct[], constants: ConstantSystemRequest[], house: ConstantSystemRequest[], zoneConfigs: ZoneConfig[], distances: number[][],
    overlapMinutes: number, db: Record<string, EquipmentProfile>, exclusions: { min: number, max: number }[], matrix: boolean[][],
    onProgress?: (p: { found: number, processed: number, total: number, totalRequested: number, status?: string }) => void, onStatus?: (s: string) => void,
    inclusionRanges?: { min: number, max: number }[] | null, globalOverrides?: Record<string, Partial<Thresholds>>, triStates?: Record<number, TVChannelState>, region: 'uk' | 'us' = 'uk',
    wmasState?: WMASState
): Promise<{ results: FestivalAct[], report: OptimizationReport }> => {
    const resultsMap = new Map<string, FestivalAct>();
    const constantFreqs: Frequency[] = [];
    const houseFreqs: Frequency[] = [];
    const stats: BottleneckStats = { totalRejections: 0, fundamentalHits: 0, imd2Hits: 0, imd3Hits: 0, exclusionHits: 0, temporalSaturation: 0 };
    
    // First pass to count total frequency requests
    let totalRequested = 0;
    constants.forEach(s => { [...(s.micRequests || []), ...(s.iemRequests || [])].forEach(r => totalRequested += r.count); s.frequencies?.forEach(f => { if (f.value > 0) constantFreqs.push(f); }); });
    house.forEach(s => { [...(s.micRequests || []), ...(s.iemRequests || [])].forEach(r => totalRequested += r.count); s.frequencies?.forEach(f => { if (f.value > 0) houseFreqs.push(f); }); });
    acts.forEach(act => { [...(act.micRequests || []), ...(act.iemRequests || [])].forEach(r => totalRequested += r.count); });

    const runNonce = Math.random().toString(36).substring(2, 6).toUpperCase();
    const prioritySortedActs = [...acts].sort((a, b) => {
        const aDiff = [...a.micRequests, ...a.iemRequests].some(r => r.useManualParams || r.compatibilityLevel === 'aggressive') ? -1 : 1;
        const bDiff = [...b.micRequests, ...b.iemRequests].some(r => r.useManualParams || r.compatibilityLevel === 'aggressive') ? -1 : 1;
        return aDiff - bDiff;
    });

    let frequenciesProcessed = 0;
    
    for (let i = 0; i < prioritySortedActs.length; i++) {
        const act = prioritySortedActs[i];
        const stageIdx = zoneConfigs.findIndex(z => z.name === act.stage);
        const newFreqs: Frequency[] = (act.frequencies || []).filter(f => f.locked && f.value > 0);
        const buffer = overlapMinutes * 60000;
        const overlappingActs = Array.from(resultsMap.values()).filter(other => act.startTime.getTime() < (other.endTime.getTime() + buffer) && other.startTime.getTime() < (act.endTime.getTime() + buffer));
        const otherActsPool: Frequency[] = overlappingActs.flatMap(a => a.frequencies || []);
        const staticPool: Frequency[] = [...constantFreqs, ...houseFreqs];
        const requestTypes: {reqs: EquipmentRequest[], type: 'mic' | 'iem'}[] = [{ reqs: act.micRequests || [], type: 'mic' }, { reqs: act.iemRequests || [], type: 'iem' }];
        
        // Calculate relevant WMAS exclusions for THIS act
        const actExclusions = [...exclusions];
        if (wmasState && wmasState.nodes) {
            wmasState.nodes.forEach(node => {
                if (node.assignedBlock) {
                    let isExclusion = false;
                    if (node.isHouseSystem !== false) {
                        isExclusion = true; // Global
                    } else if (node.startTime && node.endTime) {
                        // Check for temporal overlap
                        const wmasStart = new Date(node.startTime).getTime();
                        const wmasEnd = new Date(node.endTime).getTime();
                        const actStart = act.startTime.getTime();
                        const actEnd = act.endTime.getTime();
                        
                        if (actStart < (wmasEnd + buffer) && wmasStart < (actEnd + buffer)) {
                            isExclusion = true;
                        }
                    }
                    
                    if (isExclusion) {
                        actExclusions.push({ min: node.assignedBlock.start, max: node.assignedBlock.end });
                    }
                }
            });
        }

        for (const bucket of requestTypes) {
            for (const req of bucket.reqs) {
                const thresholds = req.useManualParams ? { fundamental: req.manualFundamental || 0.35, twoTone: req.manualTwoTone || 0.05, threeTone: req.manualThreeTone || 0.05, fiveTone: 0, sevenTone: 0 } : getFinalThresholds({ equipmentKey: req.equipmentKey, compatibilityLevel: req.compatibilityLevel }, db, globalOverrides);
                const profile = db[req.equipmentKey] || db['custom'];
                const minFreq = (req.equipmentKey === 'custom' && req.customMin) ? req.customMin : profile.minFreq;
                const maxFreq = (req.equipmentKey === 'custom' && req.customMax) ? req.customMax : profile.maxFreq;
                const targetToFind = Math.max(0, req.count - newFreqs.filter(f => f.sourceRequestId === req.id).length);
                
                // Determine actual type (respect WMAS)
                const actualType = profile?.type === 'wmas' ? 'wmas' : bucket.type;

                if (targetToFind > 0) {
                    const finalExclusions = getEquipmentAwareExclusions(actExclusions, actualType, triStates, region);
                    let candidates = shuffleArray(getCandidates(minFreq, maxFreq, profile?.tuningStep || 0.025, finalExclusions, inclusionRanges || null));
                    let found = 0;
                    let checksSinceYield = 0;

                    for (const val of candidates) {
                        if (found >= targetToFind) break;
                        
                        // YIELD TO MAIN THREAD every 20 candidate checks
                        checksSinceYield++;
                        if (checksSinceYield >= 20) {
                            await new Promise(r => setTimeout(r, 0));
                            checksSinceYield = 0;
                        }

                        const validationPool = [...staticPool, ...otherActsPool, ...newFreqs];
                        if (isExhaustiveCompatibleMutual(val, thresholds, stageIdx, validationPool, distances, db, globalOverrides, 10, req.linearMode, matrix).conflicts.length === 0) {
                            const f: Frequency = { id: `A-${runNonce}-${act.actName.slice(0,3).toUpperCase()}-${newFreqs.length}`, label: `${act.actName} ${newFreqs.length + 1}`, value: val, type: actualType, sourceRequestId: req.id, manualThresholds: req.useManualParams ? thresholds : undefined, equipmentKey: req.equipmentKey, source: 'act' as const, zoneIndex: stageIdx, locked: false, linearMode: req.linearMode };
                            newFreqs.push(f); found++;
                            frequenciesProcessed++;
                            
                            // Update progress on placement
                            onProgress?.({ 
                                found: 0, 
                                processed: frequenciesProcessed, 
                                total: prioritySortedActs.length, 
                                totalRequested, 
                                status: `Allocating ${act.actName}...` 
                            });
                        } else { stats.totalRejections++; }
                    }
                    if (found < targetToFind) {
                        stats.temporalSaturation++;
                        // Still count shortfall as processed
                        frequenciesProcessed += (targetToFind - found);
                    }
                } else {
                    // Pre-existing or empty requests
                    frequenciesProcessed += req.count;
                }
            }
        }
        resultsMap.set(act.id, { ...act, frequencies: newFreqs });
        onProgress?.({ found: resultsMap.size, processed: frequenciesProcessed, total: acts.length, totalRequested, status: `Act ${i + 1}/${acts.length} Complete` });
    }

    const finalResults = acts.map(a => resultsMap.get(a.id)!);
    let totalFound = 0;
    constants.forEach(s => totalFound += (s.frequencies?.filter(f => f.value > 0).length || 0));
    house.forEach(s => totalFound += (s.frequencies?.filter(f => f.value > 0).length || 0));
    totalFound += finalResults.reduce((s, a) => s + (a.frequencies?.filter(f => f.value > 0).length || 0), 0);
    const report: OptimizationReport = { bottlenecks: stats, requested: totalRequested, found: totalFound, shortfall: Math.max(0, totalRequested - totalFound), suggestions: [], peakCongestionActs: finalResults.filter(a => (a.frequencies?.length || 0) < 1).map(a => a.actName) };
    return { results: finalResults, report };
};

export const validateFestivalCompatibility = (
    acts: FestivalAct[], constants: ConstantSystemRequest[], house: ConstantSystemRequest[], zoneConfigs: ZoneConfig[], distances: number[][],
    db: Record<string, EquipmentProfile>, matrix: boolean[][], overlapMinutes: number, globalOverrides?: Record<string, Partial<Thresholds>>,
    wmasState?: WMASState
): { conflicts: Conflict[] } => {
    const allConflicts: Conflict[] = [];
    const constantFreqs = constants.flatMap(s => s.frequencies || []);
    const houseFreqs = house.flatMap(s => s.frequencies || []);
    const ensureValidDate = (d: any): Date => { const parsed = new Date(d); return isNaN(parsed.getTime()) ? new Date() : parsed; };
    const checkAgainstPool = (target: Frequency, pool: Frequency[]) => {
        const th = target.manualThresholds || getFinalThresholds(target, db, globalOverrides);
        const zIdx = target.zoneIndex ?? 0;
        return isExhaustiveCompatibleMutual(target.value, th, zIdx, pool, distances, db, globalOverrides, 10, target.linearMode, matrix).conflicts;
    };
    acts.forEach(act => {
        if (!act.frequencies) return;
        const buffer = overlapMinutes * 60000;
        const othersAtTime = [ ...constantFreqs, ...houseFreqs, ...acts.filter(other => { if (other.id === act.id) return false; const otherStart = ensureValidDate(other.startTime); const otherEnd = ensureValidDate(other.endTime); const actStart = ensureValidDate(act.startTime); const actEnd = ensureValidDate(act.endTime); return actStart.getTime() < (otherEnd.getTime() + buffer) && otherStart.getTime() < (actEnd.getTime() + buffer); }).flatMap(a => a.frequencies || []) ];
        
        // Check against WMAS blocks
        if (wmasState && wmasState.nodes) {
            wmasState.nodes.forEach(node => {
                if (node.assignedBlock) {
                    let isExclusion = false;
                    if (node.isHouseSystem !== false) {
                        isExclusion = true;
                    } else if (node.startTime && node.endTime) {
                        const wmasStart = new Date(node.startTime).getTime();
                        const wmasEnd = new Date(node.endTime).getTime();
                        const actStart = ensureValidDate(act.startTime).getTime();
                        const actEnd = ensureValidDate(act.endTime).getTime();
                        if (actStart < (wmasEnd + buffer) && wmasStart < (actEnd + buffer)) {
                            isExclusion = true;
                        }
                    }

                    if (isExclusion) {
                        act.frequencies?.forEach(f => {
                            if (f.value >= node.assignedBlock!.start && f.value <= node.assignedBlock!.end) {
                                allConflicts.push({
                                    frequencyId: f.id,
                                    type: 'fundamental',
                                    message: `Frequency ${f.value.toFixed(3)} MHz falls within WMAS block ${node.name} (${node.assignedBlock!.start.toFixed(3)}-${node.assignedBlock!.end.toFixed(3)} MHz)`,
                                    conflictingFrequencyId: node.id,
                                    severity: 'critical',
                                    targetFreq: f,
                                    sceneName: act.actName
                                });
                            }
                        });
                    }
                }
            });
        }

        act.frequencies.forEach((f, i) => { if (f.value <= 0) return; const currentActPool = act.frequencies!.filter((_, idx) => idx !== i); const issues = checkAgainstPool(f, [...othersAtTime, ...currentActPool]); issues.forEach(issue => { allConflicts.push({ ...issue, targetFreq: f, sceneName: act.actName }); }); });
    });
    const statics = [...constantFreqs, ...houseFreqs];
    statics.forEach((f, i) => { if (f.value <= 0) return; const siteWidePool = [...statics.filter((_, idx) => idx !== i), ...acts.flatMap(a => a.frequencies || [])]; const issues = checkAgainstPool(f, siteWidePool); issues.forEach(issue => { allConflicts.push({ ...issue, targetFreq: f, sceneName: 'Static System' }); }); });
    return { conflicts: allConflicts };
};

export const calculateTalkbackIntermods = (sources: { value: number }[]): TalkbackIntermods => {
    const twoTone: IntermodProduct[] = []; const threeTone: IntermodProduct[] = [];
    const carriers = sources.map(s => s.value);
    for (let i = 0; i < carriers.length; i++) {
        for (let j = 0; j < carriers.length; j++) {
            if (i === j) continue;
            twoTone.push({ value: (2 * toHz(carriers[i]) - toHz(carriers[j])) / 1000000, sources: [carriers[i], carriers[j]], type: '2t' });
        }
    }
    for (let i = 0; i < carriers.length; i++) {
        for (let j = 0; j < carriers.length; j++) {
            if (i === j) continue;
            for (let k = 0; k < carriers.length; k++) {
                if (k === i || k === j) continue;
                threeTone.push({ value: (toHz(carriers[i]) + toHz(carriers[j]) - toHz(carriers[k])) / 1000000, sources: [carriers[i], carriers[j], carriers[k]], type: '3t' });
            }
        }
    }
    const seen = new Set<string>();
    const uniqueThreeTone = threeTone.filter(im => {
        const key = im.value.toFixed(6);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    return { twoTone, threeTone: uniqueThreeTone, fiveTone: [], sevenTone: [] };
};

export const generateZonalTalkbackPairs = async (
    configs: { name: string, pairCount: number, txBands: number[], rxBands: number[] }[],
    spacing: number, distances: number[][], matrix: boolean[][],
    previousResults: any, onProgress: (p: number) => void, mode: TalkbackMode = 'standard'
): Promise<ZonalResult[]> => {
    const results: ZonalResult[] = [];
    const globalFreqPool: (Frequency & { isTx?: boolean })[] = [];

    // Helper to verify a frequency is not in a forbidden regulatory range
    const isForbidden = (f: number) => TALKBACK_FORBIDDEN_RANGES.some(range => {
        // Disable 450-453 MHz AND 465-467 MHz forbidden zones in Mainland Europe mode
        if (mode === 'europe') {
            const is450Range = range.min >= 450 && range.max <= 453;
            const is465Range = range.min >= 465 && range.max <= 467;
            if (is450Range || is465Range) return false;
        }
        return f >= (range.min - 0.00001) && f <= (range.max + 0.00001);
    });
    
    // Extract existing locked frequencies with source context
    if (previousResults && Array.isArray(previousResults)) {
        previousResults.forEach((res: ZonalResult, zIdx: number) => {
            res.pairs.forEach(p => {
                if (p.locked && p.active !== false) {
                    // In 'europe' mode, the upper band (often the 'tx' property in our data) is Base (isTx: true)
                    // In 'standard' mode, the lower band (often the 'tx' property in our data) is Base (isTx: true)
                    // Logic: we designate one field as Base (Aggr) and one as Port (Victim)
                    globalFreqPool.push({ ...p, value: p.tx, id: p.id + '-tx', type: 'comms', zoneIndex: zIdx, isTx: true });
                    globalFreqPool.push({ ...p, value: p.rx, id: p.id + '-rx', type: 'comms', zoneIndex: zIdx, isTx: false });
                }
            });
        });
    }

    for (let i = 0; i < configs.length; i++) {
        const cfg = configs[i]; 
        const zonePairs: DuplexPair[] = []; 
        let candidatePool: { tx: number, rx: number }[] = [];
        
        const txFreqPool: number[] = [];
        cfg.txBands.forEach(txB => { 
            const partner = TALKBACK_FIXED_PAIRS[txB]; 
            if (partner && cfg.rxBands.includes(partner)) { 
                // Skip adding to txFreqPool, we will use discrete pairs
            } else {
                const def = TALKBACK_DEFINITIONS[txB]; 
                if (def) {
                    for (let f = def.min; f <= def.max + 0.000001; f += 0.0125) {
                        const freqVal = parseFloat(f.toFixed(5));
                        if (!isForbidden(freqVal)) txFreqPool.push(freqVal);
                    }
                }
            }
        });
        
        const rxFreqPool: number[] = [];
        cfg.rxBands.forEach(rxB => { 
            const isPartner = Array.from(cfg.txBands).some(txB => TALKBACK_FIXED_PAIRS[txB] === rxB);
            if (isPartner) {
                // Skip adding to rxFreqPool
            } else {
                const def = TALKBACK_DEFINITIONS[rxB]; 
                if (def) {
                    for (let f = def.min; f <= def.max + 0.000001; f += 0.0125) {
                        const freqVal = parseFloat(f.toFixed(5));
                        if (!isForbidden(freqVal)) rxFreqPool.push(freqVal);
                    }
                }
            }
        });
        
        cfg.txBands.forEach(txB => { 
            const partner = TALKBACK_FIXED_PAIRS[txB]; 
            if (partner && cfg.rxBands.includes(partner)) { 
                const discrete = DISCRETE_TALKBACK_PAIRS[txB]; 
                if (discrete) {
                    discrete.forEach(pair => {
                        if (!isForbidden(pair.tx) && !isForbidden(pair.rx)) {
                            candidatePool.push(pair);
                        }
                    });
                }
            } 
        });
        
        const sTx = shuffleArray(txFreqPool); 
        const sRx = shuffleArray(rxFreqPool);
        
        if (sTx.length > 0 && sRx.length > 0) {
            for (let j = 0; j < Math.min(sTx.length, 3000); j++) candidatePool.push({ tx: sTx[j], rx: sRx[j % sRx.length] });
        }
        
        candidatePool = shuffleArray(candidatePool);
        let batchCounter = 0;
        
        for (const cand of candidatePool) {
            if (zonePairs.length >= cfg.pairCount) break;
            batchCounter++;
            
            if (batchCounter % 100 === 0) { 
                await new Promise(resolve => setTimeout(resolve, 0)); 
                onProgress(((i / configs.length) + (batchCounter / candidatePool.length / configs.length))); 
            }
            
            // PHYSICS RULE: tx is designated as Base/Aggressor, rx as Portable/Victim
            const txComp = isTalkbackCompatibleMutual(cand.tx, globalFreqPool, distances, i, matrix, true);
            if (txComp.conflicts.length > 0) continue;
            
            const tempPool = [...globalFreqPool, { value: cand.tx, id: 'temp-tx', zoneIndex: i, isTx: true, type: 'comms' as TxType }];
            const rxComp = isTalkbackCompatibleMutual(cand.rx, tempPool, distances, i, matrix, false);
            
            if (rxComp.conflicts.length === 0) {
                const pair: DuplexPair = { 
                    id: `ZP-${i}-${zonePairs.length}-${Math.random().toString(36).substring(2, 5)}`, 
                    label: `${cfg.name.slice(0,2).toUpperCase()} P${zonePairs.length + 1}`, 
                    tx: cand.tx, 
                    rx: cand.rx, 
                    groupName: cfg.name, 
                    locked: false, 
                    active: true 
                };
                zonePairs.push(pair); 
                globalFreqPool.push({ ...pair, value: pair.tx, id: pair.id + '-tx', zoneIndex: i, isTx: true }); 
                globalFreqPool.push({ ...pair, value: pair.rx, id: pair.id + '-rx', zoneIndex: i, isTx: false });
            }
        }
        results.push({ zoneName: cfg.name, pairs: zonePairs, failedCount: Math.max(0, cfg.pairCount - zonePairs.length) });
        onProgress((i + 1) / configs.length);
    }
    return results;
};
