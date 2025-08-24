import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

const OPTIONS = [
  { id: 'byron', label: 'Byron Donalds' },
  { id: 'ham', label: 'Ham San Witch' },
];

function Checkbox({ checked }) {
  return (
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked && <Text style={styles.checkboxMark}>✓</Text>}
    </View>
  );
}

export default function App() {
  const [selected, setSelected] = useState(new Set());

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>StrawMan Minimal Test</Text>
      <Text style={styles.subtitle}>Select any candidates below:</Text>
      <View style={styles.list}>
        {OPTIONS.map(o => {
          const isChecked = selected.has(o.id);
          return (
            <Pressable
              key={o.id}
              style={styles.optionRow}
              onPress={() => toggle(o.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isChecked }}
              accessibilityLabel={o.label}
            >
              <Checkbox checked={isChecked} />
              <Text style={styles.optionLabel}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.selectionBox}>
        <Text style={styles.selectionTitle}>Selected:</Text>
        {selected.size === 0 ? (
          <Text style={styles.noneText}>None</Text>
        ) : (
          [...selected].map(id => {
            const label = OPTIONS.find(o => o.id === id)?.label || id;
            return <Text key={id} style={styles.selectedItem}>• {label}</Text>;
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 80, paddingHorizontal: 24, backgroundColor: '#fff' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: 20, color: '#555' },
  list: { gap: 12 },
  optionRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 28, height: 28, borderRadius: 6, borderWidth: 2, borderColor: '#aa2222', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  checkboxChecked: { backgroundColor: '#aa2222' },
  checkboxMark: { color: '#fff', fontWeight: 'bold' },
  optionLabel: { fontSize: 16 },
  selectionBox: { marginTop: 30, padding: 16, borderWidth: 1, borderColor: '#ddd', borderRadius: 8 },
  selectionTitle: { fontWeight: '600', marginBottom: 6 },
  noneText: { fontStyle: 'italic', color: '#888' },
  selectedItem: { fontSize: 14, color: '#222' },
});
