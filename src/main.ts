import './style.css';
import { startApp } from './app';
import { detectLanguage } from './i18n';
import { detectPlatform } from './platform';

document.documentElement.dataset.platform = detectPlatform();
startApp(detectLanguage(navigator.languages));
