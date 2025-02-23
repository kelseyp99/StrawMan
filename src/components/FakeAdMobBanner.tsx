import React from "react";
import { View, Image, StyleSheet } from "react-native";

const FakeBanner = () => {
  return (
    <View style={styles.container}>
      <Image source={require("../assets/images/WholeFoods.png")} style={styles.banner} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#004225", // Matching Whole Foods theme
    paddingVertical: 2, // Further reduce vertical padding
    height: 60, // Explicitly set a height to control the banner area
  },
  banner: {
    width: "100%",
    height: 40, // Reduce height to make the banner smaller
    resizeMode: "contain",
  },
});

export default FakeBanner;
