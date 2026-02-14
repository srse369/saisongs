/**
 * Tool registry for the "Ask the app" agent.
 * Each tool is exposed to the LLM via the system prompt and dispatched by the executor (useAgentExecutor / LLMDrawer).
 * We use ACTION_JSON with type + args; the model outputs one action per turn.
 */

export interface AgentToolParam {
  description: string;
  required?: boolean;
}

export interface AgentTool {
  type: string;
  description: string;
  parameters: Record<string, AgentToolParam>;
  /** Example ACTION_JSON line for the prompt (without the "ACTION_JSON: " prefix). */
  exampleJson: string;
}

/** Grouped by domain for prompt generation. */
export const AGENT_TOOLS_BY_DOMAIN: Record<string, AgentTool[]> = {
  navigation: [
    {
      type: 'navigate',
      description: 'Open a tab or page. Use when the user wants to go somewhere. For "show/find X songs" with filters use path /admin/songs and include filters. For "my X songs/bhajans" or "my pitches for X" (user wants their pitches for those songs) use path /admin/pitches with filters (deity, tempo, etc.) and showMyPitches: true.',
      parameters: {
        path: { description: 'Route path', required: true },
        filters: { description: 'Optional filters (e.g. deity, tempo, language) for Songs or Pitches', required: false },
        showMyPitches: { description: 'When true and path is /admin/pitches, show only the user\'s pitches', required: false },
      },
      exampleJson: '{"type":"navigate","path":"/admin/pitches","filters":{"deity":"shiva","tempo":"slow"},"showMyPitches":true}',
    },
  ],
  songs: [
    {
      type: 'show_preview',
      description: 'Open the song details modal for a specific song/bhajan by name.',
      parameters: {
        songName: { description: 'Exact or matching song name from the library', required: true },
      },
      exampleJson: '{"type":"show_preview","songName":"Om Ram"}',
    },
    {
      type: 'play_audio',
      description: 'Play the audio link of a specific song/bhajan.',
      parameters: {
        songName: { description: 'Exact or matching song name from the library', required: true },
      },
      exampleJson: '{"type":"play_audio","songName":"Om Ram"}',
    },
    {
      type: 'show_ref_gents',
      description: "Show the men's/gents/male reference scale for a song.",
      parameters: {
        songName: { description: 'Exact or matching song name from the library', required: true },
      },
      exampleJson: '{"type":"show_ref_gents","songName":"Om Ram"}',
    },
    {
      type: 'show_ref_ladies',
      description: "Show the ladies/women's/female reference scale for a song.",
      parameters: {
        songName: { description: 'Exact or matching song name from the library', required: true },
      },
      exampleJson: '{"type":"show_ref_ladies","songName":"Om Ram"}',
    },
  ],
  session: [
    {
      type: 'add_song_to_session',
      description: 'Add a song to the current live session. Optionally with singer and pitch when user specifies them.',
      parameters: {
        songName: { description: 'Song name from the library', required: true },
        singerName: { description: 'Optional singer name', required: false },
        pitch: { description: 'Optional pitch/key (e.g. C, D#)', required: false },
      },
      exampleJson: '{"type":"add_song_to_session","songName":"Om Ram","singerName":"John","pitch":"C"}',
    },
    {
      type: 'remove_song_from_session',
      description: 'Remove a song (or song+singer) from the current live session.',
      parameters: {
        songName: { description: 'Song name to remove from session', required: true },
        singerName: { description: 'Optional: remove only this singer\'s entry for the song', required: false },
      },
      exampleJson: '{"type":"remove_song_from_session","songName":"Om Ram"}',
    },
    {
      type: 'clear_session',
      description: 'Clear all songs from the current live session.',
      parameters: {},
      exampleJson: '{"type":"clear_session"}',
    },
  ],
};

/** Flat list of all tool types for the executor. */
export const ALL_AGENT_TOOL_TYPES: string[] = (() => {
  const set = new Set<string>();
  Object.values(AGENT_TOOLS_BY_DOMAIN).forEach((tools) => tools.forEach((t) => set.add(t.type)));
  return Array.from(set);
})();

export function getAgentTool(type: string): AgentTool | undefined {
  for (const tools of Object.values(AGENT_TOOLS_BY_DOMAIN)) {
    const found = tools.find((t) => t.type === type);
    if (found) return found;
  }
  return undefined;
}
