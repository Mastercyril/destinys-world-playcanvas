/// <reference types="vite/client" />

declare global {
  interface Window {
    __DW_READY?: boolean;
    __DW?: import('./game').DebugApi;
  }
}

export {};
