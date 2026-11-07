'use strict';

/**
 * HTTP 事件适配层：
 * - 本地：node:http 直接监听 PORT（仅 `node handler.cjs` 时启动，require 不监听）；
 * - 云：SCF 事件函数（函数 URL / API Gateway 事件）导出 exports.main。
 *
 * 业务全部在 exchange.cjs；本文件只做请求校验、响应包装与脱敏。
 */

const http = require('node:http');
const exchange = require('./exchange.cjs');

const SERVICE_VERSION = '1.0.0';
const PROTOCOL_VERSION = 1;
const EXCHANGE_PATH = '/v1/auth/taptap/exchange';
const HEALTH_PATH = '/health';
const MAX_BODY_BYTES = 4096;
const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function jsonResponse(statusCode, body, extraHeaders) {
  return {
    statusCode,
    headers: { ...JSON_HEADERS, ...(extraHeaders || {}) },
    body: JSON.stringify(body),
    isBase64Encoded: false,
  };
}

function normalizeHeaders(headers) {
  const result = {};
  if (!headers || typeof headers !== 'object') return result;
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined || value === null) continue;
    result[String(key).toLowerCase()] = Array.isArray(value) ? String(value[0]) : String(value);
  }
  return result;
}

function normalizePath(path) {
  const raw = typeof path === 'string' && path.length > 0 ? path : '/';
  const queryIndex = raw.indexOf('?');
  let result = queryIndex >= 0 ? raw.slice(0, queryIndex) : raw;
  if (!result.startsWith('/')) result = `/${result}`;
  if (result.length > 1 && result.endsWith('/')) result = result.replace(/\/+$/, '');
  return result || '/';
}

function isJsonContentType(headers) {
  const contentType = headers['content-type'] || '';
  return contentType.split(';')[0].trim().toLowerCase() === 'application/json';
}

function bodyBufferOf(request) {
  if (Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === 'string') return Buffer.from(request.body, 'utf8');
  if (request.body instanceof Uint8Array) return Buffer.from(request.body);
  return null;
}

/**
 * 创建处理器（所有依赖显式注入，测试不依赖全局环境变量）。
 * @param {{env?: Record<string, string|undefined>, fetchImpl?: Function, now?: () => number, logger?: object}} deps
 */
function createApp(deps) {
  const options = deps && typeof deps === 'object' ? deps : {};
  const env = options.env && typeof options.env === 'object' ? options.env : process.env;
  const fetchImpl = typeof options.fetchImpl === 'function' ? options.fetchImpl : globalThis.fetch;
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const logger = options.logger;
  const configState = exchange.readConfig(env);

  function healthBody() {
    return {
      protocolVersion: PROTOCOL_VERSION,
      serviceVersion: SERVICE_VERSION,
      ready: configState.ok === true,
    };
  }

  async function handleExchange(request, headers) {
    if (!isJsonContentType(headers)) {
      return jsonResponse(400, { code: 'BAD_REQUEST' });
    }
    if (request.bodyTooLarge === true) {
      return jsonResponse(400, { code: 'BAD_REQUEST' });
    }
    const buffer = bodyBufferOf(request);
    if (!buffer || buffer.length === 0 || buffer.length > MAX_BODY_BYTES) {
      return jsonResponse(400, { code: 'BAD_REQUEST' });
    }
    let parsed;
    try {
      parsed = JSON.parse(buffer.toString('utf8'));
    } catch {
      return jsonResponse(400, { code: 'BAD_REQUEST' });
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return jsonResponse(400, { code: 'BAD_REQUEST' });
    }

    const result = await exchange.exchangeTapCode({
      code: parsed.code,
      env,
      fetchImpl,
      nowMs: now(),
      logger,
    });
    return jsonResponse(result.status, result.body);
  }

  async function handleRequest(request) {
    const method = String(request && request.method ? request.method : 'GET').toUpperCase();
    const path = normalizePath(request && request.path);
    const headers = normalizeHeaders(request && request.headers);

    if (path === HEALTH_PATH) {
      if (method !== 'GET') {
        return jsonResponse(405, { code: 'METHOD_NOT_ALLOWED' }, { Allow: 'GET' });
      }
      return jsonResponse(200, healthBody());
    }

    if (path === EXCHANGE_PATH) {
      if (method !== 'POST') {
        return jsonResponse(405, { code: 'METHOD_NOT_ALLOWED' }, { Allow: 'POST' });
      }
      return handleExchange(request || {}, headers);
    }

    return jsonResponse(404, { code: 'NOT_FOUND' });
  }

  /** SCF / API Gateway 事件适配。 */
  async function handleEvent(event) {
    const source = event && typeof event === 'object' ? event : {};
    const httpContext = source.requestContext && source.requestContext.http ? source.requestContext.http : null;
    const method = source.httpMethod || source.method || (httpContext && httpContext.method) || 'GET';
    const rawPath = source.path || source.rawPath || (httpContext && httpContext.path) || '/';
    const headers = source.headers || source.multiValueHeaders || {};
    let body = source.body;
    if (source.isBase64Encoded === true && typeof body === 'string') {
      body = Buffer.from(body, 'base64');
    }
    return handleRequest({ method, path: rawPath, headers, body });
  }

  return { handleRequest, handleEvent, healthBody, isReady: () => configState.ok === true };
}

/** SCF 事件函数入口。 */
async function main(event, context) {
  const app = createApp({});
  try {
    return await app.handleEvent(event, context);
  } catch {
    return jsonResponse(500, { code: 'INTERNAL_ERROR' });
  }
}

function readBody(req, limitBytes) {
  return new Promise((resolve) => {
    let size = 0;
    let settled = false;
    const chunks = [];
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > limitBytes) {
        finish({ tooLarge: true });
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => finish({ buffer: Buffer.concat(chunks) }));
    req.on('error', () => finish({ buffer: null }));
  });
}

function startLocalServer() {
  const port = Number(process.env.PORT || 8787);
  const app = createApp({});
  const server = http.createServer(async (req, res) => {
    const url = req.url || '/';
    const bodyResult = await readBody(req, MAX_BODY_BYTES);
    let response;
    try {
      response = await app.handleRequest({
        method: req.method,
        path: url,
        headers: req.headers,
        body: bodyResult.buffer,
        bodyTooLarge: bodyResult.tooLarge === true,
      });
    } catch {
      response = jsonResponse(500, { code: 'INTERNAL_ERROR' });
    }
    res.writeHead(response.statusCode, response.headers);
    res.end(response.body);
    if (bodyResult.tooLarge === true) req.destroy();
  });
  server.listen(port, () => {
    console.log(`[tap-auth] listening on :${port}`);
  });
  return server;
}

if (require.main === module) {
  startLocalServer();
}

module.exports = {
  SERVICE_VERSION,
  MAX_BODY_BYTES,
  createApp,
  main,
  startLocalServer,
};
