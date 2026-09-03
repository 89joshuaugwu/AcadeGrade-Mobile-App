import type { TourTargetRect } from './types';

interface RegisteredTarget {
  measure: () => Promise<TourTargetRect | null>;
  focus?: () => void;
}

const targets = new Map<string, RegisteredTarget>();
const actions = new Map<string, () => void>();

export function registerTourTarget(id: string, target: RegisteredTarget) {
  targets.set(id, target);
  return () => {
    if (targets.get(id) === target) targets.delete(id);
  };
}

export function getTourTarget(id: string) {
  return targets.get(id);
}

export function registerTourAction(id: string, action: () => void) {
  actions.set(id, action);
  return () => {
    if (actions.get(id) === action) actions.delete(id);
  };
}

export function runTourAction(id?: string) {
  if (id) actions.get(id)?.();
}
