import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {execSync} from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readmePath = path.join(__dirname, '../README.md');
const packageJsonPath = path.join(__dirname, '../package.json');
const indexPath = path.join(__dirname, '../index.html');
const aboutPath = path.join(__dirname, '../public/about.html');

if (
  !fs.existsSync(readmePath) ||
  !fs.existsSync(packageJsonPath) ||
  !fs.existsSync(indexPath) ||
  !fs.existsSync(aboutPath)
) {
  console.error(
    'Error: Required files (README.md, package.json, index.html, or public/about.html) not found.'
  );
  process.exit(1);
}

const readmeContent = fs.readFileSync(readmePath, 'utf8');
let packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
let indexContent = fs.readFileSync(indexPath, 'utf8');
let aboutContent = fs.readFileSync(aboutPath, 'utf8');

// Helper to extract section content from markdown
function extractSection(content, headerName) {
  const lines = content.split('\n');
  let inSection = false;
  const sectionLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (
      line.startsWith('## ') ||
      line.startsWith('### ') ||
      line.startsWith('# ')
    ) {
      if (inSection) {
        break; // Reached next header
      }
      if (line.endsWith(headerName)) {
        inSection = true;
        continue;
      }
    }
    if (inSection) {
      if (line.startsWith('<!--') || line.startsWith('```')) {
        continue;
      }
      sectionLines.push(lines[i]);
    }
  }

  return sectionLines.join('\n').trim();
}

// 1. Extract Description
const descriptionRaw = extractSection(readmeContent, 'Description');
if (!descriptionRaw) {
  console.error('Error: Could not extract "Description" from README.md.');
  process.exit(1);
}

// 2. Extract Keywords
const keywordsRaw = extractSection(readmeContent, 'Keywords');
if (!keywordsRaw) {
  console.error('Error: Could not extract "Keywords" from README.md.');
  process.exit(1);
}

// Process keywords
const keywords = keywordsRaw
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean);

// Extract first paragraph of description
const descParagraph = descriptionRaw.split('\n')[0].trim();

// --- UPDATE package.json ---
const packageJson = JSON.parse(packageJsonContent);
packageJson.description = descParagraph;
packageJson.keywords = keywords;
const updatedPackageJson = JSON.stringify(packageJson, null, 2) + '\n';
fs.writeFileSync(packageJsonPath, updatedPackageJson, 'utf8');
console.log('Successfully updated description and keywords in package.json');

// --- UPDATE index.html ---
// The description's opening paragraphs (up to the music credit), for search
// results, link previews and the structured data
const webDescription = descriptionRaw
  .split(/\n\s*\n/)
  .map((p) => p.replace(/\s+/g, ' ').trim())
  .filter(Boolean)
  .slice(0, 2)
  .join(' ');
const escapeAttr = (text) =>
  text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const webDescriptionAttr = escapeAttr(webDescription);
const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'VideoGame',
  name: 'Chill Flight',
  url: 'https://chillflight.app/',
  image: 'https://chillflight.app/og-image.jpg',
  description: webDescription,
  genre: ['Flight simulator', 'Casual'],
  keywords: keywords.join(', '),
  gamePlatform: ['Web browser', 'iOS', 'Android'],
  playMode: ['SinglePlayer', 'MultiPlayer'],
  author: {'@type': 'Person', name: packageJson.author},
  sameAs: [
    'https://apps.apple.com/us/app/chill-flight/id6779847377',
    'https://play.google.com/store/apps/details?id=com.cowneck.chillflight',
  ],
};
const metaDescriptionHtml = [
  `    <meta name="description" content="${webDescriptionAttr}" />`,
  `    <meta property="og:description" content="${webDescriptionAttr}" />`,
  `    <meta name="twitter:description" content="${webDescriptionAttr}" />`,
  '    <script type="application/ld+json">',
  JSON.stringify(structuredData, null, 2).replace(/</g, '\\u003c'),
  '    </script>',
].join('\n');
const metaStartTag = '<!-- sync-start:description -->';
const metaEndTag = '<!-- sync-end:description -->';
const metaRegex = new RegExp(`${metaStartTag}[\\s\\S]*?${metaEndTag}`);

if (indexContent.includes(metaStartTag)) {
  indexContent = indexContent.replace(
    metaRegex,
    `${metaStartTag}\n${metaDescriptionHtml}\n    ${metaEndTag}`
  );
} else {
  // If tags don't exist, inject them before </head>
  indexContent = indexContent.replace(
    '</head>',
    `${metaStartTag}\n${metaDescriptionHtml}\n    ${metaEndTag}\n  </head>`
  );
}
fs.writeFileSync(indexPath, indexContent, 'utf8');
console.log(
  'Successfully updated description and structured data in index.html'
);

// --- UPDATE public/about.html ---
// Convert Description Raw to HTML
const descLines = descriptionRaw.split('\n');
let htmlDescription = '';
let inList = false;

for (let i = 0; i < descLines.length; i++) {
  const line = descLines[i].trim();
  if (!line) {
    continue;
  }

  // Check if it's a bullet point
  if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
    if (!inList) {
      htmlDescription += '        <ul>\n';
      inList = true;
    }
    // Remove bullet character and trim
    const cleanLine = line.substring(1).trim();
    const colonIndex = cleanLine.indexOf(':');
    if (colonIndex !== -1) {
      const title = cleanLine.substring(0, colonIndex).trim();
      const desc = cleanLine.substring(colonIndex + 1).trim();
      htmlDescription += `          <li><strong>${title}</strong>: ${desc}</li>\n`;
    } else {
      htmlDescription += `          <li>${cleanLine}</li>\n`;
    }
  } else {
    // If we were in a list, close it
    if (inList) {
      htmlDescription += '        </ul>\n';
      inList = false;
    }

    htmlDescription += `        <p>\n          ${line}\n        </p>\n`;
  }
}

if (inList) {
  htmlDescription += '        </ul>\n';
}

// Replace description text
const descStartTag = '<!-- sync-start:description -->';
const descEndTag = '<!-- sync-end:description -->';
const descRegex = new RegExp(`${descStartTag}[\\s\\S]*?${descEndTag}`);
aboutContent = aboutContent.replace(
  descRegex,
  `${descStartTag}\n${htmlDescription}        ${descEndTag}`
);

fs.writeFileSync(aboutPath, aboutContent, 'utf8');
console.log('Successfully updated description in public/about.html');

// Format the updated files using Prettier so they don't appear as unstaged changes later
console.log('Formatting synced files...');
try {
  execSync('npx prettier --write package.json index.html public/about.html', {
    stdio: 'inherit',
  });
  console.log('Formatting complete.');
} catch (error) {
  console.error('Failed to format synced files:', error.message);
}
