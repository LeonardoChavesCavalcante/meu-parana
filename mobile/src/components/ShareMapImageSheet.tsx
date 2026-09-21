import { useEffect, useRef, useState } from 'react';
import * as Sharing from 'expo-sharing';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MunicipalityFeatureCollection } from '../types';
import { ParanaMap } from './ParanaMap';

type Props = {
  visible: boolean;
  map: MunicipalityFeatureCollection | null;
  cityNamesById: Map<string, string>;
  visitedCityIds: Set<string>;
  visitedCount: number;
  totalCities: number;
  mapOwnerName?: string;
  onClose: () => void;
};

async function shareOnWeb(dataUri: string) {
  const blob = await (await fetch(dataUri)).blob();
  const file = new File([blob], 'meu-parana.png', { type: 'image/png' });
  const shareData = {
    title: 'Meu mapa do Paraná',
    text: 'Estas são as cidades do Paraná que já visitei!',
    files: [file],
  };

  if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
    await navigator.share(shareData);
    return 'Imagem compartilhada.';
  }

  const link = document.createElement('a');
  link.href = dataUri;
  link.download = 'meu-parana.png';
  link.click();
  return 'O navegador baixou a imagem. Agora você pode publicá-la na rede social.';
}

export function ShareMapImageSheet({
  visible,
  map,
  cityNamesById,
  visitedCityIds,
  visitedCount,
  totalCities,
  mapOwnerName,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const imageRef = useRef<ViewShotRef>(null);
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState('');
  const progress = totalCities ? Math.round((visitedCount / totalCities) * 100) : 0;

  useEffect(() => {
    if (visible) setMessage('');
  }, [visible]);

  const captureAndShare = async () => {
    if (!imageRef.current || !map) return;
    setSharing(true);
    setMessage('');
    try {
      const uri = await imageRef.current.capture();
      if (Platform.OS === 'web') {
        setMessage(await shareOnWeb(uri));
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          dialogTitle: 'Compartilhar meu mapa do Paraná',
          mimeType: 'image/png',
          UTI: 'public.png',
        });
      } else {
        setMessage('O compartilhamento de imagens não está disponível neste aparelho.');
      }
    } catch (reason) {
      const cancelled = reason instanceof Error && /cancel|abort/i.test(reason.message);
      if (!cancelled) setMessage('Não foi possível gerar a imagem. Tente novamente.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable accessibilityLabel="Fechar imagem compartilhável" onPress={onClose} style={styles.backdrop} />
      <View style={[styles.sheet, { bottom: Math.max(insets.bottom, 8), paddingBottom: 22 }]}>
        <View style={styles.handle} />
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.title}>Compartilhar nas redes sociais</Text>
            <Text style={styles.subtitle}>Publique suas cidades visitadas no Instagram, Facebook ou WhatsApp.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>×</Text>
          </Pressable>
        </View>

        <View style={styles.previewFrame}>
          <ViewShot
            ref={imageRef}
            options={{
              format: 'png',
              quality: 1,
              result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile',
            }}
            style={styles.card}
          >
            <View collapsable={false} style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <Text style={styles.brand}>MEU PARANÁ</Text>
                <Text style={styles.cardTitle}>
                  {mapOwnerName ? `Mapa de ${mapOwnerName}` : 'Minhas cidades visitadas'}
                </Text>
                <View style={styles.statsRow}>
                  <Text style={styles.statStrong}>{visitedCount}</Text>
                  <Text style={styles.statText}> de {totalCities || 399} cidades</Text>
                  <Text style={styles.percent}>{progress}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
              </View>

              <View style={styles.mapArea}>
                {map ? (
                  <ParanaMap
                    displayOnly
                    showLabels={false}
                    map={map}
                    cityNamesById={cityNamesById}
                    visitedCityIds={visitedCityIds}
                    onSelectCity={() => {}}
                  />
                ) : null}
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, styles.visitedDot]} />
                  <Text style={styles.legendText}>Visitada</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={styles.legendDot} />
                  <Text style={styles.legendText}>Quero conhecer</Text>
                </View>
                <Text style={styles.footerBrand}>Meu Paraná</Text>
              </View>
            </View>
          </ViewShot>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={sharing || !map}
          onPress={() => void captureAndShare()}
          style={[styles.shareButton, (sharing || !map) && styles.disabled]}
        >
          {sharing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.shareButtonText}>Compartilhar nas redes sociais</Text>}
        </Pressable>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(13, 31, 19, 0.38)' },
  sheet: { position: 'absolute', left: 0, right: 0, maxHeight: '92%', paddingHorizontal: 20, paddingTop: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#FBFCF8' },
  handle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: '#C7D1C7', marginBottom: 15 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headingCopy: { flex: 1 },
  title: { fontSize: 23, fontWeight: '800', color: '#15351F' },
  subtitle: { marginTop: 3, color: '#637066', lineHeight: 19 },
  close: { fontSize: 32, lineHeight: 32, color: '#617064', fontWeight: '300' },
  previewFrame: { width: '100%', maxWidth: 430, alignSelf: 'center', marginTop: 15, padding: 7, borderRadius: 21, backgroundColor: '#D8E4D8' },
  card: { width: '100%', aspectRatio: 0.8, borderRadius: 15, overflow: 'hidden', backgroundColor: '#F8FAF5' },
  cardContent: { flex: 1, backgroundColor: '#F8FAF5' },
  cardHeader: { paddingHorizontal: 17, paddingTop: 15, paddingBottom: 11, backgroundColor: '#F8FAF5' },
  brand: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: '#2C8456' },
  cardTitle: { marginTop: 2, fontSize: 19, fontWeight: '900', color: '#15351F' },
  statsRow: { marginTop: 8, flexDirection: 'row', alignItems: 'baseline' },
  statStrong: { fontSize: 18, fontWeight: '900', color: '#1E6A42' },
  statText: { fontSize: 12, fontWeight: '600', color: '#5D6E61' },
  percent: { marginLeft: 'auto', color: '#1E6A42', fontWeight: '900' },
  progressTrack: { height: 5, marginTop: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: '#DCE7DD' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#38A169' },
  mapArea: { flex: 1, minHeight: 250, backgroundColor: '#DCE9ED' },
  cardFooter: { minHeight: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8FAF5' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 4, backgroundColor: '#F1E7C8', borderWidth: 1, borderColor: '#66806B' },
  visitedDot: { backgroundColor: '#38A169', borderColor: '#1E6A42' },
  legendText: { fontSize: 9, fontWeight: '700', color: '#4F6254' },
  footerBrand: { marginLeft: 'auto', fontSize: 9, fontWeight: '900', color: '#6A786D' },
  shareButton: { minHeight: 52, width: '100%', maxWidth: 430, alignSelf: 'center', marginTop: 13, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E6A42' },
  shareButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  message: { marginTop: 10, textAlign: 'center', color: '#5E6A60', fontWeight: '700' },
});
