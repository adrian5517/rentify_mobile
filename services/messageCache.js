import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import normalizeAvatar from '../utils/normalizeAvatar';

// Detect sqlite availability (expo-sqlite may be unavailable on web or JS runtimes)
const hasSqlite = !!(SQLite && typeof SQLite.openDatabase === 'function');

let messageCacheImpl;

if (!hasSqlite) {
  // Fallback implementation using AsyncStorage
  const MSG_PREFIX = 'messages:';
  const META_PREFIX = 'cache_meta:';

  const saveMessages = async (conversationId, messages = []) => {
    if (!conversationId) return;
    try {
      const key = `${MSG_PREFIX}${conversationId}`;
      const existingRaw = await AsyncStorage.getItem(key);
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      // Normalize avatars before persisting and merge by _id
      const normalized = (messages || []).map(m => {
        try {
          const avatarInput = m?.user?.avatar || m?.user?.profilePicture || m?.user;
          const avatar = normalizeAvatar(avatarInput);
          return { ...m, user: { ...m.user, avatar }, createdAt: (m.createdAt instanceof Date) ? m.createdAt.toISOString() : m.createdAt };
        } catch (err) {
          return { ...m, createdAt: (m.createdAt instanceof Date) ? m.createdAt.toISOString() : m.createdAt };
        }
      });
      const map = new Map();
      [...existing, ...normalized].forEach(m => { if (m && m._id) map.set(m._id, m); });
      const arr = Array.from(map.values()).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
      await AsyncStorage.setItem(key, JSON.stringify(arr));
      // update meta
      await AsyncStorage.setItem(`${META_PREFIX}${conversationId}`, new Date().toISOString());
    } catch (err) {
      console.warn('messageCache.saveMessages (fallback) error', err);
    }
  };

  const getMessages = async (conversationId, limit = 100) => {
    if (!conversationId) return [];
    try {
      const key = `${MSG_PREFIX}${conversationId}`;
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw).slice(0, limit).map(m => ({ ...m, createdAt: new Date(m.createdAt) }));
      return parsed;
    } catch (err) {
      console.warn('messageCache.getMessages (fallback) error', err);
      return [];
    }
  };

  const appendMessage = async (conversationId, message) => {
    await saveMessages(conversationId, [message]);
  };

  const clearConversation = async (conversationId) => {
    if (!conversationId) return;
    try {
      await AsyncStorage.removeItem(`${MSG_PREFIX}${conversationId}`);
      await AsyncStorage.removeItem(`${META_PREFIX}${conversationId}`);
    } catch (err) {
      console.warn('messageCache.clearConversation (fallback) error', err);
    }
  };

  const isCacheStale = async (conversationId, ttlMinutes = 5) => {
    if (!conversationId) return true;
    try {
      const raw = await AsyncStorage.getItem(`${META_PREFIX}${conversationId}`);
      if (!raw) return true;
      const last = new Date(raw);
      const now = new Date();
      const diffMins = (now - last) / (1000 * 60);
      return diffMins > ttlMinutes;
    } catch (err) {
      console.warn('messageCache.isCacheStale (fallback) error', err);
      return true;
    }
  };

  const getLastUpdated = async (conversationId) => {
    if (!conversationId) return null;
    try {
      const raw = await AsyncStorage.getItem(`${META_PREFIX}${conversationId}`);
      return raw ? new Date(raw) : null;
    } catch (err) {
      console.warn('messageCache.getLastUpdated (fallback) error', err);
      return null;
    }
  };

  messageCacheImpl = {
    init: async () => {},
    saveMessages,
    getMessages,
    appendMessage,
    clearConversation,
    isCacheStale,
    getLastUpdated,
  };
} else {
  // sqlite-backed implementation
  const db = SQLite.openDatabase('rentify.db');

  const runSql = (sql, params = []) => new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(sql, params,
        (_, result) => resolve(result),
        (_, error) => { reject(error); return false; }
      );
    });
  });

  const init = async () => {
    // Create messages table if not exists
    const sql = `CREATE TABLE IF NOT EXISTS messages (
      _id TEXT PRIMARY KEY,
      conversationId TEXT,
      senderId TEXT,
      name TEXT,
      avatar TEXT,
      text TEXT,
      image TEXT,
      createdAt TEXT,
      sent INTEGER,
      received INTEGER
    );`;
    await runSql(sql);
    // Create cache meta table to track last-updated timestamps per conversation
    const metaSql = `CREATE TABLE IF NOT EXISTS cache_meta (
      conversationId TEXT PRIMARY KEY,
      lastUpdated TEXT
    );`;
    await runSql(metaSql);
  };

  const toRow = (m, conversationId) => {
    // ensure avatar normalized for sqlite storage
    const avatarInput = m?.user?.avatar || m?.user?.profilePicture || m?.user;
    const avatar = normalizeAvatar(avatarInput);
    return [
      m._id,
      conversationId,
      m.user?._id || m.user || null,
      m.user?.name || m.user?.username || null,
      avatar || null,
      m.text || null,
      m.image || null,
      (m.createdAt instanceof Date) ? m.createdAt.toISOString() : (m.createdAt || new Date().toISOString()),
      m.sent ? 1 : 0,
      m.received ? 1 : 0,
    ];
  };

  const saveMessages = async (conversationId, messages = []) => {
    if (!conversationId) return;
    await init();
    try {
      db.transaction(tx => {
        messages.forEach(m => {
          const params = toRow(m, conversationId);
          tx.executeSql(
            `INSERT OR REPLACE INTO messages (_id, conversationId, senderId, name, avatar, text, image, createdAt, sent, received) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            params
          );
        });
      });
      // update meta
      try {
        const now = new Date().toISOString();
        await runSql(`INSERT OR REPLACE INTO cache_meta (conversationId, lastUpdated) VALUES (?, ?)`, [conversationId, now]);
      } catch (err) {
        console.warn('messageCache.updateLastUpdated error', err);
      }
    } catch (err) {
      console.warn('messageCache.saveMessages error', err);
    }
  };

  const getMessages = async (conversationId, limit = 100) => {
    if (!conversationId) return [];
    await init();
    try {
      const res = await runSql(`SELECT * FROM messages WHERE conversationId = ? ORDER BY datetime(createdAt) DESC LIMIT ?`, [conversationId, limit]);
      const rows = [];
      for (let i = 0; i < res.rows.length; i++) {
        const r = res.rows.item(i);
        rows.push({
          _id: r._id,
          createdAt: new Date(r.createdAt),
          text: r.text,
          image: r.image,
          user: {
            _id: r.senderId,
            name: r.name,
            avatar: r.avatar,
          },
          sent: !!r.sent,
          received: !!r.received,
        });
      }
      return rows;
    } catch (err) {
      console.warn('messageCache.getMessages error', err);
      return [];
    }
  };

  const appendMessage = async (conversationId, message) => {
    if (!conversationId || !message) return;
    await saveMessages(conversationId, [message]);
  };

  const clearConversation = async (conversationId) => {
    if (!conversationId) return;
    await init();
    try {
      await runSql(`DELETE FROM messages WHERE conversationId = ?`, [conversationId]);
      await runSql(`DELETE FROM cache_meta WHERE conversationId = ?`, [conversationId]);
    } catch (err) {
      console.warn('messageCache.clearConversation error', err);
    }
  };

  const isCacheStale = async (conversationId, ttlMinutes = 5) => {
    if (!conversationId) return true;
    await init();
    try {
      const res = await runSql(`SELECT lastUpdated FROM cache_meta WHERE conversationId = ?`, [conversationId]);
      if (!res || res.rows.length === 0) return true;
      const row = res.rows.item(0);
      if (!row || !row.lastUpdated) return true;
      const last = new Date(row.lastUpdated);
      const now = new Date();
      const diffMs = now - last;
      const diffMins = diffMs / (1000 * 60);
      return diffMins > ttlMinutes;
    } catch (err) {
      console.warn('messageCache.isCacheStale error', err);
      return true;
    }
  };

  const getLastUpdated = async (conversationId) => {
    if (!conversationId) return null;
    await init();
    try {
      const res = await runSql(`SELECT lastUpdated FROM cache_meta WHERE conversationId = ?`, [conversationId]);
      if (!res || res.rows.length === 0) return null;
      const row = res.rows.item(0);
      return row.lastUpdated ? new Date(row.lastUpdated) : null;
    } catch (err) {
      console.warn('messageCache.getLastUpdated error', err);
      return null;
    }
  };

  messageCacheImpl = {
    init,
    saveMessages,
    getMessages,
    appendMessage,
    clearConversation,
    isCacheStale,
    getLastUpdated,
  };
}

export default messageCacheImpl;
