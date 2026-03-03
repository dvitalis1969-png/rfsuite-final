

// FIX: Add 'mic' to TxType to allow assignment from EquipmentProfile.type
export type TxType = 'generic' | 'iem' | 'comms' | 'mic' | 'wmas';

export type TVChannelState = 'available' | 'mic-only' | 'iem-only' | 'blocked';

export type TalkbackMode = 'standard' | 'europe';

export interface Frequency {
  id: string;
  value: number;
  label?: string;
  locked?: boolean;
  type?: TxType;
  equipmentKey?: string;
  compatibilityLevel?: CompatibilityLevel;
  sourceRequestId?: string;
  generationParams?: string;
  source?: 'house' | 'act' | 'constant';
  manualThresholds?: Thresholds;
  zoneIndex?: number; // Added for zonal distance-aware coordination
  linearMode?: boolean; // Bypass 12.5kHz IMD safety floor
}

export interface Thresholds {
  fundamental: number;
  twoTone: number;
  threeTone: number;
  fiveTone: number;
  sevenTone: number;
}

export interface Conflict {
  type: string;
  product?: number;
  sourceFreqs?: { id: string, value: number, type?: TxType, label?: string }[];
  targetFreq: { id: string, value: number, type?: TxType, label?: string };
  diff?: number;
  sceneName?: string;
  // Festival Coordination Extensions
  frequencyId?: string;
  message?: string;
  conflictingFrequencyId?: string;
  severity?: 'warning' | 'critical';
}

export interface AnalysisResult {
  conflicts: Conflict[];
  totalChecks: number;
}

export interface EquipmentProfile {
    id?: string;
    isCustom?: boolean;
    name: string;
    band: string;
    minFreq: number;
    maxFreq: number;
    tuningStep: number;
    recommendedThresholds?: Partial<Thresholds>;
    compatibilityOverrides?: Partial<Record<CompatibilityLevel, Partial<Thresholds>>>;
    type?: 'mic' | 'iem' | 'generic' | 'comms' | 'wmas';
    affiliateUrl?: string;
}

export type TabID = 'analyzer' | 'generator' | 'whitespace' | 'spectrum' | 'waterfall' | 'multiband' | 'talkback' | 'zonalTalkback' | 'multizone' | 'multistage' | 'siteMap' | 'festivalSiteMap' | 'multizoneSiteMap' | 'timeline' | 'festival' 
  | 'linkBudget' | 'audioTone' | 'fspl' | 'powerConverter' | 'fresnelZone' | 'antennaDownTilt' | 'cableLoss' | 'lineOfSight' | 'vswr' | 'imdDemo' | 'iemStudy' | 'diversityPlacement' | 'interference' | 'equipmentDatabase' | 'userGuide' | 'tourPlanning' | 'wmas';

// FIX: Added 'multizone' to AppCategory to resolve assignment errors in Header and Tabs
export type AppCategory = 'calculator' | 'coordination' | 'analysis' | 'comms' | 'toolkit' | 'hardware' | 'multizone' | 'tour' | 'wmas';

export interface IntermodProduct {
    value: number;
    sources: number[];
    type: string;
}

export interface TalkbackIntermods {
    twoTone: IntermodProduct[];
    threeTone: IntermodProduct[];
    fiveTone: IntermodProduct[];
    sevenTone: IntermodProduct[];
}

export interface Zone {
  name: string;
  frequencies: Frequency[];
}

export interface ZoneConfig {
    name: string;
    count: number;
    equipmentKey?: string;
    compatibilityLevel?: CompatibilityLevel;
    zoneIndex?: number; // Target zone in the physical layout
    useManualParams?: boolean;
    manualFundamental?: number;
    manualTwoTone?: number;
    manualThreeTone?: number;
    customMin?: number;
    customMax?: number;
    linearMode?: boolean; // Bypass IMD Floor
    type?: TxType;
}

