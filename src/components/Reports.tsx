import React from 'react';
import { View, Text } from 'react-native';

export default function Reports() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Reports</Text>
      <Text style={{ fontSize: 16, marginTop: 8 }}>
        This is the Reports section. Add your report logic here.
      </Text>
    </View>
  );
}
