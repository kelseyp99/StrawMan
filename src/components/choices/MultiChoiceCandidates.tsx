import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { saveCandidateResult, getCandidateResult, appendCandidateResultHistory, getCandidateResultHistory, clearCandidateResultHistory, pruneCandidateResultHistory } from '../../services/dbServices';

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
  const [history, setHistory] = useState<{ id: string; selectedId?: string | null; timestamp: Date }[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const HISTORY_LIMIT = 25;

  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
  const rows = await getCandidateResultHistory(HISTORY_LIMIT);
      setHistory(rows);
    } catch { /* ignore */ } finally { setLoadingHistory(false); }
  }, []);

  // Hydrate from Realm on mount
  useEffect(() => {
    (async () => {
      try {
        const existing = await getCandidateResult();
        if (existing?.selectedId) {
          setSelected(existing.selectedId);
        }
    await loadHistory();
      } catch {}
    })();
  }, [loadHistory]);

  const choose = useCallback((id: string) => {
    setSelected(prev => {
      const next = prev === id ? null : id; // tap again clears selection
      onChange?.(next);
      // Fire and forget persistence
  // Persist current state
  saveCandidateResult(next).catch(() => {});
  // Append to history (fire & forget)
      appendCandidateResultHistory(next)
        .then(() => loadHistory())
        .catch(() => {});
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
      <View style={styles.historyBox}>
        <View style={styles.historyHeaderRow}>
          <Text style={styles.historyTitle}>History (latest {history.length})</Text>
          <View style={styles.historyBtnRow}>
            <Pressable onPress={loadHistory} style={styles.refreshBtn} accessibilityRole="button" accessibilityLabel="Refresh history">
              <Text style={styles.refreshText}>{loadingHistory ? '…' : '↻'}</Text>
            </Pressable>
            <Pressable onPress={async () => { await clearCandidateResultHistory(); await loadHistory(); }} style={styles.clearBtn} accessibilityRole="button" accessibilityLabel="Clear history">
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
            <Pressable onPress={async () => { await pruneCandidateResultHistory(10); await loadHistory(); }} style={styles.pruneBtn} accessibilityRole="button" accessibilityLabel="Prune history to last 10 entries">
              <Text style={styles.pruneText}>Prune→10</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.retentionNote}>Auto-keeps newest 100. Prune trims to 10. Showing {history.length}.</Text>
        {history.length === 0 && !loadingHistory && (
          <Text style={styles.historyEmpty}>No history yet</Text>
        )}
        {history.map(h => {
          const label = h.selectedId ? (options.find(o => o.id === h.selectedId)?.label || h.selectedId) : 'Cleared';
          const ts = new Date(h.timestamp);
          const now = new Date();
          const sameDay = ts.toDateString() === now.toDateString();
          const timeStr = sameDay
            ? ts.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : ts.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + ts.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
          return (
            <View key={h.id} style={styles.historyRow}>
              <Text style={styles.historyRowText}>{timeStr} — {label}</Text>
            </View>
          );
        })}
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
  historyBox: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8 },
  historyHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  historyTitle: { fontWeight: '600', fontSize: 14, color: '#333' },
  refreshBtn: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: '#f2f2f2' },
  refreshText: { fontSize: 14, color: '#444' },
  historyBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clearBtn: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: '#ffecec', marginLeft: 6 },
  clearText: { fontSize: 12, color: '#aa2222', fontWeight: '600' },
  pruneBtn: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: '#eef5ff' },
  pruneText: { fontSize: 12, color: '#2255aa', fontWeight: '600' },
  retentionNote: { fontSize: 10, color: '#888', marginBottom: 4 },
  historyEmpty: { fontStyle: 'italic', color: '#888', fontSize: 12 },
  historyRow: { paddingVertical: 2 },
  historyRowText: { fontSize: 12, color: '#444' },
});

export default MultiChoiceCandidates;
