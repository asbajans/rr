import { useMemo, useState } from 'react'
import { Modal, View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { useI18n } from './i18n'

export type PickerOption = { id: string; name: string }

type Props = {
  visible: boolean
  title: string
  options: PickerOption[]
  onSelect: (opt: PickerOption | null) => void
  onClose: () => void
}

export default function SearchablePicker({ visible, title, options, onSelect, onClose }: Props) {
  const { t } = useI18n()
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return options
    return options.filter((o) => o.name.toLowerCase().includes(query))
  }, [options, q])

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.search}
            value={q}
            onChangeText={setQ}
            autoFocus
            placeholder={t('search')}
            placeholderTextColor="#999"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.clearBtn} onPress={() => { onSelect(null); onClose() }}>
            <Text style={styles.clearText}>{t('clear')}</Text>
          </TouchableOpacity>
          <FlatList
            data={filtered}
            keyExtractor={(o) => o.id}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.option} onPress={() => { onSelect(item); onClose() }}>
                <Text style={styles.optionText} numberOfLines={2}>{item.name}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.empty}>{t('noResults')}</Text>}
          />
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, maxHeight: '70%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', flex: 1 },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 22, color: '#999' },
  search: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 15, backgroundColor: '#fafafa' },
  clearBtn: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 4 },
  clearText: { fontSize: 14, color: '#dc2626', fontWeight: '600' },
  list: { marginTop: 4 },
  option: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  optionText: { fontSize: 15, color: '#333' },
  empty: { paddingVertical: 24, textAlign: 'center', color: '#999' },
})
