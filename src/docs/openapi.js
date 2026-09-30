const { baseUrl } = require('../config/env');
const { version, description } = require('../../package.json');

// OpenAPI 3 spec served by swagger-ui-express at GET /api/docs.
// Keep in sync with src/routes/* when endpoints change.

const errorResponse = (description) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

const unauthorized = errorResponse('Missing, malformed, invalid or expired JWT');
const rateLimited = {
  description: 'Rate limit exceeded',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/RateLimitError' } } },
};

const linkIdParam = {
  name: 'id',
  in: 'path',
  required: true,
  description: 'Link id (MongoDB ObjectId)',
  schema: { type: 'string', pattern: '^[a-f0-9]{24}$' },
};

// Shared 400/401/403/404 responses for the owner-only analytics endpoints
const ownerOnlyResponses = {
  400: errorResponse('Invalid link id or query parameters'),
  401: unauthorized,
  403: errorResponse('The link belongs to another user'),
  404: errorResponse('Link not found'),
};

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'LinkStat API',
    version,
    description: `${description}. Endpoints marked with a lock require a JWT: log in via \`POST /auth/login\`, then click **Authorize** and paste the \`accessToken\`.`,
  },
  servers: [{ url: baseUrl }],
  tags: [
    { name: 'Auth', description: 'Register and log in (JWT)' },
    { name: 'Links', description: 'Create and list short links (JWT required)' },
    { name: 'Analytics', description: 'Per-link click statistics (JWT required, owner only)' },
    { name: 'Redirect', description: 'Public short-link redirect' },
    { name: 'Health', description: 'Liveness check' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Validation failed' },
          details: {
            type: 'array',
            description: 'Present on 400 validation errors',
            items: {
              type: 'object',
              properties: { field: { type: 'string' }, message: { type: 'string' } },
            },
          },
        },
      },
      RateLimitError: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Too many requests' },
          message: { type: 'string' },
          retryAfter: { type: 'integer', description: 'Seconds until the window resets' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '66f1c0a2b3c4d5e6f7a8b9c0' },
          name: { type: 'string', example: 'Ada Lovelace' },
          email: { type: 'string', format: 'email', example: 'ada@example.com' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Link: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '66f1c0a2b3c4d5e6f7a8b9c1' },
          originalUrl: { type: 'string', format: 'uri', example: 'https://example.com/some/long/page' },
          shortCode: { type: 'string', example: 'aZ3kQ9x' },
          shortUrl: { type: 'string', format: 'uri', example: `${baseUrl}/aZ3kQ9x` },
          owner: { type: 'string' },
          clickCount: { type: 'integer', example: 42 },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Click: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          link: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          referrer: { type: 'string', nullable: true, description: 'null for direct visits' },
          userAgent: { type: 'string', nullable: true },
          ipAddress: { type: 'string', nullable: true },
        },
      },
      Stats: {
        type: 'object',
        properties: {
          linkId: { type: 'string' },
          totalClicks: { type: 'integer', example: 5 },
          clicksPerDay: {
            type: 'array',
            description: 'Clicks grouped by UTC calendar day, oldest first',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', example: '2026-09-29' },
                clicks: { type: 'integer', example: 3 },
              },
            },
          },
          topReferrers: {
            type: 'array',
            description: 'Up to 10 referrers by click count; "direct" = no Referer header',
            items: {
              type: 'object',
              properties: {
                referrer: { type: 'string', example: 'https://news.ycombinator.com/' },
                clicks: { type: 'integer', example: 2 },
              },
            },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: {
          200: {
            description: 'Service is up',
            content: { 'application/json': { example: { status: 'ok' } } },
          },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Create an account',
        description: 'Rate limited: 10 failed attempts per 15 minutes per IP across /auth/*.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string', maxLength: 100, example: 'Ada Lovelace' },
                  email: { type: 'string', format: 'email', example: 'ada@example.com' },
                  password: { type: 'string', minLength: 8, maxLength: 72, example: 'correct-horse-battery' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'User created',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } },
              },
            },
          },
          400: errorResponse('Validation failed'),
          409: errorResponse('Email is already registered'),
          429: rateLimited,
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in and receive a JWT',
        description: 'Rate limited: 10 failed attempts per 15 minutes per IP across /auth/*.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'ada@example.com' },
                  password: { type: 'string', example: 'correct-horse-battery' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Logged in',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    accessToken: { type: 'string' },
                    tokenType: { type: 'string', example: 'Bearer' },
                    expiresIn: { type: 'string', example: '1h' },
                  },
                },
              },
            },
          },
          400: errorResponse('Validation failed'),
          401: errorResponse('Invalid email or password'),
          429: rateLimited,
        },
      },
    },
    '/api/links': {
      post: {
        tags: ['Links'],
        summary: 'Shorten a URL',
        description: 'Rate limited: 20 requests per 15 minutes per IP.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['url'],
                properties: {
                  url: { type: 'string', format: 'uri', maxLength: 2048, example: 'https://example.com/some/long/page' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Short link created',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { link: { $ref: '#/components/schemas/Link' } } },
              },
            },
          },
          400: errorResponse('Not a valid http(s) URL'),
          401: unauthorized,
          429: rateLimited,
        },
      },
      get: {
        tags: ['Links'],
        summary: "List the caller's links (newest first)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Links owned by the caller',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { links: { type: 'array', items: { $ref: '#/components/schemas/Link' } } },
                },
              },
            },
          },
          401: unauthorized,
        },
      },
    },
    '/api/links/{id}/stats': {
      get: {
        tags: ['Analytics'],
        summary: 'Aggregated click stats for a link',
        description: 'Total clicks, clicks per UTC day and top referrers. Only the link owner may access it.',
        security: [{ bearerAuth: [] }],
        parameters: [linkIdParam],
        responses: {
          200: {
            description: 'Stats',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Stats' } } },
          },
          ...ownerOnlyResponses,
        },
      },
    },
    '/api/links/{id}/clicks': {
      get: {
        tags: ['Analytics'],
        summary: 'Paginated raw click log for a link (newest first)',
        security: [{ bearerAuth: [] }],
        parameters: [
          linkIdParam,
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        ],
        responses: {
          200: {
            description: 'A page of clicks',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    clicks: { type: 'array', items: { $ref: '#/components/schemas/Click' } },
                    pagination: {
                      type: 'object',
                      properties: {
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        total: { type: 'integer' },
                        totalPages: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
          ...ownerOnlyResponses,
        },
      },
    },
    '/{code}': {
      get: {
        tags: ['Redirect'],
        summary: 'Redirect to the original URL',
        description:
          'Public. Responds 302 (not 301) so every visit is recorded as a click. ' +
          'The `X-Cache: HIT|MISS` header shows whether the lookup was served from cache. ' +
          'Swagger UI follows redirects, so use curl to see the raw 302.',
        parameters: [
          {
            name: 'code',
            in: 'path',
            required: true,
            description: '7-character alphanumeric short code',
            schema: { type: 'string', pattern: '^[0-9A-Za-z]{7}$' },
          },
        ],
        responses: {
          302: {
            description: 'Redirect to the original URL',
            headers: {
              Location: { schema: { type: 'string', format: 'uri' } },
              'X-Cache': { schema: { type: 'string', enum: ['HIT', 'MISS'] } },
            },
          },
          404: errorResponse('Short link not found'),
        },
      },
    },
  },
};
