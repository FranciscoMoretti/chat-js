"""Apply the proposed policy patch only to a fresh disposable candidate fixture."""
import json
from pathlib import Path
import re
import subprocess
import sys

proof = Path(__file__).resolve().parent
repo = proof.parents[1]
checkpoint = json.loads(Path(sys.argv[1]).read_text())
fixture = Path(checkpoint['fixture'])
patch = proof / 'candidate-response-policy.patch'
subprocess.run(['git', 'apply', '--check', str(patch)], cwd=fixture, check=True)
subprocess.run(['git', 'apply', str(patch)], cwd=fixture, check=True)
run = subprocess.run([sys.argv[2], str(repo / 'node_modules/typescript/bin/tsc'), '--project', str(fixture / 'apps/chat/tsconfig.proof-authenticated.json'), '--pretty', 'false'], cwd=fixture, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=120)
output = run.stdout.replace(str(fixture), '<fixture>').replace(str(repo), '<repo>')
(proof / 'candidate-adapter-types.txt').write_text(output)
(proof / 'candidate-adapter-results.json').write_text(json.dumps({
    'eve_sha': checkpoint['eve_sha'],
    'chatjs_sha': checkpoint['chatjs_sha'],
    'patch': patch.name,
    'exit_code': run.returncode,
    'diagnostics': len(re.findall('error TS', output)),
    'remaining_approval_diagnostics': [line for line in output.splitlines() if 'error TS' in line and any(name in line for name in ['delete-document/tool', 'tools/chatjs/tools', 'agent/tools/mcp.ts'])],
}, indent=2) + '\n')
