/**
 * @module    arianna-video
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026 All Rights Reserved
 *
 * AriannA video components — players, multi-track editors.
 *
 * @example
 *   import { VideoPlayer, VideoTrackEditor } from 'ariannajs/components/video';
 */

export { VideoPlayer }      from './VideoPlayer.ts';
export { VideoTrackEditor } from './VideoTrackEditor.ts';

export type { VideoPlayerOptions } from './VideoPlayer.ts';
export type {
    VideoTrack, VideoClip, VideoSource,
    VideoTrackEditorOptions, ExportedProject,
} from './VideoTrackEditor.ts';
