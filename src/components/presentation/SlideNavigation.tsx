import React from 'react';

interface SlideNavigationProps {
  currentSlide: number;
  totalSlides: number;
  onNavigate: (index: number) => void;
}

export const SlideNavigation: React.FC<SlideNavigationProps> = ({
  currentSlide,
  totalSlides,
  onNavigate,
}) => {
  const isFirstSlide = currentSlide === 0;
  const isLastSlide = currentSlide === totalSlides - 1;

  const handlePrevious = () => {
    if (!isFirstSlide) {
      onNavigate(currentSlide - 1);
    }
  };

  const handleNext = () => {
    if (!isLastSlide) {
      onNavigate(currentSlide + 1);
    }
  };

  return (
    <div className="flex items-center justify-center gap-6 p-4 bg-gray-800/25 rounded-lg">
      {/* Previous button */}
      <button
        onClick={handlePrevious}
        disabled={isFirstSlide}
        title={isFirstSlide ? "Already at first slide" : "Previous slide (← or ↑)"}
        className={`
          flex items-center justify-center w-12 h-12 rounded-full
          transition-all duration-200
          ${
            isFirstSlide
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
          }
        `}
        aria-label="Previous slide"
      >
        <i className="fas fa-chevron-left text-2xl"></i>
      </button>

      {/* Slide indicator */}
      <div className="flex items-center gap-2 text-white font-medium">
        <span className="text-2xl">{currentSlide + 1}</span>
        <span className="text-gray-400">/</span>
        <span className="text-xl text-gray-300">{totalSlides}</span>
      </div>

      {/* Next button */}
      <button
        onClick={handleNext}
        disabled={isLastSlide}
        title={isLastSlide ? "Already at last slide" : "Next slide (→, ↓, or Space)"}
        className={`
          flex items-center justify-center w-12 h-12 rounded-full
          transition-all duration-200
          ${
            isLastSlide
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
          }
        `}
        aria-label="Next slide"
      >
        <i className="fas fa-chevron-right text-2xl"></i>
      </button>
    </div>
  );
};
