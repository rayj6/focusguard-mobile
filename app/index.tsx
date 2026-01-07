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
  Image,
  SafeAreaView,
  StatusBar,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView, // Thêm component này
  Platform, // Thêm để kiểm tra hệ điều hành
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const SERVER_URL = "http://172.20.10.3:5000";

const Colors = {
  background: "#0a0e27",
  surface: "#1a1f3a",
  accent: "#06b6d4",
  success: "#10b981",
  danger: "#ef4444",
  text: "#f1f5f9",
  textMuted: "#94a3b8",
};

export default function App() {
  const [code, setCode] = useState("");
  const [isPaired, setIsPaired] = useState(false);
  const [status, setStatus] = useState("IDLE");
  const [seconds, setSeconds] = useState(0);
  const [history, setHistory] = useState<any[]>([]);

  const sessionRef = useRef(0);
  const lastTimeRef = useRef("");

  useEffect(() => {
    if (!isPaired) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${SERVER_URL}/status/${code}`);
        const data = await res.json();

        if (data.session_id === 0) {
          setStatus("IDLE");
          sessionRef.current = 0;
        } else {
          if (sessionRef.current !== data.session_id) {
            sessionRef.current = data.session_id;
            setSeconds(0);
            setStatus("WORKING");
            Vibration.vibrate(200);
          }

          if (data.is_distracted && data.timestamp !== lastTimeRef.current) {
            lastTimeRef.current = data.timestamp;
            setStatus("DISTRACTED");
            Vibration.vibrate(500);
            setHistory((prev) => [
              {
                id: Date.now(),
                time: data.timestamp,
                reason: data.reason,
                img: `${SERVER_URL}/proof/${code}?t=${Date.now()}`,
              },
              ...prev,
            ]);
          } else if (!data.is_distracted) {
            setStatus("WORKING");
          }
        }
      } catch (e) {
        setStatus("IDLE");
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isPaired, code]);

  useEffect(() => {
    let t: any;
    if (status !== "IDLE") {
      t = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => clearInterval(t);
  }, [status]);

  const handlePairing = () => {
    if (code.length === 6) {
      Keyboard.dismiss();
      setIsPaired(true);
    }
  };

  const goHome = () => {
    setIsPaired(false);
    setStatus("IDLE");
    sessionRef.current = 0;
    setSeconds(0);
  };

  const formatTime = (secs: number) => {
    return new Date(secs * 1000).toISOString().substr(11, 8);
  };

  if (!isPaired) {
    return (
      <SafeAreaView style={styles.pairingContainer}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={Colors.background}
        />

        {/* KeyboardAvoidingView giúp đẩy nội dung lên khi bàn phím hiện ra */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.pairingContent}>
              <View style={styles.pairingHeader}>
                <View style={styles.logo}>
                  <Ionicons name="eye-off" size={32} color={Colors.accent} />
                </View>
                <Text style={styles.pairingTitle}>Focus Guard</Text>
                <Text style={styles.pairingSubtitle}>
                  Device pairing required to track distractions
                </Text>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Enter 6-digit code</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  maxLength={6}
                  value={code}
                  onChangeText={(text) => {
                    setCode(text);
                    if (text.length === 6) Keyboard.dismiss();
                  }}
                  placeholder="000000"
                  placeholderTextColor={Colors.textMuted}
                  autoFocus={true} // Tự động hiện bàn phím khi vào màn hình
                />
                <Text style={styles.inputHint}>Check your PC for the code</Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.connectButton,
                  { opacity: code.length === 6 ? 1 : 0.5 },
                ]}
                onPress={handlePairing}
                disabled={code.length !== 6}
              >
                <Text style={styles.connectButtonText}>Connect Device</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // --- GIỮ NGUYÊN PHẦN HIỂN THỊ KHI ĐÃ PAIRED ---
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <View style={styles.navbar}>
        <TouchableOpacity onPress={goHome} style={styles.homeButton}>
          <Ionicons name="home-outline" size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.deviceCode}>Device: {code}</Text>
        <View style={styles.statusDot}>
          <View
            style={[
              styles.statusDotInner,
              {
                backgroundColor:
                  status === "WORKING"
                    ? Colors.success
                    : status === "DISTRACTED"
                    ? Colors.danger
                    : Colors.textMuted,
              },
            ]}
          />
        </View>
      </View>

      <View
        style={[
          styles.statusCard,
          status === "DISTRACTED" && styles.statusCardAlert,
        ]}
      >
        <View style={styles.statusHeader}>
          <Text style={styles.statusLabel}>
            {status === "IDLE"
              ? "Session Paused"
              : status === "WORKING"
              ? "Focused"
              : "Distracted"}
          </Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  status === "WORKING"
                    ? Colors.success + "20"
                    : status === "DISTRACTED"
                    ? Colors.danger + "20"
                    : Colors.surface,
              },
            ]}
          >
            <View
              style={[
                styles.statusBadgeDot,
                {
                  backgroundColor:
                    status === "WORKING"
                      ? Colors.success
                      : status === "DISTRACTED"
                      ? Colors.danger
                      : Colors.textMuted,
                },
              ]}
            />
            <Text
              style={[
                styles.statusBadgeText,
                {
                  color:
                    status === "WORKING"
                      ? Colors.success
                      : status === "DISTRACTED"
                      ? Colors.danger
                      : Colors.textMuted,
                },
              ]}
            >
              {status}
            </Text>
          </View>
        </View>
        <Text style={styles.timer}>{formatTime(seconds)}</Text>
        <Text style={styles.timerLabel}>Session time</Text>
      </View>

      <View style={styles.historySection}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>Recent Distractions</Text>
          <Text style={styles.historyCount}>{history.length}</Text>
        </View>
        <ScrollView
          style={styles.historyScroll}
          showsVerticalScrollIndicator={false}
        >
          {history.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="checkmark-circle"
                size={48}
                color={Colors.success}
              />
              <Text style={styles.emptyStateText}>No distractions yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Keep up the great focus!
              </Text>
            </View>
          ) : (
            history.map((item) => (
              <View key={item.id} style={styles.historyCard}>
                <View style={styles.historyCardLeft}>
                  <View style={styles.historyTime}>
                    <Ionicons
                      name="alert-circle"
                      size={20}
                      color={Colors.danger}
                    />
                    <Text style={styles.historyTimeText}>{item.time}</Text>
                  </View>
                  <Text style={styles.historyReason}>{item.reason}</Text>
                </View>
                <Image
                  source={{ uri: item.img }}
                  style={styles.historyImage}
                  resizeMode="cover"
                />
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pairingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  pairingContent: {
    flex: 1,
    justifyContent: "center", // Đổi từ space-between sang center để KeyboardAvoidingView hoạt động tốt hơn
    paddingHorizontal: 24,
    gap: 40, // Khoảng cách giữa các thành phần
  },
  // ... Giữ nguyên các style khác từ file index.tsx của bạn ...
  pairingHeader: { alignItems: "center" },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  pairingTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 12,
  },
  pairingSubtitle: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 24,
  },
  inputContainer: { marginBottom: 20 },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textMuted,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 32,
    fontWeight: "300",
    color: Colors.text,
    textAlign: "center",
    letterSpacing: 8,
  },
  inputHint: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 8,
  },
  connectButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  connectButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  container: { flex: 1, backgroundColor: Colors.background },
  navbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  homeButton: { padding: 8, borderRadius: 8, backgroundColor: Colors.surface },
  deviceCode: { fontSize: 14, color: Colors.textMuted, fontWeight: "500" },
  statusDot: { padding: 8 },
  statusDotInner: { width: 8, height: 8, borderRadius: 4 },
  statusCard: {
    marginHorizontal: 20,
    marginTop: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: Colors.surface,
    borderRadius: 16,
  },
  statusCardAlert: {
    backgroundColor: Colors.danger + "10",
    borderWidth: 1,
    borderColor: Colors.danger + "30",
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  statusLabel: { fontSize: 18, fontWeight: "600", color: Colors.text },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 8,
  },
  statusBadgeDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 12, fontWeight: "600" },
  timer: {
    fontSize: 56,
    fontWeight: "300",
    color: Colors.text,
    marginBottom: 8,
    letterSpacing: 1,
  },
  timerLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  historySection: { flex: 1, marginTop: 32, paddingHorizontal: 20 },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  historyTitle: { fontSize: 16, fontWeight: "600", color: Colors.text },
  historyCount: {
    fontSize: 13,
    color: Colors.textMuted,
    backgroundColor: Colors.surface,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  historyScroll: { flex: 1 },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyStateText: { fontSize: 16, fontWeight: "600", color: Colors.text },
  emptyStateSubtext: { fontSize: 14, color: Colors.textMuted },
  historyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  historyCardLeft: { flex: 1, gap: 8 },
  historyTime: { flexDirection: "row", alignItems: "center", gap: 8 },
  historyTimeText: { fontSize: 13, fontWeight: "600", color: Colors.text },
  historyReason: { fontSize: 14, color: Colors.textMuted, fontWeight: "500" },
  historyImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
});
