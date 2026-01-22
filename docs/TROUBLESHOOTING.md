# Troubleshooting Shipyard Community

This guide covers common setup and runtime issues. If you encounter a problem not listed here, please [open a GitHub issue](https://github.com/wsery558/shipyard-community/issues/new/choose) using the **Quickstart problem** template.

---

## 1. Node.js / pnpm Version Issues

**Symptom**: Installation fails with `ERR_UNSUPPORTED_NODE` or `fetch is not defined`.

**Solution**:
- Shipyard Community requires **Node.js 20+** and **pnpm 9+**
- Check versions:
  ```bash
  node --version  # Should show v20.x.x or higher
  pnpm --version  # Should show 9.x.x or higher
  ```
- **Upgrade Node**: Use [nvm](https://github.com/nvm-sh/nvm) (Linux/macOS) or download from [nodejs.org](https://nodejs.org/)
  ```bash
  nvm install 20
  nvm use 20
  ```
- **Upgrade pnpm**:
  ```bash
  npm install -g pnpm@latest
  ```
- After upgrading, retry:
  ```bash
  pnpm install
  pnpm build
  ```

---

## 2. Windows / WSL Path Recommendations

**Symptom**: Installation or runtime errors on Windows (WSL).

**Solution**:
- **Use WSL2** (not WSL1) for better compatibility
- **Clone in Linux filesystem**, not Windows mount:
  ```bash
  # ✅ Good: Linux filesystem
  cd ~
  git clone https://github.com/wsery558/shipyard-community.git
  
  # ❌ Bad: Windows mount (slower, permission issues)
  cd /mnt/c/Users/YourName/
  ```
- **Verify WSL version**:
  ```powershell
  wsl --list --verbose
  ```
  If using WSL1, upgrade:
  ```powershell
  wsl --set-version Ubuntu 2
  ```
- **Install build tools** (if missing):
  ```bash
  sudo apt update
  sudo apt install -y build-essential python3
  ```

---

## 3. node-pty Build Errors (Optional Dependency)

**Symptom**: `node-pty` compilation fails during `pnpm install`.

**Context**: `node-pty` is an optional dependency for terminal emulation. If it fails to build, core functionality still works.

**Solution A (Recommended)**: Skip native modules:
```bash
DISABLE_PTY=1 pnpm install
```

**Solution B**: Install build dependencies:
```bash
# Ubuntu/Debian
sudo apt install -y build-essential python3

# macOS
xcode-select --install

# Then retry
pnpm install
```

**Note**: If `node-pty` build fails, you'll see warnings but installation should complete. The server will disable terminal-dependent features gracefully.

---

## 4. Port Already in Use

**Symptom**: Server fails to start with `EADDRINUSE` or `port 8788 already in use`.

**Solution**:
- **Check default port** (8788):
  ```bash
  lsof -i :8788  # Linux/macOS
  netstat -ano | findstr :8788  # Windows
  ```
- **Use a different port**:
  ```bash
  PORT=3100 pnpm start
  ```
- **Kill existing process** (if needed):
  ```bash
  # Find PID from lsof output, then:
  kill -9 <PID>
  ```
- **Environment variable persistence**: Add to `.env` (if using one):
  ```bash
  echo "PORT=3100" >> .env
  ```

---

## 5. Smoke Test / Polite Audit Verification

**Purpose**: Verify your setup is correct before reporting issues.

### Run Smoke Test
```bash
pnpm test:smoke
```

**Expected output**:
```
✅ Health check: OK
✅ State endpoint: OK
✅ Projects endpoint: OK
Smoke test PASSED
```

**If smoke test fails**:
1. Check server is running: `curl http://127.0.0.1:8788/health`
2. Verify port: `lsof -i :8788` (should show `node` process)
3. Check logs in terminal where `pnpm start` is running
4. Copy full error output when reporting issue

### Run Polite Audit (Open-Source Readiness)
```bash
pnpm audit:open
# OR directly:
bash scripts/polite_audit.sh
```

**Expected output**:
```
════════════════════════════════════════════════
  ✅ POLITE AUDIT PASSED
  Repository is ready for OSS release
════════════════════════════════════════════════
```

**If audit fails**:
- Check which specific check failed (build artifacts, emails, secrets, docs)
- Verify you're on a clean branch: `git status`
- If reporting an issue, include full audit output

### Reporting Setup Problems

When opening a GitHub issue using the [Quickstart problem template](https://github.com/wsery558/shipyard-community/issues/new?template=quickstart_problem.yml):

**Include**:
1. **OS and version**: e.g., Ubuntu 22.04, macOS 14, Windows 11 (WSL2)
2. **Node version**: `node --version`
3. **pnpm version**: `pnpm --version`
4. **Smoke test output**: Full output of `pnpm test:smoke`
5. **Error logs**: If server fails to start, include terminal output
6. **Steps to reproduce**: What commands did you run?

**Do NOT include**:
- Secrets or API keys
- Full dependency tree (`pnpm list` output is too verbose)

---

## Still Stuck?

- **GitHub Discussions**: [Community Q&A](https://github.com/wsery558/shipyard-community/discussions)
- **GitHub Issues**: [Report a bug](https://github.com/wsery558/shipyard-community/issues/new/choose)
- **Email**: tsaielectro0628@gmail.com (for security concerns, use [docs/SECURITY.md](SECURITY.md) guidance)

When reporting issues, always include:
- Output of `pnpm test:smoke`
- Output of `bash scripts/polite_audit.sh`
- Your OS, Node version, and pnpm version
