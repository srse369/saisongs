# Requirements Document

## Introduction

This document specifies the requirements for a web-based song presentation system (similar to BhajanStudio for Windows) that displays song lyrics in a PowerPoint-style slide deck format. The system manages a database of songs with their lyrics, English translations, singer information, and musical pitch data, presenting them in an accessible slideshow interface for live performances or practice sessions. The web-based nature allows cross-platform access and easier content sharing.

## Technical Constraints

- The system MUST use a serverless architecture with no backend server
- The frontend MUST be deployable to GitHub Pages (static hosting)
- The frontend MUST connect directly to Neon (serverless PostgreSQL) database
- The system MUST use a modern UI framework suitable for static site generation

## Glossary

- **Presentation System**: The web application that displays songs in a slide deck format, hosted on GitHub Pages
- **Song Database**: The persistent storage system containing all song information, implemented using Neon serverless PostgreSQL
- **Song** (also **Bhajan**): A devotional song entry in the system, which may include lyrics in original language and English translation
- **Slide Deck**: A sequential presentation of song content displayed one slide at a time
- **Pitch Information**: Musical key or starting note data for each song
- **Translation**: English language version of non-English song lyrics
- **Singer Profile**: Information about a vocalist including their pitch range for specific songs

## Requirements

### Requirement 1: Song Management

**User Story:** As a content administrator, I want to create and manage song entries with complete metadata, so that I can maintain an organized database of songs for presentations.

#### Acceptance Criteria

1. THE Presentation System SHALL provide a form interface to create new song entries with name, lyrics, and optional translation fields
2. THE Presentation System SHALL store each song with a unique identifier in the Song Database
3. WHEN a user submits a song entry, THE Presentation System SHALL validate that the song name is not empty
4. THE Presentation System SHALL provide an interface to edit existing song entries
5. THE Presentation System SHALL provide an interface to delete song entries from the Song Database

### Requirement 2: Lyrics and Translation Display

**User Story:** As a presenter, I want to display song lyrics with optional English translations in a slide format, so that audiences can follow along during performances.

#### Acceptance Criteria

1. THE Presentation System SHALL display song lyrics in a slide deck format with one verse or section per slide
2. WHERE a song has an English translation, THE Presentation System SHALL display the translation alongside the original lyrics on each slide
3. THE Presentation System SHALL provide navigation controls to move forward and backward through slides
4. THE Presentation System SHALL display the song name on each slide
5. WHEN displaying a slide, THE Presentation System SHALL use readable font sizes suitable for projection or large screen display

### Requirement 3: Singer Management

**User Story:** As a music coordinator, I want to maintain profiles for singers with their pitch information for each song, so that I can assign appropriate songs to vocalists based on their range.

#### Acceptance Criteria

1. THE Presentation System SHALL provide an interface to create singer profiles with name and identifier
2. THE Presentation System SHALL allow associating multiple singers with a single song
3. THE Presentation System SHALL store pitch information for each singer-song combination
4. THE Presentation System SHALL provide an interface to edit singer profiles and their pitch associations
5. THE Presentation System SHALL display singer names and pitch information when viewing song details

### Requirement 4: Pitch Information Management

**User Story:** As a music director, I want to record and view pitch information for each song and singer combination, so that I can prepare appropriate musical accompaniment.

#### Acceptance Criteria

1. THE Presentation System SHALL accept pitch information as text input for each singer-song pairing
2. THE Presentation System SHALL store pitch information in the Song Database linked to both song and singer
3. WHEN viewing a song, THE Presentation System SHALL display all associated pitch information organized by singer
4. THE Presentation System SHALL allow updating pitch information for existing singer-song combinations
5. THE Presentation System SHALL allow removing pitch information from singer-song combinations

### Requirement 5: Presentation Mode

**User Story:** As a presenter, I want to display songs in a full-screen slideshow mode with keyboard navigation, so that I can conduct smooth presentations during live events.

#### Acceptance Criteria

1. THE Presentation System SHALL provide a presentation mode that displays slides in full-screen or maximized view
2. WHEN in presentation mode, THE Presentation System SHALL respond to keyboard arrow keys for slide navigation
3. WHEN in presentation mode, THE Presentation System SHALL respond to the Escape key to exit presentation mode
4. THE Presentation System SHALL maintain the current slide position when toggling between normal and presentation modes
5. WHEN in presentation mode, THE Presentation System SHALL hide administrative controls and navigation chrome

### Requirement 6: Song Search and Selection

**User Story:** As a user, I want to search and filter songs by name or singer, so that I can quickly find and present specific songs during events.

#### Acceptance Criteria

1. THE Presentation System SHALL provide a search interface that accepts text input
2. WHEN a user enters search text, THE Presentation System SHALL filter the song list to show only songs with names matching the search text
3. THE Presentation System SHALL display search results within 2 seconds of user input
4. THE Presentation System SHALL provide a way to filter songs by associated singer
5. WHEN a user selects a song from search results, THE Presentation System SHALL load that song for presentation

### Requirement 7: Database Persistence

**User Story:** As a system administrator, I want all song, singer, and pitch data to persist across sessions, so that content remains available without manual re-entry.

#### Acceptance Criteria

1. THE Presentation System SHALL store all song data in the Song Database with persistent storage
2. THE Presentation System SHALL store all singer profiles in the Song Database with persistent storage
3. THE Presentation System SHALL store all pitch information in the Song Database with persistent storage
4. WHEN the Presentation System restarts, THE Presentation System SHALL load all previously stored data from the Song Database
5. IF a database write operation fails, THEN THE Presentation System SHALL display an error message to the user and retain data in memory
