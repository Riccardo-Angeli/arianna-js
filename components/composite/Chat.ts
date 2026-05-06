/**
 * @module    Chat
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026 All Rights Reserved
 *
 * WhatsApp / Signal-style chat widget. Three-pane layout (sidebar +
 * conversation thread + composer), with full features:
 *
 *   • Conversation list (sidebar): ordered by last activity, badge for unread,
 *     avatar + name + last message preview.
 *   • Message thread: bubbles (incoming on left, outgoing on right), grouped
 *     by author within close timestamps, system messages centred, image &
 *     attachment messages, replies (quoted parent), reactions, read receipts
 *     (✓ sent, ✓✓ delivered, ✓✓ blue read), typing indicator.
 *   • Composer: text input, send button, attach (file picker), emoji slot,
 *     reply-to chip when replying.
 *
 *   ┌──────────────┬───────────────────────────────────┐
 *   │  Sidebar     │   Header (peer name, presence)    │
 *   │              ├───────────────────────────────────┤
 *   │ ▣ Alice  ●3 │                                   │
 *   │ ▣ Bob       │   ┌─────┐                         │
 *   │ ▣ Group #1  │   │ msg │← incoming               │
 *   │              │   └─────┘                         │
 *   │              │              ┌──────┐             │
 *   │              │              │ mine │ outgoing    │
 *   │              │              └──────┘ ✓✓          │
 *   │              ├───────────────────────────────────┤
 *   │              │ [✎ message]    [📎] [😊] [Send]   │
 *   └──────────────┴───────────────────────────────────┘
 *
 * The component owns its data model — a list of `Conversation`s, each with
 * `Message`s. The host application syncs incoming messages via `addMessage`
 * and listens for `send` events to push outgoing messages to its backend.
 *
 * @example
 *   import { Chat } from 'ariannajs/components/chat';
 *
 *   const chat = new Chat('#chat', {
 *       me: { id: 'rick', name: 'Riccardo', avatar: '/me.png' },
 *   });
 *   chat.addConversation({ id: 'alice', name: 'Alice', avatar: '/alice.png' });
 *   chat.addMessage('alice', { id: 'm1', from: 'alice', text: 'Hey!', at: Date.now() });
 *   chat.openConversation('alice');
 *   chat.on('send', e => api.sendMessage(e.conversationId, e.text));
 */

import { Control, type CtrlOptions } from '../core/Control.ts';

// ── Data model ───────────────────────────────────────────────────────────────

export interface User {
    id      : string;
    name    : string;
    avatar? : string;
}

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Reaction {
    /** Unicode emoji. */
    emoji : string;
    /** User ids who reacted with this emoji. */
    by    : string[];
}

export interface Attachment {
    kind : 'image' | 'file' | 'audio' | 'video';
    url  : string;
    name?: string;
    /** For images/video: pixel size. */
    width? : number;
    height?: number;
    /** For audio/video: duration in seconds. */
    duration? : number;
}

export interface Message {
    id        : string;
    /** User id; equals conversation owner's `me.id` for outgoing. */
    from      : string;
    /** Body text. May be empty if pure attachment. */
    text      : string;
    /** Unix ms. */
    at        : number;
    status?   : MessageStatus;
    /** Sequence of attachments. */
    attachments? : Attachment[];
    /** id of the message being replied to (quoted). */
    replyTo?  : string;
    /** Reactions keyed by emoji. */
    reactions?: Reaction[];
    /** A system message (centred, no avatar) — e.g. "Alice joined the group". */
    system?   : boolean;
}

export interface Conversation {
    id       : string;
    name     : string;
    avatar?  : string;
    /** Group conversation? Default false (1:1). */
    group?   : boolean;
    /** Display in italics under name when set. */
    presence?: 'online' | 'offline' | 'typing' | string;
    messages : Message[];
    /** Number of unread messages — host computes & updates this. */
    unread   : number;
}

// ── Options ──────────────────────────────────────────────────────────────────

