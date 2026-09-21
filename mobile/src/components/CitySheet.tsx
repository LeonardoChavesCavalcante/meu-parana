import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { City, Visit } from '../types';

type VisitForm = Pick<Visit, 'visitedDate' | 'userInfo'>;

type Props = {
  city: City | null;
  visit?: Visit;
  saving: boolean;
  editable: boolean;
  startEditing?: boolean;
  closeAfterSave?: boolean;
  onClose: () => void;
  onSaveVisit: (visit: VisitForm) => Promise<boolean>;
  onRemoveVisit: () => void;
};

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function isoToBrazilian(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

function brazilianToIso(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const candidate = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    candidate.getFullYear() !== Number(year)
    || candidate.getMonth() !== Number(month) - 1
    || candidate.getDate() !== Number(day)
  ) return null;
  return `${year}-${month}-${day}`;
}

function formatDateInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function CitySheet({
  city,
  visit,
  saving,
  editable,
  startEditing = false,
  closeAfterSave = false,
  onClose,
  onSaveVisit,
  onRemoveVisit,
}: Props) {
  const insets = useSafeAreaInsets();
  const visited = Boolean(visit);
  const [editing, setEditing] = useState(false);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [date, setDate] = useState('');
  const [userInfo, setUserInfo] = useState('');
  const [dateError, setDateError] = useState('');

  useEffect(() => {
    setEditing(startEditing && editable);
    setConfirmingRemoval(false);
    setDate(isoToBrazilian(visit?.visitedDate || todayIso()));
    setUserInfo(visit?.userInfo || '');
    setDateError('');
  }, [city?.ibgeCode, editable, startEditing, visit?.visitedDate, visit?.userInfo]);

  const close = () => {
    setEditing(false);
    setConfirmingRemoval(false);
    onClose();
  };

  const beginEditing = () => {
    setDate(isoToBrazilian(visit?.visitedDate || todayIso()));
    setUserInfo(visit?.userInfo || '');
    setDateError('');
    setEditing(true);
  };

  const submit = async () => {
    const visitedDate = brazilianToIso(date);
    if (!visitedDate) {
      setDateError('Informe uma data válida no formato DD/MM/AAAA.');
      return;
    }
    setDateError('');
    const saved = await onSaveVisit({ visitedDate, userInfo });
    if (!saved) return;
    if (closeAfterSave) close();
    else setEditing(false);
  };

  return (
    <Modal animationType="slide" transparent visible={Boolean(city)} onRequestClose={close}>
      <Pressable accessibilityLabel="Fechar detalhes" onPress={close} style={styles.backdrop} />
      {city ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardArea}
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 30, marginBottom: 8 }]}>
            <View style={styles.handle} />
            <View style={styles.headingRow}>
              <View style={[styles.statusDot, visited && styles.statusDotVisited]} />
              <View style={styles.headingCopy}>
                <Text style={styles.cityName}>{city.name}</Text>
                <Text style={styles.region}>{city.region} · Paraná</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={close} hitSlop={12}>
                <Text style={styles.close}>×</Text>
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>Informação geral</Text>
                <Text style={styles.infoText}>
                  {city.info || 'Ainda não há informações gerais sobre este município.'}
                </Text>
                <Text style={styles.readOnly}>Informação oficial · somente leitura</Text>
              </View>

              {visited && !editing ? (
                <>
                  <Text style={styles.visitedAt}>
                    Visitada{visit?.visitedDate ? ` em ${isoToBrazilian(visit.visitedDate)}` : ''}
                  </Text>
                  {visit?.userInfo ? (
                    <View style={[styles.infoBox, styles.personalInfoBox]}>
                      <Text style={[styles.infoLabel, styles.personalInfoLabel]}>Minha informação</Text>
                      <Text style={styles.infoText}>{visit.userInfo}</Text>
                    </View>
                  ) : null}
                </>
              ) : null}

              {!editable ? (
                <View style={styles.readOnlyBox}>
                  <Text style={styles.readOnlyText}>Este mapa foi compartilhado somente para leitura.</Text>
                </View>
              ) : editing ? (
                <View style={styles.formBox}>
                  <Text style={styles.formTitle}>{visited ? 'Editar minha visita' : 'Registrar visita'}</Text>
                  <Text style={styles.fieldLabel}>Data da visita</Text>
                  <TextInput
                    accessibilityLabel="Data da visita"
                    editable={!saving}
                    keyboardType="number-pad"
                    maxLength={10}
                    onChangeText={(value) => {
                      setDate(formatDateInput(value));
                      setDateError('');
                    }}
                    placeholder="DD/MM/AAAA"
                    style={[styles.input, dateError ? styles.inputError : null]}
                    value={date}
                  />
                  {dateError ? <Text style={styles.errorText}>{dateError}</Text> : null}

                  <Text style={styles.fieldLabel}>Minha informação sobre a cidade</Text>
                  <TextInput
                    accessibilityLabel="Minha informação sobre a cidade"
                    editable={!saving}
                    maxLength={2000}
                    multiline
                    onChangeText={setUserInfo}
                    placeholder="Ex.: lugares que conheci, com quem viajei, lembranças…"
                    style={[styles.input, styles.textArea]}
                    textAlignVertical="top"
                    value={userInfo}
                  />
                  <Text style={styles.counter}>{userInfo.length}/2000</Text>

                  <View style={styles.formActions}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={saving}
                      onPress={() => {
                        if (closeAfterSave) close();
                        else setEditing(false);
                      }}
                      style={({ pressed }) => [styles.formButton, pressed && styles.actionPressed]}
                    >
                      <Text style={styles.cancelText}>Cancelar</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={saving}
                      onPress={() => void submit()}
                      style={({ pressed }) => [styles.formButton, styles.saveButton, pressed && styles.actionPressed]}
                    >
                      {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Salvar visita</Text>}
                    </Pressable>
                  </View>
                </View>
              ) : confirmingRemoval ? (
                <View style={styles.removeBox}>
                  <Text style={styles.formTitle}>Remover visita?</Text>
                  <Text style={styles.removeText}>{city.name} deixará de aparecer como visitada.</Text>
                  <View style={styles.formActions}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={saving}
                      onPress={() => setConfirmingRemoval(false)}
                      style={({ pressed }) => [styles.formButton, pressed && styles.actionPressed]}
                    >
                      <Text style={styles.cancelText}>Cancelar</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={saving}
                      onPress={() => {
                        setConfirmingRemoval(false);
                        onRemoveVisit();
                      }}
                      style={({ pressed }) => [styles.formButton, styles.removeButton, pressed && styles.actionPressed]}
                    >
                      {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Remover</Text>}
                    </Pressable>
                  </View>
                </View>
              ) : visited ? (
                <View style={styles.visitActions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={saving}
                    onPress={beginEditing}
                    style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
                  >
                    <Text style={styles.actionText}>Editar minha visita</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={saving}
                    onPress={() => setConfirmingRemoval(true)}
                    style={({ pressed }) => [styles.removeLink, pressed && styles.actionPressed]}
                  >
                    <Text style={styles.removeLinkText}>Remover dos visitados</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={beginEditing}
                  style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
                >
                  <Text style={styles.actionText}>Marcar como visitada</Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(13, 31, 19, 0.28)' },
  keyboardArea: { flex: 1, justifyContent: 'flex-end', pointerEvents: 'box-none' },
  sheet: {
    maxHeight: '88%', paddingHorizontal: 22, paddingTop: 10,
    borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#FBFCF8',
  },
  handle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: '#C7D1C7', marginBottom: 18 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headingCopy: { flex: 1 },
  statusDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#F1E7C8', borderWidth: 2, borderColor: '#7A8A79' },
  statusDotVisited: { backgroundColor: '#38A169', borderColor: '#1E6A42' },
  cityName: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: '#15351F' },
  region: { marginTop: 2, fontSize: 14, color: '#617064' },
  close: { fontSize: 32, lineHeight: 32, color: '#617064', fontWeight: '300' },
  infoBox: { marginTop: 20, borderRadius: 16, padding: 16, backgroundColor: '#EEF4EC' },
  personalInfoBox: { marginTop: 12, backgroundColor: '#EDF5F8' },
  infoLabel: { fontSize: 12, fontWeight: '800', color: '#52705A', textTransform: 'uppercase' },
  personalInfoLabel: { color: '#397086' },
  infoText: { marginTop: 7, color: '#294331', lineHeight: 21 },
  readOnly: { marginTop: 9, fontSize: 11, color: '#77847A' },
  visitedAt: { marginTop: 14, textAlign: 'center', fontWeight: '700', color: '#2C8456' },
  formBox: { marginTop: 18, borderRadius: 17, padding: 16, backgroundColor: '#FFF8E9', borderWidth: 1, borderColor: '#E8D2A9' },
  formTitle: { fontSize: 17, fontWeight: '800', color: '#3B4B3E' },
  fieldLabel: { marginTop: 14, marginBottom: 6, fontSize: 13, fontWeight: '800', color: '#4E5D51' },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#C8D2C8', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10, backgroundColor: '#FFFFFF', color: '#203D29' },
  inputError: { borderColor: '#B54E43' },
  textArea: { minHeight: 96 },
  errorText: { marginTop: 5, color: '#A23F36', fontSize: 12 },
  counter: { marginTop: 4, textAlign: 'right', color: '#7A847B', fontSize: 11 },
  formActions: { marginTop: 15, flexDirection: 'row', gap: 10 },
  formButton: { minHeight: 44, flex: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF1EC' },
  saveButton: { backgroundColor: '#1E6A42' },
  cancelText: { color: '#3F5544', fontWeight: '800' },
  saveText: { color: '#FFFFFF', fontWeight: '800' },
  removeBox: { marginTop: 18, borderRadius: 17, padding: 16, backgroundColor: '#FFF1EE', borderWidth: 1, borderColor: '#E2B6AF' },
  removeText: { marginTop: 6, color: '#68514D', lineHeight: 20 },
  removeButton: { backgroundColor: '#A5493F' },
  visitActions: { marginTop: 18 },
  action: { minHeight: 54, marginTop: 18, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E6A42' },
  actionPressed: { opacity: 0.86 },
  actionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  removeLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  removeLinkText: { color: '#9C463D', fontWeight: '700' },
  readOnlyBox: { marginTop: 18, padding: 14, borderRadius: 14, backgroundColor: '#EDF5F8', borderWidth: 1, borderColor: '#C9DEE6' },
  readOnlyText: { textAlign: 'center', color: '#315F70', fontWeight: '700' },
});
