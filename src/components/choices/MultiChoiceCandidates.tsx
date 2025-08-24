import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export interface CandidateOption { id: string; label: string }

const DEFAULT_OPTIONS: CandidateOption[] = [
  { id: 'byron', label: 'Byron Donalds' },
  { id: 'ham', label: 'Ham San Witch' },
];

interface MultiChoiceCandidatesProps {
  options?: CandidateOption[];
  onChange?(selectedIds: string[]): void;
}

export const MultiChoiceCandidates: React.FC<MultiChoiceCandidatesProps> = ({ options = DEFAULT_OPTIONS, onChange }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      onChange?.([...next]);
      return next;
    });
  }, [onChange]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select candidates:</Text>
      <View style={styles.list}>
        {options.map(o => {
          const checked = selected.has(o.id);
          return (
            <Pressable
              key={o.id}
              onPress={() => toggle(o.id)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={o.label}
            >
              <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                {checked && <Text style={styles.mark}>✓</Text>}
              </View>
              <Text style={styles.label}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>Selected:</Text>
        {selected.size === 0 ? (
          <Text style={styles.none}>None</Text>
        ) : (
          [...selected].map(id => {
            const opt = options.find(o => o.id === id);
            return <Text key={id} style={styles.selectedItem}>{opt?.label || id}</Text>;
          })
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginVertical: 12, padding: 16, backgroundColor: '#fff', borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  list: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  pressed: { opacity: 0.6 },
  checkbox: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: '#aa2222', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  checkboxChecked: { backgroundColor: '#aa2222' },
  mark: { color: '#fff', fontWeight: 'bold' },
  label: { fontSize: 16 },
  summary: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 },
  summaryTitle: { fontWeight: '600', marginBottom: 4 },
  none: { fontStyle: 'italic', color: '#777' },
  selectedItem: { fontSize: 14, color: '#222' },
});

export default MultiChoiceCandidates;
