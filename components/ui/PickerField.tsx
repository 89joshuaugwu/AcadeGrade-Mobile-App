import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import {
  BookOpenCheck,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  GraduationCap,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { radius, spacing } from '@/constants/theme';
import { useThemeColors } from '@/lib/store/themeStore';

interface PickerFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  error?: string;
}

interface PickerMeta {
  title: string;
  singular: string;
  helper: string;
  searchPlaceholder: string;
  icon: LucideIcon;
}

function pickerMeta(label: string): PickerMeta {
  switch (label.toLowerCase()) {
    case 'university':
      return {
        title: 'Choose your institution',
        singular: 'institution',
        helper: 'Search the university where you are studying.',
        searchPlaceholder: 'Search institutions',
        icon: Building2,
      };
    case 'department':
      return {
        title: 'Choose your department',
        singular: 'department',
        helper: 'Find the department shown on your admission or result.',
        searchPlaceholder: 'Search departments',
        icon: BookOpenCheck,
      };
    case 'programme':
      return {
        title: 'Choose your degree programme',
        singular: 'degree programme',
        helper: 'Select the degree programme you are enrolled in.',
        searchPlaceholder: 'Search degree programmes',
        icon: GraduationCap,
      };
    default:
      return {
        title: `Choose ${label.toLowerCase()}`,
        singular: label.toLowerCase(),
        helper: `Search and choose your ${label.toLowerCase()}.`,
        searchPlaceholder: `Search ${label.toLowerCase()}…`,
        icon: BookOpenCheck,
      };
  }
}

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * A shared selector for the registration flow. Keeping every academic list in
 * one sheet design means a long department directory remains easy to browse,
 * while universities and degree programmes still feel like part of one flow.
 */
