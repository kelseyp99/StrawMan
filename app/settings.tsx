import React, { useState } from "react";
import { View, Text, Switch } from "react-native";

export default function SettingsScreen() {
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [aiPersonalization, setAiPersonalization] = useState(true);

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: "#fff" }}>
      <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 20 }}>Settings</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
        <Text>Enable Voice Input</Text>
        <Switch value={voiceEnabled} onValueChange={setVoiceEnabled} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
        <Text>Dark Mode</Text>
        <Switch value={darkMode} onValueChange={setDarkMode} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
        <Text>AI Personalization</Text>
        <Switch value={aiPersonalization} onValueChange={setAiPersonalization} />
      </View>
    </View>
  );
}
