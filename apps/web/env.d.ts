/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL: string | undefined;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

// Camera flashlight. Supported by mobile Chrome but missing from the DOM types.
interface MediaTrackConstraintSet {
    torch?: boolean;
}
