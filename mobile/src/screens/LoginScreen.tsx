import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { isFirebaseConfigured, isGoogleConfigured, missingConfiguration } from '../config/env';

export function LoginScreen() {
  const configured = isFirebaseConfigured && isGoogleConfigured;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.decorationOne} />
      <View style={styles.decorationTwo} />
      <View style={styles.content}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>PR</Text>
        </View>
        <Text style={styles.title}>Meu Parana</Text>
        <Text style={styles.subtitle}>
          Descubra o estado, marque suas viagens e acompanhe quantos municípios você já conheceu.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Seu mapa começa aqui</Text>
          <Text style={styles.cardText}>Entre para salvar suas cidades visitadas com segurança.</Text>
          <GoogleSignInButton />
          {!configured ? (
            <Text style={styles.configurationNote}>
              Configure as variáveis do Firebase e do Google OAuth no ambiente do EAS e gere um novo APK.
              {missingConfiguration.length ? `\n\nPendente: ${missingConfiguration.join(' e ')}.` : null}
            </Text>
          ) : null}
        </View>
      </View>
      <Text style={styles.footer}>399 municípios para explorar</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F8F3' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  decorationOne: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    top: -100,
    right: -90,
    backgroundColor: '#D9EBDC',
  },
  decorationTwo: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    bottom: 40,
    left: -100,
    backgroundColor: '#F3E6BD',
  },
  badge: {
    width: 62,
    height: 62,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E6A42',
    transform: [{ rotate: '-5deg' }],
  },
  badgeText: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  title: { marginTop: 22, fontSize: 42, lineHeight: 48, fontWeight: '900', color: '#15351F' },
  subtitle: { marginTop: 12, maxWidth: 340, fontSize: 17, lineHeight: 25, color: '#526558' },
  card: {
    marginTop: 34,
    borderRadius: 24,
    padding: 22,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#DDE6DD',
  },
  cardTitle: { fontSize: 19, fontWeight: '800', color: '#183C24' },
  cardText: { marginTop: 6, marginBottom: 20, lineHeight: 21, color: '#657269' },
  configurationNote: { marginTop: 14, fontSize: 12, lineHeight: 18, color: '#A16B28', textAlign: 'center' },
  footer: { paddingBottom: 18, textAlign: 'center', fontWeight: '700', color: '#6D806F' },
});
