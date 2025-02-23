import React from "react";
import { TextInput, View, Alert, StyleSheet } from "react-native";
import { Button } from "react-native-paper";


interface InputFieldProps {
  input: string;
  onChange: (text: string) => void;
}

export default function InputField({ input, onChange }: InputFieldProps) {
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Type a fact or ask a question..."
        value={input}
        onChangeText={onChange}
      />

      {/* Icons tightly grouped on the far right */}
      <Button
        icon="paperclip"
        mode="text"
        compact
        onPress={() => Alert.alert("Add Attachment", "Attachment functionality to be implemented...")}
        style={styles.icon} children={undefined}      />
      <Button
        icon="microphone"
        mode="text"
        compact
        onPress={() => Alert.alert("Voice Input", "Processing voice input...")}
        style={styles.icon} children={undefined}      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    width: "100%", // Full width to allow better spacing
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: "white",
    marginBottom: 10,
    paddingHorizontal: 10,
    justifyContent: "space-between", // Push input left, icons right
  },
  input: {
    flex: 1, // Expands fully to push icons right
    height: "100%",
  },
  icon: {
    marginLeft: -10, // Moves icons even closer together
    padding: 0, // Ensures icons don't take up extra space
    minWidth: 0, // Removes any extra spacing constraints
  },
});
