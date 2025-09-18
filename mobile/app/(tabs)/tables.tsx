import MainComponent from '../../src/components/Tables';
import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';

const TablesScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <MainComponent />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});

export default TablesScreen;