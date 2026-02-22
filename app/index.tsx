import { Redirect } from "expo-router";

export default function Index() {
  // Logic check: normally you'd check your Auth state here (e.g., Firebase or AsyncStorage)
  const userIsLoggedIn = false;

  if (userIsLoggedIn) {
    // If logged in, go to the Dashboard inside tabs
    return <Redirect href="/(tabs)/dashboard" />;
  } else {
    // If not logged in, go to the Login screen
    return <Redirect href="/(auth)/login" />;
  }

}
