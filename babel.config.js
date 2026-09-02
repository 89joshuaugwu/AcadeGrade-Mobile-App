module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // Reanimated 4 moved the worklets transform into its own package —
    // 'react-native-reanimated/plugin' no longer exists as of v4; this is
    // now 'react-native-worklets/plugin', confirmed against Reanimated's
    // own v3→v4 migration docs. Must stay last in the array.
    plugins: ['react-native-worklets/plugin'],
  };
};
