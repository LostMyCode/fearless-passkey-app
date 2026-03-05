import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getConfig } from '../lib/env';
import { validateInviteToken } from '../lib/invite';
import { handleError } from '../lib/responses';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Serve the passkey registration page.
 * GET /register?token=<invite-token>
 * Returns 403 if the token is missing, invalid, or already used.
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const token = event.queryStringParameters?.token ?? '';

    if (!token) {
      return { statusCode: 403, headers: { 'Content-Type': 'text/plain' }, body: 'Invalid or missing invite token.' };
    }

    const valid = await validateInviteToken(token);
    if (!valid) {
      return { statusCode: 403, headers: { 'Content-Type': 'text/plain' }, body: 'This invite link is invalid or has already been used.' };
    }

    const config = getConfig();
    const title = config.loginPageTitle;
    const safeToken = escapeHtml(token);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Register — ${escapeHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #f5f5f7;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      color: #1d1d1f;
    }
    .card {
      background: #fff;
      border-radius: 18px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.10);
      padding: 48px 40px 40px;
      width: 100%;
      max-width: 400px;
      text-align: center;
    }
    .icon { font-size: 48px; margin-bottom: 16px; display: block; }
    h1 { font-size: 24px; font-weight: 600; margin-bottom: 8px; }
    .subtitle { font-size: 15px; color: #6e6e73; margin-bottom: 32px; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 14px 20px;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, opacity 0.15s;
    }
    .btn-primary { background: #0071e3; color: #fff; }
    .btn-primary:hover:not(:disabled) { background: #0077ed; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .status { margin-top: 20px; font-size: 14px; min-height: 20px; }
    .status.loading { color: #6e6e73; }
    .status.success { color: #28a745; }
    .status.error { color: #d93025; }
    .spinner {
      display: inline-block;
      width: 16px; height: 16px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <span class="icon">&#x1F511;</span>
    <h1>Register Passkey</h1>
    <p class="subtitle">Create a passkey for ${escapeHtml(title)}</p>
    <button class="btn btn-primary" id="registerBtn" onclick="startRegistration()">
      Create Passkey
    </button>
    <div class="status" id="statusMsg"></div>
  </div>

  <script src="https://unpkg.com/@simplewebauthn/browser/dist/bundle/index.umd.min.js"></script>
  <script>
    (function() {
      var TOKEN = '${safeToken}';

      function setStatus(msg, cls) {
        var el = document.getElementById('statusMsg');
        el.textContent = msg;
        el.className = 'status ' + (cls || '');
      }

      function setLoading(loading) {
        var btn = document.getElementById('registerBtn');
        btn.disabled = loading;
        btn.innerHTML = loading
          ? '<span class="spinner"></span> Creating\u2026'
          : 'Create Passkey';
      }

      window.startRegistration = async function() {
        setLoading(true);
        setStatus('');

        try {
          var optionsRes = await fetch('/webauthn/registration/options', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: TOKEN })
          });

          if (!optionsRes.ok) {
            var err = await optionsRes.json().catch(function() { return {}; });
            throw new Error((err.error && err.error.message) || 'Failed to get registration options');
          }

          var options = await optionsRes.json();
          var challenge = options.challenge;

          setStatus('Follow the prompt to create your passkey\u2026', 'loading');

          var attestation = await SimpleWebAuthnBrowser.startRegistration(options);

          setStatus('Verifying\u2026', 'loading');

          var verifyRes = await fetch('/webauthn/registration/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ attestation: attestation, challenge: challenge, token: TOKEN })
          });

          if (!verifyRes.ok) {
            var errData = await verifyRes.json().catch(function() { return {}; });
            throw new Error((errData.error && errData.error.message) || 'Verification failed');
          }

          setStatus('Passkey created successfully! You can now sign in.', 'success');
          document.getElementById('registerBtn').style.display = 'none';

        } catch (err) {
          console.error(err);
          var msg = (err && err.message) ? err.message : 'An error occurred';
          if (msg === 'The operation either timed out or was not allowed.' || msg.indexOf('NotAllowedError') !== -1) {
            msg = 'Passkey creation was cancelled or timed out.';
          }
          setStatus(msg, 'error');
          setLoading(false);
        }
      };
    })();
  </script>
</body>
</html>`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' },
      body: html
    };

  } catch (error) {
    return handleError(error, 'register_page');
  }
}
