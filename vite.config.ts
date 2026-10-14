import { existsSync, readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { cleanWordList } from './src/core/dictionary.ts';
import type { Language } from './src/i18n/index.ts';

const LANGUAGES: Language[] = ['en', 'ru'];
const source = (lang: Language) => `data/words_${lang}.txt`;
const available = LANGUAGES.filter((lang) => existsSync(source(lang)));

/**
 * Serves and emits dict/<lang>.txt: the cleaned, sorted word list built from
 * data/words_<lang>.txt, for each language whose list exists.
 */
function dictionaries(): Plugin {
  const cache = new Map<Language, string>();
  const build = (lang: Language) => {
    if (!cache.has(lang)) {
      cache.set(lang, cleanWordList(readFileSync(source(lang), 'utf8'), lang).join('\n'));
    }
    return cache.get(lang)!;
  };
  return {
    name: 'wordfall-dictionaries',
    configureServer(server) {
      for (const lang of available) {
        server.middlewares.use(`/dict/${lang}.txt`, (_req, res) => {
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end(build(lang));
        });
      }
    },
    generateBundle() {
      for (const lang of available) {
        this.emitFile({ type: 'asset', fileName: `dict/${lang}.txt`, source: build(lang) });
      }
    },
  };
}

// Relative base so the build works from any GitHub Pages sub-path.
export default defineConfig({
  base: './',
  define: {
    __DICTIONARIES__: JSON.stringify(available),
  },
  plugins: [dictionaries()],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
