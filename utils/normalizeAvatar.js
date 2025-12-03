// normalizeAvatar helper (moved out of `app/` so expo-router doesn't treat it as a route)
export default function normalizeAvatar(url) {
  if (!url) return undefined;
  try {
    let avatar = url;
    if (typeof avatar !== 'string') return undefined;

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
    return undefined;
  }
}
