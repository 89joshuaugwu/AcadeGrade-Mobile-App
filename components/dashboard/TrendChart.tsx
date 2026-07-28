import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Polyline, Line, Text as SvgText } from 'react-native-svg';
import { colors } from '@/constants/theme';

interface TrendChartProps {
  data: { x: number; gpa: number; pi: number }[];
  width: number;
  height?: number;
}

/**
 * Minimal dependency-free line chart (react-native-svg only — already a
 * project dependency for CGPAArc, so this adds zero new packages).
 *
 * Replaces victory-native, which pulls in @shopify/react-native-skia and,
 * as of victory-native@41.26, requires React 19 — a hard peer-dependency
 * conflict with Expo SDK 52's React 18.3.1. Rather than force-install a
 * mismatched native module (real crash risk at runtime, not just an npm
 * warning), this renders the same two-line GPA/PI comparison with plain SVG.
 */
export function TrendChart({ data, width, height = 160 }: TrendChartProps) {
  if (data.length < 2) return null;

  const padding = { top: 10, bottom: 24, left: 32, right: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxVal = 5; // GPA/PI scale is always 0–5

  const xStep = chartW / (data.length - 1);
  const toY = (v: number) => padding.top + chartH - (v / maxVal) * chartH;
  const toX = (i: number) => padding.left + i * xStep;

  const gpaPoints = data.map((d, i) => `${toX(i)},${toY(d.gpa)}`).join(' ');
  const piPoints = data.map((d, i) => `${toX(i)},${toY(d.pi)}`).join(' ');
  const gridLines = [1, 2, 3, 4, 5];

  return (
    <View>
      <Svg width={width} height={height}>
        {gridLines.map((v) => (
          <React.Fragment key={v}>
            <Line
              x1={padding.left} x2={width - padding.right}
              y1={toY(v)} y2={toY(v)}
              stroke={colors.borderSubtle} strokeWidth={1}
            />
            <SvgText x={padding.left - 6} y={toY(v) + 3} fontSize={9} fill={colors.textMuted} textAnchor="end">
              {v}
            </SvgText>
          </React.Fragment>
        ))}
        <Polyline points={piPoints} fill="none" stroke={colors.gold} strokeWidth={2} strokeDasharray="4,4" />
        <Polyline points={gpaPoints} fill="none" stroke={colors.primary} strokeWidth={2.5} />
      </Svg>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
        <Legend color={colors.primary} label="GPA" />
        <Legend color={colors.gold} label="PI" dashed />
      </View>
    </View>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 12, height: 2, backgroundColor: color, opacity: dashed ? 0.7 : 1 }} />
      <Text style={{ color: colors.textMuted, fontSize: 10 }}>{label}</Text>
    </View>
  );
}
