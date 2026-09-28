// Доводит результат `expo export --platform web` до сайта для GitHub Pages:
// подставляет базовый путь в HTML/манифест и добавляет 404.html, чтобы работали прямые ссылки на экраны.
// Запуск: WEB_BASE_URL=/Traning-App node scripts/finalize-web.mjs dist
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.argv[2] ?? 'dist';
const base = (process.env.WEB_BASE_URL ?? '').replace(/\/+$/, '');

for (const file of ['index.html', 'manifest.webmanifest']) {
  const path = join(dist, file);
  if (!existsSync(path)) throw new Error(`Не найден ${path} — сначала выполните expo export`);
  writeFileSync(path, readFileSync(path, 'utf8').replaceAll('%BASE_URL%', base));
}

// GitHub Pages отдаёт 404.html для неизвестных путей — это то же приложение, роутер откроет нужный экран.
copyFileSync(join(dist, 'index.html'), join(dist, '404.html'));
// Папка _expo начинается с подчёркивания — отключаем обработку Jekyll.
writeFileSync(join(dist, '.nojekyll'), '');

console.log(`Веб-версия готова: ${dist} (базовый путь: ${base || '/'})`);
