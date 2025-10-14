# 💬 Messages API - Complete Endpoint Reference

## 🔗 Base URL
```
Production: https://rentify-server-ge0f.onrender.com
Local: http://localhost:10000
```

---

## 📍 Available Endpoints

### 1. Send Message
**POST** `/api/messages/send`

Send a text message with optional images (up to 5).

**Headers:**
```
Content-Type: multipart/form-data
```

**Request Body (FormData):**
```javascript
{
  senderId: string,      // Required - Sender's user ID
  receiverId: string,    // Required - Receiver's user ID
  text: string,         // Optional - Message text
  images: File[]        // Optional - Up to 5 image files
}
```

**Example (JavaScript):**
```javascript
const formData = new FormData();
formData.append('senderId', currentUser._id);
formData.append('receiverId', contactId);
formData.append('text', 'Hello!');
// Add images if needed
formData.append('images', imageFile);

const response = await fetch('https://rentify-server-ge0f.onrender.com/api/messages/send', {
  method: 'POST',
  body: formData
});
```

**Example (cURL):**
```bash
curl -X POST https://rentify-server-ge0f.onrender.com/api/messages/send \
  -F "senderId=681b26b2c58b946b8d16dacf" \
  -F "receiverId=681b26b2c58b946b8d16dace" \
  -F "text=Hello from API!"
```

**Success Response (201):**
```json
{
  "_id": "671d1234567890abcdef1234",
  "sender": "681b26b2c58b946b8d16dacf",
  "receiver": "681b26b2c58b946b8d16dace",
  "message": "Hello!",
  "imageUrls": [],
  "read": false,
  "createdAt": "2025-10-14T10:30:00.000Z",
  "updatedAt": "2025-10-14T10:30:00.000Z"
}
```

**Error Response (500):**
```json
{
  "error": "Internal server error",
  "details": "Error message"
}
```

---

### 2. Get Messages Between Users
**GET** `/api/messages/:userId1/:otherUserId`

Retrieve all messages between two users.

**URL Parameters:**
- `userId1` - First user's ID (usually current user)
- `otherUserId` - Second user's ID (chat partner)

**Example:**
```javascript
const response = await fetch(
  `https://rentify-server-ge0f.onrender.com/api/messages/${currentUserId}/${contactId}`
);
const messages = await response.json();
```

**Example (cURL):**
```bash
curl https://rentify-server-ge0f.onrender.com/api/messages/681b26b2c58b946b8d16dacf/681b26b2c58b946b8d16dace
```

**Success Response (200):**
```json
[
  {
    "_id": "671d1234567890abcdef1234",
    "sender": "681b26b2c58b946b8d16dacf",
    "receiver": "681b26b2c58b946b8d16dace",
    "message": "Hello!",
    "imageUrls": [],
    "read": false,
    "createdAt": "2025-10-14T10:30:00.000Z",
    "updatedAt": "2025-10-14T10:30:00.000Z"
  },
  {
    "_id": "671d1234567890abcdef1235",
    "sender": "681b26b2c58b946b8d16dace",
    "receiver": "681b26b2c58b946b8d16dacf",
    "message": "Hi there!",
    "imageUrls": ["https://res.cloudinary.com/..."],
    "read": true,
    "createdAt": "2025-10-14T10:31:00.000Z",
    "updatedAt": "2025-10-14T10:32:00.000Z"
  }
]
```

**Notes:**
- Messages are sorted by `createdAt` in ascending order (oldest first)
- Returns empty array `[]` if no messages found
- Works bidirectionally (order of user IDs doesn't matter)

---

### 3. Mark Messages as Read
**POST** `/api/messages/mark-read`

Mark messages as read (updates read status).

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "userId": "681b26b2c58b946b8d16dacf",     // Current user's ID
  "senderId": "681b26b2c58b946b8d16dace"   // Other user's ID
}
```

**Example:**
```javascript
const response = await fetch('https://rentify-server-ge0f.onrender.com/api/messages/mark-read', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: currentUser._id,
    senderId: contactId
  })
});
```

**Example (cURL):**
```bash
curl -X POST https://rentify-server-ge0f.onrender.com/api/messages/mark-read \
  -H "Content-Type: application/json" \
  -d '{"userId":"681b26b2c58b946b8d16dacf","senderId":"681b26b2c58b946b8d16dace"}'
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Messages marked as read",
  "modifiedCount": 5
}
```

**⚠️ Note:** This endpoint is defined in routes but the controller function is missing. See implementation below.

---

### 4. Delete Message
**DELETE** `/api/messages/:id`

Delete a specific message by ID.

**URL Parameters:**
- `id` - Message ID to delete

