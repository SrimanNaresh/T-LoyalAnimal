"""Deploy LoyalAnimal to 156.67.104.242 (loyalanimal.thangaminfotech.com).

  python scripts/deploy.py status     # what is running there for LoyalAnimal (read-only)
  python scripts/deploy.py deploy     # build, upload, npm ci, init-db, PM2 on port 5190, nginx site

Login: SSH key (DEPLOY_KEY=path) or password (DEPLOY_PASSWORD, else asked).
Nothing secret is stored in this file. The server's backend/.env is kept on
every deploy; it is only created from the local one the first time.

Only these are ever touched on the server: /opt/projects/loyalanimal, PM2
process "loyalanimal", port 5190 and the nginx site file "loyalanimal.conf".
"""
import getpass
import io
import os
import subprocess
import sys
import tarfile
import time

import paramiko

HOST = os.environ.get('DEPLOY_HOST', '156.67.104.242')
USER = os.environ.get('DEPLOY_USER', 'root')
APP_DIR = '/opt/projects/loyalanimal'
PM2_NAME = 'loyalanimal'
PORT = 5190
DOMAIN = 'loyalanimal.thangaminfotech.com'
SITE = 'loyalanimal.conf'
SITE_SRC = 'deploy/nginx-loyalanimal.conf'
DB_NAME = 'T_LoyalAnimal'

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = {'node_modules', '.env', 'dist', '.git', 'uploads', '__pycache__'}


def connect():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    key = os.environ.get('DEPLOY_KEY')
    if key:
        c.connect(HOST, username=USER, key_filename=key, timeout=20)
    else:
        pw = os.environ.get('DEPLOY_PASSWORD') or getpass.getpass(f'Password for {USER}@{HOST}: ')
        c.connect(HOST, username=USER, password=pw, timeout=20, look_for_keys=False, allow_agent=False)
    return c


def run(c, cmd, check=True, quiet=False):
    if not quiet:
        print(f'$ {cmd}')
    _, out, err = c.exec_command(cmd, get_pty=False)
    code = out.channel.recv_exit_status()
    o, e = out.read().decode(errors='replace'), err.read().decode(errors='replace')
    if not quiet and o.strip():
        print(o.rstrip())
    if code != 0:
        if e.strip():
            print(e.rstrip())
        if check:
            raise SystemExit(f'Command failed ({code}): {cmd}')
    return code, o


def add_tree(tar, src, arc):
    for base, dirs, files in os.walk(src):
        dirs[:] = [d for d in dirs if d not in SKIP]
        for f in files:
            if f in SKIP:
                continue
            full = os.path.join(base, f)
            tar.add(full, arcname=os.path.join(arc, os.path.relpath(full, src)).replace(os.sep, '/'))


def check_local_env():
    env = open(os.path.join(ROOT, 'backend', '.env'), encoding='utf-8').read()
    if f'DB_NAME={DB_NAME}' not in env:
        raise SystemExit(f'backend/.env must have DB_NAME={DB_NAME}')
    if f'PORT={PORT}' not in env:
        raise SystemExit(f'backend/.env must have PORT={PORT}')


def build_bundle():
    print('Building frontend ...')
    subprocess.run('npm run build', cwd=os.path.join(ROOT, 'frontend'), shell=True, check=True)
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode='w:gz') as tar:
        add_tree(tar, os.path.join(ROOT, 'backend'), 'backend')
        tar.add(os.path.join(ROOT, 'frontend', 'dist'), arcname='frontend/dist')
        add_tree(tar, os.path.join(ROOT, 'deploy'), 'deploy')
        add_tree(tar, os.path.join(ROOT, 'docs'), 'docs')
    buf.seek(0)
    return buf


def status(c):
    run(c, 'hostname; node -v; pm2 -v', check=False)
    run(c, f'pm2 describe {PM2_NAME} | head -20 || echo "PM2 {PM2_NAME}: not running"', check=False)
    run(c, f"ss -ltnp | grep -E ':{PORT}\\b' || echo 'port {PORT}: free'", check=False)
    run(c, f'ls -l /etc/nginx/sites-enabled/{SITE} 2>/dev/null || echo "nginx site {SITE}: not enabled"', check=False)
    run(c, f'curl -s -o /dev/null -w "local api %{{http_code}}\\n" http://127.0.0.1:{PORT}/api/health || true', check=False)


