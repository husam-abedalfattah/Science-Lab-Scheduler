/// <reference types="vite/client" />

interface ImportMetaEnv {
  // One password per person trusted with the stockroom -- the password is the
  // identity the modification history records. See ADMIN_ACCOUNTS in
  // src/constants.ts and the table in .env.example.
  readonly VITE_ADMIN_PASSWORD?: string;
  readonly VITE_ADMIN_PASSWORD_BOYS?: string;
  readonly VITE_ADMIN_PASSWORD_GIRLS?: string;

  // What each of them is called in the history. Optional; job titles otherwise.
  readonly VITE_ADMIN_NAME?: string;
  readonly VITE_ADMIN_NAME_BOYS?: string;
  readonly VITE_ADMIN_NAME_GIRLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
