import './style.css';
import { detectLanguage, t } from './i18n';

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  const lang = detectLanguage(navigator.languages);
  document.documentElement.lang = lang;
  app.innerHTML = `<div><h1>${t(lang, 'title')}</h1><p>${t(lang, 'comingSoon')}</p></div>`;
}
