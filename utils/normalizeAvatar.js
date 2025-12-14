// normalizeAvatar helper — clean single implementation
import { API_URL as BASE_API_URL } from '../constant/api';

export default function normalizeAvatar(input) {
  const DEFAULT = 'https://api.dicebear.com/7.x/avataaars/png?seed=default';

  try {
    if (input == null) return DEFAULT;

    // Handle object-shaped inputs from backend (e.g. { url, path, secure_url })
    let avatar = input;
    if (typeof avatar === 'object') {
      avatar = avatar.url || avatar.path || avatar.secure_url || avatar.location || avatar.uri || (Array.isArray(avatar) && avatar[0]) || null;
    }

    if (!avatar) return DEFAULT;
    if (typeof avatar !== 'string') return DEFAULT;

    // Convert DiceBear svg query to PNG for RN Image compatibility
    if (avatar.includes('api.dicebear.com') && avatar.includes('/svg?')) {
      avatar = avatar.replace('/svg?', '/png?');
    }

    // If not absolute URL, prefix with configured API base
    if (!avatar.startsWith('http')) {
      const base = BASE_API_URL || 'https://rentify-server-ge0f.onrender.com';
      avatar = `${base}${avatar.startsWith('/') ? avatar : `/${avatar}`}`;
    }

    return avatar;
  } catch (err) {
    return DEFAULT;
  }
}
