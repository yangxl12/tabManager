import type { StateCreator } from 'zustand';
import type { Store } from './index';

export type SliceCreator<T> = StateCreator<Store, [['zustand/immer', never]], [], T>;

export type FlashField = 'name' | 'url';

export interface AutoEdit {
  id: string;
  field: FlashField;
  seq: number;
}
