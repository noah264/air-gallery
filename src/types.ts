export interface Photo {
  id: string;
  name: string;
  url?: string;
  file?: File;
  handle?: FileSystemFileHandle;
  revision?: number;
}
export interface Album {
  id: string;
  name: string;
  path: string;
  photos: Photo[];
}
export interface Library {
  name: string;
  albums: Album[];
  kind: "demo" | "browser" | "desktop" | "fallback";
}
export interface View {
  x: number;
  y: number;
  logZoom: number;
}
export interface AlbumPosition {
  id: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  rotation: number;
}
export type ThemeId =
  "dawn" | "glacier" | "silver" | "rose" | "forest" | "graphite";
export type ThemePreference = ThemeId | "system";
export interface DesktopLibrary {
  name: string;
  albums: Album[];
}
export interface DesktopBridge {
  nativeGlass: boolean;
  chooseDirectory(): Promise<DesktopLibrary | null>;
  restoreDirectory(): Promise<DesktopLibrary | null>;
  refreshDirectory(): Promise<DesktopLibrary | null>;
  onLibraryChanged(
    callback: (data: DesktopLibrary | { error: string }) => void,
  ): () => void;
  setTheme(dark: boolean): Promise<void>;
}
declare global {
  interface Window {
    airgallery?: DesktopBridge;
    showDirectoryPicker?: (options?: {
      mode: "read";
    }) => Promise<FileSystemDirectoryHandle>;
  }
}
