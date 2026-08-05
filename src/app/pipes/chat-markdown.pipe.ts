import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Converts AI reply text to safe HTML with basic markdown:
 *  - **bold**  → <strong>
 *  - - item / • item → <ul><li>
 *  - 1. item → <ol><li>
 *  - blank lines → paragraph breaks
 */
@Pipe({ name: 'chatMarkdown', standalone: true, pure: true })
export class ChatMarkdownPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string | null | undefined): SafeHtml {
    if (!value) return this.sanitizer.bypassSecurityTrustHtml('');

    // 1. Escape HTML to prevent XSS (the text comes from the AI, not from users)
    let text = value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 2. Bold: **text**
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // 3. Process line by line to handle lists
    const lines = text.split('\n');
    const out: string[] = [];
    let listType: 'ul' | 'ol' | null = null;
    const listItems: string[] = [];

    const flushList = () => {
      if (listType && listItems.length) {
        out.push(`<${listType} class="cp-md-list">${listItems.join('')}</${listType}>`);
        listItems.length = 0;
        listType = null;
      }
    };

    for (const line of lines) {
      const bullet  = line.match(/^[-•*]\s+(.+)/);
      const ordered = line.match(/^\d+\.\s+(.+)/);

      if (bullet) {
        if (listType !== 'ul') { flushList(); listType = 'ul'; }
        listItems.push(`<li>${bullet[1]}</li>`);
      } else if (ordered) {
        if (listType !== 'ol') { flushList(); listType = 'ol'; }
        listItems.push(`<li>${ordered[1]}</li>`);
      } else {
        flushList();
        if (line.trim() === '') {
          if (out.length && out[out.length - 1] !== '<div class="cp-md-spacer"></div>') {
            out.push('<div class="cp-md-spacer"></div>');
          }
        } else {
          out.push(`<span class="cp-md-line">${line}</span>`);
        }
      }
    }
    flushList();

    return this.sanitizer.bypassSecurityTrustHtml(out.join(''));
  }
}
