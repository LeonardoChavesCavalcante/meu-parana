import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MapShare, SharePermission } from '../types';

type Props = {
  mode: 'share' | 'import';
  visible: boolean;
  ownedShare: MapShare | null;
  activeShare: MapShare | null;
  busy: boolean;
  message: string;
  onClose: () => void;
  suggestedMapName: string;
  onSaveOwnedShare: (permission: SharePermission, mapName: string) => void;
  onStopOwnedShare: () => void;
  onOpenSharedMap: (code: string) => void;
  onLeaveSharedMap: () => void;
};

export function ShareSheet({
  mode,
  visible,
  ownedShare,
  activeShare,
  busy,
  message,
  onClose,
  suggestedMapName,
  onSaveOwnedShare,
  onStopOwnedShare,
  onOpenSharedMap,
  onLeaveSharedMap,
}: Props) {
  const insets = useSafeAreaInsets();
  const [permission, setPermission] = useState<SharePermission>('read');
  const [mapName, setMapName] = useState(suggestedMapName);
  const [codeInput, setCodeInput] = useState('');
  const [confirmingStop, setConfirmingStop] = useState(false);

  useEffect(() => {
    if (ownedShare) setPermission(ownedShare.permission);
    setMapName(ownedShare?.mapName || suggestedMapName);
    setConfirmingStop(false);
  }, [ownedShare, suggestedMapName]);

  const shareCode = async () => {
    if (!ownedShare) return;
    const access = ownedShare.permission === 'edit' ? 'pode visualizar e alterar' : 'pode apenas visualizar';
    await Share.share({
      title: ownedShare.mapName,
      message: `Veja ${ownedShare.mapName}. Este compartilhamento ${access}.\nCódigo de compartilhamento: ${ownedShare.code}`,
    });
  };

  const selectPermission = (nextPermission: SharePermission) => {
    setPermission(nextPermission);
    onSaveOwnedShare(nextPermission, mapName.trim() || suggestedMapName);
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable accessibilityLabel="Fechar compartilhamento" onPress={onClose} style={styles.backdrop} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.handle} />
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.title}>{mode === 'share' ? 'Compartilhar mapa' : 'Importar mapa'}</Text>
            <Text style={styles.subtitle}>{mode === 'share' ? 'Controle quem pode visualizar ou alterar suas visitas.' : 'Digite o código recebido de outro usuário.'}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>×</Text>
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {mode === 'share' && activeShare ? (
            <View style={styles.activeBox}>
              <Text style={styles.sectionLabel}>Mapa aberto</Text>
              <Text style={styles.activeTitle}>{activeShare.mapName}</Text>
              <Text style={styles.helper}>
                {activeShare.permission === 'edit'
                  ? 'Você pode visualizar e alterar este mapa.'
                  : 'Este mapa está disponível somente para leitura.'}
              </Text>
              <Pressable accessibilityRole="button" onPress={onLeaveSharedMap} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Voltar ao meu mapa</Text>
              </Pressable>
            </View>
          ) : null}

          {mode === 'share' ? <>
            <Text style={styles.fieldLabel}>Nome do mapa</Text>
            <TextInput
              accessibilityLabel="Nome do mapa"
              maxLength={100}
              onChangeText={setMapName}
              placeholder={suggestedMapName}
              style={styles.input}
              value={mapName}
            />
            <Text style={styles.fieldLabel}>Permissão do convite</Text>
          <View style={styles.permissionRow}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => selectPermission('read')}
              style={[styles.permission, permission === 'read' && styles.permissionSelected]}
            >
              <Text style={[styles.permissionTitle, permission === 'read' && styles.permissionTitleSelected]}>Somente leitura</Text>
              <Text style={styles.permissionText}>Pode ver cidades, datas e informações.</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => selectPermission('edit')}
              style={[styles.permission, permission === 'edit' && styles.permissionSelected]}
            >
              <Text style={[styles.permissionTitle, permission === 'edit' && styles.permissionTitleSelected]}>Permitir alterações</Text>
              <Text style={styles.permissionText}>Também pode registrar e editar visitas.</Text>
            </Pressable>
          </View>

          {ownedShare ? (
            <View style={styles.inviteBox}>
              <Text style={styles.fieldLabel}>Código de compartilhamento</Text>
              <TextInput editable={false} selectTextOnFocus style={styles.code} value={ownedShare.code} />
              <Pressable accessibilityRole="button" onPress={() => void shareCode()} style={styles.shareButton}>
                <Text style={styles.shareButtonText}>Compartilhar código</Text>
              </Pressable>
              {confirmingStop ? (
                <View style={styles.stopConfirmBox}>
                  <Text style={styles.stopConfirmText}>O código deixará de funcionar imediatamente.</Text>
                  <View style={styles.stopConfirmActions}>
                    <Pressable accessibilityRole="button" onPress={() => setConfirmingStop(false)} style={styles.stopChoice}>
                      <Text style={styles.secondaryButtonText}>Cancelar</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={onStopOwnedShare} style={[styles.stopChoice, styles.stopChoiceDanger]}>
                      <Text style={styles.stopChoiceDangerText}>Encerrar agora</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable accessibilityRole="button" onPress={() => setConfirmingStop(true)} style={styles.stopButton}>
                  <Text style={styles.stopButtonText}>Encerrar compartilhamento</Text>
                </Pressable>
              )}
            </View>
          ) : null}
          </> : null}

          {mode === 'import' ? <>
            <Text style={styles.sectionLabel}>Código de compartilhamento</Text>
            <TextInput
              accessibilityLabel="Código de compartilhamento"
              autoCapitalize="characters"
              autoCorrect={false}
              onChangeText={setCodeInput}
              placeholder="Código de compartilhamento"
              style={styles.input}
              value={codeInput}
            />
            <Pressable
              accessibilityRole="button"
              disabled={busy || !codeInput.trim()}
              onPress={() => onOpenSharedMap(codeInput)}
              style={[styles.secondaryButton, (!codeInput.trim() || busy) && styles.disabled]}
            >
              <Text style={styles.secondaryButtonText}>Abrir mapa</Text>
            </Pressable>
          </> : null}

          {message ? <Text style={styles.message}>{message}</Text> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(13, 31, 19, 0.34)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '90%', paddingHorizontal: 22, paddingTop: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#FBFCF8' },
  handle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: '#C7D1C7', marginBottom: 17 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 6 },
  headingCopy: { flex: 1 },
  title: { fontSize: 23, fontWeight: '800', color: '#15351F' },
  subtitle: { marginTop: 3, color: '#637066', lineHeight: 19 },
  close: { fontSize: 32, lineHeight: 32, color: '#617064', fontWeight: '300' },
  sectionLabel: { marginTop: 20, marginBottom: 8, fontSize: 12, fontWeight: '900', color: '#2C8456', textTransform: 'uppercase', letterSpacing: 0.7 },
  fieldLabel: { marginTop: 9, marginBottom: 6, fontSize: 13, fontWeight: '800', color: '#415447' },
  permissionRow: { flexDirection: 'row', gap: 9 },
  permission: { flex: 1, minHeight: 91, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#CED8CE', backgroundColor: '#F6F8F4' },
  permissionSelected: { borderColor: '#1E6A42', backgroundColor: '#E8F3EA' },
  permissionTitle: { fontSize: 13, fontWeight: '800', color: '#46564A' },
  permissionTitleSelected: { color: '#1E6A42' },
  permissionText: { marginTop: 5, fontSize: 11, lineHeight: 15, color: '#68736A' },
  inviteBox: { marginTop: 12, padding: 14, borderRadius: 16, backgroundColor: '#EEF4EC' },
  code: { minHeight: 43, paddingHorizontal: 12, borderRadius: 11, backgroundColor: '#FFFFFF', color: '#15351F', fontSize: 18, fontWeight: '900', letterSpacing: 1.8, textAlign: 'center' },
  shareButton: { minHeight: 44, marginTop: 11, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DCEBDF' },
  shareButtonText: { color: '#1E6A42', fontWeight: '800' },
  stopButton: { minHeight: 39, marginTop: 3, alignItems: 'center', justifyContent: 'center' },
  stopButtonText: { color: '#A14940', fontWeight: '700' },
  stopConfirmBox: { marginTop: 8, padding: 11, borderRadius: 12, backgroundColor: '#FFF1EE' },
  stopConfirmText: { color: '#7C4841', fontSize: 12, lineHeight: 17, textAlign: 'center' },
  stopConfirmActions: { marginTop: 8, flexDirection: 'row', gap: 8 },
  stopChoice: { minHeight: 39, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#E7EFE8' },
  stopChoiceDanger: { backgroundColor: '#A5493F' },
  stopChoiceDangerText: { color: '#FFFFFF', fontWeight: '800' },
  divider: { height: 1, marginTop: 22, backgroundColor: '#DDE4DC' },
  helper: { color: '#647067', lineHeight: 19 },
  input: { minHeight: 48, marginTop: 10, paddingHorizontal: 13, borderWidth: 1, borderColor: '#C8D2C8', borderRadius: 12, backgroundColor: '#FFFFFF', color: '#203D29' },
  secondaryButton: { minHeight: 46, marginTop: 10, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E5EFE7', borderWidth: 1, borderColor: '#B9D0BE' },
  secondaryButtonText: { color: '#1E6A42', fontWeight: '800' },
  disabled: { opacity: 0.48 },
  activeBox: { marginTop: 10, padding: 14, borderRadius: 16, backgroundColor: '#EDF5F8', borderWidth: 1, borderColor: '#C9DEE6' },
  activeTitle: { fontSize: 17, fontWeight: '800', color: '#28576A' },
  message: { marginTop: 12, textAlign: 'center', color: '#805127', fontWeight: '700' },
});
