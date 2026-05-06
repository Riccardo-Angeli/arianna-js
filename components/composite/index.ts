/**
 * @module    components/composite
 *
 * Cross-domain compound widgets — Chat, node editors, and other pieces of
 * UI that span multiple specialised editors (audio / video / piano-roll).
 */

export { Chat } from './Chat.ts';
export type {
    ChatOptions, User, Conversation, Message, MessageStatus,
    Attachment, Reaction,
} from './Chat.ts';

export { NodeEditor } from './NodeEditor.ts';
export type {
    NodeEditorOptions, NodeSchema, NodeInstance, PortSpec, ParamSpec,
    WireInstance, WireStatus, TypeCheckFn, ExportedGraph,
} from './NodeEditor.ts';
// `RunState` collides with PianoRoll's identical type — re-export aliased.
export type { RunState as NodeEditorRunState } from './NodeEditor.ts';
