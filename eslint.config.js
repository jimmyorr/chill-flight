const globals = require("globals");
const js = require("@eslint/js");

module.exports = [
    js.configs.recommended,
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "script",
            globals: {
                ...globals.browser,
                THREE: "readonly",
                Sentry: "readonly",
                firebase: "readonly"
            }
        },
        rules: {
            "no-unused-vars": "warn",
            "no-undef": "warn"
        }
    },
    {
        ignores: ["node_modules/", "vendor/", "www/", "src-tauri/", "ios/", "android/"]
    }
];
