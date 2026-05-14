# ECHOES - Specification Document

## Table of Contents
1. [Introduction](#1-introduction)
2. [Core Philosophy](#2-core-philosophy)
3. [User Experience Overview](#3-user-experience-overview)
4. [Functional Requirements](#4-functional-requirements)
5. [Privacy System](#5-privacy-system)
6. [Community System](#6-community-system)
7. [Emotion Zone System](#7-emotion-zone-system)
8. [Technical Architecture](#8-technical-architecture)
9. [UI/UX Design Guidelines](#9-uiux-design-guidelines)
10. [Phased Development Plan](#10-phased-development-plan)
11. [Non-Functional Requirements](#11-non-functional-requirements)

---

## 1. Introduction

### Project Name
**ECHOES** - Location Memory System

### Project Type
Cross-platform mobile application (AR-enabled)

### Core Summary
A location-based AR app where memories attach to places, not people. Every location accumulates a living "vibe" based on the collective emotional energy of memories left there. The place remembers - people are just temporary custodians passing memories to future generations.

### Target Audience
- General users who want to preserve location-based memories
- Alumni associations wanting to preserve campus memories
- Community groups building collective memory archives
- Anyone interested in intergenerational memory transfer

### Target Region
Initially India (with mid-range phone focus, 15-20k INR budget devices)

---

## 2. Core Philosophy

### Core Principle
> "Places hold more memories than people do. Time passes, memory passes to the next generation."

### Key Tenets
1. **Place-Centric**: Memories belong to the location, not the creator
2. **Intergenerational**: Memories transcend the creator's lifetime
3. **Emotional Accumulation**: Places develop "vibes" based on collective emotional energy
4. **Custodianship**: People are temporary custodians, not owners
5. **Privacy by Design**: User controls who sees what and when

---

## 3. User Experience Overview

### Core User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  User opens app → Shows map with nearby memory locations        │
│         ↓                                                        │
│  User enters AR mode → Points camera at location                │
│         ↓                                                        │
│  AR Overlay: Aura zone visible (battle royale style dome)        │
│         ↓                                                        │
│  User taps aura → Memory orbs appear floating in AR space       │
│         ↓                                                        │
│  User taps orb → Memory detail view (photo + text + audio)      │
│         ↓                                                        │
│  User can add memory → Capture → Auto-GPS → Sentiment analyze   │
│         ↓                                                        │
│  Memory added → Aura zone color/intensity updates              │
└─────────────────────────────────────────────────────────────────┘
```

### Key Screens

1. **Home/Map Screen**
   - Shows nearby locations with memories
   - Location markers with aura preview (color)
   - Quick stats (memory count, aura vibe)
   - Search and filter functionality

2. **AR Screen**
   - Camera view with AR overlay
   - Visible aura zones around memory locations
   - Floating memory orbs within auras
   - Distance and direction indicators

3. **Memory Detail Screen**
   - Full memory content (photo, text, audio)
   - Creator info (optional, based on privacy)
   - Timestamp and location
   - Emotional tags

4. **Add Memory Screen**
   - Photo capture or gallery select
   - Text input for memory description
   - Optional audio recording
   - Privacy selector
   - Preview before save

5. **Profile Screen**
   - User's created memories
   - Custodianship roles (places they manage)
   - Legacy transfers
   - Settings

6. **Community Screen**
   - Geographic communities
   - Thematic communities
   - Time-based communities
   - Institution zones

7. **Settings Screen**
   - Privacy preferences
   - Notification settings
   - Cache management
   - Account management

---

## 4. Functional Requirements

### 4.1 Memory Management

#### 4.1.1 Create Memory
- **Photo**: Capture from camera or select from gallery
- **Text**: Add description (required, 1-2000 characters)
- **Audio**: Optional voice note (max 60 seconds)
- **Location**: Auto-captured via GPS
- **Timestamp**: Auto-captured
- **Sentiment**: Auto-analyzed from text using VADER
- **Privacy**: User-selected from privacy options

#### 4.1.2 View Memory
- **Public memories**: Visible to all users at location
- **Private memories**: Visible only to creator
- **Tagged memories**: Visible to tagged users
- **Time-release**: Becomes public at specified date
- **Content**: Photo, text, audio, creator name (if allowed), timestamp

#### 4.1.3 Edit Memory
- Edit text content
- Update privacy settings
- Add/remove tags
- Cannot edit location or timestamp

#### 4.1.4 Delete Memory
- Soft delete (recoverable for 30 days)
- Creator can delete own memories
- Custodian can delete any memory at their location

### 4.2 Location Features

#### 4.2.1 Place Discovery
- Map view showing all places with memories
- GPS-based nearby places list
- Search by place name/address
- Filter by community/aura type

#### 4.2.2 Place Detail
- List of all memories at location
- Current aura zone visualization
- Aura history (how vibe changed over time)
- Custodian information

#### 4.2.3 Place Creation
- Auto-created when first memory is added
- Can merge nearby locations
- Can split large areas into sub-zones

### 4.3 Privacy System

#### Privacy Options
| Option | Description |
|--------|-------------|
| **Public** | Anyone can view |
| **Private** | Only creator can view |
| **Tagged** | Only tagged users can view |
| **Time-release** | Public after specified date |
| **Community** | Only community members can view |

#### Privacy Controls
- Default privacy setting (user preference)
- Per-memory privacy override
- Tag specific users on any memory
- Community-based access control

### 4.4 Community System

#### 4.4.1 Community Types
1. **Geographic**
   - Neighborhoods, cities, districts
   - Auto-created from location clusters
   - Managed by local guardians

2. **Thematic**
   - User-created around topics
   - Examples: "Childhood Homes", "Travel Memories", "Favorite Cafes"
   - Open or invite-only

3. **Time-based**
   - Automatic based on time period
   - Examples: "Class of 2025", "90s Memories", "Pre-2000s"
   - Graduation year detection for institutions

4. **Institution Zones**
   - Universities, colleges, schools
   - Multi-zone support (campuses, buildings)
   - Role-based membership (Alumni, Students, Visitors)

#### 4.4.2 Community Roles
| Role | Permissions |
|------|-------------|
| **Owner** | Full control, can delete community |
| **Guardian** | Moderate content, add members |
| **Member** | View and add memories |
| **Visitor** | View only (for institutions) |

### 4.5 Legacy System

#### 4.5.1 Custodianship
- Creator of first memory at location becomes first custodian
- Custodian can transfer role to another user
- Multiple custodians allowed per location

#### 4.5.2 Legacy Transfer
- Initiated by current custodian
- Requires acceptance from recipient
- Transfer history logged
- Can be revoked within 7 days

#### 4.5.3 Inheritance
- If custodian leaves/dies, role can be claimed
- Community guardians can reassign
- No automatic inheritance (manual process)

---

## 5. Privacy System

### Data Collection
- Location data (GPS) - used only when app is active
- Photos/videos - stored securely, never shared
- Text content - used for sentiment analysis
- Audio - optional, stored securely

### User Controls
- Granular privacy per memory
- Time-release scheduling
- User tagging system
- Community access levels

### Data Handling
- All data encrypted at rest
- Location data not sold/shared
- Sentiment analysis done on-device (no external API)
- User can delete all data

---

## 6. Community System

### 6.1 Community Creation
- **Geographic**: Auto-created when 5+ memories in 100m radius
- **Thematic**: User-created with name, description, cover image
- **Time-based**: Auto-created based on memory timestamps
- **Institution**: Created by verified institution admins

### 6.2 Community Features
- Shared memory feed
- Member directory
- Discussion board (future phase)
- Community analytics

### 6.3 Institution Zone Specifics
- University verification process
- Alumni domain validation (@university.edu)
- Era groups auto-generated
- Building/area sub-zones

---

## 7. Emotion Zone System

### 7.1 Sentiment Analysis
- **Method**: VADER (Valence Aware Dictionary and sEntiment Reasoner)
- **Execution**: On-device (no cloud API, privacy-first)
- **Output**: Compound score (-1 to +1) + emotion categories
- **Categories**: Positive, Negative, Neutral, Mixed

### 7.2 Aura Zone Visualization

#### Visual Properties
- **Shape**: Semi-transparent dome/sphere (battle royale style)
- **Size**: Proportional to memory count at location
- **Color**: Based on dominant sentiment
- **Animation**: Pulsing, intensity based on activity

#### Color Mapping
| Sentiment | Color | Hex Code |
|-----------|-------|----------|
| Positive/Joyful | Warm Gold/Amber | #FFB347 |
| Peaceful/Calm | Soft Blue/Green | #77DD77 / #77B5FE |
| Heavy/Sad | Deep Purple/Blue | #9B59B6 / #5D6D7E |
| Mixed/Complex | Multi-color Layers | #DDA0DD + #87CEEB |
| Neutral | Soft Gray | #C0C0C0 |

#### Animation Styles
- **Positive**: Light particles floating upward, quick pulse
- **Peaceful**: Gentle wave motion, slow pulse
- **Heavy**: Slower movement, heavier feel
- **Mixed**: Swirling colors, medium pulse

### 7.3 Aura Calculation
```
For each location:
1. Get all public memories
2. Calculate sentiment for each memory
3. Weight by recency (newer = more weight)
4. Calculate dominant sentiment
5. Set aura color based on dominant
6. Update aura intensity based on count
```

### 7.4 View-Only Restriction
- Users can only VIEW memories (not interact/comment)
- No reactions, likes, or comments in initial version
- Focus on observation, not social engagement

---

## 8. Technical Architecture

### 8.1 Technology Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Flutter 3.x |
| **Language** | Dart |
| **AR** | arcore_flutter_plus (Android), arkit_plugin (iOS) |
| **Backend** | Firebase (Firestore, Auth, Storage, Cloud Functions) |
| **Maps** | Google Maps SDK |
| **Sentiment** | VADER (on-device via dart_vader package) |
| **State Management** | BLoC / Provider |
| **Architecture** | Clean Architecture (Data → Domain → Presentation) |

### 8.2 ARCore Compatibility
- **Minimum**: Android API 24 (Android 7.0)
- **Supported devices**: 15k-20k INR range (Redmi, Realme, OnePlus, Samsung A-series, Motorola)
- **Fallback**: 2D map view for non-ARCore devices

### 8.3 Data Models

#### Memory
```dart
class Memory {
  String id;
  String userId;
  String placeId;
  String? imageUrl;
  String textContent;
  String? audioUrl;
  double latitude;
  double longitude;
  Sentiment sentiment;
  PrivacyType privacy;
  List<String> taggedUsers;
  DateTime? releaseDate;
  DateTime createdAt;
  DateTime updatedAt;
}
```

#### Place
```dart
class Place {
  String id;
  String name;
  double latitude;
  double longitude;
  String? communityId;
  List<String> custodianIds;
  AuraZone aura;
  int memoryCount;
  DateTime createdAt;
}
```

#### User
```dart
class User {
  String id;
  String? displayName;
  String? email;
  List<String> managedPlaceIds;
  List<String> communityIds;
  List<LegacyTransfer> pendingTransfers;
}
```

### 8.4 API Structure

#### Firebase Functions
1. **createMemory** - Validate and store memory
2. **updateAura** - Recalculate place aura after new memory
3. **transferCustodian** - Handle legacy transfer
4. **verifyInstitution** - Institution verification flow

#### Firestore Collections
- users/
- places/
- memories/
- communities/
- transfers/

### 8.5 Storage Strategy
- **Photos**: Firebase Storage, compressed to max 1MB
- **Audio**: Firebase Storage, max 60 seconds, AAC format
- **Metadata**: Firestore
- **Offline Cache**: SharedPreferences + local database (drift/isar)

---

## 9. UI/UX Design Guidelines

### 9.1 Design Philosophy
- **Aura-first**: Auras should be visually prominent and beautiful
- **Dark mode default**: Better for AR viewing, less eye strain
- **Minimal chrome**: UI should not distract from AR experience
- **Subtle animations**: Aura movements should feel organic, not jarring

### 9.2 Color Palette

#### Primary Colors
| Name | Usage | Hex |
|------|-------|-----|
| Deep Space | Background | #0D1117 |
| Celestial Blue | Primary | #58A6FF |
| Sunset Gold | Accent | #F0B429 |

#### Aura Colors (from Emotion Zone System)
- See Section 7.2 for complete list

### 9.3 Typography
- **Headlines**: Bold, high contrast
- **Body**: Clean, readable
- **Captions**: Light, subtle
- **Font**: System default (Roboto/SF Pro)

### 9.4 Component Library
- Custom AR overlay components
- Memory card components
- Privacy selector components
- Aura preview components
- Community badge components

### 9.5 Navigation
- **Primary**: Bottom navigation (Map, AR, Add, Communities, Profile)
- **Secondary**: Modal sheets for details
- **Transitions**: Smooth fade transitions between screens

---

## 10. Phased Development Plan

### Phase 1: Foundation (MVP)
**Duration**: 6-8 weeks
**Goal**: Core memory functionality with basic map

#### Features
- [x] User authentication (Firebase Auth)
- [x] Memory creation (photo + text)
- [x] Basic map view with place markers
- [x] Place detail with memory list
- [x] Public/Private privacy toggle
- [x] Profile with user's memories

#### Screens
- [x] Splash screen
- [x] Login/Register
- [x] Map home
- [x] Place detail
- [x] Add memory
- [x] Profile

#### Technical
- [x] Flutter project setup
- [x] Firebase integration
- [x] Google Maps SDK
- [x] Image capture/selection
- [x] Basic location services

### Phase 2: AR + Emotion
**Duration**: 8-10 weeks
**Goal**: AR overlay with aura zones

#### Features
- [x] AR camera view
- [x] Aura zone overlay (basic)
- [x] Memory orbs in AR
- [x] Sentiment analysis (on-device)
- [x] Aura color based on sentiment
- [x] Time-release privacy
- [x] Tagged user privacy

#### Technical
- [x] ARCore/ARKit integration
- [x] VADER sentiment analysis
- [x] Real-time aura updates
- [x] AR session management

### Phase 3: Communities + Legacy
**Duration**: 8-10 weeks
**Goal**: Full community and legacy features

#### Features
- [x] Community creation (all 3 types)
- [x] Community membership
- [x] Institution zone setup
- [x] Custodianship transfer
- [x] Legacy role passing
- [x] Era auto-grouping (universities)
- [x] Offline caching

#### Technical
- [x] Community data models
- [x] Role-based access control
- [x] Offline-first architecture
- [x] Push notification handling

### Future Phases (Post-MVP)
- Comment/react system (if requested)
- Audio playback in AR
- Multi-language support
- Web portal for desktop viewing
- API for third-party integrations

---

## 11. Non-Functional Requirements

### 11.1 Performance
- App launch: < 3 seconds
- AR frame rate: 30+ FPS
- Memory load time: < 2 seconds
- Location update: < 1 second

### 11.2 Compatibility
- Android: API 24+ (ARCore supported)
- iOS: 15.0+ (ARKit supported)
- Fallback: 2D map for non-AR devices

### 11.3 Privacy Compliance
- No data collection without consent
- No location tracking in background
- All data deletable on user request
- COPPA compliant for under-13

### 11.4 Accessibility
- Screen reader support
- Minimum touch target: 44x44dp
- High contrast mode support
- Text scaling support

### 11.5 Testing
- Unit tests: Core business logic
- Widget tests: UI components
- Integration tests: User flows
- Performance tests: AR rendering

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Aura Zone** | Visual AR overlay showing a place's emotional vibe |
| **Memory Orb** | AR object representing a single memory in 3D space |
| **Custodian** | User managing a location's memories |
| **Legacy Transfer** | Passing custodianship to another user |
| **Institution Zone** | University/college with special community handling |
| **Era Group** | Time-based community (e.g., "Class of 2025") |
| **Sentiment Analysis** | AI analysis of text emotional content |

## Appendix B: Reference Apps

- MemoMap (NRK) - 2D map-based memories
- Pokémon GO - AR + location game mechanics
- Collective Memory - Real-time sharing concept

## Appendix C: Similar Research

- Stone Tape Theory - Paranormal concept of places storing emotional energy
- University of Missouri emotional city mapping research
- Place attachment psychology research

---

*Document Version: 1.0*
*Last Updated: May 2026*
*Status: Draft for Review*