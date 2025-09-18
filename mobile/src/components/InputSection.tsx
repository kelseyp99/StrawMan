// components/InputSection.tsx
import React from 'react';
import { View, TextInput, Button, StyleSheet } from 'react-native';

interface InputSectionProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
}

const InputSection: React.FC<InputSectionProps> = ({ value, onChangeText, onSubmit }) => {
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Enter text here..."
        value={value}
        onChangeText={onChangeText}
      />
      <Button title="Submit" onPress={onSubmit} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
});

export default InputSection;
