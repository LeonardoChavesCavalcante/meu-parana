import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MapShare } from '../types';

type Props = {
  visible: boolean;
  activeShare: MapShare | null;
  importedMaps: MapShare[];
  ownMapName: string;
  onClose: () => void;
  onSelectOwnMap: () => void;
  onSelectImportedMap: (share: MapShare) => void;
};

export function MapPickerSheet({
  visible,
  activeShare,
  importedMaps,
  ownMapName,
  onClose,
  onSelectOwnMap,
  onSelectImportedMap,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable accessibilityLabel="Fechar seleção de mapa" onPress={onClose} style={styles.backdrop} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 22 }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Seus mapas</Text>
        <Text style={styles.subtitle}>Escolha o mapa que deseja visualizar.</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Pressable
            accessibilityRole="button"
            onPress={onSelectOwnMap}
            style={[styles.mapRow, !activeShare && styles.mapRowSelected]}
          >
            <View style={styles.mapCopy}>
              <Text style={styles.mapName}>{ownMapName}</Text>
              <Text style={styles.mapOwner}>Seu mapa</Text>
            </View>
            {!activeShare ? <Text style={styles.selected}>✓</Text> : null}
          </Pressable>
          {importedMaps.map((share) => {
            const selected = activeShare?.code === share.code;
            return (
              <Pressable
                accessibilityRole="button"
                key={share.code}
                onPress={() => onSelectImportedMap(share)}
                style={[styles.mapRow, selected && styles.mapRowSelected]}
              >
                <View style={styles.mapCopy}>
                  <Text style={styles.mapName}>{share.mapName}</Text>
                  <Text style={styles.mapOwner}>{share.ownerName}</Text>
                </View>
                {selected ? <Text style={styles.selected}>✓</Text> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(13,31,19,0.28)' },
  sheet: { position: 'absolute', right: 0, bottom: 0, left: 0, maxHeight: '75%', paddingHorizontal: 22, paddingTop: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#FBFCF8' },
  handle: { alignSelf: 'center', width: 42, height: 5, marginBottom: 17, borderRadius: 3, backgroundColor: '#C7D1C7' },
  title: { color: '#15351F', fontSize: 22, fontWeight: '900' },
  subtitle: { marginTop: 3, marginBottom: 12, color: '#617064' },
  mapRow: { minHeight: 67, flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#D5DED5', borderRadius: 15, backgroundColor: '#FFFFFF' },
  mapRowSelected: { borderColor: '#1E6A42', backgroundColor: '#E8F3EA' },
  mapCopy: { flex: 1 },
  mapName: { color: '#25452E', fontSize: 15, fontWeight: '800' },
  mapOwner: { marginTop: 3, color: '#68776B', fontSize: 12 },
  selected: { color: '#1E6A42', fontSize: 20, fontWeight: '900' },
});
