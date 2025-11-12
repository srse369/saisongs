# Requirements Document

## Introduction

This feature provides a password-protected administrative function to bulk-import all songs from sairhythms.org into the Song Studio database. The import process will discover all available songs on sairhythms.org, extract their names and URLs, and populate the database while preserving existing song IDs to maintain data integrity.

## Glossary

- **Import System**: The Song Studio administrative feature that performs bulk song imports from sairhythms.org
- **Sairhythms.org**: The external website that serves as the single source of truth for song data
- **Song Record**: A database entry containing a song's ID, name, and sairhythms_url
- **Password Dialog**: The UI component that prompts for and validates the administrative password
- **Import UI**: The user interface component that displays import progress and results
- **Discovery Process**: The automated process of identifying all available songs on sairhythms.org
- **Existing Song**: A song record that already exists in the database with a matching name or URL

## Requirements

### Requirement 1

**User Story:** As an administrator, I want to access a hidden bulk import feature through password authentication, so that unauthorized users cannot trigger database modifications.

#### Acceptance Criteria

1. WHEN the administrator activates the hidden import trigger, THE Import System SHALL display the Password Dialog
2. WHEN the administrator enters an incorrect password, THE Import System SHALL display an error message and prevent access to the import functionality
3. WHEN the administrator enters the correct password, THE Import System SHALL grant access to the Import UI
4. THE Import System SHALL store the administrative password in environment variables and not in source code
5. THE Import System SHALL limit password entry attempts to prevent brute force attacks

### Requirement 2

**User Story:** As an administrator, I want the system to discover all songs available on sairhythms.org, so that I can import the complete song catalog.

#### Acceptance Criteria

1. WHEN the import process begins, THE Import System SHALL fetch the sairhythms.org website content
2. THE Import System SHALL parse the website content to extract all song names and their corresponding URLs
3. WHEN parsing fails for any song entry, THE Import System SHALL log the error and continue processing remaining songs
4. THE Import System SHALL validate that each discovered URL follows the sairhythms.org domain pattern
5. THE Import System SHALL display the total count of discovered songs before starting the import

### Requirement 3

**User Story:** As an administrator, I want existing songs to retain their database IDs during import, so that references to songs in other tables remain valid.

#### Acceptance Criteria

1. WHEN a discovered song matches an existing Song Record by name, THE Import System SHALL update the existing record without changing its ID
2. WHEN a discovered song matches an existing Song Record by URL, THE Import System SHALL update the existing record without changing its ID
3. WHEN a discovered song does not exist in the database, THE Import System SHALL create a new Song Record with a new ID
4. THE Import System SHALL update the updated_at timestamp for all modified Song Records
5. THE Import System SHALL preserve the created_at timestamp for existing Song Records

### Requirement 4

**User Story:** As an administrator, I want to see real-time progress during the import process, so that I can monitor the operation and identify any issues.

#### Acceptance Criteria

1. WHEN the import process is running, THE Import UI SHALL display the current progress as a percentage
2. THE Import UI SHALL display the count of songs processed, created, and updated
3. WHEN an error occurs during import, THE Import UI SHALL display the error message and affected song name
4. WHEN the import process completes, THE Import UI SHALL display a summary of total songs processed, created, updated, and failed
5. THE Import UI SHALL provide a way to dismiss or close the import interface after completion

### Requirement 5

**User Story:** As an administrator, I want the import process to handle errors gracefully, so that a single failure does not stop the entire import operation.

#### Acceptance Criteria

1. WHEN a network error occurs while fetching sairhythms.org, THE Import System SHALL retry the request up to three times
2. WHEN a database error occurs while saving a Song Record, THE Import System SHALL log the error and continue with the next song
3. WHEN parsing fails for a specific song entry, THE Import System SHALL log the error and continue with the next song
4. THE Import System SHALL collect all errors encountered during import and display them in the final summary
5. WHEN the import process encounters a critical error, THE Import System SHALL stop the import and display an error message to the administrator

### Requirement 6

**User Story:** As an administrator, I want the import trigger to be hidden from regular users, so that only administrators who know about it can access the feature.

#### Acceptance Criteria

1. THE Import System SHALL not display any visible button or menu item for the import feature in the standard UI
2. WHEN the administrator performs a specific keyboard shortcut or gesture, THE Import System SHALL reveal the import trigger
3. THE Import System SHALL provide documentation for administrators on how to access the hidden import feature
4. THE Import System SHALL not expose the import endpoint or functionality through public API routes without authentication
