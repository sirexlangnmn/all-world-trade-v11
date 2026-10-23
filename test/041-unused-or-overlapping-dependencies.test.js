const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

const root = path.resolve(__dirname, '..');
const packageJson = require(path.join(root, 'package.json'));
const serverSource = fs.readFileSync(path.join(root, 'app/src/server.js'), 'utf8');

test('removed direct dependencies are not declared and development tools stay in devDependencies', () => {
    for (const name of ['body-parser', 'cookie-session', 'method-override', 'passport', 'passport-local']) {
        assert.equal(packageJson.dependencies[name], undefined, `${name} must not be a runtime dependency`);
        assert.equal(packageJson.devDependencies[name], undefined, `${name} must not be a development dependency`);
    }

    assert.ok(packageJson.devDependencies.nodemon, 'npm run dev requires nodemon');
    assert.ok(packageJson.devDependencies['npm-check-updates']);
    assert.equal(packageJson.dependencies.nodemon, undefined);
    assert.equal(packageJson.dependencies['npm-check-updates'], undefined);
    assert.equal(packageJson.scripts.start, 'node app/src/server.js');
});

test('Express body parsers are configured once before the API routes', () => {
    assert.doesNotMatch(serverSource, /require\(['"]body-parser['"]\)|require\(['"]cookie-session['"]\)/);
    assert.equal((serverSource.match(/app\.use\(express\.urlencoded\(/g) || []).length, 1);
    assert.equal((serverSource.match(/app\.use\(express\.json\(/g) || []).length, 1);

    const urlencodedIndex = serverSource.indexOf('app.use(express.urlencoded({ extended: true }));');
    const jsonIndex = serverSource.indexOf('app.use(express.json());');
    const routesIndex = serverSource.indexOf("require('../routes/index.js')(app);");

    assert.notEqual(urlencodedIndex, -1);
    assert.notEqual(jsonIndex, -1);
    assert.notEqual(routesIndex, -1);
    assert.ok(urlencodedIndex < routesIndex);
    assert.ok(jsonIndex < routesIndex);
});

async function withParserServer(run) {
    const app = express();
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.post('/probe', (req, res) => res.status(200).json(req.body));
    app.use((error, req, res, next) => {
        if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
            return res.status(400).json({ status: 404, message: error.message });
        }
        return next(error);
    });

    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));

    try {
        await run(`http://127.0.0.1:${server.address().port}`);
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

test('JSON and nested URL-encoded request bodies are parsed as expected', async () => {
    await withParserServer(async (baseUrl) => {
        const jsonResponse = await fetch(`${baseUrl}/probe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'json-client' }),
        });

        assert.equal(jsonResponse.status, 200);
        assert.deepEqual(await jsonResponse.json(), { name: 'json-client' });

        const formResponse = await fetch(`${baseUrl}/probe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'profile%5Bname%5D=form-client',
        });

        assert.equal(formResponse.status, 200);
        assert.deepEqual(await formResponse.json(), { profile: { name: 'form-client' } });
    });
});

test('malformed JSON preserves the existing HTTP 400 error response shape', async () => {
    await withParserServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/probe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{"incomplete":',
        });

        assert.equal(response.status, 400);
        const body = await response.json();
        assert.equal(body.status, 404);
        assert.equal(typeof body.message, 'string');
    });
});
