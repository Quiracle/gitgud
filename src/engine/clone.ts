import type { Repository } from "./types";

export function cloneRepository(repository: Repository): Repository {
  return structuredClone(repository);
}
