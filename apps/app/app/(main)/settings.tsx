import { Redirect } from 'expo-router'

/** Legacy route — profile tab replaced settings. */
export default function SettingsRedirect() {
  return <Redirect href="/(main)/profile" />
}
