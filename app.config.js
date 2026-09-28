// Базовая конфигурация — в app.json. Здесь только значения, которые задаёт CI при сборке APK:
// номер сборки растёт с каждым запуском, чтобы новая версия ставилась поверх старой.
module.exports = ({ config }) => {
  const versionCode = Number(process.env.ANDROID_VERSION_CODE);
  if (!versionCode) return config;
  return {
    ...config,
    android: { ...config.android, versionCode },
  };
};
