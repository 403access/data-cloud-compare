/** Mutable process state populated once during start-up. */

import type { Provider } from "./providers";
import { getProviders } from "./providers";
import type { SearchIndexes } from "./search-index";

export const PROVIDERS: Map<string, Provider> = new Map(
  getProviders().map((provider) => [provider.key, provider]),
);

export const PROVIDER_STATE = new Map<string, { ready: boolean; reason: string }>();
export const SEARCH = new Map<string, SearchIndexes>();

export let LOCAL_SIZE_DB: string | null = null;
export function setLocalSizeDb(path: string | null): void {
  LOCAL_SIZE_DB = path;
}
