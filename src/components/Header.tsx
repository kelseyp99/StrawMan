import React from "react";
import { View, Text } from "react-native";

export default function Header() {
  return (
    <View style={{ alignItems: "center", marginBottom: 20 }}>
      {/* Icon removed for StrawMan differentiation */}
      <Text style={{ fontSize: 26, fontWeight: "bold", textAlign: "center", color: '#AA2222' }}>StrawMan Dev</Text>
      <Text style={{ marginTop: 4, fontSize: 12, letterSpacing: 1, color: '#AA2222' }}>Experimental Build</Text>
    </View>
  );
}
