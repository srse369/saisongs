import React, { useRef } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import { type CanvasElement } from '../types';
import { useLongPress } from '../hooks';

export const VideoPlaceholder: React.FC<{
  element: CanvasElement;
  isSelected: boolean;
  onSelect: (e?: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onChange: (attrs: Partial<CanvasElement>) => void;
  onContextMenu?: (e: Konva.KonvaEventObject<PointerEvent>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
}> = ({ element, isSelected, onSelect, onChange, onContextMenu, onDragStart, onDragMove }) => {
  const groupRef = useRef<Konva.Group>(null);
  const longPressHandlers = useLongPress(onContextMenu || (() => {}));

  return (
    <Group
      ref={groupRef}
      id={element.id}
      x={element.x}
      y={element.y}
      rotation={element.rotation || 0}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onContextMenu={onContextMenu}
      {...longPressHandlers}
      onDragMove={onDragMove}
      onDragEnd={(e) => {
        onChange({
          x: Math.round(e.target.x()),
          y: Math.round(e.target.y()),
        });
      }}
      onTransformEnd={() => {
        const node = groupRef.current;
        if (!node) return;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        onChange({
          x: Math.round(node.x()),
          y: Math.round(node.y()),
          width: Math.round(Math.max(40, (element.width || 0) * scaleX)),
          height: Math.round(Math.max(40, (element.height || 0) * scaleY)),
          rotation: Math.round(node.rotation()),
        });
      }}
    >
      <Rect
        x={0}
        y={0}
        width={element.width}
        height={element.height}
        fill="#111827"
        stroke={isSelected ? '#a855f7' : '#4b5563'}
        strokeWidth={2}
        cornerRadius={6}
      />
      <Text
        text={element.hideVideo ? "🎵 Audio" : "▶ Video"}
        fontSize={16}
        fill="#e5e7eb"
        x={8}
        y={8}
      />
    </Group>
  );
};
