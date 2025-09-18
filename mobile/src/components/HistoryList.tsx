import React from "react";
import { View, Text, ScrollView } from "react-native";

interface HistoryListProps {
  history: { text: string; type: string; aiResponse?: string }[];
}

export default function HistoryList({ history }: HistoryListProps) {
  return (
    <ScrollView style={{ maxHeight: 300, width: "90%" }}>
      {history.map((item, index) => (
        <View key={index} style={{ width: "100%", marginBottom: 10 }}>
          {/* User Input Box (Fact or Question) */}
          <View
            style={{
              padding: 10,
              backgroundColor: item.type === "question" 
                ? "#d1ecf1"  // Blue for questions
                : item.type === "answer"
                  ? "#fff3cd" // Yellow for answers
                  : "#d4edda", // Green for facts
              borderRadius: 10,
            }}
          >
            <Text>{item.text}</Text>
          </View>

          {/* AI Response Box (Only Appears if AI Responded) */}
          {item.aiResponse && (
            <View
              style={{
                marginTop: 5,
                padding: 10,
                backgroundColor: "#fff3cd", // Yellow for AI response
                borderRadius: 10,
              }}
            >
              <Text style={{ fontStyle: "italic" }}>🤖 {item.aiResponse}</Text>
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}
