import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { saveCandidateResult, getCandidateResult } from '../../services/dbServices';

export interface CandidateOption { id: string; label: string }

const DEFAULT_OPTIONS: CandidateOption[] = [
  { id: 'byron', label: 'Byron Donalds' },
  { id: 'ham', label: 'Ham San Witch' },
];

interface MultiChoiceCandidatesProps {
  options?: CandidateOption[];
  onChange?(selectedId: string | null): void;
}

export const MultiChoiceCandidates: React.FC<MultiChoiceCandidatesProps> = ({ options = DEFAULT_OPTIONS, onChange }) => {
  const [selected, setSelected] = useState<string | null>(null);

  // Hydrate from Realm on mount
  useEffect(() => {
    (async () => {
      try {
        const existing = await getCandidateResult();
        if (existing?.selectedId) {
          setSelected(existing.selectedId);
        }
      } catch {}
    })();
  }, []);

  const choose = useCallback((id: string) => {
    setSelected(prev => {
      const next = prev === id ? null : id; // tap again clears selection
      onChange?.(next);
      // Fire and forget persistence
      saveCandidateResult(next).catch(() => {});
      return next;
    });
  }, [onChange]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pick one candidate:</Text>
      <View style={styles.list}>
        {options.map(o => {
          const checked = selected === o.id;
          return (
            <Pressable
              key={o.id}
              onPress={() => choose(o.id)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              accessibilityRole="radio"
              accessibilityState={{ selected: checked }}
              accessibilityLabel={o.label}
            >
              <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                {checked && <Text style={styles.mark}>●</Text>}
              </View>
              <Text style={styles.label}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>Selected:</Text>
        {selected ? (
          <Text style={styles.selectedItem}>{options.find(o => o.id === selected)?.label || selected}</Text>
        ) : <Text style={styles.none}>None</Text>}
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
  checkbox: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#aa2222', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  checkboxChecked: { backgroundColor: '#aa2222' },
  mark: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  label: { fontSize: 16 },
  summary: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 },
  summaryTitle: { fontWeight: '600', marginBottom: 4 },
  none: { fontStyle: 'italic', color: '#777' },
  selectedItem: { fontSize: 14, color: '#222' },
});

export default MultiChoiceCandidates;
