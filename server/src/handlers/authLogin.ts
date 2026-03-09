import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getConfig } from '../lib/env';
import { handleError } from '../lib/responses';
import { verifyProvidersSig } from '../lib/providers';

/**
 * Serve the login HTML page
 * GET /auth/login?redirect=<callback_url>&destination=<path>&providers=<csv>&providers_sig=<hmac>
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {

  try {
    const config = getConfig();
    const title = config.loginPageTitle;

    // Verify HMAC signature on the providers query parameter.
    // The gateway signs providers + redirect with a shared secret so that
    // users cannot enable providers by tampering with the URL.
    const queryParams = event.queryStringParameters || {};
    const providersParam = queryParams.providers || '';
    const providersSig = queryParams.providers_sig || '';
    const redirect = queryParams.redirect || '';

    const verifiedProviders = verifyProvidersSig(
      providersParam,
      redirect,
      providersSig,
      config.providersSecret,
    );

    const showGoogle = verifiedProviders.includes('google') && !!config.googleClientId;
    const googleClientId = config.googleClientId;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
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
    .icon {
      font-size: 48px;
      margin-bottom: 16px;
      display: block;
    }
    h1 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .subtitle {
      font-size: 15px;
      color: #6e6e73;
      margin-bottom: 32px;
    }
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
    .btn-primary {
      background: #0071e3;
      color: #fff;
    }
    .btn-primary:hover:not(:disabled) { background: #0077ed; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .status {
      margin-top: 20px;
      font-size: 14px;
      min-height: 20px;
    }
    .status.loading { color: #6e6e73; }
    .status.success { color: #28a745; }
    .status.error { color: #d93025; }
    .divider {
      display: flex;
      align-items: center;
      margin: 24px 0;
      gap: 12px;
    }
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #d2d2d7;
    }
    .divider span {
      font-size: 13px;
      color: #86868b;
      font-weight: 500;
    }
    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
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
    <h1>${escapeHtml(title)}</h1>
    <p class="subtitle">${showGoogle ? 'Choose a sign-in method' : 'Sign in with your passkey'}</p>
    <button class="btn btn-primary" id="signInBtn" onclick="startLogin()">
      Sign in with Passkey
    </button>
    ${showGoogle ? `
    <div class="divider"><span>or</span></div>
    <div id="googleBtnContainer" style="display:flex;justify-content:center;"></div>
    ` : ''}
    <div class="status" id="statusMsg"></div>
  </div>

  ${showGoogle ? `<script src="https://accounts.google.com/gsi/client"></script>` : ''}
  <script src="https://unpkg.com/@simplewebauthn/browser/dist/bundle/index.umd.min.js"></script>
  <script>
    (function() {
      var params = new URLSearchParams(window.location.search);
      var redirect = params.get('redirect') || '';
      var destination = params.get('destination') || '';

      function setStatus(msg, cls) {
        var el = document.getElementById('statusMsg');
        el.textContent = msg;
        el.className = 'status ' + (cls || '');
      }

      function setLoading(loading) {
        var btn = document.getElementById('signInBtn');
        btn.disabled = loading;
        if (loading) {
          btn.innerHTML = '<span class="spinner"></span> Signing in\u2026';
        } else {
          btn.innerHTML = 'Sign in with Passkey';
        }
      }

      window.startLogin = async function() {
        setLoading(true);
        setStatus('');

        try {
          // Step 1: Get authentication options (challenge)
          var optionsRes = await fetch('/webauthn/authentication/options', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          });

          if (!optionsRes.ok) {
            throw new Error('Failed to get authentication options');
          }

          var options = await optionsRes.json();
          var challenge = options.challenge;

          setStatus('Please use your passkey\u2026', 'loading');

          // Step 2: Prompt user for passkey
          var assertion = await SimpleWebAuthnBrowser.startAuthentication(options);

          setStatus('Verifying\u2026', 'loading');

          // Step 3: Verify the assertion
          var verifyRes = await fetch('/webauthn/authentication/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assertion: assertion, challenge: challenge })
          });

          if (!verifyRes.ok) {
            var errData = await verifyRes.json().catch(function() { return {}; });
            var errMsg = (errData.error && errData.error.message) || 'Verification failed';
            throw new Error(errMsg);
          }

          var verifyData = await verifyRes.json();

          if (!verifyData.ok || !verifyData.code) {
            throw new Error('Verification did not return a valid code');
          }

          setStatus('Success! Redirecting\u2026', 'success');

          // Step 4: Redirect with the auth code
          if (redirect) {
            var dest = redirect + '?code=' + encodeURIComponent(verifyData.code);
            if (destination) {
              dest += '&destination=' + encodeURIComponent(destination);
            }
            window.location.href = dest;
          } else {
            setStatus('Signed in. Code: ' + verifyData.code, 'success');
            setLoading(false);
          }

        } catch (err) {
          console.error(err);
          var msg = (err && err.message) ? err.message : 'An error occurred';
          if (msg === 'The operation either timed out or was not allowed.' || msg.indexOf('NotAllowedError') !== -1) {
            msg = 'Passkey sign-in was cancelled or timed out.';
          }
          setStatus(msg, 'error');
          setLoading(false);
        }
      };
      ${showGoogle ? `
      // Initialize Google Identity Services and render the standard button
      google.accounts.id.initialize({
        client_id: '${escapeHtml(googleClientId)}',
        callback: handleGoogleResponse,
        auto_select: false,
      });

      google.accounts.id.renderButton(
        document.getElementById('googleBtnContainer'),
        {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'signin_with',
        }
      );

      async function handleGoogleResponse(response) {
        try {
          setStatus('Verifying\\u2026', 'loading');

          var verifyRes = await fetch('/auth/google/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idToken: response.credential,
              providers: params.get('providers') || '',
              providersSig: params.get('providers_sig') || '',
              redirect: redirect
            })
          });

          if (!verifyRes.ok) {
            var errData = await verifyRes.json().catch(function() { return {}; });
            var errMsg = (errData.error && errData.error.message) || 'Google verification failed';
            throw new Error(errMsg);
          }

          var verifyData = await verifyRes.json();

          if (!verifyData.ok || !verifyData.code) {
            throw new Error('Verification did not return a valid code');
          }

          setStatus('Success! Redirecting\\u2026', 'success');

          if (redirect) {
            var dest = redirect + '?code=' + encodeURIComponent(verifyData.code);
            if (destination) {
              dest += '&destination=' + encodeURIComponent(destination);
            }
            window.location.href = dest;
          } else {
            setStatus('Signed in. Code: ' + verifyData.code, 'success');
          }
        } catch (err) {
          console.error(err);
          var msg = (err && err.message) ? err.message : 'An error occurred';
          setStatus(msg, 'error');
        }
      }
      ` : ''}
    })();
  </script>
</body>
</html>`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-store'
      },
      body: html
    };

  } catch (error) {
    return handleError(error, 'auth_login');
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
