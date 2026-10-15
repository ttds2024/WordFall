import './style.css';
import './ui-android.css';
import './ui-ios.css';
import { startApp } from './app';
import { detectLanguage } from './i18n';
import { detectPlatform, detectUiStyle } from './platform';

document.documentElement.dataset.platform = detectPlatform();
document.documentElement.dataset.ui = detectUiStyle();
startApp(detectLanguage(navigator.languages));
