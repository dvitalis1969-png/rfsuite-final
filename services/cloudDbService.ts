
import { db, auth, getDocWithTimeout, getDocsWithTimeout, addDocWithTimeout, updateDocWithTimeout, deleteDocWithTimeout } from '../src/lib/firebase';
import { 
  collection, 
  doc, 
  query, 
  where, 
  orderBy, 
  Timestamp
} from 'firebase/firestore';
import { Project, AppState } from '../types';

const PROJECTS_COLLECTION = 'projects';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData.map((provider: any) => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const saveProjectToCloud = async (userId: string, project: Omit<Project, 'id'> & { id?: string | number }): Promise<string> => {
  if (!db) throw new Error('Firestore not initialized');

  const projectData = {
    name: project.name,
    userId: userId,
    lastModified: Timestamp.now(),
    data: JSON.stringify(project.data) // Store as string to avoid nested array issues in Firestore
  };

  if (project.id && typeof project.id === 'string' && project.id.length > 5) {
    // Update existing cloud project
    const docRef = doc(db, PROJECTS_COLLECTION, project.id);
    try {
      await updateDocWithTimeout(docRef, projectData);
      return project.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${PROJECTS_COLLECTION}/${project.id}`);
      throw error;
    }
  } else {
    // Create new cloud project
    try {
      const docRef = await addDocWithTimeout(collection(db, PROJECTS_COLLECTION), projectData);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, PROJECTS_COLLECTION);
      throw error;
    }
  }
};

export const getUserProjectsFromCloud = async (userId: string): Promise<any[]> => {
  if (!db) throw new Error('Firestore not initialized');

  const q = query(
    collection(db, PROJECTS_COLLECTION), 
    where('userId', '==', userId)
  );

  try {
    const querySnapshot = await getDocsWithTimeout(q);
    const projects = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        data: typeof data.data === 'string' ? JSON.parse(data.data) : data.data,
        lastModified: (data.lastModified as Timestamp).toDate()
      };
    });

    // Sort in memory to avoid needing a composite index
    return projects.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, PROJECTS_COLLECTION);
    throw error;
  }
};

export const deleteProjectFromCloud = async (projectId: string): Promise<void> => {
  if (!db) throw new Error('Firestore not initialized');
  try {
    await deleteDocWithTimeout(doc(db, PROJECTS_COLLECTION, projectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${PROJECTS_COLLECTION}/${projectId}`);
    throw error;
  }
};

export const getProjectFromCloud = async (projectId: string): Promise<any> => {
    if (!db) throw new Error('Firestore not initialized');
    const docRef = doc(db, PROJECTS_COLLECTION, projectId);
    try {
      const docSnap = await getDocWithTimeout(docRef);
      if (docSnap.exists()) {
          const data = docSnap.data();
          return {
              id: docSnap.id,
              ...data,
              data: typeof data.data === 'string' ? JSON.parse(data.data) : data.data,
              lastModified: (data.lastModified as Timestamp).toDate()
          };
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${PROJECTS_COLLECTION}/${projectId}`);
      throw error;
    }
};
