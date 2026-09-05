import {createServer} from 'vite';

// Intercept at the server as well as the page lifetime, including unload saves.
const server = await createServer({
  server: {host: '127.0.0.1', port: 5187, strictPort: true, open: false},
  plugins: [{
    name: 'browser-test-archive',
    configureServer(vite) {
      vite.middlewares.use((request, response, next) => {
        const path = new URL(request.url, 'http://localhost').pathname;
        if (!path.startsWith('/api/')) return next();
        const payload = path === '/api/status'
          ? {localArchive: true, initialized: true}
          : path === '/api/load'
            ? {artists: [
              {id: 'alpha', name: 'Alpha', tag: 'alpha', categories: []},
              ...Array.from({length: 5}, (_, i) => ({id: `sample-${i}`, name: `Sample ${i}`, tag: `sample_${i}`, categories: []})),
            ], categories: [], presets: [], theme: 'light', _localArchive: {initialized: true, imageIndex: {}}}
            : {success: true};
        request.resume();
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify(payload));
      });
    },
  }],
});
await server.listen();
