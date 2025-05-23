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
import Icon from 'react-native-vector-icons/Ionicons';
import Header from '../src/components/Header';
import * as FileSystem from 'expo-file-system';
import { setUID, clearUID } from '../src/utils/uidManager';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import { initializeUser } from '../src/services/databaseService';

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

  // Log Constants.expoConfig for debugging
  console.log('Expo Config:', JSON.stringify(Constants.expoConfig, null, 2));

  const googleClientId =
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
    (Platform.OS === 'ios'
      ? Constants.expoConfig?.extra?.googleClientIdIos
      : Constants.expoConfig?.extra?.googleClientIdAndroid) ||
    '341732508688-o2qbbr16g2qh3e8niofee9iv4tl6krhb.apps.googleusercontent.com';

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: googleClientId,
    scopes: ['profile', 'email'],
  });

  useEffect(() => {
    console.log('a', googleClientId);
    console.log(
      'LoginScreen: Source:',
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID
        ? 'EAS secret'
        : Constants.expoConfig?.extra?.googleClientIdAndroid
        ? 'app.config.js'
        : 'hard-coded fallback'
    );
    console.log(
      'LoginScreen: Firebase API Key:',
      process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'undefined'
    );

    const loadUID = async () => {
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

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('User logged in:', user.uid);
        setUserEmail(user.email);
        setUserUID(user.uid);
        setUID(user.uid);
        initializeUser().catch((error) =>
          console.error('Error initializing user:', error)
        );
        router.replace('/(tabs)');
      } else {
        setUserEmail(null);
        setUserUID(null);
        clearUID();
        removeUID();
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      console.log('LoginScreen: Google auth success, id_token:', id_token);
      const credential = GoogleAuthProvider.credential(id_token);

      // Check if a user is currently signed in
      const currentUser = auth.currentUser;

      if (currentUser) {
        // Link Google provider to the current user (e.g., email/password account)
        linkWithCredential(currentUser, credential)
          .then((userCredential) => {
            console.log(
              'Google provider linked to UID:',
              userCredential.user.uid
            );
            setUserUID(userCredential.user.uid);
            setUID(userCredential.user.uid);
            initializeUser().catch((error) =>
              console.error('Error initializing user:', error)
            );
            router.replace('/(tabs)');
          })
          .catch((err) => {
            if (err.code === 'auth/credential-already-in-use') {
              // Google account is already linked to another user; sign in instead
              signInWithCredential(auth, credential)
                .then((userCredential) => {
                  console.log(
                    'Signed in with Google UID:',
                    userCredential.user.uid
                  );
                  setUserUID(userCredential.user.uid);
                  setUID(userCredential.user.uid);
                  initializeUser().catch((error) =>
                    console.error('Error initializing user:', error)
                  );
                  router.replace('/(tabs)');
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
        signInWithCredential(auth, credential)
          .then((userCredential) => {
            console.log('Google Sign-In UID:', userCredential.user.uid);
            setUserUID(userCredential.user.uid);
            setUID(userCredential.user.uid);
            initializeUser().catch((error) =>
              console.error('Error initializing user:', error)
            );
            router.replace('/(tabs)');
          })
          .catch((err) => {
            setError(err.message);
            console.error('Google Sign-In Error:', err.message);
          });
      }
    } else if (response?.type === 'error') {
      setError('Google Sign-In failed');
      console.error('Google Sign-In Error:', response.error);
    } else if (response?.type === 'dismiss') {
      console.log('LoginScreen: Google auth dismissed');
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
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      console.log('Signed in UID:', userCredential.user.uid);
      setUserUID(userCredential.user.uid);
      setUID(userCredential.user.uid);
      initializeUser().catch((error) =>
        console.error('Error initializing user:', error)
      );
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message);
      console.error('Sign-in Error:', err.message);
    }
  };

  const handleSignUp = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      console.log('Signed up UID:', userCredential.user.uid);
      setUserUID(userCredential.user.uid);
      setUID(userCredential.user.uid);
      initializeUser().catch((error) =>
        console.error('Error initializing user:', error)
      );
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message);
      console.error('Sign-up Error:', err.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      console.log('User signed out');
      setEmail('');
      setPassword('');
      setUserEmail(null);
      setUserUID(null);
      clearUID();
      await removeUID();
    } catch (err: any) {
      setError(err.message);
      console.error('Sign-out Error:', err.message);
    }
  };

  const handleGoogleLogin = async () => {
    if (request) {
      console.log('LoginScreen: Initiating Google login');
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
      <Text style={styles.title}>Login</Text>
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
            name={showPassword ? 'visibility-off' : 'visibility'}
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
        <View style={styles.logoutContainer}>
          <Text style={styles.loggedInText}>Logged in as: {userEmail}</Text>
          <TouchableOpacity style={styles.logoutIcon} onPress={handleSignOut}>
            <Icon name="logout" size={20} color="#333" />
          </TouchableOpacity>
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
    backgroundColor: '#666',
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
  error: {
    color: 'red',
    marginBottom: 10,
  },
});
