# Presentation Templates Guide

## Quick Start

### 5-Minute Setup

#### 1. Database Setup
```bash
# Connect to your Oracle database and run:
@database/add_presentation_templates.sql
```

#### 2. Build and Deploy
```bash
npm run build
./deploy/remote/deploy.sh code
```

#### 3. Create Your First Template

**In Admin UI:**
1. Open admin panel (http://localhost:5173/admin)
2. Click on "Presentation Templates" in navigation
3. Click "➕ New Template"
4. Fill in:
   - Name: "My First Template"
   - Description: "A simple blue background"
5. In the YAML editor, paste:
```yaml
name: My First Template
description: A simple blue background
background:
  type: color
  value: '#1e3a8a'
  opacity: 1
images: []
videos: []
text: []
```
6. Click "💾 Save"
7. Click "⭐ Set Default" to use this for all presentations

#### 4. Use in Presentation
1. Go to any song and start presentation mode
2. Look for the **🎨** button in the top-right corner
3. Click it to see your template!
4. Click on it again to select from other templates

### Common Issues

**Q: Template doesn't appear in presentations?**
A: Make sure it's set as default or selected in the template dropdown.

**Q: Images/videos not loading?**
A: Check that the URL is accessible and CORS-enabled.

**Q: Overlays blocking lyrics?**
A: Reduce opacity (try 0.3-0.5) or move away from center.

---

## Overview

Presentation Templates allow you to customize the appearance of songs during presentation mode. You can define backgrounds, overlays, images, videos, and text elements that will be applied to every slide in a presentation.

## Features

### 1. **Backgrounds**
Define the background for all slides in a presentation:
- **Color**: Solid color backgrounds (hex or CSS colors)
- **Image**: Image-based backgrounds from URLs
- **Video**: Video backgrounds with autoplay and loop support

### 2. **Image Overlays**
Add images that appear on top of the slide content:
- Positioned using predefined positions (top-left, center, bottom-right, etc.)
- Customizable size (width/height)
- Opacity control for transparency
- Z-index for layering

### 3. **Video Overlays**
Embed videos that play during presentations:
- Full control over playback (autoplay, loop, muted)
- Positioned like image overlays
- Useful for adding moving backgrounds or decorative elements

### 4. **Text Overlays**
Add static text elements to slides:
- Customizable position, font, size, and color
- Support for CSS font weights and families
- Opacity and layering control

### 5. **Default Template**
Set one template as the default for all presentations:
- New presentations automatically use the default template
- Can be changed at any time from the Template Manager

## YAML Format

Templates are defined in YAML format with this structure:

```yaml
name: Template Name
description: Optional description of the template
background:
  type: color|image|video
  value: "#hexcolor" | "https://url" | "https://video-url"
  opacity: 0-1  # optional, default 1
images:
  - id: unique-id
    url: https://example.com/image.png
    position: top-left|top-center|top-right|center-left|center|center-right|bottom-left|bottom-center|bottom-right
    width: "100px"  # optional CSS width
    height: "100px"  # optional CSS height
    opacity: 0.8  # optional, default 1
    zIndex: 1  # optional, controls layering
videos:
  - id: unique-id
    url: https://example.com/video.mp4
    position: center  # same position options as images
    width: "80%"  # optional
    height: "400px"  # optional
    opacity: 0.5  # optional
    zIndex: 0  # optional
    autoPlay: true  # optional, default true
    loop: true  # optional, default true
    muted: true  # optional, default true
text:
  - id: unique-id
    content: "Text to display"
    position: bottom-center
    fontSize: "24px"  # optional CSS font size
    color: "#ffffff"  # optional CSS color
    fontWeight: bold|normal|100|200|300|400|500|600|700|800|900  # optional
    fontFamily: "Arial"  # optional CSS font family
    opacity: 0.9  # optional, default 1
    zIndex: 2  # optional
    maxWidth: "90%"  # optional CSS max-width
```

## Position Values

Elements can be positioned using these predefined locations:

```
top-left        top-center        top-right
center-left     center            center-right
bottom-left     bottom-center     bottom-right
```

## Using Templates

### In Admin Panel
1. Go to the Admin panel → **Presentation Templates**
2. Click **➕ New Template** to create a new template
3. Enter template name and description
4. Edit the YAML configuration
5. Click **💾 Save**
6. Use **⭐ Set Default** to make a template the default

### In Presentation Mode
1. Start a presentation
2. Look for the **🎨** button in the top-right corner
3. Click to see available templates
4. Select a template to apply it immediately
5. The presentation updates with the selected template

## Examples

### Simple Dark Background
```yaml
name: Dark Background
description: Clean dark theme
background:
  type: color
  value: '#1a1a1a'
  opacity: 1
images: []
videos: []
text: []
```

### Background with Logo
```yaml
name: Branded
description: Corporate look with logo
background:
  type: color
  value: '#f5f5f5'
images:
  - id: logo
    url: 'https://example.com/logo.png'
    position: top-right
    width: '120px'
    height: '120px'
    opacity: 0.9
videos: []
text: []
```

### Spiritual Theme
```yaml
name: Spiritual
description: Peaceful devotional theme
background:
  type: color
  value: '#8b4513'
images:
  - id: corner
    url: 'https://example.com/design.png'
    position: bottom-right
    width: '200px'
    height: '200px'
    opacity: 0.3
text:
  - id: om
    content: 'ॐ'
    position: top-center
    fontSize: '48px'
    color: '#ffd700'
    opacity: 0.6
videos: []
```

### Video Background
```yaml
name: Dynamic Background
description: Video background with subtle effect
background:
  type: color
  value: '#000000'
videos:
  - id: bg
    url: 'https://example.com/background.mp4'
    position: center
    width: '100%'
    height: '100%'
    opacity: 0.3
    autoPlay: true
    loop: true
    muted: true
images: []
text: []
```

## Best Practices

1. **Opacity**: Use opacity to prevent overlays from blocking song lyrics
   - Background overlays: 0.3-0.5 (subtle)
   - Logo/elements: 0.7-1.0 (visible)

2. **Z-Index**: Control layering
   - Background video: 0
   - Background images: 1-5
   - Text overlays: 10+

3. **Size**: Use responsive units
   - Percentages for flexibility: `width: "100%"`
   - Fixed sizes for logos: `width: "120px"`

4. **Colors**: Ensure contrast with lyrics
   - Dark backgrounds for light text
   - Test readability before using

5. **Media URLs**: Use reliable CDNs
   - Images should be web-optimized (fast loading)
   - Videos should be small and compressed

6. **Text Content**: Keep it brief
   - Avoid long text that obscures lyrics
   - Use for titles, subtitles, watermarks

## Troubleshooting

### Template doesn't apply
- Check that the template has `id` set
- Verify YAML syntax in **Validate YAML** tool
- Clear browser cache and refresh

### Overlays block lyrics
- Reduce `opacity` value
- Change `position` to avoid center area
- Adjust `width`/`height` to make smaller

### Video doesn't play
- Ensure video URL is accessible
- Use HTML5 compatible video format (MP4)
- Check that `muted: true` (required for autoplay)

### Text not visible
- Increase `fontSize`
- Ensure `color` contrasts with background
- Reduce `opacity` if it's too transparent
- Raise `zIndex` to appear above other elements

## API Endpoints

### Get All Templates
```
GET /api/templates
```

### Get Default Template
```
GET /api/templates/default
```

### Get Template by ID
```
GET /api/templates/{id}
```

### Create Template
```
POST /api/templates
Content-Type: application/json

{
  "name": "My Template",
  "description": "Description",
  "background": {...},
  "images": [...],
  "videos": [...],
  "text": [...],
  "isDefault": false
}
```

### Update Template
```
PUT /api/templates/{id}
Content-Type: application/json

{
  "name": "Updated Name",
  "description": "Updated description",
  ...
}
```

### Delete Template
```
DELETE /api/templates/{id}
```

### Validate YAML
```
POST /api/templates/validate/yaml
Content-Type: application/json

{
  "yaml": "name: Test\nbackground: ..."
}
```

## Storage

Templates are stored in the Oracle database in the `presentation_templates` table:
- `id`: Unique identifier (UUID)
- `name`: Template name (unique)
- `description`: Optional description
- `template_json`: JSON representation of template elements
- `template_yaml`: Original YAML source
- `is_default`: Boolean flag for default template
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

## Future Enhancements

Potential features for templates:
- Template sharing/export for other systems
- Per-song template overrides
- Template scheduling (different templates by time/date)
- Animation support for overlays
- Custom CSS support
- Template preview in admin UI
- Template categories/tags

---

## Implementation Details

### Architecture Overview

Comprehensive presentation template system with full CRUD operations, YAML support, and real-time rendering.

### Type Definitions (`src/types/index.ts`)

- `PresentationTemplate`: Main template interface
- `BackgroundElement`: Background configuration (color, image, video)
- `ImageElement`: Image overlay configuration
- `VideoElement`: Video overlay configuration
- `TextElement`: Text overlay configuration
- `TemplateReference`: Lightweight template reference for selectors

### Database Schema

Table: `presentation_templates`

```sql
CREATE TABLE presentation_templates (
  id VARCHAR2(36) PRIMARY KEY,
  name VARCHAR2(255) NOT NULL UNIQUE,
  description VARCHAR2(1000),
  template_json CLOB NOT NULL,
  template_yaml CLOB,
  is_default NUMBER(1) DEFAULT 0,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  created_by VARCHAR2(255),
  updated_by VARCHAR2(255)
);
```

### Backend Services

#### TemplateService (`server/services/TemplateService.ts`)

Methods:
- `getAllTemplates()`: List all templates
- `getTemplate(id)`: Get specific template
- `getDefaultTemplate()`: Get default template
- `createTemplate(template)`: Create new template
- `updateTemplate(id, updates)`: Update template
- `deleteTemplate(id)`: Delete template
- `parseYaml(content)`: Parse and validate YAML
- `templateToYaml(template)`: Convert template to YAML

Features:
- Full CRUD operations
- YAML parsing and generation
- Automatic default template management
- JSON storage for performance

#### Backend API Routes (`server/routes/templates.ts`)

Endpoints:
- `GET /api/templates` - List all templates
- `GET /api/templates/default` - Get default template
- `GET /api/templates/:id` - Get template by ID
- `POST /api/templates` - Create template
- `PUT /api/templates/:id` - Update template
- `DELETE /api/templates/:id` - Delete template
- `POST /api/templates/validate/yaml` - Validate YAML content

### Frontend Services

#### TemplateService (`src/services/TemplateService.ts`)

- API client wrapper for all template operations
- Error handling with logging
- Methods for all CRUD operations
- YAML validation

### Frontend Components

#### TemplateManager (`src/components/admin/TemplateManager.tsx`)

Full admin interface for template management:
- View/Edit/Create/Delete templates
- Live YAML validation
- Template structure preview
- Set default template
- Real-time validation feedback
- Responsive design

Features:
- YAML editor with validation
- Confirmation dialogs for deletions
- Default template indicator

#### TemplateSelector (`src/components/presentation/TemplateSelector.tsx`)

Dropdown selector for presentation mode:
- Shows template names and descriptions
- Displays template elements (images, videos, text)
- Default template indicator
- Real-time template switching

### Template Rendering

#### Template Utilities (`src/utils/templateUtils.tsx`)

Functions:
- `getBackgroundStyles()`: Generate CSS for backgrounds
- `getPositionClasses()`: Generate position Tailwind classes
- `getElementStyles()`: Generate element inline styles
- `TemplateBackground`: Component for video backgrounds
- `TemplateImages`: Component for image overlays
- `TemplateVideos`: Component for video overlays
- `TemplateText`: Component for text overlays

#### Presentation Components

**PresentationMode** (`src/components/presentation/PresentationMode.tsx`)
- Template state management
- Template loading from API
- Template selector integration
- Default template auto-selection
- Template passed to SlideView

**SlideView** (`src/components/presentation/SlideView.tsx`)
- Template rendering on slides
- Background style application
- Overlay rendering (images, videos, text)
- Z-index layering support
- Maintains existing slide layout

### Data Flow

1. **Admin Creates Template**: TemplateManager → TemplateService → API → Backend → Database
2. **Presentation Loads Template**: PresentationMode loads default or selected → SlideView applies → Visual rendering
3. **Template Validation**: YAML parsed on frontend → validation API on backend → error feedback

### Component Hierarchy

```
PresentationMode
├── TemplateSelector (top-right)
└── SlideView
    ├── TemplateBackground (video)
    ├── TemplateImages (overlays)
    ├── TemplateVideos (overlays)
    └── TemplateText (overlays)
```

### State Management

- Templates stored in database
- Template selection stored in component state
- Active template passed via props
- Automatic default template selection

### Key Features

**1. Flexibility**
- Multiple background types (color, image, video)
- Multiple overlay types (image, video, text)
- Customizable positioning
- Full opacity and z-index control

**2. Ease of Use**
- YAML format (human-readable)
- Live validation
- Admin UI for creation/editing
- Dropdown selector in presentation

**3. Performance**
- JSON storage for fast retrieval
- YAML parsing on demand
- Efficient rendering with React components
- CSS-based positioning

**4. Extensibility**
- Clean component structure
- Easy to add new element types
- YAML format allows future extensions
- API-driven architecture

### Integration Points

- **Database**: Requires `presentation_templates` table
- **Backend**: TemplateService and templates route integrated in `server/index.ts`
- **Frontend**: TemplateService, TemplateManager, TemplateSelector, SlideView integration

### Testing Checklist

- [ ] Create template from admin UI
- [ ] Edit template with YAML validation
- [ ] Set template as default
- [ ] Delete template (with confirmation)
- [ ] Load presentation with default template
- [ ] Change template during presentation
- [ ] Verify background colors apply
- [ ] Verify image overlays render
- [ ] Verify text overlays display
- [ ] Test position values (all 9 positions)
- [ ] Test opacity settings
- [ ] Test z-index layering
- [ ] Verify YAML validation errors

### API Examples

#### Get Default Template
```bash
curl http://localhost:3001/api/templates/default
```

#### List All Templates
```bash
curl http://localhost:3001/api/templates
```

#### Create Template
```bash
curl -X POST http://localhost:3001/api/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Template",
    "description": "My awesome template",
    "background": {"type": "color", "value": "#ffffff"},
    "images": [],
    "videos": [],
    "text": []
  }'
```

### Database Query Examples

#### Get all templates
```sql
SELECT * FROM presentation_templates ORDER BY is_default DESC, name ASC;
```

#### Get default template
```sql
SELECT * FROM presentation_templates WHERE is_default = 1;
```

#### Update template
```sql
UPDATE presentation_templates 
SET name = 'New Name', updated_at = CURRENT_TIMESTAMP 
WHERE id = '...';
```

### Performance Considerations

- **Caching**: Templates are loaded on demand
- **Storage**: JSON stored in CLOB (efficient for database)
- **Rendering**: CSS-based, no heavy calculations
- **Video Autoplay**: Muted by default for browser compatibility
- **Image Optimization**: User responsible for optimized URLs

### Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (video autoplay limited)
- Mobile: Responsive positioning works well

### Security Notes

- No authentication required for viewing templates (presentations are public)
- Template creation/editing could be restricted to admins (not enforced in routes)
- YAML parsing uses safe library (js-yaml)
- No server-side script execution

### Known Limitations

1. Video autoplay requires `muted: true` (browser limitation)
2. Videos must be CORS-enabled from their source
3. Large video files may cause performance issues
4. Template names must be unique
5. No soft delete (deletion is permanent)

### File Structure

```
├── database/
│   └── add_presentation_templates.sql
├── docs/
│   ├── TEMPLATES.md (this file)
│   └── TEMPLATE_EXAMPLES.yaml
├── server/
│   ├── routes/
│   │   └── templates.ts
│   ├── services/
│   │   └── TemplateService.ts
│   └── index.ts (updated)
└── src/
    ├── components/
    │   ├── admin/
    │   │   └── TemplateManager.tsx
    │   └── presentation/
    │       ├── TemplateSelector.tsx
    │       ├── PresentationMode.tsx (updated)
    │       └── SlideView.tsx (updated)
    ├── services/
    │   └── TemplateService.ts
    ├── types/
    │   └── index.ts (updated)
    └── utils/
        └── templateUtils.tsx
```