export interface SiteMapState {
  image: string | null;
  positions: { x: number; y: number }[];
  scale: { pixels: number; meters: number } | null;
}

export interface ScanDataPoint {
    freq: number;
    amp: number;
}

export type CompatibilityLevel = 'aggressive' | 'standard' | 'robust';

export interface Scene {
    id: string;
    name: string;
    activeFrequencyIds: Set<string>;
}

export interface EquipmentRequest {
    id: string;
    equipmentKey: string;
    count: number;
    compatibilityLevel: CompatibilityLevel;
    customMin?: number;
    customMax?: number;
    useManualParams?: boolean;
    manualFundamental?: number;
    manualTwoTone?: number;
    // FIX: Added manualThreeTone to EquipmentRequest to resolve property access errors
    manualThreeTone?: number;
    linearMode?: boolean;
    type?: TxType;
}

export interface FestivalAct {
    id: string;
    stage: string;
    actName: string;
    startTime: Date;
    endTime: Date;
    micRequests: EquipmentRequest[];
    iemRequests: EquipmentRequest[];
    frequencies?: Frequency[];
    parseError?: string;
    active: boolean;
    linkedActIds?: string[];
}

export interface ConstantSystemRequest {
    stageName: string;
    micRequests: EquipmentRequest[];
    iemRequests: EquipmentRequest[];
    frequencies?: Frequency[];
}

export interface BottleneckStats {
    totalRejections: number;
    fundamentalHits: number;
    imd2Hits: number;
    imd3Hits: number;
    exclusionHits: number;
    temporalSaturation: number;
}

export interface OptimizationSuggestion {
    category: 'Symmetry' | 'Parameters' | 'Stages' | 'Timeline' | 'Spectrum';
    severity: 'high' | 'medium' | 'low';
    message: string;
    action: string;
    shadowResult?: string[];
}

export interface OptimizationReport {
    bottlenecks: BottleneckStats;
    suggestions: OptimizationSuggestion[];
    peakCongestionActs: string[];
    requested: number;
    found: number;
    shortfall: number;
    analysisMessage?: string;
}

export interface PlotState {
    frequencies: Frequency[];
    range: { min: number; max: number };
    scanData: ScanDataPoint[] | null;
    noiseFloor: number;
    displayMode: 'line' | 'filled';
    overlayChannels: boolean;
    region: string;
    isFestivalMode: boolean;
    selectedActIds: string[];
}

export interface Plot {
    id?: number;
    projectId: number;
    name: string;
    createdAt: Date;
    data: PlotState;
}

export interface FrequencySnapshot {
    id: string;
    name: string;
    createdAt: Date;
    frequencies: Frequency[];
}

export interface DuplexPair {
  id: string;
  label: string;
  tx: number;
  rx: number;
  groupName: string;
  locked: boolean;
  active?: boolean;
}

export interface TalkbackSolution {
    pairs: DuplexPair[];
    failedCount: number;
    score: number;
}

export interface ZonalResult {
    zoneName: string;
    pairs: DuplexPair[];
    failedCount: number;
}

export interface BandState {
    id: string;
    min: string;
    max: string;
    count: string;
    equipmentKey: string;
    compatibilityLevel: CompatibilityLevel;
    useManual: boolean;
    manualParams: {
        fundamental: string;
        twoTone: string;
        threeTone: string;
    };
    type?: TxType;
}

export interface BandResult {
    name: string;
    range: string;
    frequencies: Frequency[];
    params: string;
}

export interface GeneratorRequest {
    id: number | string;
    key: string;
    count: string | number;
    customMin: string | number;
    customMax: string | number;
    compatibilityLevel: CompatibilityLevel;
    label?: string;
    useManualParams?: boolean;
    manualFundamental?: string | number;
    manualTwoTone?: string | number;
    manualThreeTone?: string | number;
    generationParams?: string;
    linearMode?: boolean;
    type?: TxType;
}

