import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  showLabels: boolean;
  onChangeShowLabels: (show: boolean) => void;
  onOpenMapShare: () => void;
  onOpenMapImport: () => void;
  onClose: () => void;
};

export function MapSettingsSheet({
  visible,
  showLabels,
  onChangeShowLabels,
  onOpenMapShare,
  onOpenMapImport,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable accessibilityLabel="Fechar configurações" onPress={onClose} style={styles.backdrop} />
      <View style={styles.area} pointerEvents="box-none">
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 22 }]}>
          <View style={styles.handle} />
          <View style={styles.headingRow}>
            <View style={styles.headingCopy}>
              <Text style={styles.title}>Configurações</Text>
              <Text style={styles.subtitle}>Personalize a visualização e gerencie o compartilhamento do mapa.</Text>
            </View>
            <Pressable accessibilityRole="button" hitSlop={12} onPress={onClose}>
              <Text style={styles.close}>×</Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: showLabels }}
            onPress={() => onChangeShowLabels(!showLabels)}
            style={styles.toggleRow}
          >
            <View style={styles.toggleCopy}>
              <Text style={styles.optionLabel}>Exibir nomes das cidades</Text>
              <Text style={styles.optionDescription}>Os nomes aumentam conforme o zoom.</Text>
            </View>
            <View style={[styles.switchTrack, showLabels && styles.switchTrackActive]}>
              <View style={[styles.switchThumb, showLabels && styles.switchThumbActive]} />
            </View>
          </Pressable>

          <View style={styles.divider} />
          <Pressable accessibilityRole="button" onPress={onOpenMapShare} style={styles.shareOption}>
            <View style={styles.shareOptionIcon}><Text style={styles.shareOptionIconText}>↔</Text></View>
            <View style={styles.shareOptionCopy}>
              <Text style={styles.optionLabel}>Compartilhar meu mapa</Text>
              <Text style={styles.optionDescription}>Crie um código e defina a permissão de acesso.</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onOpenMapImport} style={styles.shareOption}>
            <View style={styles.shareOptionIcon}><Text style={styles.shareOptionIconText}>↓</Text></View>
            <View style={styles.shareOptionCopy}>
              <Text style={styles.optionLabel}>Importar mapa compartilhado</Text>
              <Text style={styles.optionDescription}>Abra um mapa usando o código recebido.</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(13,31,19,0.28)' },
  area: { flex: 1, justifyContent: 'flex-end' },
  sheet: { paddingHorizontal: 22, paddingTop: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#FBFCF8' },
  handle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: '#C7D1C7', marginBottom: 18 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headingCopy: { flex: 1 },
  title: { color: '#15351F', fontSize: 22, fontWeight: '900' },
  subtitle: { marginTop: 4, color: '#617064', fontSize: 13, lineHeight: 18 },
  close: { color: '#617064', fontSize: 32, lineHeight: 32, fontWeight: '300' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, paddingVertical: 15 },
  toggleCopy: { flex: 1, paddingRight: 12 },
  optionLabel: { color: '#25452E', fontSize: 15, fontWeight: '800' },
  optionDescription: { marginTop: 3, color: '#68776B', fontSize: 12, lineHeight: 17 },
  switchTrack: { width: 49, height: 29, borderRadius: 15, padding: 3, backgroundColor: '#C9D2CA' },
  switchTrackActive: { backgroundColor: '#1E6A42' },
  switchThumb: { width: 23, height: 23, borderRadius: 12, backgroundColor: '#FFFFFF' },
  switchThumbActive: { transform: [{ translateX: 20 }] },
  divider: { height: 1, marginVertical: 6, backgroundColor: '#DDE5DD' },
  shareOption: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  shareOptionIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E4EFE6' },
  shareOptionIconText: { color: '#1E6A42', fontSize: 21, fontWeight: '900' },
  shareOptionCopy: { flex: 1 },
  arrow: { color: '#718076', fontSize: 28, fontWeight: '300' },
});
