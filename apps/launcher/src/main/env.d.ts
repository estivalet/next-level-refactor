/// <reference types="vite/client" />
/// <reference types="electron-vite/node" />

interface ImportMetaEnv {
  /** The API this build talks to (M10 sets the production one); default http://localhost:4000. */
  readonly MAIN_VITE_API_URL?: string;
}
