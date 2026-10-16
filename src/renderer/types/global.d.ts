import type { KanoDesktopAPI } from '../../preload/types';

declare global {
  interface Window {
    kanoDesktop: KanoDesktopAPI;
  }
}

export {};
