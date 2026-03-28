# insomnia-plugin-k6-translator

This plugin adds a simple UI inside Insomnia to translate the current workspace collection into a k6 script.

The plugin itself is only a UI wrapper.  
Actual translation is performed by the external CLI tool:

`https://github.com/KirillRg/cli-tool`

## Features

- translate the current Insomnia workspace to k6
- configure load profile in UI
- export current Insomnia collection and pass it to the CLI tool

## Requirements

Before using this plugin, you must:

1. build or download the CLI tool from:
   `https://github.com/KirillRg/cli-tool`
2. set the path to the CLI executable in `main.js`

Example:

```js
const CLI_PATH = 'C:\\path\\to\\k6-translator.exe';
