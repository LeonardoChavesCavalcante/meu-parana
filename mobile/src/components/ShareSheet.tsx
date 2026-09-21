import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
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
  visible: boolean;
  ownedShare: MapShare | null;
  activeShare: MapShare | null;
  busy: boolean;
  message: string;
  onClose: () => void;
  onSaveOwnedShare: (permission: SharePermission) => void;
  onStopOwnedShare: () => void;
  onOpenSharedMap: (codeOrLink: string) => void;
  onLeaveSharedMap: () => void;
};

function shareLink(code: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${window.location.pathname}?share=${code}`;
  }
  return `meuparana://share?share=${code}`;
}

export function ShareSheet({
  visible,
  ownedShare,
  activeShare,
  busy,
  message,
  onClose,
  onSaveOwnedShare,
  onStopOwnedShare,
  onOpenSharedMap,
  onLeaveSharedMap,
}: Props) {
  const insets = useSafeAreaInsets();
  const [permission, setPermission] = useState<SharePermission>('read');
  const [codeInput, setCodeInput] = useState('');
  const [confirmingStop, setConfirmingStop] = useState(false);

  useEffect(() => {
    if (ownedShare) setPermission(ownedShare.permission);
    setConfirmingStop(false);
  }, [ownedShare]);

  const link = ownedShare ? shareLink(ownedShare.code) : '';

  const share = async () => {
    if (!ownedShare) return;
    const access = ownedShare.permission === 'edit' ? 'pode visualizar e alterar' : 'pode apenas visualizar';
    await Share.share({
      title: 'Meu mapa do Paraná',
      message: `Veja meu mapa do Paraná. Este compartilhamento ${access}.\nCódigo: ${ownedShare.code}\n${link}`,
      url: link,
    });
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable accessibilityLabel="Fechar compartilhamento" onPress={onClose} style={styles.backdrop} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.handle} />
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.title}>Compartilhar mapa</Text>
            <Text style={styles.subtitle}>Controle quem pode visualizar ou alterar suas visitas.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>×</Text>
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {activeShare ? (
            <View style={styles.activeBox}>
              <Text style={styles.sectionLabel}>Mapa aberto</Text>
              <Text style={styles.activeTitle}>Mapa de {activeShare.ownerName}</Text>
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

          <Text style={styles.sectionLabel}>Compartilhar meu mapa</Text>
          <Text style={styles.fieldLabel}>Permissão do convite</Text>
          <View style={styles.permissionRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setPermission('read')}
              style={[styles.permission, permission === 'read' && styles.permissionSelected]}
            >
              <Text style={[styles.permissionTitle, permission === 'read' && styles.permissionTitleSelected]}>Somente leitura</Text>
              <Text style={styles.permissionText}>Pode ver cidades, datas e informações.</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setPermission('edit')}
              style={[styles.permission, permission === 'edit' && styles.permissionSelected]}
            >
              <Text style={[styles.permissionTitle, permission === 'edit' && styles.permissionTitleSelected]}>Permitir alterações</Text>
              <Text style={styles.permissionText}>Também pode registrar e editar visitas.</Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => onSaveOwnedShare(permission)}
            style={styles.primaryButton}
          >
            {busy ? <ActivityIndicator color="#FFFFFF" /> : (
              <Text style={styles.primaryButtonText}>{ownedShare ? 'Atualizar permissão' : 'Criar convite'}</Text>
            )}
          </Pressable>

          {ownedShare ? (
            <View style={styles.inviteBox}>
              <Text style={styles.fieldLabel}>Código</Text>
              <TextInput editable={false} selectTextOnFocus style={styles.code} value={ownedShare.code} />
              <Text style={styles.fieldLabel}>Link</Text>
              <TextInput editable={false} selectTextOnFocus style={styles.link} value={link} />
              <Pressable accessibilityRole="button" onPress={() => void share()} style={styles.shareButton}>
                <Text style={styles.shareButtonText}>Compartilhar link</Text>
              </Pressable>
              {confirmingStop ? (
                <View style={styles.stopConfirmBox}>
                  <Text style={styles.stopConfirmText}>O código e o link deixarão de funcionar imediatamente.</Text>
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

          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Abrir mapa compartilhado</Text>
          <Text style={styles.helper}>Cole o código ou o link recebido de outro usuário.</Text>
          <TextInput
            accessibilityLabel="Código ou link compartilhado"
            autoCapitalize="characters"
            autoCorrect={false}
            onChangeText={setCodeInput}
            placeholder="Código ou link"
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
  primaryButton: { minHeight: 50, marginTop: 13, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E6A42' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  inviteBox: { marginTop: 12, padding: 14, borderRadius: 16, backgroundColor: '#EEF4EC' },
  code: { minHeight: 43, paddingHorizontal: 12, borderRadius: 11, backgroundColor: '#FFFFFF', color: '#15351F', fontSize: 18, fontWeight: '900', letterSpacing: 1.8, textAlign: 'center' },
  link: { minHeight: 43, paddingHorizontal: 12, borderRadius: 11, backgroundColor: '#FFFFFF', color: '#425348', fontSize: 12 },
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
