import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanWordList, Dictionary } from '../../src/core/dictionary.ts';
import type { Language } from '../../src/i18n/index.ts';

/** Where data/words_<lang>.txt live: DATA_DIR, else the repository's data/ folder. */
const DATA_DIR =
  process.env.DATA_DIR ?? fileURLToPath(new URL('../../data/', import.meta.url).href);

const loaded = new Map<Language, Promise<Dictionary>>();

/**
 * The word list for a language, cleaned exactly as the build cleans dict/<lang>.txt, so the
 * server accepts the same words the game does. Read once, then shared by every room.
 */
export function loadDictionary(lang: Language): Promise<Dictionary> {
  let dictionary = loaded.get(lang);
  if (!dictionary) {
    dictionary = readFile(join(DATA_DIR, `words_${lang}.txt`), 'utf8').then(
      (text) => new Dictionary(cleanWordList(text, lang)),
    );
    dictionary.catch(() => loaded.delete(lang));
    loaded.set(lang, dictionary);
  }
  return dictionary;
}
