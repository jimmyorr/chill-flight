import {defineConfig} from 'vite';
import fs from 'fs';
import path from 'path';
import {transform} from 'esbuild';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        debug: 'debug.html',
      },
    },
  },
  plugins: [
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
        await bundleHtml('debug.html', 'debug-bundle.js');
      },
    },
  ],
});
