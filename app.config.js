// Базовая конфигурация — в app.json. Здесь только значения, которые задаёт CI:
// - ANDROID_VERSION_CODE: номер сборки APK растёт с каждым запуском, чтобы новая версия ставилась поверх старой;
// - WEB_BASE_URL: подпапка сайта (например, /Traning-App на GitHub Pages).
module.exports = ({ config }) => {
  const versionCode = Number(process.env.ANDROID_VERSION_CODE);
  const baseUrl = process.env.WEB_BASE_URL;
  return {
    ...config,
    ...(versionCode ? { android: { ...config.android, versionCode } } : {}),
    ...(baseUrl ? { experiments: { ...config.experiments, baseUrl } } : {}),
  };
};
