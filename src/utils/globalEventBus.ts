/**
 * Global Event Bus for cross-component communication
 * 
 * This provides a centralized way for components to communicate data changes
 * even when they're not mounted. Components should refresh their data on mount
 * to ensure they have the latest state from the backend.
 */

import type { Center, Song, Singer, SongSingerPitch, Feedback } from '../types';

type EventType = 
  | 'singerCreated'
  | 'singerUpdated'
  | 'singerDeleted'
  | 'singerMerged'
  | 'songCreated'
  | 'songUpdated'
  | 'songDeleted'
  | 'pitchCreated'
  | 'pitchUpdated'
  | 'pitchDeleted'
  | 'centerCreated'
  | 'centerUpdated'
  | 'centerDeleted'
  | 'feedbackSubmitted'
  | 'dataRefreshNeeded';

type EventDetail = 
  | { type: 'singerCreated'; singer: Singer | null; centerIds: number[] }
  | { type: 'singerUpdated'; singer: Singer | null; centerIdsRemoved: number[]; centerIdsAdded: number[] }
  | { type: 'singerDeleted'; singer: Singer | null; centerIds: number[] }
  | { type: 'singerMerged'; singer: Singer | null; singerIdsRemoved: string[]; targetSingerPitchCountUp: number; songIdsPitchCountDown: Map<string, number>; centerIdsSingerCountDown: Map<string, number> }
  | { type: 'songCreated'; song: Song | null }
  | { type: 'songUpdated'; song: Song | null }
  | { type: 'songDeleted'; song: Song | null }
  | { type: 'pitchCreated'; pitch: SongSingerPitch | null }
  | { type: 'pitchUpdated'; pitch: SongSingerPitch | null }
  | { type: 'pitchDeleted'; pitch: SongSingerPitch | null }
  | { type: 'centerCreated'; center: Center | null }
  | { type: 'centerUpdated'; center: Center | null }
  | { type: 'centerDeleted'; center: Center | null }
  | { type: 'feedbackSubmitted'; feedback: Feedback | null }
  | { type: 'dataRefreshNeeded'; resource: 'songs' | 'singers' | 'pitches' | 'centers' | 'feedback' | 'all' };

class GlobalEventBus {
  /**
   * Dispatch a global event that components can listen to
   */
  dispatch<T extends EventType>(eventType: T, detail: Extract<EventDetail, { type: T }>): void {
    if (typeof window === 'undefined') return;
    
    const event = new CustomEvent(eventType, {
      detail,
      bubbles: true,
      cancelable: true
    });
    
    window.dispatchEvent(event);
  }

  /**
   * Listen for a specific event type
   */
  on<T extends EventType>(
    eventType: T,
    handler: (detail: Extract<EventDetail, { type: T }>) => void
  ): () => void {
    if (typeof window === 'undefined') return () => {};

    const eventHandler = (event: Event) => {
      const customEvent = event as CustomEvent<Extract<EventDetail, { type: T }>>;
      if (customEvent.detail) {
        handler(customEvent.detail);
      }
    };

    window.addEventListener(eventType, eventHandler);

    // Return cleanup function
    return () => {
      window.removeEventListener(eventType, eventHandler);
    };
  }

  /**
   * Request a data refresh for a specific resource
   * Components listening to this should refresh their data from backend
   */
  requestRefresh(resource: 'songs' | 'singers' | 'pitches' | 'centers' | 'all'): void {
    this.dispatch('dataRefreshNeeded', { type: 'dataRefreshNeeded', resource });
  }
}

export const globalEventBus = new GlobalEventBus();