export function PickerField({ label, value, onChange, options, placeholder, error }: PickerFieldProps) {
  const colors = useThemeColors();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [query, setQuery] = useState('');
  const meta = useMemo(() => pickerMeta(label), [label]);
  const Icon = meta.icon;

  const filtered = useMemo(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return options;

    const normalisedQuery = normalise(trimmedQuery);
    return options.filter((option) => normalise(option).includes(normalisedQuery));
  }, [options, query]);

  const hasExactMatch = useMemo(() => {
    const normalisedQuery = normalise(query.trim());
    return Boolean(normalisedQuery) && options.some((option) => normalise(option) === normalisedQuery);
  }, [options, query]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.48}
      />
    ),
    [],
  );

  const open = useCallback(() => {
    setQuery('');
    sheetRef.current?.present();
  }, []);

  const close = useCallback(() => sheetRef.current?.dismiss(), []);

  const select = useCallback((item: string) => {
    onChange(item);
    sheetRef.current?.dismiss();
  }, [onChange]);

  const itemCountLabel = `${options.length} ${meta.singular}${options.length === 1 ? '' : 's'} available`;
  const fieldValue = value || placeholder || `Select ${meta.singular}`;

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 7 }}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Choose ${meta.singular}`}
        accessibilityHint={`Opens a searchable list of ${meta.singular}s`}
        onPress={open}
        style={({ pressed }) => ({
          minHeight: 56,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: error ? colors.danger : value ? `${colors.primary}88` : colors.border,
          backgroundColor: value ? colors.primaryDim : colors.surface,
          paddingHorizontal: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          opacity: pressed ? 0.86 : 1,
        })}
      >
        <View style={{ width: 31, height: 31, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: value ? `${colors.primary}22` : colors.overlay }}>
          <Icon size={16} color={value ? colors.primary : colors.textMuted} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: value ? colors.text : colors.textFaint, fontSize: 15, fontWeight: value ? '600' : '400' }} numberOfLines={1}>
            {fieldValue}
          </Text>
          {value ? <Text style={{ color: colors.primary, fontSize: 11, marginTop: 2 }}>Tap to change</Text> : null}
        </View>
        <ChevronDown size={18} color={value ? colors.primary : colors.textMuted} />
      </Pressable>
      {error ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 5 }}>{error}</Text> : null}

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['78%']}
        enableDynamicSizing={false}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.surface }}
        handleIndicatorStyle={{ backgroundColor: colors.border, width: 38 }}
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        onDismiss={() => setQuery('')}
      >
        <BottomSheetView style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.lg }}>
            <View style={{ width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryDim }}>
              <Icon size={21} color={colors.primary} />
            </View>
            <View style={{ flex: 1, paddingTop: 1 }}>
              <Text style={{ color: colors.text, fontSize: 19, lineHeight: 24, fontWeight: '800' }}>{meta.title}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 2 }}>{meta.helper}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close selection list"
              hitSlop={10}
              onPress={close}
              style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.overlay }}
            >
              <X size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, height: 50, borderRadius: radius.md, borderWidth: 1, borderColor: query ? `${colors.primary}AA` : colors.border, backgroundColor: colors.void, paddingLeft: spacing.md, paddingRight: 6 }}>
            <Search size={18} color={query ? colors.primary : colors.textFaint} />
            <BottomSheetTextInput
              accessibilityLabel={`Search ${meta.singular}s`}
              value={query}
              onChangeText={setQuery}
              placeholder={meta.searchPlaceholder}
              placeholderTextColor={colors.textFaint}
              style={{ flex: 1, color: colors.text, fontSize: 15, height: '100%' }}
              returnKeyType="search"
            />
            {query ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={8}
                onPress={() => setQuery('')}
                style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.overlay }}
              >
                <X size={15} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md }}>
            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>
              {query ? `${filtered.length} match${filtered.length === 1 ? '' : 'es'}` : itemCountLabel}
            </Text>
            <Text style={{ color: colors.textFaint, fontSize: 11 }}>Swipe down to close</Text>
          </View>
        </BottomSheetView>

        <BottomSheetFlatList
          data={filtered}
          keyExtractor={(item) => item}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl }}
          ListHeaderComponent={value ? (
            <View style={{ borderRadius: radius.md, backgroundColor: colors.primaryDim, borderWidth: 1, borderColor: `${colors.primary}42`, padding: spacing.sm, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
              <CheckCircle2 size={16} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 }}>Selected {meta.singular}</Text>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600', marginTop: 1 }} numberOfLines={1}>{value}</Text>
              </View>
            </View>
          ) : null}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: spacing.xxl, paddingHorizontal: spacing.lg }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.overlay, marginBottom: spacing.sm }}>
                <Search size={21} color={colors.textMuted} />
              </View>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>No {meta.singular} found</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 5 }}>
                Try a shorter search, or save the name exactly as it appears on your school record.
              </Text>
              {query.trim().length > 1 && !hasExactMatch ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => select(query.trim())}
                  style={({ pressed }) => ({ marginTop: spacing.lg, paddingVertical: 12, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 })}
                >
                  <Text style={{ color: colors.textInverse, fontWeight: '800', fontSize: 13 }}>Use “{query.trim()}”</Text>
                </Pressable>
              ) : null}
            </View>
          }
          renderItem={({ item }) => {
            const selected = item === value;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => select(item)}
                style={({ pressed }) => ({
                  minHeight: 58,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: spacing.sm,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: selected ? `${colors.primary}80` : colors.borderSubtle,
                  backgroundColor: selected ? colors.primaryDim : pressed ? colors.overlay : 'transparent',
                  paddingVertical: 10,
                  paddingHorizontal: spacing.md,
                  marginBottom: 7,
                })}
              >
                <Text style={{ color: selected ? colors.text : colors.textMuted, flex: 1, fontSize: 14, lineHeight: 19, fontWeight: selected ? '700' : '500' }}>
                  {item}
                </Text>
                {selected ? (
                  <View style={{ width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}>
                    <Check size={15} color={colors.textInverse} strokeWidth={3} />
                  </View>
                ) : null}
              </Pressable>
            );
          }}
        />
      </BottomSheetModal>
    </View>
  );
}