export interface ChatOptions extends CtrlOptions {
    /** The "me" user — outgoing messages have `from === me.id`. */
    me           : User;
    /** Initial conversations. */
    conversations? : Conversation[];
    /** Conversation id to open initially. */
    initialOpen? : string;
    /** Show the sidebar. Default true. Set false for embedded single-thread. */
    showSidebar? : boolean;
    /** Locale for formatting timestamps. Default browser default. */
    locale?      : string;
}

// ── Component ────────────────────────────────────────────────────────────────

export class Chat extends Control<ChatOptions>
{
    private _me            : User;
    private _conversations : Map<string, Conversation> = new Map();
    private _open          : string | null = null;
    private _replyTo       : string | null = null;

    // DOM
    private _elSidebar?  : HTMLElement;
    private _elThread!   : HTMLElement;
    private _elHeader!   : HTMLElement;
    private _elMessages! : HTMLElement;
    private _elComposer! : HTMLElement;
    private _elInput!    : HTMLTextAreaElement;
    private _elReplyChip?: HTMLElement;

    constructor(container: string | HTMLElement | null, opts: ChatOptions)
    {
        super(container, 'div', {
            showSidebar: true,
            ...opts,
        });

        if (!opts.me) throw new Error('Chat requires `me` option');
        this._me = opts.me;

        this.el.className = `ar-chat${opts.class ? ' ' + opts.class : ''}`;
        for (const c of opts.conversations ?? [])
            this._conversations.set(c.id, this._cloneConversation(c));

        this._injectStyles();
        this._build();

        const initial = opts.initialOpen ?? this._conversations.keys().next().value;
        if (initial) this.openConversation(initial);
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /** All conversations, sorted by last-activity desc. */
    getConversations(): Conversation[]
    {
        return [...this._conversations.values()]
            .map(c => this._cloneConversation(c))
            .sort((a, b) => this._lastAt(b) - this._lastAt(a));
    }

    /** Single conversation by id, or null. */
    getConversation(id: string): Conversation | null
    {
        const c = this._conversations.get(id);
        return c ? this._cloneConversation(c) : null;
    }

    /** Active (open) conversation id, or null. */
    getOpen(): string | null { return this._open; }

    /** Add or replace a conversation. */
    addConversation(c: Omit<Conversation, 'messages' | 'unread'> & Partial<Pick<Conversation, 'messages' | 'unread'>>): Conversation
    {
        const conv: Conversation = {
            id      : c.id,
            name    : c.name,
            avatar  : c.avatar,
            group   : c.group,
            presence: c.presence,
            messages: (c.messages ?? []).map(m => this._cloneMessage(m)),
            unread  : c.unread ?? 0,
        };
        this._conversations.set(conv.id, conv);
        this._renderSidebar();
        return this._cloneConversation(conv);
    }

    /** Remove a conversation. */
    removeConversation(id: string): this
    {
        if (!this._conversations.has(id)) return this;
        this._conversations.delete(id);
        if (this._open === id) this._open = null;
        this._renderSidebar();
        this._renderThread();
        return this;
    }

    /** Open a conversation in the thread pane. Resets its unread count. */
    openConversation(id: string): this
    {
        const c = this._conversations.get(id);
        if (!c) return this;
        this._open = id;
        c.unread = 0;
        this._replyTo = null;
        this._renderSidebar();
        this._renderThread();
        this._emit('open', { conversationId: id });
        return this;
    }

    /**
     * Add a message to a conversation. Bumps unread if the conversation is
     * not currently open and the message is from someone else.
     */
    addMessage(conversationId: string, m: Message): Message
    {
        const c = this._conversations.get(conversationId);
        if (!c) throw new Error(`Chat.addMessage: unknown conversation: ${conversationId}`);
        c.messages.push(this._cloneMessage(m));
        if (this._open !== conversationId && m.from !== this._me.id && !m.system)
            c.unread++;
        this._renderSidebar();
        if (this._open === conversationId) this._renderThread();
        this._emit('message', { conversationId, message: m });
        return m;
    }

    /** Update a message's fields (status changes, reactions, edits, ...). */
    updateMessage(conversationId: string, messageId: string, patch: Partial<Message>): this
    {
        const c = this._conversations.get(conversationId);
        if (!c) return this;
        const i = c.messages.findIndex(m => m.id === messageId);
        if (i < 0) return this;
        c.messages[i] = { ...c.messages[i]!, ...patch };
        if (patch.reactions) c.messages[i]!.reactions = patch.reactions.map(r => ({ ...r, by: [...r.by] }));
        if (this._open === conversationId) this._renderThread();
        this._renderSidebar();
        return this;
    }

    /** Add or remove a reaction. */
    toggleReaction(conversationId: string, messageId: string, emoji: string, userId: string): this
    {
        const c = this._conversations.get(conversationId);
        if (!c) return this;
        const m = c.messages.find(x => x.id === messageId);
        if (!m) return this;
        m.reactions = m.reactions ?? [];
        const r = m.reactions.find(x => x.emoji === emoji);
        if (!r)
        {
            m.reactions.push({ emoji, by: [userId] });
        }
        else
        {
            const idx = r.by.indexOf(userId);
            if (idx >= 0) r.by.splice(idx, 1);
            else          r.by.push(userId);
            if (r.by.length === 0)
                m.reactions.splice(m.reactions.indexOf(r), 1);
        }
        if (this._open === conversationId) this._renderThread();
        this._emit('reaction', { conversationId, messageId, emoji, userId });
        return this;
    }

    /** Set the reply-to message for the composer (chip appears above input). */
    setReplyTo(messageId: string | null): this
    {
        this._replyTo = messageId;
        this._renderReplyChip();
        return this;
    }

    /** Set or clear the per-conversation `presence` (e.g. "typing"). */
    setPresence(conversationId: string, presence: string | undefined): this
    {
        const c = this._conversations.get(conversationId);
        if (!c) return this;
        c.presence = presence;
        if (this._open === conversationId) this._renderHeader();
        this._renderSidebar();
        return this;
    }

    // ── Build + render ─────────────────────────────────────────────────────

    protected _build(): void
    {
        const showSidebar = this._get<boolean>('showSidebar', true);
        this.el.innerHTML = `
${showSidebar ? `<aside class="ar-chat__sidebar" data-r="sidebar"></aside>` : ''}
<section class="ar-chat__thread" data-r="thread">
  <header class="ar-chat__header"   data-r="header"></header>
  <div    class="ar-chat__messages" data-r="messages"></div>
  <footer class="ar-chat__composer" data-r="composer">
    <div class="ar-chat__reply-chip" data-r="reply-chip" style="display:none"></div>
    <div class="ar-chat__composer-row">
      <textarea class="ar-chat__input" data-r="input" rows="1" placeholder="Message…"></textarea>
      <button class="ar-chat__btn ar-chat__btn--icon" data-act="attach" title="Attach">📎</button>
      <button class="ar-chat__btn ar-chat__btn--icon" data-act="emoji"  title="Emoji">😊</button>
      <button class="ar-chat__btn ar-chat__btn--send" data-act="send"   title="Send">➤</button>
    </div>
  </footer>
</section>`;

        const r = (n: string) => this.el.querySelector<HTMLElement>(`[data-r="${n}"]`);
        if (showSidebar) this._elSidebar = r('sidebar')!;
        this._elThread    = r('thread')!;
        this._elHeader    = r('header')!;
        this._elMessages  = r('messages')!;
        this._elComposer  = r('composer')!;
        this._elInput     = r('input') as HTMLTextAreaElement;
        this._elReplyChip = r('reply-chip')!;

        // Composer events
        this._elInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey)
            {
                e.preventDefault();
                this._send();
            }
        });
        this._elInput.addEventListener('input', () => {
            this._autosize();
            this._emit('typing', { conversationId: this._open });
        });
        this._elComposer.querySelector('[data-act="send"]')?.addEventListener('click',   () => this._send());
        this._elComposer.querySelector('[data-act="attach"]')?.addEventListener('click', () => this._emit('attach', { conversationId: this._open }));
        this._elComposer.querySelector('[data-act="emoji"]')?.addEventListener('click',  () => this._emit('emoji-pick', { conversationId: this._open }));

        this._renderSidebar();
    }

    private _renderSidebar(): void
    {
        if (!this._elSidebar) return;
        this._elSidebar.innerHTML = '';

        const items = [...this._conversations.values()]
            .sort((a, b) => this._lastAt(b) - this._lastAt(a));

        for (const c of items)
        {
            const row = document.createElement('div');
            row.className = 'ar-chat__sidebar-row' + (c.id === this._open ? ' ar-chat__sidebar-row--active' : '');
            row.dataset.id = c.id;

            const last = c.messages[c.messages.length - 1];
            const preview = last
                ? (last.from === this._me.id ? 'You: ' : '') + (last.text || (last.attachments?.length ? '📎 attachment' : ''))
                : '';

            row.innerHTML = `
<div class="ar-chat__avatar">${avatarHtml(c.name, c.avatar)}</div>
<div class="ar-chat__sidebar-mid">
  <div class="ar-chat__sidebar-name">${escapeHtml(c.name)}</div>
  <div class="ar-chat__sidebar-preview">${escapeHtml(preview).slice(0, 60)}</div>
</div>
<div class="ar-chat__sidebar-meta">
  ${last ? `<div class="ar-chat__sidebar-time">${formatShortTime(last.at, this._get<string>('locale', ''))}</div>` : ''}
  ${c.unread > 0 ? `<div class="ar-chat__badge">${c.unread > 99 ? '99+' : c.unread}</div>` : ''}
</div>`;
            row.addEventListener('click', () => this.openConversation(c.id));
            this._elSidebar.appendChild(row);
        }
    }

    private _renderHeader(): void
    {
        const c = this._open ? this._conversations.get(this._open) : null;
        if (!c)
        {
            this._elHeader.innerHTML = '';
            return;
        }
        this._elHeader.innerHTML = `
<div class="ar-chat__avatar">${avatarHtml(c.name, c.avatar)}</div>
<div class="ar-chat__header-mid">
  <div class="ar-chat__header-name">${escapeHtml(c.name)}</div>
  ${c.presence ? `<div class="ar-chat__presence ar-chat__presence--${c.presence}">${escapeHtml(c.presence)}</div>` : ''}
</div>`;
    }

    private _renderThread(): void
    {
        this._renderHeader();
        this._renderReplyChip();
        this._elMessages.innerHTML = '';

        const c = this._open ? this._conversations.get(this._open) : null;
        if (!c) return;

        let prevAuthor: string | null = null;
        let prevAt = 0;
        const GAP_MS = 5 * 60_000;        // 5 min for grouping

        for (const m of c.messages)
        {
            // Day separator
            if (!sameDay(prevAt, m.at) && prevAt > 0)
            {
                const sep = document.createElement('div');
                sep.className = 'ar-chat__day';
                sep.textContent = formatDay(m.at, this._get<string>('locale', ''));
                this._elMessages.appendChild(sep);
            }

            if (m.system)
            {
                const sys = document.createElement('div');
                sys.className = 'ar-chat__system';
                sys.textContent = m.text;
                this._elMessages.appendChild(sys);
                prevAuthor = null;
                prevAt = m.at;
                continue;
            }

            const mine = m.from === this._me.id;
            const grouped = m.from === prevAuthor && (m.at - prevAt) < GAP_MS;

            const wrap = document.createElement('div');
            wrap.className = 'ar-chat__msg' + (mine ? ' ar-chat__msg--mine' : '') + (grouped ? ' ar-chat__msg--grouped' : '');
            wrap.dataset.id = m.id;

            const bubble = document.createElement('div');
            bubble.className = 'ar-chat__bubble';

            // Reply quote
            if (m.replyTo)
            {
                const parent = c.messages.find(x => x.id === m.replyTo);
                if (parent)
                {
                    const quote = document.createElement('div');
                    quote.className = 'ar-chat__quote';
                    quote.innerHTML = `<span class="ar-chat__quote-author">${escapeHtml(this._authorName(parent.from, c))}</span>${escapeHtml(parent.text.slice(0, 80))}`;
                    bubble.appendChild(quote);
                }
            }

            // Attachments
            if (m.attachments && m.attachments.length > 0)
            {
                for (const a of m.attachments)
                {
                    if (a.kind === 'image')
                    {
                        const img = document.createElement('img');
                        img.className = 'ar-chat__att-image';
                        img.src = a.url;
                        if (a.width)  img.width  = a.width;
                        if (a.height) img.height = a.height;
                        bubble.appendChild(img);
                    }
                    else
                    {
                        const f = document.createElement('div');
                        f.className = 'ar-chat__att-file';
                        f.textContent = (a.kind === 'audio' ? '🎵 ' : a.kind === 'video' ? '🎬 ' : '📄 ') + (a.name || a.url);
                        bubble.appendChild(f);
                    }
                }
            }

            // Text
            if (m.text)
            {
                const t = document.createElement('div');
                t.className = 'ar-chat__text';
                t.textContent = m.text;
                bubble.appendChild(t);
            }

            // Meta row (time + status)
            const meta = document.createElement('div');
            meta.className = 'ar-chat__meta';
            meta.innerHTML = `
<span class="ar-chat__time">${formatShortTime(m.at, this._get<string>('locale', ''))}</span>
${mine ? `<span class="ar-chat__status ar-chat__status--${m.status || 'sent'}">${statusIcon(m.status)}</span>` : ''}
`;
            bubble.appendChild(meta);

            // Reactions row
            if (m.reactions && m.reactions.length > 0)
            {
                const rx = document.createElement('div');
                rx.className = 'ar-chat__reactions';
                for (const r of m.reactions)
                {
                    const chip = document.createElement('span');
                    chip.className = 'ar-chat__reaction';
                    chip.textContent = `${r.emoji} ${r.by.length}`;
                    chip.addEventListener('click', () => this.toggleReaction(c.id, m.id, r.emoji, this._me.id));
                    rx.appendChild(chip);
                }
                bubble.appendChild(rx);
            }

            // Author label for incoming group messages on first-of-cluster
            if (!mine && c.group && !grouped)
            {
                const lbl = document.createElement('div');
                lbl.className = 'ar-chat__author';
                lbl.textContent = this._authorName(m.from, c);
                wrap.appendChild(lbl);
            }
            wrap.appendChild(bubble);
            this._elMessages.appendChild(wrap);

            prevAuthor = m.from;
            prevAt = m.at;
        }

        // Auto-scroll to bottom
        this._elMessages.scrollTop = this._elMessages.scrollHeight;
    }

    private _renderReplyChip(): void
    {
        if (!this._elReplyChip) return;
        if (!this._replyTo || !this._open) { this._elReplyChip.style.display = 'none'; return; }
        const c = this._conversations.get(this._open);
        const m = c?.messages.find(x => x.id === this._replyTo);
        if (!m) { this._elReplyChip.style.display = 'none'; return; }

        this._elReplyChip.innerHTML = `
<span class="ar-chat__reply-chip-text">
  <strong>${escapeHtml(this._authorName(m.from, c!))}</strong>: ${escapeHtml(m.text.slice(0, 60))}
</span>
<button class="ar-chat__btn ar-chat__btn--icon" data-act="cancel-reply" title="Cancel reply">×</button>`;
        this._elReplyChip.style.display = '';
        this._elReplyChip.querySelector('[data-act="cancel-reply"]')?.addEventListener('click', () => this.setReplyTo(null));
    }

    // ── Internal ───────────────────────────────────────────────────────────

    private _send(): void
    {
        const text = this._elInput.value.trim();
        if (!text || !this._open) return;
        const replyTo = this._replyTo ?? undefined;
        this._emit('send', { conversationId: this._open, text, replyTo });
        this._elInput.value = '';
        this._autosize();
        this._replyTo = null;
        this._renderReplyChip();
    }

    private _autosize(): void
    {
        const ta = this._elInput;
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }

    private _authorName(userId: string, c: Conversation): string
    {
        if (userId === this._me.id) return this._me.name;
        // 1:1 chats: peer's name = conversation name
        if (!c.group) return c.name;
        // Group chats — fall back to id since we don't store member roster
        return userId;
    }

    private _lastAt(c: Conversation): number
    {
        const last = c.messages[c.messages.length - 1];
        return last ? last.at : 0;
    }

    private _cloneConversation(c: Conversation): Conversation
    {
        return {
            id: c.id, name: c.name, avatar: c.avatar, group: c.group, presence: c.presence,
            unread: c.unread,
            messages: c.messages.map(m => this._cloneMessage(m)),
        };
    }

    private _cloneMessage(m: Message): Message
    {
        return {
            ...m,
            attachments: m.attachments?.map(a => ({ ...a })),
            reactions  : m.reactions?.map(r => ({ ...r, by: [...r.by] })),
        };
    }

    private _injectStyles(): void
    {
        if (document.getElementById('ar-chat-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-chat-styles';
        s.textContent = `
.ar-chat { display:flex; height:600px; background:#1e1e1e; border:1px solid #333; border-radius:6px; overflow:hidden; color:#d4d4d4; font:13px -apple-system,system-ui,sans-serif; }
.ar-chat__sidebar { width:280px; flex-shrink:0; background:#181818; border-right:1px solid #333; overflow:auto; }
.ar-chat__sidebar-row { display:flex; gap:10px; padding:10px 12px; cursor:pointer; align-items:center; border-bottom:1px solid #2a2a2a; }
.ar-chat__sidebar-row:hover { background:#222; }
.ar-chat__sidebar-row--active { background:#252525; border-left:3px solid #e40c88; padding-left:9px; }
.ar-chat__avatar { width:40px; height:40px; border-radius:50%; background:#444; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-weight:600; color:#fff; overflow:hidden; }
.ar-chat__avatar img { width:100%; height:100%; object-fit:cover; }
.ar-chat__sidebar-mid { flex:1; min-width:0; }
.ar-chat__sidebar-name { font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ar-chat__sidebar-preview { font-size:12px; color:#888; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ar-chat__sidebar-meta { display:flex; flex-direction:column; align-items:flex-end; gap:4px; }
.ar-chat__sidebar-time { font-size:11px; color:#666; }
.ar-chat__badge { background:#e40c88; color:#fff; font:600 10px sans-serif; padding:2px 6px; border-radius:10px; min-width:18px; text-align:center; }

.ar-chat__thread { flex:1; display:flex; flex-direction:column; min-width:0; }
.ar-chat__header { display:flex; gap:10px; padding:10px 16px; border-bottom:1px solid #333; align-items:center; flex-shrink:0; }
.ar-chat__header-mid { display:flex; flex-direction:column; }
.ar-chat__header-name { font-weight:600; }
.ar-chat__presence { font-size:11px; color:#888; font-style:italic; }
.ar-chat__presence--online { color:#22c55e; font-style:normal; }
.ar-chat__presence--typing { color:#e40c88; }

.ar-chat__messages { flex:1; overflow:auto; padding:12px 16px; display:flex; flex-direction:column; gap:6px; }
.ar-chat__day { align-self:center; padding:4px 12px; background:#0d0d0d; border-radius:10px; font-size:11px; color:#888; margin:8px 0; }
.ar-chat__system { align-self:center; font-size:11px; color:#666; padding:4px 12px; }
.ar-chat__msg { display:flex; flex-direction:column; align-items:flex-start; max-width:75%; }
.ar-chat__msg--mine { align-self:flex-end; align-items:flex-end; }
.ar-chat__msg--grouped { margin-top:-3px; }
.ar-chat__author { font:600 11px sans-serif; color:#e40c88; padding:2px 12px 0; }
.ar-chat__bubble { background:#2a2a2a; padding:6px 10px; border-radius:12px; max-width:100%; word-wrap:break-word; }
.ar-chat__msg--mine .ar-chat__bubble { background:#e40c88; color:#fff; }
.ar-chat__quote { border-left:3px solid rgba(228,12,136,0.6); padding:2px 8px; margin-bottom:4px; font-size:12px; opacity:.85; }
.ar-chat__quote-author { display:block; font-weight:600; color:#e40c88; }
.ar-chat__msg--mine .ar-chat__quote-author { color:#fff; }
.ar-chat__text { white-space:pre-wrap; }
.ar-chat__att-image { max-width:300px; max-height:300px; border-radius:8px; margin-bottom:4px; display:block; }
.ar-chat__att-file { background:#0d0d0d; padding:6px 10px; border-radius:4px; font-size:12px; margin-bottom:4px; }
.ar-chat__msg--mine .ar-chat__att-file { background:rgba(0,0,0,0.3); }
.ar-chat__meta { display:flex; gap:6px; align-items:center; justify-content:flex-end; font-size:10px; color:#888; margin-top:2px; }
.ar-chat__msg--mine .ar-chat__meta { color:rgba(255,255,255,0.7); }
.ar-chat__status--read { color:#3b82f6 !important; }
.ar-chat__status--failed { color:#dc2626 !important; }
.ar-chat__reactions { display:flex; flex-wrap:wrap; gap:3px; margin-top:4px; }
.ar-chat__reaction { background:#0d0d0d; padding:2px 6px; border-radius:10px; font-size:11px; cursor:pointer; border:1px solid #333; }
.ar-chat__msg--mine .ar-chat__reaction { background:rgba(0,0,0,0.3); border-color:transparent; color:#fff; }

.ar-chat__composer { border-top:1px solid #333; padding:8px 12px; flex-shrink:0; }
.ar-chat__reply-chip { background:#0d0d0d; padding:6px 10px; border-radius:4px; margin-bottom:6px; display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:12px; border-left:3px solid #e40c88; }
.ar-chat__reply-chip-text { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ar-chat__composer-row { display:flex; gap:6px; align-items:flex-end; }
.ar-chat__input { flex:1; background:#0d0d0d; border:1px solid #333; color:#d4d4d4; padding:8px 10px; font:13px sans-serif; border-radius:18px; resize:none; max-height:120px; }
.ar-chat__input:focus { border-color:#e40c88; outline:none; }
.ar-chat__btn { background:transparent; border:0; color:#888; cursor:pointer; padding:8px; font-size:18px; border-radius:50%; flex-shrink:0; }
.ar-chat__btn:hover { background:#2a2a2a; color:#fff; }
.ar-chat__btn--icon { width:36px; height:36px; }
.ar-chat__btn--send { background:#e40c88; color:#fff; width:36px; height:36px; }
.ar-chat__btn--send:hover { background:#c30b75; color:#fff; }
`;
        document.head.appendChild(s);
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string
{
    return s.replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    } as Record<string, string>)[c]!);
}

function avatarHtml(name: string, src?: string): string
{
    if (src) return `<img src="${src}" alt="">`;
    const initials = name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
    return escapeHtml(initials);
}

function formatShortTime(at: number, locale?: string): string
{
    const d = new Date(at);
    return d.toLocaleTimeString(locale || undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatDay(at: number, locale?: string): string
{
    const d = new Date(at);
    const today = new Date();
    if (sameDay(at, today.getTime())) return 'Today';
    const yest = new Date(today); yest.setDate(today.getDate() - 1);
    if (sameDay(at, yest.getTime())) return 'Yesterday';
    return d.toLocaleDateString(locale || undefined, { weekday: 'long', day: 'numeric', month: 'short' });
}

function sameDay(a: number, b: number): boolean
{
    const da = new Date(a), db = new Date(b);
    return da.getFullYear() === db.getFullYear() &&
           da.getMonth()    === db.getMonth() &&
           da.getDate()     === db.getDate();
}

function statusIcon(s?: MessageStatus): string
{
    switch (s)
    {
        case 'sending':   return '◌';
        case 'sent':      return '✓';
        case 'delivered': return '✓✓';
        case 'read':      return '✓✓';
        case 'failed':    return '⚠';
        default:          return '✓';
    }
}
