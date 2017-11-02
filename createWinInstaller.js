const createWindowsInstaller = require('electron-winstaller').createWindowsInstaller
const path = require('path')
const appVersion = require('./package.json').version;
const argv = require('minimist')(process.argv.slice(1));
const arch = argv.arch || 'ia32';

getInstallerConfig(arch)
  .then(createWindowsInstaller)
  .catch((error) => {
    console.error(error.message || error)
    process.exit(1)
  });

function getInstallerConfig (arch) {
  console.log('creating windows installer for: ' + arch);
  const rootPath = path.join('./');
  const appPath = path.join(rootPath, 'app-builds');
  const outPath = path.join(rootPath, 'release-builds');

  return Promise.resolve({
    appDirectory: path.join(appPath, 'casinocoin-wallet-win32-' + arch + '/'),
    authors: 'Casinocoin Foundation',
    noMsi: true,
    outputDirectory: path.join(outPath, 'windows-'+arch),
    exe: 'casinocoin-wallet.exe',
    setupExe: 'casinocoin-wallet-'+arch+'-'+appVersion+'.exe',
    setupIcon: path.join(rootPath, 'src', 'assets', 'icons', 'casinocoin.ico')
  })
}