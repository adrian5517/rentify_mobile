module.exports = {
  root: true,
  extends: ['expo', 'eslint:recommended', 'plugin:react/recommended'],
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // Relax some rules that are noisy for this project and block build flow
    'react/no-unescaped-entities': 'off',
    'no-dupe-keys': 'warn',
    'import/namespace': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
  },
};
