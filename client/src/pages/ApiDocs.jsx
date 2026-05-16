const DEMO_KEY = 'demo_key_12345';

const EVENT_TYPES = [
  { type: 'login',           icon: '🔑', desc: 'User authentication attempt' },
  { type: 'signup',          icon: '✨', desc: 'New account registration' },
  { type: 'payment',         icon: '💳', desc: 'Payment or transaction processed' },
  { type: 'password_change', icon: '🔒', desc: 'Password or credential change' },
  { type: 'api_call',        icon: '⚡', desc: 'Programmatic API access' },
  { type: 'export',          icon: '📤', desc: 'Data export request' },
  { type: 'settings_change', icon: '⚙️',  desc: 'Account settings modified' },
];

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001';

const SNIPPETS = {
  curl: `curl -X POST ${BASE_URL}/api/ingest \\
  -H "Content-Type: application/json" \\
  -d '{
    "account_id": "user123",
    "event_type": "login",
    "timestamp": ${Date.now()},
    "ip_address": "203.0.113.42",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "metadata": { "success": true, "country": "DE" },
    "api_key": "${DEMO_KEY}"
  }'`,

  nodejs: `const response = await fetch('${BASE_URL}/api/ingest', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    account_id: 'user123',
    event_type: 'login',
    timestamp: Date.now(),
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
    metadata: { success: true, country: 'DE' },
    api_key: '${DEMO_KEY}',
  }),
});
const result = await response.json();`,

  python: `import requests, time

response = requests.post('${BASE_URL}/api/ingest', json={
    'account_id': 'user123',
    'event_type': 'login',
    'timestamp': int(time.time() * 1000),
    'ip_address': '203.0.113.42',
    'user_agent': request.headers.get('User-Agent'),
    'metadata': {'success': True, 'country': 'DE'},
    'api_key': '${DEMO_KEY}',
})
result = response.json()`,

  php: `<?php
$payload = [
    'account_id' => 'user123',
    'event_type' => 'login',
    'timestamp'  => round(microtime(true) * 1000),
    'ip_address' => $_SERVER['REMOTE_ADDR'],
    'user_agent' => $_SERVER['HTTP_USER_AGENT'],
    'metadata'   => ['success' => true, 'country' => 'DE'],
    'api_key'    => '${DEMO_KEY}',
];

$ch = curl_init('${BASE_URL}/api/ingest');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
$result = json_decode(curl_exec($ch), true);
curl_close($ch);`,
};

const PAYMENT_SNIPPETS = {
  card: `curl -X POST ${BASE_URL}/api/ingest \\
  -H "Content-Type: application/json" \\
  -d '{
    "account_id": "user123",
    "event_type": "payment",
    "timestamp": ${Date.now()},
    "ip_address": "203.0.113.42",
    "metadata": {
      "card_last4": "4242",
      "card_bin": "424242",
      "amount": 99.99,
      "currency": "USD",
      "status": "success"
    },
    "api_key": "${DEMO_KEY}"
  }'`,

  paypal: `curl -X POST ${BASE_URL}/api/ingest \\
  -H "Content-Type: application/json" \\
  -d '{
    "account_id": "user456",
    "event_type": "payment",
    "timestamp": ${Date.now()},
    "ip_address": "203.0.113.99",
    "metadata": {
      "paypal_email": "buyer@example.com",
      "amount": 49.00,
      "currency": "EUR",
      "status": "success"
    },
    "api_key": "${DEMO_KEY}"
  }'`,
};

import { useState } from 'react';

