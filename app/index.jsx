import { Text, View , StyleSheet } from "react-native";

import {Link} from "expo-router"

export default function Index() {
  return (
    <View
      style={styles.container}>
      <Text style={styles.title}>tarantado</Text>
      <Link href="/(auth)">Login Page</Link>
      <Link href="/(auth)/signup">Signup Page</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{
    flex:1,
    justifyContent:"center",
    alignItems:"center",
  },
  title:{
    color:"#4fdd",
    fontSize:50,
  }

})