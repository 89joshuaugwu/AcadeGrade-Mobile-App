import React from 'react';
import { View, Text } from 'react-native';
import { radius } from '@/constants/theme';

export function Badge({ label, color, icon }: { label: string; color: string; icon?: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: `${color}22`,
        borderColor: `${color}55`,
        borderWidth: 1,
        borderRadius: radius.pill,
        paddingHorizontal: 12,
        paddingVertical: 6,
        alignSelf: 'flex-start',
      }}
    >
      {icon && <Text style={{ fontSize: 14 }}>{icon}</Text>}
      <Text style={{ color, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}
