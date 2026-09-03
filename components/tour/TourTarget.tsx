import { useEffect, useRef } from 'react';
import { View, type ViewProps } from 'react-native';
import { registerTourTarget } from '@/lib/tour/registry';

interface TourTargetProps extends ViewProps {
  tourId: string;
  onTourFocus?: () => void;
}

export function TourTarget({ tourId, onTourFocus, children, ...props }: TourTargetProps) {
  const ref = useRef<View>(null);
  const focusRef = useRef(onTourFocus);

  useEffect(() => {
    focusRef.current = onTourFocus;
  }, [onTourFocus]);

  useEffect(() => registerTourTarget(tourId, {
    focus: () => focusRef.current?.(),
    measure: () => new Promise((resolve) => {
      ref.current?.measureInWindow((x, y, width, height) => {
        resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
      });
      if (!ref.current) resolve(null);
    }),
  }), [tourId]);

  return <View ref={ref} collapsable={false} {...props}>{children}</View>;
}
