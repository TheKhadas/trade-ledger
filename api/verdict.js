// Vercel serverless function: POST /api/verdict
// The Anthropic API key is read only here, from the ANTHROPIC_API_KEY environment variable.

import Anthropic from '@anthropic-ai/sdk'
import { createRateLimiter, handleVerdict } from '../server/verdict.js'

let client
const getClient = () => {
  if (!process.env.ANTHROPIC_API_KEY) return null
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 55_000, maxRetries: 1 })
  return client
}

// Lives as long as the function instance; best-effort protection, not a hard quota.
const rateLimit = createRateLimiter()

export function POST(request) {
  return handleVerdict(request, { getClient, rateLimit })
}
