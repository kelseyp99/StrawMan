// explore.tsx

import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CandidatesReport from '../../src/components/CandidatesReport';

const Reports: React.FC = () => {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <CandidatesReport />
      </View>
    </SafeAreaView>
  );
};

export default Reports;
