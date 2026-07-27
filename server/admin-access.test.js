import assert from "node:assert/strict";
import test from "node:test";
import { createAdminAccess } from "./admin-access.js";

function createRouteHarness() {
  const routes = new Map();
  const app = {
    get(path, handler) {
      routes.set(`GET ${path}`, handler);
    },
    post(path, handler) {
      routes.set(`POST ${path}`, handler);
    },
  };

  async function request(method, path, { body, cookie, forwardedProto } = {}) {
    const response = {
      headers: {},
      statusCode: 200,
      body: null,
      setHeader(name, value) {
        this.headers[name] = value;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(value) {
        this.body = value;
        return this;
      },
    };
    const handler = routes.get(`${method} ${path}`);
    assert.ok(handler, `missing route: ${method} ${path}`);
    await handler(
      {
        body,
        headers: {
          ...(cookie ? { cookie } : {}),
          ...(forwardedProto ? { "x-forwarded-proto": forwardedProto } : {}),
        },
        secure: false,
        socket: { remoteAddress: "127.0.0.1" },
      },
      response,
    );
    return response;
  }

  return { app, request };
}

function cookiePair(setCookie) {
  return String(setCookie).split(";")[0];
}

test("admin login creates a session that can be read and logged out", async () => {
  const { app, request } = createRouteHarness();
  const adminAccess = createAdminAccess({ password: "test-password" });
  adminAccess.registerRoutes(app);

  const login = await request("POST", "/api/admin/login", {
    body: { password: "test-password" },
  });
  assert.equal(login.statusCode, 200);
  assert.equal(login.body.authenticated, true);
  assert.match(login.headers["Set-Cookie"], /HttpOnly/);
  assert.match(login.headers["Set-Cookie"], /SameSite=Strict/);

  const cookie = cookiePair(login.headers["Set-Cookie"]);
  const session = await request("GET", "/api/admin/session", { cookie });
  assert.equal(session.body.ok, true);
  assert.equal(session.body.code, "OK");
  assert.deepEqual(session.body.data, {
    authenticated: true,
    expiresAt: login.body.expiresAt,
  });

  const logout = await request("POST", "/api/admin/logout", { cookie });
  assert.equal(logout.body.ok, true);
  assert.deepEqual(logout.body.data, { authenticated: false });
  assert.match(logout.headers["Set-Cookie"], /Max-Age=0/);

  const expiredSession = await request("GET", "/api/admin/session", { cookie });
  assert.equal(expiredSession.body.authenticated, false);
});

test("admin login rejects an invalid password without creating a cookie", async () => {
  const { app, request } = createRouteHarness();
  const adminAccess = createAdminAccess({ password: "test-password" });
  adminAccess.registerRoutes(app);

  const response = await request("POST", "/api/admin/login", {
    body: { password: "wrong-password" },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.ok, false);
  assert.equal(response.headers["Set-Cookie"], undefined);
});

test("admin middleware accepts only a valid session cookie", async () => {
  const { app, request } = createRouteHarness();
  const adminAccess = createAdminAccess({ password: "test-password" });
  adminAccess.registerRoutes(app);

  const deniedResponse = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
    },
  };
  let nextCalls = 0;
  adminAccess.requireAdminAccess(
    { headers: {} },
    deniedResponse,
    () => {
      nextCalls += 1;
    },
  );
  assert.equal(deniedResponse.statusCode, 401);
  assert.equal(nextCalls, 0);

  const login = await request("POST", "/api/admin/login", {
    body: { password: "test-password" },
  });
  adminAccess.requireAdminAccess(
    { headers: { cookie: cookiePair(login.headers["Set-Cookie"]) } },
    deniedResponse,
    () => {
      nextCalls += 1;
    },
  );
  assert.equal(nextCalls, 1);
});
