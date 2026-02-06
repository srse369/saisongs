import React, { useState, useRef, useEffect } from 'react';
import { Text } from 'react-konva';
import type Konva from 'konva';
import { type CanvasElement } from '../types';
import { sanitizeHtmlContent, OVERLAY_MAX_ATTEMPTS, OVERLAY_ATTEMPT_DELAY } from '../utils';
import { getFontFamily } from '../../../../utils/fonts';
import { useLongPress } from '../hooks';

export const DraggableText: React.FC<{
  element: CanvasElement;
  isSelected: boolean;
  onSelect: (e?: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onChange: (attrs: Partial<CanvasElement>) => void;
  stageRef: React.RefObject<Konva.Stage>;
  scale: number;
  onContextMenu?: (e: Konva.KonvaEventObject<PointerEvent>) => void;
  onEditingChange?: (isEditing: boolean) => void;
  showFormattedOverlay?: boolean;
  overlayRefreshKey?: number;
  contextMenuOpen?: boolean;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  isBeingDragged?: boolean; // For multi-select drag indication
}> = ({ element, isSelected, onSelect, onChange, stageRef, scale, onContextMenu, onEditingChange, showFormattedOverlay = true, overlayRefreshKey, contextMenuOpen, onDragStart, onDragMove, isBeingDragged }) => {
  const shapeRef = useRef<Konva.Text>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const longPressHandlers = useLongPress(onContextMenu || (() => {}));

  // Create and position HTML overlay for rendered text
  useEffect(() => {
    if (!showFormattedOverlay || isEditing || isDragging || isBeingDragged) {
      // Remove overlay when not needed, when editing, or when being dragged
      if (overlayRef.current) {
        document.body.removeChild(overlayRef.current);
        overlayRef.current = null;
      }
      return;
    }
    
    // Don't recreate overlays while context menu is open - keep existing ones
    if (contextMenuOpen && overlayRef.current) {
      return;
    }

    const stage = stageRef.current;
    if (!stage) return;

    // Wait for Stage container to be ready with valid bounding box
    let attempts = 0;
    const maxAttempts = OVERLAY_MAX_ATTEMPTS;
    
    const createOverlayWhenReady = () => {
      const stage = stageRef.current;
      if (!stage) return;
      
      const stageBox = stage.container().getBoundingClientRect();
      
      // Check if Stage has valid dimensions - be more lenient to show during animation
      if (stageBox.width === 0 || stageBox.height === 0) {
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(createOverlayWhenReady, OVERLAY_ATTEMPT_DELAY);
        } else {
          // Give up waiting and create overlay anyway
          createOverlay();
        }
        return;
      }

      createOverlay();
    };

    const createOverlay = () => {
      const stage = stageRef.current;
      if (!stage) return;
      
      const stageBox = stage.container().getBoundingClientRect();

      // Create overlay div
      const overlay = document.createElement('div');
      overlayRef.current = overlay;
    
    // Convert custom tags to HTML with sanitization
    const htmlContent = sanitizeHtmlContent(element.content || 'Text');
    
    overlay.innerHTML = htmlContent;
    
    // Calculate overlay position - don't clamp to allow text partially off-canvas
    const overlayX = element.x * scale;
    const overlayY = element.y * scale;
    
    // Position overlay - use fixed positioning relative to viewport
    overlay.style.position = 'fixed';
    overlay.style.left = `${stageBox.left + overlayX}px`;
    overlay.style.top = `${stageBox.top + overlayY}px`;
    overlay.style.width = `${(element.width || 200) * scale}px`;
    overlay.style.fontSize = `${(element.fontSize || 24) * scale}px`;
    overlay.style.fontFamily = getFontFamily(element.fontFamily);
    overlay.style.fontWeight = element.fontWeight || 'normal';
    overlay.style.fontStyle = element.fontStyle || 'normal';
    overlay.style.textAlign = element.textAlign || 'center';
    overlay.style.color = element.color || '#ffffff';
    overlay.style.lineHeight = '1';
    overlay.style.whiteSpace = 'pre-wrap';
    overlay.style.wordWrap = 'break-word';
    overlay.style.pointerEvents = 'none'; // Allow clicks to pass through to Konva
    overlay.style.transformOrigin = 'left top';
    overlay.style.zIndex = '9000'; // Below context menu (99999) but high enough for other UI
    overlay.className = 'wysiwyg-text-overlay'; // Add class for easy identification
    
    if (element.rotation) {
      overlay.style.transform = `rotate(${element.rotation}deg)`;
    }
    
    document.body.appendChild(overlay);

    // Function to update overlay position
    const updateOverlayPosition = () => {
      const stage = stageRef.current;
      if (!stage || !overlay.parentElement) return;
      
      // Calculate overlay position - don't clamp to allow text partially off-canvas
      const overlayX = element.x * scale;
      const overlayY = element.y * scale;
      
      const stageBox = stage.container().getBoundingClientRect();
      overlay.style.left = `${stageBox.left + overlayX}px`;
      overlay.style.top = `${stageBox.top + overlayY}px`;
    };

    // Find the scrollable container (modal body)
    const scrollContainer = stage.container().closest('.overflow-y-auto, .overflow-auto, [style*="overflow"]');
    
    // Add scroll listener to update position
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', updateOverlayPosition);
    }
    
    // Also listen for window scroll and resize
    window.addEventListener('scroll', updateOverlayPosition, true);
    window.addEventListener('resize', updateOverlayPosition);
    
    // Listen for any animations/transitions that might move the Stage
    // Update position periodically during the first second to catch modal animation
    let animationCheckCount = 0;
    const animationCheckInterval = setInterval(() => {
      updateOverlayPosition();
      animationCheckCount++;
      if (animationCheckCount >= 10) { // Check 10 times over 1 second
        clearInterval(animationCheckInterval);
      }
    }, 100);

    // Watch for PresentationModal opening and hide overlay
    let lastCheckTime = 0;
    const MODAL_CHECK_DEBOUNCE_MS = 1000; // Increased debounce to prevent excessive checks
    
    // Check if Cursor's visual editor is active (it adds specific attributes/classes)
    // This is a lightweight check that doesn't use MutationObserver
    const isCursorEditorActive = () => {
      // Cursor visual editor typically adds data attributes or classes
      try {
        // Use a simple, fast check - just look for the most common indicator
        return !!document.querySelector('[data-cursor-element-id]');
      } catch (e) {
        return false;
      }
    };
    
    const checkForPresentationModal = () => {
      const now = Date.now();
      // Skip checks if Cursor editor is active to prevent hanging
      if (isCursorEditorActive()) {
        // If editor is active, just show overlay (don't hide it)
        if (overlay.parentElement) {
          overlay.style.display = 'block';
        }
        return;
      }
      
      // Debounce to prevent excessive DOM queries
      if (now - lastCheckTime < MODAL_CHECK_DEBOUNCE_MS) {
        return;
      }
      lastCheckTime = now;
      
      // Look specifically for PresentationModal which has data-presentation-modal or specific structure
      const hasPresentationModal = document.querySelector('.presentation-modal-backdrop, [data-presentation-modal="true"]') !== null;
      if (hasPresentationModal && overlay.parentElement) {
        overlay.style.display = 'none';
      } else if (overlay.parentElement) {
        overlay.style.display = 'block';
      }
    };

    // Check immediately
    checkForPresentationModal();

    // Use ONLY polling approach - no MutationObserver to avoid conflicts with visual editors
    // Poll every 1000ms (1 second) - this is much less aggressive and won't conflict with editors
    // The modal check doesn't need to be instant, 1 second delay is acceptable
    const modalCheckInterval = setInterval(() => {
      checkForPresentationModal();
    }, 1000);

    // Cleanup
    return () => {
      clearInterval(animationCheckInterval);
      clearInterval(modalCheckInterval);
      
      // Remove scroll listeners
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', updateOverlayPosition);
      }
      window.removeEventListener('scroll', updateOverlayPosition, true);
      window.removeEventListener('resize', updateOverlayPosition);
      
      // Ensure overlay is removed from DOM
      if (overlayRef.current?.parentElement) {
        try {
          document.body.removeChild(overlayRef.current);
        } catch (err) {
          // Element might already be removed
        }
        overlayRef.current = null;
      }
    };
    }; // End of createOverlay function
    
    // Start the process
    createOverlayWhenReady();

    // Cleanup function
    return () => {
      if (overlayRef.current?.parentElement) {
        try {
          document.body.removeChild(overlayRef.current);
        } catch (err) {
          // Element might already be removed
        }
        overlayRef.current = null;
      }
    };
  }, [element.content, element.x, element.y, element.width, element.fontSize, element.fontFamily, element.fontWeight, element.fontStyle, element.textAlign, element.color, element.rotation, scale, isEditing, isDragging, isBeingDragged, showFormattedOverlay, stageRef, overlayRefreshKey, contextMenuOpen]);

  // Konva fontStyle combines bold and italic: "normal", "bold", "italic", "bold italic"
  const getFontStyle = () => {
    const isBold = element.fontWeight === 'bold';
    const isItalic = element.fontStyle === 'italic';
    if (isBold && isItalic) return 'bold italic';
    if (isBold) return 'bold';
    if (isItalic) return 'italic';
    return 'normal';
  };

  // Strip HTML tags for plain text display
  const getPlainText = () => {
    return (element.content || 'Text')
      .replace(/<br\s*\/?>/gi, '\n') // Convert <br> to newlines
      .replace(/<[^>]+>/g, ''); // Remove all other HTML tags
  };

  // Handle double-click to start inline editing
  const handleDblClick = () => {
    const textNode = shapeRef.current;
    const stage = stageRef.current;
    if (!textNode || !stage) return;

    // Hide text node while editing
    textNode.hide();

    // Get stage container position
    const stageBox = stage.container().getBoundingClientRect();
    
    // Use element's x/y position (in slide coordinates) and multiply by scale
    const areaPosition = {
      x: stageBox.left + element.x * scale,
      y: stageBox.top + element.y * scale,
    };

    // Create contentEditable div for rich text editing
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.spellcheck = false;
    editor.setAttribute('data-wysiwyg-text-editor', 'true');
    document.body.appendChild(editor);

    // Convert our custom tags to HTML for editing
    const htmlContent = (element.content || '')
      .replace(/<c:([0-9a-fA-F]{6})>(.*?)<\/c:[0-9a-fA-F]{6}>/g, '<span style="color:#$1">$2</span>');
    editor.innerHTML = htmlContent;
    
    editor.style.position = 'fixed';
    editor.style.top = `${areaPosition.y}px`;
    editor.style.left = `${areaPosition.x}px`;
    editor.style.width = `${(element.width || 200) * scale}px`;
    editor.style.minHeight = `${(element.fontSize || 24) * scale}px`;
    editor.style.fontSize = `${(element.fontSize || 24) * scale}px`;
    editor.style.fontFamily = getFontFamily(element.fontFamily);
    editor.style.fontWeight = element.fontWeight || 'normal';
    editor.style.fontStyle = element.fontStyle || 'normal';
    editor.style.textAlign = element.textAlign || 'center';
    editor.style.color = element.color || '#ffffff';
    editor.style.background = 'rgba(0, 0, 0, 0.85)';
    editor.style.border = '2px solid #3b82f6';
    editor.style.borderRadius = '4px';
    editor.style.padding = '0';
    editor.style.margin = '0';
    editor.style.overflow = 'auto';
    editor.style.outline = 'none';
    editor.style.lineHeight = '1';
    editor.style.transformOrigin = 'left top';
    editor.style.zIndex = '10000';
    editor.style.boxSizing = 'border-box';
    editor.style.whiteSpace = 'pre-wrap';
    editor.style.wordWrap = 'break-word';
    
    // Handle rotation
    if (element.rotation) {
      editor.style.transform = `rotate(${element.rotation}deg)`;
    }

    // Create toolbar for formatting
    const toolbar = document.createElement('div');
    toolbar.style.position = 'fixed';
    toolbar.style.top = `${areaPosition.y - 40}px`;
    toolbar.style.left = `${areaPosition.x}px`;
    toolbar.style.background = '#1f2937';
    toolbar.style.border = '1px solid #3b82f6';
    toolbar.style.borderRadius = '4px';
    toolbar.style.padding = '4px';
    toolbar.style.display = 'flex';
    toolbar.style.gap = '4px';
    toolbar.style.zIndex = '10001';
    
    const createButton = (label: string, command: string) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.padding = '4px 8px';
      btn.style.background = '#374151';
      btn.style.color = '#fff';
      btn.style.border = 'none';
      btn.style.borderRadius = '3px';
      btn.style.cursor = 'pointer';
      btn.style.fontSize = '12px';
      btn.onmousedown = (e) => {
        e.preventDefault();
        document.execCommand(command, false);
        editor.focus();
      };
      return btn;
    };

    toolbar.appendChild(createButton('B', 'bold'));
    toolbar.appendChild(createButton('I', 'italic'));
    
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = element.color || '#ffffff';
    colorInput.style.width = '30px';
    colorInput.style.height = '24px';
    colorInput.style.border = 'none';
    colorInput.style.cursor = 'pointer';
    
    // Track selection info for color picker
    // Store as text content and offsets to survive focus changes
    let savedSelectionInfo: { startOffset: number; endOffset: number; selectedText: string } | null = null;
    let colorSpan: HTMLSpanElement | null = null;
    let colorPickerOpen = false;
    
    // Get text offset within the editor
    const getTextOffset = (node: Node, offset: number): number => {
      let totalOffset = 0;
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
      let currentNode = walker.nextNode();
      while (currentNode) {
        if (currentNode === node) {
          return totalOffset + offset;
        }
        totalOffset += currentNode.textContent?.length || 0;
        currentNode = walker.nextNode();
      }
      return totalOffset + offset;
    };
    
    // Save selection info before color picker opens
    const saveSelectionInfo = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        const range = sel.getRangeAt(0);
        if (editor.contains(range.commonAncestorContainer)) {
          const startOffset = getTextOffset(range.startContainer, range.startOffset);
          const endOffset = getTextOffset(range.endContainer, range.endOffset);
          const selectedText = range.toString();
          if (selectedText.length > 0) {
            savedSelectionInfo = { startOffset, endOffset, selectedText };
          }
        }
      }
    };
    
    // Apply color by wrapping selected text in a span
    const applyColorToSelection = (color: string) => {
      if (!savedSelectionInfo || savedSelectionInfo.selectedText.length === 0) return;
      
      // If we already created/found a color span this session, just update its color
      if (colorSpan) {
        colorSpan.style.color = color;
        return;
      }
      
      // Need to find and wrap the selected text
      // Get all text content and find the selected portion
      const fullText = editor.textContent || '';
      const { startOffset, endOffset, selectedText } = savedSelectionInfo;
      
      // Verify the text at these offsets matches
      const textAtOffsets = fullText.substring(startOffset, endOffset);
      if (textAtOffsets !== selectedText) {
        // Text has changed, can't apply color accurately
        return;
      }
      
      // Find the text node(s) containing the selection
      let currentOffset = 0;
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
      let currentNode = walker.nextNode();
      
      while (currentNode) {
        const nodeLength = currentNode.textContent?.length || 0;
        const nodeEnd = currentOffset + nodeLength;
        
        // Check if selection starts in this node
        if (currentOffset <= startOffset && nodeEnd > startOffset) {
          const textNode = currentNode as Text;
          const relativeStart = startOffset - currentOffset;
          const relativeEnd = Math.min(endOffset - currentOffset, nodeLength);
          
          // Check if this text node is already inside a color span
          // and the entire selection is within that span
          const parentSpan = textNode.parentElement;
          if (parentSpan && parentSpan.tagName === 'SPAN' && parentSpan.style.color) {
            // Check if the span contains exactly the selected text (or the selection is the whole span content)
            const spanText = parentSpan.textContent || '';
            if (spanText === selectedText || (relativeStart === 0 && relativeEnd === nodeLength)) {
              // Just update the existing span's color
              colorSpan = parentSpan as HTMLSpanElement;
              colorSpan.style.color = color;
              return;
            }
          }
          
          // Split the text node and wrap the middle part
          if (relativeStart > 0) {
            textNode.splitText(relativeStart);
            currentNode = walker.nextNode();
          }
          
          if (currentNode && relativeEnd - relativeStart < (currentNode.textContent?.length || 0)) {
            (currentNode as Text).splitText(relativeEnd - relativeStart);
          }
          
          // Check again if parent is a color span (after potential split)
          const parent = currentNode?.parentElement;
          if (parent && parent.tagName === 'SPAN' && parent.style.color) {
            // The text is already in a span, update its color
            colorSpan = parent as HTMLSpanElement;
            colorSpan.style.color = color;
            return;
          }
          
          // Wrap the current node in a new span
          if (currentNode) {
            colorSpan = document.createElement('span');
            colorSpan.style.color = color;
            currentNode.parentNode?.insertBefore(colorSpan, currentNode);
            colorSpan.appendChild(currentNode);
          }
          break;
        }
        
        currentOffset = nodeEnd;
        currentNode = walker.nextNode();
      }
    };
    
    // Track selection while editing
    editor.addEventListener('mouseup', saveSelectionInfo);
    editor.addEventListener('keyup', saveSelectionInfo);
    
    colorInput.onmousedown = () => {
      if (!colorPickerOpen) {
        saveSelectionInfo();
        colorPickerOpen = true;
        colorSpan = null; // Reset for new color operation
      }
    };
    
    colorInput.oninput = () => {
      applyColorToSelection(colorInput.value);
    };
    
    colorInput.onchange = () => {
      applyColorToSelection(colorInput.value);
      editor.focus();
      colorPickerOpen = false;
      colorSpan = null;
      savedSelectionInfo = null;
    };
    
    colorInput.onblur = () => {
      // Small delay to allow onchange to fire first
      setTimeout(() => {
        colorPickerOpen = false;
      }, 100);
    };
    
    toolbar.appendChild(colorInput);
    
    document.body.appendChild(toolbar);

    editor.focus();
    // Select all text
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection?.removeAllRanges();
    selection?.addRange(range);
    
    setIsEditing(true);
    onEditingChange?.(true);

    // Convert HTML back to our custom format
    const convertToCustomFormat = (html: string): string => {
      let result = html;
      
      // Helper to convert RGB to hex
      const rgbToHex = (r: number, g: number, b: number): string => {
        return [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
      };
      
      // Convert <font color="#RRGGBB"> to <c:RRGGBB>
      result = result.replace(/<font color="#([0-9a-fA-F]{6})">(.*?)<\/font>/gi, '<c:$1>$2</c:$1>');
      
      // Convert <span style="color:#RRGGBB"> to <c:RRGGBB> (hex format, with optional semicolon)
      result = result.replace(/<span style="color:\s*#([0-9a-fA-F]{6});?">(.*?)<\/span>/gi, '<c:$1>$2</c:$1>');
      
      // Convert <span style="color: rgb(r, g, b);"> to <c:RRGGBB> (RGB format, with optional semicolon)
      result = result.replace(/<span style="color:\s*rgb\((\d+),\s*(\d+),\s*(\d+)\);?">(.*?)<\/span>/gi, 
        (match, r, g, b, content) => {
          const hex = rgbToHex(parseInt(r), parseInt(g), parseInt(b));
          return `<c:${hex}>${content}</c:${hex}>`;
        });
      
      // Convert <font color="rgb(r, g, b)"> to <c:RRGGBB> (RGB format, some browsers use this)
      result = result.replace(/<font color="rgb\((\d+),\s*(\d+),\s*(\d+)\);?">(.*?)<\/font>/gi, 
        (match, r, g, b, content) => {
          const hex = rgbToHex(parseInt(r), parseInt(g), parseInt(b));
          return `<c:${hex}>${content}</c:${hex}>`;
        });
      
      // Remove style attributes from b and i tags
      result = result.replace(/<b\s+[^>]*>/gi, '<b>');
      result = result.replace(/<i\s+[^>]*>/gi, '<i>');
      
      // Keep <b> and <i> tags, remove other formatting
      result = result.replace(/<strong>/gi, '<b>').replace(/<\/strong>/gi, '</b>');
      result = result.replace(/<em>/gi, '<i>').replace(/<\/em>/gi, '</i>');
      
      // Remove <div> and <p> tags, replace with <br>
      result = result.replace(/<div>/gi, '<br>').replace(/<\/div>/gi, '');
      result = result.replace(/<p>/gi, '').replace(/<\/p>/gi, '<br>');
      
      // Clean up extra <br> at the end
      result = result.replace(/(<br>)+$/gi, '');
      
      return result;
    };

    // Handle keydown (Escape to cancel) - must be on window in capture phase to run before parent modal handler
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if this editor is the target
      if (e.target !== editor) return;
      
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Clean up editor and toolbar
        try {
          document.body.removeChild(editor);
          document.body.removeChild(toolbar);
        } catch (err) {
          // Elements might already be removed
        }
        
        textNode.show();
        setIsEditing(false);
        onEditingChange?.(false);
        
        // Remove this handler
        window.removeEventListener('keydown', handleKeyDown, true);
      }
    };

    // Handle blur (finish editing)
    const handleBlur = (e: FocusEvent) => {
      // Don't close if clicking on toolbar or color input
      if (e.relatedTarget === toolbar || e.relatedTarget === colorInput || 
          toolbar.contains(e.relatedTarget as Node)) {
        return;
      }
      
      const newContent = convertToCustomFormat(editor.innerHTML);
      onChange({ content: newContent });
      
      try {
        document.body.removeChild(editor);
        document.body.removeChild(toolbar);
      } catch (err) {
        // Elements might already be removed
      }
      
      textNode.show();
      setIsEditing(false);
      onEditingChange?.(false);
      
      // Remove keydown handler
      window.removeEventListener('keydown', handleKeyDown, true);
    };

    editor.addEventListener('blur', handleBlur);
    // Add to window in capture phase so it runs before parent modal's handler
    window.addEventListener('keydown', handleKeyDown, true);
    
    // Focus the editor
    editor.focus();
  };

  return (
    <Text
      ref={shapeRef}
      id={element.id}
      x={element.x}
      y={element.y}
      width={element.width}
      text={getPlainText()}
      fontSize={element.fontSize || 24}
      fontFamily={getFontFamily(element.fontFamily)}
      fontStyle={getFontStyle()}
      align={element.textAlign || 'center'}
      fill={element.color || '#ffffff'}
      lineHeight={1}
      opacity={showFormattedOverlay && !isEditing && !isDragging && !isBeingDragged ? 0 : (element.opacity ?? 1)}
      rotation={element.rotation || 0}
      draggable={!isEditing}
      onClick={onSelect}
      onTap={onSelect}
      onContextMenu={onContextMenu}
      {...longPressHandlers}
      onDblClick={handleDblClick}
      onDblTap={handleDblClick}
      onDragStart={(e) => {
        setIsDragging(true);
        if (onDragStart) onDragStart(e);
      }}
      onDragMove={onDragMove}
      onDragEnd={(e) => {
        setIsDragging(false);
        const node = shapeRef.current;
        onChange({
          x: Math.round(e.target.x()),
          y: Math.round(e.target.y()),
          width: node ? Math.round(node.width()) : undefined,
          height: node ? Math.round(node.height()) : undefined,
        });
      }}
      onTransformEnd={(e) => {
        const node = shapeRef.current;
        if (!node) return;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        const newWidth = Math.round(Math.max(20, node.width() * scaleX));
        const newHeight = Math.round(Math.max(20, node.height() * scaleY));
        onChange({
          x: Math.round(node.x()),
          y: Math.round(node.y()),
          width: newWidth,
          height: newHeight,
          rotation: Math.round(node.rotation()),
        });
      }}
    />
  );
};
