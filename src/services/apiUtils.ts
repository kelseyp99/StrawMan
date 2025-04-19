import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

export interface ModelAPIkey {
  aiModel: string;
  apiKey: string;
  endPointURL: string;
}

import { doc, getDoc } from "firebase/firestore";

export const getModelAPIkey = async () => {
  const user = auth.currentUser;
  if (!user) return null;
  const docRef = doc(db, "AI_Models", user.uid);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data().apiKey : null;
};