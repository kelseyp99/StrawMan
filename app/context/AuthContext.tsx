import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextType {
  isLogged: boolean;
  isPaid: boolean;
  setIsLogged: (logged: boolean) => void;
  setIsPaid: (paid: boolean) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLogged, setIsLoggedState] = useState(false);
  const [isPaid, setIsPaidState] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load persisted auth state on app start
  useEffect(() => {
    async function loadAuthState() {
      try {
        const [loggedValue, paidValue] = await Promise.all([
          AsyncStorage.getItem('isLogged'),
          AsyncStorage.getItem('isPaid'),
        ]);
        
        if (loggedValue === 'true') {
          setIsLoggedState(true);
        }
        if (paidValue === 'true') {
          setIsPaidState(true);
        }
      } catch (error) {
        console.error('Error loading auth state:', error);
      } finally {
        setLoading(false);
      }
    }
    loadAuthState();
  }, []);

  const setIsLogged = async (logged: boolean) => {
    try {
      await AsyncStorage.setItem('isLogged', logged.toString());
      setIsLoggedState(logged);
    } catch (error) {
      console.error('Error saving login state:', error);
      setIsLoggedState(logged);
    }
  };

  const setIsPaid = async (paid: boolean) => {
    try {
      await AsyncStorage.setItem('isPaid', paid.toString());
      setIsPaidState(paid);
    } catch (error) {
      console.error('Error saving paid state:', error);
      setIsPaidState(paid);
    }
  };

  return (
    <AuthContext.Provider value={{ isLogged, isPaid, setIsLogged, setIsPaid, loading }}>
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
