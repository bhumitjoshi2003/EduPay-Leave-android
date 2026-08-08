import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { HttpDownloadProgressEvent, HttpEventType } from '@angular/common/http';
import { Subject, Subscription, takeUntil } from 'rxjs';
import { AiCopilotService } from '../../services/ai-copilot.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { ChatMarkdownPipe } from '../../pipes/chat-markdown.pipe';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  error: boolean;
}

@Component({
  selector: 'app-ai-copilot',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, ChatMarkdownPipe, DatePipe],
  templateUrl: './ai-copilot.component.html',
  styleUrl: './ai-copilot.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiCopilotComponent implements OnInit, OnDestroy, AfterViewChecked {
  private destroy$ = new Subject<void>();
  private shouldScroll = false;
  private lastUserMessage = '';
  private currentRequest?: Subscription;

  @ViewChild('messagesEl') messagesEl!: ElementRef<HTMLElement>;
  @ViewChild('inputEl')    inputEl!:    ElementRef<HTMLTextAreaElement>;

  isOpen       = false;
  messages: ChatMessage[] = [];
  inputText    = '';
  isLoading    = false;
  // True for the whole request lifetime (send → final chunk/error/stop), unlike isLoading
  // which only covers the gap before the first chunk arrives (drives the typing dots).
  // Governs the send-vs-stop button swap and blocks starting a second concurrent request.
  isStreaming  = false;
  showNewBadge = false;
  showPulse    = false;

  // Scopes short-term server-side memory (see edunexify-ai/memory.py). A fresh
  // conversationId per "New chat" means fresh (empty) memory for that chat.
  conversationId = crypto.randomUUID();

  constructor(
    private aiService: AiCopilotService,
    private authState: AuthStateService,
    private cdr:       ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    if (!localStorage.getItem('edu_copilot_seen')) {
      this.showNewBadge = true;
      this.showPulse    = true;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) this.close();
  }

  // ── Derived user info ──────────────────────────────────────────────────────

  get firstName(): string {
    const name = this.authState.getUser()?.name;
    if (!name) return this.authState.getUser()?.userId ?? 'there';
    return name.split(' ')[0];
  }

  get userRole(): string {
    return this.authState.getUserRole();
  }

  get welcomeDesc(): string {
    if (this.userRole === 'STUDENT') {
      return 'Ask me about your fees, attendance, exam results, or anything else about your school.';
    }
    if (this.userRole === 'TEACHER') {
      return 'Ask me about your class, students, or how to use Edunexify features.';
    }
    return 'Ask me anything about school data or Edunexify features.';
  }

  get suggestedPrompts(): { icon: string; text: string }[] {
    if (this.userRole === 'STUDENT') {
      return [
        { icon: '🏆', text: 'How did I perform in my latest exam?' },
        { icon: '📅', text: 'What is my attendance this year?' },
        { icon: '💰', text: 'Do I have any pending fees?' },
        { icon: '📊', text: 'Give me a full overview of my progress' },
      ];
    }
    return [
      { icon: '💡', text: 'What can you help me with?' },
      { icon: '📚', text: 'Tell me about Edunexify features' },
    ];
  }

  // ── Panel open / close ─────────────────────────────────────────────────────

  toggle(): void {
    this.isOpen ? this.close() : this.open();
  }

  open(): void {
    this.isOpen       = true;
    this.showNewBadge = false;
    this.showPulse    = false;
    localStorage.setItem('edu_copilot_seen', '1');
    this.cdr.markForCheck();
    setTimeout(() => { this.inputEl?.nativeElement?.focus(); }, 340);
  }

  close(): void {
    this.isOpen = false;
    this.cdr.markForCheck();
  }

  clearChat(): void {
    this.messages        = [];
    this.lastUserMessage = '';
    this.conversationId  = crypto.randomUUID();
    this.cdr.markForCheck();
    setTimeout(() => this.inputEl?.nativeElement?.focus(), 50);
  }

  // ── Input handlers ─────────────────────────────────────────────────────────

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  onInput(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  // ── Messaging ──────────────────────────────────────────────────────────────

  sendMessage(text?: string): void {
    const content = (text ?? this.inputText).trim();
    if (!content || this.isStreaming) return;

    this.lastUserMessage = content;
    this.inputText       = '';

    if (this.inputEl?.nativeElement) {
      this.inputEl.nativeElement.style.height = 'auto';
    }

    this.messages = [
      ...this.messages,
      { id: `u_${Date.now()}`, role: 'user', content, timestamp: new Date(), error: false },
    ];
    this.isLoading    = true;
    this.isStreaming  = true;
    this.shouldScroll = true;
    this.cdr.markForCheck();

    // Populated on the first chunk that actually arrives, so the typing
    // indicator stays visible for any gap before generation starts (e.g. while
    // tool calls are resolving server-side — those never reach the client as
    // text, see routers/chat.py, so this bubble only appears once real content does).
    let assistantMsg: ChatMessage | null = null;
    let receivedSoFar = '';

    this.currentRequest = this.aiService.sendStream(content, this.conversationId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.DownloadProgress) {
          const partialText = (event as HttpDownloadProgressEvent).partialText ?? '';
          const delta = partialText.slice(receivedSoFar.length);
          receivedSoFar = partialText;
          if (!delta) return;

          if (!assistantMsg) {
            assistantMsg = { id: `a_${Date.now()}`, role: 'assistant', content: '', timestamp: new Date(), error: false };
            this.messages = [...this.messages, assistantMsg];
            this.isLoading = false;
          }
          assistantMsg.content += delta;
          this.shouldScroll = true;
          this.cdr.markForCheck();
          return;
        }

        if (event.type === HttpEventType.Response && !assistantMsg) {
          // Stream completed without ever emitting a DownloadProgress chunk
          // (can happen for a very short/instant reply) — show the full body now.
          const finalText = (event.body as string)?.trim();
          this.messages = [
            ...this.messages,
            {
              id: `a_${Date.now()}`,
              role: 'assistant',
              content: finalText || "I wasn't able to complete your request. Please try again.",
              timestamp: new Date(),
              error: false,
            },
          ];
          this.isLoading    = false;
          this.shouldScroll = true;
          this.cdr.markForCheck();
        }
      },
      error: () => {
        if (assistantMsg) {
          // Partial content already showing — keep it, and note the stream broke,
          // rather than discarding what the user has already read.
          assistantMsg.content += '\n\n⚠️ Connection lost — response may be incomplete.';
          assistantMsg.error = true;
        } else {
          this.messages = [
            ...this.messages,
            {
              id: `e_${Date.now()}`,
              role: 'assistant',
              content: 'Something went wrong. Please check your connection and try again.',
              timestamp: new Date(),
              error: true,
            },
          ];
        }
        this.isLoading    = false;
        this.isStreaming  = false;
        this.shouldScroll = true;
        this.cdr.markForCheck();
      },
      complete: () => {
        this.isLoading   = false;
        this.isStreaming = false;
        this.cdr.markForCheck();
      },
    });
  }

  /** User hit the stop button mid-stream. Cancels the underlying XHR — Spring/FastAPI
   * detect the dropped connection and stop pulling more tokens (see routers/chat.py's
   * is_disconnected() check). Whatever text already arrived stays in the bubble as-is. */
  stopGenerating(): void {
    this.currentRequest?.unsubscribe();
    this.currentRequest = undefined;
    this.isLoading    = false;
    this.isStreaming  = false;
    this.shouldScroll = true;
    this.cdr.markForCheck();
  }

  retry(): void {
    if (!this.lastUserMessage || this.isStreaming) return;
    this.messages = this.messages.slice(0, -1);
    this.sendMessage(this.lastUserMessage);
  }

  // ── Scroll ─────────────────────────────────────────────────────────────────

  trackById(_: number, msg: ChatMessage): string { return msg.id; }

  private scrollToBottom(): void {
    try {
      const el = this.messagesEl?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch { /* noop */ }
  }
}
