import { Project, EquipmentProfile, Plot, Thresholds } from '../types';

const DB_NAME = 'RFFrequencySuiteDB';
const DB_VERSION = 3;
const PROJECTS_STORE = 'projects';
const EQUIPMENT_STORE = 'customEquipment';
const CONFIG_STORE = 'config';
const PLOTS_STORE = 'plots';

let db: IDBDatabase;

export const initDB = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Error opening IndexedDB:', request.error);
      reject(false);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(true);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        db.createObjectStore(PROJECTS_STORE, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(EQUIPMENT_STORE)) {
        db.createObjectStore(EQUIPMENT_STORE, { keyPath: 'id' });
      }
       if (!db.objectStoreNames.contains(CONFIG_STORE)) {
        db.createObjectStore(CONFIG_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(PLOTS_STORE)) {
        const plotStore = db.createObjectStore(PLOTS_STORE, { keyPath: 'id', autoIncrement: true });
        plotStore.createIndex('projectId', 'projectId', { unique: false });
      }
    };
  });
};

// --- Project Functions ---

export const saveProject = (project: Omit<Project, 'id'> | Project): Promise<number> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PROJECTS_STORE], 'readwrite');
    const store = transaction.objectStore(PROJECTS_STORE);
    const request = store.put(project);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
};

export const getProjects = (): Promise<Project[]> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PROJECTS_STORE], 'readonly');
    const store = transaction.objectStore(PROJECTS_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getProject = (id: number): Promise<Project> => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PROJECTS_STORE], 'readonly');
      const store = transaction.objectStore(PROJECTS_STORE);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
};


export const deleteProject = (id: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PROJECTS_STORE, PLOTS_STORE], 'readwrite');
    
    // Delete associated plots
    const plotStore = transaction.objectStore(PLOTS_STORE);
    const plotIndex = plotStore.index('projectId');
    const plotRequest = plotIndex.openKeyCursor(IDBKeyRange.only(id));
    plotRequest.onsuccess = () => {
        const cursor = plotRequest.result;
        if (cursor) {
            plotStore.delete(cursor.primaryKey);
            cursor.continue();
        }
    };

    // Delete project
    const projectStore = transaction.objectStore(PROJECTS_STORE);
    const projectRequest = projectStore.delete(id);
    projectRequest.onerror = () => reject(projectRequest.error);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};


// --- Custom Equipment Functions ---

export const saveCustomEquipment = (profile: EquipmentProfile): Promise<string> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([EQUIPMENT_STORE], 'readwrite');
    const store = transaction.objectStore(EQUIPMENT_STORE);
    const request = store.put(profile);
    request.onsuccess = () => resolve(request.result as string);
    request.onerror = () => reject(request.error);
  });
};

export const getCustomEquipment = (): Promise<EquipmentProfile[]> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([EQUIPMENT_STORE], 'readonly');
    const store = transaction.objectStore(EQUIPMENT_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const deleteCustomEquipment = (id: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([EQUIPMENT_STORE], 'readwrite');
    const store = transaction.objectStore(EQUIPMENT_STORE);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// --- Plot Functions ---

export const savePlot = (plot: Omit<Plot, 'id'>): Promise<number> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([PLOTS_STORE], 'readwrite');
        const store = transaction.objectStore(PLOTS_STORE);
        const request = store.add(plot);
        request.onsuccess = () => resolve(request.result as number);
        request.onerror = () => reject(request.error);
    });
};

export const getPlotsForProject = (projectId: number): Promise<Plot[]> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([PLOTS_STORE], 'readonly');
        const store = transaction.objectStore(PLOTS_STORE);
        const index = store.index('projectId');
        const request = index.getAll(projectId);
        request.onsuccess = () => resolve(request.result.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime()));
        request.onerror = () => reject(request.error);
    });
};

export const deletePlot = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([PLOTS_STORE], 'readwrite');
        const store = transaction.objectStore(PLOTS_STORE);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};


// --- Config Functions ---
const LAST_PROJECT_ID_KEY = 'lastProjectId';
const GLOBAL_OVERRIDES_KEY = 'globalEquipmentOverrides';

export const setLastProjectId = (id: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CONFIG_STORE], 'readwrite');
    const store = transaction.objectStore(CONFIG_STORE);
    const request = store.put({ key: LAST_PROJECT_ID_KEY, value: id });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getLastProjectId = (): Promise<number | null> => {
  return new Promise((resolve) => {
    const transaction = db.transaction([CONFIG_STORE], 'readonly');
    const store = transaction.objectStore(CONFIG_STORE);
    const request = store.get(LAST_PROJECT_ID_KEY);
    request.onsuccess = () => {
      resolve(request.result ? request.result.value : null);
    };
    request.onerror = () => resolve(null);
  });
};

export const saveGlobalOverrides = (overrides: Record<string, Partial<Thresholds>>): Promise<void> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CONFIG_STORE], 'readwrite');
    const store = transaction.objectStore(CONFIG_STORE);
    const request = store.put({ key: GLOBAL_OVERRIDES_KEY, value: overrides });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getGlobalOverrides = (): Promise<Record<string, Partial<Thresholds>> | null> => {
  return new Promise((resolve) => {
    const transaction = db.transaction([CONFIG_STORE], 'readonly');
    const store = transaction.objectStore(CONFIG_STORE);
    const request = store.get(GLOBAL_OVERRIDES_KEY);
    request.onsuccess = () => {
      resolve(request.result ? request.result.value : null);
    };
    request.onerror = () => resolve(null);
  });
};

export const clearLastProjectId = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CONFIG_STORE], 'readwrite');
    const store = transaction.objectStore(CONFIG_STORE);
    const request = store.delete(LAST_PROJECT_ID_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};