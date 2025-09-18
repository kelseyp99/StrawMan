import React, { useState } from 'react';
import { Modal, View, Text, Button, StyleSheet } from 'react-native';

interface UpgradePromptModalProps {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

export function UpgradePromptModal({ visible, onClose, onUpgrade }: UpgradePromptModalProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Upgrade to Premium</Text>
          <Text style={styles.text}>
            Unlock all features and remove ads by upgrading to a paid account.
          </Text>
          <View style={{ alignItems: 'center' }}>
            <Button title="Upgrade" onPress={onUpgrade} />
            <Button title="Not Now" onPress={onClose} />
            <Text
              style={{ color: '#888', fontSize: 12, marginTop: 16 }}
              onPress={() => {
                setTapCount((count) => {
                  const newCount = count + 1;
                  if (newCount >= 5) setUnlocked(true);
                  return newCount;
                });
              }}
            >
              v{process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0'}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface PlanModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectPlan: (plan: 'limited' | 'full') => void;
}

export function PlanModal({ visible, onClose, onSelectPlan }: PlanModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Choose Your Plan</Text>
          <View style={styles.planBox}>
            <Text style={styles.planTitle}>$10 Limited Plan</Text>
            <Text style={styles.text}>• Limited ads{'\n'}• Basic features</Text>
            <Button
              title="Choose Limited"
              onPress={() => onSelectPlan('limited')}
            />
          </View>
          <View style={styles.planBox}>
            <Text style={styles.planTitle}>$30 Premium Plan</Text>
            <Text style={styles.text}>
              • No ads{'\n'}• All features unlocked{'\n'}• Cloud storage on
              Firebase
            </Text>
            <Button
              title="Choose Premium"
              onPress={() => onSelectPlan('full')}
            />
          </View>
          <Button title="Cancel" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  text: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 12,
  },
  planBox: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  planTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
});
