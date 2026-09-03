import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import {
  BookOpenCheck,
  Building2,
  Check,
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
  plural: string;
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
        plural: 'institutions',
        helper: 'Select the university where you are studying.',
        searchPlaceholder: 'Search institutions',
        icon: Building2,
      };
    case 'department':
      return {
        title: 'Choose your department',
        singular: 'department',
        plural: 'departments',
        helper: 'Use the name shown on your admission or result.',
        searchPlaceholder: 'Search departments',
        icon: BookOpenCheck,
      };
    case 'programme':
      return {
        title: 'Choose your degree programme',
        singular: 'degree programme',
        plural: 'degree programmes',
        helper: 'Select the qualification you are currently studying for.',
        searchPlaceholder: 'Search degree programmes',
        icon: GraduationCap,
      };
    default:
      return {
        title: `Choose ${label.toLowerCase()}`,
        singular: label.toLowerCase(),
        plural: `${label.toLowerCase()} options`,
        helper: `Search and choose your ${label.toLowerCase()}.`,
        searchPlaceholder: `Search ${label.toLowerCase()}`,
        icon: BookOpenCheck,
      };
  }
}

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Compact field + one continuous sheet scroll surface for long academic lists. */
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

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.5}
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

  const searchActive = query.trim().length > 0;
  const fieldText = value || placeholder || `Select ${meta.singular}`;

  return (
    <View style={{ width: '100%', marginBottom: spacing.md }}>
      <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 7 }}>{label}</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Choose ${meta.singular}`}
        accessibilityHint={`Opens a searchable list of ${meta.plural}`}
        onPress={open}
        style={{
          width: '100%',
          height: 54,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: error ? colors.danger : value ? `${colors.primary}75` : colors.border,
          backgroundColor: colors.deep,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <View style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: value ? colors.primaryDim : colors.overlay, marginRight: 10 }}>
          <Icon size={17} color={value ? colors.primary : colors.textMuted} />
        </View>
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{ flex: 1, color: value ? colors.text : colors.textFaint, fontSize: 14, fontWeight: value ? '600' : '400' }}
        >
          {fieldText}
        </Text>
        {value ? (
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
            <Check size={13} color={colors.primary} strokeWidth={3} />
          </View>
        ) : null}
        <ChevronDown size={17} color={colors.textMuted} style={{ marginLeft: 7 }} />
      </Pressable>

      {error ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 5 }}>{error}</Text> : null}

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['82%']}
        enableDynamicSizing={false}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.surface }}
        handleIndicatorStyle={{ backgroundColor: colors.border, width: 38 }}
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        onDismiss={() => setQuery('')}
      >
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.lg }}>
            <View style={{ width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryDim, marginRight: 10 }}>
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
              style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.overlay, marginLeft: 8 }}
            >
              <X size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={{ height: 50, borderRadius: radius.md, borderWidth: 1.5, borderColor: searchActive ? colors.primary : colors.border, backgroundColor: colors.deep, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }}>
            <Search size={18} color={searchActive ? colors.primary : colors.textFaint} />
            <BottomSheetTextInput
              accessibilityLabel={`Search ${meta.plural}`}
              value={query}
              onChangeText={setQuery}
              placeholder={meta.searchPlaceholder}
              placeholderTextColor={colors.textFaint}
              returnKeyType="search"
              style={{ flex: 1, height: '100%', color: colors.text, fontSize: 15, paddingHorizontal: 10 }}
            />
            {searchActive ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={8}
                onPress={() => setQuery('')}
                style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.overlay }}
              >
                <X size={14} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {value ? (
            <View style={{ marginTop: spacing.md, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.primaryDim, borderWidth: 1, borderColor: `${colors.primary}45`, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 9 }}>
                <Check size={14} color={colors.textInverse} strokeWidth={3} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' }}>Currently selected</Text>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 2 }} numberOfLines={1}>{value}</Text>
              </View>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm }}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>
              {searchActive ? 'Search results' : `All ${meta.plural}`}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              {filtered.length} {searchActive ? (filtered.length === 1 ? 'match' : 'matches') : 'available'}
            </Text>
          </View>

          {filtered.length > 0 ? (
            <View style={{ overflow: 'hidden', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.deep }}>
              {filtered.map((item, index) => {
                const selected = item === value;
                return (
                  <Pressable
                    key={item}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => select(item)}
                    style={{
                      minHeight: 52,
                      paddingHorizontal: 13,
                      paddingVertical: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: selected ? colors.primaryDim : colors.deep,
                      borderBottomWidth: index === filtered.length - 1 ? 0 : 1,
                      borderBottomColor: colors.borderSubtle,
                    }}
                  >
                    <Text style={{ flex: 1, color: selected ? colors.text : colors.textMuted, fontSize: 14, lineHeight: 19, fontWeight: selected ? '700' : '500' }}>
                      {item}
                    </Text>
                    {selected ? (
                      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 10 }}>
                        <Check size={14} color={colors.textInverse} strokeWidth={3} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xxl, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.deep }}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Search size={20} color={colors.textMuted} />
              </View>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>No match found</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5 }}>
                Check the spelling, or use the exact name shown on your academic record.
              </Text>
              {query.trim().length > 1 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => select(query.trim())}
                  style={{ marginTop: spacing.lg, minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: colors.textInverse, fontSize: 13, fontWeight: '800' }}>Use “{query.trim()}”</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    </View>
  );
}