export default function ApiDocs() {
  const [activeTab, setActiveTab] = useState('curl');
  const [paymentTab, setPaymentTab] = useState('card');

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">API Integration</h1>
          <p className="page-subtitle">Send account activity events from any SaaS product to FraudShield</p>
        </div>
      </div>

      {/* Demo key banner */}
      <div className="card" style={{ marginBottom: 20, borderColor: 'var(--blue)' }}>
        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 22 }}>🔑</span>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 2 }}>Demo API Key (pre-generated for testing)</div>
            <code style={{
              fontFamily: 'monospace', fontSize: 15, color: 'var(--blue)',
              background: 'var(--sidebar)', padding: '3px 8px', borderRadius: 4,
            }}>{DEMO_KEY}</code>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Endpoint reference */}
        <div className="card">
          <div className="card-header"><span className="card-title">Endpoint</span></div>
          <div style={{ padding: '14px 18px' }}>
            <div style={{ marginBottom: 14 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 7px', borderRadius: 3,
                background: '#22c55e22', color: '#22c55e', marginRight: 8,
              }}>POST</span>
              <code style={{ fontFamily: 'monospace', fontSize: 13 }}>/api/ingest</code>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
              All fields use JSON. Required fields are marked with *.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { field: 'account_id*', type: 'string', desc: 'Your internal user/account identifier' },
                { field: 'event_type*', type: 'string', desc: 'One of the supported event types below' },
                { field: 'api_key*',    type: 'string', desc: 'Your FraudShield API key' },
                { field: 'timestamp',   type: 'integer', desc: 'Unix ms (defaults to now if omitted)' },
                { field: 'ip_address',  type: 'string', desc: 'Client IP address' },
                { field: 'user_agent',  type: 'string', desc: 'Browser or client user agent string' },
                { field: 'metadata',    type: 'object', desc: 'Any extra key/value data (amount, country…)' },
              ].map(({ field, type, desc }) => (
                <div key={field} style={{
                  display: 'grid', gridTemplateColumns: '140px 60px 1fr', gap: 8,
                  padding: '7px 10px', background: 'var(--sidebar)', borderRadius: 6,
                  border: '1px solid var(--border)', fontSize: 12,
                }}>
                  <code style={{ color: field.endsWith('*') ? 'var(--blue)' : 'var(--text2)', fontFamily: 'monospace' }}>{field}</code>
                  <span style={{ color: 'var(--text3)' }}>{type}</span>
                  <span style={{ color: 'var(--text2)' }}>{desc}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--sidebar)', borderRadius: 6, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Success response</div>
              <code style={{ fontFamily: 'monospace', fontSize: 12, color: '#22c55e' }}>{"{ \"success\": true, \"message\": \"Event ingested\" }"}</code>
            </div>
          </div>
        </div>

        {/* Event types */}
        <div className="card">
          <div className="card-header"><span className="card-title">Supported Event Types</span></div>
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {EVENT_TYPES.map(({ type, icon, desc }) => (
              <div key={type} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 10px', background: 'var(--sidebar)', borderRadius: 6, border: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
                <div>
                  <code style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)' }}>{type}</code>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Code snippets */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header"><span className="card-title">Code Snippets</span></div>
        <div style={{ padding: '0 18px 18px' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {['curl', 'nodejs', 'python', 'php'].map(lang => (
              <button
                key={lang}
                onClick={() => setActiveTab(lang)}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)',
                  background: activeTab === lang ? 'var(--blue)' : 'var(--sidebar)',
                  color: activeTab === lang ? '#fff' : 'var(--text2)',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                }}
              >
                {lang === 'nodejs' ? 'Node.js' : lang.charAt(0).toUpperCase() + lang.slice(1)}
              </button>
            ))}
          </div>
          <pre style={{
            background: 'var(--sidebar)', border: '1px solid var(--border)', borderRadius: 8,
            padding: 16, fontSize: 12, lineHeight: 1.6, overflowX: 'auto',
            color: 'var(--text2)', fontFamily: 'monospace', margin: 0,
          }}>
            {SNIPPETS[activeTab]}
          </pre>
        </div>
      </div>

      {/* Payment event examples */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <span className="card-title">Payment Event Examples</span>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Used for payment connection detection</span>
        </div>
        <div style={{ padding: '0 18px 18px' }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14, marginTop: 14 }}>
            Payment events accept card or PayPal metadata. FraudShield detects when multiple accounts share the same payment method — a strong signal of synthetic identity fraud or account linking.
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {[
              { key: 'card',   label: '💳  Card (last4 + BIN)' },
              { key: 'paypal', label: '🅿️  PayPal email' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPaymentTab(key)}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)',
                  background: paymentTab === key ? '#22c55e22' : 'var(--sidebar)',
                  color: paymentTab === key ? '#22c55e' : 'var(--text2)',
                  borderColor: paymentTab === key ? '#22c55e' : 'var(--border)',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <pre style={{
            background: 'var(--sidebar)', border: '1px solid var(--border)', borderRadius: 8,
            padding: 16, fontSize: 12, lineHeight: 1.6, overflowX: 'auto',
            color: 'var(--text2)', fontFamily: 'monospace', margin: 0,
          }}>
            {PAYMENT_SNIPPETS[paymentTab]}
          </pre>

          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { field: 'card_last4', type: 'string', desc: 'Last 4 digits of the card number' },
              { field: 'card_bin',   type: 'string', desc: 'First 6 digits (Bank Identification Number)' },
              { field: 'paypal_email', type: 'string', desc: 'PayPal account email address' },
              { field: 'amount',     type: 'number', desc: 'Transaction amount' },
              { field: 'currency',   type: 'string', desc: 'ISO 4217 currency code (USD, EUR…)' },
              { field: 'status',     type: 'string', desc: 'Transaction status (success, failed…)' },
            ].map(({ field, type, desc }) => (
              <div key={field} style={{
                display: 'grid', gridTemplateColumns: '130px 56px 1fr', gap: 8,
                padding: '7px 10px', background: 'var(--sidebar)', borderRadius: 6,
                border: '1px solid var(--border)', fontSize: 12,
              }}>
                <code style={{ color: 'var(--text2)', fontFamily: 'monospace' }}>{field}</code>
                <span style={{ color: 'var(--text3)' }}>{type}</span>
                <span style={{ color: 'var(--text2)' }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
