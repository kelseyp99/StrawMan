import MainComponent from '../../src/components/Tables';
import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const TablesScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}>
        {/* <Text style={styles.title}>Tables Screen</Text> */}
        <GestureHandlerRootView style={{ flex: 1 }}>
          <MainComponent />
        </GestureHandlerRootView>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scroll: {
    flex: 1,  // Ensure scroll view fills the screen
  },
  scrollContent: {
    padding: 5,  // Add padding inside the scrollable content
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});

export default TablesScreen;
