import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

import { env, isFirebaseConfigured, isGoogleConfigured } from '../config/env';
import { useAuth } from '../context/AuthContext';

WebBrowser.maybeCompleteAuthSession();

export function GoogleSignInButton() {
  const { authenticateWithGoogle } = useAuth();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: env.google.webClientId,
    androidClientId: env.google.androidClientId,
    iosClientId: env.google.iosClientId,
    selectAccount: true,
    scopes: ['openid', 'profile', 'email'],
  });

  useEffect(() => {
    if (response?.type !== 'success') {
      if (response?.type === 'error') setError('O Google não concluiu a autenticação.');
      return;
    }

    const idToken = response.params.id_token ?? response.authentication?.idToken;
    if (!idToken) {
      setError('O Google não retornou um token de identidade.');
      return;
    }

    setWorking(true);
    setError(null);
    authenticateWithGoogle(idToken)
      .catch(() => setError('Não foi possível entrar. Confira a configuração do Firebase.'))
      .finally(() => setWorking(false));
  }, [authenticateWithGoogle, response]);

  const disabled = !request || working || !isGoogleConfigured || !isFirebaseConfigured;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => promptAsync()}
        style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && styles.pressed]}
      >
        {working ? <ActivityIndicator color="#16351E" /> : <Text style={styles.googleMark}>G</Text>}
        <Text style={styles.label}>Continuar com o Google</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD7CC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
    boxShadow: '0 8px 16px rgba(23, 53, 31, 0.08)',
    elevation: 3,
  },
  disabled: { opacity: 0.55 },
  pressed: { transform: [{ scale: 0.985 }] },
  googleMark: { fontSize: 21, fontWeight: '800', color: '#4285F4' },
  label: { fontSize: 16, fontWeight: '700', color: '#16351E' },
  error: { marginTop: 12, color: '#A13A32', textAlign: 'center', lineHeight: 20 },
});
