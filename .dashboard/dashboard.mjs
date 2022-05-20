import { createServer } from "node:http";
import createRouter from 'find-my-way';
import path from 'node:path';
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const router = createRouter({
  defaultRoute(req, res) {
    res.statusCode = 404;
    res.setHeader('Content-type', 'text/html');
    res.write(
      fs.readFileSync(
        path.resolve(__dirname, 'errors', '404.html')
      )
    );
    res.end();
  }
});

router.on('GET', '/', (_req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-type', 'text/html');
  res.write(
    fs.readFileSync(
      path.resolve(__dirname, 'index.html')
    )
  );
  res.end();
});

router.on('GET', '/global.css', (_req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-type', 'text/css');
  res.write(
    fs.readFileSync(
      path.resolve(__dirname, 'global.css')
    )
  );
  res.end();
});



const interceptedRequests = [];

/**
 * @type {import('../src/core/http/interceptors').HTTPResponseInterceptor}
 */
const requestInspector = {
  name: 'Dashboard request analyzer',
  interceptWhen: 'always',
  interceptor(res, req) {
    interceptedRequests.push({
      req, res
    });
    return res;
  }
};

/**
 * @type { import('../src/core/http/server').HttpServer}
 */
const spark = (await (await import('../dist/main.js')).default).http;

spark.handlers.forEach(h => {
  h.addResponseInterceptor(requestInspector);
});

router.on('GET', '/api/status', (req, res) => {
  const status = {
    memory : (process.memoryUsage().rss / 1024 / 1024 * 100) / 100,
    routes : spark.routes.length,
  };
  res.setHeader('Content-Type', 'application/json');
  res.write(JSON.stringify(status))
  res.end();
});

router.on('GET', '/api/requests', (req, res) => {
  const body = JSON.stringify(
    interceptedRequests.map(i => {
      return {
        req: {
          ...i.req,
          provide: undefined
        },
        res: {
          ...i.res.asJSON()
        }
      }
    })
  );
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.write(body);
  res.end();
});

router.on('GET', '/api/routes', (req, res) => {
  const body = JSON.stringify(
    spark.routes.map(r => ({
      method: r.method,
      url: r.url,
      schema: {
        headers: r.headers,
        body: r.body?.shape,
        files: r.files,
        cookies: r.cookies,
        urlParams: r.urlParams,
        queryParams: r.queryParams,
      },
      interceptors: {
        request: [...r.requestInterceptor],
        response: [...r.responseInterceptor],
      },
      guards: [...r.guards],
    }))
  );

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.write(body);
  res.end();
});

const app = createServer(router.lookup.bind(router));

app.listen(23976);

app.on('listening', () => {
  console.log("🔥 Spark: Dashboard\n - access it at http://localhost:23976");
});