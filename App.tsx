
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
import ReportingTab from './components/ReportingTab';
import PlotGallery from './components/PlotGallery';
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
import CommunityPanel from './components/CommunityPanel';
import UserPresenceList from './components/UserPresenceList';
import ProfilePopover from './components/ProfilePopover';
import { ActivityFeed } from './components/ActivityFeed';

import { useLocalStorage } from './hooks/useLocalStorage';
import { useDebounce } from './hooks/useDebounce';
import { toast, Toaster } from 'sonner';

// RF Toolkit Component Imports
import ProximitySimulatorTab from './components/ProximitySimulatorTab';
import InterferenceDemoTab from './components/InterferenceDemoTab';
import IMDDemoTab from './components/IMDDemoTab';
import FrequencyForensicsTab from './components/FrequencyForensicsTab';
import DiversityPlacementTab from './components/DiversityPlacementTab';
import LinkBudgetTab from './components/LinkBudgetTab';
import AntennaDownTiltTab from './components/AntennaDownTiltTab';
import CableLossTab from './components/CableLossTab';
import FSPLTab from './components/FSPLTab';
import PowerConverterTab from './components/PowerConverterTab';
import FresnelZoneTab from './components/FresnelZoneTab';
import AudioToneGeneratorTab from './components/AudioToneGeneratorTab';

import * as dbService from './services/dbService';
import { exportToJson } from './services/fileService';
import { db, auth } from './src/lib/firebase';
import { getDoc, doc } from 'firebase/firestore';
import { saveProjectToCloud } from './services/cloudDbService';

