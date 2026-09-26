import {defineConfig, createLogger} from 'vite';
import fs from 'fs';
import path from 'path';
import {transform} from 'esbuild';
import {execSync} from 'child_process';

const logger = createLogger();
const originalWarn = logger.warn;
logger.warn = (msg, options) => {
  // Suppress built-in warning for classic scripts that are bundled manually in closeBundle()
  if (msg.includes('can\'t be bundled without type="module" attribute')) {
    return;
  }
  originalWarn(msg, options);
};

function getGitInfo(isBuild = false) {
  let commitHash = 'unknown';
  try {
    commitHash = execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    // fallback if git is unavailable
  }

  let isDirty = false;
  try {
    const status = execSync('git status --porcelain', {
      encoding: 'utf-8',
    });
    if (status.trim()) {
      const lines = status.split('\n').filter((l) => l.length > 0);
      const dirtyFiles = lines
        .map((line) => {
          const match = line.match(/^.. (.+)$/);
          if (!match) return line.trim();
          const filePath = match[1].trim();
          if (filePath.includes(' -> ')) {
            return filePath.split(' -> ')[1].trim();
          }
          return filePath;
        })
        .filter((file) => {
          // Always ignore build output directory
          if (file.startsWith('docs/')) return false;
          // During production builds, ignore files modified as part of the release workflow
          if (isBuild) {
            const releaseFiles = [
              'package.json',
              'package-lock.json',
              'RELEASE_NOTES.md',
            ];
            if (
              releaseFiles.includes(file) ||
              file.startsWith('ios/') ||
              file.startsWith('android/')
            ) {
              return false;
            }
          }
          return true;
        });
      isDirty = dirtyFiles.length > 0;
    }
  } catch {
    // fallback if git is unavailable
  }

  let version = '0.0.0';
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    version = pkg.version;
  } catch {
    // fallback
  }

  return {commitHash, isDirty, version};
}

export default defineConfig({
  customLogger: logger,
  base: './',
  server: {
    host: true,
  },
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        main: 'index.html',
        debug: 'debug.html',
        debugModels: 'debug-models.html',
      },
    },
  },
  plugins: [
    {
      name: 'dynamic-git-info',
      transformIndexHtml: {
        order: 'pre',
        handler(html, ctx) {
          const isBuild = !ctx.server;
          const {commitHash, isDirty, version} = getGitInfo(isBuild);
          return [
            {
              tag: 'script',
              children: `window.__APP_VERSION__ = ${JSON.stringify(version)};\nwindow.__COMMIT_HASH__ = ${JSON.stringify(commitHash)};\nwindow.__IS_DIRTY__ = ${JSON.stringify(isDirty)};`,
              injectTo: 'head-prepend',
            },
          ];
        },
      },
    },
    {
      name: 'bundle-classic-scripts',
      apply: 'build', // Only run during the production build
      enforce: 'post',
      async closeBundle() {
        const outDir = 'docs';

        const bundleHtml = async (htmlFileName, bundleName) => {
          const htmlPath = path.join(outDir, htmlFileName);
          if (!fs.existsSync(htmlPath)) return;

          let html = fs.readFileSync(htmlPath, 'utf-8');

          // Regex to find all local deferred scripts (excluding our Vite main.js module)
          const scriptRegex =
            /<script\s+defer\s+src="([^"]+?\.js)"><\/script>/g;
          const scripts = [];
          let match;
          while ((match = scriptRegex.exec(html)) !== null) {
            if (!match[1].startsWith('http') && !match[1].startsWith('/')) {
              scripts.push(match[1]);
            }
          }

          if (scripts.length === 0) return;

          console.log(
            `\n📦 Concatenating and minifying classic scripts for ${htmlFileName}...`
          );

          // Concatenate all script contents from the ROOT directory
          let combinedCode = '';
          for (const script of scripts) {
            const content = fs.readFileSync(script, 'utf-8');
            // Add a semicolon to prevent ASI issues between files
            combinedCode += '\n;\n' + content;
          }

          // Minify heavily using esbuild
          const minified = await transform(combinedCode, {
            minify: true,
            target: 'es2020',
          });

          // Write the optimized bundle
          fs.writeFileSync(path.join(outDir, bundleName), minified.code);
          console.log(
            `✓ Created ${bundleName} (${(minified.code.length / 1024).toFixed(2)} kb)`
          );

          // 1. Remove all matched script tags from the html
          scripts.forEach((script) => {
            html = html.replace(
              new RegExp(`<script\\s+defer\\s+src="${script}"></script>\\s*`),
              ''
            );
          });
          // 2. Insert the bundle before </body>
          html = html.replace(
            '</body>',
            `    <!-- Optimized Game Bundle -->\n    <script defer src="${bundleName}"></script>\n</body>`
          );
          fs.writeFileSync(htmlPath, html);
        };

        await bundleHtml('index.html', 'game-bundle.js');
        await bundleHtml('debug-models.html', 'debug-models-bundle.js');
      },
    },
  ],
});
