# WordFall: мультиплеер-сервер

Сервер на [Colyseus](https://colyseus.io/) 0.18 для матчей на 2–4 игрока. Каждый играет на своём
поле, а сервер:

- ведёт общий отсчёт: 3 секунды до старта, потом раунд на 2 минуты (`ROUND_MS` из игры);
- проверяет каждое слово по тому же словарю, что и игра (`data/words_<lang>.txt`, очищенный
  тем же `cleanWordList`);
- считает очки по правилам игры (`src/core/scoring.ts`): 100 за букву, ×2 за каждую тыкву ×2;
- засчитывает каждое слово один раз, тому, кто нашёл его первым (как в игре против бота);
- раздаёт общий `seed` раунда: клиент может генерировать буквы от него, чтобы у всех они
  совпадали.

Код логики общий с игрой: сервер импортирует `src/core` и типы протокола из
`src/online/protocol.ts`, ничего не копирует. Клиентская часть живёт в `src/online/match.ts`.

## Подключение игры

Игра показывает в меню «Играть онлайн» и «Играть с другом», если при сборке задан адрес сервера:

- **GitHub Pages:** в репозитории откройте **Settings → Secrets and variables → Actions →
  Variables** и добавьте `MULTIPLAYER_URL` со значением `wss://play.example.ru`. Следующий деплой
  покажет кнопки.
- **Локально:** положите в корень репозитория `.env.local` со строкой
  `VITE_MULTIPLAYER_URL=ws://localhost:2567`, запустите сервер (`cd server && npm run dev`) и
  игру (`npm run dev`). Откройте <http://localhost:5173/> в двух окнах (второе можно в режиме
  инкогнито) и нажмите «Играть онлайн» в обоих.

## Как это устроено

| Файл                         | Что внутри                                                               |
| ---------------------------- | ------------------------------------------------------------------------ |
| `src/room.ts`                | Комната `wordfall`: подбор игроков, фазы раунда, реванш, переподключение |
| `src/match.ts`               | Проверка и подсчёт слова, общий список найденных слов                    |
| `src/state.ts`               | Состояние, которое Colyseus синхронизирует с клиентами                   |
| `src/dictionaries.ts`        | Загрузка словарей (один раз на процесс)                                  |
| `src/app.ts`, `src/index.ts` | Создание сервера и запуск на `PORT` (по умолчанию 2567)                  |

### Комнаты

- **Быстрая игра:** `joinOrCreate('wordfall', { lang: 'ru', seats: 2, name })` сводит
  игроков с одинаковыми языком и числом мест (`seats`: 2–4).
- **С друзьями:** `create('wordfall', { lang: 'ru', private: true, name })` создаёт закрытую
  комнату с кодом из 6 символов (`room.roomId`, например `K7QX2M`). Друг входит через
  `joinById(code, { name })`.
- Раунд начинается, когда заняты все места. После старта комната закрыта для новых игроков.
- Если игрок отвалился во время раунда, его место держится 20 секунд
  (`client.reconnect(room.reconnectionToken)`).
- После раунда каждый может отправить `rematch`. Когда его отправили все, кто остался
  (минимум двое), начинается новый раунд с новым `seed`.

### Состояние (`room.state`)

| Поле            | Значение                                                                  |
| --------------- | ------------------------------------------------------------------------- |
| `phase`         | `waiting` → `countdown` → `playing` → `finished`                          |
| `timeLeftMs`    | Сколько осталось до старта или до конца раунда; обновляется раз в секунду |
| `seed`          | Seed букв текущего раунда                                                 |
| `lang`, `seats` | Язык и число мест                                                         |
| `players`       | Map `sessionId` → `{ name, score, words, connected, rematch }`            |

### Сообщения

| Направление     | Тип       | Данные                                                                                                |
| --------------- | --------- | ----------------------------------------------------------------------------------------------------- |
| клиент → сервер | `submit`  | `{ letters: 'К★Т', doubles: 1 }`: буквы в порядке нажатия (`★` для звезды) и сколько из них ×2        |
| клиент → сервер | `rematch` | без данных                                                                                            |
| сервер → игроку | `verdict` | `{ ok: true, word, points }` или `{ ok: false, reason: 'invalid' \| 'short' \| 'unknown' \| 'used' }` |
| сервер → всем   | `found`   | `{ sessionId, word, points }`: слово занято, другим его уже не засчитают                              |

### Пример клиента

Игра уже подключена (`src/online/match.ts`). Пример нужен, если вы пишете другой клиент.

```ts
import { Client } from '@colyseus/sdk';

const client = new Client('wss://play.example.ru');
const room = await client.joinOrCreate('wordfall', { lang: 'ru', name: profile?.name });

room.onStateChange((state) => {
  // state.phase, state.timeLeftMs, state.players…
});
room.onMessage('found', ({ sessionId, word }) => tracker.markUsed(word));
room.onMessage('verdict', (v) => (v.ok ? showScore(v.points) : showReason(v.reason)));

room.send('submit', { letters: 'КОТ', doubles: 0 });
```

