import React, { useRef } from 'react';
import { Group, Rect, Text, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import type Konva from 'konva';
import { type CanvasElement } from '../types';
import { useLongPress } from '../hooks';

interface URLImageProps {
  element: CanvasElement;
  isSelected: boolean;
  onSelect: (e?: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onChange: (attrs: Partial<CanvasElement>) => void;
  onContextMenu?: (e: Konva.KonvaEventObject<PointerEvent>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
}

/**
 * URLImage component for loading and displaying images
 * Try loading without CORS first for better compatibility
 */
export const URLImage: React.FC<URLImageProps> = ({ 
  element, 
  isSelected, 
  onSelect, 
  onChange, 
  onContextMenu, 
  onDragStart, 
  onDragMove 
}) => {
  const [image, imageStatus] = useImage(element.url || '');
  const shapeRef = useRef<Konva.Image>(null);
  const longPressHandlers = useLongPress(onContextMenu || (() => {}));

  // Show a placeholder rectangle if image fails to load or is loading
  if (!image || imageStatus === 'loading' || imageStatus === 'failed') {
    return (
      <Group
        id={element.id}
        x={element.x}
        y={element.y}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onContextMenu={onContextMenu}
        {...longPressHandlers}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={(e) => {
          onChange({
            x: Math.round(e.target.x()),
            y: Math.round(e.target.y()),
          });
        }}
      >
        {/* Placeholder background */}
        <Rect
          width={element.width}
          height={element.height}
          fill="#374151"
          stroke={isSelected ? '#3b82f6' : '#6b7280'}
          strokeWidth={2}
          cornerRadius={4}
        />
        {/* Image icon */}
        <Text
          text="🖼️"
          fontSize={Math.min(element.width, element.height) * 0.3}
          x={element.width / 2}
          y={element.height / 2 - 20}
          offsetX={Math.min(element.width, element.height) * 0.15}
          align="center"
        />
        {/* Status text */}
        <Text
          text={imageStatus === 'loading' ? 'Loading...' : (element.url ? 'Failed to load' : 'No URL')}
          fontSize={12}
          fill="#9ca3af"
          x={element.width / 2}
          y={element.height / 2 + 10}
          offsetX={40}
          align="center"
        />
      </Group>
    );
  }

  return (
    <KonvaImage
      ref={shapeRef}
      id={element.id}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      rotation={element.rotation || 0}
      image={image}
      opacity={element.opacity ?? 1}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onContextMenu={onContextMenu}
      {...longPressHandlers}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={(e) => {
        onChange({
          x: Math.round(e.target.x()),
          y: Math.round(e.target.y()),
        });
      }}
    />
  );
};
