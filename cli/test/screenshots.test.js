'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const test = require('node:test');
const assert = require('node:assert/strict');

const { initProject } = require('../../engine/init');
const {
  runScreenshots,
  resolveViewport,
  resolveFrame,
  resolvePageTargets,
} = require('../../engine/screenshots');
const { runScreenshotsCommand } = require('../commands/commands/screenshots');

function createTempProject(projectName) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-screenshot-'));
  const projectPath = path.join(base, 'project');
  initProject({
    projectName,
    projectPath,
  });

  writeYaml(path.join(projectPath, 'components.yaml'), {
    documentType: 'components',
    specVersion: '1.1',
    id: 'components',
    components: {
      wireframe_box: {
        root: {
          id: 'wireframe_box',
          injectable: true,
        },
      },
    },
  });

  writeYaml(path.join(projectPath, 'pages', 'home.yaml'), {
    documentType: 'page',
    specVersion: '1.1',
    id: 'home',
    page: {
      id: 'home',
      template: 'public_template',
      viewport: {
        device: 'web',
      },
      wireframeStyle: {
        border: {
          style: 'solid',
          width: 'thin',
        },
        corner: {
          style: 'rounded',
          radius: 8,
        },
      },
      slots: [
        {
          slotId: 'main',
          content: [
            {
              id: 'hero',
              use: 'wireframe_box',
            },
          ],
        },
      ],
    },
  });

  return projectPath;
}

function writeYaml(filePath, value) {
  fs.writeFileSync(filePath, `${yaml.dump(value)}\n`, 'utf8');
}

function runWithCapture(callback) {
  const logs = [];
  const errors = [];
  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args) => {
    logs.push(args.join(' '));
  };
  console.error = (...args) => {
    errors.push(args.join(' '));
  };

  try {
    callback();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  return { logs, errors };
}

function addFrameFixture(projectPath, frameId = 'phone_bold') {
  const framesDir = path.join(projectPath, 'assets', 'frames');
  fs.mkdirSync(framesDir, { recursive: true });

  const imagePath = path.join(framesDir, `${frameId}.png`);
  fs.writeFileSync(imagePath, 'png');

  writeYaml(path.join(framesDir, 'frames.yaml'), {
    documentType: 'frames',
    specVersion: '1.1',
    id: 'device_frames',
    frames: {
      [frameId]: {
        file: `${frameId}.png`,
        type: 'phone',
        screen: {
          top: 8,
          left: 7,
          width: 360,
          height: 640,
        },
      },
    },
  });

  return imagePath;
}

test('resolveViewport supports web and mobile/tablet presets', () => {
  const web = resolveViewport({ device: 'web' });
  const mobile = resolveViewport({ device: 'mobile', orientation: 'portrait' });
  const tablet = resolveViewport({ device: 'tablet', orientation: 'landscape' });

  assert.equal(web.ok, true);
  assert.equal(web.width, 1280);
  assert.equal(web.height, 900);
  assert.equal(mobile.ok, true);
  assert.equal(mobile.width, 390);
  assert.equal(mobile.height, 844);
  assert.equal(tablet.ok, true);
  assert.equal(tablet.width, 1180);
  assert.equal(tablet.height, 820);
});

test('resolvePageTargets maps route targets using platform-specific output filenames', () => {
  const projectPath = createTempProject('Screenshot Route Table');
  writeYaml(path.join(projectPath, 'sitemap.yaml'), {
    documentType: 'sitemap',
    specVersion: '1.1',
    id: 'sitemap',
    defaultTemplate: 'public_template',
    routes: [
      { id: 'home', path: '/', page: 'home', template: 'public_template' },
      { id: 'mobile', path: '/mobile', page: 'mobile', template: 'public_template' },
    ],
  });
  writeYaml(path.join(projectPath, 'pages', 'mobile.yaml'), {
    documentType: 'page',
    specVersion: '1.1',
    id: 'mobile',
    page: {
      id: 'mobile',
      template: 'public_template',
      viewport: {
        device: 'mobile',
        orientation: 'portrait',
      },
      wireframeStyle: {
        border: {
          style: 'solid',
          width: 'thin',
        },
        corner: {
          style: 'rounded',
          radius: 8,
        },
      },
      slots: [
        {
          slotId: 'main',
          content: [
            {
              id: 'mobile_hero',
              use: 'wireframe_box',
            },
          ],
        },
      ],
    },
  });

  const result = resolvePageTargets(projectPath);
  assert.equal(result.ok, true);
  const home = result.targets.find((entry) => entry.pageId === 'home');
  const mobile = result.targets.find((entry) => entry.pageId === 'mobile');
  assert.equal(home.routeTable.home, 'home.html');
  assert.equal(home.routeTable.mobile, undefined);
  assert.equal(mobile.routeTable.mobile, 'mobile_mobile.html');
  assert.equal(mobile.routeTable.home, undefined);
});

