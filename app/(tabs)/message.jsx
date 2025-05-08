import React, { useState, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  Image, 
  TextInput, 
  SafeAreaView, 
  StyleSheet, 
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Dimensions 
} from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';

const CHAT_DATA = [
  {
    id: '1',
    name: 'John Doe',
    lastMessage: 'Hey, are you interested in the apartment?',
    avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
    unread: 2
  },
  {
    id: '2',
    name: 'Emma Smith',
    lastMessage: 'Can we schedule a viewing?',
    avatar: 'https://randomuser.me/api/portraits/women/2.jpg',
    unread: 1
  },
  {
    id: '3',
    name: 'Michael Brown',
    lastMessage: 'Sounds good!',
    avatar: 'https://randomuser.me/api/portraits/men/3.jpg',
    unread: 0
  }
];

const ChatListItem = ({ item, onPress }) => (
  <TouchableOpacity style={styles.chatItem} onPress={onPress}>
    <Image source={{ uri: item.avatar }} style={styles.avatar} />
    <View style={styles.chatDetails}>
      <Text style={styles.chatName}>{item.name}</Text>
      <Text style={styles.lastMessage} numberOfLines={1}>
        {item.lastMessage}
      </Text>
    </View>
    {item.unread > 0 && (
      <View style={styles.unreadBadge}>
        <Text style={styles.unreadText}>{item.unread}</Text>
      </View>
    )}
  </TouchableOpacity>
);

export default function MessageScreen() {
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([
    { id: '1', text: 'Hi, I saw your listing', sender: 'me' },
    { id: '2', text: 'Hello! Which apartment are you interested in?', sender: 'other' }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [inputHeight, setInputHeight] = useState(40);
  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;
  const inputRef = useRef(null);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  React.useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const renderChatList = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>
      <FlatList
        data={CHAT_DATA}
        renderItem={({ item }) => (
          <ChatListItem 
            item={item} 
            onPress={() => setSelectedChat(item)} 
          />
        )}
        keyExtractor={item => item.id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );

  const renderChatConversation = () => (
    <View style={styles.conversationContainer}>
      <View style={styles.conversationHeader}>
        <TouchableOpacity onPress={() => setSelectedChat(null)}>
          <Ionicons name='arrow-back' size={24} color='black' />
        </TouchableOpacity>
        <Image source={{ uri: selectedChat.avatar }} style={styles.headerAvatar} />
        <View style={styles.headerTextContainer}>
          <Text style={styles.conversationName}>{selectedChat.name}</Text>
          <Text style={styles.conversationStatus}>Online</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionButton}>
            <Ionicons name='call' size={24} color='#4A43EC' />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerActionButton}>
            <MaterialIcons name='video-call' size={24} color='#4A43EC' />
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={messages}
        renderItem={({ item }) => (
          <View style={[
            styles.messageContainer, 
            item.sender === 'me' ? styles.myMessage : styles.otherMessage
          ]}>
            <Text style={[
              styles.messageText, 
              item.sender === 'me' ? styles.myMessageText : styles.otherMessageText
            ]}>{item.text}</Text>
            {item.image && (
              <Image 
                source={{ uri: item.image }} 
                style={styles.messageImage} 
                resizeMode='cover' 
              />
            )}
          </View>
        )}
        keyExtractor={item => item.id}
        inverted
        contentContainerStyle={styles.messageList}
      />
      <View style={[
        styles.extendedInputContainer,
        isKeyboardVisible && styles.inputContainerKeyboard
      ]}>
        <TouchableOpacity style={styles.attachmentButton}>
          <Feather name='paperclip' size={24} color='#4A43EC' />
        </TouchableOpacity>
        <TouchableOpacity style={styles.cameraButton}>
          <Ionicons name='camera' size={24} color='#4A43EC' />
        </TouchableOpacity>
        <TextInput
          ref={inputRef}
          style={[
            styles.input, 
            { 
              height: Math.max(40, inputHeight),
              minHeight: 40,
              maxHeight: 120
            }
          ]}
          placeholder='Type a message...'
          placeholderTextColor='#A0A0A0'
          value={newMessage}
          onChangeText={(text) => {
            setNewMessage(text);
          }}
          multiline
          textAlignVertical='top'
          scrollEnabled={false}
          autoCorrect={false}
          autoCapitalize='sentences'
          blurOnSubmit={false}
          maxLength={500}
          onContentSizeChange={(event) => {
            const height = event.nativeEvent.contentSize.height;
            setInputHeight(Math.min(height, 120));
          }}
        />
        <TouchableOpacity style={styles.sendButton}>
          <Ionicons name='send' size={24} color='white' />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.safeArea}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {selectedChat ? (
        <View style={styles.conversationWrapper}>
          {renderChatConversation()}
        </View>
      ) : (
        <View style={styles.chatListWrapper}>
          {renderChatList()}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  headerTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerActionButton: {
    marginLeft: 10,
  },
  conversationStatus: {
    fontSize: 12,
    color: '#4A43EC',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F7FC', // Soft background color
    paddingBottom: 80
  },
  conversationWrapper: {
    flex: 1,
    backgroundColor: 'white',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    overflow: 'hidden'
  },
  chatListWrapper: {
    flex: 1,
    backgroundColor: 'white',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden'
  },
  container: {
    flex: 1,
    backgroundColor: 'white'
  },
  header: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold'
  },
  chatItem: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center'
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15
  },
  chatDetails: {
    flex: 1
  },
  chatName: {
    fontSize: 16,
    fontWeight: 'bold'
  },
  lastMessage: {
    color: '#888',
    marginTop: 5
  },
  unreadBadge: {
    backgroundColor: '#3498db',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  unreadText: {
    color: 'white',
    fontSize: 12
  },
  separator: {
    height: 1,
    backgroundColor: '#e0e0e0'
  },
  conversationContainer: {
    flex: 1,
    backgroundColor: 'white',
    paddingBottom: 80 // Additional bottom padding for input visibility
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F7F7FC',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E6'
  },
  headerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginHorizontal: 10,
    borderWidth: 2,
    borderColor: '#4A43EC'
  },
  conversationName: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 15,
    marginVertical: 5,
    marginHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#4A43EC', // Modern primary color
    color: 'white'
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F0F3', // Light gray background
    color: '#333'
  },
  messageText: {
    fontSize: 16,
  },
  myMessageText: {
    color: 'white',
  },
  otherMessageText: {
    color: '#333',
  },
  messageImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginTop: 10,
  },
  messageList: {
    paddingHorizontal: 15,
  },
  extendedInputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#F7F7FC',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E6',
    borderRadius: 25,
    margin: 10,
    minHeight: 60
  },
  inputContainerKeyboard: {
    marginBottom: 10,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000
  },
  attachmentButton: {
    marginRight: 10,
  },
  cameraButton: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 12,
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    minHeight: 40,
    maxHeight: 120,
    lineHeight: 20,
    verticalAlign: 'top',
    textAlignVertical: 'top',
    includeFontPadding: false
  },
  sendButton: {
    backgroundColor: '#4A43EC', // Modern primary color
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4A43EC',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5
  }
});