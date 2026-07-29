import type { StorageAdapter } from "grammy";

/**
 * Small durable record store built on the toolkit-selected session adapter.
 * Feature code uses explicit keys only; it never enumerates the backing store.
 */
export interface DomainStore {
  read<T>(key: string): Promise<T | undefined>;
  write<T>(key: string, value: T): Promise<void>;
}

export function createDomainStore(adapter: StorageAdapter<unknown>): DomainStore {
  return {
    read: <T>(key: string) => adapter.read(`domain:${key}`) as Promise<T | undefined>,
    write: async <T>(key: string, value: T) => {
      await adapter.write(`domain:${key}`, value);
    },
  };
}
