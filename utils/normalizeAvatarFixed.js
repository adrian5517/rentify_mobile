// normalizeAvatar helper (clean copy)
export default function normalizeAvatar(url) {
  const DEFAULT = 'https://api.dicebear.com/7.x/avataaars/png?seed=default';
  try {
    if (!url) return DEFAULT;
    let avatar = url;
    if (typeof avatar !== 'string') return DEFAULT;

    // Convert DiceBear svg query to PNG for RN Image compatibility
    if (avatar.includes('api.dicebear.com') && avatar.includes('/svg?')) {
      avatar = avatar.replace('/svg?', '/png?');
    }

    // If not absolute URL, prefix with server base
    if (!avatar.startsWith('http')) {
      avatar = `https://rentify-server-ge0f.onrender.com${avatar}`;
    }

    return avatar;
  } catch (err) {
    return DEFAULT;
  }
}
