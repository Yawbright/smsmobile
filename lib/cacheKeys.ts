export const DEMO_CACHE_KEY = "oterkpolu.mobile.cache.demo";

export function makeDataCacheKey(schoolId: string) {
  return `oterkpolu.mobile.cache.school.${schoolId || "default-school"}`;
}
