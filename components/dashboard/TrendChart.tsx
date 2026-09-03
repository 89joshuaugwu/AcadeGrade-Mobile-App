import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Polyline, Polygon, Line, Text as SvgText } from 'react-native-svg';
import { colors as darkColors, type ThemeColors } from '@/constants/theme';

interface TrendChartProps {
  data: { x: number; gpa: number; pi: number }[];
  width: number;
  height?: number;
  themeColors?: ThemeColors;
  visibleMetrics?: ('gpa' | 'pi')[];
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
export function TrendChart({ data, width, height = 160, themeColors, visibleMetrics }: TrendChartProps) {
  const colors = themeColors ?? darkColors;
  if (data.length < 2) return null;
  const showGpa = !visibleMetrics || visibleMetrics.includes('gpa');
  const showPi = !visibleMetrics || visibleMetrics.includes('pi');

  const padding = { top: 10, bottom: 24, left: 32, right: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxVal = 5; // GPA/PI scale is always 0–5

  const xStep = chartW / (data.length - 1);
  const toY = (v: number) => padding.top + chartH - (v / maxVal) * chartH;
  const toX = (i: number) => padding.left + i * xStep;

  const gpaPoints = data.map((d, i) => `${toX(i)},${toY(d.gpa)}`).join(' ');
  const piPoints = data.map((d, i) => `${toX(i)},${toY(d.pi)}`).join(' ');
  const gpaArea = `${padding.left},${padding.top + chartH} ${gpaPoints} ${width - padding.right},${padding.top + chartH}`;
  const piArea = `${padding.left},${padding.top + chartH} ${piPoints} ${width - padding.right},${padding.top + chartH}`;
  const gridLines = [1, 2, 3, 4, 5];
  const last = data[data.length - 1];

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
        {showGpa && <Polygon points={gpaArea} fill={`${colors.primary}16`} />}
        {showPi && <Polygon points={piArea} fill={`${colors.gold}10`} />}
        {showPi && <Polyline points={piPoints} fill="none" stroke={colors.gold} strokeWidth={2.5} strokeDasharray="4,4" />}
        {showGpa && <Polyline points={gpaPoints} fill="none" stroke={colors.primary} strokeWidth={2.5} />}
        {showGpa && data.map((point, index) => <Circle key={`gpa-${index}`} cx={toX(index)} cy={toY(point.gpa)} r={index === data.length - 1 ? 3.5 : 1.9} fill={colors.primary} stroke={colors.surface} strokeWidth={index === data.length - 1 ? 2 : 1} />)}
        {showPi && data.map((point, index) => <Circle key={`pi-${index}`} cx={toX(index)} cy={toY(point.pi)} r={index === data.length - 1 ? 3.5 : 1.7} fill={colors.gold} stroke={colors.surface} strokeWidth={index === data.length - 1 ? 2 : 1} />)}
        {data.map((_, index) => (
          <SvgText key={`semester-${index}`} x={toX(index)} y={height - 6} fontSize={8} fill={colors.textFaint} textAnchor="middle">
            S{index + 1}
          </SvgText>
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
        {showGpa && <Legend color={colors.primary} label="CGPA" value={last.gpa} textColor={colors.textMuted} />}
        {showPi && <Legend color={colors.gold} label="PI" value={last.pi} dashed textColor={colors.textMuted} />}
      </View>
    </View>
  );
}

function Legend({ color, label, value, dashed, textColor }: { color: string; label: string; value: number; dashed?: boolean; textColor: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 12, height: 2, backgroundColor: color, opacity: dashed ? 0.7 : 1 }} />
      <Text style={{ color: textColor, fontSize: 10 }}>{label} {value.toFixed(2)}</Text>
    </View>
  );
}