**Example:**
```javascript
const response = await fetch(
  `https://rentify-server-ge0f.onrender.com/api/messages/${messageId}`,
  { method: 'DELETE' }
);
```

**Example (cURL):**
```bash
curl -X DELETE https://rentify-server-ge0f.onrender.com/api/messages/671d1234567890abcdef1234
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Message deleted"
}
```

**Error Response (500):**
```json
{
  "success": false,
  "error": "Error message"
}
```

---

## 🔌 Socket.io Events (Real-time)

### Client → Server Events

#### 1. `register`
Register user with socket server.

```javascript
socket.emit('register', userId);
```

---

#### 2. `send-message`
Send message in real-time.

```javascript
socket.emit('send-message', {
  senderId: '681b26b2c58b946b8d16dacf',
  receiverId: '681b26b2c58b946b8d16dace',
  text: 'Hello in real-time!',
  timestamp: new Date().toISOString()
});
```

---

#### 3. `mark-read`
Mark messages as read via socket.

```javascript
socket.emit('mark-read', {
  messageIds: ['671d...', '671e...'],
  userId: '681b26b2c58b946b8d16dacf'
});
```

---

### Server → Client Events

#### 1. `receive-message`
Receive new message.

```javascript
socket.on('receive-message', (message) => {
  console.log('New message:', message);
  // Add to messages list
});
```

**Message Object:**
```javascript
{
  senderId: '681b26b2c58b946b8d16dace',
  receiverId: '681b26b2c58b946b8d16dacf',
  text: 'Hello!',
  _id: '671d1234567890abcdef1234',
  createdAt: '2025-10-14T10:30:00.000Z'
}
```

---

#### 2. `messages-read`
Notification that messages were read.

```javascript
socket.on('messages-read', (data) => {
  console.log('Messages read:', data);
  // Update UI to show read status
});
```

**Data Object:**
```javascript
{
  messageIds: ['671d...', '671e...'],
  userId: '681b26b2c58b946b8d16dacf'
}
```

---

## 📋 Complete Usage Example

### React Native / Expo

```javascript
import socketService from './services/socket';
import { messageService } from './services/messageService';

// 1. Connect socket on app start
useEffect(() => {
  socketService.connect(currentUser._id);
}, []);

// 2. Load messages
const loadMessages = async () => {
  const response = await fetch(
    `${BASE_URL}/api/messages/${currentUser._id}/${contactId}`
  );
  const messages = await response.json();
  setMessages(messages);
};

// 3. Listen for new messages
useEffect(() => {
  socketService.onMessage((message) => {
    setMessages(prev => [...prev, message]);
  });
}, []);

// 4. Send message
const sendMessage = async (text) => {
  // Send via socket (real-time)
  socketService.sendMessage({
    senderId: currentUser._id,
    receiverId: contactId,
    text: text
  });

  // Send via API (persistence)
  const formData = new FormData();
  formData.append('senderId', currentUser._id);
  formData.append('receiverId', contactId);
  formData.append('text', text);

  await fetch(`${BASE_URL}/api/messages/send`, {
    method: 'POST',
    body: formData
  });
};

// 5. Mark as read
const markAsRead = async () => {
  await fetch(`${BASE_URL}/api/messages/mark-read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: currentUser._id,
      senderId: contactId
    })
  });
};
```

---

### Web / React

```javascript
import io from 'socket.io-client';

// 1. Connect socket
const socket = io('https://rentify-server-ge0f.onrender.com');
socket.emit('register', currentUser._id);

// 2. Load messages
const loadMessages = async () => {
  const response = await fetch(
    `https://rentify-server-ge0f.onrender.com/api/messages/${userId}/${contactId}`
  );
  const messages = await response.json();
  setMessages(messages);
};

// 3. Listen for new messages
socket.on('receive-message', (message) => {
  setMessages(prev => [...prev, message]);
});

// 4. Send message
const sendMessage = async (text) => {
  const messageData = {
    senderId: currentUser._id,
    receiverId: contactId,
    text: text
  };

  // Real-time
  socket.emit('send-message', messageData);

  // Persistence
  const formData = new FormData();
  formData.append('senderId', messageData.senderId);
  formData.append('receiverId', messageData.receiverId);
  formData.append('text', messageData.text);

  await fetch('https://rentify-server-ge0f.onrender.com/api/messages/send', {
    method: 'POST',
    body: formData
  });
};
```

---

## ⚠️ Missing Implementation

### markMessagesAsRead Controller Function

This function is referenced in routes but missing from the controller. Add this to `controllers/messageController.js`:

```javascript
exports.markMessagesAsRead = async (req, res) => {
  try {
    const { userId, senderId } = req.body;

    // Update all unread messages from senderId to userId
    const result = await Message.updateMany(
      {
        sender: senderId,
        receiver: userId,
        read: false
      },
      {
        $set: { read: true }
      }
    );

    res.status(200).json({
      success: true,
      message: 'Messages marked as read',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};
```

---

## 🔍 API Response Formats

### Message Object Structure
```javascript
{
  _id: string,           // MongoDB ObjectId
  sender: string,        // Sender's user ID
  receiver: string,      // Receiver's user ID
  message: string,       // Message text
  imageUrls: string[],   // Array of Cloudinary image URLs
  read: boolean,         // Read status
  createdAt: string,     // ISO date string
  updatedAt: string      // ISO date string
}
```

---

## 🐛 Common Issues

### Issue 1: Message not sent
**Check:**
- FormData field names: `senderId`, `receiverId`, `text`
- Content-Type should be `multipart/form-data` (set automatically by FormData)

### Issue 2: Messages not loading
**Check:**
- User IDs are valid MongoDB ObjectIds
- Users exist in database
- Correct URL format: `/api/messages/userId1/userId2`

### Issue 3: Real-time not working
**Check:**
- Socket connected: `socket.connected`
- User registered: `socket.emit('register', userId)`
- Listening to correct event: `receive-message`

### Issue 4: markMessagesAsRead fails
**Solution:** Add the missing controller function (see above)

---

## 📊 Quick Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/messages/send` | Send message with images |
| GET | `/api/messages/:userId1/:userId2` | Get conversation |
| POST | `/api/messages/mark-read` | Mark messages as read |
| DELETE | `/api/messages/:id` | Delete message |

**Socket Events:**
- `register` - Register user
- `send-message` - Send real-time message
- `receive-message` - Receive real-time message
- `mark-read` - Mark as read
- `messages-read` - Read notification

---

**Last Updated:** October 14, 2025  
**Server:** https://rentify-server-ge0f.onrender.com  
**Socket.io:** Enabled on same server  
**Status:** ✅ Ready to use (after adding markMessagesAsRead)
