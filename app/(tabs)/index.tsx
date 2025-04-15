import React, { useState, useEffect } from "react";
import { Text, View, ActivityIndicator, Pressable, Modal, StyleSheet } from "react-native";
import { auth } from "../../src/firebaseConfig";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { getModelAPIkey } from "../../src/services/databaseService";
import { useRouter } from "expo-router";
import {
  disperseQuestion,
  addQuestionDiscussion,
  addOrUpdateDiscussion,
  addOrUpdateGPTResponse,
  getDistinctCategories,
  expandFromAbbreviation,
  processUnclearedGPTResponses,
  getNextOpenDiscussion,
  fetchInitialDiscussion,
  clearDiscussion,
} from "../../src/services/databaseService";
import { transformInput } from "../../src/services/phraseProcessor";
import { db } from "../../src/firebaseConfig";
import { collection, query, where, getDocs, getDoc, doc } from "firebase/firestore";
import Header from "../../src/components/Header";
import InputField from "../../src/components/InputField";
import ActionButtons from "../../src/components/ActionButtons";
import HistoryList from "../../src/components/HistoryList";
import SettingsButton from "../../src/components/SettingsButton";
import { analyzeActivity, ModelAPIkey } from "../../src/services/openaiAPI";
import Icon from "react-native-vector-icons/MaterialIcons";
console.log("LifeLog loaded:", new Date());

// Interface for ActivityLog document
interface ActivityLog {
  id: string;
  discussionId: string;
  description: string;
  category: string;
  timestamp: any; // Firestore Timestamp
  cleared: boolean;
  uid: string;
  lockedCategory?: boolean;
  lockedDescription?: boolean;
}

// Interface for Discussion document
interface Discussion {
  id: string;
  discussionId: string;
  description: string;
  timestamp: any; // Firestore Timestamp
  typeSay: string;
  cleared?: boolean;
}

const IndexScreen: React.FC<{ onApiKeyLoaded: (cachedApiKey: string | null) => void }> = ({ onApiKeyLoaded }) => {
  const [loading, setLoading] = useState(true);

  if (loading) return <ActivityIndicator size="large" color="#0000ff" />;
  return null;
};

