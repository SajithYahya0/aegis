import js from '@eslint/js';
import ts from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
    {ignores:['**/dist/**','**/.next/**','**/node_modules/**']},
    js.configs.recommended,
    ...ts.configs.recommended,
    {
        files:['**/*.{ts,tsx}'],
        plugins:{
            'react-hooks': reactHooks,
        },
        rules:reactHooks.configs.recommended.rules,
    },
];