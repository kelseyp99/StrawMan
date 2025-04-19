import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebaseConfig";

export interface ModelAPIkey {
  aiModel: string;
  apiKey: string;
  endPointURL: string;
}

export async function getModelAPIkey(owner: string, name: string, model: string): Promise<ModelAPIkey | null> {
  try {
    const q = query(collection(db, "AI_Models"), where("owner", "==", owner), where("Name", "==", name), where("Model", "==", model));
    const snapshot = await getDocs(q);
    for (const doc of snapshot.docs) {
      console.log(doc.id, '=>', doc.data());
      if (doc.data().active) {
        const apiKey = doc.data().apiKey;
        const endPointURL = doc.data().endPointURL;
        console.log("API Key loaded:", apiKey);
        console.log("EndPoint URL:", endPointURL);
        return { aiModel: model, apiKey, endPointURL };
      }
    }
    console.warn("No API key found.");
    return null;
  } catch (error) {
    console.error("Error fetching API key:", error);
    return null;
  }
}