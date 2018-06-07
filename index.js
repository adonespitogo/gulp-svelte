'use strict';

const {compile} = require('svelte');
const inspectWithKind = require('inspect-with-kind');
const PluginError = require('plugin-error');
const replaceExt = require('replace-ext');
const {Transform} = require('stream');
const vinylSourcemapsApply = require('vinyl-sourcemaps-apply');
const path = require('path')

// getName copied from svelte-cli
// https://github.com/sveltejs/svelte-cli/blob/c4ce84f7dda71f0893fff1dfd5522c7509d56c2c/src/tasks/compile/index.js#L127
function getName(input) {
  return path
    .basename(input)
    .replace(path.extname(input), '')
    .replace(/[^a-zA-Z_$0-9]+/g, '_')
    .replace(/^_/, '')
    .replace(/_$/, '')
    .replace(/^(\d)/, '_$1');
}

module.exports = function gulpSvelte(...args) {
  const argLen = args.length;

  if (argLen > 1) {
    throw new PluginError('gulp-svelte', new RangeError(`Expected 0 or 1 argument (<Object>), but got ${argLen} arguments.`));
  }

  return new Transform({
    objectMode: true,
    transform(file, enc, cb) {
      if (!file || typeof file !== 'object' || typeof file.isNull !== 'function') {
        cb(new PluginError(
          'gulp-svelte',
          new TypeError(`Expected a Vinyl file object of a Svelte template, but got a non-Vinyl value ${
            inspectWithKind(file)
          }.`)
        ));
        return;
      }

      if (file.isNull()) {
        cb(null, file);
        return;
      }

      if (file.isStream()) {
        cb(new PluginError('gulp-svelte', 'Streaming not supported'));
        return;
      }

      let result;

      try {
        //result = compile(file.contents.toString(), Object.assign({filename: file.path}, ...args));
        result = compile(file.contents.toString(), Object.assign(
          {filename: file.path, name: file.path && getName(file.path)},
          ...args
        ));
      } catch (err) {
        if (file.path) {
          err.fileName = file.path;
        }

        cb(new PluginError('gulp-svelte', err));
        return;
      }

      if (file.path) {
        file.path = replaceExt(file.path, '.js');
        result.js.map.file = file.path;
      } else {
        result.js.map.file = '__no_filename__';
      }

      file.contents = Buffer.from(result.js.code);
      vinylSourcemapsApply(file.contents, result.js.map);

      cb(null, file);
    }
  });
};
