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


<View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center" }}>
  {/* @ts-ignore */}
  <Button
    icon="paperclip"
    mode="text"
    onPress={() => Alert.alert("Add Attachment", "Attachment functionality to be implemented...")}
    style={[styles.iconButton, { width: "auto", paddingHorizontal: 0, minWidth: 50, marginRight: -10 }]} // Reduce spacing
    contentStyle={{ justifyContent: "center" }}
    labelStyle={{ fontSize: 24 }} // Increased font size
  />
  {/* @ts-ignore */}
  <Button
    icon="microphone"
    mode="text"
    onPress={() => Alert.alert("Voice Input", "Processing voice input...")}
    style={[styles.iconButton, { width: "auto", paddingHorizontal: 0, minWidth: 50, marginLeft: -10 }]} // Reduce spacing
    contentStyle={{ justifyContent: "center" }}
    labelStyle={{ fontSize: 24 }} // Increased font size
  />
</View>



    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    width: "100%",
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: "white",
    marginBottom: 10,
    paddingHorizontal: 0, // Was 1
  },
  input: {
    flex: 1,
    height: "100%",
    paddingRight: 0, // Was 10
  },
  iconButton: {
    marginLeft: 0, // Was 5
  },
  iconContent: {
    padding: 0,
    width: 24,
    height: 24,
  },
  iconLabel: {
    fontSize: 20,
    color: "#000",
    margin: 0,
  },
});