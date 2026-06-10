import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-animation-controls',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './animation-controls.component.html',
  styleUrl: './animation-controls.component.scss'
})
export class AnimationControlsComponent {
  @Input() currentFrame = 0;
  @Input() totalFrames = 0;
  @Input() isPlaying = false;
  @Input() speed = 1;

  @Output() play = new EventEmitter<void>();
  @Output() pause = new EventEmitter<void>();
  @Output() stepForward = new EventEmitter<void>();
  @Output() stepBack = new EventEmitter<void>();
  @Output() seek = new EventEmitter<number>();
  @Output() changeSpeed = new EventEmitter<number>();

  speedOptions = [0.5, 1, 2, 4];

  onSeek(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.seek.emit(Number(input.value));
  }

  onSpeedChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.changeSpeed.emit(Number(select.value));
  }

  get progressPercent(): number {
    if (this.totalFrames <= 1) return 0;
    return (this.currentFrame / (this.totalFrames - 1)) * 100;
  }
}
