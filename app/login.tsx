//app\login.tsx CHANGE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { auth } from "../src/firebaseConfig";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import { useRouter } from "expo-router";
import Icon from "react-native-vector-icons/MaterialIcons"; // Already imported
import Header from "../src/components/Header";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const router = useRouter();

  // Check auth state on mount and fetch user email
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("User logged in:", user.uid);
        setUserEmail(user.email);
        router.replace("/(tabs)");
      } else {
        setUserEmail(null);
      }
    });
    return unsubscribe;
  }, []);

  const handleSignIn = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("Signed in UID:", userCredential.user.uid);
      router.replace("/(tabs)");
    } catch (err) {
      setError(err.message);
      console.error("Sign-in Error:", err.message);
    }
  };

  const handleSignUp = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log("Signed up UID:", userCredential.user.uid);
      router.replace("/(tabs)");
    } catch (err) {
      setError(err.message);
      console.error("Sign-up Error:", err.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      console.log("User signed out");
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err.message);
      console.error("Sign-out Error:", err.message);
    }
  };

  // Dummy handlers for Google and Facebook login
  const handleGoogleLogin = () => {
    console.log("Google login pressed (dummy)");
  };

  const handleFacebookLogin = () => {
    console.log("Facebook login pressed (dummy)");
  };

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <View style={styles.container}>
      <Header />
      <Text style={styles.title}>LifeLog Login</Text>
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
        <TouchableOpacity onPress={toggleShowPassword} style={styles.iconContainer}>
          <Icon
            name={showPassword ? "visibility-off" : "visibility"}
            size={24}
            color="#666"
          />
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.button} onPress={handleSignIn}>
        <Text style={styles.buttonText}>Sign In</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={handleSignUp}>
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>

      {/* Google Login Button */}
      <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin}>
        <Icon name="google" size={20} color="#444" style={styles.socialIcon} />
        <Text style={styles.googleButtonText}>Log in with Google</Text>
      </TouchableOpacity>

      {/* Facebook Login Button */}
      <TouchableOpacity style={styles.facebookButton} onPress={handleFacebookLogin}>
        <Icon name="facebook" size={20} color="#fff" style={styles.socialIcon} />
        <Text style={styles.facebookButtonText}>Log in with Facebook</Text>
      </TouchableOpacity>

      {userEmail && (
        <View style={styles.logoutContainer}>
          <Text style={styles.loggedInText}>Logged in as: {userEmail}</Text>
          <TouchableOpacity style={styles.logoutIcon} onPress={handleSignOut}>
            <Icon name="logout" size={20} color="#333" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 30,
    color: "#333",
  },
  input: {
    width: "100%",
    padding: 12,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginVertical: 10,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  iconContainer: {
    padding: 10,
    position: "absolute",
    right: 0,
  },
  button: {
    width: "100%",
    padding: 15,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  googleButton: {
    flexDirection: "row",
    width: "100%",
    padding: 15,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 5,
  },
  googleButtonText: {
    color: "#444",
    fontSize: 16,
    fontWeight: "600",
  },
  facebookButton: {
    flexDirection: "row",
    width: "100%",
    padding: 15,
    backgroundColor: "#4267B2", // Facebook blue
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 5,
  },
  facebookButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  socialIcon: {
    marginRight: 10,
  },
  logoutContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },
  loggedInText: {
    fontSize: 14,
    color: "#333",
    marginRight: 10,
  },
  logoutIcon: {
    padding: 5,
  },
  error: {
    color: "red",
    marginBottom: 10,
  },
});