import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL, listAll } from 'firebase/storage';

// ------------------------------------------------------------------
// TODO: Replace the following config with your own from Firebase Console
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project
// 3. Add a Web App to get these details
// 4. Enable "Storage" in the Firebase Console
// 5. Update Storage Rules to allow read/write (for development):
//    allow read, write: if true;
// ------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

let storage: any = null;

try {
  const app = initializeApp(firebaseConfig);
  storage = getStorage(app);
} catch (error) {
  console.warn("Firebase not configured correctly. Check services/firebase.ts");
}

export const uploadPhoto = async (file: File): Promise<string | null> => {
  if (!storage) return null;
  
  // Create a unique filename
  const fileName = `tree-photos/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, fileName);

  try {
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error("Error uploading photo:", error);
    return null;
  }
};

export const getAllPhotos = async (): Promise<string[]> => {
  if (!storage) return [];

  const listRef = ref(storage, 'tree-photos/');
  try {
    const res = await listAll(listRef);
    const urlPromises = res.items.map((itemRef) => getDownloadURL(itemRef));
    return await Promise.all(urlPromises);
  } catch (error) {
    console.error("Error fetching photos:", error);
    return [];
  }
};
