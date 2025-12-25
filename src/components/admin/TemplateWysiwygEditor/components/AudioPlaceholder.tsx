import React, { useRef } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import { type CanvasElement } from '../types';
import { useLongPress } from '../hooks';

export const AudioPlaceholder: React.FC<{
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
      onDragStart={onDragStart}
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
      {/* Background */}
      <Rect
        width={element.width}
        height={element.height}
        fill={element.visualHidden ? 'transparent' : '#7c3aed'}
        stroke={isSelected ? '#3b82f6' : (element.visualHidden ? '#9333ea' : '#6b21a8')}
        strokeWidth={2}
        cornerRadius={4}
        opacity={element.visualHidden ? 0.3 : 1}
      />
      {/* Audio icon - volume high from Font Awesome */}
      <Text
        text="🔊"
        fontSize={Math.min(element.width, element.height) * 0.35}
        fill="#ffffff"
        x={element.width / 2}
        y={element.height / 2 - 20}
        offsetX={Math.min(element.width, element.height) * 0.175}
        align="center"
        opacity={element.visualHidden ? 0.5 : 1}
      />
      {/* Label */}
      <Text
        text={element.url ? (element.visualHidden ? 'Audio (Hidden)' : 'Audio') : 'No URL'}
        fontSize={12}
        fill="#ffffff"
        x={element.width / 2}
        y={element.height / 2 + 10}
        offsetX={element.url ? (element.visualHidden ? 45 : 20) : 22}
        align="center"
        opacity={element.visualHidden ? 0.5 : 1}
      />
      {/* Dimensions */}
      <Text
        text={`${Math.round(element.width)}×${Math.round(element.height)}`}
        fontSize={10}
        fill="#a78bfa"
        x={8}
        y={8}
        opacity={element.visualHidden ? 0.5 : 1}
      />
    </Group>
  );
};
