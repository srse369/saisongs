import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface HelpSubsection {
  title: string;
  content: string[];
  screenshot?: {
    src: string;
    alt: string;
    caption?: string;
  };
}

interface HelpSection {
  id: string;
  title: string;
  icon: string;
  description: string;
  requiredRole?: 'viewer' | 'editor' | 'admin';
  subsections: HelpSubsection[];
}

export const Help: React.FC = () => {
  const { isAuthenticated, userRole, isAdmin, isEditor } = useAuth();
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedImage, setExpandedImage] = useState<{ src: string; alt: string; caption?: string } | null>(null);

  // Handle ESC key to close expanded image
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && expandedImage) {
        setExpandedImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedImage]);

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
            'Song Studio is your all-in-one platform for managing devotional songs during Sai Bhajan sessions.',
            '<strong>Key Features:</strong>',
            '• Store songs with lyrics, meanings, and musical details',
            '• Assign different pitches to different singers',
            '• Create beautiful presentations with custom templates', 
            '• Build and manage session playlists',
            '• Search songs by name, deity, language, or natural language queries'
          ],
          screenshot: {
            src: '/help/songs-tab.png',
            alt: 'Song Studio main interface',
            caption: 'The Songs tab showing the song management interface with search and browse capabilities'
          }
        },
        {
          title: 'Getting Started',
          content: [
            '<strong>🎵 Browse Songs:</strong> No login needed! Start exploring the song library immediately.',
            '<strong>🔑 Sign In:</strong> Press <kbd>Ctrl+Shift+I</kbd> (or <kbd>Cmd+Shift+I</kbd> on Mac) to login with your email. You\'ll get a one-time password.',
            '<strong>🎤 Quick Start Session:</strong>',
            '1. Go to the <strong>Live</strong> tab',
            '2. Click "Add Songs" and select your favorites',
            '3. Choose singers and pitches',
            '4. Hit "Present Session" to start!'
          ],
          screenshot: {
            src: '/help/live-tab.png',
            alt: 'Live session interface',
            caption: 'The Live tab where you can build and present your bhajan session'
          }
        },
        {
          title: 'User Roles',
          content: [
            '<strong>👁️ Viewer:</strong> Browse everything, create sessions, but can\'t edit. Can manage your own pitches if you have a singer profile.',
            '<strong>✏️ Editor:</strong> Create and edit songs, singers, and pitches within your assigned centers.',
            '<strong>🛡️ Admin:</strong> Full access to everything. Manage centers and user permissions.'
          ]
        },
        {
          title: 'Using This Help Page',
          content: [
            '<strong>📑 Navigation:</strong> Use the section buttons on the left (or above on mobile) to jump to different topics.',
            '<strong>🔍 Search:</strong> Type in the search bar at the top to find specific help topics. Results are highlighted.',
            '<strong>📸 Screenshots:</strong> Many sections include screenshots. Click any screenshot to enlarge it. Press <kbd>Escape</kbd> or click outside to close.',
            '<strong>⌨️ Keyboard Tags:</strong> Instructions shown as <kbd>like this</kbd> indicate keyboard keys to press.',
            '<strong>🎯 Quick Access:</strong> The "Quick Access" cards at the bottom of each overview provide shortcuts to common topics.'
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
          title: 'Browsing & Searching',
          content: [
            '<strong>🔍 Search Bar:</strong> Type any part of a song name to filter results instantly. The count above the list shows "Showing X of Y songs" to indicate filtered results.',
            '<strong>🤖 AI Smart Search:</strong> Toggle the "AI" switch to enable natural language search. Ask questions like "upbeat Krishna songs" or "slow meditation bhajans in Hindi".',
            '<strong>🎯 Advanced Filters:</strong> Click "Show Advanced Search" to filter by language, deity, tempo (slow/medium/fast), raga, difficulty level, and more.',
            '<strong>🔄 Refresh:</strong> Click the Refresh button to reload the latest songs from the database.'
          ],
          screenshot: {
            src: '/help/songs-tab-full.png',
            alt: 'Songs tab with search and filtering',
            caption: 'Song Management interface with search bar, advanced filters, and song cards'
          }
        },
        {
          title: 'Song Card Actions',
          content: [
            '<strong>👁️ Preview (Eye Icon):</strong> Opens the song in presentation mode for a quick preview. You can see how lyrics will appear with the current template.',
            '<strong>➕ Add to Session (Plus Icon):</strong> Adds the song to your current Live session. You\'ll be prompted to select a singer and pitch.',
            '<strong>🔗 External Link:</strong> If the song has an external source URL (like YouTube), clicking the external link icon opens it in a new tab.',
            '<strong>✏️ Edit (Pencil Icon):</strong> Opens the song form to edit details. Only visible to editors with access to the song\'s centers.',
            '<strong>🗑️ Delete (Trash Icon):</strong> Removes the song permanently. Only visible to editors/admins. Confirmation required.'
          ]
        },
        {
          title: 'Creating & Editing Songs',
          content: [
            '<strong>➕ Create New:</strong> Click "Create New Song" (editors/admins only). The song name is required; all other fields are optional but recommended.',
            '<strong>📝 Song Details:</strong> Add original lyrics (in native script), English lyrics (transliteration), meaning (translation), and context (when/how to use the song).',
            '<strong>🎵 Musical Metadata:</strong> Specify language, deity, tempo (slow/medium/fast), taal (beat pattern), raga (melodic mode), and difficulty level.',
            '<strong>🌐 Center Assignment:</strong> Assign to specific centers for restricted access, or leave empty for global visibility.'
          ]
        },
        {
          title: 'Presentation Mode',
          content: [
            '<strong>▶️ Start Presenting:</strong> Click the Preview (eye) icon on any song card. The presentation opens in a modal with the selected template.',
            '<strong>🎨 Template Selection:</strong> Use the purple "TEMPLATE" dropdown to switch between available presentation templates.',
            '<strong>⌨️ Navigation:</strong> Use arrow keys (<kbd>←</kbd> <kbd>→</kbd>) or click to navigate. <kbd>Escape</kbd> closes the presentation.',
            '<strong>📐 Font Scaling:</strong> Press <kbd>+</kbd> to increase text size, <kbd>-</kbd> to decrease, <kbd>0</kbd> to reset. Useful when lyrics don\'t fit or are hard to read.',
            '<strong>🖥️ Fullscreen:</strong> Click the expand icon to go fullscreen. Great for projector display.'
          ],
          screenshot: {
            src: '/help/song-presentation.png',
            alt: 'Song presentation view',
            caption: 'Presentation mode showing song lyrics with template styling and navigation controls'
          }
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
          title: 'Browsing Singers',
          content: [
            '<strong>🔍 Search:</strong> Filter singers by name using the search bar. The count shows total singers and filtered results.',
            '<strong>👥 Singer Cards:</strong> Each card displays the singer\'s name, gender (color-coded: blue for male, pink for female), and a circular badge showing how many songs they have pitch assignments for.',
            '<strong>🏢 Center Badges:</strong> Colored badges show which centers each singer belongs to.',
            '<strong>⚡ Quick Actions:</strong> Edit (pencil) and Delete (trash) buttons appear on each singer card for editors/admins.'
          ],
          screenshot: {
            src: '/help/singers-tab.png',
            alt: 'Singers tab interface',
            caption: 'The Singers tab showing singer profiles with pitch counts and management controls'
          }
        },
        {
          title: 'Creating & Editing Singers',
          content: [
            '<strong>➕ Add Singer:</strong> Click "Add Singer" and provide a name, select gender (Male/Female/Boy/Girl), and assign at least one center.',
            '<strong>📧 Email (Optional):</strong> Adding an email allows the singer to log in and manage their own pitch assignments. Required for admin/editor privileges.',
            '<strong>✏️ Edit Singer:</strong> Update name, gender, email, or center assignments. Editors can only edit singers in their assigned centers.',
            '<strong>🗑️ Delete Singer:</strong> Removes the singer and all their pitch assignments. Cannot be undone.'
          ]
        },
        {
          title: 'Merging Duplicate Singers',
          content: [
            '<strong>🔀 Why Merge Singers:</strong> Over time, the same person may end up with multiple singer profiles - perhaps "John Smith" was entered once as "John S." and later as "John Smith". This creates duplicate entries and splits their pitch assignments across profiles. Merging consolidates these into a single profile.',
            '<strong>📝 Step 1 - Enable Merge Mode:</strong> In the Singers tab, click the "Select Singers to Merge" toggle button. This enables merge mode where checkboxes appear next to each singer card.',
            '<strong>☑️ Step 2 - Select Singers:</strong> Check the boxes next to all the duplicate profiles you want to merge (at least 2). The counter shows "X singers selected" as you make selections.',
            '<strong>🔗 Step 3 - Start Merge:</strong> Click the green "Merge Selected" button. A dialog appears asking you to choose the "target" singer - this is the profile that will be kept and receive all the data.',
            '<strong>🎯 Step 4 - Choose Target:</strong> Select which singer profile should be the primary one. Consider keeping the profile with the correct name spelling, email address, or center assignments.',
            '<strong>🔄 What Happens During Merge:</strong> All pitch assignments from the merged (non-target) singers are transferred to the target singer. The target singer keeps their original profile information. The merged singers are permanently deleted from the system.',
            '<strong>⚠️ Important Warnings:</strong> This action cannot be undone! Double-check you have selected the right singers. Verify the target singer is the one you want to keep. Consider exporting data before merging as a backup.'
          ],
          screenshot: {
            src: '/help/singers-merge-cards.png',
            alt: 'Singer merge mode interface',
            caption: 'The merge mode showing checkboxes on singer cards, selection counter, and Merge Selected button'
          }
        },
        {
          title: 'User Permissions (Admin Only)',
          content: [
            '<strong>🛡️ Making Admins:</strong> Check "Is Admin" in the singer edit form. The singer must have an email address. Admins have full access to all features and content.',
            '<strong>✏️ Making Editors:</strong> In the "Editor For Centers" dropdown, select which centers this user can edit content for. They\'ll be able to manage songs, singers, pitches, and templates in those centers.',
            '<strong>📧 Login Requirement:</strong> Users must have an email to log in. They receive a one-time password (OTP) to their email for authentication.',
            '<strong>❌ Revoking Access:</strong> Uncheck "Is Admin" or remove all centers from "Editor For Centers" to demote a user to viewer status.'
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
          title: 'What are Pitches?',
          content: [
            '<strong>🎵 Definition:</strong> A pitch (or key) is the musical note on which a song starts. Different singers have different comfortable vocal ranges, so the same song may need different pitches for different singers.',
            '<strong>🎹 Notation Systems:</strong> Song Studio supports Western notation (C, C#, D, D#, E, F, F#, G, G#, A, A#, B) and Madhyam positions (1-5) commonly used with harmonium in Indian classical music.',
            '<strong>👥 One Pitch Per Singer-Song:</strong> Each singer can have exactly one pitch assigned for each song. This ensures clarity during sessions about who sings which song in which key.'
          ]
        },
        {
          title: 'Browsing & Searching Pitches',
          content: [
            '<strong>🔍 Search:</strong> Filter pitches by song name or singer name using the search bar.',
            '<strong>📋 Pitch Cards:</strong> Each card shows the song name, singer name (with gender indicator), pitch value, and an external link icon if the song has a source URL.',
            '<strong>⚡ Quick Actions:</strong> Preview (eye icon) to see the song, Add to Session (plus icon), Edit (pencil), and Delete (trash) buttons appear on each pitch card.'
          ],
          screenshot: {
            src: '/help/pitches-tab.png',
            alt: 'Pitches tab interface',
            caption: 'The Pitches tab showing pitch assignments with singer-song combinations and quick actions'
          }
        },
        {
          title: 'Creating & Editing Pitches',
          content: [
            '<strong>➕ Add New Pitch:</strong> Click "Add Pitch" and select a song, then a singer, then choose the pitch value from the dropdown.',
            '<strong>✏️ Edit Pitch:</strong> Click the edit icon on any pitch card. You can only change the pitch value - the song and singer are locked to prevent errors.',
            '<strong>🗑️ Delete Pitch:</strong> Remove a pitch assignment when a singer no longer performs a song or when cleaning up duplicates.',
            '<strong>🚫 Uniqueness:</strong> You cannot create duplicate song-singer combinations. The system will show an error if you try.'
          ]
        },
        {
          title: 'Best Practices',
          content: [
            '<strong>🎤 Consult Singers:</strong> Always verify the comfortable pitch with the singer before adding it to the database.',
            '<strong>📅 Regular Reviews:</strong> Voice ranges change over time (especially for children). Review and update pitches periodically.',
            '<strong>👫 Gender Differences:</strong> Male and female singers typically need different pitches for the same song due to natural voice range differences.',
            '<strong>🎹 Harmonium Users:</strong> If your group uses harmonium, consider using Madhyam positions (1-5) for easier reference during performance.'
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
            '<strong>📋 Session = Setlist:</strong> A session is a pre-planned collection of songs with assigned singers and pitches, organized for live presentation during bhajan programs.',
            '<strong>🎯 Why Use Sessions:</strong> Prepare your program in advance, know exactly who sings what and in which key, present smoothly without scrambling to find songs during the event.',
            '<strong>🔄 Flexibility:</strong> Create temporary sessions for one-time use, or save and reuse sessions for recurring events like weekly bhajans or festivals.'
          ],
          screenshot: {
            src: '/help/live-tab.png',
            alt: 'Live session interface',
            caption: 'The Live tab where you build your song session with template selection and presentation controls'
          }
        },
        {
          title: 'Building a Session',
          content: [
            '<strong>➕ Adding Songs:</strong> Go to the Songs or Pitches tab and click the "Add to Session" button (plus icon) on any song card. Select the singer who will perform it.',
            '<strong>📊 Song Count:</strong> The Live tab shows "X songs in session" so you can track how many songs you\'ve added.',
            '<strong>↕️ Reordering:</strong> Drag and drop songs in the list to change the order. Use the up/down buttons on each song card.',
            '<strong>❌ Removing:</strong> Click the X button on any song to remove it from the session.',
            '<strong>🗑️ Clear All:</strong> Use "Clear Session" to remove all songs and start fresh. Confirmation required.'
          ],
          screenshot: {
            src: '/help/live-with-songs.png',
            alt: 'Live session with songs',
            caption: 'A live session showing loaded songs with singer names, pitches, and presentation controls'
          }
        },
        {
          title: 'Templates & Presentation',
          content: [
            '<strong>🎨 Template Selection:</strong> Use the purple "TEMPLATE" dropdown to choose how your songs will be displayed during presentation.',
            '<strong>▶️ Present Session:</strong> Click "Present Session" to start the full-screen presentation. All songs play in order with the selected template.',
            '<strong>⌨️ During Presentation:</strong> <kbd>→</kbd> next slide, <kbd>←</kbd> previous, <kbd>+</kbd>/<kbd>-</kbd> adjust font size, <kbd>Escape</kbd> to exit.',
            '<strong>📊 Progress:</strong> The footer shows current song info (name, singer, pitch) and slide progress (e.g., "Slide 3/5 • Song 2/10").'
          ]
        },
        {
          title: 'Saving & Loading Sessions',
          content: [
            '<strong>💾 Save Session:</strong> Click to save your current session for future use. Give it a descriptive name (e.g., "Sunday Morning Bhajans").',
            '<strong>📂 Load Session:</strong> Click to see all your saved sessions. Select one to load its songs into your current workspace.',
            '<strong>🔢 Session Count:</strong> The Load Session dialog shows how many saved sessions you have.',
            '<strong>🌐 Public Sessions:</strong> Sessions marked "Public Session" with a globe icon are accessible to everyone. Private sessions are only visible to their creator.',
            '<strong>⚠️ Warning:</strong> Loading a session replaces any unsaved songs in your current session. Save first if needed!'
          ],
          screenshot: {
            src: '/help/load-session-dialog.png',
            alt: 'Load Session dialog',
            caption: 'The Load Session dialog showing saved sessions with creation dates and public/private status'
          }
        },
        {
          title: 'Session Tips',
          content: [
            '<strong>🎵 Variety:</strong> Mix slow and fast songs to maintain energy throughout the session.',
            '<strong>👥 Balance:</strong> Distribute songs among different singers to avoid vocal fatigue.',
            '<strong>🕐 Timing:</strong> Plan for how long the session should run. Most bhajan sessions are 45-90 minutes.',
            '<strong>🙏 Opening/Closing:</strong> Start with an invocation and end with a peace song or aarti.',
            '<strong>📝 Rehearse:</strong> Run through the presentation once before the actual event to check for any issues.'
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
            '<strong>🎨 Definition:</strong> Templates are reusable visual designs that control how song lyrics appear during presentations - backgrounds, fonts, colors, images, videos, and audio.',
            '<strong>📐 Aspect Ratios:</strong> Choose 16:9 (widescreen) for modern displays or 4:3 (traditional) for older projectors.',
            '<strong>📑 Multi-Slide:</strong> Templates can have multiple slides that cycle during a song, providing visual variety.',
            '<strong>⭐ Default Template:</strong> Mark one template as default (star icon) - it will be auto-selected for new presentations.'
          ]
        },
        {
          title: 'Browsing Templates',
          content: [
            '<strong>📊 Template Count:</strong> The tab shows total templates and filtered count when searching.',
            '<strong>🖼️ Template Cards:</strong> Each card shows a preview thumbnail, name, aspect ratio badge, and center badges.',
            '<strong>🔍 Search:</strong> Filter templates by name using the search bar.',
            '<strong>⚡ Quick Actions:</strong> Edit (pencil), Duplicate (copy), Set as Default (star), Delete (trash).'
          ],
          screenshot: {
            src: '/help/templates-tab.png',
            alt: 'Templates tab interface',
            caption: 'The Templates tab showing available presentation templates with preview thumbnails and management options'
          }
        },
        {
          title: 'Creating & Editing Templates',
          content: [
            '<strong>➕ Create Template:</strong> Click "Create Template" to open the editor. Provide a name and select aspect ratio.',
            '<strong>✏️ Two Editor Modes:</strong> WYSIWYG (visual drag-and-drop) for beginners, YAML (code) for advanced users.',
            '<strong>🔄 Switch Modes:</strong> Click the tab at the top to switch between WYSIWYG and YAML editors.',
            '<strong>💾 Save Often:</strong> Click Save to preserve your changes. Test by previewing a song with the template.'
          ]
        },
        {
          title: 'WYSIWYG Editor',
          content: [
            '<strong>🖼️ Slide Thumbnails:</strong> Left panel shows all slides with numbered badges. Click to select a slide to edit.',
            '<strong>🎨 Canvas:</strong> Center area shows the current slide. Click elements to select and edit them.',
            '<strong>📝 Properties Panel:</strong> Right side shows properties for the selected element (position, size, colors, fonts).',
            '<strong>➕ Add Elements:</strong> Use toolbar buttons to add backgrounds, images, videos, text overlays, and audio.',
            '<strong>📋 Slide Management:</strong> Add new slides, duplicate slides, or delete slides using the slide controls.',
            '<strong>→ Jump to YAML:</strong> Click the YAML button on a slide thumbnail to jump to that slide\'s section in the YAML editor.'
          ],
          screenshot: {
            src: '/help/template-editor.png',
            alt: 'Template WYSIWYG Editor',
            caption: 'The visual template editor with slide thumbnails, canvas preview, and toolbar for adding elements'
          }
        },
        {
          title: 'Template Elements',
          content: [
            '<strong>🖼️ Backgrounds:</strong> Solid color, gradient, or image URL. Each slide can have a different background.',
            '<strong>🏞️ Images:</strong> Add decorative images (deity images, nature scenes). Specify URL, position, size, opacity.',
            '<strong>🎬 Videos:</strong> Add video backgrounds (MP4 format). Configure autoplay, loop, muted, and volume.',
            '<strong>🔊 Audio:</strong> Add background music or ambient sound. Set startSlide/endSlide to control when audio plays.',
            '<strong>📝 Text:</strong> Add static text elements for headers, footers, or decorations. Style with fonts and colors.',
            '<strong>🎤 Lyric Area:</strong> Special zone where song lyrics appear. Position and style carefully for readability.'
          ]
        },
        {
          title: 'Audio Configuration',
          content: [
            '<strong>🔊 Adding Audio:</strong> In WYSIWYG, click the Audio button in the element toolbar. Provide a URL to an MP3 or OGG file.',
            '<strong>🔢 Play Range:</strong> Set startSlide and endSlide (1-based) to control which slides the audio plays during.',
            '<strong>🔁 Loop:</strong> Enable looping for continuous background music.',
            '<strong>🔇 Visual Hidden:</strong> Check this to hide the audio player controls from the presentation.',
            '<strong>🎚️ Volume:</strong> Adjust volume from 0 (silent) to 100 (full volume).'
          ]
        },
        {
          title: 'YAML Editor',
          content: [
            '<strong>💻 Direct Editing:</strong> Edit template configuration as YAML code for precise control.',
            '<strong>✅ Validate:</strong> Click "Validate YAML" to check for syntax errors before saving.',
            '<strong>📜 Schema:</strong> YAML structure: name, description, aspectRatio, slides array, referenceSlideIndex.',
            '<strong>💡 Tip:</strong> Use the WYSIWYG editor to set up the basic structure, then fine-tune in YAML.'
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
            '<strong>🏢 Organization Structure:</strong> Centers represent different locations, groups, or regions (e.g., "Bay Area", "Los Angeles", "Youth Group"). They organize content and control who can access or edit what.',
            '<strong>🔐 Access Control:</strong> Content assigned to a center is only visible to users associated with that center. This lets multiple groups share the same Song Studio while maintaining separate content.',
            '<strong>🌐 Global Content:</strong> Content with no center assignment is "global" - visible and accessible to everyone. Use global for shared songs, common templates, and organization-wide content.',
            '<strong>👥 Multi-Center Support:</strong> Users and content can belong to multiple centers. A singer performing at two locations can be assigned to both centers. Songs used everywhere can be assigned to all relevant centers.'
          ]
        },
        {
          title: 'Creating & Managing Centers',
          content: [
            '<strong>➕ Create Center:</strong> Click "Add Center", enter a unique name, and optionally choose a badge color for visual identification in lists and cards.',
            '<strong>✏️ Edit Center:</strong> Update the center name or badge color at any time. Changes reflect immediately across the application.',
            '<strong>📊 Center Statistics:</strong> Each center card shows counts of assigned singers, songs, templates, and sessions, helping you understand content distribution.',
            '<strong>🗑️ Delete Center:</strong> Remove centers only if no content is assigned. The system prevents deletion of centers with active content to protect data integrity. Reassign content first if needed.'
          ]
        },
        {
          title: 'Editor Permissions',
          content: [
            '<strong>👤 Assigning Editors:</strong> When creating or editing a center, select users to be editors for that center. Editors must have email addresses registered in their singer profiles.',
            '<strong>✏️ Editor Capabilities:</strong> Editors can create, edit, and delete songs, singers, pitches, templates, and sessions within their assigned centers. They cannot modify content outside their centers.',
            '<strong>🔄 Multiple Assignments:</strong> Users can be editors for multiple centers. Each editor assignment is independent - removing someone from one center does not affect their access to others.',
            '<strong>⬆️ Admin Override:</strong> Admins have full access to all centers regardless of explicit assignments. Admin status supersedes editor permissions.'
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
            '<kbd>Ctrl+Shift+I</kbd> or <kbd>Cmd+Shift+I</kbd> — Open login dialog',
            '<kbd>Escape</kbd> — Close any open dialog or modal',
            '<kbd>/</kbd> — Focus the search bar (in list views)'
          ]
        },
        {
          title: 'Presentation Mode',
          content: [
            '<strong>Navigation:</strong>',
            '<kbd>→</kbd> or <kbd>Space</kbd> or <kbd>Click</kbd> — Next slide',
            '<kbd>←</kbd> — Previous slide',
            '<kbd>Home</kbd> — Jump to first slide',
            '<kbd>End</kbd> — Jump to last slide',
            '<strong>Display:</strong>',
            '<kbd>+</kbd> or <kbd>=</kbd> — Increase font size (10% per press)',
            '<kbd>-</kbd> — Decrease font size (10% per press, min 50%)',
            '<kbd>0</kbd> — Reset font size to 100%',
            '<kbd>F</kbd> — Toggle fullscreen (browser dependent)',
            '<kbd>Escape</kbd> — Exit presentation mode'
          ]
        },
        {
          title: 'Form & Dialog Shortcuts',
          content: [
            '<kbd>Tab</kbd> — Move to next form field',
            '<kbd>Shift+Tab</kbd> — Move to previous field',
            '<kbd>Enter</kbd> — Submit form (when button is focused)',
            '<kbd>Escape</kbd> — Cancel and close dialog'
          ]
        },
        {
          title: 'Template Editor',
          content: [
            '<kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> — Move selected element (when not editing text)',
            '<kbd>Delete</kbd> or <kbd>Backspace</kbd> — Delete selected element',
            '<kbd>Escape</kbd> — Deselect current element'
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
      description: 'Quick reference for all dialog windows',
      subsections: [
        {
          title: 'Song Form',
          content: [
            '<strong>Opens when:</strong> Creating or editing a song',
            '<strong>Required fields:</strong> Song Name',
            '<strong>Recommended:</strong> Language, Deity, Original Lyrics, English Lyrics',
            '<strong>Optional:</strong> Meaning, Context, Tempo, Beat (Taal), Raga, Difficulty, External URL',
            '<strong>Centers:</strong> Multi-select dropdown. Leave empty for global access.',
            '<strong>Tips:</strong> Add lyrics in both native script and English transliteration for best searchability. The "Golden Voice" checkbox marks songs that have recommended recordings.'
          ]
        },
        {
          title: 'Singer Form',
          content: [
            '<strong>Opens when:</strong> Creating or editing a singer profile',
            '<strong>Required fields:</strong> Name, Gender, at least one Center',
            '<strong>Optional:</strong> Email address (enables login capability)',
            '<strong>Admin-only fields:</strong> "Is Admin" checkbox (grants full access), "Editor For Centers" (grants editing rights to specific centers)',
            '<strong>Tips:</strong> Use Boy/Girl gender options for children to help track voice changes over time.'
          ]
        },
        {
          title: 'Pitch Form',
          content: [
            '<strong>Opens when:</strong> Creating or editing a pitch assignment',
            '<strong>Fields:</strong> Song (dropdown), Singer (dropdown), Pitch value',
            '<strong>Pitch options:</strong> Western notes (C through B with sharps/flats), Madhyam positions (1-5)',
            '<strong>Constraint:</strong> Each singer can have only one pitch per song',
            '<strong>Edit mode:</strong> Song and Singer are locked; only pitch value can be changed'
          ]
        },
        {
          title: 'Template Editor',
          content: [
            '<strong>Opens when:</strong> Creating or editing a presentation template',
            '<strong>Two modes:</strong> WYSIWYG (visual drag-and-drop) and YAML (code editor)',
            '<strong>Required:</strong> Template name, Aspect ratio (16:9 or 4:3)',
            '<strong>Optional:</strong> Description, Center assignment, "Set as Default" checkbox',
            '<strong>WYSIWYG features:</strong> Slide thumbnails, element properties panel, background/image/text/audio controls, color picker',
            '<strong>YAML features:</strong> Direct code editing, validation button, slide jump navigation',
            '<strong>Tips:</strong> Use slide numbers in the thumbnail list to identify slides. Click "YAML →" to jump from WYSIWYG to that slide\'s YAML section.'
          ]
        },
        {
          title: 'Load Session Dialog',
          content: [
            '<strong>Opens when:</strong> Clicking "Load Session" in the Live tab',
            '<strong>Shows:</strong> List of saved sessions with name, description, creation date, and public/private status',
            '<strong>Session count:</strong> Displays total number of saved sessions at the top',
            '<strong>Action:</strong> Click a session to load its songs into your current workspace',
            '<strong>Warning:</strong> Loading replaces any unsaved songs currently in your session'
          ]
        },
        {
          title: 'Presentation Modal',
          content: [
            '<strong>Opens when:</strong> Clicking Preview on a song or "Present Session" in Live tab',
            '<strong>Header:</strong> Song name, template selector (purple dropdown), pip-in-pip toggle, fullscreen button, close button',
            '<strong>Navigation:</strong> Arrow buttons, slide indicator dots, slide counter showing current/total',
            '<strong>Footer:</strong> Song details (name, singer, pitch), font scale percentage with adjustment hints',
            '<strong>Keyboard:</strong> Arrow keys to navigate, +/- for font size, 0 to reset, Escape to close'
          ]
        },
        {
          title: 'Login Dialog',
          content: [
            '<strong>Opens when:</strong> Pressing <kbd>Ctrl+Shift+I</kbd> or <kbd>Cmd+Shift+I</kbd>, or clicking "Sign In"',
            '<strong>Step 1:</strong> Enter your registered email address and click "Send OTP"',
            '<strong>Step 2:</strong> Check your email for a 6-digit one-time password (expires in 10 minutes)',
            '<strong>Step 3:</strong> Enter the code and click "Verify OTP"',
            '<strong>Troubleshooting:</strong> Check spam folder, verify email is registered, request a new OTP if expired'
          ]
        },
        {
          title: 'Feedback Dialog',
          content: [
            '<strong>Opens when:</strong> Clicking the chat bubble icon in the bottom-right corner',
            '<strong>Category:</strong> Select Bug Report, Feature Request, Improvement, Question, or Other',
            '<strong>Message:</strong> Describe your feedback in detail',
            '<strong>Email:</strong> Required so we can respond to you',
            '<strong>Security check:</strong> Simple math problem to prevent spam',
            '<strong>Tips:</strong> Be specific! For bugs, describe what you expected vs. what happened.'
          ]
        },
        {
          title: 'Confirmation Dialogs',
          content: [
            '<strong>Delete confirmations:</strong> Appear when deleting songs, singers, pitches, templates, or sessions. Show the item name and warn about permanent deletion.',
            '<strong>Merge confirmation:</strong> Lists which singers will be merged and which will be kept. All pitches transfer to the target.',
            '<strong>Clear session:</strong> Confirms you want to remove all songs from the current live session.',
            '<strong>Overwrite session:</strong> Confirms saving over an existing session with the same name.',
            '<strong>Action:</strong> All confirmations can be cancelled with Cancel button or Escape key.'
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
                        
                        {/* Screenshot */}
                        {subsection.screenshot && (
                          <div className="mt-4">
                            <button
                              onClick={() => setExpandedImage(subsection.screenshot!)}
                              className="group relative block w-full max-w-2xl overflow-hidden rounded-lg border-2 border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors shadow-md hover:shadow-lg"
                            >
                              <img
                                src={subsection.screenshot.src}
                                alt={subsection.screenshot.alt}
                                className="w-full h-auto object-contain bg-gray-100 dark:bg-gray-700"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 text-white px-3 py-1.5 rounded-full text-sm flex items-center gap-2">
                                  <i className="fas fa-expand"></i>
                                  Click to enlarge
                                </span>
                              </div>
                            </button>
                            {subsection.screenshot.caption && (
                              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 italic text-center max-w-2xl">
                                {subsection.screenshot.caption}
                              </p>
                            )}
                          </div>
                        )}
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

      {/* Expanded Image Modal */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setExpandedImage(null)}
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              onClick={() => setExpandedImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors flex items-center gap-2"
            >
              <span className="text-sm">Press ESC or click to close</span>
              <i className="fas fa-times text-2xl"></i>
            </button>
            <img
              src={expandedImage.src}
              alt={expandedImage.alt}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            {expandedImage.caption && (
              <p className="mt-3 text-center text-white/80 text-sm">
                {expandedImage.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Help;