### Что сервер не проверяет

Сервер не знает, какие буквы были на поле у игрока: каждый играет на своём поле с физикой. Он
проверяет, что слово есть в словаре, ещё не найдено, звёзд в нём не больше одной, а тыкв ×2 не
больше, чем букв. Чтобы ещё и сверять буквы, клиент должен брать их из генератора с общим `seed`,
а сервер должен повторять ту же последовательность. Это следующий шаг, если появятся читеры.

## Разработка

```bash
cd server
npm install
npm run dev     # сервер на ws://localhost:2567 с перезапуском при изменениях
npm run check   # проверка типов и тесты
npm run build   # сборка в dist/index.mjs
```

### Локальная проверка

В одном терминале запустите сервер (`npm run dev`), в другом сыграйте короткий матч двумя
тестовыми игроками в закрытой комнате:

```bash
npm run smoke
```

Скрипт печатает код комнаты, seed и ответ сервера на каждое слово. Тот же скрипт проверяет
сервер на VPS после деплоя:

```bash
npm run smoke -- wss://play.example.ru
```

## Деплой на VPS

Подойдёт любой VPS в России (Timeweb Cloud, Selectel, Beget, REG.RU): Ubuntu 24.04,
1 vCPU, 1–2 ГБ RAM. Этого хватает на сотни одновременных матчей. Схема: Docker Compose
поднимает сервер и [Caddy](https://caddyserver.com/), который сам получает и продлевает
сертификат Let's Encrypt. Игра со страницы `https://` может подключаться только по `wss://`,
поэтому HTTPS обязателен.

### 1. Домен

Заведите поддомен, например `play.example.ru`, и создайте A-запись с IP вашего VPS. Проверить:

```bash
dig +short play.example.ru
```

### 2. Docker на сервере

Подключитесь по SSH и поставьте Docker из репозитория Ubuntu (он доступен из России без
зеркал):

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
```

```bash
sudo usermod -aG docker $USER && newgrp docker
```

Docker Hub из России часто недоступен. Если `docker pull node:22-alpine` не проходит,
добавьте зеркало, например `mirror.gcr.io` (у Timeweb есть своё: `dockerhub.timeweb.cloud`),
и перезапустите Docker:

```bash
echo '{ "registry-mirrors": ["https://mirror.gcr.io"] }' | sudo tee /etc/docker/daemon.json
```

```bash
sudo systemctl restart docker
```

### 3. Файрвол

Откройте SSH, HTTP (нужен Caddy для выпуска сертификата) и HTTPS:

```bash
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable
```

### 4. Запуск

```bash
git clone https://github.com/ttds2024/WordFall.git && cd WordFall/server
```

```bash
cp .env.example .env && nano .env   # DOMAIN=play.example.ru
```

```bash
docker compose up -d --build
```

Сборка займёт пару минут. Проверьте, что всё поднялось:

```bash
docker compose ps
```

```bash
curl -i https://play.example.ru/
```

Должен прийти ответ `200`. Логи смотрите так:

```bash
docker compose logs -f server
```

Если сертификат не выпускается, проверьте `docker compose logs caddy`. Обычно причина в том,
что A-запись ещё не обновилась или порт 80 закрыт.

### 5. Обновление

```bash
cd ~/WordFall && git pull && cd server && docker compose up -d --build
```

При остановке контейнер получает SIGTERM. Сервер аккуратно закрывает комнаты, но идущие матчи
обрываются, поэтому обновляйтесь, когда игроков мало.

### Без Docker Compose

Образ собирается из корня репозитория, потому что серверу нужны `src/core` и `data/`:

```bash
docker build -f server/Dockerfile -t wordfall-server .
```

```bash
docker run -d --restart unless-stopped -p 2567:2567 --name wordfall wordfall-server
```

TLS тогда настраивается отдельно (nginx и certbot, или балансировщик облака), с проксированием
WebSocket на порт 2567.

### Настройки

| Переменная | По умолчанию                               | Значение                                  |
| ---------- | ------------------------------------------ | ----------------------------------------- |
| `PORT`     | `2567`                                     | Порт сервера внутри контейнера            |
| `DATA_DIR` | `data/` репозитория (в образе `/app/data`) | Папка с `words_<lang>.txt`                |
| `DOMAIN`   | —                                          | Домен для Caddy, задаётся в `server/.env` |

### Персональные данные

Сервер ничего не пишет на диск. Имена игроков живут в памяти, пока открыта комната. Если
позже появятся рейтинги или профили, храните их на сервере в России: этого требует 152-ФЗ.
