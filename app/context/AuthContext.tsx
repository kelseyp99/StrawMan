import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AuthContextType {
  isLogged: boolean;
  isPaid: boolean;
  setIsLogged: (logged: boolean) => void;
  setIsPaid: (paid: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLogged, setIsLogged] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  return (
    <AuthContext.Provider value={{ isLogged, isPaid, setIsLogged, setIsPaid }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

export default AuthContext;
