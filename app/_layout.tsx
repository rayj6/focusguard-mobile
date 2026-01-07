import { Stack } from "expo-router";
import { StatusBar } from "react-native";
import { useEffect } from "react";

export default function RootLayout() {
  return (
    <>
      <StatusBar hidden={true} />

      <Stack
        screenOptions={{
          // Ẩn Header (thanh có chữ "index")
          headerShown: false,
          // Đảm bảo nội dung tràn ra toàn màn hình
          contentStyle: { backgroundColor: "#050505" },
        }}
      />
    </>
  );
}
