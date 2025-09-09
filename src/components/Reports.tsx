import React from 'react';
import { SafeAreaView, ScrollView } from 'react-native';
import CandidatesReport from './CandidatesReport';

export default function Reports() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 4 }}>
        <CandidatesReport />
      </ScrollView>
    </SafeAreaView>
  );
}