export default function AskJanet() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isQuestion, setIsQuestion] = useState(false);
  const [inDJ_Mode, setInDJ_Mode] = useState(false);
  const [history, setHistory] = useState<{ text: string; type: string; aiResponse?: string }[]>([]);
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const router = useRouter();
  const [responses, setResponses] = useState<{ responseType: string; text: string }[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [discussionCounts, setDiscussionCounts] = useState<{ discussionID: string; activityLogId: string; count: number; description: string }[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserEmail(user.email);
        console.log("Logged in as:", user.email);
      } else {
        console.log("No user logged in, redirecting to login");
        router.replace("/login");
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!loadingAuth && userEmail) {
      async function loadInitialData() {
        const initialDiscussion = await fetchInitialDiscussion();
        if (initialDiscussion) {
          console.log("✅ Fetched Initial Discussion:", initialDiscussion);
          setDiscussion(initialDiscussion);
        }

        const uid = auth.currentUser?.uid;
        if (uid) {
          const q = query(collection(db, `Users/${uid}/DiscussionCounts`));
          const querySnapshot = await getDocs(q);
          const countsPromises = querySnapshot.docs.map(async documentSnapshot => {
            const activityLogRef = doc(db, "ActivityLog", documentSnapshot.data().activityLogId as string);
            const activityLogSnap = await getDoc(activityLogRef);
            if (activityLogSnap.exists()) {
              const activityLogData = activityLogSnap.data() as ActivityLog;
              return {
                discussionID: documentSnapshot.id,
                activityLogId: documentSnapshot.data().activityLogId as string,
                count: documentSnapshot.data().count as number,
                description: activityLogData.description,
              };
            }
            return null;
          });

          const counts = (await Promise.all(countsPromises))
            .filter((count): count is { discussionID: string; activityLogId: string; count: number; description: string } => count !== null)
            .sort((a, b) => b.count - a.count);
          setDiscussionCounts(counts);
          console.log("✅ Fetched DiscussionCounts:", counts);
        }
      }
      loadInitialData();
    }
  }, [loadingAuth, userEmail]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      console.log("User signed out");
      setMenuVisible(false);
      router.replace("/login");
    } catch (err: any) {
      console.error("Sign-out Error:", err.message);
    }
  };

  const handleInputChange = (text: string) => {
    setInput(text);
    setIsQuestion(/\b(what|when|how|why|does|is|can)\b/i.test(text));
    setInDJ_Mode(/\b(DJ mode|dj mode|Dj mode|DJ|dj)\b/i.test(text));
  };

  async function fetchDiscussions() {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      console.error("User ID is null, cannot proceed with fetching discussions.");
      return;
    }

    let hasMoreDocuments = true;
    while (hasMoreDocuments) {
      const { snapshot, hasMore } = await getNextOpenDiscussion();
      hasMoreDocuments = hasMore;
      if (snapshot && !snapshot.empty) {
        console.log("✅ Processing Snapshot:", snapshot.docs.map((doc) => doc.data()));
        const docSnapshot = snapshot.docs[0];
        const discussionTyped: Discussion = {
          id: docSnapshot.id,
          discussionId: docSnapshot.data().id as string,
          description: docSnapshot.data().description as string,
          timestamp: docSnapshot.data().timestamp?.toDate() || new Date(),
          typeSay: docSnapshot.data().typeSay as string,
          cleared: docSnapshot.data().cleared as boolean | undefined,
        };
        console.log("Processing Discussion:", discussionTyped.id);
        if (discussionTyped.typeSay === "ask") {
          const gptResponseId = await addQuestionDiscussion(input, discussionTyped.id);
          const parsedResponses = await disperseQuestion(discussionTyped.id, gptResponseId);
          if (!(await clearDiscussion(discussionTyped.id))) break;
          if (parsedResponses) {
            setHistory((prev) => [...prev, ...parsedResponses.map((response) => ({ text: response.toString(), type: "answer" }))]);
          }
          setResponses(responses);
        } else {
          const distinctCategories = await getDistinctCategories();
          const description = await expandFromAbbreviation(discussionTyped.description);
          const activityAnalysis = await analyzeActivity({ categories: distinctCategories, description });
          await addOrUpdateGPTResponse(discussionTyped.id, JSON.stringify(activityAnalysis), "updateDB");
        }
        await processUnclearedGPTResponses();
      }
    }
  }

  const handleSubmit = async () => {
    try {
      const currentInput = input.trim();
      if (currentInput === "") return;

      const transformedInput = transformInput(currentInput);
      const newEntry = { text: transformedInput, type: isQuestion ? "question" : "fact" };
      setHistory((prev) => [...prev, newEntry]);

      await addOrUpdateDiscussion(transformedInput, isQuestion ? "ask" : "tell");
      setInput("");
      fetchDiscussions();
      console.log("made it here");

      if (isQuestion) {
        const aiResponse = responses
          .filter((response) => response.responseType === "gpt response")
          .map((response) => response.text)
          .join(", ") || "";
        setHistory((prev) =>
          prev.map((item) =>
            item.text === transformedInput && item.type === "question" ? { ...item, aiResponse } : item
          )
        );
      }
    } catch (error: any) {
      console.error("Error in handleSubmit:", error);
    }
  };

  const toggleMenu = () => setMenuVisible(!menuVisible);

  if (loadingAuth) return <ActivityIndicator size="large" color="#0000ff" />;

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f5f5", padding: 20, width: "100%" }}>
      <IndexScreen onApiKeyLoaded={setApiKey} />
      <Header />
      <InputField input={input} onChange={handleInputChange} />
      <ActionButtons isQuestion={isQuestion} onSubmit={handleSubmit} />
      <HistoryList history={history} />
      <View style={styles.bottomContainer}>
        <Pressable onPress={toggleMenu} style={styles.hamburger}>
          <Icon name="menu" size={24} color="#333" />
        </Pressable>
        <SettingsButton style={styles.settingsButton} />
      </View>
      <Modal visible={menuVisible} transparent={true} animationType="slide" onRequestClose={toggleMenu}>
        <View style={styles.modalOverlay}>
          <View style={styles.menu}>
            <Text style={styles.menuItem}>Logged in as: {userEmail || "Loading..."}</Text>
            <Text style={styles.menuItem}>
              Stored API Key: {apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : "No API key found"}
            </Text>
            <Pressable onPress={handleSignOut} style={styles.menuButton}>
              <Text style={styles.menuButtonText}>Sign Out</Text>
            </Pressable>
            <Pressable onPress={toggleMenu} style={styles.menuButton}>
              <Text style={styles.menuButtonText}>Close Menu</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomContainer: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    position: "absolute",
    bottom: 0,
    left: 0,
    backgroundColor: "#f5f5f5",
  },
  hamburger: { padding: 10 },
  settingsButton: { marginRight: 10 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  menu: {
    backgroundColor: "#fff",
    padding: 20,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    width: "100%",
  },
  menuItem: { fontSize: 16, marginBottom: 10, color: "#333" },
  menuButton: {
    paddingVertical: 10,
    backgroundColor: "#007AFF",
    borderRadius: 5,
    alignItems: "center",
    marginTop: 10,
  },
  menuButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});