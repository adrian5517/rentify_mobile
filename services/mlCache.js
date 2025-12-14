import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@rentify:mlcache:';

async function getKey(id) {
  return `${PREFIX}${id}`;
}

/**
 * Save recommendations for a property with timestamp
 * @param {string} propertyId
 * @param {Array} data
 */
export async function save(propertyId, data) {
  if (!propertyId) return;
  try {
    const payload = { ts: Date.now(), data };
    await AsyncStorage.setItem(await getKey(propertyId), JSON.stringify(payload));
  } catch (err) {
    console.warn('mlCache.save error', err);
  }
}

/**
 * Get cached recommendations for propertyId or null
 * @param {string} propertyId
 */
export async function get(propertyId) {
  if (!propertyId) return null;
  try {
    const raw = await AsyncStorage.getItem(await getKey(propertyId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (err) {
    console.warn('mlCache.get error', err);
    return null;
  }
}

/**
 * Check if cache is stale given TTL in minutes
 */
export async function isStale(propertyId, ttlMinutes = 5) {
  const entry = await get(propertyId);
  if (!entry || !entry.ts) return true;
  const age = (Date.now() - entry.ts) / 1000 / 60;
  return age > ttlMinutes;
}

export async function clear(propertyId) {
  if (!propertyId) return;
  try {
    await AsyncStorage.removeItem(await getKey(propertyId));
  } catch (err) {
    console.warn('mlCache.clear error', err);
  }
}

export default { save, get, isStale, clear };
