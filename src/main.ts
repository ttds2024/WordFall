import './style.css';
import { startApp } from './app';
import { detectLanguage } from './i18n';
import { detectPlatform, isMobile } from './platform';

const platform = detectPlatform();
document.documentElement.dataset.platform = platform;
// Chooses the background picture: tall for phones and tablets, wide for computers.
document.documentElement.dataset.device = isMobile(
  platform,
  navigator.userAgent,
  navigator.maxTouchPoints,
)
  ? 'mobile'
  : 'desktop';
startApp(detectLanguage(navigator.languages));
