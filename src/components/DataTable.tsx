// app/(tabs)/explore.tsx
import React from 'react';
import { View, StyleSheet, FlatList, Text } from 'react-native';
//import DataTable from '../../components/DataTable';

const data = [
  { id: '1', activity: 'Running', duration: '30 mins', calories: '250' },
  { id: '2', activity: 'Cycling', duration: '1 hour', calories: '500' },
  { id: '3', activity: 'Yoga', duration: '45 mins', calories: '200' },
];

const ExploreScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Activity Log</Text>
   {/*    <DataTable data={data} /> */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f0f4f8',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
});

export default ExploreScreen;

