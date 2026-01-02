/**
 * Global Event Bus for cross-component communication
 * 
 * This provides a centralized way for components to communicate data changes
 * even when they're not mounted. Components should refresh their data on mount
 * to ensure they have the latest state from the backend.
 */

type EventType = 
  | 'singerCreated'
  | 'singerUpdated'
  | 'singerDeleted'
  | 'songCreated'
  | 'songUpdated'
  | 'songDeleted'
  | 'pitchCreated'
  | 'pitchUpdated'
  | 'pitchDeleted'
  | 'centerUpdated'
  | 'dataRefreshNeeded';

type EventDetail = 
  | { type: 'singerCreated'; centerIds: number[] }
  | { type: 'singerUpdated'; centerIdsRemoved: number[]; centerIdsAdded: number[] }
  | { type: 'singerDeleted'; centerIds: number[] }
  | { type: 'songCreated' }
  | { type: 'songUpdated' }
  | { type: 'songDeleted' }
  | { type: 'pitchCreated'; singerId: string; songId: string }
  | { type: 'pitchUpdated'; singerId: string; songId: string }
  | { type: 'pitchDeleted'; singerId: string; songId: string }
  | { type: 'centerUpdated' }
  | { type: 'dataRefreshNeeded'; resource: 'songs' | 'singers' | 'pitches' | 'centers' | 'all' };

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
    document.dispatchEvent(event);
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
    document.addEventListener(eventType, eventHandler);

    // Return cleanup function
    return () => {
      window.removeEventListener(eventType, eventHandler);
      document.removeEventListener(eventType, eventHandler);
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