test('resolveViewport reports invalid viewport options', () => {
  const missing = resolveViewport({});
  const badDevice = resolveViewport({ device: 'desktop', orientation: 'landscape' });

  assert.equal(missing.ok, false);
  assert.ok(missing.error.includes('missing required device'));
  assert.equal(badDevice.ok, false);
  assert.ok(badDevice.error.includes('Unsupported device'));
});

test('resolveFrame validates local project frame config and image assets', () => {
  const projectPath = createTempProject('Screenshot Frame Config');
  const framesDir = path.join(projectPath, 'assets', 'frames');
  fs.mkdirSync(framesDir, { recursive: true });
  const missingFrame = resolveFrame(projectPath, 'phone_bold');

  assert.equal(missingFrame.ok, false);
  assert.equal(missingFrame.error.includes('Invalid or missing frames configuration'), true);

  writeYaml(path.join(framesDir, 'frames.yaml'), {
    documentType: 'frames',
    specVersion: '1.1',
    id: 'device_frames',
    frames: {
      phone_bold: {
        file: 'phone_bold.png',
        type: 'phone',
        screen: {
          top: 8,
          left: 7,
          width: 360,
          height: 640,
        },
      },
    },
  });

  const imagePath = path.join(framesDir, 'phone_bold.png');
  fs.writeFileSync(imagePath, 'png');

  const validFrame = resolveFrame(projectPath, 'phone_bold');
  assert.equal(validFrame.ok, true);
  assert.equal(validFrame.frame.width, 360);
  assert.equal(validFrame.frame.height, 640);
  assert.equal(validFrame.frame.top, 8);
  assert.equal(validFrame.frame.imageData.startsWith('data:image/'), true);
});

test('runScreenshots supports frame rendering in dry-run mode', async () => {
  const projectPath = createTempProject('Screenshot Frame Dry Run');
  addFrameFixture(projectPath);

  const result = await runScreenshots({
    projectPath,
    output: path.join(projectPath, 'shots'),
    pageId: 'home',
    frameId: 'phone_bold',
    dryRun: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.screenshotCount, 1);
  assert.equal(fs.existsSync(path.join(projectPath, 'shots', 'home.png')), true);
  assert.equal(fs.existsSync(path.join(projectPath, 'shots', 'index.html')), true);
});

test('runScreenshots creates output artifacts in dry-run mode', async () => {
  const projectPath = createTempProject('Screenshot Dry Run');
  const outputPath = path.join(projectPath, 'screens');

  const result = await runScreenshots({
    projectPath,
    output: outputPath,
    pageId: 'home',
    dryRun: true,
  });

  const screenshotPath = path.join(outputPath, 'home.png');
  const indexPath = path.join(outputPath, 'index.html');
  assert.equal(result.ok, true);
  assert.equal(result.screenshotCount, 1);
  assert.equal(fs.existsSync(screenshotPath), true);
  assert.equal(fs.existsSync(indexPath), true);
  assert.equal(fs.readFileSync(screenshotPath, 'utf8'), 'dry-run\n');
  const indexText = fs.readFileSync(indexPath, 'utf8');
  assert.equal(indexText.includes('home.png'), true);
});

test('runScreenshots command rejects invalid arguments', () => {
  const projectPath = createTempProject('Screenshot Command Invalid Arg');

  process.exitCode = 0;
  const output = runWithCapture(() => {
    runScreenshotsCommand(['--page'], { cwd: projectPath });
  });

  assert.equal(process.exitCode, 2);
  assert.equal(output.errors.join('\n').includes('Missing value for --page.'), true);
  process.exitCode = 0;
});
