import { View, Text } from "react-native";

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Buenos días ☀️";
  if (hour < 18) return "Buenas tardes 🌤️";
  return "Buenas noches 🌙";
}

export default function Home() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ fontSize: 22, fontWeight: "600" }}>
        {getGreeting()}
      </Text>

      <Text style={{ fontSize: 18, marginTop: 10 }}>
        Bienvenido a tu workspace
      </Text>
    </View>
  );
}
