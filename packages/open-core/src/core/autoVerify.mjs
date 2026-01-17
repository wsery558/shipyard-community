/**
 * Auto-Verify - automatic verification command detection and execution
 * 
 * Features:
 * - Detect project-specific verify commands from projects.json config
 * - Default detection based on package.json (pnpm test/build)
 * - Run verification commands sequentially
 * - Capture results (exit code, duration, output tail)
 * - WS_SMOKE=1 friendly (fast stubs)
 */

import fs from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { registerArtifact, cleanupArtifacts } from './artifactManager.mjs';

/**
 * Detect verification commands for a project
 * @param {string} projectPath - absolute path to project directory
 * @param {object} projectConfig - project config from projects.json (may have verifyCmds)
 * @returns {string[]} - array of verification commands
 */
export function detectVerifyCmds(projectPath, projectConfig = {}) {
  // Explicit config takes precedence
  if (projectConfig.verifyCmds && Array.isArray(projectConfig.verifyCmds)) {
    return projectConfig.verifyCmds.slice(0, 3); // max 3
  }

  // Default detection: check for package.json
  const pkgPath = path.join(projectPath, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return []; // No package.json, no default verify
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const scripts = pkg.scripts || {};
    
    const cmds = [];
    
    // Check for test script
    if (scripts.test && scripts.test !== 'echo "Error: no test specified" && exit 1') {
      cmds.push('pnpm -s test');
    }
    
    // Check for build script
    if (scripts.build) {
      cmds.push('pnpm -s build');
    }

    return cmds.slice(0, 3); // max 3
  } catch (err) {
    console.error('detectVerifyCmds error reading package.json:', err);
    return [];
  }
}

/**
 * Run a single verification command
 * @param {string} cmd - shell command to run
 * @param {string} cwd - working directory
 * @param {number} timeoutMs - max execution time (default 60s)
 * @returns {Promise<object>} - { cmd, exitCode, durationMs, stdout, stderr }
 */
async function runVerifyCmd(cmd, cwd, timeoutMs = 60000) {
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const proc = spawn('bash', ['-c', cmd], {
      cwd,
      env: { ...process.env, WS_SMOKE: '1' }, // Force fast mode
      shell: false
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timeout = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');
      setTimeout(() => proc.kill('SIGKILL'), 1000);
    }, timeoutMs);

    proc.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', (exitCode) => {
      clearTimeout(timeout);
      const durationMs = Date.now() - startTime;
      
      // Trim output to last 500 chars
      const trimOutput = (text, maxChars = 500) => {
        if (!text) return '';
        const lines = text.split('\n');
        let result = lines.slice(-10).join('\n'); // last 10 lines
        if (result.length > maxChars) {
          result = '...' + result.slice(-maxChars);
        }
        return result;
      };

      resolve({
        cmd,
        exitCode: killed ? -1 : (exitCode || 0),
        durationMs,
        stdout: trimOutput(stdout),
        stderr: trimOutput(stderr),
        timeout: killed
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      resolve({
        cmd,
        exitCode: -1,
        durationMs: Date.now() - startTime,
        stdout: '',
        stderr: err.message,
        error: true
      });
    });
  });
}

/**
 * Run verification commands sequentially
 * @param {string[]} cmds - array of commands to run
 * @param {string} projectPath - working directory
 * @param {string} project - project ID
 * @param {string} runSessionId - current run session
 * @returns {Promise<object>} - { project, runSessionId, results, summary }
 */
export async function runVerification(cmds, projectPath, project, runSessionId) {
  if (!cmds || cmds.length === 0) {
    return {
      project,
      runSessionId,
      results: [],
      summary: { total: 0, passed: 0, failed: 0, skipped: 0 }
    };
  }

  // WS_SMOKE=1: stub fast results
  if (process.env.WS_SMOKE === '1') {
    const results = cmds.map(cmd => ({
      cmd,
      exitCode: 0,
      durationMs: 10,
      stdout: 'smoke stub: passed',
      stderr: '',
      timeout: false
    }));

    return {
      project,
      runSessionId,
      results,
      summary: { total: results.length, passed: results.length, failed: 0, skipped: 0 }
    };
  }

  const results = [];
  
  for (const cmd of cmds) {
    const result = await runVerifyCmd(cmd, projectPath, 60000);
    results.push(result);

    // Stop on first failure to make verification deterministic
    if (result.exitCode !== 0) {
      // collect artifacts for failed command and persist to data/runs
      const artifacts = [];
      const runsDir = path.join(process.cwd(), 'data', 'runs', `${project}`);
      try { if (!existsSync(runsDir)) mkdirSync(runsDir, { recursive: true }); } catch (e) {}

      const ts = Date.now();
      const base = `verify_${runSessionId || 'no-session'}_${ts}`;
      const outPath = path.join(runsDir, `${base}_stdout.txt`);
      const errPath = path.join(runsDir, `${base}_stderr.txt`);
      const metaPath = path.join(runsDir, `${base}_meta.json`);
      const envPath = path.join(runsDir, `${base}_env.txt`);
      const psPath = path.join(runsDir, `${base}_ps.txt`);

      try { writeFileSync(outPath, result.stdout || '', 'utf8'); } catch (e) {}
      try { writeFileSync(errPath, result.stderr || '', 'utf8'); } catch (e) {}
      try { writeFileSync(metaPath, JSON.stringify({ cmd: result.cmd, exitCode: result.exitCode, durationMs: result.durationMs }), 'utf8'); } catch (e) {}
      try { writeFileSync(envPath, Object.entries(process.env).map(([k,v])=>`${k}=${v}`).join('\n'), 'utf8'); } catch (e) {}
      try { const ps = execSync('ps aux', { encoding: 'utf8', stdio: 'pipe' }); writeFileSync(psPath, ps.slice(0, 20000), 'utf8'); } catch (e) {}

      // Optional: capture screenshot if puppeteer available
      let screenshotPath = null;
      try {
        const pup = await import('puppeteer').catch(() => null);
        if (pup && process.env.VERIFY_CAPTURE_SCREENSHOTS !== '0') {
          const browser = await pup.launch({ headless: true, args: ['--no-sandbox'] });
          const page = await browser.newPage();
          await page.goto('about:blank');
          screenshotPath = path.join(runsDir, `${base}_screenshot.png`);
          await page.screenshot({ path: screenshotPath });
          await browser.close();
        }
      } catch (e) { /* puppeteer not available or failed */ }

      const artifactFiles = { stdoutPath: outPath, stderrPath: errPath, metaPath, envPath, psPath };
      if (screenshotPath) artifactFiles.screenshotPath = screenshotPath;
      artifacts.push({ cmd: result.cmd, exitCode: result.exitCode, ...artifactFiles });

      // Register in artifact index and cleanup old artifacts
      try { registerArtifact(project, runSessionId, result.cmd, result.exitCode, artifactFiles); } catch (e) {}
      try { cleanupArtifacts(); } catch (e) {}

      return {
        project,
        runSessionId,
        results,
        artifacts,
        summary: { total: results.length, passed: results.filter(r => r.exitCode === 0).length, failed: results.filter(r => r.exitCode !== 0).length, skipped: cmds.length - results.length }
      };
    }
  }

  // Compute summary
  const summary = {
    total: results.length,
    passed: results.filter(r => r.exitCode === 0).length,
    failed: results.filter(r => r.exitCode !== 0).length,
    skipped: cmds.length - results.length
  };

  return {
    project,
    runSessionId,
    results,
    summary
  };
}
