import React, { useState, useEffect, useRef } from "react";
import {
  Text,
  View,
  ActivityIndicator,
  Pressable,
  Modal,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { auth } from "../../src/firebaseConfig";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { getModelAPIkey } from "../../src/services/apiUtils"; // Updated import
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
import RNFS from "react-native-fs";
import Clipboard from "@react-native-clipboard/clipboard";
import { request, PERMISSIONS } from "react-native-permissions";
import { setUID } from "../../src/utils/uidManager";

let captureRef: any;
try {
  captureRef = require("react-native-view-shot").captureRef;
} catch (error) {
  console.warn("react-native-view-shot not installed. PNG/JPG saving disabled.");
}

console.log("LifeLog loaded:", new Date());

interface ActivityLog {
  id: string;
  discussionId: string;
  description: string;
  category: string;
  timestamp: any;
  cleared: boolean;
  uid: string;
  lockedCategory?: boolean;
  lockedDescription?: boolean;
}

interface Discussion {
  id: string;
  discussionId: string;
  description: string;
  timestamp: any;
  typeSay: string;
  cleared?: boolean;
}

const IndexScreen: React.FC<{ onApiKeyLoaded: (cachedApiKey: string | null) => void }> = ({
  onApiKeyLoaded,
}) => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadApiKey() {
      try {
        const key = await getModelAPIkey("owner", "name", "model");
        onApiKeyLoaded(key?.apiKey || null);
        console.log("API Key loaded:", key ? `${key.apiKey.slice(0, 4)}...${key.apiKey.slice(-4)}` : "None");
      } catch (error) {
        console.error("Failed to load API Key:", error);
        onApiKeyLoaded(null);
      } finally {
        setLoading(false);
      }
    }
    loadApiKey();
  }, [onApiKeyLoaded]);

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
  const [discussionCounts, setDiscussionCounts] = useState<
    { discussionID: string; activityLogId: string; count: number; description: string }[]
  >([]);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogQuestion, setDialogQuestion] = useState("");
  const [distinctCategories, setDistinctCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [filePath, setFilePath] = useState<string>("");
  const [currentDiscussion, setCurrentDiscussion] = useState<Discussion | null>(null);
  const [processedDiscussions, setProcessedDiscussions] = useState<string[]>([]);
  const dialogRef = useRef<View>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserEmail(user.email);
        console.log("Logged in as:", user.email, "UID:", user.uid);
        setUID(user.uid);
        setTimeout(async () => {
          try {
            await initializeUser();
            loadInitialData();
          } catch (error) {
            console.error("Error initializing user:", error);
          }
        }, 500);
      } else {
        console.log("No user logged in, delaying navigation to login");
        setTimeout(() => router.replace("/login"), 500);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, [router]);

  async function loadInitialData() {
    if (!auth.currentUser?.uid) {
      console.error("Cannot load initial data: No UID available.");
      return;
    }
    try {
      const initialDiscussion = await fetchInitialDiscussion();
      if (initialDiscussion) {
        console.log("✅ Fetched Initial Discussion:", initialDiscussion);
        setDiscussion({
          id: initialDiscussion.id,
          discussionId: initialDiscussion.discussionId || initialDiscussion.id,
          description: initialDiscussion.description || "No description available",
          timestamp: initialDiscussion.timestamp,
          typeSay: initialDiscussion.typeSay || "ask",
          cleared: initialDiscussion.cleared || false,
        });
      }

      const uid = auth.currentUser.uid;
      const q = query(collection(db, `Users/${uid}/DiscussionCounts`));
      const querySnapshot = await getDocs(q);
      const countsPromises = querySnapshot.docs.map(async (documentSnapshot) => {
        const activityLogRef = doc(db, "ActivityLog", documentSnapshot.data().activityLogId as string);
        const activityLogSnap = await getDoc(activityLogRef);
        if (activityLogSnap.exists()) {
          const activityLogData = activityLogSnap.data() as ActivityLog;
          return {
            discussionID: documentSnapshot.id,
            activityLogId: documentSnapshot.data().activityLogId as string,
            count: documentSnapshot.data().count as number,
            description: activityLogData.description || "No description",
          };
        }
        return null;
      });

      const counts = (await Promise.all(countsPromises))
        .filter(
          (
            count
          ): count is { discussionID: string; activityLogId: string; count: number; description: string } =>
            count !== null
        )
        .sort((a, b) => b.count - a.count);
      setDiscussionCounts(counts);
      console.log("✅ Fetched DiscussionCounts:", counts);
    } catch (error) {
      console.error("Error loading initial data:", error);
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      console.log("User signed out");
      setMenuVisible(false);
      setTimeout(() => router.replace("/login"), 500);
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
      console.error("User ID is null, cannot fetch discussions.");
      return;
    }

    console.log("Fetching next open discussion...");
    try {
      const { snapshot, hasMore } = await getNextOpenDiscussion();
      if (snapshot && !snapshot.empty) {
        console.log("✅ Snapshot found with", snapshot.docs.length, "documents:", snapshot.docs.map((doc) => doc.data()));
        const docSnapshot = snapshot.docs[0];
        const discussionTyped: Discussion = {
          id: docSnapshot.id,
          discussionId: docSnapshot.data().id || docSnapshot.id,
          description: docSnapshot.data().description || "No description available",
          timestamp: docSnapshot.data().timestamp?.toDate() || new Date(),
          typeSay: docSnapshot.data().typeSay || "ask",
          cleared: docSnapshot.data().cleared || false,
        };
        console.log("Processing Discussion:", discussionTyped, "Description:", discussionTyped.description);

        if (processedDiscussions.includes(discussionTyped.id) || discussionTyped.cleared) {
          console.log("Skipping processed or cleared discussion:", discussionTyped.id);
          if (hasMore) fetchDiscussions();
          return;
        }

        setProcessedDiscussions((prev) => [...prev, discussionTyped.id]);

        if (discussionTyped.typeSay === "ask") {
          console.log("Triggering dialog for ask discussion, setting question:", discussionTyped.description);
          try {
            const categories = await getDistinctCategories();
            console.log("Categories fetched:", categories);
            setDistinctCategories(categories);
            setDialogQuestion(discussionTyped.description || "No question available");
            setCurrentDiscussion(discussionTyped);
            setSelectedCategories([]);
            setFilePath("");
            setDialogVisible(true);
          } catch (error) {
            console.error("Error setting up dialog:", error);
            setDialogQuestion("Error loading question");
            setDialogVisible(false);
            setCurrentDiscussion(null);
            if (hasMore) fetchDiscussions();
          }
        } else {
          console.log("Processing non-ask discussion:", discussionTyped.description);
          if (apiKey) {
            try {
              const distinctCategories = await getDistinctCategories();
              const description = await expandFromAbbreviation(discussionTyped.description);
              const activityAnalysis = await analyzeActivity({ categories: distinctCategories, description });
              await addOrUpdateGPTResponse(discussionTyped.id, JSON.stringify(activityAnalysis), "updateDB");
            } catch (error) {
              console.error("Error analyzing non-ask discussion:", error);
            }
          } else {
            console.warn("Skipping OpenAI analysis due to missing API key.");
          }
          console.log("Clearing non-ask discussion:", discussionTyped.id);
          try {
            await clearDiscussion(discussionTyped.id);
            await processUnclearedGPTResponses();
            if (hasMore) fetchDiscussions();
          } catch (error) {
            console.error("Error clearing non-ask discussion:", error);
            if (hasMore) fetchDiscussions();
          }
        }
      } else {
        console.log("No open discussions found.");
      }
    } catch (error) {
      console.error("Error fetching discussions:", error);
    }
  }

  const handleSaveTxt = async () => {
    if (!currentDiscussion) {
      console.error("No current discussion for saving TXT.");
      setFilePath("Error: No discussion available");
      return;
    }
    try {
      const content = `Question: ${dialogQuestion}\nSelected Categories: ${
        selectedCategories.length > 0 ? selectedCategories.join(", ") : "None"
      }\nActivityLog Description: ${await getActivityLogDescription()}`;
      const fileName = `question_${currentDiscussion.id}_${Date.now()}.txt`;
      const path = `${RNFS.PicturesDirectoryPath}/LifeLog/${fileName}`;
      await RNFS.mkdir(`${RNFS.PicturesDirectoryPath}/LifeLog`);
      await RNFS.writeFile(path, content, "utf8");
      console.log("Text file saved at:", path);
      setFilePath(path);
      Clipboard.setString(`Question: ${dialogQuestion}\nFile Path: ${path}`);
      console.log("Copied to clipboard:", path);
    } catch (error) {
      console.error("Error saving TXT:", error);
      setFilePath("Error saving TXT file");
    }
  };

  const handleSaveImage = async (format: "jpg" | "png") => {
    if (!dialogRef.current || !currentDiscussion) {
      console.error("No dialog ref or discussion for saving image.");
      setFilePath("Error: No dialog available");
      Alert.alert("Error", `Cannot save as ${format.toUpperCase()}: No dialog or discussion available.`);
      return;
    }
    if (!captureRef) {
      console.error(`react-native-view-shot not installed for ${format.toUpperCase()} saving.`);
      Alert.alert(
        "Error",
        `Cannot save as ${format.toUpperCase()}: react-native-view-shot is not installed. Run 'npm install react-native-view-shot' and rebuild.`
      );
      return;
    }
    try {
      if (Platform.OS === "android") {
        console.log("Requesting WRITE_EXTERNAL_STORAGE permission...");
        const permissionResult = await request(PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE);
        console.log("Permission result:", permissionResult);
        if (permissionResult !== "granted") {
          throw new Error("WRITE_EXTERNAL_STORAGE permission denied");
        }
      }
      const uri = await captureRef(dialogRef.current, { format, quality: 0.8 });
      const fileName = `question_${currentDiscussion.id}_${Date.now()}.${format}`;
      const galleryPath = `${RNFS.PicturesDirectoryPath}/LifeLog/${fileName}`;
      console.log(`Attempting to create directory: ${RNFS.PicturesDirectoryPath}/LifeLog`);
      try {
        await RNFS.mkdir(`${RNFS.PicturesDirectoryPath}/LifeLog`);
        console.log("Directory created successfully");
      } catch (mkdirError) {
        console.error("Failed to create directory:", mkdirError);
        const fallbackPath = `${RNFS.DocumentDirectoryPath}/LifeLog/${fileName}`;
        console.log(`Falling back to: ${RNFS.DocumentDirectoryPath}/LifeLog`);
        await RNFS.mkdir(`${RNFS.DocumentDirectoryPath}/LifeLog`);
        await RNFS.moveFile(uri, fallbackPath);
        console.log(`${format.toUpperCase()} saved at fallback:`, fallbackPath);
        setFilePath(fallbackPath);
        Clipboard.setString(`Question: ${dialogQuestion}\nFile Path: ${fallbackPath}`);
        console.log("Copied to clipboard:", fallbackPath);
        return;
      }
      await RNFS.moveFile(uri, galleryPath);
      console.log(`${format.toUpperCase()} saved at:`, galleryPath);
      setFilePath(galleryPath);
      Clipboard.setString(`Question: ${dialogQuestion}\nFile Path: ${galleryPath}`);
      console.log("Copied to clipboard:", galleryPath);
      await RNFS.scanFile(galleryPath);
      console.log(`${format.toUpperCase()} added to gallery`);
    } catch (error) {
      console.error(`Error saving ${format.toUpperCase()}:`, error);
      setFilePath(`Error saving ${format.toUpperCase()} file`);
      Alert.alert("Error", `Failed to save as ${format.toUpperCase()}: ${error.message}`);
    }
  };

  async function getActivityLogDescription() {
    try {
      if (!currentDiscussion) return "No ActivityLog description available";
      const activityLogSnapshot = await getDocs(collection(db, "ActivityLog"));
      const relatedLog = activityLogSnapshot.docs.find(
        (doc) => doc.data().discussionId === currentDiscussion.id
      );
      return relatedLog ? relatedLog.data().description || "No description" : "No ActivityLog description available";
    } catch (error) {
      console.error("Error fetching ActivityLog:", error);
      return "No ActivityLog description available";
    }
  }

  const handleDialogConfirm = async () => {
    if (!currentDiscussion) {
      console.error("No current discussion set.");
      setDialogVisible(false);
      setCurrentDiscussion(null);
      fetchDiscussions();
      return;
    }

    try {
      console.log("Confirming dialog for discussion:", currentDiscussion.id);
      const gptResponseId = await addQuestionDiscussion(input, currentDiscussion.id);
      const parsedResponses = await disperseQuestion(currentDiscussion.id, gptResponseId);
      console.log("Clearing discussion:", currentDiscussion.id);
      const cleared = await clearDiscussion(currentDiscussion.id);

      if (cleared && parsedResponses) {
        const newResponses = parsedResponses.map((response) => ({
          responseType: "gpt response",
          text: response.toString(),
        }));
        setHistory((prev) => [
          ...prev,
          ...newResponses.map((response) => ({ text: response.text, type: "answer" })),
        ]);
        setResponses(newResponses);
        console.log("Setting responses:", newResponses);
      }

      await handleSaveTxt();
      console.log("Closing dialog and fetching next discussion.");
      setDialogVisible(false);
      setCurrentDiscussion(null);
      setResponses([]);
      fetchDiscussions();
    } catch (error) {
      console.error("Error in dialog confirmation:", error);
      setDialogVisible(false);
      setCurrentDiscussion(null);
      setResponses([]);
      fetchDiscussions();
    }
  };

  const handleDialogCancel = async () => {
    if (currentDiscussion) {
      console.log("Canceling dialog, clearing discussion:", currentDiscussion.id);
      try {
        await clearDiscussion(currentDiscussion.id);
      } catch (error) {
        console.error("Error clearing discussion on cancel:", error);
      }
    } else {
      console.log("No current discussion to clear.");
    }
    setDialogVisible(false);
    setCurrentDiscussion(null);
    setResponses([]);
    fetchDiscussions();
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((cat) => cat !== category) : [...prev, category]
    );
  };

  const handleSubmit = async () => {
    try {
      const currentInput = input.trim();
      if (currentInput === "") return;

      console.log("Submitting input:", currentInput);
      const transformedInput = transformInput(currentInput);
      const newEntry = { text: transformedInput, type: isQuestion ? "question" : "fact" };
      setHistory((prev) => [...prev, newEntry]);

      await addOrUpdateDiscussion(transformedInput, isQuestion ? "ask" : "tell");
      setInput("");
      fetchDiscussions();
      console.log("Input processed:", transformedInput);

      if (isQuestion) {
        const aiResponse = responses
          .filter((response) => response.responseType === "gpt response")
          .map((response) => response.text)
          .join(", ") || "";
        setHistory((prev) =>
          prev.map((item) =>
            item.text === transformedInput && item.type === "question"
              ? { ...item, aiResponse }
              : item
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
      <Modal
        visible={dialogVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={handleDialogCancel}
      >
        <View style={styles.modalOverlay}>
          <View ref={dialogRef} style={styles.dialogContainer}>
            <Text style={styles.modalTitle}>Question Details</Text>
            <Text style={styles.modalLabel}>Question: {dialogQuestion || "No question available"}</Text>
            <Text style={styles.modalLabel}>Select Categories:</Text>
            <FlatList
              data={distinctCategories}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.categoryItem} onPress={() => toggleCategory(item)}>
                  <Text style={styles.categoryText}>{item}</Text>
                  <Text>{selectedCategories.includes(item) ? "✔" : "⬜"}</Text>
                </TouchableOpacity>
              )}
            />
            <Text style={styles.modalLabel}>
              Saved File: {filePath || "No file saved yet"}
            </Text>
            <View style={styles.saveButtons}>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveTxt}>
                <Text style={styles.saveButtonText}>Save as TXT</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={() => handleSaveImage("png")}>
                <Text style={styles.saveButtonText}>Save as PNG</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={() => handleSaveImage("jpg")}>
                <Text style={styles.saveButtonText}>Save as JPG</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButton} onPress={handleDialogCancel}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.confirmButton]} onPress={handleDialogConfirm}>
                <Text style={styles.modalButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
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
  dialogContainer: {
    backgroundColor: "#fff",
    padding: 20,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    width: "100%",
    maxHeight: "80%",
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  modalLabel: { fontSize: 16, marginBottom: 10, color: "#333" },
  categoryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  categoryText: { fontSize: 16 },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 20,
  },
  modalButton: {
    padding: 10,
    borderRadius: 5,
    backgroundColor: "#ddd",
    width: "45%",
    alignItems: "center",
  },
  confirmButton: { backgroundColor: "#007bff" },
  modalButtonText: { color: "#fff", fontWeight: "bold" },
  saveButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 10,
    marginBottom: 10,
  },
  saveButton: {
    padding: 8,
    borderRadius: 5,
    backgroundColor: "#28a745",
    width: "30%",
    alignItems: "center",
  },
  saveButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});