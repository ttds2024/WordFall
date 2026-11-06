import { createServer } from './app.ts';

const port = Number(process.env.PORT ?? 2567);

await createServer().listen(port, '0.0.0.0');
console.log(`WordFall server listening on :${port}`);
