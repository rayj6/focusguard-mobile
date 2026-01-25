"use client";

import { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Vibration,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL;

const Colors = {
  background: "#0a0e27",
  surface: "#1a1f3a",
  accent: "#06b6d4",
  success: "#10b981",
  danger: "#ef4444",
  text: "#f1f5f9",
  textMuted: "#94a3b8",
  navy: "#050b18",
  gold: "#D4AF37",
  goldLight: "#F9E5BC",
  surfacePro: "#111827",
};

const STORAGE_KEY = "@GFOCUS_DISTRACTION_HISTORY";

export default function App() {
  // --- States ---
  const [code, setCode] = useState("");
  const [isPaired, setIsPaired] = useState(false);
  const [status, setStatus] = useState("IDLE");
  const [seconds, setSeconds] = useState(0);
  const [history, setHistory] = useState<any[]>([]);

  // Pro States
  const [isPro, setIsPro] = useState(false);
  const [showLicenseEntry, setShowLicenseEntry] = useState(false);
  const [showRegisterDevice, setShowRegisterDevice] = useState(false);
  const [newDeviceCode, setNewDeviceCode] = useState("");
  const [isActivating, setIsActivating] = useState(false);
  const [licenseInput, setLicenseInput] = useState("");
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"DASHBOARD" | "MONITOR">(
    "DASHBOARD",
  );
  const [devices, setDevices] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  const [showGuide, setShowGuide] = useState(false);
  const ONBOARDING_KEY = "@GFOCUS_GUIDE_SEEN";
  const FLEET_STORAGE_KEY = "@GFOCUS_FLEET_DEVICES";
  const LICENSE_STORAGE_KEY = "@GFOCUS_LICENSE_KEY";

  // --- Logic Refs ---
  const distractionCounter = useRef(0);
  const getRoomStorageKey = (roomCode: string) => `@GFOCUS_HISTORY_${roomCode}`;

  useEffect(() => {
    const checkFirstTime = async () => {
      const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (!seen) setShowGuide(true);
    };
    checkFirstTime();
  }, []);

  const completeGuide = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    setShowGuide(false);
  };

  useEffect(() => {
    if (isPaired && code) {
      loadRoomHistory(code);
    }
  }, [isPaired, code]);

  const loadRoomHistory = async (roomCode: string) => {
    try {
      const savedData = await AsyncStorage.getItem(getRoomStorageKey(roomCode));
      if (savedData) {
        let parsed = JSON.parse(savedData);
        // Delete logs older than 24 hours
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const filtered = parsed.filter((item: any) => item.id > oneDayAgo);
        setHistory(filtered);
      } else {
        setHistory([]); // Reset for new room
      }
    } catch (e) {
      console.error("Load Error:", e);
    }
  };

  // 2. Robust Base64 Conversion (Ensures images display)
  const getBase64 = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(null);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      return null;
    }
  };

  // 3. Save to Room-Specific Storage
  const saveDistraction = async (data: any, roomCode: string) => {
    try {
      const liveUrl = `${SERVER_URL}/proofs/proof_${roomCode}.jpg?t=${Date.now()}`;
      const base64Data = await getBase64(liveUrl);

      if (!base64Data) return;

      const newEntry = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        reason: data.reason || "Distraction",
        image_data: base64Data, // Stores actual image bits
      };

      const updatedHistory = [newEntry, ...history].slice(0, 20);
      setHistory(updatedHistory);

      // Save to room-specific key
      await AsyncStorage.setItem(
        getRoomStorageKey(roomCode),
        JSON.stringify(updatedHistory),
      );
      Vibration.vibrate(500);
    } catch (e) {
      console.error("Save Error:", e);
    }
  };

  useEffect(() => {
    // 1-Hour Limit Logic (3600 seconds)
    const FREE_LIMIT_SECONDS = 3600;

    if (!isPro && isPaired && seconds >= FREE_LIMIT_SECONDS) {
      // 1. Alert the user immediately
      Alert.alert(
        "Limit Reached",
        "You have reached the 1-hour work limit for the Free Plan. Please upgrade to Pro to unlock unlimited focus time.",
        [
          { text: "Later", onPress: () => setIsPaired(false) },
          { text: "Go Pro", onPress: () => setShowLicenseEntry(true) },
        ],
      );

      // 2. Stop the session
      setIsPaired(false);
      setStatus("IDLE");
    }
  }, [seconds, isPro, isPaired]);

  // 4. Monitoring Loop
  useEffect(() => {
    // Only run if paired and we have a code
    if (!isPaired || !code) return;

    const interval = window.setInterval(async () => {
      try {
        const res = await fetch(`${SERVER_URL}/status/${code}`);

        // If the server returns an error (404, 500, etc.)
        if (!res.ok) throw new Error("Server Offline");

        const data = await res.json();

        // Update the status (IDLE, FOCUSING, or DISTRACTED)
        setStatus(data.status);

        if (
          data.status === "IDLE" &&
          (status === "FOCUSING" || status === "DISTRACTED")
        ) {
          // 1. Stop the clock by updating status
          setStatus("IDLE");

          // 2. Save this session to history before it's lost
          if (seconds > 5) {
            // Only save sessions longer than 5 seconds
            const newSession = {
              id: Date.now().toString(),
              date: new Date().toLocaleDateString(),
              time: new Date().toLocaleTimeString(),
              duration: seconds,
              sessions: data.session_id || 0,
            };

            const updatedHistory = [newSession, ...history];
            setHistory(updatedHistory);
            await AsyncStorage.setItem(
              STORAGE_KEY,
              JSON.stringify(updatedHistory),
            );
          }
          return; // Exit early so we don't sync seconds back to 0
        }

        // Update Proof Image
        setProofUrl(
          data.image_url ? `${data.image_url}?t=${Date.now()}` : null,
        );

        // Distraction saving logic
        if (data.status === "DISTRACTED") {
          distractionCounter.current += 1;
          if (distractionCounter.current >= 5) {
            await saveDistraction(data, code);
            distractionCounter.current = 0;
          }
        } else {
          distractionCounter.current = 0;
        }
      } catch (e) {
        // SAFETY: If the network fails or desktop app is closed
        console.log("Monitor Error: Assuming IDLE", e);
        setStatus("IDLE");
      }
    }, 2000); // Check server every 2 seconds

    return () => window.clearInterval(interval);
    // IMPORTANT: Removed 'seconds' and 'status' from here.
    // This allows the interval to run smoothly without restarting constantly.
  }, [isPaired, code]);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const savedFleet = await AsyncStorage.getItem(FLEET_STORAGE_KEY);
        if (savedFleet) {
          setDevices(JSON.parse(savedFleet));
        }
        // 1. Check for stored license
        const storedKey = await AsyncStorage.getItem(LICENSE_STORAGE_KEY);
        if (storedKey) {
          const response = await fetch(`${SERVER_URL}/verify_license`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ license_key: storedKey.trim() }),
          });

          const data = await response.json();
          if (response.ok && data.valid) {
            setIsPro(true);
            setLicenseInput(storedKey);
            setIsPaired(true); // Automatically set paired if they are Pro
          } else {
            await AsyncStorage.removeItem(LICENSE_STORAGE_KEY);
          }
        }
      } catch (e) {
        console.error("Failed to restore license", e);
      } finally {
        setIsLoading(false); // Finish loading regardless of result
      }
    };

    initializeApp();
  }, []);

  // --- Handlers ---
  const handlePair = () => {
    if (code.length >= 6) {
      Vibration.vibrate(10);
      setIsPaired(true);
      Keyboard.dismiss();
    }
  };

  const handleActivatePro = async () => {
    if (!licenseInput.trim()) return;

    // setIsActivating(true);
    // Vibration.vibrate(50);

    // setIsPro(true);
    // setShowLicenseEntry(false);
    // setIsPaired(true);

    try {
      const response = await fetch(`${SERVER_URL}/verify_license`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ license_key: licenseInput.trim() }),
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        // 1. Persist the key locally so it survives app restarts
        await AsyncStorage.setItem(LICENSE_STORAGE_KEY, licenseInput.trim());

        // 2. Update state
        setIsPro(true);
        setShowLicenseEntry(false);
        setIsPaired(true); // Auto-pair if they just activated

        Vibration.vibrate([0, 100, 50, 100]);
        Alert.alert("Success", `Pro Activated: ${data.tier} Tier`);
      } else {
        Alert.alert(
          "Invalid License",
          "The license key provided is incorrect or unpaid.",
        );
      }
    } catch (error) {
      Alert.alert(
        "Connection Error",
        "Could not reach the verification server.",
      );
    } finally {
      setIsActivating(false);
    }
  };

  const registerDevice = async () => {
    if (newDeviceCode.length < 6)
      return Alert.alert(
        "Error",
        "Please enter a valid 6-character room code.",
      );

    const newDevice = {
      id: Date.now().toString(), // Use timestamp for unique ID
      code: newDeviceCode.toUpperCase(),
      name: `Device ${devices.length + 1}`,
    };

    const updatedFleet = [...devices, newDevice];
    setDevices(updatedFleet);

    // Save to disk
    await AsyncStorage.setItem(FLEET_STORAGE_KEY, JSON.stringify(updatedFleet));

    setNewDeviceCode("");
    setShowRegisterDevice(false);
    Vibration.vibrate(10);
  };

  const updateDeviceName = (id: string, newName: string) => {
    setDevices(devices.map((d) => (d.id === id ? { ...d, name: newName } : d)));
  };

  const selectDevice = (deviceCode: string) => {
    setCode(deviceCode);
    setViewMode("MONITOR");
    Vibration.vibrate(5);
  };

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    const pad = (n: number) => (n < 10 ? `0${n}` : n);
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  useEffect(() => {
    let ticker: any;

    // The timer ONLY runs if we are explicitly in an active state
    const isActive = status === "FOCUSING" || status === "DISTRACTED";

    if (isPaired && isActive) {
      ticker = window.setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (ticker) window.clearInterval(ticker);
    };
  }, [isPaired, status]);

  // --- UI Layouts ---
  const OnboardingGuide = () => (
    <View style={styles.guideOverlay}>
      <View style={styles.guideCard}>
        <Ionicons
          name="rocket"
          size={50}
          color={Colors.accent}
          style={{ alignSelf: "center" }}
        />
        <Text style={styles.guideHeader}>GETTING STARTED</Text>

        <View style={styles.stepItem}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepNumber}>1</Text>
          </View>
          <Text style={styles.stepText}>
            Visit{" "}
            <Text style={{ color: Colors.accent }}>
              gfocus.scarlet-technology.com
            </Text>
          </Text>
        </View>

        <View style={styles.stepItem}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepNumber}>2</Text>
          </View>
          <Text style={styles.stepText}>
            Download & install the GFOCUS Engine (Windows or Mac).
          </Text>
        </View>

        <View style={styles.stepItem}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepNumber}>3</Text>
          </View>
          <Text style={styles.stepText}>
            Enter the 6-digit room code generated by your desktop app here.
          </Text>
        </View>

        <TouchableOpacity style={styles.guideButton} onPress={completeGuide}>
          <Text style={styles.guideButtonText}>I'M READY</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }
  // 1. Initial Pairing
  if (!isPaired) {
    return (
      <View style={{ flex: 1 }}>
        {showGuide && <OnboardingGuide />}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.pairingContent}
            >
              <View style={styles.headerSection}>
                <View style={styles.logoContainer}>
                  <Ionicons name="infinite" size={48} color={Colors.accent} />
                </View>
                <Text style={styles.title}>FocusAI</Text>
                <Text style={styles.subtitle}>Enter the code from your PC</Text>
              </View>

              <View style={styles.inputSection}>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: S503V6"
                  placeholderTextColor={Colors.textMuted}
                  value={code}
                  onChangeText={(text) => setCode(text.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={10}
                />
                <TouchableOpacity
                  style={[
                    styles.button,
                    code.length < 6 && styles.buttonDisabled,
                  ]}
                  onPress={handlePair}
                  disabled={code.length < 6}
                >
                  <Text style={styles.buttonText}>Connect Device</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.luxuryMemberCard}
                  onPress={() => setShowLicenseEntry(true)}
                >
                  <View style={styles.goldLine} />
                  <View style={{ marginTop: 'auto', paddingTop: 20, alignItems: 'center' }}>
                    <TouchableOpacity
                      style={styles.loginLinkContainer}
                      onPress={() => setShowLicenseEntry(true)}
                    >
                      <Text style={styles.loginLinkText}>
                        Already a Pro Member? <Text style={{ color: Colors.gold, fontWeight: '800' }}>SIGN IN</Text>
                      </Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </View>

              {showLicenseEntry && (
                <View style={styles.licenseOverlay}>
                  <View style={styles.licenseCard}>
                    <View style={styles.licenseHeader}>
                      <Ionicons name="person-circle-outline" size={24} color={Colors.gold} />
                      <Text style={styles.licenseTitle}>MEMBER LOGIN</Text>
                    </View>

                    <Text style={styles.licenseSubtitle}>
                      Sign in with your GFocus account credentials to sync your Pro status across devices.
                    </Text>

                    {/* Email Field */}
                    <TextInput
                      style={styles.licenseInput}
                      placeholder="Email Address"
                      placeholderTextColor={Colors.textMuted}
                      // Using a local state or just placeholder for email since you didn't provide an email state
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />

                    {/* Password Field (Mapped to licenseInput) */}
                    <TextInput
                      style={styles.licenseInput}
                      placeholder="Password"
                      placeholderTextColor={Colors.textMuted}
                      value={licenseInput}
                      onChangeText={setLicenseInput}
                      autoCapitalize="characters"
                      secureTextEntry={true} // Masks the license key as dots
                    />

                    <TouchableOpacity
                      style={styles.activateButton}
                      onPress={handleActivatePro}
                      disabled={isActivating}
                    >
                      {isActivating ? (
                        <ActivityIndicator color={Colors.navy} />
                      ) : (
                        <Text style={styles.activateButtonText}>SIGN IN</Text>
                      )}
                    </TouchableOpacity>

                    <View style={styles.buySection}>
                      <TouchableOpacity
                        onPress={() =>
                          Linking.openURL("https://gfocus.scarlet-technology.com")
                        }
                      >
                        <Text style={styles.buyLink}>Forgot Password?</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={styles.closeLicense}
                      onPress={() => setShowLicenseEntry(false)}
                    >
                      <Text style={styles.closeLicenseText}>BACK</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </KeyboardAvoidingView>
          </SafeAreaView>
        </TouchableWithoutFeedback>
      </View>
    );
  }

  // 2. Pro Dashboard (Main View)
  if (isPro && viewMode === "DASHBOARD") {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: Colors.navy }]}
      >
        <StatusBar barStyle="light-content" />
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.proHeader}>
            <View>
              <Text style={styles.proWelcome}>Fleet Control</Text>
              <Text style={styles.proLicenseType}>LIFETIME PRO MEMBER</Text>
            </View>
          </View>

          <View style={styles.proSection}>
            <Text style={styles.proSectionTitle}>Active Fleet</Text>

            {devices.length === 0 ? (
              /* EMPTY STATE DISPLAY */
              <View style={styles.emptyFleetCard}>
                <Ionicons
                  name="shield-outline"
                  size={40}
                  color={Colors.gold + "40"}
                />
                <Text style={styles.emptyFleetText}>
                  No devices connected to this license.
                </Text>
                <Text style={styles.emptyFleetSub}>
                  Register your first device below to start monitoring.
                </Text>
              </View>
            ) : (
              /* RENDER DEVICES */
              devices.map((dev) => (
                <TouchableOpacity
                  key={dev.id}
                  style={[
                    styles.deviceCardPro,
                    code === dev.code && { borderColor: Colors.gold },
                  ]}
                  onPress={() => selectDevice(dev.code)}
                >
                  <View style={styles.deviceInfo}>
                    <Ionicons
                      name="desktop-outline"
                      size={24}
                      color={Colors.gold}
                    />
                    <View style={{ marginLeft: 15, flex: 1 }}>
                      <TextInput
                        style={styles.deviceNameInput}
                        value={dev.name}
                        onChangeText={(val) => updateDeviceName(dev.id, val)}
                        placeholderTextColor={Colors.gold + "50"}
                      />
                      <Text style={styles.deviceCodePro}>{dev.code}</Text>
                    </View>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={Colors.gold + "50"}
                  />
                </TouchableOpacity>
              ))
            )}

            <TouchableOpacity
              style={styles.addDeviceBtn}
              onPress={() => setShowRegisterDevice(true)}
            >
              <Ionicons name="add" size={20} color={Colors.gold} />
              <Text style={styles.addDeviceText}>Register New Device</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.proSection}>
            <Text style={styles.proSectionTitle}>Executive Services</Text>
            <View style={styles.proServiceGrid}>
              {["Analytics", "Cloud Sync", "Guard Plus", "Zen Mode"].map(
                (s, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.serviceItem}
                    onPress={() =>
                      Alert.alert(
                        "Feature Locked",
                        "This feature is coming soon to your Pro Dashboard.",
                      )
                    }
                  >
                    <Ionicons name="sparkles" size={24} color={Colors.gold} />
                    <Text style={styles.serviceLabel}>{s}</Text>
                  </TouchableOpacity>
                ),
              )}
            </View>
          </View>
        </ScrollView>

        {showRegisterDevice && (
          <View style={styles.proOverlay}>
            <View style={styles.proModal}>
              <Text style={styles.proModalTitle}>New Device</Text>
              <TextInput
                style={styles.proInput}
                placeholder="ROOM CODE"
                placeholderTextColor="#555"
                value={newDeviceCode}
                onChangeText={setNewDeviceCode}
                autoCapitalize="characters"
                maxLength={6}
              />
              <TouchableOpacity
                style={styles.proSubmitBtn}
                onPress={registerDevice}
              >
                <Text style={styles.proSubmitText}>Link Device</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowRegisterDevice(false)}>
                <Text style={{ color: Colors.textMuted, marginTop: 20 }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // 3. Monitor View (Used by both Pro and Free)
  return (
    <SafeAreaView
      style={[styles.container, isPro && { backgroundColor: Colors.navy }]}
    >
      <StatusBar barStyle="light-content" />

      <View style={styles.mainHeader}>
        <TouchableOpacity
          onPress={() =>
            isPro ? setViewMode("DASHBOARD") : setIsPaired(false)
          }
        >
          <Ionicons
            name={isPro ? "apps-outline" : "chevron-back"}
            size={24}
            color={isPro ? Colors.gold : Colors.text}
          />
        </TouchableOpacity>
        <View style={{ alignItems: "flex-end" }}>
          <Text
            style={[styles.deviceCodeLabel, isPro && { color: Colors.gold }]}
          >
            Target Device
          </Text>
          <Text
            style={[
              styles.deviceCodeValue,
              isPro && { color: Colors.goldLight },
            ]}
          >
            {code}
          </Text>
        </View>
      </View>

      <View style={styles.timerSection}>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                status === "FOCUSING" ? Colors.success + "20" : Colors.surface,
            },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  status === "FOCUSING" ? Colors.success : Colors.danger,
              },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              { color: status === "FOCUSING" ? Colors.success : Colors.text },
            ]}
          >
            {status}
          </Text>
        </View>
        <View style={styles.timerContainer}>
          <Text
            style={[styles.timerText, isPro && { color: Colors.goldLight }]}
          >
            {formatTime(seconds)}
          </Text>
          <Text style={styles.timerLabel}>
            {isPro ? "Executive Session" : `Free Session (Limit: 60m)`}
          </Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* --- LIVE PROOF (LIVE MONITORING) --- */}
        {status === "DISTRACTED" && proofUrl && (
          <View style={styles.proofContainer}>
            <View style={styles.proofHeader}>
              <Ionicons name="eye" size={16} color={Colors.danger} />
              <Text style={styles.proofTitle}>LIVE NEURAL EVIDENCE</Text>
            </View>
            <Image
              source={{ uri: proofUrl }}
              style={styles.proofImage}
              resizeMode="cover"
            />
            <Text style={styles.proofFooter}>
              AI Engine currently detecting non-focus activity.
            </Text>
          </View>
        )}

        {/* Distraction History Section */}
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>DISTRACTION HISTORY</Text>
          {history.length === 0 ? (
            <Text style={styles.emptyText}>
              No distraction incidents recorded.
            </Text>
          ) : (
            history.map((item) => (
              <View key={item.id} style={styles.historyCard}>
                <View style={{ flex: 1 }}>
                  <View style={styles.historyCardLeft}>
                    <Ionicons name="warning" size={18} color={Colors.danger} />
                    <View>
                      <Text style={styles.historyDate}>{item.timestamp}</Text>
                      <Text style={styles.historyDuration}>{item.reason}</Text>
                    </View>
                  </View>

                  {/* DISPLAY STORED BASE64 IMAGE */}
                  {item.image_data && (
                    <View style={styles.historyImageContainer}>
                      <Image
                        source={{ uri: item.image_data }}
                        style={styles.historyProofImage}
                        resizeMode="cover"
                      />
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  pairingContent: { flex: 1, padding: 30, justifyContent: "center" },
  headerSection: { alignItems: "center", marginBottom: 50 },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: { fontSize: 16, color: Colors.textMuted },
  inputSection: { gap: 16 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    fontSize: 24,
    color: Colors.text,
    textAlign: "center",
    fontWeight: "700",
    letterSpacing: 4,
  },
  button: {
    backgroundColor: Colors.accent,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "700" },

  luxuryMemberCard: {
    marginTop: 100,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.gold + "30",
  },
  goldLine: { height: 3, backgroundColor: Colors.gold, width: "100%" },
  memberCardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  memberCardTitle: {
    color: Colors.gold,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  memberCardSub: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  proOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5, 11, 24, 0.98)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2000,
  },
  proModal: {
    width: "85%",
    padding: 30,
    backgroundColor: Colors.navy,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: Colors.gold,
    alignItems: "center",
  },
  proModalTitle: { fontSize: 22, fontWeight: "800", color: Colors.goldLight },
  proInput: {
    width: "100%",
    height: 55,
    backgroundColor: "rgba(212, 175, 55, 0.05)",
    borderRadius: 12,
    color: Colors.goldLight,
    fontSize: 18,
    textAlign: "center",
    marginTop: 25,
    borderWidth: 1,
    borderColor: Colors.gold + "40",
    letterSpacing: 2,
  },
  proSubmitBtn: {
    marginTop: 25,
    backgroundColor: Colors.gold,
    width: "100%",
    height: 55,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  proSubmitText: { color: Colors.navy, fontWeight: "800" },

  proHeader: {
    padding: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  proWelcome: { fontSize: 28, fontWeight: "800", color: Colors.goldLight },
  proLicenseType: {
    color: Colors.gold,
    letterSpacing: 1,
    fontSize: 10,
    fontWeight: "700",
  },
  goldBadge: {
    backgroundColor: Colors.gold,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  proSection: { paddingHorizontal: 24, marginBottom: 30 },
  proSectionTitle: {
    color: Colors.gold,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 15,
    textTransform: "uppercase",
  },
  deviceCardPro: {
    backgroundColor: Colors.surfacePro,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.gold + "10",
  },
  deviceInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  deviceNameInput: {
    color: Colors.goldLight,
    fontSize: 17,
    fontWeight: "600",
    padding: 0,
    marginBottom: 2,
  },
  deviceCodePro: { color: Colors.textMuted, fontSize: 11 },
  activeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#333",
  },
  activeGlow: {
    backgroundColor: Colors.success,
    shadowColor: Colors.success,
    shadowRadius: 5,
    shadowOpacity: 0.5,
  },
  addDeviceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: Colors.gold,
    borderRadius: 16,
    marginTop: 5,
  },
  addDeviceText: { color: Colors.gold, marginLeft: 10, fontWeight: "600" },
  proServiceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  serviceItem: {
    width: "48%",
    backgroundColor: Colors.surfacePro,
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.gold + "10",
  },
  serviceLabel: {
    color: Colors.goldLight,
    marginTop: 10,
    fontSize: 11,
    fontWeight: "700",
  },

  mainHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
  },
  deviceCodeLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  deviceCodeValue: { fontSize: 18, color: Colors.text, fontWeight: "700" },
  timerSection: { alignItems: "center", paddingVertical: 40 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 20,
    gap: 6,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "700" },
  timerContainer: { alignItems: "center" },
  timerText: { fontSize: 50, fontWeight: "800", color: Colors.text },
  timerLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  historySection: { flex: 1, paddingHorizontal: 20 },
  historyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 15,
  },
  historyScroll: { flex: 1 },
  historyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historyCardLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  historyDate: { fontSize: 14, fontWeight: "600", color: Colors.text },
  historyDuration: { fontSize: 12, color: Colors.textMuted },
  historyPoints: {
    backgroundColor: Colors.accent + "20",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  pointsText: { fontSize: 12, fontWeight: "700", color: Colors.accent },
  historyImageContainer: {
    marginTop: 12,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.danger + "40",
    backgroundColor: "#000",
  },
  historyProofImage: {
    width: "100%",
    height: 150,
    opacity: 0.8,
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 4,
  },
  overlayText: {
    color: Colors.danger,
    fontSize: 8,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 1,
  },

  proofImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginTop: 10,
  },

  proofContainer: {
    marginHorizontal: 20,
    backgroundColor: "#000",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.danger,
    padding: 12,
    marginBottom: 30,
  },
  proofHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  proofTitle: {
    color: Colors.danger,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
  },
  proofFooter: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 8,
    fontStyle: "italic",
    textAlign: "center",
  },
  imageTimestampBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  imageTimestampText: {
    color: Colors.danger,
    fontSize: 10,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  emptyText: {
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 20,
    fontStyle: "italic",
  },
  guideOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5, 11, 24, 0.95)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
    padding: 30,
  },
  guideCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 30,
    width: "100%",
    borderWidth: 1,
    borderColor: Colors.accent + "40",
  },
  guideHeader: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    marginVertical: 20,
    letterSpacing: 2,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25,
    gap: 15,
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  stepNumber: {
    color: Colors.navy,
    fontWeight: "bold",
  },
  stepText: {
    color: Colors.textMuted,
    fontSize: 15,
    flex: 1,
    lineHeight: 22,
  },
  guideButton: {
    backgroundColor: Colors.accent,
    height: 55,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  guideButtonText: {
    color: Colors.navy,
    fontWeight: "900",
    fontSize: 16,
  },
  licenseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    padding: 20,
    zIndex: 2000,
  },
  licenseCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 25,
    borderWidth: 1,
    borderColor: Colors.gold + "40",
  },
  licenseInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    height: 55,
    color: "white",
    paddingHorizontal: 15,
    fontSize: 16,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    borderWidth: 1,
    borderColor: Colors.surface,
    marginBottom: 15,
  },
  activateButton: {
    backgroundColor: Colors.gold,
    height: 55,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  activateButtonText: {
    color: Colors.navy,
    fontWeight: "900",
    fontSize: 16,
  },
  // --- New Styles ---
  buySection: {
    marginTop: 25,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: Colors.surface,
    paddingTop: 20,
  },
  buyText: {
    color: Colors.textMuted,
    fontSize: 13,
    marginBottom: 5,
  },
  buyLink: {
    color: Colors.accent,
    fontWeight: "700",
    fontSize: 14,
    textDecorationLine: "underline",
  },
  closeLicense: {
    marginTop: 20,
    alignItems: "center",
  },
  closeLicenseText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "bold",
  },
  emptyFleetCard: {
    backgroundColor: Colors.surfacePro,
    borderRadius: 16,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.gold + "20",
    borderStyle: "dashed",
    marginBottom: 20,
  },
  emptyFleetText: {
    color: Colors.goldLight,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 15,
  },
  emptyFleetSub: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 5,
  },
  // Add these to your styles object
  loginLinkContainer: {
    paddingVertical: 15,
    width: '100%',
    alignItems: 'center',
  },
  loginLinkText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  // Update/Overwrite these existing styles
  licenseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 15,
    justifyContent: 'center',
  },
  licenseTitle: {
    color: Colors.gold,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1,
  },
  licenseSubtitle: {
    color: Colors.textMuted,
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 18,
    textAlign: 'center',
  },
});
