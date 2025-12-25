import React from 'react';
import { Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';

interface BackgroundImageProps {
  url: string;
  width: number;
  height: number;
}

/**
 * BackgroundImage component for slide backgrounds
 */
export const BackgroundImage: React.FC<BackgroundImageProps> = ({ url, width, height }) => {
  const [image] = useImage(url);

  if (!image) {
    return null;
  }

  return (
    <KonvaImage
      x={0}
      y={0}
      image={image}
      width={width}
      height={height}
      listening={false}
    />
  );
};