def install_nginx_site(c):
    """Adds or updates only our own site file. Puts the previous one back (or
    removes ours) if nginx rejects it, so other sites keep working."""
    live = f'/etc/nginx/sites-available/{SITE}'
    new = f'{APP_DIR}/{SITE_SRC}'
    code, _ = run(c, f'cmp -s {new} {live}', check=False, quiet=True)
    linked, _ = run(c, f'test -L /etc/nginx/sites-enabled/{SITE}', check=False, quiet=True)
    if code == 0 and linked == 0:
        return
    # Another site must not already answer for our domain.
    _, other = run(c, f"grep -rl 'server_name[^;]*{DOMAIN}' /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null | grep -v '/{SITE}$' || true", quiet=True)
    if other.strip():
        raise SystemExit(f'{DOMAIN} is already used by another nginx site:\n{other}')
    existed, _ = run(c, f'test -f {live}', check=False, quiet=True)
    if existed == 0:
        run(c, f'cp -a {live} {live}.bak')
    run(c, f'cp {new} {live} && ln -sf {live} /etc/nginx/sites-enabled/{SITE}')
    code, _ = run(c, 'nginx -t', check=False)
    if code != 0:
        print('nginx test failed: undoing the LoyalAnimal site change')
        if existed == 0:
            run(c, f'cp -a {live}.bak {live}')
        else:
            run(c, f'rm -f /etc/nginx/sites-enabled/{SITE} {live}')
        raise SystemExit(1)
    run(c, 'systemctl reload nginx')


def deploy(c):
    check_local_env()
    _, used = run(c, f"ss -ltnp | grep -E ':{PORT}\\b' || true", quiet=True)
    if used.strip() and PM2_NAME not in run(c, 'pm2 jlist', check=False, quiet=True)[1]:
        raise SystemExit(f'Port {PORT} is already used by something else on the server:\n{used}')
    bundle = build_bundle()
    stamp = time.strftime('%Y%m%d-%H%M%S')
    remote_tar = f'/tmp/loyalanimal-{stamp}.tgz'
    sftp = c.open_sftp()
    sftp.putfo(bundle, remote_tar)
    print(f'Uploaded {remote_tar}')
    run(c, f'mkdir -p {APP_DIR} && cd {APP_DIR} && rm -rf frontend/dist && tar -xzf {remote_tar} && rm -f {remote_tar}')
    code, _ = run(c, f'test -f {APP_DIR}/backend/.env', check=False, quiet=True)
    if code != 0:
        print('Creating server backend/.env from the local one (first deploy)')
        sftp.put(os.path.join(ROOT, 'backend', '.env'), f'{APP_DIR}/backend/.env')
        run(c, f'chmod 600 {APP_DIR}/backend/.env')
    sftp.close()
    run(c, f'cd {APP_DIR}/backend && npm ci --omit=dev --no-audit --no-fund')
    run(c, f'cd {APP_DIR}/backend && npm run init-db')
    run(c, f'cd {APP_DIR} && pm2 startOrReload deploy/ecosystem.config.cjs --update-env && pm2 save')
    time.sleep(3)
    run(c, f'curl -sf http://127.0.0.1:{PORT}/api/health')
    install_nginx_site(c)
    run(c, f'curl -sk -o /dev/null -w "https {DOMAIN} %{{http_code}}\\n" --resolve {DOMAIN}:443:127.0.0.1 https://{DOMAIN}/api/health', check=False)
    print('\n--- server status ---')
    status(c)
    print(f'\nDeployed: https://{DOMAIN} (API on 127.0.0.1:{PORT}, PM2 {PM2_NAME}).')


if __name__ == '__main__':
    action = sys.argv[1] if len(sys.argv) > 1 else 'status'
    fn = {'status': status, 'deploy': deploy}.get(action)
    if not fn:
        raise SystemExit(__doc__)
    client = connect()
    try:
        fn(client)
    finally:
        client.close()
