// Babel config for the Expo app. expo-router's Babel transform ships inside
// babel-preset-expo (SDK 50+), so no separate router plugin entry is needed.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
