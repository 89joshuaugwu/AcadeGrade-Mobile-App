export type TourChapterId =
  | 'dashboard'
  | 'results'
  | 'new-semester'
  | 'semester'
  | 'scanner'
  | 'insights'
  | 'transcript'
  | 'more'
  | 'notifications'
  | 'settings';

export interface TourStep {
  id: string;
  target?: string;
  title: string;
  description: string;
  enterAction?: string;
}

export interface TourChapter {
  id: TourChapterId;
  label: string;
  steps: TourStep[];
}

export interface TourTargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
