import React from "react";
import { View, Text } from "react-native";

export default function Header() {
  return (
    <View style={{ alignItems: "center", marginBottom: 20 }}>
      {/* Icon removed for StrawMan differentiation */}
      <Text style={{ fontSize: 24, fontWeight: "bold", textAlign: "center" }}>Ask Janet</Text>
    </View>
  );
}
