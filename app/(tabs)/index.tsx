import React, { useState, useEffect } from "react";
import { Text, View, ActivityIndicator, Pressable, Modal, StyleSheet } from "react-native";
import { auth } from "../../src/firebaseConfig";
import { signOut } from "firebase/auth";
import { getAIResponse, getModelAPIkey, getParsedGPTResponses } from "../../src/services/databaseService";
import { useRouter } from "expo-router";
import {
  disperseQuestion,
  addQuestionDiscussion,
  addOrUpdateDiscussion,
  addOrUpdateGPTResponse,
  getDistinctCategories,
  getGPTResponses,
  getLastOpenDiscussion,
  addOrUpdateActivityLog,
  expandFromAbbreviation,
  processUnclearedGPTResponses,
  getNextOpenDiscussion,
  markDiscussionAsCleared,
  fetchInitialDiscussion,
  renameFieldToCleared,
  clearDiscussion,
} from "../../src/services/databaseService";
import Header from "../../src/components/Header";
import InputField from "../../src/components/InputField";
import ActionButtons from "../../src/components/ActionButtons";
import HistoryList from "../../src/components/HistoryList";
import SettingsButton from "../../src/components/SettingsButton";
import { analyzeActivity, ModelAPIkey } from "../../src/services/openaiAPI";
import Icon from "react-native-vector-icons/MaterialIcons"; // Import MaterialIcons

// ✅ Fetch API Key in a separate component before rendering AskJanet
const IndexScreen: React.FC<{ onApiKeyLoaded: (cachedApiKey: string | null) => void }> = ({ onApiKeyLoaded }) => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKey = async () => {
      const key = await getModelAPIkey("LifeLog", "OpenAI", "gpt-3.5-turbo");
      const { aiModel, apiKey, endPointURL } = key as ModelAPIkey;
      onApiKeyLoaded(apiKey);
      setLoading(false);
    };

    fetchKey();
  }, []);

  if (loading) {
    return <ActivityIndicator size="large" color="#0000ff" />;
  }

  return null;
};

// Fake Advertisement Component
const FakeAd: React.FC = () => (
  <View style={styles.fakeAd}>
    <Text style={styles.fakeAdText}>🌟 Get Premium Features - Only $9.99/month! 🌟</Text>
  </View>
);

