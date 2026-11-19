import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppNotice } from './components/app-notice/app-notice';
import { LoadingBar } from './components/loading-bar/loading-bar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppNotice, LoadingBar],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
