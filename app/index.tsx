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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
  const [viewMode, setViewMode] = useState<"DASHBOARD" | "MONITOR">(
    "DASHBOARD"
  );
  const [devices, setDevices] = useState([
    { id: "1", code: "S503V6", name: "Executive PC" },
    { id: "2", code: "Z1XS4J", name: "Travel MacBook" },
  ]);

  const sessionRef = useRef(0);

  // --- Effects ---
  useEffect(() => {
    if (!isPaired || !code) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${SERVER_URL}/status/${code}`);
        const data = await res.json();

        if (data.session_id && data.session_id !== sessionRef.current) {
          sessionRef.current = data.session_id;
          if (data.status === "FOCUSING") {
            Vibration.vibrate([0, 500, 100, 500]);
          }
        }
        setStatus(data.status || "IDLE");
        setSeconds(data.seconds || 0);
        if (data.history) setHistory(Object.values(data.history).reverse());
      } catch (e) {
        console.error("Sync error:", e);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isPaired, code]);

  // --- Handlers ---
  const handlePair = () => {
    if (code.length >= 6) {
      Vibration.vibrate(10);
      setIsPaired(true);
      Keyboard.dismiss();
    }
  };

  const handleActivatePro = () => {
    setIsActivating(true);
    Vibration.vibrate(50);
    setTimeout(() => {
      setIsActivating(false);
      setIsPro(true);
      setShowLicenseEntry(false);
      setIsPaired(true);
      Vibration.vibrate([0, 100, 50, 100]);
    }, 1500);
  };

  const registerDevice = () => {
    if (newDeviceCode.length < 6)
      return Alert.alert(
        "Invalid Code",
        "Please enter a valid 6-character room code."
      );
    const newDevice = {
      id: Math.random().toString(),
      code: newDeviceCode.toUpperCase(),
      name: `Device ${devices.length + 1}`,
    };
    setDevices([...devices, newDevice]);
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
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // --- UI Layouts ---

  // 1. Initial Pairing
  if (!isPaired) {
    return (
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
                <View style={styles.memberCardContent}>
                  <Ionicons name="key-outline" size={20} color={Colors.gold} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={styles.memberCardTitle}>PRO MEMBERSHIP</Text>
                    <Text style={styles.memberCardSub}>
                      Activate executive license
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={Colors.gold}
                  />
                </View>
              </TouchableOpacity>
            </View>

            {showLicenseEntry && (
              <View style={styles.proOverlay}>
                <View style={styles.proModal}>
                  <Ionicons name="medal" size={48} color={Colors.gold} />
                  <Text style={styles.proModalTitle}>Activate Pro</Text>
                  <TextInput
                    style={styles.proInput}
                    placeholder="LICENSE KEY"
                    placeholderTextColor="#555"
                    value={licenseInput}
                    onChangeText={setLicenseInput}
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity
                    style={styles.proSubmitBtn}
                    onPress={handleActivatePro}
                    disabled={isActivating || !licenseInput}
                  >
                    {isActivating ? (
                      <ActivityIndicator color={Colors.navy} />
                    ) : (
                      <Text style={styles.proSubmitText}>Verify</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowLicenseEntry(false)}>
                    <Text style={{ color: Colors.textMuted, marginTop: 20 }}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </TouchableWithoutFeedback>
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
            <TouchableOpacity
              onPress={() => setIsPaired(false)}
              style={styles.goldBadge}
            >
              <Ionicons name="log-out" size={20} color={Colors.navy} />
            </TouchableOpacity>
          </View>

          <View style={styles.proSection}>
            <Text style={styles.proSectionTitle}>Active Fleet</Text>
            {devices.map((dev) => (
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
            ))}

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
                  <View key={i} style={styles.serviceItem}>
                    <Ionicons name="sparkles" size={24} color={Colors.gold} />
                    <Text style={styles.serviceLabel}>{s}</Text>
                  </View>
                )
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
                  status === "FOCUSING" ? Colors.success : Colors.textMuted,
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
          <Text style={styles.timerLabel}>Current Session</Text>
        </View>
      </View>

      <View style={styles.historySection}>
        <Text style={[styles.historyTitle, isPro && { color: Colors.gold }]}>
          Activity Log
        </Text>
        <ScrollView style={styles.historyScroll}>
          {history.map((item: any, idx) => (
            <View
              key={idx}
              style={[
                styles.historyCard,
                isPro && {
                  backgroundColor: Colors.surfacePro,
                  borderColor: Colors.gold + "20",
                  borderWidth: 1,
                },
              ]}
            >
              <View style={styles.historyCardLeft}>
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={isPro ? Colors.gold : Colors.accent}
                />
                <View>
                  <Text
                    style={[
                      styles.historyDate,
                      isPro && { color: Colors.goldLight },
                    ]}
                  >
                    {item.end_time}
                  </Text>
                  <Text style={styles.historyDuration}>
                    Time: {formatTime(item.duration)}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.historyPoints,
                  isPro && { backgroundColor: Colors.gold + "20" },
                ]}
              >
                <Text
                  style={[styles.pointsText, isPro && { color: Colors.gold }]}
                >
                  +{Math.floor(item.duration / 60)}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
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
    marginTop: 30,
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
  timerText: { fontSize: 72, fontWeight: "800", color: Colors.text },
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
});
