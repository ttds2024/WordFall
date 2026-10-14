import './style.css';
import { Game } from './game/game';
import { detectLanguage } from './i18n';

const canvas = document.querySelector<HTMLCanvasElement>('#field');
if (canvas) {
  const lang = detectLanguage(navigator.languages);
  document.documentElement.lang = lang;
  new Game(canvas, lang).start();
}
