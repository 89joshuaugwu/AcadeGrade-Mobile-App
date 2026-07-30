import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { BottomSheetModal, BottomSheetView, BottomSheetTextInput, BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { ChevronDown, Check, Search } from 'lucide-react-native';
import { colors, radius, spacing } from '@/constants/theme';

interface PickerFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  error?: string;
}

/**
 * New — needed to properly rebuild the registration wizard (university/
 * department/programme selection), which didn't exist in any form before.
 * Bottom-sheet searchable list, allows free text if nothing matches (same
 * flexibility web's `<input list="...">` datalist gave, since RN has no
 * datalist equivalent).
 */
export function PickerField({ label, value, onChange, options, placeholder, error }: PickerFieldProps) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [query, options]);

  const open = useCallback(() => {
    setQuery('');
    sheetRef.current?.present();
  }, []);

  const select = useCallback((item: string) => {
    onChange(item);
    sheetRef.current?.dismiss();
  }, [onChange]);

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 6 }}>{label}</Text>
      <Pressable
        onPress={open}
        style={{
          height: 52,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
          backgroundColor: colors.surface,
          paddingHorizontal: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ color: value ? colors.text : colors.textFaint, fontSize: 15 }} numberOfLines={1}>
          {value || placeholder || 'Select...'}
        </Text>
        <ChevronDown size={18} color={colors.textMuted} />
      </Pressable>
      {error && <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>{error}</Text>}

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['75%']}
        backgroundStyle={{ backgroundColor: colors.surface }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        <BottomSheetView style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.md }}>{label}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.void, paddingHorizontal: spacing.sm }}>
            <Search size={16} color={colors.textFaint} />
            <BottomSheetTextInput
              value={query}
              onChangeText={setQuery}
              placeholder={`Search ${label.toLowerCase()}...`}
              placeholderTextColor={colors.textFaint}
              style={{ flex: 1, color: colors.text, fontSize: 15, height: '100%' }}
              autoFocus
            />
          </View>
        </BottomSheetView>
        <BottomSheetFlatList
          data={filtered}
          keyExtractor={(item) => item}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
          ListEmptyComponent={
            query.trim() ? (
              <Pressable onPress={() => select(query.trim())} style={{ paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.primaryDim, marginTop: spacing.sm }}>
                <Text style={{ color: colors.primaryGlow, fontWeight: '600' }}>Use "{query.trim()}"</Text>
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => select(item)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }}
            >
              <Text style={{ color: colors.text, flex: 1, paddingRight: 8 }}>{item}</Text>
              {item === value && <Check size={18} color={colors.primary} />}
            </Pressable>
          )}
        />
      </BottomSheetModal>
    </View>
  );
}