export interface CommsAppState {
    numZones: number;
    zoneConfigs: ZoneConfig[];
    distances: number[][];
    compatibilityMatrix: boolean[][];
    siteMapState: SiteMapState;
    manualPairs: DuplexPair[];
    results: DuplexPair[] | null;
    mode?: TalkbackMode;
}

export interface FestivalPlanningState {
    numZones: number;
    zoneConfigs: ZoneConfig[];
    distances: number[][];
    acts: FestivalAct[];
    constantSystems: ConstantSystemRequest[];
    houseSystems: ConstantSystemRequest[];
    siteMapState: SiteMapState;
    compatibilityMatrix: boolean[][];
    tvChannelStates?: Record<number, TVChannelState>;
}

export interface MultizonePlanningState {
    numZones: number;
    zoneConfigs: ZoneConfig[]; // Physical zone data
    equipmentGroups?: ZoneConfig[]; // Deployment gear requests
    manualFrequencies?: Frequency[]; // Fixed frequencies
    distances: number[][];
    results: { zones: Zone[], spares: { mics: Frequency[], iems: Frequency[] } } | null;
    siteMapState: SiteMapState;
    compatibilityMatrix: boolean[][];
    tvChannelStates?: Record<number, TVChannelState>;
}

export interface TourStop {
    id: string;
    location: string;
    date: Date;
    clusterId?: string;
}

export interface TourCluster {
    id: string;
    name: string;
    tvChannelStates: Record<number, TVChannelState>;
    localRequests: EquipmentRequest[];
    localFrequencies?: Frequency[];
    constantFrequencies?: Frequency[];
}

export interface TourPlanningState {
    constantSystems: ConstantSystemRequest;
    globalTvChannelStates?: Record<number, TVChannelState>;
    stops: TourStop[];
    clusters: TourCluster[];
    region: 'uk' | 'us';
}

export type WMASMode = 'low-latency' | 'standard' | 'high-density';

export interface WMASProfile {
    id: string;
    name: string;
    bandwidthMHz: number;
    maxLinks: Record<WMASMode, number>;
}

export interface WMASNode {
    id: string;
    name: string;
    profileId: string;
    mode: WMASMode;
    linksRequired: number;
    assignedBlock?: { start: number; end: number; tvChannel?: number };
    isHouseSystem?: boolean;
    actName?: string;
    stage?: string;
    startTime?: Date;
    endTime?: Date;
}

export interface WMASState {
    nodes: WMASNode[];
    tvRegion: 'uk' | 'us';
}

export interface AppState {
    activeTab: TabID;
    activeApp?: AppCategory | null;
    isSunlightMode?: boolean; 
    frequencies: Frequency[];
    thresholds: Thresholds;
    generatorFrequencies: Frequency[] | null;
    festivalState?: FestivalPlanningState;
    multizoneState?: MultizonePlanningState;
    scanData: ScanDataPoint[] | null;
    inclusionRanges: { min: number; max: number }[] | null;
    snapshots: FrequencySnapshot[];
    scenes: Scene[];
    multiBandState?: { bands: BandState[]; results: BandResult[] | null };
    tourPlanningState?: TourPlanningState;
    wmasState?: WMASState;
    generatorState?: { 
        requests: GeneratorRequest[]; 
        exclusions: string;
        useGlobalThresholds: boolean;
        globalThresholds: { fundamental: string; twoTone: string; threeTone: string };
        manualConstraints?: Frequency[]; 
        ignoreManualIMD?: boolean;
        tvChannelStates?: Record<number, TVChannelState>;
        tvRegion?: 'uk' | 'us';
    };
    equipmentOverrides?: Record<string, Partial<Thresholds>>;
    commsState?: CommsAppState;
    numZones?: number;
    zoneConfigs?: ZoneConfig[];
    distances?: number[][];
    results?: any;
    siteMapState?: any;
    festivalActs?: any;
    constantSystems?: any;
    houseSystems?: any;
}

export interface Project {
    id: number;
    name: string;
    lastModified: Date;
    data: AppState;
}