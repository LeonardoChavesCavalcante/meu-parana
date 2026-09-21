import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { City, Visit } from '../types';

type Props = {
  visible: boolean;
  cities: City[];
  visits: Map<string, Visit>;
  editable: boolean;
  onClose: () => void;
  onConfirmVisit: (cityId: string) => void;
  onRemoveVisit: (cityId: string) => void;
};

function searchable(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function formatVisitDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

export function CityListSheet({ visible, cities, visits, editable, onClose, onConfirmVisit, onRemoveVisit }: Props) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [expandedCityId, setExpandedCityId] = useState<string>();
  const listRef = useRef<FlatList<City>>(null);
  const scrollOffset = useRef(0);
  const filteredCities = useMemo(() => {
    const query = searchable(search.trim());
    if (!query) return cities;
    return cities.filter((city) => searchable(`${city.name} ${city.region}`).includes(query));
  }, [cities, search]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: scrollOffset.current, animated: false });
    }, 80);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <View style={styles.headingCopy}>
            <Text style={styles.title}>Cidades do Paraná</Text>
            <Text style={styles.subtitle}>{visits.size} visitadas de {cities.length || 399}</Text>
          </View>
          <Pressable accessibilityRole="button" hitSlop={12} onPress={onClose}>
            <Text style={styles.close}>×</Text>
          </Pressable>
        </View>
        <TextInput
          accessibilityLabel="Pesquisar cidade"
          autoCorrect={false}
          clearButtonMode="while-editing"
          onChangeText={setSearch}
          placeholder="Pesquisar cidade ou região"
          placeholderTextColor="#7B887E"
          returnKeyType="search"
          style={styles.search}
          value={search}
        />
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}><View style={[styles.dot, styles.visitedDot]} /><Text style={styles.summaryText}>Visitada</Text></View>
          <View style={styles.summaryItem}><View style={styles.dot} /><Text style={styles.summaryText}>Não visitada</Text></View>
          <Text style={styles.results}>{filteredCities.length} resultados</Text>
        </View>
        <FlatList
          ref={listRef}
          contentContainerStyle={styles.listContent}
          data={filteredCities}
          initialNumToRender={16}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(city) => city.ibgeCode}
          onScroll={(event) => { scrollOffset.current = event.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={100}
          renderItem={({ item }) => {
            const visit = visits.get(item.ibgeCode);
            const visited = Boolean(visit);
            const expanded = expandedCityId === item.ibgeCode;
            return (
              <View style={[styles.cityCard, visited && styles.cityCardVisited]}>
                <Pressable
                  accessibilityHint={expanded ? 'Recolhe as informações da cidade' : 'Expande as informações da cidade'}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  onPress={() => setExpandedCityId(expanded ? undefined : item.ibgeCode)}
                  style={({ pressed }) => [styles.cityRow, pressed && styles.pressed]}
                >
                  <View style={[styles.statusIcon, visited && styles.statusIconVisited]}>
                    <Text style={[styles.statusIconText, visited && styles.statusIconTextVisited]}>{visited ? '✓' : '○'}</Text>
                  </View>
                  <View style={styles.cityCopy}>
                    <Text style={styles.cityName}>{item.name}</Text>
                    <Text style={styles.region}>{item.region} · {visited ? 'Visitada' : 'Não visitada'}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={(event) => {
                      event.stopPropagation();
                      if (!editable) {
                        setExpandedCityId(expanded ? undefined : item.ibgeCode);
                        return;
                      }
                      if (!visited) {
                        onConfirmVisit(item.ibgeCode);
                        return;
                      }
                      Alert.alert('Desmarcar cidade?', `${item.name} deixará de aparecer como visitada.`, [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Desmarcar', style: 'destructive', onPress: () => onRemoveVisit(item.ibgeCode) },
                      ]);
                    }}
                    style={styles.actionButton}
                  >
                    <Text style={[styles.action, visited && styles.actionVisited]}>
                      {editable ? (visited ? 'Desmarcar' : 'Marcar') : 'Detalhes'}
                    </Text>
                  </Pressable>
                  <Text style={styles.chevron}>{expanded ? '⌃' : '⌄'}</Text>
                </Pressable>

                {expanded ? (
                  <View style={styles.details}>
                    <Text style={styles.detailLabel}>INFORMAÇÃO GERAL</Text>
                    <Text style={styles.detailText}>
                      {item.info || 'Ainda não há informações gerais sobre este município.'}
                    </Text>
                    {visit ? (
                      <>
                        <View style={styles.detailDivider} />
                        <Text style={styles.detailLabel}>DATA DA VISITA</Text>
                        <Text style={styles.detailText}>{formatVisitDate(visit.visitedDate)}</Text>
                        <Text style={[styles.detailLabel, styles.personalLabel]}>MINHA ANOTAÇÃO</Text>
                        <Text style={styles.detailText}>
                          {visit.userInfo || 'Nenhuma anotação pessoal adicionada.'}
                        </Text>
                        {editable ? (
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => onConfirmVisit(item.ibgeCode)}
                            style={styles.editButton}
                          >
                            <Text style={styles.editButtonText}>Editar visita</Text>
                          </Pressable>
                        ) : null}
                      </>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>Nenhuma cidade encontrada.</Text>}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 17, backgroundColor: '#F6F8F3' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 3, paddingVertical: 10 },
  headingCopy: { flex: 1 },
  title: { color: '#15351F', fontSize: 24, fontWeight: '900' },
  subtitle: { marginTop: 2, color: '#617064', fontSize: 13, fontWeight: '600' },
  close: { color: '#617064', fontSize: 34, lineHeight: 36, fontWeight: '300' },
  search: { height: 50, marginTop: 6, paddingHorizontal: 16, borderWidth: 1, borderColor: '#CED9CF', borderRadius: 16, color: '#173821', fontSize: 16, backgroundColor: '#FFFFFF' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 43, paddingHorizontal: 4 },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: '#77887B', backgroundColor: '#F1E7C8' },
  visitedDot: { borderColor: '#1E6A42', backgroundColor: '#38A169' },
  summaryText: { color: '#5D6B60', fontSize: 11, fontWeight: '700' },
  results: { flex: 1, color: '#718075', fontSize: 11, textAlign: 'right' },
  listContent: { paddingBottom: 18, gap: 8 },
  cityCard: { overflow: 'hidden', borderWidth: 1, borderColor: '#DEE5DE', borderRadius: 17, backgroundColor: '#FFFFFF' },
  cityCardVisited: { borderColor: '#A7CEB4', backgroundColor: '#EDF7F0' },
  cityRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 9, paddingVertical: 10 },
  pressed: { opacity: 0.72 },
  statusIcon: { width: 34, height: 34, marginRight: 11, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2E8C9' },
  statusIconVisited: { backgroundColor: '#31955E' },
  statusIconText: { color: '#766B47', fontSize: 20, fontWeight: '900' },
  statusIconTextVisited: { color: '#FFFFFF' },
  cityCopy: { flex: 1 },
  cityName: { color: '#183A23', fontSize: 16, fontWeight: '800' },
  region: { marginTop: 3, color: '#68776B', fontSize: 12 },
  action: { color: '#1E6A42', fontSize: 12, fontWeight: '900' },
  actionVisited: { color: '#A13F36' },
  actionButton: { minHeight: 36, paddingHorizontal: 8, justifyContent: 'center' },
  chevron: { width: 18, color: '#637369', fontSize: 16, textAlign: 'center' },
  details: { paddingHorizontal: 15, paddingTop: 13, paddingBottom: 15, borderTopWidth: 1, borderTopColor: '#D8E2D9', backgroundColor: 'rgba(255,255,255,0.72)' },
  detailLabel: { color: '#5D7664', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  detailText: { marginTop: 5, color: '#304D38', fontSize: 13, lineHeight: 19 },
  detailDivider: { height: 1, marginVertical: 13, backgroundColor: '#DCE5DD' },
  personalLabel: { marginTop: 13 },
  editButton: { alignSelf: 'flex-start', minHeight: 38, marginTop: 15, paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center', backgroundColor: '#E1EEE4' },
  editButtonText: { color: '#1E6A42', fontSize: 12, fontWeight: '900' },
  empty: { paddingVertical: 50, color: '#68776B', textAlign: 'center', fontSize: 15 },
});
