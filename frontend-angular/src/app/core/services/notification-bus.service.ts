import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Tiny pub/sub so pages can tell the header to refresh its unread count
 * without waiting for the 60-second poll. E.g. when a user clicks a row
 * in the Inbox to mark-as-read, we emit `refreshUnread()` and the bell
 * re-fetches immediately.
 */
@Injectable({ providedIn: 'root' })
export class NotificationBusService {
  private readonly refresh$ = new Subject<void>();
  readonly refresh = this.refresh$.asObservable();

  /** Tell listeners (the header) to re-query the unread count right now. */
  emitRefresh(): void {
    this.refresh$.next();
  }
}
