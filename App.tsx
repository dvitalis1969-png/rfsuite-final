
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { TabID, Frequency, Thresholds, Zone, ZoneConfig, AppState, Project, EquipmentProfile, SiteMapState, ScanDataPoint, Scene, FestivalAct, CompatibilityLevel, ConstantSystemRequest, AppCategory, FrequencySnapshot, BandState, BandResult, GeneratorRequest, DuplexPair, CommsAppState, FestivalPlanningState, MultizonePlanningState, ZonalResult, TVChannelState, TourPlanningState, WMASState } from './types';
import Header from './components/Header';
import Tabs, { tabConfig } from './components/Tabs';
import AnalyzerTab from './components/AnalyzerTab';
import GeneratorTab from './components/GeneratorTab';
import WhiteSpaceTab from './components/WhiteSpaceTab';
import SpectrumTab from './components/SpectrumTab';
import WaterfallTab from './components/WaterfallTab';
import MultiBandTab from './components/MultiBandTab';
import TalkbackTab from './components/TalkbackTab';
import ZonalTalkbackTab from './components/ZonalTalkbackTab';
import MultizoneTab from './components/MultizoneTab';
import SiteMapTab from './components/SiteMapTab';
import TimelineTab from './components/TimelineTab';
import FestivalCoordinationTab from './components/FestivalCoordinationTab';
import EquipmentDatabaseTab from './components/EquipmentDatabaseTab';
import CustomEquipmentManager from './components/CustomEquipmentManager';
import AppLauncher from './components/AppLauncher';
import LandingPage from './components/LandingPage';
import ProjectDashboard from './components/ProjectDashboard';
import UserGuideTab from './components/UserGuideTab';
import TourPlanningTab from './components/TourPlanningTab';
import WMASTab from './components/WMASTab';
import ErrorBoundary from './components/ErrorBoundary';
import AuthModal from './components/AuthModal';
import AccountDashboard from './components/AccountDashboard';

// RF Toolkit Component Imports
import IEMStudyTab from './components/IEMStudyTab';
import InterferenceDemoTab from './components/InterferenceDemoTab';
import IMDDemoTab from './components/IMDDemoTab';
import DiversityPlacementTab from './components/DiversityPlacementTab';
import LinkBudgetTab from './components/LinkBudgetTab';
import AntennaDownTiltTab from './components/AntennaDownTiltTab';
import CableLossTab from './components/CableLossTab';
import LineOfSightTab from './components/LineOfSightTab';
import VSWRTab from './components/VSWRTab';
import FSPLTab from './components/FSPLTab';
import PowerConverterTab from './components/PowerConverterTab';
import FresnelZoneTab from './components/FresnelZoneTab';
import AudioToneGeneratorTab from './components/AudioToneGeneratorTab';

import * as dbService from './services/dbService';
import { exportToJson } from './services/fileService';

const initialFrequencies: Frequency[] = Array.from({ length: 8 }, (_, i) => ({
    id: `F${i + 1}`, value: 0, label: '', locked: false, type: 'generic'
}));

const initialThresholds: Thresholds = {
    fundamental: 0.350, twoTone: 0.050, threeTone: 0.050, fiveTone: 0.025, sevenTone: 0.025,
};

const initialSiteMapState: SiteMapState = { image: null, positions: [], scale: null };

const initialFestivalState: FestivalPlanningState = {
    numZones: 2,
    zoneConfigs: [
        { name: 'Main Stage', count: 8, compatibilityLevel: 'standard' }, 
        { name: 'Second Stage', count: 4, compatibilityLevel: 'standard' }
    ],
    distances: Array(2).fill(0).map((_, i) => Array(2).fill(0).map((_, j) => (i === j ? 0 : 0.1))),
    acts: [],
    constantSystems: [{ stageName: 'Main Stage', micRequests: [], iemRequests: [], frequencies: [] }, { stageName: 'Second Stage', micRequests: [], iemRequests: [], frequencies: [] }],
    houseSystems: [{ stageName: 'Main Stage', micRequests: [], iemRequests: [], frequencies: [] }, { stageName: 'Second Stage', micRequests: [], iemRequests: [], frequencies: [] }],
    siteMapState: initialSiteMapState,
    compatibilityMatrix: Array(2).fill(false).map(() => Array(2).fill(false)),
    tvChannelStates: {}
};

const initialMultizoneState: MultizonePlanningState = {
    numZones: 2,
    zoneConfigs: [
        { name: 'Zone 1', count: 0 }, 
        { name: 'Zone 2', count: 0 }
    ],
    equipmentGroups: [
        { name: 'Mics Zone 1', count: 8, equipmentKey: 'shure-ad-g56', zoneIndex: 0, compatibilityLevel: 'standard' },
        { name: 'Mics Zone 2', count: 8, equipmentKey: 'shure-ad-g56', zoneIndex: 1, compatibilityLevel: 'standard' }
    ],
    manualFrequencies: [],
    distances: Array(2).fill(0).map((_, i) => Array(2).fill(0).map((_, j) => i === j ? 0 : 0.1)),
    results: null,
    siteMapState: initialSiteMapState,
    compatibilityMatrix: Array(2).fill(false).map(() => Array(2).fill(false)),
    tvChannelStates: {}
};

