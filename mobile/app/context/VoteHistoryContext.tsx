import React, { createContext, useContext, useState } from 'react';

export interface VoteHistoryEntry {
  candidateId: string;
  timestamp: number;
}

interface VoteHistoryContextType {
  history: VoteHistoryEntry[];
  addVote: (candidateId: string) => void;
}

const VoteHistoryContext = createContext<VoteHistoryContextType | undefined>(undefined);

export const VoteHistoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [history, setHistory] = useState<VoteHistoryEntry[]>([]);

  const addVote = (candidateId: string) => {
    setHistory(prev => [{ candidateId, timestamp: Date.now() }, ...prev]);
  };

  return (
    <VoteHistoryContext.Provider value={{ history, addVote }}>
      {children}
    </VoteHistoryContext.Provider>
  );
};

export const useVoteHistory = () => {
  const ctx = useContext(VoteHistoryContext);
  if (!ctx) throw new Error('useVoteHistory must be used within a VoteHistoryProvider');
  return ctx;
};
