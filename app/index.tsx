import { useRouter } from "expo-router";
import { useEffect } from "react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/(tabs)"); // ✅ Works with parentheses
  }, []);

  return null; // ✅ Nothing needs to render
}