const initialBandState: BandState = { id: `band-init`, min: '470.000', max: '550.000', count: '6', equipmentKey: 'custom', compatibilityLevel: 'standard', useManual: false, manualParams: { fundamental: '0.350', twoTone: '0.050', threeTone: '0.050' } };
const initialGeneratorRequests: GeneratorRequest[] = [{ id: Date.now(), key: 'shure-ad-g56', count: '8', customMin: '470.000', customMax: '636.000', compatibilityLevel: 'standard' }];
const initialCommsState: CommsAppState = { numZones: 2, zoneConfigs: [{ name: 'Zone 1', count: 4 }, { name: 'Zone 2', count: 4 }], distances: [[0, 0.1], [0.1, 0]], compatibilityMatrix: Array(2).fill(false).map(() => Array(2).fill(false)), siteMapState: { image: null, positions: [], scale: null }, manualPairs: [], results: null };

const initialTourPlanningState: TourPlanningState = {
    constantSystems: { stageName: 'Touring Rack', micRequests: [], iemRequests: [], frequencies: [] },
    globalTvChannelStates: {},
    stops: [],
    clusters: [],
    region: 'uk'
};

const initialWMASState: WMASState = {
    nodes: [],
    tvRegion: 'uk'
};

const initialState: AppState = {
    activeTab: 'analyzer', activeApp: null, isSunlightMode: false, frequencies: initialFrequencies, thresholds: initialThresholds,
    generatorFrequencies: null, 
    festivalState: initialFestivalState,
    multizoneState: initialMultizoneState,
    tourPlanningState: initialTourPlanningState,
    wmasState: initialWMASState,
    scanData: null, inclusionRanges: null, snapshots: [], scenes: [],
    multiBandState: { bands: [initialBandState], results: null },
    generatorState: { requests: initialGeneratorRequests, exclusions: '', useGlobalThresholds: false, globalThresholds: { fundamental: '0.350', twoTone: '0.050', threeTone: '0.050' }, manualConstraints: [], ignoreManualIMD: false, tvChannelStates: {}, tvRegion: 'uk' },
    commsState: initialCommsState
};

const hydrateDate = (d: any): Date => {
    if (!d) return new Date();
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
};

