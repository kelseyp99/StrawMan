import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { auth } from '../src/firebaseConfig';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithCredential,
  linkWithCredential,
} from 'firebase/auth';
import { useRouter } from 'expo-router';
import { useAuth } from './context/AuthContext';
import Icon from 'react-native-vector-icons/Ionicons'; // Changed to Ionicons
import Header from '../src/components/Header';
import * as FileSystem from 'expo-file-system';
import { setUID, clearUID } from '../src/utils/uidManager';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { logFirebaseDiagnostics } from '../src/utils/firebaseDiagnostics';
import Constants from 'expo-constants';
import { initializeUser } from '../src/services/dbServices';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_FILE = `${FileSystem.documentDirectory}userUID.txt`;

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userUID, setUserUID] = useState<string | null>(null);
  const router = useRouter();
  const { setIsLogged, setIsPaid } = useAuth();

  // Log Constants.expoConfig for debugging
  console.log('Expo Config:', JSON.stringify(Constants.expoConfig, null, 2));

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: Platform.OS === 'ios'
      ? (Constants.expoConfig?.extra as any)?.googleClientIdIos
      : (Constants.expoConfig?.extra as any)?.googleClientIdAndroid,
    scopes: ['profile', 'email'],
  });

  useEffect(() => {
    const loadUID = async () => {
      logFirebaseDiagnostics();
      try {
        const fileInfo = await FileSystem.getInfoAsync(STORAGE_FILE);
        if (fileInfo.exists) {
          const fileContent = await FileSystem.readAsStringAsync(STORAGE_FILE);
          setUserUID(fileContent);
          console.log('Loaded UID from file:', fileContent);
        } else {
          console.log('No UID file found');
        }
      } catch (error) {
        console.error('Error loading UID or checking file:', error);
      }
    };
    loadUID();

    if (!auth) {
      console.warn('[Auth] Firebase auth not initialized');
      return () => {};
    }
    const unsubscribe = onAuthStateChanged(auth as any, async (user) => {
      console.log('[AAB DEBUG] onAuthStateChanged fired. user:', user);
      try {
        if (user) {
          console.log('[AAB DEBUG] User logged in:', user.uid, '| email:', user.email);
          setUserEmail(user.email);
          setUserUID(user.uid);
          await setUID(user.uid);
          // Check AsyncStorage after setUID
          const storedUID = await AsyncStorage.getItem('userUID');
          console.log('[AAB DEBUG] UID written to AsyncStorage:', storedUID);
          // Persist user data to AsyncStorage for next session
          await AsyncStorage.multiSet([
            ['userEmail', user.email || ''],
            ['userUID', user.uid],
            ['isPaidUser', 'true'],
          ]);
          const [isLoggedVal, isPaidVal] = await Promise.all([
            AsyncStorage.getItem('isLogged'),
            AsyncStorage.getItem('isPaidUser'),
          ]);
          console.log('[AAB DEBUG] isLogged in AsyncStorage:', isLoggedVal, '| isPaidUser:', isPaidVal);
          // Update AuthContext state
          setIsLogged(true);
          setIsPaid(true);
          console.log('[AAB DEBUG] AuthContext setIsLogged(true), setIsPaid(true)');
          // Initialize user data
          initializeUser().catch((error) =>
            console.error('[AAB DEBUG] Error initializing user:', error)
          );
        } else {
          console.log('[AAB DEBUG] No user authenticated');
          setUserEmail(null);
          setUserUID(null);
          clearUID();
          removeUID();
          // Clear persisted user data
          await AsyncStorage.multiRemove([
            'userEmail',
            'userUID',
            'isPaidUser',
            'syncWithCloud',
            'userPlan'
          ]);
          const [isLoggedVal, isPaidVal] = await Promise.all([
            AsyncStorage.getItem('isLogged'),
            AsyncStorage.getItem('isPaidUser'),
          ]);
          console.log('[AAB DEBUG] After logout, isLogged:', isLoggedVal, '| isPaidUser:', isPaidVal);
          setIsLogged(false);
        }
      } catch (err) {
        console.error('[AAB DEBUG] Error in onAuthStateChanged:', err);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);

      // Check if a user is currently signed in
  const currentUser = auth?.currentUser;

      if (currentUser) {
        // Link Google provider to the current user (e.g., email/password account)
  linkWithCredential(currentUser as any, credential)
          .then(async (userCredential) => {
            console.log(
              'Google provider linked to UID:',
              userCredential.user.uid
            );
            setUserUID(userCredential.user.uid);
            setUID(userCredential.user.uid);
            // Don't set isLogged here - let onAuthStateChanged handle it
            await initializeUser();
            // Don't manually redirect - let onAuthStateChanged handle it
          })
          .catch((err) => {
            if (err.code === 'auth/credential-already-in-use') {
              // Google account is already linked to another user; sign in instead
              signInWithCredential(auth as any, credential)
                .then(async (userCredential) => {
                  console.log(
                    'Signed in with Google UID:',
                    userCredential.user.uid
                  );
                  setUserUID(userCredential.user.uid);
                  setUID(userCredential.user.uid);
                  // Don't set isLogged here - let onAuthStateChanged handle it
                  await initializeUser();
                  // Don't manually redirect - let onAuthStateChanged handle it
                })
                .catch((signInErr) => {
                  setError(signInErr.message);
                  console.error('Google Sign-In Error:', signInErr.message);
                });
            } else {
              setError(err.message);
              console.error('Google Linking Error:', err.message);
            }
          });
      } else {
        // No current user; sign in with Google
  signInWithCredential(auth as any, credential)
          .then(async (userCredential) => {
            console.log('Google Sign-In UID:', userCredential.user.uid);
            setUserUID(userCredential.user.uid);
            setUID(userCredential.user.uid);
            // Don't set isLogged here - let onAuthStateChanged handle it
            await initializeUser();
            // Don't manually redirect - let onAuthStateChanged handle it
          })
          .catch((err) => {
            setError(err.message);
            console.error('Google Sign-In Error:', err.message);
          });
      }
    } else if (response?.type === 'error') {
      setError('Google Sign-In failed');
      console.error('Google Sign-In Error:', response.error);
    }
  }, [response]);

  const removeUID = async () => {
    try {
      await FileSystem.deleteAsync(STORAGE_FILE, { idempotent: true });
      console.log('UID removed from file');
    } catch (error) {
      console.error('Error removing UID:', error);
    }
  };

  const handleSignIn = async () => {
    try {
      if (!auth) return;
      const userCredential = await signInWithEmailAndPassword(
        auth as any,
        email,
        password
      );
      console.log('Signed in UID:', userCredential.user.uid);
      setUserUID(userCredential.user.uid);
      setUID(userCredential.user.uid);
      // Don't set isLogged or redirect here - let onAuthStateChanged handle it
      await initializeUser();
    } catch (err: any) {
      setError(err.message);
      console.error('Sign-in Error:', err.message);
    }
  };

  const handleSignUp = async () => {
    try {
      if (!auth) return;
      const userCredential = await createUserWithEmailAndPassword(
        auth as any,
        email,
        password
      );
      console.log('Signed up UID:', userCredential.user.uid);
      setUserUID(userCredential.user.uid);
      setUID(userCredential.user.uid);
      // Don't set isLogged or redirect here - let onAuthStateChanged handle it
      await initializeUser();
    } catch (err: any) {
      setError(err.message);
      console.error('Sign-up Error:', err.message);
    }
  };

  const handleSignOut = async () => {
    try {
  if (!auth) return;
  await signOut(auth as any);
      console.log('User signed out');
      setEmail('');
      setPassword('');
      setUserEmail(null);
      setUserUID(null);
      clearUID();
      await removeUID();
      await setIsLogged(false);
    } catch (err: any) {
      setError(err.message);
      console.error('Sign-out Error:', err.message);
    }
  };

  const handleProceedToApp = async () => {
    try {
      console.log('Proceeding to main app...');
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error navigating to app:', error);
      setError('Failed to navigate to app. Please try again.');
    }
  };

  const handleGoogleLogin = async () => {
    if (request) {
      promptAsync();
    } else {
      setError('Google Sign-In not ready');
      console.error('Google Sign-In request not initialized');
    }
  };

  const handleAppleLogin = () => {
    console.log('Apple login pressed (dummy)');
  };

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <View style={styles.container}>
      <Header />
      <Text style={styles.title}>LifeLog - Personal Tracker</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity
          onPress={toggleShowPassword}
          style={styles.iconContainer}
        >
          <Icon
            name={showPassword ? 'eye-off' : 'eye'}
            size={24}
            color="#666"
          />
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.button} onPress={handleSignIn}>
        <Text style={styles.buttonText}>Sign In With Email</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.signUpLink} onPress={handleSignUp}>
        <Text style={styles.signUpText}>Create an account</Text>
      </TouchableOpacity>
      <View
        style={{
          height: 1,
          width: '100%',
          backgroundColor: '#ccc',
          marginVertical: 10,
        }}
      />
      <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin}>
        <Icon
          name="logo-google"
          size={20}
          color="#fff"
          style={styles.socialIcon}
        />
        <Text style={styles.buttonText}>Continue with Google</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.appleButton} onPress={handleAppleLogin}>
        <Icon
          name="logo-apple"
          size={20}
          color="#fff"
          style={styles.socialIcon}
        />
        <Text style={styles.buttonText}>Continue with Apple</Text>
      </TouchableOpacity>
      {userEmail && (
        <View style={styles.userSection}>
          <Text style={styles.loggedInText}>Logged in as: {userEmail}</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleProceedToApp}
            >
              <Text style={styles.buttonText}>Continue to App</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleSignOut}
            >
              <Icon name="log-out" size={16} color="#333" />
              <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {userUID && (
        <Text style={styles.loggedInText}>Persisted User UID: {userUID}</Text>
      )}
      {!userEmail && userUID && (
        <Text style={styles.loggedInText}>
          Persisted from previous session: {userUID}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
  },
  input: {
    width: '100%',
    padding: 12,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 10,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  iconContainer: {
    padding: 10,
    position: 'absolute',
    right: 0,
  },
  button: {
    width: '100%',
    padding: 15,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signUpLink: {
    marginVertical: 10,
  },
  signUpText: {
    color: '#007AFF',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  googleButton: {
    flexDirection: 'row',
    width: '100%',
    padding: 15,
    backgroundColor: '#666', // Changed to grey
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 5,
  },
  appleButton: {
    flexDirection: 'row',
    width: '100%',
    padding: 15,
    backgroundColor: '#000',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 5,
  },
  socialIcon: {
    marginRight: 10,
  },
  logoutContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  loggedInText: {
    fontSize: 14,
    color: '#333',
    marginRight: 10,
  },
  logoutIcon: {
    padding: 5,
  },
  userSection: {
    width: '100%',
    marginVertical: 20,
    padding: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 10,
  },
  continueButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    flex: 1,
    alignItems: 'center',
  },
  logoutButton: {
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  logoutText: {
    color: '#333',
    fontSize: 14,
    marginLeft: 5,
  },
  error: {
    color: 'red',
    marginBottom: 10,
  },
});
