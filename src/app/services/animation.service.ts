import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AnimationFrame } from '../models/graph';

type PlaybackSpeed = 0.5 | 1 | 2 | 4;

@Injectable({ providedIn: 'root' })
export class AnimationService implements OnDestroy {
  private readonly framesSubject = new BehaviorSubject<AnimationFrame[]>([]);
  private readonly currentFrameIndexSubject = new BehaviorSubject<number>(-1);
  private readonly isPlayingSubject = new BehaviorSubject<boolean>(false);
  private readonly speedSubject = new BehaviorSubject<PlaybackSpeed>(1);

  readonly frames$ = this.framesSubject.asObservable();
  readonly currentFrameIndex$ = this.currentFrameIndexSubject.asObservable();
  readonly isPlaying$ = this.isPlayingSubject.asObservable();
  readonly speed$ = this.speedSubject.asObservable();

  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnDestroy(): void {
    this.stopTimer();
  }

  setFrames(frames: AnimationFrame[]): void {
    this.pause();
    this.framesSubject.next(frames);
    this.currentFrameIndexSubject.next(frames.length > 0 ? 0 : -1);
  }

  play(): void {
    const frames = this.framesSubject.value;
    if (frames.length === 0) return;

    let idx = this.currentFrameIndexSubject.value;
    if (idx >= frames.length - 1) {
      idx = 0;
      this.currentFrameIndexSubject.next(idx);
    }

    this.isPlayingSubject.next(true);
    this.startTimer();
  }

  pause(): void {
    this.isPlayingSubject.next(false);
    this.stopTimer();
  }

  stepForward(): void {
    const frames = this.framesSubject.value;
    if (frames.length === 0) return;

    const current = this.currentFrameIndexSubject.value;
    if (current < frames.length - 1) {
      this.currentFrameIndexSubject.next(current + 1);
    } else {
      this.pause();
    }
  }

  stepBack(): void {
    const frames = this.framesSubject.value;
    if (frames.length === 0) return;

    const current = this.currentFrameIndexSubject.value;
    if (current > 0) {
      this.currentFrameIndexSubject.next(current - 1);
    }
  }

  seek(index: number): void {
    const frames = this.framesSubject.value;
    if (frames.length === 0) return;

    const clamped = Math.max(0, Math.min(frames.length - 1, index));
    this.currentFrameIndexSubject.next(clamped);
  }

  setSpeed(speed: PlaybackSpeed): void {
    this.speedSubject.next(speed);
    if (this.isPlayingSubject.value) {
      this.stopTimer();
      this.startTimer();
    }
  }

  private startTimer(): void {
    this.stopTimer();
    const speed = this.speedSubject.value;
    const baseInterval = 1000;
    const interval = baseInterval / speed;

    this.timer = setInterval(() => {
      this.stepForward();
    }, interval);
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
