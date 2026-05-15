# Fraud Dashboard

Real-time fraud detection dashboard powered by Fingerprint Pro.

## Quick Start

```bash
cp .env.example .env
npm install
npm run dev
```

## Fingerprint Pro Webhook Integration

The dashboard accepts live events from Fingerprint Pro via webhook.

### 1. Get your webhook secret

1. Log in to the [Fingerprint Pro dashboard](https://dashboard.fingerprint.com)
2. Go to **App Settings → Webhooks**
3. Click **Add webhook**
4. Copy the **Signing secret** shown after creation

### 2. Configure the secret locally

Add the secret to your `.env` file:

```
FPJS_SECRET_KEY=your_signing_secret_here
```

> If `FPJS_SECRET_KEY` is not set, signature validation is skipped (useful for local testing).

### 3. Enter the webhook URL in Fingerprint Pro

Set the webhook URL to:

```
http://yourserver.com/api/webhook/fingerprint
```

For local development with a tunnel (e.g., ngrok):

```bash
ngrok http 3001
# then use: https://<random>.ngrok.io/api/webhook/fingerprint
```

### 4. Test with a sample payload

Send a test event using curl:

```bash
curl -X POST http://localhost:3001/api/webhook/fingerprint \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "test-001",
    "timestamp": '"$(date +%s%3N)"',
    "visitorId": "test-visitor-abc",
    "products": {
      "identification": {
        "data": {
          "visitorId": "test-visitor-abc",
          "requestId": "test-001",
          "ip": "1.2.3.4",
          "visitorFound": true,
          "confidence": { "score": 0.99 },
          "incognito": false,
          "browserDetails": {
            "browserName": "Chrome",
            "os": "Windows",
            "device": "Desktop"
          },
          "ipLocation": {
            "city": { "name": "New York" },
            "country": { "code": "US" }
          }
        }
      },
      "botd": { "data": { "bot": { "result": "notDetected" } } },
      "vpn": { "data": { "result": false } },
      "proxy": { "data": { "result": false } },
      "tampering": { "data": { "result": false, "anomalyScore": 0 } },
      "virtualMachine": { "data": { "result": false } }
    }
  }'
```

A successful response returns `{"ok":true}`. The event appears immediately in the dashboard and the **Live** indicator turns green.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `FPJS_SECRET_KEY` | Fingerprint Pro webhook signing secret | *(none — skips validation)* |
| `PORT` | Port the API server listens on | `3001` |
