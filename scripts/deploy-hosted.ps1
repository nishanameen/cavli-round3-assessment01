$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$env:WRANGLER_SEND_METRICS = 'false'
$env:WRANGLER_LOG_SANITIZE = 'true'
$env:WRANGLER_LOG_PATH = Join-Path (Get-Location) 'outputs\private\wrangler-deploy-hosted.log'
New-Item -ItemType Directory -Force -Path 'outputs\private' | Out-Null

node --env-file=.env --input-type=module -e "if (['GEMINI_API_KEY','CATALOG_TOKEN','DEMO_ACCESS_SECRET'].some(name => !process.env[name]?.trim())) process.exit(1)"
if ($LASTEXITCODE) { throw 'The .env file is missing one or more required secrets.' }

wrangler deploy --secrets-file .env
if ($LASTEXITCODE) { throw 'Cloudflare deployment failed. The hosted version was not verified.' }

$env:CAVLI_URL = 'https://cavli-assignment-1.nishanameenk.workers.dev'
node --env-file=.env scripts/verify-hosted.mjs
if ($LASTEXITCODE) { throw 'Hosted smoke checks failed. See outputs/hosted-verification.json.' }