export default function AskJanet() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isQuestion, setIsQuestion] = useState(false);
  const [inDJ_Mode, setInDJ_Mode] = useState(false);
  const [history, setHistory] = useState<{ text: string; type: string; aiResponse?: string }[]>([]);
  const [inputValue, setInputValue] = useState<string>("");
  const [discussion, setDiscussion] = useState<{
    id: string;
    discussionId: any;
    response: any;
    timestamp: any;
    cleared: any;
  } | null>(null);
  const router = useRouter();
  const [responses, setResponses] = useState<{ responseType: string; text: string }[]>([]);
  const [isAdMobInitialized, setIsAdMobInitialized] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false); // State for menu visibility

  // ✅ Fetch user email on mount
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setUserEmail(user.email);
      console.log("Logged in as:", user.email);
    }
  }, []);

  // ✅ Fetch initial discussion
  useEffect(() => {
    async function loadDiscussion() {
      const initialDiscussion = await fetchInitialDiscussion();
      if (initialDiscussion) {
        console.log("✅ Fetched Initial Discussion:", initialDiscussion);
        setDiscussion(initialDiscussion);
      }
    }
    loadDiscussion();
  }, []);

  // ✅ Handle sign-out
  const handleSignOut = async (): Promise<void> => {
    try {
      await signOut(auth);
      console.log("User signed out");
      setMenuVisible(false); // Close menu after sign-out
      router.replace("/login");
    } catch (err: any) {
      console.error("Sign-out Error:", err.message);
    }
  };

  // ✅ Handle input change
  const handleInputChange = (text: string): void => {
    setInput(text);
    setIsQuestion(/\b(what|when|how|why|does|is|can)\b/i.test(text));
    setInDJ_Mode(/\b(DJ mode|dj mode|Dj mode|DJ|dj)\b/i.test(text));
  };

  // ✅ Process uncleared discussions
  async function fetchDiscussions(): Promise<void> {
    let hasMoreDocuments = true;
    renameFieldToCleared;
    while (hasMoreDocuments) {
      const { snapshot, hasMore } = await getNextOpenDiscussion();
      hasMoreDocuments = hasMore;

      if (snapshot && !snapshot.empty) {
        console.log("✅ Processing Snapshot:", snapshot.docs.map((doc) => doc.data()));

        const docSnapshot = snapshot.docs[0];
        const discussionTyped = {
          id: docSnapshot.id,
          discussionId: docSnapshot.data().id,
          description: docSnapshot.data().description,
          timestamp: docSnapshot.data().timestamp?.toDate() || new Date(),
          typeSay: docSnapshot.data().typeSay,
        };

        console.log("Processing Discussion:", discussionTyped.id);

        if (discussionTyped.typeSay === "ask") {
          const gptResponseId = await addQuestionDiscussion(input, discussionTyped.id);
          const parsedResponses = await disperseQuestion(discussionTyped.id, gptResponseId);
          if (!(await clearDiscussion(discussionTyped.id))) {
            break;
          }
          if (parsedResponses) {
            setHistory((prev) => [...prev, ...parsedResponses.map((response) => ({ text: response.toString(), type: "answer" }))]);
          }
          setInputValue(responses.join(", ") || "");
          setResponses(responses);
        } else {
          const distinctCategories = await getDistinctCategories();
          const description = await expandFromAbbreviation(discussionTyped.description);
          const activityAnalysis = await analyzeActivity({
            categories: distinctCategories,
            description,
          });

          await addOrUpdateGPTResponse(
            discussionTyped.id,
            JSON.stringify(activityAnalysis),
            "updateDB"
          );
        }

        await processUnclearedGPTResponses();
      }
    }
  }

  // ✅ Handle submit
  const handleSubmit = async (): Promise<void> => {
    try {
      const currentInput = input.trim();
      if (currentInput === "") return;

      const newEntry = { text: currentInput, type: isQuestion ? "question" : "fact" };
      setHistory((prev) => [...prev, newEntry]);
      await addOrUpdateDiscussion(currentInput, isQuestion ? "ask" : "tell");

      setInput("");
      fetchDiscussions();

      if (isQuestion) {
        const aiResponse = responses
          .filter((response) => response.responseType === "gpt response")
          .map((response) => response.text)
          .join(", ") || "";

        setHistory((prev) =>
          prev.map((item) =>
            item.text === currentInput && item.type === "question"
              ? { ...item, aiResponse }
              : item
          )
        );
      }
    } catch (error: any) {
      console.error("Error in handleSubmit:", error);
    }
  };

  // ✅ Toggle menu visibility
  const toggleMenu = (): void => {
    setMenuVisible(!menuVisible);
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#f5f5f5",
        padding: 20,
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
      }}
    >
      {/* ✅ Fetch API Key Before Rendering */}
      <IndexScreen onApiKeyLoaded={setApiKey} />

      <Header />
      <InputField input={input} onChange={handleInputChange} />
      <ActionButtons isQuestion={isQuestion} onSubmit={handleSubmit} />
      <HistoryList history={history} />
      <SettingsButton />

      {/* ✅ Hamburger Menu (Far Left, Above Fake Ad) */}
      <View style={styles.topContainer}>
        <Pressable onPress={toggleMenu} style={styles.hamburger}>
          <Icon name="menu" size={24} color="#333" />
        </Pressable>
      </View>

    

      {/* ✅ Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={toggleMenu}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.menu}>
            <Text style={styles.menuItem}>
              Logged in as: {userEmail || "Loading..."}
            </Text>
            <Text style={styles.menuItem}>
              Stored API Key:{" "}
              {apiKey
                ? `${apiKey.trim().slice(0, 4)}...${apiKey.trim().slice(-4)}`
                : "No API key found"}
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

// Add styles for the menu and fake ad
const styles = StyleSheet.create({
  topContainer: {
    width: "100%",
    alignItems: "flex-start", // Align hamburger to the far left
    marginBottom: 10,
  },
  hamburger: {
    padding: 10,
  },
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
  menuItem: {
    fontSize: 16,
    marginBottom: 10,
    color: "#333",
  },
  menuButton: {
    paddingVertical: 10,
    backgroundColor: "#007AFF",
    borderRadius: 5,
    alignItems: "center",
    marginTop: 10,
  },
  menuButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  fakeAd: {
    width: "100%",
    padding: 10,
    backgroundColor: "#ffeb3b",
    borderRadius: 5,
    alignItems: "center",
    marginBottom: 10,
  },
  fakeAdText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
});