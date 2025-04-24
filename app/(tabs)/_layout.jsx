<<<<<<< HEAD
import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import React from 'react'
import COLORS from '../../constant/colors'

export default function TabLayout() {
  return (
    <Tabs 
    screenOptions={{
        headerShown:false,
        tabBarActiveTintColor:COLORS.primary,
    }}>
        
        <Tabs.Screen name='index' 
        options={{
            title:"Home",
            tabBarIcon:({color,size}) => <Ionicons
             name='home-outline'
             size={size} color={color}
            />
        }}
        />
        <Tabs.Screen name='create'
         options={{
            title:"Create",
            tabBarIcon:({color,size}) => <Ionicons
             name='add-circle-outline'
             size={size} color={color}
            />
        }}/>
        <Tabs.Screen name='profile'
         options={{
            title:"Profile",
            tabBarIcon:({color,size}) => <Ionicons
             name='person-outline'
             size={size} color={color}
            />
        }}/>

    </Tabs>
  )
=======
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';

import COLORS from '../../constant/colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: '#d0f0c0',
        tabBarStyle: {
          backgroundColor: 'rgba(36, 67, 217, 0.7)',
          borderTopWidth: 0,
          height: 80,
          paddingTop:10,
          position: 'absolute',
          left: 20,
          right: 20,
          borderRadius: 14,
          shadowColor: COLORS.primary,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.4,
          shadowRadius: 20,
          elevation: 15,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
     
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'calendar' : 'calendar-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
       <Tabs.Screen
        name="create"
        options={{
          title: 'Route',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'location' : 'location-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      
      <Tabs.Screen
        name="message"
        options={{
          title: 'Message',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'chatbubble' : 'chatbubble-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
>>>>>>> my-changes
}