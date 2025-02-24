console.log("Environment Variables:", process.env);

import React, { useState, useEffect } from "react";
import { Text, View, ActivityIndicator } from "react-native";
import { getAIResponse, getModelAPIkey, getParsedGPTResponses } from "../../services/databaseService"; // Adjust path
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
} from "@/services/databaseService";
import Header from "@/components/Header";
import InputField from "@/components/InputField";
import ActionButtons from "@/components/ActionButtons";
import HistoryList from "@/components/HistoryList";
import SettingsButton from "@/components/SettingsButton";
import { analyzeActivity, ModelAPIkey } from "@/services/openaiAPI";

// ✅ Fetch API Key in a separate component before rendering AskJanet
const IndexScreen = ({ onApiKeyLoaded }: { onApiKeyLoaded: (cachedApiKey: string | null) => void }) => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKey = async () => {
      const key = await getModelAPIkey("LifeLog","OpenAI", "gpt-3.5-turbo");
      const { aiModel, apiKey, endPointURL } = key as ModelAPIkey; // Cache the key
      onApiKeyLoaded(apiKey); // Pass API key to parent
      setLoading(false);
    };

    fetchKey();
  }, []);

  if (loading) {
    return <ActivityIndicator size="large" color="#0000ff" />;
  }

  return null; // No need to render anything, API key is passed up
};

export default function AskJanet() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isQuestion, setIsQuestion] = useState(false);
  const [inDJ_Mode, setInDJ_Mode] = useState(false);
  const [history, setHistory] = useState<{ text: string; type: string }[]>([]);
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
  // ✅ Fetch API key when the component mounts
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

  
  // ✅ Handle input change
  const handleInputChange = (text: string) => {
    setInput(text);
    setIsQuestion(/\b(what|when|how|why|does|is|can)\b/i.test(text));
    setInDJ_Mode(/\b(DJ mode|dj mode|Dj mode|DJ|dj)\b/i.test(text));
  };

  // ✅ Process uncleared discussions
  async function fetchDiscussions() {
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

        // ✅ If it's a question
        if (discussionTyped.typeSay === "ask") {
          // ✅ Add question to discussion table and parse into parts with best GPT to answer and categories
          const gptResponseId = await addQuestionDiscussion(input, discussionTyped.id);
          //get answers to questions  
          const parsedResponses = await disperseQuestion(discussionTyped.id, gptResponseId);
          if (await !clearDiscussion(discussionTyped.id)) {
            break;
          }
          //const responses = await getGPTResponses(discussionTyped.id);
          //const parsedResponses = await getParsedGPTResponses(discussionTyped.id);
          //setHistory(parsedResponses.map(response => ({ text: response, type: "gpt response" })));
          if (parsedResponses) {
          //  setHistory(parsedResponses.map(response => ({ text: response.toString(), type: "gpt response" })));
            setHistory((prev) => [...prev, ...parsedResponses.map(response => ({ text: response.toString(), type: "answer" }))]);
          }
          setInputValue(responses.join(", ") || "");
          setResponses(responses);
        } else {
          // ✅ If it's a fact (not a question)
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
  const handleSubmit = async () => {
    try {
      const currentInput = input.trim();
      if (currentInput === "") return;
  
      // ✅ Create history entry
      const newEntry = { text: currentInput, type: isQuestion ? "question" : "fact" };
  
      // ✅ Add user input to history & discussion
      setHistory((prev) => [...prev, newEntry]);
      // ✅ Add user input to discussion table, no ai calls to this point
      await addOrUpdateDiscussion(currentInput, isQuestion ? "ask" : "tell");
  
      setInput("");
  
      // ✅ process all new facts and question with ai call and save
      fetchDiscussions();
      // ✅ If the input is a question, get AI response
      if (isQuestion) {
        const aiResponse = responses
          .filter(response => response.responseType === "gpt response") // ✅ Filter only AI responses
          .map(response => response.text) // ✅ Extract the text
          .join(", ") || "";

  
        // ✅ Update the existing question entry instead of adding a duplicate
        setHistory((prev) =>
          prev.map((item) =>
            item.text === currentInput && item.type === "question"
              ? { ...item, aiResponse }
              : item
          )
        );
      }
  
    } catch (error) {
      console.error("Error in handleSubmit:", error);
    }
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

      {/* ✅ Display API Key */}
      <Text>
      Stored API Key:{" "}
      {apiKey ? `${apiKey.trim().slice(0, 4)}...${apiKey.trim().slice(-4)}` : "No API key found"}
      </Text>      
    </View>
  );
}
