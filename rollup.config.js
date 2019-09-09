import replace from 'rollup-plugin-replace'
import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import builtins from 'rollup-plugin-node-builtins'
import ts from 'rollup-plugin-typescript2'
import alias from 'rollup-plugin-alias'
import stripBanner from 'rollup-plugin-strip-banner'
import { terser } from 'rollup-plugin-terser'
import path from 'path'
import rimraf from 'rimraf'

const cwd = process.cwd()
// eslint-disable-next-line
const pkg = require(path.join(cwd, 'package.json'))

rimraf.sync(path.join(cwd, './dist'))

const banner = `/*!
  * ${pkg.name} v${pkg.version}
  * (c) ${new Date().getFullYear()} c8
  * @license Apache-2.0
  */`

const firstLetter = pkg.name[0]
const exportName = firstLetter !== '@' ? firstLetter.toUpperCase() + pkg.name.slice(1) : 'vuec8'

function createEntry(
  {
    format, // Rollup format (iife, umd, cjs, es)
    external, // Rollup external option
    input = 'src/index.ts', // entry point
    env = 'development', // NODE_ENV variable
    minify = false,
    isBrowser = false, // produce a browser module version or not
  } = {
    input: 'src/index.ts',
    env: 'development',
    minify: false,
    isBrowser: false,
  }
) {
  // force production mode when minifying
  if (minify) env = 'production'

  const config = {
    input,
    plugins: [
      replace({
        __VERSION__: pkg.version,
        'process.env.NODE_ENV': `'${env}'`,
      }),
      alias({
        resolve: ['.ts', '.js'],
        entries: [],
      }),
    ],
    output: {
      banner,
      file: `dist/${pkg.name}.UNKNOWN.js`,
      format,
      intro: 'var global = typeof self !== undefined ? self : this;',
    },
  }

  if (format === 'iife') {
    config.output.file = pkg.unpkg
    config.output.name = exportName
  } else if (format === 'es') {
    config.output.file = isBrowser ? pkg.browser : pkg.module
  } else if (format === 'cjs') {
    config.output.file = pkg.main
  }

  if (!external) {
    config.plugins.push(
      resolve({
        mainFields: ['module', 'main', 'browser'],
        preferBuiltins: true,
      }),
      commonjs(),
      builtins(),
      // avoid duplicated banners when reusing packages
      stripBanner({
        include: path.join(__dirname, './src/**/*.js'),
      })
    )
  } else {
    config.external = external
  }

  config.plugins.push(
    ts({
      // only check once, during the es version with browser (it includes external libs)
      check: format === 'es' && isBrowser && !minify,
      tsconfigOverride: {
        exclude: ['__tests__'],
        compilerOptions: {
          // same for d.ts files
          declaration: format === 'es' && isBrowser && !minify,
          target: format === 'es' && !isBrowser ? 'esnext' : 'es5',
        },
      },
    })
  )

  if (minify) {
    config.plugins.push(
      terser({
        module: format === 'es',
        output: {
          preamble: banner,
        },
      })
    )
    config.output.file = config.output.file.replace(/\.js$/i, '.min.js')
  }

  return config
}

const builds = [createEntry({ format: 'cjs' }), createEntry({ format: 'es', isBrowser: true })]

if (pkg.unpkg)
  builds.push(
    createEntry({ format: 'iife' }),
    createEntry({ format: 'iife', minify: true }),
    createEntry({ format: 'es', isBrowser: true, minify: true })
  )

export default builds
