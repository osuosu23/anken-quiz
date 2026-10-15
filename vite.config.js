import { defineConfig } from 'vite';
import path from 'node:path';
import fs from 'node:fs';

export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'serve-root-data',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith('/data/')) {
            const cleanUrl = req.url.split('?')[0];
            const filePath = path.resolve(process.cwd(), '.' + cleanUrl);
            if (fs.existsSync(filePath)) {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              return fs.createReadStream(filePath).pipe(res);
            }
          }
          next();
        });
      },
      closeBundle() {
        // Build 時に data フォルダを dist/data にコピー
        const srcDir = path.resolve(process.cwd(), 'data');
        const destDir = path.resolve(process.cwd(), 'dist/data');
        if (fs.existsSync(srcDir)) {
          fs.mkdirSync(destDir, { recursive: true });
          const files = fs.readdirSync(srcDir);
          for (const file of files) {
            fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
          }
          console.log(`[vite] Copied ${files.length} data files to dist/data`);
        }
      }
    }
  ],
  server: {
    port: 5173,
    open: false
  }
});
