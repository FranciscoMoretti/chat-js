"""Compile current tracked ChatJS agents against the locally built #9 package."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import re

repo = Path(__file__).resolve().parents[2]
proof = Path(__file__).resolve().parent
sandbox = Path(tempfile.mkdtemp(prefix='eve080-compiler-'))
app = sandbox / 'apps/chat'
files = subprocess.check_output(['git', 'ls-files', 'apps/chat'], cwd=repo, text=True).splitlines()
for relative in files:
    source = repo / relative
    if source.is_file():
        target = sandbox / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
(app / 'next-env.d.ts').write_text('/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n')
modules = sandbox / 'node_modules'
modules.mkdir()
for source in (repo / 'node_modules').iterdir():
    if source.name not in ['eve', '.bin']:
        (modules / source.name).symlink_to(source, target_is_directory=source.is_dir())
# Install the packed contents inside the copied app topology. A symlink back to
# runtime/ would bind declarations to a second AI SDK peer tree.
shutil.copytree(proof / 'runtime/node_modules/eve', modules / 'eve', symlinks=False)
for source in (proof / 'runtime/node_modules').iterdir():
    if not (modules / source.name).exists() and source.name != '.bin':
        (modules / source.name).symlink_to(source, target_is_directory=source.is_dir())
manifest = json.loads((app / 'package.json').read_text())
manifest['dependencies']['eve'] = './candidate-eve.tgz'
(app / 'package.json').write_text(json.dumps(manifest, indent=2))
node = os.environ.get('EVE_TEST_NODE', 'node')
tsc = repo / 'node_modules/typescript/bin/tsc'
eve = modules / 'eve/bin/eve.js'
results = []
# Do not inherit app credentials or .env files. These are compiler-only fixtures.
env = {k: os.environ[k] for k in ['PATH', 'HOME', 'TMPDIR'] if k in os.environ}
env.update({'NODE_ENV': 'test', 'AUTH_SECRET': 'isolated-compiler-fixture-secret-000000000000', 'EVE_GATEWAY_SECRET': 'isolated-compiler-fixture-gateway-00000000000', 'DATABASE_URL': 'postgresql://postgres@127.0.0.1:1/unused', 'WORKFLOW_POSTGRES_URL': 'postgresql://postgres@127.0.0.1:1/unused'})
for name, relative in [('authenticated', '.'), ('guest', 'guest')]:
    config = {
        'extends': './tsconfig.json',
        'compilerOptions': {'incremental': False},
        'include': ['next-env.d.ts', f'{relative}/agent/**/*.ts'],
        'exclude': ['**/*.test.ts', '**/node_modules/**'],
    }
    config_path = app / f'tsconfig.proof-{name}.json'
    config_path.write_text(json.dumps(config))
    for kind, command, cwd in [
        ('types', [node, str(tsc), '--project', str(config_path), '--pretty', 'false'], app),
        ('build', [node, str(eve), 'build', '--skip-sandbox-prewarm'], app / relative),
    ]:
        run = subprocess.run(command, cwd=cwd, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=180)
        output = re.sub(r'\x1b\[[0-9;]*m', '', run.stdout).replace(str(sandbox), '<fixture>').replace(str(repo), '<repo>')
        (proof / f'{name}-{kind}.txt').write_text(output)
        results.append({'agent': name, 'check': kind, 'exit_code': run.returncode})
(proof / 'compiler-results.json').write_text(json.dumps({'chatjs_sha': subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip(), 'eve_sha': 'aab691297a59cc8c325b8f8c584a472495aed9ce', 'production_eve_pin_changed': False, 'eve': '0.80.1', 'typescript': '6.0.2', 'fixture': str(sandbox), 'checks': results}, indent=2) + '\n')
print(json.dumps(results))

command = [node, str(repo / 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'vitest.config.ts', 'lib/eve/model-ledger.test.ts', 'lib/eve/mcp-adapter.test.ts', 'app/api/eve/[...path]/route.test.ts']
run = subprocess.run(command, cwd=app, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=120)
output = re.sub(r'\x1b\[[0-9;]*m', '', run.stdout).replace(str(sandbox), '<fixture>').replace(str(repo), '<repo>')
(proof / 'targeted-tests.txt').write_text(output)
(proof / 'targeted-tests.json').write_text(json.dumps({'exit_code': run.returncode, 'files': command[-3:]}, indent=2) + '\n')
