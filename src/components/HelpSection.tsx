import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';

const HelpSection: React.FC = () => {
  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.header}>About LifeLog</Text>
        <Text style={styles.paragraph}>
          LifeLog is a comprehensive journaling application designed to help users capture and reflect upon their daily experiences. By recording various aspects of life, from meals and outfits to fitness activities and personal thoughts, LifeLog enables users to create a detailed digital autobiography. This practice, known as lifelogging, not only preserves memories but also offers insights into personal habits and behaviors, promoting self-improvement and well-being.
        </Text>
        <Text style={styles.subheader}>Key Features</Text>
        <View style={styles.list}>
          <Text style={styles.listItem}>• Guided Journals: Structured templates to record diverse personal events, ensuring comprehensive tracking of daily activities.</Text>
          <Text style={styles.listItem}>• Data Visualization: Monthly and yearly statistics allow users to analyze time distribution, activity frequency, and other patterns in their lives.</Text>
          <Text style={styles.listItem}>• Privacy and Security: Focused on user privacy, LifeLog ensures that all entries are securely stored, giving users peace of mind regarding their personal data.</Text>
        </View>
        <Text style={styles.subheader}>Benefits</Text>
        <View style={styles.list}>
          <Text style={styles.listItem}>• Self-Reflection: Gain deeper insights into behaviors and emotions by maintaining a detailed record of daily activities and thoughts.</Text>
          <Text style={styles.listItem}>• Health Tracking: Monitor aspects like meals and fitness activities to identify health patterns and make informed lifestyle changes.</Text>
          <Text style={styles.listItem}>• Memory Preservation: Serve as a digital archive, allowing users to relive and cherish past moments.</Text>
        </View>
        <Text style={styles.subheader}>Help</Text>
        <Text style={styles.paragraph}>
          For assistance with LifeLog, please refer to the following resources:
        </Text>
        <View style={styles.list}>
          <Text style={styles.listItem}>• User Guide: Access the comprehensive user guide within the app's settings to learn how to navigate features and maximize the app's potential.</Text>
          <Text style={styles.listItem}>• Customer Support: If you encounter any issues or have questions, contact our support team through the app or visit our website for further assistance.</Text>
        </View>
        <Text style={styles.subheader}>How AI Utilizes User History to Answer Questions</Text>
        <Text style={styles.paragraph}>
          Artificial Intelligence (AI) in applications like LifeLog leverages user history to provide personalized and accurate responses. By analyzing patterns in the data you've logged—such as frequent activities, locations, or recurring themes—AI can offer insights tailored to your lifestyle. For instance, if you consistently log morning runs, the AI might suggest optimal times or routes based on your history. This personalized approach enhances the user experience by making interactions more relevant and contextually appropriate.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    padding: 16,
    backgroundColor: '#FFFFFF', // White background
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000', // Black text
  },
  subheader: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 4,
    color: '#000000', // Black text
  },
  paragraph: {
    fontSize: 16,
    marginBottom: 8,
    color: '#000000', // Black text
  },
  list: {
    marginLeft: 16,
    marginBottom: 8,
  },
  listItem: {
    fontSize: 16,
    marginBottom: 4,
    color: '#000000', // Black text
  },
});

export default HelpSection;
