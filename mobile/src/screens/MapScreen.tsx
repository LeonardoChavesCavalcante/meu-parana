import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { User } from 'firebase/auth';

import { CitySheet } from '../components/CitySheet';
import { ParanaMap } from '../components/ParanaMap';
import { ShareSheet } from '../components/ShareSheet';
import { ShareMapImageSheet } from '../components/ShareMapImageSheet';
import { useAuth } from '../context/AuthContext';
import { useMapData } from '../hooks/useMapData';
import {
  deleteCityVisit,
  getMapShare,
  saveCityVisit,
  saveMapShare,
  stopMapShare,
  subscribeToMapShare,
  subscribeToOwnedShare,
} from '../services/firestore';
import type { MapShare, SharePermission, Visit } from '../types';

export function MapScreen({ user }: { user: User }) {
  const { signOut } = useAuth();
  const [activeShare, setActiveShare] = useState<MapShare | null>(null);
  const [ownedShare, setOwnedShare] = useState<MapShare | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [imageShareOpen, setImageShareOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const visitOwnerId = activeShare?.ownerId || user.uid;
  const canEdit = !activeShare || activeShare.permission === 'edit';

  const { cities, citiesById, visits, municipalityMap, loading, error, retry } = useMapData(visitOwnerId);
  const [selectedCityId, setSelectedCityId] = useState<string>();
  const [showCityNames, setShowCityNames] = useState(false);
  const [saving, setSaving] = useState(false);
  const selectedCity = selectedCityId ? citiesById.get(selectedCityId) ?? null : null;
  const selectedVisit = selectedCityId ? visits.get(selectedCityId) : undefined;
  const visitedCityIds = useMemo(() => new Set(visits.keys()), [visits]);
  const cityNamesById = useMemo(
    () => new Map(cities.map((city) => [city.ibgeCode, city.name])),
    [cities],
  );
  const progress = cities.length ? Math.round((visits.size / cities.length) * 100) : 0;
  const initial = (user.displayName || user.email || 'V').charAt(0).toUpperCase();

  const saveVisit = async (visit: Pick<Visit, 'visitedDate' | 'userInfo'>) => {
    if (!selectedCity) return;

    setSaving(true);
    try {
      await saveCityVisit(visitOwnerId, selectedCity, visit);
    } catch {
      Alert.alert('Não foi possível salvar', 'Verifique sua conexão e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const removeVisit = async () => {
    if (!selectedCity) return;
    setSaving(true);
    try {
      await deleteCityVisit(visitOwnerId, selectedCity.ibgeCode);
    } catch {
      Alert.alert('Não foi possível remover', 'Verifique sua conexão e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const openSharedMap = useCallback(async (codeOrLink: string) => {
    setShareBusy(true);
    setShareMessage('');
    try {
      const share = await getMapShare(codeOrLink);
      if (share.ownerId === user.uid) {
        setActiveShare(null);
        setShareMessage('Este convite pertence ao seu próprio mapa.');
      } else {
        setSelectedCityId(undefined);
        setActiveShare(share);
        setShareMessage(`Mapa de ${share.ownerName} aberto.`);
      }
    } catch (reason) {
      setShareMessage(reason instanceof Error ? reason.message : 'Não foi possível abrir o compartilhamento.');
    } finally {
      setShareBusy(false);
    }
  }, [user.uid]);

  useEffect(
    () => subscribeToOwnedShare(user.uid, setOwnedShare, () => setOwnedShare(null)),
    [user.uid],
  );

  useEffect(() => {
    if (!activeShare) return undefined;
    return subscribeToMapShare(
      activeShare.code,
      (share) => {
        if (share) setActiveShare(share);
        else {
          setActiveShare(null);
          setShareMessage('O proprietário encerrou este compartilhamento.');
          setShareOpen(true);
        }
      },
      () => setShareMessage('Não foi possível atualizar a permissão do compartilhamento.'),
    );
  }, [activeShare?.code]);

  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url || !/[?&]share=/i.test(url)) return;
      setShareOpen(true);
      void openSharedMap(url);
    };
    void Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, [openSharedMap]);

  const saveOwnedShare = async (permission: SharePermission) => {
    setShareBusy(true);
    setShareMessage('');
    try {
      await saveMapShare(user, permission, ownedShare?.code);
      setShareMessage(ownedShare ? 'Permissão atualizada.' : 'Convite criado. Agora compartilhe o código ou link.');
    } catch (reason) {
      setShareMessage(
        reason instanceof Error
          ? `Não foi possível salvar: ${reason.message}`
          : 'Não foi possível salvar o compartilhamento.',
      );
    } finally {
      setShareBusy(false);
    }
  };

  const stopOwnedSharing = async () => {
    if (!ownedShare) return;
    setShareBusy(true);
    try {
      await stopMapShare(user.uid, ownedShare.code);
      setShareMessage('Compartilhamento encerrado. O link anterior não funciona mais.');
    } catch {
      setShareMessage('Não foi possível encerrar o compartilhamento.');
    } finally {
      setShareBusy(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert('Sair do Meu Parana?', 'Seus registros continuarão salvos na sua conta.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <View style={styles.container}>
      {municipalityMap ? (
        <ParanaMap
          map={municipalityMap}
          cityNamesById={cityNamesById}
          visitedCityIds={visitedCityIds}
          selectedCityId={selectedCityId}
          showLabels={showCityNames}
          onSelectCity={setSelectedCityId}
        />
      ) : (
        <View style={styles.mapPlaceholder} />
      )}

      <SafeAreaView edges={['top']} style={styles.topArea}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>MEU PARANA</Text>
            <Text style={styles.heading}>
              {activeShare ? `Mapa de ${activeShare.ownerName}` : 'Seu mapa de viagens'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityLabel={showCityNames ? 'Ocultar nomes das cidades' : 'Mostrar nomes das cidades'}
              accessibilityRole="button"
              onPress={() => setShowCityNames((current) => !current)}
              style={[styles.namesButton, showCityNames && styles.namesButtonActive]}
            >
              <Text style={[styles.namesButtonText, showCityNames && styles.namesButtonTextActive]}>Aa</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Compartilhar ou abrir mapa"
              accessibilityRole="button"
              onPress={() => {
                setShareMessage('');
                setShareOpen(true);
              }}
              style={styles.shareHeaderButton}
            >
              <Text style={styles.shareHeaderIcon}>↗</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Opções da conta"
              accessibilityRole="button"
              onPress={confirmSignOut}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>{initial}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressCopy}>
            <Text style={styles.progressStrong}>{visits.size}</Text>
            <Text style={styles.progressText}> de {cities.length || 399} cidades</Text>
          </View>
          <Text style={styles.progressPercent}>{progress}%</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
        {activeShare ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setShareOpen(true)}
            style={styles.sharedBanner}
          >
            <Text style={styles.sharedBannerText}>
              {activeShare.permission === 'edit' ? 'Alterações permitidas' : 'Somente leitura'} · toque para gerenciar
            </Text>
          </Pressable>
        ) : null}
      </SafeAreaView>

      {loading ? (
        <View style={styles.statusCard}>
          <ActivityIndicator color="#1E6A42" />
          <Text style={styles.statusText}>Preparando os 399 municípios…</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorCard}>
          <Text numberOfLines={2} style={styles.errorText}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={retry}>
            <Text style={styles.retry}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && !error && cities.length === 0 ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>A base de cidades está vazia. Execute o seed do Firestore.</Text>
        </View>
      ) : null}

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.visitedDot]} />
          <Text style={styles.legendText}>Visitada</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendDot} />
          <Text style={styles.legendText}>Quero conhecer</Text>
        </View>
      </View>

      <CitySheet
        city={selectedCity}
        visit={selectedVisit}
        saving={saving}
        editable={canEdit}
        onClose={() => setSelectedCityId(undefined)}
        onSaveVisit={saveVisit}
        onRemoveVisit={removeVisit}
      />
      <ShareSheet
        visible={shareOpen}
        ownedShare={ownedShare}
        activeShare={activeShare}
        busy={shareBusy}
        message={shareMessage}
        onClose={() => setShareOpen(false)}
        onSaveOwnedShare={(permission) => void saveOwnedShare(permission)}
        onStopOwnedShare={() => void stopOwnedSharing()}
        onOpenSharedMap={(value) => void openSharedMap(value)}
        onLeaveSharedMap={() => {
          setSelectedCityId(undefined);
          setActiveShare(null);
          setShareMessage('Você voltou ao seu mapa.');
        }}
        onOpenImageShare={() => {
          setShareOpen(false);
          setTimeout(() => setImageShareOpen(true), 350);
        }}
      />
      <ShareMapImageSheet
        visible={imageShareOpen}
        map={municipalityMap}
        cityNamesById={cityNamesById}
        visitedCityIds={visitedCityIds}
        visitedCount={visits.size}
        totalCities={cities.length || 399}
        mapOwnerName={activeShare?.ownerName}
        onClose={() => setImageShareOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#DCE9ED' },
  mapPlaceholder: { flex: 1, backgroundColor: '#DCE9ED' },
  topArea: { position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'box-none' },
  header: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(250, 252, 247, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 7px 18px rgba(23, 53, 31, 0.13)',
    elevation: 5,
  },
  eyebrow: { fontSize: 11, fontWeight: '900', color: '#2C8456', letterSpacing: 1.5 },
  heading: { marginTop: 2, fontSize: 19, fontWeight: '800', color: '#15351F' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  namesButton: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1E7C8' },
  namesButtonActive: { backgroundColor: '#1E6A42' },
  namesButtonText: { color: '#5E542F', fontSize: 15, fontWeight: '900' },
  namesButtonTextActive: { color: '#FFFFFF' },
  shareHeaderButton: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E5EFE7' },
  shareHeaderIcon: { color: '#1E6A42', fontSize: 24, fontWeight: '800', lineHeight: 25 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E6A42',
  },
  avatarText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  progressCard: {
    marginHorizontal: 26,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 17,
    backgroundColor: 'rgba(250, 252, 247, 0.94)',
  },
  progressCopy: { flexDirection: 'row', alignItems: 'baseline' },
  progressStrong: { fontSize: 18, fontWeight: '900', color: '#1E6A42' },
  progressText: { fontSize: 13, fontWeight: '600', color: '#5D6E61' },
  progressPercent: { position: 'absolute', right: 16, top: 12, fontWeight: '800', color: '#1E6A42' },
  progressTrack: { height: 5, borderRadius: 3, marginTop: 8, overflow: 'hidden', backgroundColor: '#DCE7DD' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#38A169' },
  sharedBanner: { alignSelf: 'center', marginTop: 7, minHeight: 34, paddingHorizontal: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(37, 93, 111, 0.92)' },
  sharedBannerText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  statusCard: {
    position: 'absolute',
    top: '47%',
    alignSelf: 'center',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  statusText: { color: '#334B39', fontWeight: '700' },
  errorCard: {
    position: 'absolute',
    top: '43%',
    left: 24,
    right: 24,
    borderRadius: 18,
    padding: 18,
    backgroundColor: '#FFF9F0',
    borderWidth: 1,
    borderColor: '#EBCFA9',
  },
  errorText: { textAlign: 'center', color: '#784C20', lineHeight: 20 },
  retry: { marginTop: 10, textAlign: 'center', color: '#1E6A42', fontWeight: '800' },
  legend: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 26,
    minHeight: 48,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    backgroundColor: 'rgba(250, 252, 247, 0.94)',
    pointerEvents: 'none',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendDot: { width: 13, height: 13, borderRadius: 5, backgroundColor: '#F1E7C8', borderWidth: 1, borderColor: '#66806B' },
  visitedDot: { backgroundColor: '#38A169', borderColor: '#1E6A42' },
  legendText: { fontSize: 12, fontWeight: '700', color: '#4F6254' },
});
