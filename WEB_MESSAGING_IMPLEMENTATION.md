# 💬 Rentify Web Messaging Implementation Guide

**For Mobile Developers** - Complete reference on how messaging is implemented in the web application

**Version:** 1.0.0  
**Date:** October 14, 2025  
**File:** `app/messages/page.tsx`

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Data Flow](#data-flow)
3. [WebSocket Integration](#websocket-integration)
4. [State Management](#state-management)
5. [User Authentication](#user-authentication)
6. [Message Types & Structure](#message-types--structure)
7. [Key Features Implementation](#key-features-implementation)
8. [UI/UX Patterns](#uiux-patterns)
9. [Code Examples](#code-examples)
10. [Mobile Integration Guide](#mobile-integration-guide)

---

## 🏗️ Architecture Overview

### Component Structure

```
MessagesPage
├── Sidebar (Contacts List)
│   ├── Search Bar
│   ├── Contact Items
│   └── Unread Badges
│
└── Chat Panel
    ├── Header (Contact Info)
    ├── Messages Container
    │   ├── Message Bubbles
    │   ├── Reactions
    │   └── Read Receipts
    └── Input Area
        ├── File Upload
        ├── Text Input
        └── Send Button
```

### Technology Stack

- **Frontend:** React (Next.js 14), TypeScript
- **State Management:** React Hooks (useState, useEffect, useRef)
- **Real-time:** Socket.IO Client
- **Styling:** Tailwind CSS + shadcn/ui components
- **API Calls:** Fetch API + Custom API utilities

---

## 🔄 Data Flow

### 1. **Initial Load Flow**

```
User Opens /messages
    ↓
Check localStorage for auth-storage
    ↓
Extract user data from Zustand store
    ↓
Initialize WebSocket with user._id
    ↓
Fetch all users from backend
    ↓
For each user: Check if conversation exists
    ↓
Build contacts list (only users with messages)
    ↓
Sort by lastMessageTime (most recent first)
    ↓
Auto-select first contact
    ↓
Load messages for selected contact
```

### 2. **Sending Message Flow**

```
User types message → handleTyping()
    ↓
Emit 'typing-start' via WebSocket
    ↓
User clicks Send → handleSend()
    ↓
Check if images attached
    ↓
YES: Use REST API (/api/messages)
    ↓
NO: Use WebSocket emit('private-message')
    ↓
Add message to local state (optimistic update)
    ↓
Update contact's lastMessageTime
    ↓
Sort contacts list
    ↓
Emit 'typing-stop'
```

### 3. **Receiving Message Flow**

```
WebSocket receives 'private-message' event
    ↓
Format message with fromMe flag
    ↓
Determine contactId (sender or receiver)
    ↓
Update messageCache for contact
    ↓
If message is from selected contact:
    ↓
    Add to messages state
    ↓
Update contact's unread count & lastMessageTime
    ↓
Sort contacts list
```

---

## 🔌 WebSocket Integration

### Connection Setup

**File:** `lib/socket.ts`

```typescript
// Initialize socket connection
const socket = initializeSocket(user._id)

// WebSocket URL
const SOCKET_URL = 'https://rentify-server-ge0f.onrender.com'

// Connection with auth
io(SOCKET_URL, {
  auth: { userId: user._id },
  transports: ['websocket', 'polling']
})
```

### WebSocket Events

#### **Events Emitted by Client:**

| Event | Payload | Purpose |
|-------|---------|---------|
| `private-message` | `{ senderId, receiverId, text, images }` | Send text message |
| `typing-start` | `{ senderId, receiverId }` | Notify typing started |
| `typing-stop` | `{ senderId, receiverId }` | Notify typing stopped |
| `mark-as-read` | `{ userId, otherUserId }` | Mark messages as read |

#### **Events Listened by Client:**

| Event | Payload | Handler |
|-------|---------|---------|
| `private-message` | `MessageData` | Add to messages, update contacts |
| `typing-start` | `{ senderId }` | Show typing indicator |
| `typing-stop` | `{ senderId }` | Hide typing indicator |
| `messages-read` | `{ readBy, count }` | Update read receipts |

### Implementation in Web

```typescript
// Listen for incoming messages
socket.on('private-message', (newMessage: MessageData) => {
  const formattedMessage: Message = {
    ...newMessage,
    fromMe: newMessage.sender === user._id,
    time: 'now',
    type: newMessage.imageUrls?.length > 0 ? 'image' : 'text'
  }

  // Add to cache
  setMessageCache(prev => {
    const newCache = new Map(prev)
    const contactId = newMessage.sender === user._id 
      ? newMessage.receiver 
      : newMessage.sender
    const contactMessages = newCache.get(contactId) || []
    newCache.set(contactId, [...contactMessages, formattedMessage])
    return newCache
  })

  // Update UI if message is from selected contact
  if (selectedContact && 
      (newMessage.sender === selectedContact || 
       newMessage.receiver === selectedContact)) {
    setMessages(prev => [...prev, formattedMessage])
  }
})

// Listen for typing indicators
socket.on('typing-start', ({ senderId }) => {
  setContacts(prev => prev.map(contact => 
    contact.id === senderId ? { ...contact, typing: true } : contact
  ))
})

socket.on('typing-stop', ({ senderId }) => {
  setContacts(prev => prev.map(contact => 
    contact.id === senderId ? { ...contact, typing: false } : contact
  ))
})

// Listen for read receipts
socket.on('messages-read', ({ readBy, count }) => {
  setMessages(prev => prev.map(msg => 
    msg.fromMe && msg.receiver === readBy 
      ? { ...msg, read: true } 
      : msg
  ))
})
```

---

## 📊 State Management

### State Variables

```typescript
// User & Authentication
const [currentUser, setCurrentUser] = useState<User | null>(null)

// Contacts Management
const [contacts, setContacts] = useState<Contact[]>([])
const [selectedContact, setSelectedContact] = useState<string | null>(null)
const [searchQuery, setSearchQuery] = useState("")

// Messages
const [messages, setMessages] = useState<Message[]>([])
const [input, setInput] = useState("")

// UI States
const [isConnected, setIsConnected] = useState(false)
const [isLoading, setIsLoading] = useState(false)
const [isInitialLoading, setIsInitialLoading] = useState(true)

// File Upload
const [imagePreview, setImagePreview] = useState<string | null>(null)
const [selectedFiles, setSelectedFiles] = useState<File[]>([])

// Performance Optimization
const [messageCache, setMessageCache] = useState<Map<string, Message[]>>(new Map())
const [loadedConversations, setLoadedConversations] = useState<Set<string>>(new Set())
const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

// Refs
const fileInputRef = useRef<HTMLInputElement>(null)
const messagesEndRef = useRef<HTMLDivElement>(null)
const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
```

### Data Types

```typescript
// Message Type (MongoDB structure)
type Message = {
  _id: string
  sender: string          // User ID
  receiver: string        // User ID
  message?: string        // Text content
  imageUrls?: string[]    // Array of image URLs
  read: boolean
  createdAt: string       // ISO timestamp
  updatedAt: string       // ISO timestamp
  
  // UI-specific fields
  fromMe?: boolean
  time?: string
  reactions?: { emoji: string; count: number }[]
  type?: 'text' | 'image'
}

// Contact Type
type Contact = {
  id: string              // User ID
  name: string            // Display name
  avatar: string          // First letter of name
  profilePicture?: string // URL to profile picture
  unread: number          // Unread message count
  online: boolean         // Online status
  lastSeen?: string       // Last seen text
  typing?: boolean        // Is typing indicator
  lastMessageTime?: number // Timestamp for sorting
}

// User Type (from auth-storage)
type User = {
  _id: string
  username: string
  name?: string
  email: string
  fullName?: string
  profilePicture?: string
}
```

---

## 🔐 User Authentication

### How Auth Works in Web

The web app uses **Zustand** for state management, stored in `localStorage` with key `auth-storage`.

```typescript
// Get current user from localStorage
const authStorageData = localStorage.getItem("auth-storage")

if (authStorageData) {
  const authStore = JSON.parse(authStorageData)
  const user = authStore.state?.user
  
  // user object contains:
  // {
  //   _id: "681b26b2c58b946b8d16dacf",
  //   username: "maria_santos",
  //   email: "maria@example.com",
  //   fullName: "Maria Santos",
  //   profilePicture: "https://..."
  // }
  
  setCurrentUser(user)
  
  // Use user._id for WebSocket connection
  initializeSocket(user._id)
}
```

### Auth Storage Structure

```json
{
  "state": {
    "user": {
      "_id": "681b26b2c58b946b8d16dacf",
      "username": "maria_santos",
      "email": "maria@example.com",
      "fullName": "Maria Santos",
      "profilePicture": "https://res.cloudinary.com/..."
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "isAuthenticated": true
  },
  "version": 0
}
```

---

## 📨 Message Types & Structure

### Text Message

```typescript
{
  _id: "msg123",
  sender: "user1_id",
  receiver: "user2_id",
  message: "Hello! Is this property still available?",
  read: false,
  createdAt: "2025-10-14T10:30:00.000Z",
  updatedAt: "2025-10-14T10:30:00.000Z",
  fromMe: true,
  time: "10:30 AM",
  type: "text"
}
```

### Image Message

```typescript
{
  _id: "msg456",
  sender: "user1_id",
  receiver: "user2_id",
  message: "Check out these photos!",
  imageUrls: [
    "https://res.cloudinary.com/dxlqh5rw0/image/upload/v1234567890/image1.jpg",
    "https://res.cloudinary.com/dxlqh5rw0/image/upload/v1234567891/image2.jpg"
  ],
  read: false,
  createdAt: "2025-10-14T10:35:00.000Z",
  updatedAt: "2025-10-14T10:35:00.000Z",
  fromMe: true,
  time: "10:35 AM",
  type: "image"
}
```

### Message with Reactions

```typescript
{
  _id: "msg789",
  sender: "user2_id",
  receiver: "user1_id",
  message: "That looks great!",
  read: true,
  createdAt: "2025-10-14T10:40:00.000Z",
  updatedAt: "2025-10-14T10:40:00.000Z",
  fromMe: false,
  time: "10:40 AM",
  type: "text",
  reactions: [
    { emoji: "❤️", count: 2 },
    { emoji: "👍", count: 1 }
  ]
}
```

---

## ⚡ Key Features Implementation

### 1. **Typing Indicators**

Shows real-time typing status with debouncing.

```typescript
// Debounced typing handler
const handleTyping = () => {
  if (!currentUser || !selectedContact) return

  const socket = getSocket()
  if (!socket) return

  // Emit typing-start
  socket.emit('typing-start', { 
    senderId: currentUser._id, 
    receiverId: selectedContact 
  })

  // Clear existing timeout
  if (typingTimeoutRef.current) {
    clearTimeout(typingTimeoutRef.current)
  }

  // Stop typing after 500ms of inactivity
  typingTimeoutRef.current = setTimeout(() => {
    socket.emit('typing-stop', { 
      senderId: currentUser._id, 
      receiverId: selectedContact 
    })
  }, 500)
}

// On input change
<Input
  value={input}
  onChange={(e) => {
    setInput(e.target.value)
    handleTyping()  // Trigger typing indicator
  }}
/>
```

**UI Display:**

```typescript
// In contact list
{contact.typing && (
  <div className="flex space-x-1">
    <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce"></div>
    <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce" 
         style={{ animationDelay: '0.1s' }}></div>
    <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce" 
         style={{ animationDelay: '0.2s' }}></div>
  </div>
)}
```

---

### 2. **Read Receipts**

Shows message delivery and read status.

```typescript
// Message read indicators
{message.fromMe && (
  <div className="flex items-center">
    {message.read ? (
      // Double check for read
      <div className="flex">
        <Check className="h-3 w-3" />
        <Check className="h-3 w-3 -ml-2" />
      </div>
    ) : (
      // Single check for delivered
      <Check className="h-3 w-3" />
    )}
  </div>
)}
```

**Mark as Read on View:**

```typescript
// When user selects a contact
useEffect(() => {
  if (currentUser && selectedContact) {
    // Fetch messages
    fetchMessages(currentUser._id, selectedContact)
      .then((fetchedMessages) => {
        // ... set messages
        
        // Mark unread messages as read
        const socket = getSocket()
        const unreadMessages = fetchedMessages.filter(
          msg => msg.receiver === currentUser._id && !msg.read
        )
        
        if (unreadMessages.length > 0) {
          socket?.emit('mark-as-read', { 
            userId: currentUser._id, 
            otherUserId: selectedContact 
          })
        }
      })
  }
}, [selectedContact])
```

---

### 3. **Message Caching**

Prevents re-fetching messages when switching between contacts.

```typescript
// Cache structure
const [messageCache, setMessageCache] = useState<Map<string, Message[]>>(new Map())

// On contact select - check cache first
useEffect(() => {
  if (currentUser && selectedContact) {
    // Check cache
    if (messageCache.has(selectedContact)) {
      console.log('Loading from cache')
      setMessages(messageCache.get(selectedContact) || [])
      return // Skip API call
    }

    // Fetch from API
    fetchMessages(currentUser._id, selectedContact)
      .then((fetchedMessages) => {
        // Format messages
        const formattedMessages = fetchedMessages.map(msg => ({...}))
        
        // Store in cache
        setMessageCache(prev => 
          new Map(prev).set(selectedContact, formattedMessages)
        )
        
        setMessages(formattedMessages)
      })
  }
}, [selectedContact])

// Update cache on new message
socket.on('private-message', (newMessage) => {
  const contactId = newMessage.sender === user._id 
    ? newMessage.receiver 
    : newMessage.sender
  
  setMessageCache(prev => {
    const newCache = new Map(prev)
    const contactMessages = newCache.get(contactId) || []
    newCache.set(contactId, [...contactMessages, formattedMessage])
    return newCache
  })
})
```

---

### 4. **Contact Sorting by Recent Activity**

Contacts are always sorted by most recent message.

```typescript
// Update lastMessageTime on new message
setContacts(prev => {
  const updatedContacts = prev.map(contact =>
    contact.id === senderId || contact.id === receiverId
      ? { ...contact, lastMessageTime: Date.now() }
      : contact
  )
  
  // Sort by lastMessageTime (descending)
  return updatedContacts.sort((a, b) => 
    (b.lastMessageTime || 0) - (a.lastMessageTime || 0)
  )
})
```

---

### 5. **Unread Count Management**

Tracks unread messages per contact.

```typescript
// Increment unread on new message (if not selected)
socket.on('private-message', (newMessage) => {
  const senderId = newMessage.sender
  
  setContacts(prev => prev.map(contact => {
    if (contact.id === senderId && selectedContact !== senderId) {
      return { ...contact, unread: contact.unread + 1 }
    }
    return contact
  }))
})

// Reset unread when contact is selected
useEffect(() => {
  if (selectedContact) {
    setContacts(prev => prev.map(contact => 
      contact.id === selectedContact 
        ? { ...contact, unread: 0 } 
        : contact
    ))
  }
}, [selectedContact])
```

**UI Display:**

```tsx
{contact.unread > 0 && (
  <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
    {contact.unread}
  </div>
)}
```

---

### 6. **Image Upload**

Handles image uploads with preview and REST API.

```typescript
const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(event.target.files || [])
  
  if (files.length > 0) {
    setSelectedFiles(files.slice(0, 5)) // Max 5 images
    
    // Show preview of first image
    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string)
    }
    reader.readAsDataURL(files[0])
  }
}

// Send with images
const handleSend = async () => {
  if (selectedFiles.length > 0) {
    // Use REST API for images
    const newMessage = await sendMessageAPI(
      currentUser._id,
      selectedContact,
      messageText || undefined,
      selectedFiles
    )
    
    setMessages(prev => [...prev, {
      ...newMessage,
      fromMe: true,
      time: 'now',
      type: 'image'
    }])
    
    setSelectedFiles([])
    setImagePreview(null)
  }
}
```

---

### 7. **Auto-scroll to Bottom**

Automatically scrolls to latest message.

```typescript
// Ref at the end of messages container
const messagesEndRef = useRef<HTMLDivElement>(null)

// Auto-scroll on new messages
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
}, [messages])

// In JSX
<div className="flex-1 overflow-y-auto p-6 space-y-4">
  {messages.map((message) => (
    <MessageBubble key={message._id} message={message} />
  ))}
  <div ref={messagesEndRef} />
</div>
```

---

### 8. **Contact from Property Page**

Handles navigation from property page with contact ID.

```typescript
// Check URL for contact parameter
useEffect(() => {
  if (contacts.length > 0) {
    const urlParams = new URLSearchParams(window.location.search)
    const contactId = urlParams.get('contact')
    
    if (contactId) {
      const contactExists = contacts.find(c => c.id === contactId)
      
      if (contactExists) {
        setSelectedContact(contactId)
        // Clean URL
        window.history.replaceState({}, '', '/messages')
      }
    }
  }
}, [contacts])
```

**From Property Page:**

```typescript
// Navigate to messages with contact ID
router.push(`/messages?contact=${ownerId}`)
```

---

### 9. **Message Reactions**

Add emoji reactions to messages.

```typescript
const addReaction = (messageId: string, emoji: string) => {
  setMessages(prev => prev.map(msg => {
    if (msg._id === messageId) {
      const reactions = msg.reactions || []
      const existingReaction = reactions.find(r => r.emoji === emoji)
      
      if (existingReaction) {
        existingReaction.count += 1
      } else {
        reactions.push({ emoji, count: 1 })
      }
      
      return { ...msg, reactions }
    }
    return msg
  }))
}
```

**UI Display:**

```tsx
{message.reactions && message.reactions.length > 0 && (
  <div className="flex gap-1 mt-1">
    {message.reactions.map((reaction, idx) => (
      <div key={idx} className="bg-white border rounded-full px-2 py-1 text-xs">
        <span>{reaction.emoji}</span>
        <span>{reaction.count}</span>
      </div>
    ))}
  </div>
)}
```

---

### 10. **Delete Message**

Delete own messages with confirmation.

```typescript
const handleDeleteMessage = async (messageId: string) => {
  if (!confirm('Are you sure you want to delete this message?')) {
    return
  }

  try {
    await deleteMessage(messageId)
    setMessages(prev => prev.filter(msg => msg._id !== messageId))
  } catch (error) {
    console.error('Error deleting message:', error)
    alert('Failed to delete message')
  }
}
```

---

## 🎨 UI/UX Patterns

### Loading States

```typescript
// Initial page load
if (isInitialLoading) {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-600"></div>
      <p>Loading messages...</p>
    </div>
  )
}

// Loading messages for contact
{isLoading ? (
  <div className="flex items-center justify-center h-full">
    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600"></div>
  </div>
) : (
  // Show messages
)}
```

### Empty States

```typescript
// No contacts
{contacts.length === 0 && (
  <div className="flex flex-col items-center justify-center h-full">
    <MessageCircle className="h-8 w-8 text-purple-600" />
    <h3>No Conversations Yet</h3>
    <p>Start a conversation by sending a message</p>
  </div>
)}

// No messages in conversation
{messages.length === 0 && (
  <div className="flex items-center justify-center h-full">
    <MessageCircle className="h-16 w-16 opacity-50" />
    <p>No messages yet</p>
    <p>Start the conversation!</p>
  </div>
)}
```

### Connection Status

```tsx
{!isConnected && (
  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
    <span>Connecting to server...</span>
  </div>
)}

{isConnected && (
  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
    <span>✓ Connected to real-time messaging</span>
  </div>
)}
```

### Message Bubble Design

```tsx
<div className={`px-4 py-3 rounded-2xl shadow-sm ${
  message.fromMe
    ? "bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white"
    : "bg-white text-slate-800 border border-slate-100"
}`}>
  <p>{message.message}</p>
  <div className="text-xs mt-2 flex items-center gap-1">
    <span>{message.time}</span>
    {message.fromMe && (
      message.read ? <CheckCheck /> : <Check />
    )}
  </div>
</div>
```

### Profile Pictures

```tsx
{contact.profilePicture ? (
  <img 
    src={contact.profilePicture.startsWith('http') 
      ? contact.profilePicture 
      : `https://rentify-server-ge0f.onrender.com${contact.profilePicture}`
    }
    alt={contact.name}
    className="w-12 h-12 rounded-full object-cover"
    onError={(e) => {
      // Fallback to avatar letter
      e.target.style.display = 'none'
      // Show fallback div
    }}
  />
) : (
  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-400 flex items-center justify-center">
    {contact.avatar}
  </div>
)}
```

---

## 💻 Code Examples

### Complete Send Message Flow

```typescript
const handleSend = async () => {
  if (!currentUser || !selectedContact) return
  if (!input.trim() && selectedFiles.length === 0) return
  
  const socket = getSocket()
  const messageText = input.trim()
  
  // With images - use REST API
  if (selectedFiles.length > 0) {
    try {
      const newMessage = await sendMessageAPI(
        currentUser._id,
        selectedContact,
        messageText || undefined,
        selectedFiles
      )
      
      setMessages(prev => [...prev, {
        ...newMessage,
        fromMe: true,
        time: 'now',
        type: 'image'
      }])
      
      setContacts(prev => {
        const updatedContacts = prev.map(contact =>
          contact.id === selectedContact 
            ? { ...contact, lastMessageTime: Date.now() } 
            : contact
        )
        return updatedContacts.sort((a, b) => 
          (b.lastMessageTime || 0) - (a.lastMessageTime || 0)
        )
      })
      
      setInput("")
      setSelectedFiles([])
      setImagePreview(null)
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to send message')
    }
  } 
  // Text only - use WebSocket
  else {
    const tempMessage: Message = {
      _id: Date.now().toString(),
      sender: currentUser._id,
      receiver: selectedContact,
      message: messageText,
      read: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fromMe: true,
      time: 'now',
      type: 'text'
    }
    
    setMessages(prev => [...prev, tempMessage])
    
    setContacts(prev => {
      const updatedContacts = prev.map(contact =>
        contact.id === selectedContact 
          ? { ...contact, lastMessageTime: Date.now() } 
          : contact
      )
      return updatedContacts.sort((a, b) => 
        (b.lastMessageTime || 0) - (a.lastMessageTime || 0)
      )
    })
    
    setInput("")
    
    socket?.emit('typing-stop', { 
      senderId: currentUser._id, 
      receiverId: selectedContact 
    })
    
    socket?.emit('private-message', {
      senderId: currentUser._id,
      receiverId: selectedContact,
      text: messageText,
      images: []
    })
  }
}
```

### Complete Receive Message Flow

```typescript
socket.on('private-message', (newMessage: MessageData) => {
  console.log('Received message:', newMessage)
  
  const formattedMessage: Message = {
    ...newMessage,
    fromMe: newMessage.sender === user._id,
    time: 'now',
    type: newMessage.imageUrls?.length > 0 ? 'image' : 'text'
  }

  // Determine contact ID
  const contactId = newMessage.sender === user._id 
    ? newMessage.receiver 
    : newMessage.sender
  
  // Update cache
  setMessageCache(prev => {
    const newCache = new Map(prev)
    const contactMessages = newCache.get(contactId) || []
    newCache.set(contactId, [...contactMessages, formattedMessage])
    return newCache
  })

  // Update messages if from selected contact
  if (selectedContact && 
      (newMessage.sender === selectedContact || 
       newMessage.receiver === selectedContact)) {
    setMessages(prev => [...prev, formattedMessage])
  }
  
  // Update contacts list
  setContacts(prev => {
    const senderId = newMessage.sender
    const existingContact = prev.find(c => c.id === senderId)
    
    // Add new contact if doesn't exist
    if (!existingContact && senderId !== user._id) {
      fetchUsers().then(users => {
        const sender = users.find(u => u._id === senderId)
        if (sender) {
          const newContact: Contact = {
            id: sender._id,
            name: sender.fullName || sender.username,
            avatar: sender.fullName.charAt(0).toUpperCase(),
            profilePicture: sender.profilePicture,
            unread: selectedContact !== senderId ? 1 : 0,
            online: false,
            lastSeen: "Recently",
            lastMessageTime: Date.now()
          }
          setContacts(prevContacts => {
            const updated = [...prevContacts, newContact]
            return updated.sort((a, b) => 
              (b.lastMessageTime || 0) - (a.lastMessageTime || 0)
            )
          })
        }
      })
      return prev
    }
    
    // Update existing contact
    const updatedContacts = prev.map(contact => {
      if (contact.id === senderId && selectedContact !== senderId) {
        return { 
          ...contact, 
          unread: contact.unread + 1, 
          lastMessageTime: Date.now() 
        }
      }
      if (contact.id === senderId || contact.id === newMessage.receiver) {
        return { ...contact, lastMessageTime: Date.now() }
      }
      return contact
    })
    
    return updatedContacts.sort((a, b) => 
      (b.lastMessageTime || 0) - (a.lastMessageTime || 0)
    )
  })
})
```

---

## 📱 Mobile Integration Guide

### Key Differences: Web vs Mobile

| Feature | Web Implementation | Mobile Recommendation |
|---------|-------------------|----------------------|
| **State Management** | React Hooks | Redux/MobX/Context API |
| **Storage** | localStorage | AsyncStorage (React Native) / SharedPreferences (Android) / UserDefaults (iOS) |
| **WebSocket** | Socket.IO Client (browser) | Socket.IO Client (mobile) |
| **Image Upload** | FileReader API | ImagePicker API |
| **Navigation** | Next.js router | React Navigation / Native Navigation |
| **Styling** | Tailwind CSS | React Native StyleSheet / styled-components |

### Mobile Implementation Steps

#### **1. Setup WebSocket Service**

```javascript
// services/websocket.js (React Native)
import io from 'socket.io-client'
import AsyncStorage from '@react-native-async-storage/async-storage'

const SOCKET_URL = 'https://rentify-server-ge0f.onrender.com'

class WebSocketService {
  constructor() {
    this.socket = null
  }

  async connect(userId) {
    this.socket = io(SOCKET_URL, {
      auth: { userId },
      transports: ['websocket', 'polling']
    })

    this.socket.on('connect', () => {
      console.log('✅ Connected to server')
    })

    this.socket.on('private-message', (message) => {
      // Handle incoming message
      // Update local state / Redux store
    })

    this.socket.on('typing-start', ({ senderId }) => {
      // Show typing indicator
    })

    this.socket.on('typing-stop', ({ senderId }) => {
      // Hide typing indicator
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
    }
  }

  sendMessage(senderId, receiverId, text) {
    this.socket?.emit('private-message', {
      senderId,
      receiverId,
      text,
      images: []
    })
  }

  emitTyping(senderId, receiverId) {
    this.socket?.emit('typing-start', { senderId, receiverId })
  }

  stopTyping(senderId, receiverId) {
    this.socket?.emit('typing-stop', { senderId, receiverId })
  }
}

export default new WebSocketService()
```

#### **2. Fetch User Authentication**

```javascript
// Get user from AsyncStorage (similar to web localStorage)
const getUserData = async () => {
  try {
    const authData = await AsyncStorage.getItem('auth-storage')
    if (authData) {
      const { state } = JSON.parse(authData)
      return state?.user
    }
    return null
  } catch (error) {
    console.error('Error getting user data:', error)
    return null
  }
}

// Usage
const user = await getUserData()
if (user) {
  WebSocketService.connect(user._id)
}
```

#### **3. Contacts List Screen**

```javascript
// screens/ConversationsScreen.js (React Native)
import React, { useState, useEffect } from 'react'
import { View, FlatList, TouchableOpacity, Text } from 'react-native'
import WebSocketService from '../services/websocket'
import { fetchUsers, fetchMessages } from '../services/api'

export default function ConversationsScreen({ navigation }) {
  const [contacts, setContacts] = useState([])
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    // Get current user
    getUserData().then(user => {
      setCurrentUser(user)
      WebSocketService.connect(user._id)
    })

    // Fetch contacts
    loadContacts()

    // Listen for new messages
    WebSocketService.socket?.on('private-message', handleNewMessage)

    return () => {
      WebSocketService.disconnect()
    }
  }, [])

  const loadContacts = async () => {
    const users = await fetchUsers()
    const contactsWithMessages = []

    for (const user of users) {
      const messages = await fetchMessages(currentUser._id, user._id)
      if (messages.length > 0) {
        contactsWithMessages.push({
          id: user._id,
          name: user.fullName || user.username,
          avatar: user.profilePicture,
          unread: 0,
          lastMessageTime: new Date(messages[messages.length - 1].createdAt).getTime()
        })
      }
    }

    // Sort by most recent
    contactsWithMessages.sort((a, b) => b.lastMessageTime - a.lastMessageTime)
    setContacts(contactsWithMessages)
  }

  const handleNewMessage = (message) => {
    // Update contact list
    // Increment unread if not viewing conversation
  }

  const renderContact = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('Chat', { 
        contactId: item.id,
        contactName: item.name 
      })}
    >
      <View style={styles.contactItem}>
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        <Text style={styles.name}>{item.name}</Text>
        {item.unread > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unread}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <FlatList
        data={contacts}
        renderItem={renderContact}
        keyExtractor={item => item.id}
      />
    </View>
  )
}
```

#### **4. Chat Screen**

```javascript
// screens/ChatScreen.js (React Native)
import React, { useState, useEffect } from 'react'
import { View, FlatList, TextInput, TouchableOpacity } from 'react-native'
import { GiftedChat } from 'react-native-gifted-chat'
import WebSocketService from '../services/websocket'
import { fetchMessages } from '../services/api'

export default function ChatScreen({ route }) {
  const { contactId, contactName } = route.params
  const [messages, setMessages] = useState([])
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    // Get current user
    getUserData().then(user => setCurrentUser(user))

    // Load messages
    loadMessages()

    // Listen for new messages
    WebSocketService.socket?.on('private-message', handleNewMessage)

    return () => {
      // Cleanup
    }
  }, [])

  const loadMessages = async () => {
    const fetchedMessages = await fetchMessages(currentUser._id, contactId)
    
    // Convert to GiftedChat format
    const giftedMessages = fetchedMessages.map(msg => ({
      _id: msg._id,
      text: msg.message,
      createdAt: new Date(msg.createdAt),
      user: {
        _id: msg.sender,
        name: msg.sender === currentUser._id ? 'You' : contactName
      }
    })).reverse()

    setMessages(giftedMessages)
  }

  const handleNewMessage = (message) => {
    if (message.sender === contactId || message.receiver === contactId) {
      const giftedMessage = {
        _id: message._id,
        text: message.message,
        createdAt: new Date(message.createdAt),
        user: {
          _id: message.sender,
          name: message.sender === currentUser._id ? 'You' : contactName
        }
      }
      setMessages(prev => GiftedChat.append(prev, [giftedMessage]))
    }
  }

  const onSend = (newMessages = []) => {
    const message = newMessages[0]
    
    // Optimistically add message
    setMessages(prev => GiftedChat.append(prev, newMessages))

    // Send via WebSocket
    WebSocketService.sendMessage(
      currentUser._id,
      contactId,
      message.text
    )
  }

  return (
    <GiftedChat
      messages={messages}
      onSend={onSend}
      user={{ _id: currentUser?._id }}
    />
  )
}
```

#### **5. Message Caching (AsyncStorage)**

```javascript
// Cache messages in AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage'

const CACHE_KEY_PREFIX = 'messages_'

// Save messages to cache
const cacheMessages = async (contactId, messages) => {
  try {
    await AsyncStorage.setItem(
      `${CACHE_KEY_PREFIX}${contactId}`,
      JSON.stringify(messages)
    )
  } catch (error) {
    console.error('Error caching messages:', error)
  }
}

// Load messages from cache
const loadCachedMessages = async (contactId) => {
  try {
    const cached = await AsyncStorage.getItem(`${CACHE_KEY_PREFIX}${contactId}`)
    return cached ? JSON.parse(cached) : null
  } catch (error) {
    console.error('Error loading cached messages:', error)
    return null
  }
}

// Usage in ChatScreen
useEffect(() => {
  // Try to load from cache first
  loadCachedMessages(contactId).then(cachedMessages => {
    if (cachedMessages) {
      setMessages(cachedMessages)
    }
  })

  // Then fetch fresh data
  loadMessages().then(freshMessages => {
    setMessages(freshMessages)
    cacheMessages(contactId, freshMessages)
  })
}, [contactId])
```

---

## 🎯 Summary for Mobile Developers

### Must-Have Features

✅ **Real-time WebSocket connection** with Socket.IO  
✅ **Message caching** for offline/quick access  
✅ **Typing indicators** for better UX  
✅ **Read receipts** (single/double check)  
✅ **Unread count** per contact  
✅ **Contact sorting** by most recent message  
✅ **Auto-scroll** to bottom on new messages  
✅ **Image upload** support  
✅ **Profile pictures** with fallback avatars  
✅ **Loading states** and error handling  
✅ **Empty states** for better UX

### Key Takeaways

1. **Use WebSocket for text messages** - Instant delivery
2. **Use REST API for images** - Better handling of multipart data
3. **Implement message caching** - Faster load times
4. **Sort contacts by recent activity** - Most relevant first
5. **Update UI optimistically** - Better perceived performance
6. **Handle connection status** - Show user when offline
7. **Debounce typing indicators** - Reduce server load
8. **Mark messages as read** - Good UX practice
9. **Support deep linking** - Navigate from property page
10. **Cache user profiles** - Reduce API calls

### API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/users` | GET | Fetch all users |
| `/api/messages?userId1=&userId2=` | GET | Fetch messages between two users |
| `/api/messages` | POST | Send message with images |
| `/api/messages/:messageId` | DELETE | Delete message |

### WebSocket Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `private-message` | Send & Receive | Send/receive messages |
| `typing-start` | Send & Receive | Start typing indicator |
| `typing-stop` | Send & Receive | Stop typing indicator |
| `mark-as-read` | Send | Mark messages as read |
| `messages-read` | Receive | Receive read receipts |

---

**Questions?** Refer to:
- Web implementation: `app/messages/page.tsx`
- API documentation: `MOBILE_API_DOCUMENTATION.md`
- WebSocket library: `lib/socket.ts`
- API utilities: `lib/api.ts`

---

**Last Updated:** October 14, 2025  
**Created For:** Mobile Development Team  
**Contact:** development@rentify.com
