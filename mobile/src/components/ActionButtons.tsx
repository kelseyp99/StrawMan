import React from "react";
import { View, Text, Alert, StyleSheet } from "react-native";
import { Button } from 'react-native-paper';
import { useRouter } from "expo-router";
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'; // Import the icon library

interface ActionButtonsProps {
  isQuestion: boolean;
  onSubmit: () => void;
}

export default function ActionButtons({ isQuestion, onSubmit }: ActionButtonsProps) {
  const router = useRouter();

  return (
    <View style={{ width: "90%", alignItems: "center" }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", marginBottom: 10 }}>
      {/* <Button
          icon="microphone"
          mode="text"
          compact
          onPress={() => Alert.alert("Voice Input", "Processing voice input...")} children={undefined}/> */}
      {/* <Button
          icon="table-large-plus" // Use "table-large" if preferred
          mode="contained"
          onPress={() => router.push("/tables")}
          style={{
            backgroundColor: "#6c757d",
            marginBottom: 20,
            alignItems: "center", // Center content
            justifyContent: "center", // Center content vertically
            width: 50, // Adjust width to keep it compact
            height: 50, // Ensure it’s a square button
           // borderRadius: 25, // Make it round if preferred
          }} children={undefined}/> */}

      {/* <Button
        mode="contained"
        onPress={() => Alert.alert("Add Attachment", "Attachment functionality to be implemented...")}
        style={styles.button}
      >
        <Icon name="paperclip" size={15} color="#fff" />
      </Button> */}
        <Button
          icon={isQuestion ? "help-circle" : "check-circle"} // "?" for questions, "✔️" for confirmation
          mode="contained"
          onPress={onSubmit}
          style={{
            backgroundColor: isQuestion ? "#007bff" : "#28a745", // Blue for questions, green for confirmation
            flexDirection: "row-reverse", // Moves icon to the right of the text
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {isQuestion ? "Ask Question" : "Confirm"} {/* Dynamic text */}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#6c757d",
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
});
