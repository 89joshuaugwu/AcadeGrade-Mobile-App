module.exports = {
  extends: 'expo',
  ignorePatterns: ['node_modules/', '.expo/', 'dist/'],
  rules: {
    // React 19's new compiler rules are not compatible with this Expo/RN
    // codebase's established animation and subscription patterns yet.
    'react-hooks/set-state-in-effect': 'off',
    'react-hooks/immutability': 'off',
    'import/namespace': 'off',
  },
};
