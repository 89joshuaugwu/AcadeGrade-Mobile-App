import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

interface Props {
  children: React.ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Added while diagnosing the "stuck on splash screen forever" bug report.
 * Before this existed, ANY error thrown during the app's first render pass
 * (or even at module-import time, before React ever mounts anything) was
 * completely invisible in a non-dev-client build: the native splash screen
 * is a separate native-level surface, and nothing in the JS layer was ever
 * given a chance to call `SplashScreen.hideAsync()` or show an error UI.
 *
 * This won't catch an import-time crash by itself (React error boundaries
 * only catch errors thrown during render/lifecycle, not raw module
 * evaluation) — but combined with moving the risky top-level calls into
 * guarded functions (see lib/firebase/auth.ts, lib/firebase/client.ts),
 * this is what turns the NEXT unexpected error — whatever it turns out to
 * be — into a readable screen instead of another silent hang.
 */
export class RootErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AcadeGrade] Root render error:', error, info.componentStack);
    // Make absolutely sure the splash screen isn't left hanging on top of this.
    SplashScreen.hideAsync().catch(() => {});
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#07090F', paddingTop: 80, paddingHorizontal: 20 }}>
          <Text style={{ color: '#E8EDFF', fontSize: 20, fontWeight: '700', marginBottom: 12 }}>
            Something went wrong
          </Text>
          <Text style={{ color: '#8892B0', fontSize: 14, marginBottom: 20, lineHeight: 20 }}>
            The app hit an error while starting up. This screen exists so that error is visible
            instead of a blank hang — screenshot this and share it for a fix.
          </Text>
          <ScrollView style={{ maxHeight: 240, backgroundColor: '#141B2E', borderRadius: 12, padding: 12 }}>
            <Text style={{ color: '#EF4444', fontFamily: 'monospace', fontSize: 12 }}>
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </Text>
          </ScrollView>
          <Pressable
            onPress={() => this.setState({ error: null })}
            style={{ marginTop: 20, backgroundColor: '#6366F1', borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Try Again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
