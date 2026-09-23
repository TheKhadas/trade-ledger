import { Readable } from 'node:stream'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Serves the Vercel function at /api/verdict during `npm run dev`, so no Vercel CLI is needed.
// The API key is loaded into this Node process only; Vite never exposes non-VITE_ vars to the browser.
function apiDevServer() {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      if (env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY ??= env.ANTHROPIC_API_KEY

      server.middlewares.use('/api/verdict', async (req, res, next) => {
        try {
          const { POST } = await server.ssrLoadModule('/api/verdict.js')
          if (req.method !== 'POST') {
            res.writeHead(405, { allow: 'POST' }).end()
            return
          }
          const request = new Request(new URL(req.originalUrl, 'http://localhost'), {
            method: req.method,
            headers: { ...req.headers, 'x-forwarded-for': req.socket.remoteAddress ?? '' },
            body: Readable.toWeb(req),
            duplex: 'half',
          })
          const response = await POST(request)
          res.writeHead(response.status, Object.fromEntries(response.headers))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (err) {
          next(err)
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), apiDevServer()],
})
