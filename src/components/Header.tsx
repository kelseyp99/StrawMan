import React from "react";
import { View, Text, Image } from "react-native";

export default function Header() {
  return (
    <View style={{ alignItems: "center", marginBottom: 20 }}>
      <Image source={require("/assets/images/ask-janet-icon.png")} style={{ width: 100, height: 100, marginBottom: 10 }} />
      <Text style={{ fontSize: 24, fontWeight: "bold", textAlign: "center" }}>Ask Janet</Text>
    </View>
  );
}
