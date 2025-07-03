import React from 'react';
import { View, TouchableOpacity, Text, Alert, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../app/context/AuthContext';

/**
 * Debug component to enable sync functionality for testing
 * Add this to your settings screen temporarily
 */
export default function DebugSyncButton() {
  const { setIsPaid } = useAuth();

  const enableSyncForTesting = async () => {
    try {
      // Set user as paid customer in AsyncStorage
      await AsyncStorage.setItem('isPaidUser', 'true');
      
      // Update AuthContext state
      setIsPaid(true);
      
      // Enable sync with cloud
      await AsyncStorage.setItem('syncWithCloud', 'true');
      
      // Verify the settings
      const isPaid = await AsyncStorage.getItem('isPaidUser');
      const syncEnabled = await AsyncStorage.getItem('syncWithCloud');
      const isLogged = await AsyncStorage.getItem('isLogged');
      
      console.log('Current settings:');
      console.log('- isLogged:', isLogged);
      console.log('- isPaidUser:', isPaid);
      console.log('- syncWithCloud:', syncEnabled);
      
      Alert.alert(
        'Sync Enabled',
        `Settings updated:\n• isPaidUser: ${isPaid}\n• syncWithCloud: ${syncEnabled}\n• isLogged: ${isLogged}\n\nYou can now use sync functionality!`
      );
      
    } catch (error) {
      console.error('Error setting sync preferences:', error);
      Alert.alert('Error', 'Failed to enable sync settings');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={enableSyncForTesting}>
        <Text style={styles.buttonText}>🔧 Enable Sync for Testing</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#f9f9f9',
  },
  button: {
    backgroundColor: '#FF6B6B',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
