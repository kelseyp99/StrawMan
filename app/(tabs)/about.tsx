import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";

export default function About() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>About StrawMan</Text>
      <Text style={styles.body}>
        StrawMan is a simple, informal voting app designed for open participation. Users can log in and vote as many times as they want, with each vote securely logged in Firebase and assigned a unique log number. Your personal voting history is always available, so you can see every vote you've cast—including multiple votes on the same topic.
        {"\n\n"}
        StrawMan is built for transparency and privacy. Third parties can view aggregate voting results and demographic breakdowns, but never see individual names or personal information. This means you can vote freely, and your demographic data helps inform the community without compromising your privacy.
        {"\n\n"}
        The goal: make voting open, accessible, and useful for everyone—while keeping your identity safe. Enjoy StrawMan and help shape the conversation!
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 18,
    color: '#AA2222',
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    textAlign: 'left',
  },
});
