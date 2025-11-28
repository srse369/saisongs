# Presentation Template Visual Editor

A user-friendly visual editor for creating and editing presentation templates without requiring YAML knowledge.

## Features

### 🎨 Visual Editor Tab
- **Tabbed interface** for organized editing
- **Basic Information**: Edit template name and description
- **Background Configuration**: 
  - Choose background type (color, image, or video)
  - Pick colors with color picker or enter hex values
  - Add image/video URLs
  - Control opacity with slider
- **Image Overlays**:
  - Add multiple images with individual settings
  - Configure position (9 predefined positions)
  - Set width, height, opacity, and z-index
- **Video Overlays**:
  - Add multiple video backgrounds
  - Control autoplay, loop, and muted settings
  - Position and size like images
  - Adjust opacity and layering
- **Text Overlays**:
  - Add multiple text elements
  - Customize font size, color, and weight
  - Position text anywhere on slide
  - Control opacity and z-index

### ⚙️ YAML Editor Tab
- For advanced users who prefer YAML syntax
- Full validation and error feedback
- Switch between modes at any time

### 👁️ Live Preview
- See changes in real-time with preview button
- Full-screen preview with scrollable view
- Shows template details and element counts

## Usage

### Create a New Template

1. Click **Create Template** button
2. Choose **Visual Editor** tab (default)
3. Fill in basic information
4. Configure background type and appearance
5. Add images/videos/text as needed
6. Click **Preview** to see how it looks
7. Click **Create Template** to save

### Edit Existing Template

1. Click **Edit** on any template
2. Visual editor opens with all current settings
3. Make changes as needed
4. Click **Update Template** to save

### Switch to YAML Mode

1. In the edit modal, click **⚙️ YAML Editor** tab
2. Edit the raw YAML configuration
3. Errors are validated and displayed
4. Click **Update Template** to save

## Visual Editor Tabs

### Basic Tab
```
- Template Name: Give your template a descriptive name
- Description: Optional description for reference
```

### Background Tab
```
- Type: Select color, image, or video
- Value/Color: Specify the background value
- Opacity: Use slider to adjust transparency (0-100%)
```

### Images Tab
```
- Add Image: Click to add new image overlay
- URL: Image source URL
- Position: Choose from 9 positions
- Width/Height: Specify dimensions (e.g., "100px", "50%")
- Opacity: Transparency control
- Z-Index: Layer ordering (higher = on top)
```

### Videos Tab
```
- Add Video: Click to add video overlay
- URL: Video source URL
- Position, Size, Opacity: Same as images
- Autoplay: Start playing when loaded
- Loop: Repeat video continuously
- Muted: Mute audio (required for autoplay)
- Z-Index: Layer ordering
```

### Text Tab
```
- Add Text: Click to add text element
- Content: Actual text to display
- Position: Where to place text
- Font Size: Text size (e.g., "24px")
- Color: Text color with picker
- Font Weight: bold, normal, or specific weight (100-900)
- Opacity: Text transparency
- Z-Index: Layer ordering
```

## Position Options

All elements can use these 9 predefined positions:

```
top-left        top-center        top-right
center-left     center            center-right
bottom-left     bottom-center     bottom-right
```

## Size Units

- **Pixels**: `"100px"` - Fixed size
- **Percentages**: `"50%"` - Responsive size
- **REM**: `"2rem"` - Relative to font size
- **Other CSS units**: `"10vw"`, `"5vmin"`, etc.

## Opacity Guide

- `1` or `100%` = Fully opaque (solid)
- `0.5` or `50%` = Semi-transparent
- `0.3` or `30%` = Subtle
- `0` or `0%` = Invisible

## Z-Index (Layering)

- **Background video**: 0 (appears behind everything)
- **Background images**: 1-5
- **Image overlays**: 1-10
- **Text overlays**: 10+ (appears on top)

Higher numbers appear on top of lower numbers.

## Best Practices

1. **Background Overlays**: Use low opacity (0.3-0.5) so text is readable
2. **Logos**: Place in corners with opacity 0.8-1.0
3. **Text Contrast**: Use colors that contrast with background
4. **Responsive Sizes**: Use percentages for elements that should scale
5. **Video Autoplay**: Always mute videos for browser compatibility

## Converting Between Modes

- Switch from **Visual** to **YAML** mode at any time
- Switch from **YAML** to **Visual** mode - template is auto-parsed
- Both modes edit the same underlying template

## Example: Creating a Simple Template

### Using Visual Editor

1. **Basic Tab**: 
   - Name: "Meeting Room"
   - Description: "Clean template for business meetings"

2. **Background Tab**:
   - Type: Color
   - Color: #1e3a8a (dark blue)
   - Opacity: 100%

3. **Images Tab**:
   - Add Image
   - URL: https://example.com/logo.png
   - Position: top-right
   - Width: 120px
   - Height: 80px
   - Opacity: 90%
   - Z-Index: 1

4. **Text Tab**:
   - Add Text
   - Content: "Conference Room Presentation"
   - Position: bottom-center
   - Font Size: 20px
   - Color: #ffffff (white)
   - Font Weight: bold
   - Opacity: 100%
   - Z-Index: 2

5. Click **Create Template**

## Keyboard Shortcuts in Preview

- `← →` or Arrow keys: Scroll preview
- `↑ ↓`: Scroll vertically
- `Esc`: Close preview

## Troubleshooting

**Template not appearing in presentations?**
- Ensure template is set as default or selected in dropdown
- Check that all URLs (images/videos) are accessible

**Images/videos not loading?**
- Verify URLs are correct and accessible
- Check CORS settings on external URLs
- Try using different image/video formats

**Text overlays blocking lyrics?**
- Reduce opacity or move to sides
- Adjust z-index to layer properly

**Video won't autoplay?**
- Ensure "Muted" is checked (browser requirement)
- Try different video format (MP4 works best)

## Component Reference

Located in: `src/components/admin/TemplateVisualEditor.tsx`

### Props

```typescript
interface TemplateVisualEditorProps {
  template: PresentationTemplate;
  onTemplateChange: (template: PresentationTemplate) => void;
  onPreview?: (template: PresentationTemplate) => void;
}
```

### Import

```typescript
import { TemplateVisualEditor } from './TemplateVisualEditor';
```

## Advanced Usage

The visual editor generates a `PresentationTemplate` object that can be used directly in code:

```typescript
const template: PresentationTemplate = {
  name: 'My Template',
  description: 'Beautiful template',
  background: {
    type: 'color',
    value: '#1e3a8a',
    opacity: 1,
  },
  images: [
    {
      id: 'logo',
      url: 'https://example.com/logo.png',
      position: 'top-right',
      width: '120px',
      height: '80px',
      opacity: 0.9,
      zIndex: 1,
    },
  ],
  videos: [],
  text: [
    {
      id: 'title',
      content: 'My Presentation',
      position: 'bottom-center',
      fontSize: '24px',
      color: '#ffffff',
      opacity: 1,
      zIndex: 2,
    },
  ],
};
```

## See Also

- **FEATURES.md**: User guide for presentation templates
- **ARCHITECTURE.md**: Technical implementation details
- **TemplateManager.tsx**: Full template management UI