import { generateMockScanData } from './services/serialService';

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
const initialGeneratorRequests: GeneratorRequest[] = [{ id: Date.now(), key: 'shure-ad-g56', count: '8', customMin: '470.000', customMax: '636.000', compatibilityLevel: 'standard', type: 'mic' }];
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
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [currentProject, setCurrentProject] = useState<Project | null>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'no-project'>('idle');
    const [isEngineCalculating, setIsEngineCalculating] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const isProjectLoading = useRef(false);
    const isLibraryLoaded = useRef(false);

    const [activeApp, setActiveApp] = useState<AppCategory | null>(null);
    const [activeTab, setActiveTab] = useLocalStorage<TabID>('app_activeTab', 'analyzer');
    const [isSunlightMode, setIsSunlightMode] = useLocalStorage('app_isSunlightMode', false);
    
    const [frequencies, setFrequencies] = useState<Frequency[]>(initialFrequencies);
    const [thresholds, setThresholds] = useState<Thresholds>(initialThresholds);
    const [generatorFrequencies, setGeneratorFrequencies] = useState<Frequency[] | null>(null);
    
    const [equipmentOverrides, setEquipmentOverrides] = useLocalStorage<Record<string, Partial<Thresholds>>>('app_equipmentOverrides', {});
    const [customEquipment, setCustomEquipment] = useLocalStorage<EquipmentProfile[]>('app_customEquipment', []);
    
    const [festivalNumZones, setFestivalNumZones] = useLocalStorage('app_festivalNumZones', initialFestivalState.numZones);
    const [festivalZoneConfigs, setFestivalZoneConfigs] = useLocalStorage('app_festivalZoneConfigs', initialFestivalState.zoneConfigs);
    const [festivalDistances, setFestivalDistances] = useLocalStorage('app_festivalDistances', initialFestivalState.distances);
    const [festivalActs, setFestivalActs] = useLocalStorage<FestivalAct[]>('app_festivalActs', initialFestivalState.acts);
    const [festivalConstantSystems, setFestivalConstantSystems] = useLocalStorage<ConstantSystemRequest[]>('app_festivalConstantSystems', initialFestivalState.constantSystems);
    const [festivalHouseSystems, setFestivalHouseSystems] = useLocalStorage<ConstantSystemRequest[]>('app_festivalHouseSystems', initialFestivalState.houseSystems);
    const [festivalSiteMap, setFestivalSiteMap] = useLocalStorage<SiteMapState>('app_festivalSiteMap', initialFestivalState.siteMapState);
    const [festivalMatrix, setFestivalMatrix] = useLocalStorage<boolean[][]>('app_festivalMatrix', initialFestivalState.compatibilityMatrix);
    const [festivalTvStates, setFestivalTvStates] = useLocalStorage<Record<number, TVChannelState>>('app_festivalTvStates', initialFestivalState.tvChannelStates || {});

    const [multizoneNumZones, setMultizoneNumZones] = useLocalStorage('app_multizoneNumZones', initialMultizoneState.numZones);
    const [multizoneZoneConfigs, setMultizoneZoneConfigs] = useLocalStorage('app_multizoneZoneConfigs', initialMultizoneState.zoneConfigs);
    const [multizoneGroups, setMultizoneGroups] = useLocalStorage('app_multizoneGroups', initialMultizoneState.equipmentGroups || []);
    const [multizoneManualFrequencies, setMultizoneManualFrequencies] = useLocalStorage<Frequency[]>('app_multizoneManualFrequencies', initialMultizoneState.manualFrequencies || []);
    const [multizoneManualConstraints, setMultizoneManualConstraints] = useLocalStorage<Frequency[]>('app_multizoneManualConstraints', initialMultizoneState.manualConstraints || []);
    const [multizoneDistances, setMultizoneDistances] = useLocalStorage('app_multizoneDistances', initialMultizoneState.distances);
    const [multizoneResults, setMultizoneResults] = useLocalStorage('app_multizoneResults', initialMultizoneState.results);
    const [multizoneSiteMap, setMultizoneSiteMap] = useLocalStorage<SiteMapState>('app_multizoneSiteMap', initialMultizoneState.siteMapState);
    const [multizoneMatrix, setMultizoneMatrix] = useLocalStorage<boolean[][]>('app_multizoneMatrix', initialMultizoneState.compatibilityMatrix);
    const [multizoneTvStates, setMultizoneTvStates] = useLocalStorage<Record<number, TVChannelState>>('app_multizoneTvStates', initialMultizoneState.tvChannelStates || {});

    const [commsNumZones, setCommsNumZones] = useLocalStorage('app_commsNumZones', initialCommsState.numZones);
    const [commsZoneConfigs, setCommsZoneConfigs] = useLocalStorage<ZoneConfig[]>('app_commsZoneConfigs', initialCommsState.zoneConfigs);
    const [commsDistances, setCommsDistances] = useLocalStorage<number[][]>('app_commsDistances', initialCommsState.distances);
    const [commsCompatibilityMatrix, setCommsCompatibilityMatrix] = useLocalStorage<boolean[][]>('app_commsCompatibilityMatrix', initialCommsState.compatibilityMatrix);
    const [commsSiteMapState, setCommsSiteMapState] = useLocalStorage<SiteMapState>('app_commsSiteMapState', initialCommsState.siteMapState);
    const [tbManualPairs, setTbManualPairs] = useLocalStorage<DuplexPair[]>('app_tbManualPairs', initialCommsState.manualPairs);
    const [tbResults, setTbResults] = useLocalStorage<DuplexPair[] | null>('app_tbResults', initialCommsState.results);
    const [zonalResults, setZonalResults] = useLocalStorage<ZonalResult[] | null>('app_zonalResults', null);

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
    
    const [selectedProfile, setSelectedProfile] = useState<any>(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    const [selectedPublicProfile, setSelectedPublicProfile] = useState<any>(null);

    const handleSelectProfile = async (user: any) => {
        setSelectedProfile(user);
        setIsLoadingProfile(true);
        setSelectedPublicProfile(null);
        try {
            // db and getDoc, doc are imported statically
            const profileDoc = await getDoc(doc(db, 'public_profiles', user.id));
            if (profileDoc.exists()) {
                setSelectedPublicProfile(profileDoc.data());
            }
        } catch (err) {
            console.error("Error fetching public profile:", err);
        } finally {
            setIsLoadingProfile(false);
        }
    };

    const [tourPlanningState, setTourPlanningState] = useLocalStorage<TourPlanningState>('app_tourPlanningState', initialTourPlanningState);
    const [wmasState, setWmasState] = useLocalStorage<WMASState>('app_wmasState', initialWMASState);
    const [previewEquipment, setPreviewEquipment] = useState<{ profile: EquipmentProfile; frequency: number } | null>(null);

    const [isProjectDashboardOpen, setProjectDashboardOpen] = useState(false);
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [isSavePopupOpen, setIsSavePopupOpen] = useState(false);
    const [isCustomEquipmentManagerOpen, setCustomEquipmentManagerOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isCommunityOpen, setIsCommunityOpen] = useState(false);
    const [isIntercomOpen, setIsIntercomOpen] = useState(false);
    const [selectedDmUser, setSelectedDmUser] = useState<any>(null);
    const [communityTheme, setCommunityTheme] = useState<'light' | 'dark'>('dark');
    const [isAccountDashboardOpen, setIsAccountDashboardOpen] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [dbError, setDbError] = useState<string | null>(null);
    const [isSimulatingScan, setIsSimulatingScan] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('checkout') === 'success') {
            toast.success('Payment successful! Your account is being upgraded.');
            setIsAccountDashboardOpen(true);
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (params.get('checkout') === 'cancel') {
            toast.error('Payment was cancelled.');
            setIsAccountDashboardOpen(true);
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (params.get('portal') === 'return') {
            setIsAccountDashboardOpen(true);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    useEffect(() => {
        if (isSunlightMode) document.documentElement.classList.add('sunlight-mode');
        else document.documentElement.classList.remove('sunlight-mode');
    }, [isSunlightMode]);

    useEffect(() => {
        if (!isSimulatingScan) {
            setScanData(null);
            return;
        }

        const interval = setInterval(() => {
            setScanData(generateMockScanData(470, 700, 200));
        }, 500);

        return () => clearInterval(interval);
    }, [isSimulatingScan]);

    const handleSimulateScan = useCallback(() => {
        setIsSimulatingScan(prev => !prev);
    }, []);

    useEffect(() => {
        const init = async (retries = 3) => {
            try {
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
                        }
                    }
                    setIsDbReady(true);
                } else {
                    throw new Error("Database returned not ready");
                }
            } catch (error: any) {
                console.error(`Database initialization attempt failed (${retries} retries left):`, error);
                
                if (retries > 0) {
                    // Wait 1 second and retry
                    setTimeout(() => init(retries - 1), 1000);
                } else {
                    const errorName = error?.name || 'UnknownError';
                    const errorMessage = error?.message || String(error);
                    
                    let userMessage = `Database initialization error: ${errorName} - ${errorMessage}.`;
                    
                    if (errorName === 'SecurityError') {
                        userMessage += " This is usually caused by browser security settings or blocking cookies/site data.";
                    } else if (errorName === 'QuotaExceededError') {
                        userMessage += " Your device is out of storage space.";
                    } else {
                        userMessage += " This can be caused by Private/Incognito mode, browser security settings, or an unverified SSL certificate.";
                    }
                    
                    setDbError(userMessage + " Please try refreshing or opening the site in a new window.");
                }
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

    const getCurrentAppState = (): AppState => ({
        activeTab, activeApp, isSunlightMode, frequencies, thresholds, generatorFrequencies, scanData, inclusionRanges, snapshots, scenes,
        multiBandState: { bands: mbBands, results: mbResults },
        generatorState: { requests: genRequests, exclusions: genExclusions, useGlobalThresholds: genUseGlobalThresholds, globalThresholds: genGlobalThresholds, manualConstraints: genManualConstraints, ignoreManualIMD: genIgnoreManualIMD, siteThresholds: genSiteThresholds, tvChannelStates: genTvStates, tvRegion: genTvRegion } as any,
        festivalState: { numZones: festivalNumZones, zoneConfigs: festivalZoneConfigs, distances: festivalDistances, acts: festivalActs, constantSystems: festivalConstantSystems, houseSystems: festivalHouseSystems, siteMapState: festivalSiteMap, compatibilityMatrix: festivalMatrix, tvChannelStates: festivalTvStates },
        multizoneState: { numZones: multizoneNumZones, zoneConfigs: multizoneZoneConfigs, equipmentGroups: multizoneGroups, manualFrequencies: multizoneManualFrequencies, manualConstraints: multizoneManualConstraints, distances: multizoneDistances, results: multizoneResults, siteMapState: multizoneSiteMap, compatibilityMatrix: multizoneMatrix, tvChannelStates: multizoneTvStates },
        commsState: { numZones: commsNumZones, zoneConfigs: commsZoneConfigs, distances: commsDistances, compatibilityMatrix: commsCompatibilityMatrix, siteMapState: commsSiteMapState, manualPairs: tbManualPairs, results: tbResults },
        tourPlanningState: tourPlanningState,
        wmasState: wmasState
    });

    const handleSaveAsNewProject = async (name: string) => {
        setIsSaveModalOpen(false);
        setSaveStatus('saving');
        setIsSavePopupOpen(true);
        const stateToSave = getCurrentAppState();
        const newProject: Omit<Project, 'id'> = {
            name,
            lastModified: new Date(),
            data: stateToSave,
            ...(isAuthenticated && user?.id ? { userId: user.id } : {})
        };
        try {
            let finalProject = { ...newProject } as Project;
            if (isAuthenticated && user?.id) {
                const { saveProjectToCloud } = await import('./services/cloudDbService');
                const cloudId = await saveProjectToCloud(user.id, newProject);
                finalProject.id = cloudId as any;
            }
            const localId = await dbService.saveProject(finalProject);
            if (!finalProject.id) finalProject.id = localId as any;
            
            setCurrentProject(finalProject);
            await dbService.setLastProjectId(finalProject.id!);
            setSaveStatus('saved');
            setLastSaved(new Date());
        } catch (error) {
            console.error("Save failed", error);
            setSaveStatus('idle');
            toast.error("Database write error.");
        }
        setTimeout(() => setSaveStatus('idle'), 3000);
    };

    const saveCurrentProject = async () => {
        if (!currentProject) {
            setIsSaveModalOpen(true);
            return;
        }
        setSaveStatus('saving');
        setIsSavePopupOpen(true);
        const stateToSave = getCurrentAppState();
        const updatedProject: Project = { 
            ...currentProject, 
            lastModified: new Date(), 
            data: stateToSave,
            ...(isAuthenticated && user?.id ? { userId: user.id } : {})
        };
        try {
            if (isAuthenticated && user?.id) {
                const { saveProjectToCloud } = await import('./services/cloudDbService');
                const cloudId = await saveProjectToCloud(user.id, updatedProject);
                // We keep the local ID for IndexedDB but update the project object with cloud info if needed
                // For simplicity, we just save to both
                updatedProject.id = cloudId as any; 
            }
            await dbService.saveProject(updatedProject);
            await dbService.setLastProjectId(updatedProject.id);
            setCurrentProject(updatedProject);
            setSaveStatus('saved');
            setLastSaved(new Date());
        } catch (error) {
            console.error("Save failed", error);
            setSaveStatus('idle');
            toast.error("Database write error.");
        }
        setTimeout(() => setSaveStatus('idle'), 3000);
    };

    const handleLogin = (userData: any) => { 
        setUser(userData);
        setIsAuthenticated(true); 
    };
    const refreshUser = async () => {
        if (!user) return;
        // db and getDoc, doc are imported statically
        const userDoc = await getDoc(doc(db, 'users', user.id));
        if (userDoc.exists()) {
            const data = userDoc.data();
            setUser({
                ...user,
                subscription: data.subscription || 'none',
                subscriptionStatus: data.subscriptionStatus || 'none',
                stripeCustomerId: data.stripeCustomerId || null
            });
        }
    };
    const handleLogout = async () => { 
        try {
            // auth is imported statically
            await auth.signOut();
        } catch (error) {
            console.error("Error signing out", error);
        }
        setUser(null);
        setIsAuthenticated(false); 
        setProjectDashboardOpen(false);
        setIsAccountDashboardOpen(false);
        setActiveApp(null); 
        setCurrentProject(null);
        loadAppState(initialState);
        dbService.setLastProjectId('');
    };

    useEffect(() => {
        let unsubscribe: () => void;
        const initAuth = async () => {
            // auth and db are imported statically
            if (!auth) {
                setIsAuthLoading(false);
                return;
            }
            // doc and getDoc are imported statically
            
            // Fallback timeout in case Firebase Auth is blocked by the browser (e.g. Brave, Safari)
            // or if there's a network issue preventing onAuthStateChanged from firing.
            const authTimeout = setTimeout(() => {
                console.warn("Firebase Auth initialization timed out. This may be due to browser privacy settings blocking third-party cookies, or a network issue.");
                setIsAuthLoading(false);
                setIsAuthenticated(false);
                setUser(null);
            }, 5000);

            unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
                clearTimeout(authTimeout);
                if (firebaseUser) {
                    let subscription = 'none';
                    let subscriptionStatus = 'none';
                    let stripeCustomerId = null;
                    try {
                        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
                        if (userDoc.exists()) {
                            const data = userDoc.data();
                            subscriptionStatus = data.subscriptionStatus || 'none';
                            subscription = data.subscription || subscriptionStatus;
                            stripeCustomerId = data.stripeCustomerId || null;
                        }
                    } catch (err) {
                        console.error("Error fetching user data:", err);
                    }

                    setIsAuthenticated(true);
                    setUser({
                        id: firebaseUser.uid,
                        email: firebaseUser.email,
                        name: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
                        subscription: subscription,
                        subscriptionStatus: subscriptionStatus,
                        stripeCustomerId: stripeCustomerId
                    });
                } else {
                    setIsAuthenticated(false);
                    setUser(null);
                    setProjectDashboardOpen(false); // Ensure dashboard is closed
                    setIsAccountDashboardOpen(false);
                }
                setIsAuthLoading(false);
            }, (error: any) => {
                console.error("Auth state change error:", error);
                setIsAuthLoading(false);
                // Don't block the app if auth fails
                setIsAuthenticated(false);
                setUser(null);
                setProjectDashboardOpen(false); // Ensure dashboard is closed
            });
        };
        initAuth();
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (user && currentProject && currentProject.userId && currentProject.userId !== user.id) {
            console.warn("Project belongs to a different user. Clearing workspace.");
            setCurrentProject(null);
            loadAppState(initialState);
        }
    }, [user, currentProject]);

    if (dbError) return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4 text-center">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold mb-2">Initialization Error</h1>
            <p className="text-slate-400 mb-6 max-w-md">{dbError}</p>
            <div className="flex flex-col sm:flex-row gap-4">
                <button 
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold transition-colors"
                >
                    Reload Application
                </button>
                <button 
                    onClick={() => {
                        if (window.confirm("This will clear all local projects and settings. Are you sure?")) {
                            indexedDB.deleteDatabase('RFFrequencySuiteDB');
                            window.location.reload();
                        }
                    }}
                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition-colors text-slate-400"
                >
                    Clear Local Data
                </button>
            </div>
        </div>
    );

    if (!isDbReady || isAuthLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Initializing Engine...</div>;

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
                        onExportProject={() => {
                            const state = getCurrentAppState();
                            const projectToExport: Project = currentProject 
                                ? { ...currentProject, data: state, lastModified: new Date() }
                                : { id: Date.now() as any, name: 'Untitled Project', data: state, lastModified: new Date() };
                            exportToJson(projectToExport, `${projectToExport.name}.rfproject`);
                        }} 
                        activeApp={activeApp} 
                        onGoHome={() => setActiveApp(null)} 
                        isSunlightMode={isSunlightMode} 
                        toggleSunlightMode={() => setIsSunlightMode(!isSunlightMode)} 
                        isSaving={saveStatus === 'saving'} 
                        isSaved={saveStatus === 'saved'} 
                        onLogout={handleLogout}
                        user={user}
                        onOpenAccount={() => setIsAccountDashboardOpen(true)}
                        isCommunityOpen={isCommunityOpen}
                        onToggleCommunity={() => setIsCommunityOpen(!isCommunityOpen)}
                    />
            <div className="flex flex-col lg:flex-row gap-6 w-full px-6 py-6">
                <main className={`flex-grow transition-all duration-500 ${isCommunityOpen ? 'lg:flex-1' : 'w-full'}`}>
                    <ErrorBoundary>
                        {activeApp === null ? (
                            <AppLauncher onSelectApp={cat => { 
                                if (cat === 'network') {
                                    setIsCommunityOpen(true);
                                } else {
                                    setActiveApp(cat); 
                                    const first = tabConfig.find(t => t.category === cat); 
                                    if(first) setActiveTab(first.id); 
                                }
                            }} />
                        ) : (
                            <>
                                <Tabs activeTab={activeTab} setActiveTab={setActiveTab} activeApp={activeApp} />
                                <div className="mt-6">
                                    {/* System Documentation */}
                                    {activeTab === 'userGuide' && <UserGuideTab activeApp={activeApp} />}
                                    
                                    {/* Core Coordination Modules */}
                                    {activeTab === 'analyzer' && <AnalyzerTab frequencies={frequencies} setFrequencies={setFrequencies} thresholds={thresholds} setThresholds={setThresholds} scenes={scenes} snapshots={snapshots} setSnapshots={setSnapshots} scanData={scanData} generatorFrequencies={generatorFrequencies} multiBandResults={mbResults} tvChannelStates={genTvStates} setTvChannelStates={setGenTvStates} wmasState={wmasState} />}
                                    {activeTab === 'generator' && <GeneratorTab initialThresholds={initialThresholds} generatedFrequencies={generatorFrequencies} setGeneratorFrequencies={setGeneratorFrequencies} setFrequencies={setFrequencies} customEquipment={customEquipment} onManageCustomEquipment={() => setCustomEquipmentManagerOpen(true)} inclusionRanges={inclusionRanges} setInclusionRanges={setInclusionRanges} frequencies={frequencies} scenes={scenes} requests={genRequests} setRequests={setGenRequests} exclusions={genExclusions} setExclusions={setGenExclusions} useGlobalThresholds={genUseGlobalThresholds} setUseGlobalThresholds={setGenUseGlobalThresholds} globalThresholds={genGlobalThresholds} setGlobalThresholds={setGenGlobalThresholds} manualConstraints={genManualConstraints} setManualConstraints={setGenManualConstraints} ignoreManualIMD={genIgnoreManualIMD} setIgnoreManualIMD={setGenIgnoreManualIMD} siteThresholds={genSiteThresholds} setSiteThresholds={setGenSiteThresholds} equipmentOverrides={equipmentOverrides} tvChannelStates={genTvStates} setTvChannelStates={setGenTvStates} tvRegion={genTvRegion} setTvRegion={setGenTvRegion} wmasState={wmasState} setIsCalculating={setIsEngineCalculating} />}
                                    {activeTab === 'multiband' && <MultiBandTab customEquipment={customEquipment} bands={mbBands} setBands={setMbBands} results={mbResults} setResults={setMbResults} equipmentOverrides={equipmentOverrides} wmasState={wmasState} />}
                                    {activeTab === 'whitespace' && <WhiteSpaceTab />}
                                    
                                    {/* Analysis & Visualization */}
                                    {activeTab === 'spectrum' && <SpectrumTab projectId={currentProject?.id} analyzerFrequencies={frequencies} generatorFrequencies={generatorFrequencies} scanData={scanData} setScanData={setScanData} setInclusionRanges={setInclusionRanges} setActiveTab={setActiveTab} scenes={scenes} festivalActs={festivalActs} constantSystems={festivalConstantSystems} houseSystems={festivalHouseSystems} talkbackPairs={tbResults} talkbackManual={tbManualPairs} zonalResults={zonalResults} wmasState={wmasState} previewEquipment={previewEquipment} setPreviewEquipment={setPreviewEquipment} />}
                                    {activeTab === 'reporting' && <ReportingTab state={getCurrentAppState()} projectName={currentProject?.name} />}
                                    {activeTab === 'waterfall' && <WaterfallTab analyzerFrequencies={frequencies} generatorFrequencies={generatorFrequencies} scanData={scanData} wmasState={wmasState} />}
                                    
                                    {/* Comms Planning */}
                                    {activeTab === 'talkback' && <TalkbackTab manualPairs={tbManualPairs} setManualPairs={setTbManualPairs} results={tbResults} setResults={setTbResults} />}
                                    {activeTab === 'zonalTalkback' && <ZonalTalkbackTab numZones={commsNumZones} setNumZones={setCommsNumZones} zoneConfigs={commsZoneConfigs} setZoneConfigs={setCommsZoneConfigs} distances={commsDistances} setDistances={setCommsDistances} siteMapState={commsSiteMapState} compatibilityMatrix={commsCompatibilityMatrix} setCompatibilityMatrix={setCommsCompatibilityMatrix} results={zonalResults} setResults={setZonalResults} />}
                                    
                                    {/* Exhibition Planning */}
                                    {activeTab === 'multizone' && <MultizoneTab isLinked={true} setIsLinked={()=>{}} numZones={multizoneNumZones} setNumZones={setMultizoneNumZones} zoneConfigs={multizoneZoneConfigs} setZoneConfigs={setMultizoneZoneConfigs} equipmentGroups={multizoneGroups} setEquipmentGroups={setMultizoneGroups} manualFrequencies={multizoneManualFrequencies} setManualFrequencies={setMultizoneManualFrequencies} manualConstraints={multizoneManualConstraints} setManualConstraints={setMultizoneManualConstraints} distances={multizoneDistances} setDistances={setMultizoneDistances} results={multizoneResults} setResults={setMultizoneResults} customEquipment={customEquipment} onManageCustomEquipment={()=>setCustomEquipmentManagerOpen(true)} compatibilityMatrix={multizoneMatrix} setCompatibilityMatrix={setMultizoneMatrix} equipmentOverrides={equipmentOverrides} tvChannelStates={multizoneTvStates} setTvChannelStates={setMultizoneTvStates} wmasState={wmasState} />}
                                    {activeTab === 'multizoneSiteMap' && <SiteMapTab activeApp={activeApp} festivalState={{ zones: festivalZoneConfigs, map: festivalSiteMap, setMap: setFestivalSiteMap, setDist: setFestivalDistances }} multizoneState={{ zones: multizoneZoneConfigs, map: multizoneSiteMap, setMap: setMultizoneSiteMap, setDist: setMultizoneDistances }} />}
                                    
                                    {/* Festival & Event Coordination */}
                                    {activeTab === 'festival' && <FestivalCoordinationTab festivalActs={festivalActs} setFestivalActs={setFestivalActs} constantSystems={festivalConstantSystems} setConstantSystems={setFestivalConstantSystems} houseSystems={festivalHouseSystems} setHouseSystems={setFestivalHouseSystems} zoneConfigs={festivalZoneConfigs} setZoneConfigs={setFestivalZoneConfigs} numZones={festivalNumZones} setNumZones={setFestivalNumZones} distances={festivalDistances} setDistances={setFestivalDistances} initialThresholds={initialThresholds} customEquipment={customEquipment} compatibilityMatrix={festivalMatrix} setCompatibilityMatrix={setFestivalMatrix} scanData={scanData} setScanData={setScanData} siteMapState={festivalSiteMap} equipmentOverrides={equipmentOverrides} setEquipmentOverrides={setEquipmentOverrides} tvChannelStates={festivalTvStates} setTvChannelStates={setFestivalTvStates} onSimulateScan={handleSimulateScan} wmasState={wmasState} setIsCalculating={setIsEngineCalculating} />}
                                    {activeTab === 'timeline' && <TimelineTab frequencies={frequencies} scenes={scenes} setScenes={setScenes} />}
                                    {activeTab === 'festivalSiteMap' && <SiteMapTab activeApp={activeApp} festivalState={{ zones: festivalZoneConfigs, map: festivalSiteMap, setMap: setFestivalSiteMap, setDist: setFestivalDistances }} multizoneState={{ zones: multizoneZoneConfigs, map: multizoneSiteMap, setMap: setMultizoneSiteMap, setDist: setMultizoneDistances }} />}
                                    
                                    {/* Tour Planning */}
                                    {activeTab === 'tourPlanning' && <TourPlanningTab state={tourPlanningState} setState={setTourPlanningState} customEquipment={customEquipment} equipmentOverrides={equipmentOverrides} />}

                                    {/* WMAS Coordination */}
                                    {activeTab === 'wmas' && <WMASTab state={wmasState} setState={setWmasState} tvChannelStates={genTvStates} scanData={scanData} />}

                                    {/* RF Toolkit Utilities */}
                                    {activeTab === 'plotGallery' && (
                                        <PlotGallery 
                                            onImportScanData={(data) => {
                                                setScanData(data);
                                                setActiveTab('spectrum'); // Switch to spectrum analyzer tab
                                            }} 
                                        />
                                    )}
                                    {activeTab === 'proximitySimulator' && <ProximitySimulatorTab />}
                                    {activeTab === 'interference' && <InterferenceDemoTab />}
                                    {activeTab === 'imdDemo' && <IMDDemoTab />}
                                    {activeTab === 'frequencyForensics' && <FrequencyForensicsTab />}
                                    {activeTab === 'diversityPlacement' && <DiversityPlacementTab />}
                                    {activeTab === 'linkBudget' && <LinkBudgetTab />}
                                    {activeTab === 'antennaDownTilt' && <AntennaDownTiltTab />}
                                    {activeTab === 'cableLoss' && <CableLossTab />}
                                    {activeTab === 'fspl' && <FSPLTab />}
                                    {activeTab === 'powerConverter' && <PowerConverterTab />}
                                    {activeTab === 'fresnelZone' && <FresnelZoneTab />}
                                    {activeTab === 'audioTone' && <AudioToneGeneratorTab />}

                                    {/* Settings & Hardware */}
                                    {activeTab === 'equipmentDatabase' && <EquipmentDatabaseTab customEquipment={customEquipment} overrides={equipmentOverrides} setOverrides={setEquipmentOverrides} onManageCustomEquipment={() => setCustomEquipmentManagerOpen(true)} onPreviewEquipment={(profile, frequency) => setPreviewEquipment({ profile, frequency })} />}
                                </div>
                            </>
                        )}
                    </ErrorBoundary>
                </main>

                {/* Persistent Community Sidebar */}
                {isCommunityOpen && (
                    <aside className="lg:w-96 w-full animate-in slide-in-from-right duration-500 sticky top-6 self-start h-[calc(100vh-8rem)] overflow-hidden">
                        <div className={`h-full border border-white/20 rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-colors duration-300 ${communityTheme === 'dark' ? 'bg-slate-800/95 backdrop-blur-3xl shadow-indigo-500/10' : 'bg-slate-50'}`}>
                            <div className={`p-4 border-b border-white/10 flex items-center justify-between ${communityTheme === 'dark' ? 'bg-slate-700/80' : 'bg-white'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${communityTheme === 'dark' ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-indigo-100 text-indigo-600 border-indigo-200'}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                    </div>
                                    <h2 className={`text-xs font-black uppercase tracking-[0.2em] ${communityTheme === 'dark' ? 'text-white' : 'text-slate-950'}`}>Community Network</h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setCommunityTheme(communityTheme === 'dark' ? 'light' : 'dark')}
                                        className={`p-2 rounded-lg transition-colors ${communityTheme === 'dark' ? 'hover:bg-white/5 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-950'}`}
                                        title={`Switch to ${communityTheme === 'dark' ? 'Light' : 'Dark'} Theme`}
                                    >
                                        {communityTheme === 'dark' ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 9H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14 7 7 0 000-14z" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                            </svg>
                                        )}
                                    </button>
                                    <button 
                                        onClick={() => setIsCommunityOpen(false)}
                                        className={`p-2 rounded-lg transition-colors ${communityTheme === 'dark' ? 'hover:bg-white/5 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-950'}`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <div className="flex-grow overflow-y-auto scrollbar-hide p-4 space-y-6">
                                <UserPresenceList onUserClick={handleSelectProfile} />
                                <div className="border-t border-white/5 pt-6">
                                    <ActivityFeed user={user} theme={communityTheme} />
                                </div>
                            </div>
                        </div>
                    </aside>
                )}
            </div>
                    {isAuthenticated && <CommunityPanel projectId={currentProject?.id} user={user} isOpen={isIntercomOpen} selectedDmUser={selectedDmUser} onSelectDmUser={setSelectedDmUser} onClose={() => setIsIntercomOpen(false)} />}
                </>
            )}
            {selectedProfile && (
                <ProfilePopover 
                    selectedProfile={selectedProfile}
                    selectedPublicProfile={selectedPublicProfile}
                    isLoadingProfile={isLoadingProfile}
                    onClose={() => setSelectedProfile(null)}
                    onSendMessage={(user) => {
                        setSelectedProfile(null);
                        setSelectedDmUser(user);
                        setIsIntercomOpen(true);
                    }}
                />
            )}
            <SaveProjectModal isOpen={isSaveModalOpen} onClose={() => setIsSaveModalOpen(false)} onSave={handleSaveAsNewProject} />
            <SavePopupModal isOpen={isSavePopupOpen} onClose={() => setIsSavePopupOpen(false)} />
            {isProjectDashboardOpen && <ProjectDashboard onLoadProject={p => { setCurrentProject(p); loadAppState(p.data); dbService.setLastProjectId(p.id); setProjectDashboardOpen(false); }} onCreateProject={async n => { const p = { name: n, lastModified: new Date(), data: initialState }; const id = await dbService.saveProject(p); setCurrentProject({...p, id}); loadAppState(p.data); dbService.setLastProjectId(id); setProjectDashboardOpen(false); }} onDeleteProject={async id => { await dbService.deleteProject(id); if(currentProject?.id === id){ setCurrentProject(null); dbService.clearLastProjectId(); } }} onClose={() => setProjectDashboardOpen(false)} />}
            {isCustomEquipmentManagerOpen && <div className="no-invert"><CustomEquipmentManager customProfiles={customEquipment} setCustomProfiles={setCustomEquipment} onClose={() => setCustomEquipmentManagerOpen(false)} /></div>}
            {isAuthModalOpen && <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} onSuccess={handleLogin} />}
            {isAccountDashboardOpen && <AccountDashboard 
                user={user} 
                onClose={() => setIsAccountDashboardOpen(false)} 
                onLogout={handleLogout} 
                onUpgrade={(tier) => { /* Handled by Stripe */ }} 
                onLoadProject={(p) => {
                    setCurrentProject(p);
                    loadAppState(p.data);
                    if (typeof p.id === 'number') {
                        dbService.setLastProjectId(p.id);
                    }
                    setIsAccountDashboardOpen(false);
                }}
                onRefreshUser={refreshUser}
            />}
            
            <div className="fixed bottom-0 left-0 right-0 h-8 bg-slate-900/95 backdrop-blur-md border-t border-white/5 z-50 flex items-center justify-between px-4 text-[10px] font-medium tracking-wider uppercase">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${isEngineCalculating ? 'bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-emerald-500'}`} />
                        <span className={isEngineCalculating ? 'text-amber-500' : 'text-slate-400'}>
                            Engine State: {isEngineCalculating ? 'Calculating...' : 'Idle'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${saveStatus === 'saving' ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'}`} />
                        <span className="text-slate-400">
                            Sync Status: {saveStatus === 'saving' ? 'Saving...' : (lastSaved ? `All changes saved to cloud (${lastSaved.toLocaleTimeString()})` : 'Ready')}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-slate-500 flex items-center gap-1">
                        <span className="opacity-50">Project:</span> {currentProject?.name || 'Untitled'} 
                        <span className="mx-1 opacity-30">/</span> 
                        <span className="opacity-50">Tab:</span> {activeTab}
                    </div>
                    <div className="text-slate-600 opacity-50">
                        v2.5.1-STABLE
                    </div>
                </div>
            </div>
            <Toaster theme="dark" position="bottom-right" />
        </div>
    );
};

const SaveProjectModal = ({ isOpen, onClose, onSave }: { isOpen: boolean, onClose: () => void, onSave: (name: string) => void }) => {
    const [name, setName] = useState('');
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-indigo-500/30 rounded-xl shadow-2xl w-full max-w-md p-6 text-white">
                <h3 className="text-xl font-bold mb-4">Save Project As</h3>
                <input 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="Project Name" 
                    className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-slate-200 mb-4 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onSave(name.trim()); onClose(); } }}
                />
                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-md text-slate-400 hover:text-white">Cancel</button>
                    <button 
                        onClick={() => { if (name.trim()) { onSave(name.trim()); onClose(); } }} 
                        disabled={!name.trim()}
                        className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

const SavePopupModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-indigo-500/30 rounded-xl shadow-2xl w-full max-w-md p-6 text-center text-white">
                <div className="text-4xl mb-4">☁️</div>
                <h3 className="text-xl font-bold mb-2">Saving project to Cloud</h3>
                <p className="text-slate-400 text-sm mb-6">
                    Click on 'Download' to Save Project to Your Hard Drive
                </p>
                <button 
                    onClick={onClose} 
                    className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold tracking-wider uppercase text-xs"
                >
                    Got it
                </button>
            </div>
        </div>
    );
};

export default App;
