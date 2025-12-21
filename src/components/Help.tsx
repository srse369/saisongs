import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface HelpSection {
  id: string;
  title: string;
  icon: string;
  description: string;
  requiredRole?: 'viewer' | 'editor' | 'admin';
  subsections: {
    title: string;
    content: string[];
  }[];
}

export const Help: React.FC = () => {
  const { isAuthenticated, userRole, isAdmin, isEditor } = useAuth();
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const helpSections: HelpSection[] = [
    {
      id: 'overview',
      title: 'Overview',
      icon: 'fa-home',
      description: 'Welcome to Sai Devotional Song Studio',
      subsections: [
        {
          title: 'What is Song Studio?',
          content: [
            'Song Studio is a comprehensive digital platform specifically designed for managing devotional songs in the context of Sai Bhajan sessions and spiritual gatherings. The platform serves as a centralized hub where you can store, organize, and present devotional songs with complete information including lyrics, meanings, and musical details.',
            'The system allows you to maintain a complete song library with metadata such as language, deity, tempo, beat pattern (taal), raga, and difficulty level. Each song can include lyrics in both the original language and English translations, along with detailed meanings and contextual information to help singers and audiences understand the deeper significance of the bhajans.',
            'A key feature is the ability to assign specific pitches (musical keys) to different singers. This recognizes that each singer has their own comfortable vocal range, and the same song might need to be sung in different keys by different people. The platform tracks these pitch assignments and makes them easily accessible during sessions.',
            'The presentation capabilities allow you to display songs with professional-looking slides, complete with customizable templates featuring backgrounds, images, and text overlays. This is perfect for projecting lyrics during live sessions so the audience can follow along and participate.',
            'You can build complete session playlists by selecting multiple songs with their respective singers and present them sequentially with smooth transitions. This makes it easy to conduct structured bhajan sessions with pre-planned song sequences.'
          ]
        },
        {
          title: 'Getting Started',
          content: [
            '<strong>For First-Time Visitors:</strong> You can immediately start browsing the song library without any login. The Songs tab is publicly accessible, allowing anyone to view song details, lyrics, and meanings. This makes it easy to explore the collection and learn about different devotional songs.',
            '<strong>Signing In:</strong> To access advanced features like managing singers, pitches, and creating presentations, you need to sign in. Press <kbd>Ctrl+Shift+I</kbd> (Windows/Linux) or <kbd>Cmd+Shift+I</kbd> (Mac) from anywhere in the application to open the login dialog. You will receive a one-time password (OTP) via email that is valid for 10 minutes.',
            '<strong>Navigation:</strong> Use the main navigation menu at the top of the page to access different sections. On desktop, you will see tabs for Songs, Singers, Pitches, Live Sessions, Templates, and Help. On mobile devices, tap the hamburger menu icon to reveal these options.',
            '<strong>Starting Your First Session:</strong> Go to the Live tab, click "Add Songs" to search and select songs, choose a singer for each song (this determines the pitch), and then click "Present Session" to display the songs with lyrics in full-screen mode.',
            '<strong>Keyboard Shortcuts:</strong> Learn the keyboard shortcuts mentioned throughout this help guide to work more efficiently. Most dialogs can be closed with <kbd>Escape</kbd>, and presentation mode supports arrow keys for navigation.'
          ]
        },
        {
          title: 'User Roles',
          content: [
            '<strong>Viewer Role:</strong> This is the default role for authenticated users. Viewers can browse all songs, view complete details including lyrics and meanings, see all singers and their pitch assignments, and access all pitches in the system. They can create and present live sessions, but cannot modify any data. This role is perfect for singers and session coordinators who need to access information but should not be editing the database.',
            '<strong>Editor Role:</strong> Editors have all viewer permissions plus the ability to create and edit content, but only within their assigned centers. Each editor is granted access to specific centers (locations or groups), and they can create/edit songs, singers, pitches, and templates that belong to those centers. They can also assign content to their managed centers. This role is ideal for center coordinators who need to manage their local content without affecting other centers.',
            '<strong>Admin Role:</strong> Admins have unrestricted access to all features and all centers. They can create and edit any content regardless of center assignments, manage the centers themselves, grant editor permissions to other users, promote users to admin status, and view analytics and feedback. Admins are responsible for overall system management and ensuring data quality across all centers.',
            '<strong>Permission Inheritance:</strong> Editors can only see and edit content that belongs to their assigned centers or content with no center assignment (global content). Admins can see and edit everything. This ensures proper data isolation between different centers while maintaining centralized administration capabilities.'
          ]
        }
      ]
    },
    {
      id: 'songs',
      title: 'Songs Tab',
      icon: 'fa-music',
      description: 'Browse and manage the song library',
      subsections: [
        {
          title: 'Viewing Songs',
          content: [
            '<strong>Browsing the Song Library:</strong> The Songs tab displays all devotional songs in a card-based layout. Each card shows the song name, language, deity, and key metadata. The interface is responsive and works beautifully on all devices from desktop to mobile.',
            '<strong>Search Functionality:</strong> Use the search bar at the top to find songs by name. The search is case-insensitive and matches partial text, making it easy to find songs even if you only remember part of the name.',
            '<strong>Smart Search (AI-Powered):</strong> Click the "Smart Search" button to enable natural language searching. This powerful feature uses AI to understand your intent. For example, you can search for "upbeat songs about Lord Krishna" or "slow meditative bhajans in Hindi" and the system will analyze lyrics, meanings, and metadata to find relevant matches.',
            '<strong>Filtering Options:</strong> Use the filter panel to narrow down songs by multiple criteria: Language (Telugu, Hindi, Sanskrit, English, etc.), Deity (Krishna, Rama, Sai, Ganesha, etc.), Tempo (Slow, Medium, Fast), Beat/Taal (Keherwa, Dadra, Rupak, etc.), Raga (Bhairavi, Bhupali, etc.), and Difficulty Level (Easy, Medium, Hard).',
            '<strong>Sorting:</strong> Change the sort order using the dropdown menu. Options include alphabetical by name, date added (newest first), and pitch count (songs with more pitch assignments appear first, indicating they are sung more frequently).',
            '<strong>Song Details View:</strong> Click on any song card to open a detailed modal dialog showing complete information including full lyrics in original script and English, comprehensive meaning explanation, metadata, all singers with their assigned pitches, external source URLs for reference recordings, and center associations.'
          ]
        },
        {
          title: 'Creating Songs (Editors & Admins)',
          content: [
            '<strong>Starting New Song:</strong> Click the blue "Create New Song" button (visible only to editors and admins). This opens the Song Form dialog where you can enter all song information.',
            '<strong>Required Fields:</strong> Song Name is the only mandatory field, but it is highly recommended to fill in as many fields as possible for better organization and searchability. Language selection helps in filtering and proper text rendering.',
            '<strong>Lyrics Entry:</strong> The form provides separate text areas for lyrics in the original language and English translation. Format lyrics with proper line breaks to ensure they display correctly during presentations. You can use multiple stanzas separated by blank lines.',
            '<strong>Meaning & Context:</strong> The meaning field allows you to explain the spiritual significance, context, and interpretation of the song. This is valuable for new singers and audiences who want to understand what they are singing. Include information about when the song is typically sung, its origin, or any special significance.',
            '<strong>Musical Metadata:</strong> Select appropriate values for Tempo (slow/medium/fast), Beat/Taal (rhythmic pattern), and Raga (melodic framework). These help singers prepare appropriately and allow for musical categorization.',
            '<strong>Difficulty Level:</strong> Mark songs as Easy, Medium, or Hard based on vocal range, rhythmic complexity, and lyrical difficulty. This helps in planning sessions and assigning songs to appropriate singers.',
            '<strong>External Sources:</strong> Add URLs to reference recordings (like YouTube links) so singers can listen to how the song is traditionally sung.',
            '<strong>Center Assignment:</strong> Assign the song to specific centers if it should only be accessible to certain locations. Leave empty for global songs accessible to everyone. Editors can only assign songs to their managed centers.'
          ]
        },
        {
          title: 'Editing Songs (Editors & Admins)',
          content: [
            '<strong>Edit Access:</strong> Click the edit (pencil) icon on any song card to open the edit form. Editors can only edit songs that belong to their assigned centers or global songs with no center restrictions. Admins can edit any song.',
            '<strong>Making Changes:</strong> The edit form is identical to the create form but pre-populated with existing data. Modify any fields as needed. Changes to lyrics will be reflected immediately in all presentations using that song.',
            '<strong>Center Reassignment:</strong> You can add or remove center associations. Editors can only add centers they manage. Removing all centers makes a song global (accessible to everyone).',
            '<strong>Version Control:</strong> While the system does not maintain full version history, the updated_at timestamp tracks when songs were last modified. Consider documenting significant changes in the meaning or notes field.',
            '<strong>Impact of Changes:</strong> Be aware that editing a song affects all pitch assignments and sessions that include it. Lyric changes will appear in ongoing and future presentations. Musical metadata changes may affect how singers prepare.'
          ]
        },
        {
          title: 'Presentation Mode',
          content: [
            '<strong>Starting Presentation:</strong> Click the "Present" button on any song card. You will be prompted to select a presentation template if you have not already chosen a default one.',
            '<strong>Template Selection:</strong> Choose from available templates that control the visual appearance including backgrounds, text styling, and layout. Each template can have different aspects ratios (16:9 for widescreen, 4:3 for traditional).',
            '<strong>Full-Screen Display:</strong> The presentation enters full-screen mode automatically. Lyrics are displayed in a readable format with proper line breaks and stanza separations. The template background images, colors, or videos create a visually appealing display.',
            '<strong>Navigation Controls:</strong> Use <kbd>→</kbd> (right arrow) or <kbd>Space</kbd> to advance to the next slide. Use <kbd>←</kbd> (left arrow) to go back. <kbd>Home</kbd> jumps to the first slide, <kbd>End</kbd> to the last. You can also click anywhere on the screen to advance.',
            '<strong>Exiting Presentation:</strong> Press <kbd>Escape</kbd> or click the X button in the corner to exit full-screen and return to the song library.',
            '<strong>Multi-Screen Setup:</strong> If you have a projector or second monitor, the presentation will display on the current screen. Use your browser or OS settings to move the window to the desired display before entering full-screen mode.'
          ]
        },
        {
          title: 'Song Cards & Quick Actions',
          content: [
            '<strong>Card Layout:</strong> Each song card displays key information at a glance: song name (prominently displayed), language badge (color-coded), deity tag, tempo, beat, and raga indicators, number of pitches assigned (showing popularity), and quick action buttons.',
            '<strong>Quick Actions:</strong> The card provides quick access buttons: Present icon (start immediate presentation), Edit icon (open edit form - editors/admins only), Assign Pitch icon (quickly create a new pitch assignment), and View Details icon (see complete song information).',
            '<strong>Visual Indicators:</strong> Songs with many pitch assignments show a higher count, indicating they are frequently performed. Language badges use different colors for easy visual identification. Center-restricted songs may show a lock icon or badge.',
            '<strong>Responsive Design:</strong> On desktop, cards are displayed in a grid with hover effects. On tablets and mobile, cards stack vertically with touch-friendly spacing. All actions remain easily accessible regardless of device.'
          ]
        }
      ]
    },
    {
      id: 'singers',
      title: 'Singers Tab',
      icon: 'fa-users',
      description: 'Manage singers and their profiles',
      requiredRole: 'viewer',
      subsections: [
        {
          title: 'Viewing Singers',
          content: [
            '<strong>Singer Directory:</strong> The Singers tab displays all registered singers in the system. Each singer card shows their name, gender (with color-coded indicators), email address (if provided), center associations (with colored badges), and the number of pitch assignments they have.',
            '<strong>Search & Filter:</strong> Use the search bar to find singers by name. The search is real-time and case-insensitive. Apply filters to show only singers of a specific gender (Male, Female, Boy, Girl, Other) or singers associated with particular centers.',
            '<strong>Sorting Options:</strong> Sort the singer list alphabetically by name, by date added (newest first), or by pitch count (singers with more pitches appear first, indicating they are more active in the repertoire).',
            '<strong>Gender Indicators:</strong> Gender is indicated with color-coded badges - typically blue for Male/Boy and pink for Female/Girl. This helps in quickly identifying voice types when planning sessions.',
            '<strong>Center Badges:</strong> Each singer card displays colored badges for all centers they are associated with. This makes it easy to see which singers belong to which locations or groups.',
            '<strong>Pitch Assignments:</strong> The card shows a count of how many songs have pitch assignments for this singer, giving you a quick sense of their repertoire size.'
          ]
        },
        {
          title: 'Creating Singers (Editors & Admins)',
          content: [
            '<strong>Adding New Singers:</strong> Click the "Create New Singer" button to open the singer form. Only editors and admins can create singers, and editors can only assign singers to centers they manage.',
            '<strong>Required Information:</strong> Enter the singer\'s full name, select their gender (Male, Female, Boy, Girl, or Other), and assign them to at least one center. All three pieces of information are mandatory.',
            '<strong>Email Address (Optional):</strong> Adding an email address is optional when creating a singer, but it becomes required if you later want to grant them admin privileges or editor permissions. The email allows the singer to receive OTP login codes and enables them to access the system as a user.',
            '<strong>Center Assignment:</strong> You must assign the singer to at least one center. Editors can only assign singers to their managed centers. Admins can assign to any center or leave global. Singers can be associated with multiple centers if they perform at different locations.',
            '<strong>Gender Selection:</strong> Gender is important as it affects pitch recommendations and helps in categorizing voice types. Boy and Girl categories are useful for children\'s choirs or youth groups.',
            '<strong>Automatic User Account:</strong> If you provide an email address, the singer can use that email to log in to the system (via OTP). Initially, they will have viewer access only. Admins can later grant them editor or admin privileges.'
          ]
        },
        {
          title: 'Editing Singers (Editors & Admins)',
          content: [
            '<strong>Edit Access Control:</strong> Click the edit icon on any singer card to open the edit form. Editors can only edit singers if they have editor access to at least one of that singer\'s centers. If you lack access to all of a singer\'s centers, the form opens in read-only mode with all fields disabled.',
            '<strong>Updating Basic Info:</strong> Modify the singer\'s name, gender, or email address. Name changes are reflected immediately across all pitch assignments and sessions. Gender changes may affect how the singer is categorized and filtered.',
            '<strong>Managing Centers:</strong> Add or remove center associations. Editors can only add centers they manage and can remove any center. However, centers you don\'t manage appear as "read-only" and cannot be removed by you. Admins can manage all center associations freely.',
            '<strong>Email Requirements:</strong> If the singer already has admin privileges or editor permissions, their email cannot be removed as it\'s required for authentication. A warning appears if you try to clear an email that\'s required.',
            '<strong>Read-Only Mode:</strong> When you open a singer for editing but lack access to any of their centers, a yellow warning banner appears explaining that the form is read-only. All fields are disabled, and the submit button is hidden. This allows you to view the singer\'s information without risking accidental changes.'
          ]
        },
        {
          title: 'User Accounts (Admins)',
          content: [
            '<strong>Granting User Access:</strong> Any singer with an email address can be granted login access to the system. This is managed by admins only. When editing a singer as an admin, you see additional fields for "Is Admin" and "Editor For Centers".',
            '<strong>Admin Privileges:</strong> Check the "Is Admin" checkbox to grant full system access. Admins can view and edit all content regardless of center restrictions. They can manage centers, users, and system settings. Use admin privileges sparingly for trusted users only.',
            '<strong>Editor Permissions:</strong> Instead of making someone an admin, you can grant them editor access to specific centers. Use the "Editor For Centers" multi-select to choose which centers they can manage. Editors can create and edit songs, singers, pitches, and templates within their assigned centers.',
            '<strong>Email Validation:</strong> The system requires a valid email address before you can grant admin or editor privileges. A warning appears if you try to grant permissions without an email. The email is used for OTP-based authentication.',
            '<strong>Permission Levels:</strong> Users progress through levels: No email = Cannot log in, Email but no permissions = Viewer (can browse, cannot edit), Email + Editor For centers = Editor (can edit in specific centers), Email + Admin = Admin (full access).',
            '<strong>Revoking Access:</strong> To revoke a user\'s access, uncheck the admin checkbox or remove all centers from their editor list. They will revert to viewer status. To completely remove their ability to log in, remove their email address (only if they don\'t have any special permissions).'
          ]
        },
        {
          title: 'Merging Singers (Editors & Admins)',
          content: [
            '<strong>Why Merge:</strong> Over time, duplicate singer entries may be created, especially if multiple people manage the database. Merging combines duplicate entries into a single, canonical record.',
            '<strong>Starting a Merge:</strong> Select multiple singer records using the checkboxes on their cards. Then click the "Merge Singers" button that appears. A dialog opens asking you to choose which singer to keep as the target.',
            '<strong>Selecting Target:</strong> Choose carefully which singer record to keep. This will be the final merged record. The target singer\'s name, gender, email, and centers are preserved. All other selected singers will be deleted.',
            '<strong>Pitch Transfer:</strong> All pitch assignments from the singers being merged are transferred to the target singer. If there are duplicate pitch assignments (same song assigned to multiple singers being merged), only unique ones are kept.',
            '<strong>Cannot Undo:</strong> Merging is permanent and cannot be undone. The merged singers are deleted from the database, and all their associations are transferred to the target. Make sure you have selected the correct target before confirming.',
            '<strong>Best Practices:</strong> Before merging, review all singers involved. Ensure the target singer has the most complete and accurate information. Consider the email addresses - if one singer has a user account, make that one the target to preserve their login access.'
          ]
        }
      ]
    },
    {
      id: 'pitches',
      title: 'Pitches Tab',
      icon: 'fa-guitar',
      description: 'Assign pitches to singers for songs',
      requiredRole: 'viewer',
      subsections: [
        {
          title: 'Understanding Pitches',
          content: [
            '<strong>What Are Pitches:</strong> In musical terms, a pitch (or key) is the specific note on which a song begins. Different singers have different comfortable vocal ranges, so the same song might need to be sung in different keys by different people. Song Studio manages these pitch assignments to help singers know which key to use for each song.',
            '<strong>Musical Notation:</strong> Pitches are represented using standard Western musical notation: C, D, E, F, G, A, B. These are the seven basic notes. Each can be modified with sharps (#) which raise the pitch by a half-step, or flats (b) which lower it by a half-step.',
            '<strong>Madhyam System:</strong> In addition to Western notation, Song Studio supports the Madhyam system popular in Indian classical music. Madhyam positions (1-5) represent different starting points on the harmonium or shruti box. Many devotional singers use this system, especially when singing with harmonium accompaniment.',
            '<strong>Octave Variations:</strong> The same letter pitch can exist in different octaves. For example, middle C is different from low C or high C. When assigning pitches, consider the singer\'s vocal range and whether they sing in a higher or lower octave.',
            '<strong>Why Pitch Assignment Matters:</strong> Having the correct pitch assignment ensures singers are comfortable and can perform the song with proper voice quality. Singing in the wrong key can strain the voice or make it difficult to reach certain notes. During live sessions, knowing the pitch ahead of time allows singers to prepare mentally and physically.',
            '<strong>Multiple Singers, Same Song:</strong> It is completely normal for the same song to have different pitch assignments for different singers. Song Studio tracks all these variations, allowing you to select the appropriate singer-pitch combination when building a session.'
          ]
        },
        {
          title: 'Viewing Pitches',
          content: [
            '<strong>Pitch Directory:</strong> The Pitches tab displays all pitch assignments in the system. Each entry represents a specific combination of song + singer + pitch value. The table or card layout shows the song name, singer name, pitch value, and center associations.',
            '<strong>Search & Filter:</strong> Use the search bar to find pitches by song name or singer name. Apply filters to show only pitches for a specific song or a specific singer. This is helpful when preparing for a session and you need to know all the songs a particular singer can perform.',
            '<strong>Sorting:</strong> Sort the pitch list alphabetically by song name or singer name. This helps you quickly scan all songs in order or see all pitches for singers grouped together.',
            '<strong>Center Associations:</strong> Pitches inherit center associations from both the song and the singer. A pitch is visible to users who have access to both entities. Center badges on pitch cards show which centers have access to that particular assignment.',
            '<strong>Quick Actions:</strong> Each pitch entry has buttons for editing (change the pitch value) and deleting (remove the assignment). These actions are only available to editors and admins with appropriate access.'
          ]
        },
        {
          title: 'Creating Pitches (Editors & Admins)',
          content: [
            '<strong>Starting New Assignment:</strong> Click the "Add New Pitch" button to open the pitch form. You can also quickly assign a pitch from the Songs tab by clicking the "Assign Pitch" icon on a song card.',
            '<strong>Selecting Song:</strong> Choose the song from a dropdown list. The list shows all songs you have access to. Songs are grouped by language and include metadata to help identify them.',
            '<strong>Selecting Singer:</strong> Choose the singer from a dropdown list. Each singer entry shows their name, gender, and associated centers. You can only assign pitches to singers you have access to (based on center permissions).',
            '<strong>Choosing Pitch Value:</strong> Select the appropriate pitch from a comprehensive list including all Western notes (C through B), sharps and flats, and Madhyam positions (1-5). You can also type a custom pitch value if needed.',
            '<strong>Uniqueness Constraint:</strong> Each song-singer combination can have only one pitch assignment. If you try to create a duplicate, the system will show an error. To change an existing pitch, use the edit function instead.',
            '<strong>Access Control:</strong> Editors can only create pitches for songs and singers within their managed centers. The dropdowns automatically filter to show only entities you have permission to use.',
            '<strong>Best Practice:</strong> Before assigning a pitch, consult with the singer to determine their comfortable key. Test the pitch during a practice session before adding it to the database.'
          ]
        },
        {
          title: 'Editing Pitches (Editors & Admins)',
          content: [
            '<strong>Edit Access:</strong> Click the edit icon on any pitch entry to open the edit form. You can edit a pitch only if you have access to both the song and the singer through your center permissions.',
            '<strong>Changing Pitch Value:</strong> In edit mode, the song and singer dropdowns are disabled (read-only) to prevent accidentally reassigning the wrong combination. You can only change the pitch value itself. Select a new pitch from the dropdown.',
            '<strong>When to Edit:</strong> Edit pitches when a singer finds a new comfortable key, when you discover the recorded pitch was incorrect, or when a singer\'s voice changes over time (common with growing children or aging singers).',
            '<strong>Impact of Changes:</strong> Editing a pitch affects all future sessions and presentations. If the pitch is part of a saved session, that session will use the new pitch value the next time it is presented.',
            '<strong>Version History:</strong> While the system tracks when pitches are modified (updated_at timestamp), it does not maintain full history. Consider documenting significant changes in a notes field or external documentation if needed.'
          ]
        },
        {
          title: 'Quick Pitch Assignment',
          content: [
            '<strong>From Songs Tab:</strong> When viewing the Songs tab, each song card has an "Assign Pitch" icon (usually a musical note). Clicking this opens a streamlined pitch assignment dialog.',
            '<strong>Pre-Selected Song:</strong> The dialog opens with the song already selected, saving you a step. You only need to choose the singer and pitch value.',
            '<strong>Faster Workflow:</strong> This quick assignment method is ideal when adding pitches for multiple singers on the same song. You can quickly add several assignments without returning to the main Pitches tab.',
            '<strong>Same Validation:</strong> All the same validation rules apply. You cannot create duplicate assignments, and you must have appropriate permissions.',
            '<strong>Use Case:</strong> Quick assignment is perfect when preparing for an upcoming session. Open the song you plan to include, check which singers have pitches assigned, and quickly add any missing assignments.'
          ]
        },
        {
          title: 'Pitch Management Best Practices',
          content: [
            '<strong>Regular Reviews:</strong> Periodically review pitch assignments, especially for active singers. Voice ranges can change due to practice, age, or health. Update pitches to reflect current comfortable ranges.',
            '<strong>Document Changes:</strong> When changing a pitch that has been used for a long time, consider documenting why. This context is helpful if the change needs to be revisited.',
            '<strong>Multiple Options:</strong> Some singers may be comfortable with a song in multiple keys. You can only store one pitch per singer-song pair, so choose the most commonly used one. Document alternatives in notes or external records.',
            '<strong>Gender Considerations:</strong> Male and female singers typically need different pitches due to natural voice range differences. Boy and girl categories help in managing youth choirs with changing voices.',
            '<strong>Harmonium Compatibility:</strong> If your sessions use harmonium accompaniment, ensure Madhyam notation is used consistently. Convert Western notation to Madhyam positions if needed for player convenience.'
          ]
        }
      ]
    },
    {
      id: 'live',
      title: 'Live Tab (Sessions)',
      icon: 'fa-play-circle',
      description: 'Create and present live song sessions',
      subsections: [
        {
          title: 'What are Sessions?',
          content: [
            '<strong>Session Concept:</strong> Sessions (also called setlists or playlists) are pre-planned collections of songs organized for live presentation during bhajan sessions, prayer meetings, or devotional gatherings. Each session represents a complete program with specific songs, singers, and presentation order.',
            '<strong>Purpose:</strong> Sessions allow you to prepare a structured bhajan program in advance. You can plan the flow, ensure variety in tempo and deity themes, balance singer participation, and have everything ready for smooth presentation without scrambling to find songs during the live event.',
            '<strong>Flexibility:</strong> Sessions are flexible - you can create a temporary session for one-time use, build and save sessions for recurring events (like weekly bhajans or special festivals), duplicate existing sessions and modify them, and mix songs from different languages, deities, and styles.',
            '<strong>Singer-Pitch Linking:</strong> Each song in a session is linked to a specific singer and their assigned pitch. This eliminates confusion during live sessions about who is singing and in what key. The singer sees their pitch information automatically when the song appears.',
            '<strong>Real-Time Adjustments:</strong> Even during presentation, you can navigate between songs non-linearly, skip songs if needed, and adjust the flow based on audience engagement and time constraints.',
            '<strong>Reusability:</strong> Saved sessions can be loaded and reused for similar events, edited and updated over time, shared across centers if assigned appropriately, and serve as templates for creating new sessions.'
          ]
        },
        {
          title: 'Creating a Session',
          content: [
            '<strong>Starting from Scratch:</strong> Navigate to the Live tab (accessible from the main menu). You will see an empty session area with an "Add Songs" button. This is your workspace for building the session.',
            '<strong>Adding Songs:</strong> Click "Add Songs" to open the song selection dialog. This dialog shows all songs you have access to with search and filter capabilities. Use the search bar to find specific songs by name or browse through the filtered list.',
            '<strong>Singer Selection:</strong> After selecting a song, you must choose a singer. The dialog shows only singers who have pitch assignments for that song. Each singer option displays their name, gender, and the pitch they use for this song. This ensures you only select valid singer-song combinations.',
            '<strong>Pitch Information:</strong> When you select a singer, their assigned pitch is automatically displayed. Review this to ensure it is appropriate. If the pitch seems wrong or outdated, you can cancel and update it in the Pitches tab before adding the song to the session.',
            '<strong>Building the Queue:</strong> Once you select a song and singer, click "Add to Session." The song appears in your session queue on the left side. Continue adding songs in the order you want them performed. The queue shows song name, singer name, and pitch for easy reference.',
            '<strong>Session Planning Tips:</strong> Start with an invocation or opening song, vary the tempo to maintain energy (mix slow and fast songs), include songs for different deities if appropriate, consider singer vocal fatigue (avoid too many challenging songs in a row), plan for approximately how long the session should run, and end with a closing or peace song.'
          ]
        },
        {
          title: 'Managing Sessions',
          content: [
            '<strong>Reordering Songs:</strong> Each song in your session queue has a drag handle icon (usually six dots or parallel lines). Click and hold the drag handle, then drag the song up or down to its new position. This is useful for adjusting the flow after initially building the session.',
            '<strong>Removing Songs:</strong> If you added a song by mistake or decide it does not fit, click the X button on that song entry to remove it from the session. The remaining songs stay in order. Removed songs can be re-added later if you change your mind.',
            '<strong>Clearing Entire Session:</strong> The "Clear Session" button removes all songs at once, giving you a clean slate. A confirmation dialog appears to prevent accidental clearing. Use this when you want to start over completely or when switching to a different saved session.',
            '<strong>Template Selection:</strong> Choose a presentation template for the session using the template dropdown. The selected template determines how all songs in the session will be visually presented. You can change the template at any time, even after building the session.',
            '<strong>Template Preview:</strong> Some templates show a preview thumbnail. Hover over the dropdown to see template names and descriptions. The default template (marked with a star) is automatically selected for new sessions.',
            '<strong>Session Information:</strong> The session area displays key information: total number of songs, estimated duration (if available), current template name, and whether the session has been saved. This helps you ensure the session meets your time requirements.'
          ]
        },
        {
          title: 'Presenting Sessions',
          content: [
            '<strong>Starting Presentation:</strong> Click the "Present Session" button to enter full-screen presentation mode. Ensure your selected template is appropriate and all songs have been added. The browser will request permission to go full-screen - allow this for the best experience.',
            '<strong>Full-Screen Display:</strong> The presentation takes over the entire screen with the selected template background. Lyrics appear in a readable font with proper formatting, line breaks, and stanza separations. Song metadata (title, singer, pitch) may be shown depending on the template design.',
            '<strong>Navigation During Presentation:</strong> Use <kbd>→</kbd> (right arrow) or <kbd>Space</kbd> to advance to the next lyric slide or next song. Use <kbd>←</kbd> (left arrow) to go back. <kbd>Home</kbd> jumps to the first song, <kbd>End</kbd> to the last song. Click anywhere on screen to advance (useful when using a remote clicker).',
            '<strong>Progress Indicator:</strong> A subtle progress indicator at the bottom of the screen shows which song you are on (e.g., "Song 3 of 12"). This helps the coordinator track pacing. The indicator may also show slide numbers within the current song.',
            '<strong>Multi-Monitor Setup:</strong> If you have a projector or second screen, move the browser window to the desired display before clicking "Present Session." The full-screen mode will activate on that screen. You can keep the main interface visible on your primary screen for control.',
            '<strong>Audio Playback:</strong> If the selected template includes audio elements (background music or ambiance), audio plays automatically when entering presentation mode. Volume can be adjusted through browser controls.',
            '<strong>Exiting Presentation:</strong> Press <kbd>Escape</kbd> to exit full-screen and return to the session editor. Your current position is not saved, so note which song you were on if you plan to resume. The session remains intact and can be re-presented.'
          ]
        },
        {
          title: 'Saved Sessions',
          content: [
            '<strong>Saving a Session:</strong> After building a session you want to reuse, click the "Save Session" button. A dialog opens asking for a session name (required) and optional center assignments. Choose a descriptive name like "Weekly Thursday Bhajans" or "Rama Navami Special Session."',
            '<strong>Center Assignment:</strong> When saving, you can assign the session to specific centers. Editors can only assign to their managed centers. Sessions assigned to centers are visible only to users with access to those centers. Leave center assignment empty to create a global session accessible to everyone.',
            '<strong>Overwriting Sessions:</strong> If you save with the same name as an existing session, a confirmation dialog asks if you want to overwrite. Overwriting replaces the entire song list and settings. Use this to update recurring sessions with new songs or different singers.',
            '<strong>Loading Saved Sessions:</strong> Use the "Load Session" dropdown to see all saved sessions you have access to. Sessions are listed alphabetically. Select one to load its songs into the current workspace. Any unsaved changes to the current session are lost, so save first if needed.',
            '<strong>Editing Saved Sessions:</strong> Load a saved session, make your changes (add/remove/reorder songs), and save it again with the same name to update it. You can also load a session, modify it, and save under a new name to create a variant.',
            '<strong>Deleting Saved Sessions:</strong> Load the session you want to delete, then use the delete option (usually in the session menu or as a button). A confirmation dialog appears. Deleting is permanent and cannot be undone. The session is removed from the database.',
            '<strong>Session Sharing:</strong> Sessions assigned to multiple centers are accessible by all users in those centers. This allows coordinators from different locations to share pre-planned sessions. Global sessions (no center assignment) are accessible to everyone, making them useful for organization-wide standard sessions.'
          ]
        }
      ]
    },
    {
      id: 'templates',
      title: 'Templates Tab',
      icon: 'fa-layer-group',
      description: 'Design presentation templates',
      requiredRole: 'editor',
      subsections: [
        {
          title: 'What are Templates?',
          content: [
            '<strong>Template Definition:</strong> Templates are reusable design configurations that control the visual presentation of song lyrics during full-screen presentations. Think of them as themes or skins that determine backgrounds, text styling, positioning, and multimedia elements.',
            '<strong>Purpose and Benefits:</strong> Templates ensure consistent visual branding across all presentations, allow you to create professional-looking slides without design skills for each song, enable quick switching between different visual styles for different occasions, and support multimedia elements like background images, videos, and audio.',
            '<strong>Multi-Slide Capability:</strong> Unlike simple backgrounds, templates can contain multiple slide layouts that cycle during a single song. For example, slide 1 might have a deity image background, slide 2 a gradient, and slide 3 a nature scene. These slides rotate as lyrics progress, adding visual variety.',
            '<strong>Aspect Ratios:</strong> Templates are designed for specific aspect ratios: 16:9 (widescreen) for modern projectors and TVs, or 4:3 (traditional) for older equipment. Choose the ratio matching your display hardware for best results.',
            '<strong>Lyric Integration:</strong> Templates include lyric areas where song text automatically appears. You define the position, font, size, color, and styling of these lyrics. The system handles breaking lyrics into slides and displaying them at the designated location.',
            '<strong>Global vs Center-Specific:</strong> Templates can be global (accessible to everyone) or assigned to specific centers. Center-specific templates help maintain branding for particular locations or events.'
          ]
        },
        {
          title: 'Viewing Templates',
          content: [
            '<strong>Template Gallery:</strong> The Templates tab displays all templates you have access to in a card or grid layout. Each template card shows a preview thumbnail (first slide), template name, description, aspect ratio indicator, number of slides, and center badges showing where it is available.',
            '<strong>Default Template:</strong> One template can be marked as default (shown with a star icon). The default template is automatically selected when creating new presentations or sessions. Having a default saves time and ensures consistency.',
            '<strong>Preview Mode:</strong> Click on any template card to open a detailed preview. The preview shows how sample lyrics would appear, displays all slides in the template, shows background images, videos, and overlays, and allows you to see text styling and positioning.',
            '<strong>Filtering by Aspect Ratio:</strong> Use filters to show only 16:9 or 4:3 templates. This helps when you know your display requirements and want to avoid selecting an incompatible template.',
            '<strong>Sorting Options:</strong> Sort templates alphabetically by name, by date created (newest first), or by usage count (most popular templates first). Popular templates indicate community preferences.',
            '<strong>Template Metadata:</strong> Each template shows creation date, last modified date, creator (if tracked), number of songs/sessions using it, and associated centers. This information helps you choose appropriate templates and understand their context.'
          ]
        },
        {
          title: 'Creating Templates (Editors & Admins)',
          content: [
            '<strong>Starting New Template:</strong> Click "Create New Template" to open the template editor. You will be prompted to choose between Visual Designer (graphical interface) or YAML Editor (code-based). For beginners, start with Visual Designer.',
            '<strong>Basic Information:</strong> Enter a descriptive template name (e.g., "Krishna Blue Gradient 16:9"), add an optional description explaining when to use this template, select aspect ratio (16:9 or 4:3), and assign to centers or leave global.',
            '<strong>Reference Slide:</strong> Templates can have multiple slides, but one is designated as the reference slide. This is the slide used for calculating lyric positioning and sizing. Usually, this is the first slide, but you can specify a different index if needed.',
            '<strong>Design Considerations:</strong> Ensure text is readable against backgrounds (use contrast), leave adequate margins (lyrics should not touch edges), test on actual display hardware if possible, consider accessibility (font size, color contrast), keep designs simple for easier reading during bhajans, and avoid overly busy backgrounds that distract from lyrics.',
            '<strong>Saving and Testing:</strong> Save your template frequently while designing. After saving, test it by presenting a sample song to see how real lyrics appear. Make adjustments based on readability and aesthetic appeal.'
          ]
        },
        {
          title: 'Visual Designer',
          content: [
            '<strong>Designer Interface:</strong> The Visual Designer provides a drag-and-drop interface with a live preview canvas on the left showing how the slide looks, a properties panel on the right for configuring elements, and a toolbar at the top with tools for adding backgrounds, images, text, etc.',
            '<strong>Background Configuration:</strong> Click the background tool to set slide backgrounds. Options include solid colors (choose from color picker), gradients (linear or radial with multiple color stops), and images (provide URLs to hosted images). Backgrounds can have opacity adjustment for layering effects.',
            '<strong>Adding Images:</strong> Use the image tool to add decorative images (deities, symbols, nature, etc.). Provide a URL to the image file (must be publicly accessible), position the image by dragging on canvas or entering coordinates, resize using corner handles or numeric values, and adjust opacity to create watermark effects.',
            '<strong>Video Backgrounds:</strong> Add video elements for dynamic backgrounds. Provide URL to MP4 video file, set autoplay (usually yes for backgrounds), enable looping for continuous play, adjust volume (usually muted for backgrounds), and position/size like images.',
            '<strong>Text Overlays:</strong> Add static text elements (not lyrics) for headers, footers, or decorative text. Type the text content, choose font family from available fonts, set font size, weight (bold, normal), color, and alignment, position text anywhere on the canvas, and add effects like shadows or outlines if supported.',
            '<strong>Lyric Positioning:</strong> A special lyric area tool defines where song lyrics appear. Position this area carefully as all lyrics flow here. Set font family, size, color, line height (spacing between lines), text alignment (center, left, right), and background color/opacity behind lyrics if needed for readability.',
            '<strong>Multi-Slide Templates:</strong> Use the slide manager to add additional slides. Each slide can have completely different backgrounds and elements. Slides transition automatically as lyrics progress. Specify transition duration if supported.'
          ]
        },
        {
          title: 'YAML Editor (Advanced)',
          content: [
            '<strong>YAML Structure:</strong> The YAML Editor allows direct editing of template configuration in YAML format. This provides full control over all properties, including some advanced options not available in Visual Designer. YAML is a human-readable data format using indentation for structure.',
            '<strong>Template Schema:</strong> The template YAML has a defined structure: basic metadata (name, description, aspectRatio), slides array (list of slide configurations), each slide has background, images, videos, text, and lyric properties, and a referenceSlideIndex indicating which slide is the primary layout.',
            '<strong>Editing Workflow:</strong> Edit the YAML directly in the text editor, use proper indentation (2 spaces per level), follow the schema structure carefully, validate YAML before saving to catch errors, and preview changes to see how they render.',
            '<strong>Advanced Capabilities:</strong> YAML editing allows precise positioning with decimal values, complex gradient definitions with multiple stops, CSS-style properties not exposed in Visual Designer, animation configurations (if supported), and conditional logic for different screen sizes.',
            '<strong>Validation:</strong> Click "Validate YAML" before saving to check for syntax errors, schema compliance, missing required fields, and invalid property values. Validation errors show line numbers and descriptions to help you fix issues.',
            '<strong>Documentation:</strong> Reference the schema documentation (usually available in editor) for complete list of properties, property types and valid values, examples of common configurations, and best practices for YAML editing.'
          ]
        },
        {
          title: 'Template Elements',
          content: [
            '<strong>Background Types:</strong> Solid Color - single uniform color specified by hex code or RGB. Gradient - smooth transition between colors; linear (top to bottom, left to right) or radial (center outward). Image - URL to hosted image file (JPG, PNG); automatically scaled/cropped to fit aspect ratio.',
            '<strong>Image Overlays:</strong> Add decorative images on top of backgrounds. Supported formats: PNG (with transparency), JPG/JPEG. Properties: URL (publicly accessible), position (x, y coordinates or percentage), size (width, height), opacity (0-100%), and z-index (layering order).',
            '<strong>Video Elements:</strong> Embed video backgrounds for dynamic presentations. Format: MP4 (H.264 codec recommended). Properties: URL to video file, autoplay (true/false), loop (true/false), muted (true/false), volume (0-100%), position, and size.',
            '<strong>Text Overlays:</strong> Static text not dependent on song content. Properties: content (actual text), font family, font size (px or em), color, font weight (normal, bold), text alignment, position, rotation, shadow effects, and opacity.',
            '<strong>Lyric Areas:</strong> Special zones where song lyrics render. Properties: position (usually centered), width and height (or auto), font family, font size, color, line height (spacing), text alignment, background color/opacity (optional for readability), padding, and text shadow.',
            '<strong>Audio Elements:</strong> Background music or ambient sound. Format: MP3, OGG. Properties: URL to audio file, autoplay, loop, volume, and fade in/out duration. Audio plays when presentation starts and loops continuously if enabled.'
          ]
        },
        {
          title: 'Multi-Slide Templates',
          content: [
            '<strong>Concept:</strong> Multi-slide templates contain more than one slide layout within a single template. As lyrics progress, the system cycles through these slides, providing visual variety during a long song. Each slide is a complete design with its own background and elements.',
            '<strong>Creating Multiple Slides:</strong> In Visual Designer, use "Add Slide" button to create new slides. Each slide appears as a tab. Design each slide independently. In YAML Editor, add additional objects to the slides array. Each object represents one slide with complete configuration.',
            '<strong>Reference Slide Index:</strong> Despite having multiple slides, one slide is designated as the reference (typically slide 0, the first one). This slide determines primary lyric positioning. All slides should have similar lyric areas to ensure consistency.',
            '<strong>Slide Progression:</strong> Slides cycle in order: slide 0, slide 1, slide 2, etc., then back to slide 0. The system determines when to switch slides based on lyric progression. Typically, each slide displays for a few stanzas before transitioning.',
            '<strong>Use Cases:</strong> Variety in long songs to maintain visual interest, thematic progression (e.g., slide 1: morning sky, slide 2: noon sun, slide 3: evening sunset), alternating between deity images if the song addresses multiple deities, and gradual color shifts for emotional progression.',
            '<strong>Design Consistency:</strong> While slides can be different, maintain some consistency: use similar lyric positioning across all slides, keep lyric font, size, and color consistent, ensure readability on all background variations, and avoid jarring transitions (smooth color/theme shifts).',
            '<strong>Performance:</strong> More slides increase template complexity and file size. Keep slide count reasonable (3-5 slides typically sufficient). Test performance on actual hardware, especially with video backgrounds or complex images on all slides.'
          ]
        },
        {
          title: 'Managing Templates',
          content: [
            '<strong>Setting Default Template:</strong> Click the star icon on any template card to set it as default. Only one template can be default at a time. Setting a new default removes the previous default status. The default template is auto-selected for new presentations and sessions.',
            '<strong>Duplicating Templates:</strong> To create variations, duplicate an existing template using the duplicate icon. This creates a copy with "(Copy)" appended to the name. Edit the duplicate to create a variant without affecting the original. Useful for creating templates for different occasions based on a common design.',
            '<strong>Editing Templates:</strong> Click edit icon on any template card to reopen the editor. All existing properties and slides are loaded. Make changes in Visual Designer or YAML Editor. Save to update the template. Changes apply to all future presentations but do not affect presentations already in progress.',
            '<strong>Deleting Templates:</strong> Click delete icon to remove a template. A confirmation dialog warns if the template is in use by saved sessions. Cannot delete if it is the only template or the default (set another as default first). Deletion is permanent and cannot be undone.',
            '<strong>Template Versioning:</strong> While the system does not maintain full version history, the updated_at timestamp tracks when templates were last modified. Keep backups of important templates by duplicating them before making significant changes.'
          ]
        }
      ]
    },
    {
      id: 'centers',
      title: 'Centers (Admin)',
      icon: 'fa-building',
      description: 'Manage centers and permissions',
      requiredRole: 'admin',
      subsections: [
        {
          title: 'What are Centers?',
          content: [
            'Centers represent different locations or groups',
            'Control access to songs, singers, templates, and sessions',
            'Assign users as editors for specific centers',
            'Global content (no centers) is accessible to everyone',
            'Center-specific content is only visible to authorized users'
          ]
        },
        {
          title: 'Creating Centers',
          content: [
            'Click "Add Center" button',
            'Enter center name (required)',
            'Choose badge text color for visual identification',
            'Assign editors who can manage content for this center',
            'Save to create the new center',
            'Centers appear in all dropdowns and filters'
          ]
        },
        {
          title: 'Managing Centers',
          content: [
            'View all centers with editor counts',
            'Edit center name and badge color',
            'Add or remove editors for each center',
            'See statistics: singers, songs, templates, sessions per center',
            'Delete centers (only if no content is assigned)',
            'View dependencies before deletion'
          ]
        },
        {
          title: 'Assigning Editors',
          content: [
            'Editors can create/edit content in their assigned centers',
            'Assign editors when creating/editing centers',
            'Also assignable in the Singers tab (for user accounts)',
            'Editors see only their centers in dropdowns',
            'Multiple editors can manage the same center',
            'Admins can manage all centers'
          ]
        },
        {
          title: 'Content Association',
          content: [
            'Songs, singers, templates, and sessions can be assigned to centers',
            'Users see content from their assigned centers + global content',
            'Editors can only edit content in their centers',
            'Content can belong to multiple centers',
            'Unassigned content (no centers) is globally accessible',
            'Use centers to organize multi-location deployments'
          ]
        }
      ]
    },
    {
      id: 'keyboard',
      title: 'Keyboard Shortcuts',
      icon: 'fa-keyboard',
      description: 'Quick access keyboard shortcuts',
      subsections: [
        {
          title: 'Global Shortcuts',
          content: [
            '<kbd>Ctrl+Shift+I</kbd> or <kbd>Cmd+Shift+I</kbd> - Open login dialog',
            '<kbd>Escape</kbd> - Close dialogs and exit presentation mode',
            '<kbd>/</kbd> - Focus search (in list views)',
            '<kbd>Ctrl+K</kbd> or <kbd>Cmd+K</kbd> - Global search (if implemented)'
          ]
        },
        {
          title: 'Presentation Mode Shortcuts',
          content: [
            '<kbd>→</kbd> or <kbd>Space</kbd> - Next slide',
            '<kbd>←</kbd> - Previous slide',
            '<kbd>Home</kbd> - First slide',
            '<kbd>End</kbd> - Last slide',
            '<kbd>Escape</kbd> - Exit presentation',
            '<kbd>F</kbd> - Toggle fullscreen (browser dependent)'
          ]
        },
        {
          title: 'Form Navigation',
          content: [
            '<kbd>Tab</kbd> - Move to next field',
            '<kbd>Shift+Tab</kbd> - Move to previous field',
            '<kbd>Enter</kbd> - Submit form (when focused on button)',
            '<kbd>Escape</kbd> - Cancel and close form'
          ]
        }
      ]
    },
    {
      id: 'features',
      title: 'Advanced Features',
      icon: 'fa-magic',
      description: 'Power user features and tips',
      subsections: [
        {
          title: 'Smart Search (AI-Powered)',
          content: [
            '<strong>Natural Language Search:</strong> Smart Search uses artificial intelligence to understand your search intent in natural, conversational language. Instead of matching exact keywords, it analyzes the meaning and context of your query to find relevant songs.',
            '<strong>How to Use:</strong> Enable Smart Search by clicking the "Smart Search" toggle button in the Songs tab. Then type your query in plain English. Examples: "fast songs about Lord Krishna", "devotional songs for meditation", "Telugu bhajans with easy melodies", "songs praising Mother Sai".',
            '<strong>AI Analysis:</strong> The system analyzes your query and compares it against song lyrics (in both original language and English), song meanings and contexts, metadata (deity, tempo, language, beat), and historical usage patterns. It ranks results by relevance to your query.',
            '<strong>Advanced Queries:</strong> You can combine multiple criteria: "medium tempo Hindi songs about Rama suitable for beginners", "uplifting bhajans in Sanskrit with Bhairavi raga". The AI understands these complex queries and finds the best matches.',
            '<strong>Learning System:</strong> Over time, the Smart Search learns from usage patterns and improves recommendations. Songs that are frequently selected for certain types of queries rank higher in future similar searches.',
            '<strong>Fallback:</strong> If Smart Search does not find good matches or if you prefer traditional search, simply toggle it off to return to standard keyword matching. Both modes are available at any time.'
          ]
        },
        {
          title: 'Data Import (Admin)',
          content: [
            '<strong>Song Import:</strong> Admins can import songs from external sources using the Import Songs tool. Paste JSON data from external song databases, map fields to match system schema, validate before importing, and review import results. This is useful for initially populating the database or adding batches of new songs.',
            '<strong>CSV Import:</strong> The CSV Import tool (Admin only) allows importing singers and pitches from spreadsheet files. Prepare a CSV with required columns (Singer Name, Gender, Song Title, Pitch, etc.), upload the file, map columns to database fields, the system matches songs by title and creates missing singers, review and confirm before finalizing. This is efficient for migrating data from other systems.',
            '<strong>Bulk Import Pitches:</strong> Use CSV import to add many pitch assignments at once. Create a spreadsheet with columns: Song Name, Singer Name, Pitch. Upload and validate, the system matches existing songs and singers, creates pitch assignments for valid matches, and reports errors for unmatched entries.',
            '<strong>Data Migration:</strong> When moving from legacy systems, use import tools to migrate data in bulk rather than manual entry. Export from old system to CSV or JSON, prepare data to match Song Studio schema, import in stages (songs first, then singers, then pitches), verify data integrity after each import, and clean up any duplicates or errors.'
          ]
        },
        {
          title: 'Feedback System',
          content: [
            '<strong>Submitting Feedback:</strong> Click the floating feedback button in the bottom-right corner of any page (looks like a speech bubble or comment icon). This opens the feedback drawer where you can report issues or suggest improvements.',
            '<strong>Feedback Types:</strong> Choose from Bug Report (something is broken or not working correctly), Feature Request (suggest new functionality), General Feedback (comments, praise, general suggestions), or UI/UX Issue (interface is confusing or difficult to use).',
            '<strong>Writing Feedback:</strong> Provide a clear, detailed description. For bugs, include what you were trying to do, what you expected to happen, and what actually happened. For features, explain the use case and how it would help.',
            '<strong>Automatic Screenshots:</strong> The system can automatically capture a screenshot of your current screen and attach it to the feedback. This helps admins understand context. You can opt-out if the screen contains sensitive information.',
            '<strong>Contact Information:</strong> Optionally provide your email if you want a response or updates. Anonymous feedback is allowed but limits admins ability to ask follow-up questions.',
            '<strong>Tracking Status (Admin):</strong> Admins can view all submitted feedback in the Feedback tab. They see feedback type, description, screenshots, submission date, and submitter email. Admins can mark feedback as New, In Progress, Resolved, or Won\'t Fix.',
            '<strong>Following Up:</strong> If you provided an email, admins may reach out with questions or to notify you when issues are resolved. Check your email for responses. Your feedback helps improve the platform for everyone.'
          ]
        },
        {
          title: 'Database Status',
          content: [
            '<strong>Connection Indicator:</strong> The database status icon appears in the top navigation bar (visible only to authenticated users). A green checkmark means the system is connected to the database. A red X means the connection is lost.',
            '<strong>Monitoring:</strong> The application continuously monitors the database connection in the background. If connectivity issues are detected, the indicator updates automatically. This real-time monitoring helps identify problems quickly.',
            '<strong>Connection Details:</strong> Click on the database status icon to open a dropdown with connection details. See connection status, error messages (if any), last successful connection time, and reconnection options.',
            '<strong>Reconnection:</strong> If the connection is lost, click "Reconnect Database" in the dropdown. The system attempts to re-establish the connection. If successful, the indicator turns green and normal operation resumes.',
            '<strong>Impact of Disconnection:</strong> When disconnected, you cannot save changes (create, update, delete operations are blocked), data fetching from server is disabled, you can still browse cached data (songs, singers you have already loaded), and presentations continue to work if data was loaded before disconnection.',
            '<strong>Troubleshooting:</strong> If reconnection fails repeatedly, check your internet connection (try loading another website), verify that the database server is running (contact admin), clear browser cache and refresh the page, and if the issue persists, report it to the administrator.',
            '<strong>Admin View:</strong> Admins see additional connection diagnostics including server response time, active connection pool statistics, and recent query performance. This helps admins identify database performance issues.'
          ]
        },
        {
          title: 'Responsive Design',
          content: [
            '<strong>Multi-Device Support:</strong> Song Studio is fully responsive, meaning it adapts to different screen sizes and devices. Use it on desktop computers (Windows, Mac, Linux), laptops, tablets (iPad, Android tablets), and smartphones (iOS, Android).',
            '<strong>Mobile Navigation:</strong> On small screens (phones, small tablets), the main navigation menu collapses into a hamburger menu icon. Tap the icon to reveal all navigation options in a slide-out menu.',
            '<strong>Touch Interfaces:</strong> On touch devices, all buttons and controls are sized for easy finger tapping. Drag-and-drop for reordering (like in sessions) works with touch gestures. Swipe gestures navigate presentations on mobile.',
            '<strong>Optimized Layouts:</strong> Content layouts adjust for screen size: card grids become single columns on narrow screens, forms stack vertically on mobile for easier scrolling, tables switch to card views on small screens, and text sizes scale appropriately for readability.',
            '<strong>Presentation Mode on Mobile:</strong> Presentations work beautifully on tablets and phones. Full-screen mode uses the entire device screen. Swipe left/right to navigate slides. Pinch-to-zoom if you need to see lyrics closer (though this is generally not needed).',
            '<strong>Performance:</strong> The application is optimized for performance on all devices including lazy loading of images and data, efficient caching to reduce data usage, smooth animations even on older devices, and minimal battery drain.',
            '<strong>Browser Compatibility:</strong> Works on all modern browsers: Chrome, Firefox, Safari, Edge, Samsung Internet. For best experience, keep your browser updated. Some very old browsers may have limited functionality.'
          ]
        }
      ]
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      icon: 'fa-wrench',
      description: 'Common issues and solutions',
      subsections: [
        {
          title: 'Login Issues',
          content: [
            '<strong>Correct Email:</strong> Ensure you are using the email address associated with your singer profile. OTPs are only sent to registered email addresses. If you are unsure which email is registered, contact your admin to verify.',
            '<strong>OTP Not Received:</strong> Check your spam/junk folder - OTP emails sometimes get filtered. Verify the email address you entered is correct (no typos). Wait a few moments - email delivery can take 30 seconds to 2 minutes. Check your email server is not blocking emails from the Song Studio domain.',
            '<strong>OTP Expired:</strong> One-time passwords expire after 10 minutes for security. If your OTP expired, click "Resend OTP" or "Request New OTP" to generate a fresh code. Do not reuse old OTPs.',
            '<strong>Invalid OTP Error:</strong> Ensure you typed the OTP exactly as received (no extra spaces). OTPs are case-sensitive if they include letters. If copy-pasting, make sure no extra characters are included. Request a new OTP if the current one is not working.',
            '<strong>Cannot Receive OTPs:</strong> Your email account may have issues. Verify you can receive other emails. Check email server settings are not blocking automated emails. Contact your admin to verify your email is correctly registered in the system.',
            '<strong>Browser Issues:</strong> Clear browser cache and cookies, then try again. Try a different browser to see if the issue is browser-specific. Disable browser extensions that might interfere with login (password managers, security extensions). Try incognito/private mode to eliminate extension interference.',
            '<strong>Account Not Found:</strong> If the system says your email is not registered, you may not have a user account yet. Contact your admin to create an account for you or add your email to an existing singer profile.'
          ]
        },
        {
          title: 'Cannot Edit Content',
          content: [
            '<strong>Check Your Role:</strong> Only editors and admins can edit content. Viewers can only browse. Check your role badge in the top-right user dropdown. If you should have edit access but do not, contact your admin.',
            '<strong>Center Permissions:</strong> Editors can only edit content in their assigned centers. If you try to edit a song, singer, or template outside your centers, you will see read-only fields or access denied messages. Verify which centers you have editor access to in your user profile.',
            '<strong>Global Content:</strong> Content with no center assignment (global content) requires admin access to edit. Editors cannot modify global content even if they can see it. Request your admin to either assign the content to your center or give you temporary admin access.',
            '<strong>Read-Only Fields:</strong> Some fields are intentionally read-only for certain roles. For example, editors cannot change admin privileges or editor assignments for singers. This is a security measure to prevent privilege escalation.',
            '<strong>Locked Content:</strong> Some content may be locked by the system or another admin to prevent accidental changes. If you see a lock icon or "Content Locked" message, contact the admin who locked it.',
            '<strong>Request Access:</strong> If you need to edit content outside your current permissions, contact your admin. Explain what you need to edit and why. Admins can temporarily grant access, reassign content to your centers, or make the edits for you.',
            '<strong>Session Expired:</strong> Your login session may have expired, reverting you to viewer status. Try logging out and back in. Check if your role and center assignments are still correct after logging back in.'
          ]
        },
        {
          title: 'Presentation Not Loading',
          content: [
            '<strong>Internet Connection:</strong> Presentations require internet to load templates, backgrounds, and media files. Check that you are connected to the internet. Try loading another website to confirm connectivity. If on mobile data, ensure you have sufficient signal strength.',
            '<strong>Template Validation:</strong> The selected template may have invalid configuration. Try switching to a different template (use the template dropdown in the session editor). If a specific template always fails, it may have broken media URLs or invalid YAML.',
            '<strong>Media URLs:</strong> Templates reference external media files (images, videos) via URLs. If these URLs are broken or inaccessible, the presentation may fail to load. Admins can check template configuration and update URLs. Try using a template with only solid color backgrounds to isolate the issue.',
            '<strong>Browser Cache:</strong> Cached template or media files may be corrupt. Clear your browser cache: Chrome/Edge (Ctrl+Shift+Delete), Firefox (Ctrl+Shift+Delete), Safari (Cmd+Option+E). After clearing cache, reload the page and try again.',
            '<strong>Browser Compatibility:</strong> Ensure you are using a modern, updated browser. Very old browsers may not support required features. Update your browser to the latest version. Try a different browser to see if the issue is browser-specific.',
            '<strong>Video Formats:</strong> If templates use video backgrounds, ensure the video format is supported. MP4 with H.264 codec is most compatible. Some browsers do not support certain codecs. Try templates without videos to see if videos are the problem.',
            '<strong>Console Errors:</strong> Press F12 to open browser developer tools. Check the Console tab for error messages. These errors can help identify what is failing. Share error messages with your admin for troubleshooting.',
            '<strong>Firewall/Proxy:</strong> Corporate or school networks may block media URLs. Check with your network admin if certain URLs are blocked. Use a personal network or mobile hotspot to test if network restrictions are the issue.'
          ]
        },
        {
          title: 'Database Connection Lost',
          content: [
            '<strong>Reconnect:</strong> Click the red X icon in the header navigation bar. Select "Reconnect Database" from the dropdown. Wait 5-10 seconds for the connection attempt. If successful, the icon turns green and you can resume work.',
            '<strong>Internet Check:</strong> The database connection requires internet. Verify you have active internet by loading another website. Check Wi-Fi or ethernet connection. If on mobile, ensure data is enabled and you have signal.',
            '<strong>Temporary Outage:</strong> The database server may be temporarily unavailable due to maintenance, updates, or technical issues. Wait a few minutes and try reconnecting. Check if other users are experiencing the same issue.',
            '<strong>Session Timeout:</strong> Long periods of inactivity may cause the session to timeout. Reconnecting usually reestablishes the session. If reconnection fails, try logging out and back in.',
            '<strong>Cached Data:</strong> While disconnected, you can still browse data that was already loaded (cached in your browser). You cannot make changes or load new data. This allows you to continue presentations or review information even when disconnected.',
            '<strong>Persistent Issues:</strong> If reconnection fails repeatedly after multiple attempts, there may be a server problem. Contact your administrator immediately. Provide details: when the issue started, error messages seen, whether other users are affected.',
            '<strong>Admin Tools:</strong> Admins have access to advanced diagnostics in the database status dropdown. Check server status, view recent errors, see active connections, and review performance metrics. Use this information to troubleshoot server-side issues.',
            '<strong>Local Development:</strong> If running a local development instance, ensure the database service is running. Check Docker containers or database processes. Review server logs for connection errors.'
          ]
        },
        {
          title: 'Missing Content',
          content: [
            '<strong>Check Filters:</strong> Active filters may be hiding the content you are looking for. Look for filter badges or highlighted filter buttons. Click "Clear All Filters" or reset filters one by one. Missing content often reappears once filters are cleared.',
            '<strong>Center Access:</strong> Content may be assigned to centers you do not have access to. Editors only see content from their assigned centers plus global content. Viewers see content from their singer centers plus global content. If you cannot see content that should exist, check with admin about center assignments.',
            '<strong>Search Scope:</strong> Your search term may be too specific or have typos. Try broader search terms. Use Smart Search for natural language queries. Remove search filters and browse manually. Check spelling of names, especially for names in other languages.',
            '<strong>Content Actually Missing:</strong> The content may not have been created yet. Verify with others that it should exist. Check if it was accidentally deleted (admins can sometimes review deletion logs). Someone may need to create it.',
            '<strong>Recently Deleted:</strong> Content deleted within the last few minutes may still appear in some cached views but fail to load details. Refresh the page to clear cache. If content was deleted by mistake, contact admin immediately - some deletions can be undone if caught quickly.',
            '<strong>Pitch Assignment Issues:</strong> If you cannot find a singer-song combination you expect, the pitch assignment may not exist. Check the Pitches tab directly. Verify both the song and singer exist individually. Create the pitch assignment if it is missing.',
            '<strong>Session Songs Not Loading:</strong> Saved sessions may reference songs or singers that were deleted. Load the session and check for errors or missing songs. Re-add any missing songs with current singers. Save the session again to update it.',
            '<strong>Global vs Center Content:</strong> Remember that "All" or empty center filter shows global content (no center assignment). To see center-specific content, select specific centers in the filter. Some users mistakenly think global content is "no content" when it is actually content accessible to everyone.'
          ]
        },
        {
          title: 'Performance Issues',
          content: [
            '<strong>Browser Tabs:</strong> Having many browser tabs open consumes memory and CPU. Close unused tabs, especially those with videos or complex web apps. Keep only necessary tabs open. Restart your browser periodically to clear memory.',
            '<strong>Browser Cache:</strong> Over time, cache can become bloated with old data. Clear browser cache and cookies: Chrome (Settings > Privacy > Clear browsing data), Firefox (Options > Privacy > Clear Data), Safari (Preferences > Privacy > Manage Website Data). Select "All time" and clear.',
            '<strong>Browser Updates:</strong> Outdated browsers may have performance issues and security vulnerabilities. Check for updates: Chrome (Settings > About Chrome), Firefox (Help > About Firefox), Safari (updates with macOS), Edge (Settings > About Edge). Install updates and restart browser.',
            '<strong>Browser Extensions:</strong> Extensions consume resources and can conflict with web apps. Temporarily disable all extensions to test performance. Re-enable one at a time to identify problematic extensions. Remove or replace slow or conflicting extensions.',
            '<strong>Internet Speed:</strong> Slow internet affects page loading and media streaming. Test your internet speed at speedtest.net. If slow, restart your router/modem. Close other apps using bandwidth (video streaming, downloads). Consider upgrading internet plan if consistently slow.',
            '<strong>Device Performance:</strong> Old or under-powered devices may struggle with modern web apps. Close other applications running on your device. Restart your device to clear memory. Consider using a more powerful device for better performance.',
            '<strong>Large Datasets:</strong> Pages with thousands of songs, singers, or pitches may load slowly. Use filters to reduce the dataset size. Pagination helps (if available). Admins can optimize database queries or add indexing to improve performance.',
            '<strong>Template Complexity:</strong> Templates with many high-resolution images or videos can slow presentation loading. Use optimized, compressed media files. Consider simpler templates for older hardware. Test templates on actual presentation hardware before live use.',
            '<strong>Network Quality:</strong> Unstable or high-latency networks cause intermittent slowness. Use wired ethernet instead of Wi-Fi if possible. Move closer to Wi-Fi router for better signal. Avoid public Wi-Fi for presentation if possible.',
            '<strong>Try Different Browser:</strong> Some browsers perform better than others on certain hardware. If Chrome is slow, try Firefox or Edge. Each browser has different optimizations. Use the browser that works best on your specific device.'
          ]
        }
      ]
    },
    {
      id: 'dialogs',
      title: 'Dialog Reference',
      icon: 'fa-window-maximize',
      description: 'All dialog windows and their functions',
      subsections: [
        {
          title: 'Song Form Dialog',
          content: [
            '<strong>Purpose:</strong> Create or edit songs',
            '<strong>Required:</strong> Name, Language',
            '<strong>Optional:</strong> Deity, Tempo, Beat, Raga, Level, External URL, Original Lyrics, English Lyrics, Meaning, Context',
            '<strong>Centers:</strong> Multi-select (empty = global)',
            '<strong>Actions:</strong> Save, Cancel, Escape to close'
          ]
        },
        {
          title: 'Singer Form Dialog',
          content: [
            '<strong>Purpose:</strong> Create or edit singer profiles',
            '<strong>Required:</strong> Name, Gender, At least one Center',
            '<strong>Optional:</strong> Email (required for admin/editor privileges)',
            '<strong>Admin Only:</strong> Is Admin checkbox, Editor For Centers multi-select',
            '<strong>Read-Only Mode:</strong> Activated when you lack center access',
            '<strong>Actions:</strong> Save, Cancel, Escape to close'
          ]
        },
        {
          title: 'Pitch Form Dialog',
          content: [
            '<strong>Purpose:</strong> Assign pitch to singer-song combination',
            '<strong>Fields:</strong> Song (dropdown), Singer (dropdown), Pitch (Western/Madhyam notation)',
            '<strong>Constraint:</strong> One pitch per song-singer pair',
            '<strong>Edit Mode:</strong> Song and Singer fields are read-only',
            '<strong>Actions:</strong> Save, Cancel, Escape to close'
          ]
        },
        {
          title: 'Template Form Dialog',
          content: [
            '<strong>Purpose:</strong> Create or edit presentation templates',
            '<strong>Editor Modes:</strong> WYSIWYG (🖱️) and YAML (⚙️) - switch via tabs',
            '<strong>Required:</strong> Name, Aspect Ratio (16:9 or 4:3)',
            '<strong>Optional:</strong> Description, Center Assignment, Set as Default',
            '<strong>Actions:</strong> Save, Cancel, Preview, Validate (YAML mode), Switch to YAML/WYSIWYG'
          ]
        },
        {
          title: 'WYSIWYG Editor',
          content: [
            '<strong>Purpose:</strong> Visual drag-and-drop template design',
            '<strong>Features:</strong> Live preview canvas, slide management, element positioning',
            '<strong>Elements:</strong> Backgrounds (color/gradient/image), Images, Videos, Audio, Text overlays, Lyric areas',
            '<strong>Controls:</strong> Drag to position, resize with handles, adjust opacity, add/delete slides',
            '<strong>Switch to YAML:</strong> Click ⚙️ YAML tab to edit as code'
          ]
        },
        {
          title: 'YAML Editor',
          content: [
            '<strong>Purpose:</strong> Advanced text-based template configuration',
            '<strong>Features:</strong> Direct YAML editing, syntax highlighting, validation',
            '<strong>Structure:</strong> Template metadata, slides array, reference slide index',
            '<strong>Validation:</strong> Click Validate button before saving',
            '<strong>Switch to WYSIWYG:</strong> Click 🖱️ WYSIWYG tab for visual editing'
          ]
        },
        {
          title: 'Session Save Dialog',
          content: [
            '<strong>Purpose:</strong> Save current session for reuse',
            '<strong>Required:</strong> Session Name',
            '<strong>Optional:</strong> Center Assignment',
            '<strong>Overwrite:</strong> Confirmation if name exists',
            '<strong>Saved Data:</strong> Song list, order, singer assignments, pitch info, template reference',
            '<strong>Actions:</strong> Save, Cancel'
          ]
        },
        {
          title: 'Merge Singers Dialog',
          content: [
            '<strong>Purpose:</strong> Consolidate duplicate singer entries',
            '<strong>Trigger:</strong> Select multiple singers → Merge button',
            '<strong>Process:</strong> Choose target singer to keep',
            '<strong>Effect:</strong> All pitches transfer to target, other singers deleted',
            '<strong>Warning:</strong> Cannot be undone',
            '<strong>Actions:</strong> Confirm, Cancel'
          ]
        },
        {
          title: 'Delete Confirmation Dialog',
          content: [
            '<strong>Purpose:</strong> Prevent accidental deletions',
            '<strong>Shows:</strong> Item name, type, dependencies, cascade effects',
            '<strong>Blocking:</strong> Cannot delete if critical dependencies exist',
            '<strong>Cascade:</strong> Song deletion removes pitches; Singer deletion removes pitches and account',
            '<strong>Warning:</strong> Cannot be undone',
            '<strong>Actions:</strong> Confirm Delete, Cancel, Escape'
          ]
        },
        {
          title: 'Login Dialog',
          content: [
            '<strong>Trigger:</strong> <kbd>Ctrl+Shift+I</kbd> or <kbd>Cmd+Shift+I</kbd>',
            '<strong>Method:</strong> Email + OTP (One-Time Password)',
            '<strong>OTP Validity:</strong> 10 minutes',
            '<strong>Steps:</strong> Enter email → Send OTP → Check email → Enter 6-digit code → Verify',
            '<strong>Actions:</strong> Send OTP, Resend OTP, Verify OTP, Cancel'
          ]
        },
        {
          title: 'Feedback Dialog',
          content: [
            '<strong>Trigger:</strong> Feedback button (bottom-right corner)',
            '<strong>Types:</strong> Bug Report, Feature Request, General Feedback, UI/UX Issue',
            '<strong>Fields:</strong> Type (required), Description (required), Email (optional)',
            '<strong>Features:</strong> Automatic screenshot capture',
            '<strong>Actions:</strong> Submit, Cancel'
          ]
        }
      ]
    }
  ];

  // Filter sections based on user role
  const visibleSections = helpSections.filter(section => {
    if (!section.requiredRole) return true;
    if (!isAuthenticated) return false;
    if (section.requiredRole === 'admin') return isAdmin;
    if (section.requiredRole === 'editor') return isEditor || isAdmin;
    return true; // viewer level
  });

  // Search filtering function
  const searchInContent = (text: string, query: string): boolean => {
    return text.toLowerCase().includes(query.toLowerCase());
  };

  // Highlight matching text
  const highlightText = (text: string, query: string): string => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-600 px-1 rounded">$1</mark>');
  };

  // Filter sections and subsections based on search query
  const getFilteredSections = () => {
    if (!searchQuery.trim()) {
      return visibleSections.map(section => ({
        ...section,
        subsections: section.subsections
      }));
    }

    const query = searchQuery.trim();
    return visibleSections
      .map(section => {
        // Check if section title or description matches
        const sectionMatches = 
          searchInContent(section.title, query) || 
          searchInContent(section.description, query);

        // Filter subsections that match
        const matchingSubsections = section.subsections.filter(subsection => {
          const titleMatch = searchInContent(subsection.title, query);
          const contentMatch = subsection.content.some(paragraph => 
            searchInContent(paragraph, query)
          );
          return titleMatch || contentMatch;
        });

        // Include section if it matches or has matching subsections
        if (sectionMatches || matchingSubsections.length > 0) {
          return {
            ...section,
            subsections: sectionMatches ? section.subsections : matchingSubsections
          };
        }
        return null;
      })
      .filter((section): section is NonNullable<typeof section> => section !== null);
  };

  const filteredSections = getFilteredSections();
  const currentSection = filteredSections.find(s => s.id === activeSection) || filteredSections[0];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Help & Documentation
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Comprehensive guide to all features and functionality
          </p>
          
          {/* Search Bar */}
          <div className="relative max-w-2xl">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-search text-gray-400"></i>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search help documentation..."
              className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>
          
          {/* Search Results Count */}
          {searchQuery && (
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Found {filteredSections.length} section{filteredSections.length !== 1 ? 's' : ''} matching "{searchQuery}"
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Navigation */}
          <aside className="lg:w-64 flex-shrink-0">
            <nav className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 space-y-1 sticky top-20">
              {filteredSections.map(section => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    activeSection === section.id
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <i className={`fas ${section.icon} w-5 mr-3`}></i>
                  {section.title}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 lg:p-8">
              {!currentSection ? (
                /* No Search Results */
                <div className="text-center py-12">
                  <i className="fas fa-search text-6xl text-gray-300 dark:text-gray-600 mb-4"></i>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    No results found
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    No help topics match "{searchQuery}"
                  </p>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Clear Search
                  </button>
                </div>
              ) : (
                <>
                  {/* Section Header */}
                  <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                      <i className={`fas ${currentSection.icon} text-3xl text-blue-600 dark:text-blue-400`}></i>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {currentSection.title}
                      </h2>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">
                      {currentSection.description}
                    </p>
                  </div>

                  {/* Subsections */}
                  <div className="space-y-8 help-content">
                    {currentSection.subsections.map((subsection, idx) => (
                      <div key={idx} className="scroll-mt-20" id={`section-${idx}`}>
                        <h3 
                          className="text-xl font-semibold text-gray-900 dark:text-white mb-4"
                          dangerouslySetInnerHTML={{ __html: searchQuery ? highlightText(subsection.title, searchQuery) : subsection.title }}
                        />
                        <div className="space-y-3">
                          {subsection.content.map((paragraph, pIdx) => (
                            <p
                              key={pIdx}
                              className="text-gray-700 dark:text-gray-300 leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: searchQuery ? highlightText(paragraph, searchQuery) : paragraph }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Quick Links */}
                  {currentSection.id === 'overview' && !searchQuery && (
                <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Quick Access
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {visibleSections.slice(1).map(section => (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-left"
                      >
                        <i className={`fas ${section.icon} text-xl text-blue-600 dark:text-blue-400 mt-1`}></i>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white mb-1">
                            {section.title}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {section.description}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Help;
