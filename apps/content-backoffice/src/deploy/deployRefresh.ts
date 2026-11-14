export function shouldReloadForBuildId(
  currentBuildId: string,
  remoteBuildId: string | undefined | null,
): boolean {
  if (!currentBuildId) {
    return false;
  }
  if (remoteBuildId == null || remoteBuildId === '') {
    return false;
  }
  return remoteBuildId !== currentBuildId;
}

export type VersionJsonPayload = {
  buildId?: string;
};

export function parseVersionJsonPayload(payload: unknown): VersionJsonPayload {
  if (payload && typeof payload === 'object' && 'buildId' in payload) {
    const buildId = (payload as { buildId: unknown }).buildId;
    return {
      buildId: typeof buildId === 'string' ? buildId : undefined,
    };
  }
  return {};
}
