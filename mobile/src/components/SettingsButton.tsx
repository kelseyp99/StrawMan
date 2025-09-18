import React from "react";
import { View, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function SettingsButton() {
  const router = useRouter();

  return (
    <View style={{ position: "absolute", bottom: 20, right: 20 }}>
      <TouchableOpacity onPress={() => router.push("/settings")}>
        <MaterialIcons name="settings" size={30} color="black" />
      </TouchableOpacity>
    </View>
  );
}
