/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_EXTERNAL_SOURCE_URL: string;
  readonly VITE_RELEASE_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
