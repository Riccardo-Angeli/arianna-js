/**
 * @module    arianna-audio
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026 All Rights Reserved
 *
 * AriannA audio components — players, mixers, editors.
 * All Web Audio-based, all routable via AudioComponent.connect/disconnect.
 *
 * @example
 *   import { PianoRoll, AudioPlayer, ChannelStrip,
 *            AudioTrackEditor, AudioEditor } from 'ariannajs/components/audio';
 *   import { VideoPlayer, VideoTrackEditor }  from 'ariannajs/components/video';
 */

export { AudioComponent, audioContext, resumeAudio } from './AudioComponent.ts';
export { PianoRoll }            from './PianoRoll.ts';
export { AudioPlayer }          from './AudioPlayer.ts';
export { ChannelStrip }         from './ChannelStrip.ts';
export { AudioTrackEditor }     from './AudioTrackEditor.ts';
export { AudioEditor }          from './AudioEditor.ts';

export type { AudioComponentOptions } from './AudioComponent.ts';
export type {
    PianoRollNote, PianoRollOptions, ExportedSequence,
    MidiEvent, Tool, RunState,
} from './PianoRoll.ts';
export type { AudioPlayerOptions }                            from './AudioPlayer.ts';
export type { ChannelStripOptions, EQBand, EQBandSettings }   from './ChannelStrip.ts';
export type { AudioTrack, AudioClip, AudioTrackEditorOptions } from './AudioTrackEditor.ts';
export type { AudioEditorOptions }                            from './AudioEditor.ts';