const App: React.FC = () => {
    const [isDbReady, setIsDbReady] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('rf_pro_auth') === 'true');
    const [currentProject, setCurrentProject] = useState<Project | null>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'no-project'>('idle');
    const isProjectLoading = useRef(false);
    const isLibraryLoaded = useRef(false);

    const [activeApp, setActiveApp] = useState<AppCategory | null>(null);
    const [activeTab, setActiveTab] = useState<TabID>('analyzer');
    const [isSunlightMode, setIsSunlightMode] = useState(false);
    
    const [frequencies, setFrequencies] = useState<Frequency[]>(initialFrequencies);
    const [thresholds, setThresholds] = useState<Thresholds>(initialThresholds);
    const [generatorFrequencies, setGeneratorFrequencies] = useState<Frequency[] | null>(null);
    
    const [equipmentOverrides, setEquipmentOverrides] = useState<Record<string, Partial<Thresholds>>>({});
    const [customEquipment, setCustomEquipment] = useState<EquipmentProfile[]>([]);
    
    const [festivalNumZones, setFestivalNumZones] = useState(initialFestivalState.numZones);
    const [festivalZoneConfigs, setFestivalZoneConfigs] = useState(initialFestivalState.zoneConfigs);
    const [festivalDistances, setFestivalDistances] = useState(initialFestivalState.distances);
    const [festivalActs, setFestivalActs] = useState<FestivalAct[]>(initialFestivalState.acts);
    const [festivalConstantSystems, setFestivalConstantSystems] = useState<ConstantSystemRequest[]>(initialFestivalState.constantSystems);
    const [festivalHouseSystems, setFestivalHouseSystems] = useState<ConstantSystemRequest[]>(initialFestivalState.houseSystems);
    const [festivalSiteMap, setFestivalSiteMap] = useState<SiteMapState>(initialFestivalState.siteMapState);
    const [festivalMatrix, setFestivalMatrix] = useState<boolean[][]>(initialFestivalState.compatibilityMatrix);
    const [festivalTvStates, setFestivalTvStates] = useState<Record<number, TVChannelState>>(initialFestivalState.tvChannelStates || {});

    const [multizoneNumZones, setMultizoneNumZones] = useState(initialMultizoneState.numZones);
    const [multizoneZoneConfigs, setMultizoneZoneConfigs] = useState(initialMultizoneState.zoneConfigs);
    const [multizoneGroups, setMultizoneGroups] = useState(initialMultizoneState.equipmentGroups || []);
    const [multizoneManualFrequencies, setMultizoneManualFrequencies] = useState<Frequency[]>(initialMultizoneState.manualFrequencies || []);
    const [multizoneDistances, setMultizoneDistances] = useState(initialMultizoneState.distances);
    const [multizoneResults, setMultizoneResults] = useState(initialMultizoneState.results);
    const [multizoneSiteMap, setMultizoneSiteMap] = useState<SiteMapState>(initialMultizoneState.siteMapState);
    const [multizoneMatrix, setMultizoneMatrix] = useState<boolean[][]>(initialMultizoneState.compatibilityMatrix);
    const [multizoneTvStates, setMultizoneTvStates] = useState<Record<number, TVChannelState>>(initialMultizoneState.tvChannelStates || {});

    const [commsNumZones, setCommsNumZones] = useState(initialCommsState.numZones);
    const [commsZoneConfigs, setCommsZoneConfigs] = useState<ZoneConfig[]>(initialCommsState.zoneConfigs);
    const [commsDistances, setCommsDistances] = useState<number[][]>(initialCommsState.distances);
    const [commsCompatibilityMatrix, setCommsCompatibilityMatrix] = useState<boolean[][]>(initialCommsState.compatibilityMatrix);
    const [commsSiteMapState, setCommsSiteMapState] = useState<SiteMapState>(initialCommsState.siteMapState);
    const [tbManualPairs, setTbManualPairs] = useState<DuplexPair[]>(initialCommsState.manualPairs);
    const [tbResults, setTbResults] = useState<DuplexPair[] | null>(initialCommsState.results);
    const [zonalResults, setZonalResults] = useState<ZonalResult[] | null>(null);

    const [scanData, setScanData] = useState<ScanDataPoint[] | null>(null);
    const [inclusionRanges, setInclusionRanges] = useState<{ min: number; max: number }[] | null>(null);
    const [scenes, setScenes] = useState<Scene[]>([]);
    const [snapshots, setSnapshots] = useState<FrequencySnapshot[]>([]);
    const [mbBands, setMbBands] = useState<BandState[]>([initialBandState]);
    const [mbResults, setMbResults] = useState<BandResult[] | null>(null);
    
    const [genRequests, setGenRequests] = useState<GeneratorRequest[]>(initialGeneratorRequests);
    const [genExclusions, setGenExclusions] = useState<string>('');
    const [genUseGlobalThresholds, setGenUseGlobalThresholds] = useState(false);
    const [genGlobalThresholds, setGenGlobalThresholds] = useState({ fundamental: '0.350', twoTone: '0.050', threeTone: '0.050' });
    const [genManualConstraints, setGenManualConstraints] = useState<Frequency[]>([]);
    const [genIgnoreManualIMD, setGenIgnoreManualIMD] = useState(false);
    const [genSiteThresholds, setGenSiteThresholds] = useState<Thresholds>({ fundamental: 0.350, twoTone: 0.050, threeTone: 0.050, fiveTone: 0, sevenTone: 0 });
    const [genTvStates, setGenTvStates] = useState<Record<number, TVChannelState>>(initialState.generatorState?.tvChannelStates || {});
    const [genTvRegion, setGenTvRegion] = useState<'uk' | 'us'>(initialState.generatorState?.tvRegion || 'uk');

    const [tourPlanningState, setTourPlanningState] = useState<TourPlanningState>(initialTourPlanningState);
    const [wmasState, setWmasState] = useState<WMASState>(initialWMASState);

    const [isProjectDashboardOpen, setProjectDashboardOpen] = useState(false);
    const [isCustomEquipmentManagerOpen, setCustomEquipmentManagerOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isAccountDashboardOpen, setIsAccountDashboardOpen] = useState(false);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        if (isSunlightMode) document.documentElement.classList.add('sunlight-mode');
        else document.documentElement.classList.remove('sunlight-mode');
    }, [isSunlightMode]);

    useEffect(() => {
        const init = async () => {
            const ready = await dbService.initDB();
            if (ready) {
                const globalOverrides = await dbService.getGlobalOverrides();
                if (globalOverrides) setEquipmentOverrides(globalOverrides);
                const profiles = await dbService.getCustomEquipment();
                setCustomEquipment(profiles);
                isLibraryLoaded.current = true;
                const lastId = await dbService.getLastProjectId();
                if (lastId) {
                    const project = await dbService.getProject(lastId);
                    if (project) {
                        setCurrentProject(project);
                        loadAppState(project.data);
                    } else { setProjectDashboardOpen(true); }
                } else { setProjectDashboardOpen(true); }
                setIsDbReady(true);
            }
        };
        init();
    }, []);

    useEffect(() => {
        if (activeApp) {
            const currentTabConfig = tabConfig.find(t => t.id === activeTab && t.category === activeApp);
            if (!currentTabConfig && activeTab !== 'userGuide') {
                const firstValidTab = tabConfig.find(t => t.category === activeApp);
                if (firstValidTab) setActiveTab(firstValidTab.id);
            }
        }
    }, [activeApp, activeTab]);

    useEffect(() => {
        if (!isDbReady || isProjectLoading.current || !isLibraryLoaded.current) return;
        const syncTimer = setTimeout(() => {
            dbService.saveGlobalOverrides(equipmentOverrides);
        }, 1000);
        return () => clearTimeout(syncTimer);
    }, [equipmentOverrides, isDbReady]);

    useEffect(() => {
        if (isProjectLoading.current) return;
        setFestivalZoneConfigs(prev => {
            const currentArr = Array.isArray(prev) ? prev : [];
            if (currentArr.length === festivalNumZones) return currentArr;
            if (currentArr.length < festivalNumZones) {
                const added = Array.from({ length: festivalNumZones - currentArr.length }, (_, i) => ({
                    name: `Stage ${currentArr.length + i + 1}`,
                    count: 8,
                    compatibilityLevel: 'standard' as const
                }));
                return [...currentArr, ...added];
            }
            return currentArr.slice(0, festivalNumZones);
        });
        setFestivalDistances(prev => {
            const currentArr = Array.isArray(prev) ? prev : [];
            if (currentArr.length === festivalNumZones) return currentArr;
            const newDist: number[][] = Array(festivalNumZones).fill(0).map((_, i) => 
                Array(festivalNumZones).fill(0).map((_, j) => i === j ? 0 : 0.1)
            );
            for (let i = 0; i < Math.min(currentArr.length, festivalNumZones); i++) {
                for (let j = 0; j < Math.min(currentArr.length, festivalNumZones); j++) {
                    newDist[i][j] = currentArr[i][j];
                }
            }
            return newDist;
        });
        setFestivalMatrix(prev => {
            const currentArr = Array.isArray(prev) ? prev : [];
            if (currentArr.length === festivalNumZones) return currentArr;
            const newMatrix = Array(festivalNumZones).fill(false).map(() => Array(festivalNumZones).fill(false));
            for (let i = 0; i < Math.min(currentArr.length, festivalNumZones); i++) {
                for (let j = 0; j < Math.min(currentArr.length, festivalNumZones); j++) {
                    newMatrix[i][j] = currentArr[i][j] || false;
                }
            }
            return newMatrix;
        });
    }, [festivalNumZones]);

    useEffect(() => {
        if (isProjectLoading.current) return;
        setMultizoneZoneConfigs(prev => {
            const currentArr = Array.isArray(prev) ? prev : [];
            if (currentArr.length === multizoneNumZones) return currentArr;
            if (currentArr.length < multizoneNumZones) {
                const added = Array.from({ length: multizoneNumZones - currentArr.length }, (_, i) => ({ name: `Zone ${currentArr.length + i + 1}`, count: 0 }));
                return [...currentArr, ...added];
            }
            return currentArr.slice(0, multizoneNumZones);
        });
        setMultizoneGroups(prev => {
            const currentArr = Array.isArray(prev) ? prev : [];
            if (currentArr.length === multizoneNumZones) return currentArr;
            if (currentArr.length < multizoneNumZones) {
                const added = Array.from({ length: multizoneNumZones - currentArr.length }, (_, i) => ({ name: `Mics Zone ${currentArr.length + i + 1}`, count: 8, equipmentKey: 'shure-ad-g56', zoneIndex: currentArr.length + i, compatibilityLevel: 'standard' as const }));
                return [...currentArr, ...added];
            }
            return currentArr.filter(g => (g.zoneIndex ?? 0) < multizoneNumZones);
        });
        setMultizoneDistances(prev => {
            const currentArr = Array.isArray(prev) ? prev : [];
            if (currentArr.length === multizoneNumZones) return currentArr;
            const newDist: number[][] = Array(multizoneNumZones).fill(0).map((_, i) => Array(multizoneNumZones).fill(0).map((_, j) => i === j ? 0 : 0.1));
            for (let i = 0; i < Math.min(currentArr.length, multizoneNumZones); i++) {
                for (let j = 0; j < Math.min(currentArr.length, multizoneNumZones); j++) {
                    newDist[i][j] = currentArr[i][j];
                }
            }
            return newDist;
        });
        setMultizoneMatrix(prev => {
            const currentArr = Array.isArray(prev) ? prev : [];
            if (currentArr.length === multizoneNumZones) return currentArr;
            const newMatrix = Array(multizoneNumZones).fill(false).map(() => Array(multizoneNumZones).fill(false));
            for (let i = 0; i < Math.min(currentArr.length, multizoneNumZones); i++) {
                for (let j = 0; j < Math.min(currentArr.length, multizoneNumZones); j++) {
                    newMatrix[i][j] = currentArr[i][j] || false;
                }
            }
            return newMatrix;
        });
    }, [multizoneNumZones]);

    useEffect(() => {
        if (isProjectLoading.current) return;
        setCommsZoneConfigs(prev => {
            const currentArr = Array.isArray(prev) ? prev : [];
            if (currentArr.length === commsNumZones) return currentArr;
            if (currentArr.length < commsNumZones) {
                const added = Array.from({ length: commsNumZones - currentArr.length }, (_, i) => ({ name: `Zone ${currentArr.length + i + 1}`, count: 4 }));
                return [...currentArr, ...added];
            }
            return currentArr.slice(0, commsNumZones);
        });
        setCommsDistances(prev => {
            const currentArr = Array.isArray(prev) ? prev : [];
            if (currentArr.length === commsNumZones) return currentArr;
            const newDist: number[][] = Array(commsNumZones).fill(0).map((_, i) => Array(commsNumZones).fill(0).map((_, j) => (i === j ? 0 : 0.1)));
            for (let i = 0; i < Math.min(currentArr.length, commsNumZones); i++) {
                for (let j = 0; j < Math.min(currentArr.length, commsNumZones); j++) {
                    newDist[i][j] = currentArr[i][j];
                }
            }
            return newDist;
        });
        setCommsCompatibilityMatrix(prev => {
            const currentArr = Array.isArray(prev) ? prev : [];
            if (currentArr.length === commsNumZones) return currentArr;
            const newMatrix = Array(commsNumZones).fill(false).map(() => Array(commsNumZones).fill(false));
            for (let i = 0; i < Math.min(currentArr.length, commsNumZones); i++) {
                for (let j = 0; j < Math.min(currentArr.length, commsNumZones); j++) {
                    newMatrix[i][j] = currentArr[i][j] || false;
                }
            }
            return newMatrix;
        });
    }, [commsNumZones]);

    const loadAppState = (state: AppState) => {
        isProjectLoading.current = true;
        setActiveTab(state.activeTab || 'analyzer');
        setActiveApp(state.activeApp || null);
        setIsSunlightMode(state.isSunlightMode || false);
        setFrequencies(state.frequencies || initialFrequencies);
        setThresholds(state.thresholds || initialThresholds);
        setGeneratorFrequencies(state.generatorFrequencies || null);
        setScanData(state.scanData || null);
        setInclusionRanges(state.inclusionRanges || null);
        setSnapshots((state.snapshots || []).map(s => ({ ...s, createdAt: hydrateDate(s.createdAt) })));
        setScenes((state.scenes || []).map(s => ({ ...s, activeFrequencyIds: new Set(Array.from(s.activeFrequencyIds || [])) })));
        
        if (state.festivalState) {
            setFestivalNumZones(state.festivalState.numZones || 2);
            setFestivalZoneConfigs(state.festivalState.zoneConfigs || []);
            setFestivalDistances(state.festivalState.distances || []);
            setFestivalActs((state.festivalState.acts || []).map(a => ({ ...a, startTime: hydrateDate(a.startTime), endTime: hydrateDate(a.endTime) })));
            setFestivalConstantSystems(state.festivalState.constantSystems || []);
            setFestivalHouseSystems(state.festivalState.houseSystems || []);
            setFestivalSiteMap(state.festivalState.siteMapState || initialSiteMapState);
            setFestivalMatrix(state.festivalState.compatibilityMatrix || []);
            setFestivalTvStates(state.festivalState.tvChannelStates || {});
        }

        if (state.multizoneState) {
            setMultizoneNumZones(state.multizoneState.numZones || 2);
            setMultizoneZoneConfigs(state.multizoneState.zoneConfigs || []);
            setMultizoneGroups(state.multizoneState.equipmentGroups || []);
            setMultizoneDistances(state.multizoneState.distances || []);
            setMultizoneResults(state.multizoneState.results);
            setMultizoneSiteMap(state.multizoneState.siteMapState || initialSiteMapState);
            setMultizoneMatrix(state.multizoneState.compatibilityMatrix || []);
            setMultizoneTvStates(state.multizoneState.tvChannelStates || {});
        }

        if (state.commsState) {
            setCommsNumZones(state.commsState.numZones || 2);
            setCommsZoneConfigs(state.commsState.zoneConfigs || []);
            setCommsDistances(state.commsState.distances || []);
            setCommsCompatibilityMatrix(state.commsState.compatibilityMatrix || []);
            setCommsSiteMapState(state.commsState.siteMapState || initialSiteMapState);
            setTbManualPairs(state.commsState.manualPairs || []);
            setTbResults(state.commsState.results || null);
        }

        if (state.multiBandState) {
            setMbBands(state.multiBandState.bands || [initialBandState]);
            setMbResults(state.multiBandState.results);
        }

        if (state.generatorState) {
            setGenRequests(state.generatorState.requests || initialGeneratorRequests);
            setGenExclusions(state.generatorState.exclusions || '');
            setGenUseGlobalThresholds(state.generatorState.useGlobalThresholds || false);
            setGenGlobalThresholds(state.generatorState.globalThresholds || initialState.generatorState!.globalThresholds);
            setGenManualConstraints(state.generatorState.manualConstraints || []);
            setGenIgnoreManualIMD(state.generatorState.ignoreManualIMD || false);
            setGenSiteThresholds((state as any).generatorState?.siteThresholds || { fundamental: 0.350, twoTone: 0.050, threeTone: 0.050, fiveTone: 0, sevenTone: 0 });
            setGenTvStates(state.generatorState.tvChannelStates || {});
            setGenTvRegion(state.generatorState.tvRegion || 'uk');
        }

        if (state.tourPlanningState) {
            setTourPlanningState({
                ...state.tourPlanningState,
                stops: (state.tourPlanningState.stops || []).map(s => ({ ...s, date: hydrateDate(s.date) }))
            });
        }

        if (state.wmasState) {
            setWmasState({
                ...state.wmasState,
                nodes: (state.wmasState.nodes || []).map(n => ({
                    ...n,
                    startTime: n.startTime ? hydrateDate(n.startTime) : undefined,
                    endTime: n.endTime ? hydrateDate(n.endTime) : undefined
                }))
            });
        }

        setTimeout(() => { isProjectLoading.current = false; }, 100);
    };

    const saveCurrentProject = async () => {
        if (!currentProject) {
            setSaveStatus('no-project');
            setTimeout(() => setSaveStatus('idle'), 3000);
            return;
        }
        setSaveStatus('saving');
        const stateToSave: AppState = {
            activeTab, activeApp, isSunlightMode, frequencies, thresholds, generatorFrequencies, scanData, inclusionRanges, snapshots, scenes,
            multiBandState: { bands: mbBands, results: mbResults },
            generatorState: { requests: genRequests, exclusions: genExclusions, useGlobalThresholds: genUseGlobalThresholds, globalThresholds: genGlobalThresholds, manualConstraints: genManualConstraints, ignoreManualIMD: genIgnoreManualIMD, siteThresholds: genSiteThresholds, tvChannelStates: genTvStates, tvRegion: genTvRegion } as any,
            festivalState: { numZones: festivalNumZones, zoneConfigs: festivalZoneConfigs, distances: festivalDistances, acts: festivalActs, constantSystems: festivalConstantSystems, houseSystems: festivalHouseSystems, siteMapState: festivalSiteMap, compatibilityMatrix: festivalMatrix, tvChannelStates: festivalTvStates },
            multizoneState: { numZones: multizoneNumZones, zoneConfigs: multizoneZoneConfigs, equipmentGroups: multizoneGroups, distances: multizoneDistances, results: multizoneResults, siteMapState: multizoneSiteMap, compatibilityMatrix: multizoneMatrix, tvChannelStates: multizoneTvStates },
            commsState: { numZones: commsNumZones, zoneConfigs: commsZoneConfigs, distances: commsDistances, compatibilityMatrix: commsCompatibilityMatrix, siteMapState: commsSiteMapState, manualPairs: tbManualPairs, results: tbResults },
            tourPlanningState: tourPlanningState,
            wmasState: wmasState
        };
        const updatedProject: Project = { ...currentProject, lastModified: new Date(), data: stateToSave };
        try {
            await dbService.saveProject(updatedProject);
            setCurrentProject(updatedProject);
            setSaveStatus('saved');
        } catch (error) {
            console.error("Save failed", error);
            setSaveStatus('idle');
            alert("Database write error.");
        }
        setTimeout(() => setSaveStatus('idle'), 3000);
    };

    const handleLogin = (userData: any) => { 
        setUser(userData);
        setIsAuthenticated(true); 
        localStorage.setItem('rf_pro_auth', 'true'); 
        localStorage.setItem('rf_pro_user', JSON.stringify(userData));
    };
    const handleLogout = () => { 
        setUser(null);
        setIsAuthenticated(false); 
        localStorage.removeItem('rf_pro_auth'); 
        localStorage.removeItem('rf_pro_user');
        setActiveApp(null); 
    };

    useEffect(() => {
        const storedAuth = localStorage.getItem('rf_pro_auth');
        const storedUser = localStorage.getItem('rf_pro_user');
        if (storedAuth === 'true' && storedUser) {
            setIsAuthenticated(true);
            setUser(JSON.parse(storedUser));
        }
    }, []);

    if (!isDbReady) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Initializing Engine...</div>;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans relative animate-in fade-in duration-700">
            {!isAuthenticated ? (
                <LandingPage onLogin={() => setIsAuthModalOpen(true)} />
            ) : (
                <>
                    <Header 
                        projectName={currentProject?.name} 
                        onManageProjects={() => setProjectDashboardOpen(true)} 
                        onSaveProject={saveCurrentProject} 
                        onExportProject={() => currentProject && exportToJson(currentProject, `${currentProject.name}.rfproject`)} 
                        activeApp={activeApp} 
                        onGoHome={() => setActiveApp(null)} 
                        isSunlightMode={isSunlightMode} 
                        toggleSunlightMode={() => setIsSunlightMode(!isSunlightMode)} 
                        isSaving={saveStatus === 'saving'} 
                        isSaved={saveStatus === 'saved'} 
                        onLogout={handleLogout}
                        user={user}
                        onOpenAccount={() => setIsAccountDashboardOpen(true)}
                    />
            <main className="container mx-auto px-4 py-6 max-w-7xl">
                <ErrorBoundary>
                    {activeApp === null ? (
                        <AppLauncher onSelectApp={cat => { setActiveApp(cat); const first = tabConfig.find(t => t.category === cat); if(first) setActiveTab(first.id); }} />
                    ) : (
                        <>
                            <Tabs activeTab={activeTab} setActiveTab={setActiveTab} activeApp={activeApp} />
                            <div className="mt-6">
                                {/* System Documentation */}
                                {activeTab === 'userGuide' && <UserGuideTab activeApp={activeApp} />}
                                
                                {/* Core Coordination Modules */}
                                {activeTab === 'analyzer' && <AnalyzerTab frequencies={frequencies} setFrequencies={setFrequencies} thresholds={thresholds} setThresholds={setThresholds} scenes={scenes} snapshots={snapshots} setSnapshots={setSnapshots} scanData={scanData} generatorFrequencies={generatorFrequencies} multiBandResults={mbResults} tvChannelStates={genTvStates} setTvChannelStates={setGenTvStates} wmasState={wmasState} />}
                                {activeTab === 'generator' && <GeneratorTab initialThresholds={initialThresholds} generatedFrequencies={generatorFrequencies} setGeneratorFrequencies={setGeneratorFrequencies} customEquipment={customEquipment} onManageCustomEquipment={() => setCustomEquipmentManagerOpen(true)} inclusionRanges={inclusionRanges} setInclusionRanges={setInclusionRanges} frequencies={frequencies} scenes={scenes} requests={genRequests} setRequests={setGenRequests} exclusions={genExclusions} setExclusions={setGenExclusions} useGlobalThresholds={genUseGlobalThresholds} setUseGlobalThresholds={setGenUseGlobalThresholds} globalThresholds={genGlobalThresholds} setGlobalThresholds={setGenGlobalThresholds} manualConstraints={genManualConstraints} setManualConstraints={setGenManualConstraints} ignoreManualIMD={genIgnoreManualIMD} setIgnoreManualIMD={setGenIgnoreManualIMD} siteThresholds={genSiteThresholds} setSiteThresholds={setGenSiteThresholds} equipmentOverrides={equipmentOverrides} tvChannelStates={genTvStates} setTvChannelStates={setGenTvStates} tvRegion={genTvRegion} setTvRegion={setGenTvRegion} wmasState={wmasState} />}
                                {activeTab === 'multiband' && <MultiBandTab customEquipment={customEquipment} bands={mbBands} setBands={setMbBands} results={mbResults} setResults={setMbResults} equipmentOverrides={equipmentOverrides} wmasState={wmasState} />}
                                {activeTab === 'whitespace' && <WhiteSpaceTab />}
                                
                                {/* Analysis & Visualization */}
                                {activeTab === 'spectrum' && <SpectrumTab projectId={currentProject?.id} analyzerFrequencies={frequencies} generatorFrequencies={generatorFrequencies} scanData={scanData} setScanData={setScanData} setInclusionRanges={setInclusionRanges} setActiveTab={setActiveTab} scenes={scenes} festivalActs={festivalActs} constantSystems={festivalConstantSystems} houseSystems={festivalHouseSystems} talkbackPairs={tbResults} talkbackManual={tbManualPairs} zonalResults={zonalResults} wmasState={wmasState} />}
                                {activeTab === 'waterfall' && <WaterfallTab analyzerFrequencies={frequencies} generatorFrequencies={generatorFrequencies} scanData={scanData} wmasState={wmasState} />}
                                
                                {/* Comms Planning */}
                                {activeTab === 'talkback' && <TalkbackTab manualPairs={tbManualPairs} setManualPairs={setTbManualPairs} results={tbResults} setResults={setTbResults} />}
                                {activeTab === 'zonalTalkback' && <ZonalTalkbackTab numZones={commsNumZones} setNumZones={setCommsNumZones} zoneConfigs={commsZoneConfigs} setZoneConfigs={setCommsZoneConfigs} distances={commsDistances} setDistances={setCommsDistances} siteMapState={commsSiteMapState} compatibilityMatrix={commsCompatibilityMatrix} setCompatibilityMatrix={setCommsCompatibilityMatrix} results={zonalResults} setResults={setZonalResults} />}
                                
                                {/* Exhibition Planning */}
                                {activeTab === 'multizone' && <MultizoneTab isLinked={true} setIsLinked={()=>{}} numZones={multizoneNumZones} setNumZones={setMultizoneNumZones} zoneConfigs={multizoneZoneConfigs} setZoneConfigs={setMultizoneZoneConfigs} equipmentGroups={multizoneGroups} setEquipmentGroups={setMultizoneGroups} manualFrequencies={multizoneManualFrequencies} setManualFrequencies={setMultizoneManualFrequencies} distances={multizoneDistances} setDistances={setMultizoneDistances} results={multizoneResults} setResults={setMultizoneResults} customEquipment={customEquipment} onManageCustomEquipment={()=>setCustomEquipmentManagerOpen(true)} compatibilityMatrix={multizoneMatrix} setCompatibilityMatrix={setMultizoneMatrix} equipmentOverrides={equipmentOverrides} tvChannelStates={multizoneTvStates} setTvChannelStates={setMultizoneTvStates} wmasState={wmasState} />}
                                {activeTab === 'multizoneSiteMap' && <SiteMapTab activeApp={activeApp} festivalState={{ zones: festivalZoneConfigs, map: festivalSiteMap, setMap: setFestivalSiteMap, setDist: setFestivalDistances }} multizoneState={{ zones: multizoneZoneConfigs, map: multizoneSiteMap, setMap: setMultizoneSiteMap, setDist: setMultizoneDistances }} />}
                                
                                {/* Festival & Event Coordination */}
                                {activeTab === 'festival' && <FestivalCoordinationTab festivalActs={festivalActs} setFestivalActs={setFestivalActs} constantSystems={festivalConstantSystems} setConstantSystems={setFestivalConstantSystems} houseSystems={festivalHouseSystems} setHouseSystems={setFestivalHouseSystems} zoneConfigs={festivalZoneConfigs} setZoneConfigs={setFestivalZoneConfigs} numZones={festivalNumZones} setNumZones={setFestivalNumZones} distances={festivalDistances} setDistances={setFestivalDistances} initialThresholds={initialThresholds} customEquipment={customEquipment} compatibilityMatrix={festivalMatrix} setCompatibilityMatrix={setFestivalMatrix} scanData={scanData} siteMapState={festivalSiteMap} equipmentOverrides={equipmentOverrides} tvChannelStates={festivalTvStates} setTvChannelStates={setFestivalTvStates} wmasState={wmasState} />}
                                {activeTab === 'timeline' && <TimelineTab frequencies={frequencies} scenes={scenes} setScenes={setScenes} />}
                                {activeTab === 'festivalSiteMap' && <SiteMapTab activeApp={activeApp} festivalState={{ zones: festivalZoneConfigs, map: festivalSiteMap, setMap: setFestivalSiteMap, setDist: setFestivalDistances }} multizoneState={{ zones: multizoneZoneConfigs, map: multizoneSiteMap, setMap: setMultizoneSiteMap, setDist: setMultizoneDistances }} />}
                                
                                {/* Tour Planning */}
                                {activeTab === 'tourPlanning' && <TourPlanningTab state={tourPlanningState} setState={setTourPlanningState} customEquipment={customEquipment} equipmentOverrides={equipmentOverrides} />}

                                {/* WMAS Coordination */}
                                {activeTab === 'wmas' && <WMASTab state={wmasState} setState={setWmasState} tvChannelStates={genTvStates} scanData={scanData} />}

                                {/* RF Toolkit Utilities */}
                                {activeTab === 'iemStudy' && <IEMStudyTab />}
                                {activeTab === 'interference' && <InterferenceDemoTab />}
                                {activeTab === 'imdDemo' && <IMDDemoTab />}
                                {activeTab === 'diversityPlacement' && <DiversityPlacementTab />}
                                {activeTab === 'linkBudget' && <LinkBudgetTab />}
                                {activeTab === 'antennaDownTilt' && <AntennaDownTiltTab />}
                                {activeTab === 'cableLoss' && <CableLossTab />}
                                {activeTab === 'lineOfSight' && <LineOfSightTab />}
                                {activeTab === 'vswr' && <VSWRTab />}
                                {activeTab === 'fspl' && <FSPLTab />}
                                {activeTab === 'powerConverter' && <PowerConverterTab />}
                                {activeTab === 'fresnelZone' && <FresnelZoneTab />}
                                {activeTab === 'audioTone' && <AudioToneGeneratorTab />}

                                {/* Settings & Hardware */}
                                {activeTab === 'equipmentDatabase' && <EquipmentDatabaseTab customEquipment={customEquipment} overrides={equipmentOverrides} setOverrides={setEquipmentOverrides} onManageCustomEquipment={() => setCustomEquipmentManagerOpen(true)} />}
                            </div>
                        </>
                    )}
                </ErrorBoundary>
                    </main>
                </>
            )}
            {isProjectDashboardOpen && <ProjectDashboard onLoadProject={p => { setCurrentProject(p); loadAppState(p.data); dbService.setLastProjectId(p.id); setProjectDashboardOpen(false); }} onCreateProject={async n => { const p = { name: n, lastModified: new Date(), data: initialState }; const id = await dbService.saveProject(p); setCurrentProject({...p, id}); loadAppState(p.data); dbService.setLastProjectId(id); setProjectDashboardOpen(false); }} onDeleteProject={async id => { await dbService.deleteProject(id); if(currentProject?.id === id){ setCurrentProject(null); dbService.clearLastProjectId(); } }} onClose={() => setProjectDashboardOpen(false)} />}
            {isCustomEquipmentManagerOpen && <div className="no-invert"><CustomEquipmentManager customProfiles={customEquipment} setCustomProfiles={setCustomEquipment} onClose={() => setCustomEquipmentManagerOpen(false)} /></div>}
            {isAuthModalOpen && <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} onSuccess={handleLogin} />}
            {isAccountDashboardOpen && <AccountDashboard user={user} onClose={() => setIsAccountDashboardOpen(false)} onLogout={handleLogout} onUpgrade={(tier) => { setUser({...user, subscription: tier}); localStorage.setItem('rf_pro_user', JSON.stringify({...user, subscription: tier})); }} />}
        </div>
    );
};

export default App;
