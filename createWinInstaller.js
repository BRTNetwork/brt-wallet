const createWindowsInstaller = require('electron-winstaller').createWindowsInstaller
const path = require('path')
const appVersion = require('./package.json').version;
const argv = require('minimist')(process.argv.slice(1));
const arch = argv.arch || 'ia32';

const iconUrlPath = "https://raw.githubusercontent.com/BRTNetwork/brt-Assets/master/v4/brt-icon-256x256.png";

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
    appDirectory: path.join(appPath, 'brt-wallet-win32-' + arch + '/'),
    authors: 'BRT Network',
    noMsi: true,
    noDelta: true,
    outputDirectory: path.join(outPath, 'windows-'+arch),
    exe: 'brt-wallet.exe',
    setupExe: 'brt-wallet-'+arch+'-'+appVersion+'.exe',
    setupIcon: path.join(rootPath, 'src', 'assets', 'brand', 'brt-icon-256x256.ico'),
    iconUrl: iconUrlPath,
    loadingGif: path.join(rootPath, 'src', 'assets', 'brand', 'setup.gif'),
    // certificateFile: 'C:/Users/a.jochems/Documents/Crypto Service/Comodo/code-signing-cert.p12',
    certificateFile: '/Users/ajochems/Documents/BRT/CodeSigningCert-BRTOpCo.p12',
    certificatePassword: 'Lziio1wob716A4mLXxrF'
  })
}
