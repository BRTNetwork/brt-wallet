import { Component, OnInit, OnDestroy, trigger, state, animate,
         transition, style, ViewChild, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { Observable } from 'rxjs/Observable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { SessionStorage, LocalStorageService, SessionStorageService } from 'ngx-store';
import { ElectronService } from '../../providers/electron.service';
import { LogService } from '../../providers/log.service';
import { Menu as ElectronMenu, MenuItem as ElectronMenuItem } from 'electron';
import { brtService } from '../../providers/brt.service';
import { ServerDefinition } from '../../domain/websocket-types';
import { WalletService } from '../../providers/wallet.service';
import { MarketService } from '../../providers/market.service';
import { MenuItem as PrimeMenuItem, Message, ContextMenu } from 'primeng/primeng';
import { SelectItem, Dropdown } from 'primeng/primeng';
import { MatListModule, MatSidenavModule } from '@angular/material';
import { AppConstants } from '../../domain/app-constants';
import { BRTUtil } from '../../domain/brt-util';
import { BRTCrypto } from '../../domain/brt-crypto';
import { LedgerStreamMessages, ServerStateMessage } from '../../domain/websocket-types';
import { setTimeout } from 'timers';
import { LokiKey } from '../../domain/lokijs';
import { WalletSettings } from 'app/domain/brt-types';
import * as LokiTypes from '../../domain/lokijs';
import Big from 'big.js';
import { NotificationService } from '../../providers/notification.service';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
import * as brtAddressCodec from '@brtnetwork/brt-address-codec';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  animations: [
    trigger('component_visibility', [
        state('shown', style({
            opacity: 1
        })),
        state('hidden', style({
            opacity: 0
        })),
        transition('* => *', animate('.75s'))
    ])
  ]
})

export class HomeComponent implements OnInit, OnDestroy, AfterViewInit {

  @SessionStorage() public currentWallet: string;

  @ViewChild('contextMenu') contextMenu: ContextMenu;
  @ViewChild('fiatCurrenciesDrowdown') fiatCurrenciesDrowdown: Dropdown;
  @ViewChild('notificationsDrowdown') notificationsDrowdown: Dropdown;
  @ViewChild('accountDropdown') accountDropdown: Dropdown;

  //show_menu: string = 'shown';
  show_menu: string = 'small';
  menu_items: PrimeMenuItem[];
  tools_context_menu: ElectronMenu;
  connection_context_menu: ElectronMenu;

  applicationVersion: string;
  dbMetadata: LokiTypes.LokiDBMetadata;

  showPrivateKeyImportDialog:boolean = false;
  showSettingsDialog:boolean = false;
  showServerInfoDialog:boolean = false;
  showPasswordDialog:boolean = false;
  showPasswordCallback:any;

  walletSettings: WalletSettings = {showNotifications: false, fiatCurrency: 'USD'};
  fiatCurrencies: SelectItem[] = [];
  notifications: SelectItem[] = [];
  selectedFiatCurrency: string;
  privateKeySeed:string;
  walletPassword:string;
  importFileObject:Object;
  currentWalletObject:Object;

  privateKeyExportLocation: string = "";
  privateKeyImportfile: string = "";
  importKeys: Array<LokiKey> = [];

  // Growl messages
  msgs: Message[] = [];

  overview_image: string = require("./assets/overview_active.png");
  overview_text_class: string = "active_text_color";
  send_image: string = require("./assets/send.png");
  send_text_class: string = "inactive_text_color";
  receive_image: string = require("./assets/receive.png");
  receive_text_class: string = "inactive_text_color";
  addressbook_image: string = require("./assets/addressbook.png");
  addressbook_text_class: string = "inactive_text_color";
  swap_image: string = require('./assets/swap.png');
  swap_text_class: string = "inactive_text_color";

  active_menu_item: string = "transactions";

  isConnected = new BehaviorSubject<boolean>(false);
  connected_icon: string = "fa fa-wifi fa-2x";
  connected_tooltip: string = "Connected";
  // connection_image: string = "assets/icons/connected-red.png";
  connectionColorClass: string = "connected-color";
  connectionImage: string = "assets/icons/connected.png";
  manualDisconnect: boolean = false;
  searchDate: Date;

  serverState: ServerStateMessage;
  currentServer: ServerDefinition;
  brtConnectionSubject: Observable<any>;
  uiChangeSubject = new BehaviorSubject<string>(AppConstants.KEY_INIT);

  balance:string;;
  walletBalance:string;
  fiat_balance:string;
  transaction_count:number;
  last_transaction:number;

  footer_visible: boolean = false;
  error_message: string = "";
  passwordDialogHeader: string = "brt Wallet Password";

  backupPath: string;
  lastMenuEvent: string = "";
  navigationSucceeded: boolean = false;

  showSignMessageDialog:boolean = false;
  showVerifyMessageDialog:boolean = false;

  accounts: SelectItem[] = [];
  selectedAccount: string;
  msgToSign: string;
  signPubKey: string;
  signSignature: string;
  msgToVerify: string;
  verifyPubKey: string;
  verifySignature: string;
  verificationFinished: boolean = false;
  verificationResult: boolean = false;
  copy_context_menu: ElectronMenu;
  copiedValue:string = '';

  // multisigning
  showEnableMultisignDialog: boolean = false;
  ms_setting_account: string;
  ms_setting_sequence: number;
  ms_setting_quorum: number;
  signer_account: string;
  signer_weight: number;
  ms_setting_signers: Array<{
    signer: string;
    weight: number;
  }> = [];
  disableMasterKey: boolean = false;
  baseMultiSignedTx: string;
  signerSignedTxSignatures: Array<object> = [];

  // compose transaction
  showComposeTransactionDialog: boolean = false;
  showSignTransactionDialog: boolean = false;
  accountsForSigning: SelectItem[] = [];
  selectedSignerAccount: any;
  showTransactionSignature: boolean = false;
  signedMultisignTxSignature: string;
  multisignTxSignatureToSign: string;
  submitThresholdNeeded: number = 0;

  constructor( private logger: LogService,
               private router: Router,
               private electron: ElectronService,
               private walletService: WalletService,
               private brtService: brtService ,
               private localStorageService: LocalStorageService,
               private sessionStorageService: SessionStorageService,
               private marketService: MarketService,
               private datePipe: DatePipe,
               private notificationService: NotificationService,
               private currencyPipe: CurrencyPipe ) {
    this.notifications.push({label: 'True', value: true});
    this.notifications.push({label: 'False', value: false});
    this.logger.debug("### INIT HOME ###");
    this.applicationVersion = this.electron.remote.app.getVersion();
    this.backupPath = this.electron.remote.getGlobal("vars").backupPath;
    this.logger.debug("### HOME Backup Path: " + this.backupPath);
    this.electron.ipcRenderer.on("action", (event, arg) => {
      if(arg === "save-wallet"){
        this.logger.debug("### HOME Logout Wallet on Suspend ###");
        this.closeWallet();
      } else if(arg === "quit-wallet"){
        this.logger.debug("### HOME Save Wallet on Quit ###");
        this.walletService.openWalletSubject.subscribe(state => {
          if (state == AppConstants.KEY_INIT){
            this.electron.ipcRenderer.send('wallet-closed', true);
          }
        });
        // backup wallet
        this.backupWallet();
        // close and logout
        this.walletService.closeWallet();
      } else if(arg === "refresh-balance"){
        this.logger.debug("### HOME Refresh Balance Received ###");
        this.doBalanceUpdate();
        this.doTransacionUpdate();
      }
    });
  }

  ngAfterViewInit(){
    this.logger.debug("### HOME ngAfterViewInit() ###");
  }

  ngOnInit() {
    this.logger.debug("### HOME ngOnInit() - currentWallet: " + this.currentWallet);

    // get the complete wallet object
    let availableWallets = this.localStorageService.get(AppConstants.KEY_AVAILABLE_WALLETS);
    let walletIndex = availableWallets.findIndex( item => item['walletUUID'] == this.currentWallet);
    this.currentWalletObject = availableWallets[walletIndex];
    // get server state
    let serverStateSubject = this.brtService.serverStateSubject;
    serverStateSubject.subscribe( state => {
      this.serverState = state;
      this.logger.debug("### HOME Server State: " + JSON.stringify(this.serverState));
    });
    // define Tools context menu
    let tools_context_menu_template = [
      { label: 'Private Keys', submenu: [
        { label: 'Import Private Key File',
          click(menuItem, browserWindow, event) {
            browserWindow.webContents.send('context-menu-event', 'import-priv-key-file');
          }
        },
        { label: 'Export Private Key File',
          click(menuItem, browserWindow, event) {
            browserWindow.webContents.send('context-menu-event', 'export-priv-key-file');
          }
        },
        { label: 'Import Private Key',
          click(menuItem, browserWindow, event) {
            browserWindow.webContents.send('context-menu-event', 'import-priv-key');
          }
        },
      ]}
      // { label: 'Import Existing Wallet',
      //   click(menuItem, browserWindow, event) {
      //     browserWindow.webContents.send('context-menu-event', 'add-wallet');
      //   }
      // }
    ];
    this.tools_context_menu = this.electron.remote.Menu.buildFromTemplate(tools_context_menu_template);
    // paperwallet submenu
    let paperWalletMenu = { label: 'Paper Wallet', submenu: [
      { label: 'Generate Paper Wallet',
        click(menuItem, browserWindow, event) {
          browserWindow.webContents.send('context-menu-event', 'paper-wallet');
        }, enabled: true
      },
      { label: 'Import Paper Wallet',
        click(menuItem, browserWindow, event) {
          browserWindow.webContents.send('context-menu-event', 'import-paper-wallet');
        }, enabled: true
      }
    ]};
    this.tools_context_menu.append(new this.electron.remote.MenuItem(paperWalletMenu));
    //message signing submenu
    let messageSigningMenu = { label: 'Message Signing', submenu: [
        { label: 'Sign Message',
          click(menuItem, browserWindow, event) {
            browserWindow.webContents.send('context-menu-event', 'sign-message');
          }, enabled: true
        },
        { label: 'Verify Message',
          click(menuItem, browserWindow, event) {
            browserWindow.webContents.send('context-menu-event', 'verify-message');
          }, enabled: true
        }
      ]};
    this.tools_context_menu.append(new this.electron.remote.MenuItem(messageSigningMenu));

    // const multiSigningMenu = { label: 'Multisigning', submenu: [
    //     { label: 'Enable Multisigning',
    //       click(menuItem, browserWindow, event) {
    //         browserWindow.webContents.send('context-menu-event', 'enable-multisign');
    //       }, enabled: true
    //     },
    //     { label: 'Sign Transaction',
    //       click(menuItem, browserWindow, event) {
    //         browserWindow.webContents.send('context-menu-event', 'sign-transaction');
    //       }, enabled: true
    //     },
    //     { label: 'Compose Transaction',
    //       click(menuItem, browserWindow, event) {
    //         browserWindow.webContents.send('context-menu-event', 'compose-transaction');
    //       }, enabled: true
    //     }
    //   ]};
    // this.tools_context_menu.append(new this.electron.remote.MenuItem(multiSigningMenu));
    this.tools_context_menu.append(new this.electron.remote.MenuItem({ type: 'separator' }));
    this.tools_context_menu.append(new this.electron.remote.MenuItem(
      { label: 'Change Password',
        click(menuItem, browserWindow, event) {
          browserWindow.webContents.send('context-menu-event', 'change-password');
        }, enabled: true
      })
    );
    this.tools_context_menu.append(new this.electron.remote.MenuItem({ type: 'separator' }));
    this.tools_context_menu.append(new this.electron.remote.MenuItem(
      { label: 'Create New Wallet',
        click(menuItem, browserWindow, event) {
          browserWindow.webContents.send('context-menu-event', 'create-wallet');
        }, enabled: true
      })
    );
    this.tools_context_menu.append(new this.electron.remote.MenuItem({ type: 'separator' }));
    this.tools_context_menu.append(new this.electron.remote.MenuItem(
      { label: 'Refresh Wallet',
        click(menuItem, browserWindow, event) {
          browserWindow.webContents.send('context-menu-event', 'refresh-wallet');
        }, enabled: true
      })
    );
    this.tools_context_menu.append(new this.electron.remote.MenuItem({ type: 'separator' }));
    this.tools_context_menu.append(new this.electron.remote.MenuItem(
      { label: 'Change Wallet',
        click(menuItem, browserWindow, event) {
          browserWindow.webContents.send('context-menu-event', 'close-wallet');
        }, enabled: true
      })
    );
    this.tools_context_menu.append(new this.electron.remote.MenuItem({ type: 'separator' }));
    this.tools_context_menu.append(new this.electron.remote.MenuItem(
      { label: 'Quit',
        click(menuItem, browserWindow, event) {
          browserWindow.webContents.send('context-menu-event', 'quit');
        }
      })
    );

    // define Connection context menu
    let connect_context_menu_template = [
     { label: 'Connect to Network',
       click(menuItem, browserWindow, event) {
          browserWindow.webContents.send('connect-context-menu-event', 'connect'); }, visible: true
      },
      { label: 'Disconnect from Network',
        click(menuItem, browserWindow, event) {
            browserWindow.webContents.send('connect-context-menu-event', 'disconnect'); }, visible: false
      },
      { label: 'Server Information',
        click(menuItem, browserWindow, event) {
            browserWindow.webContents.send('connect-context-menu-event', 'server-info'); }, visible: false
      }
    ];
    this.connection_context_menu = this.electron.remote.Menu.buildFromTemplate(connect_context_menu_template);

    // define Copy context menu
    let copy_context_menu_template = [
      { label: 'Copy',
        click(menuItem, browserWindow, event) {
          browserWindow.webContents.send('copy-context-menu-event', 'copy');
        }
      }
    ];
    this.copy_context_menu = this.electron.remote.Menu.buildFromTemplate(copy_context_menu_template);

    // listen to tools context menu events
    this.electron.ipcRenderer.on('context-menu-event', (event, arg) => {
      if(this.navigationSucceeded){
        this.logger.debug("### HOME Menu Event: " + arg);
        if(arg == 'import-priv-key-file')
          this.onPrivateKeyFileImport();
        else if(arg == 'export-priv-key-file')
          this.onPrivateKeysExport();
        else if(arg == 'import-priv-key')
          this.onPrivateKeyImport();
        else if(arg == 'paper-wallet')
          this.onPaperWallet();
        else if(arg == 'import-paper-wallet')
            this.onImportPaperWallet();
        else if(arg == 'backup-wallet')
          this.onBackupWallet();
        else if(arg == 'restore-backup')
          this.onRestoreBackup();
        else if(arg == 'add-wallet')
          this.onAddWallet();
        else if(arg == 'change-password')
            this.changePassword();
        else if(arg == 'create-wallet')
          this.createWallet();
        else if(arg == 'close-wallet')
          this.closeWallet();
        else if(arg == 'quit')
          this.onQuit();
        else if(arg == 'refresh-wallet')
          this.onRefreshWallet();
        else if(arg == 'sign-message')
          this.onShowSignMessage();
        else if(arg == 'verify-message')
          this.onShowVerifyMessage();
        else if(arg == 'enable-multisign'){
          this.onShowEnableMultisign();
        }else if(arg == 'compose-transaction'){
          this.onShowComposeTransaction();
        }else if(arg == 'sign-transaction'){
          this.onShowSignTransaction();
        }else
          this.logger.debug("### Context menu not implemented: " + arg);
      }
    });

    // listen to connect context menu events
    this.electron.ipcRenderer.on('connect-context-menu-event', (event, arg) => {
      if(this.navigationSucceeded){
        if(arg == 'connect'){
          if(this.lastMenuEvent != "connect"){
            this.lastMenuEvent = "connect";
            this.onConnect();
          }
        }
        else if(arg == 'disconnect'){
          if(this.lastMenuEvent != "disconnect"){
            this.lastMenuEvent = "disconnect";
            this.onDisconnect();
          }
        }
        else if(arg == 'server-info')
          this.onServerInfo();
      }
    });

    // listen to copy context menu events
    this.electron.ipcRenderer.on('copy-context-menu-event', (event, arg) => {
      if(this.navigationSucceeded){
        if(arg == 'copy'){
          this.copyValueToClipboard();
        }
      }
    });

    // navigate to the transactions
    this.router.navigate(['transactions']).then(navResult => {
      this.logger.debug("### HOME transactions navResult: " + navResult);
      if(navResult){
        this.navigationSucceeded = true;
        // connect to brt network
        this.doConnectTobrtNetwork();
      } else {
        this.navigationSucceeded = false;
      }
    });
    // subscribe to the openWallet subject
    let openWalletSubject = this.walletService.openWalletSubject;
    openWalletSubject.subscribe( result => {
      if(result == AppConstants.KEY_LOADED){
        this.logger.debug("### HOME Wallet Open ###");
        // get the DB Metadata
        this.dbMetadata = this.walletService.getDBMetadata();
        this.logger.debug("### HOME DB Metadata: " + JSON.stringify(this.dbMetadata));
        // check transaction index
        if(!this.walletService.isTransactionIndexValid()){
          this.logger.debug("### HOME Rebuild TX List from Online ###");
          this.walletService.clearTransactions();
        }
        // update balance
        this.doBalanceUpdate();
        // update transaction count
        this.doTransacionUpdate();
        // load the account list
        this.walletService.getAllAccounts().forEach( element => {
          let accountLabel = element.label + " - " + element.accountID;
          this.accounts.push({label: accountLabel, value: element.accountID});
        });
      } else if(result == AppConstants.KEY_INIT && this.currentWallet){
        // wallet is not open but we seem to have a session, not good so redirect to login
        this.sessionStorageService.remove(AppConstants.KEY_CURRENT_WALLET);
        this.router.navigate(['login']);
      }
    });
    this.setConnectedMenuItem(true);
    // load wallet settings
    this.walletSettings = this.localStorageService.get(AppConstants.KEY_WALLET_SETTINGS);
    if (this.walletSettings == null){
      // settings do not exist yet so create
      this.walletSettings = {fiatCurrency: "USD", showNotifications: false};
      this.localStorageService.set(AppConstants.KEY_WALLET_SETTINGS, this.walletSettings);
    }
    // load fiat currencies and update market value
    this.fiatCurrencies = this.marketService.getFiatCurrencies();
    this.updateMarketService(this.walletSettings.fiatCurrency);
  }

  ngOnDestroy(){
    this.logger.debug("### HOME ngOnDestroy() ###");
    if(this.isConnected && this.brtService != undefined){
      this.brtService.disconnect();
    }
  }

  doConnectTobrtNetwork(){
    this.logger.debug("### HOME doConnectTobrtNetwork() ###");
    // Connect to the brt network
    this.brtService.connect().subscribe(connected => {
      // this.brtService.brtConnectedSubject.subscribe( connected => {
        if (connected == AppConstants.KEY_CONNECTED){
          this.logger.debug("### HOME Connected ###");
          // subscribe to transaction updates
          this.brtService.transactionSubject.subscribe( tx => {
            this.doTransacionUpdate();
          });
          // subscribe to account updates
          this.brtService.accountSubject.subscribe( account => {
            this.doBalanceUpdate();
          });

          this.brtService.accountSettingsSubject.subscribe( settings => {
            if (this.showSignTransactionDialog){
              this.updateSignersSelection();
            }
          });
          // this.uiChangeSubject.next(AppConstants.KEY_CONNECTED);
          this.setWalletUIConnected();
        } else if (connected == AppConstants.KEY_DISCONNECTED){
          // this.uiChangeSubject.next(AppConstants.KEY_DISCONNECTED);
          this.setWalletUIDisconnected();
        } else {
          this.logger.debug("### HOME Connected value: " + connected);
        }
        this.logger.debug("### HOME currentServer: " + JSON.stringify(this.currentServer));
      });
  }

  setWalletUIConnected(){
      this.logger.debug("### HOME Set GUI Connected ###");
      this.connectionImage = "assets/icons/connected.png"
      this.connectionColorClass = "connected-color";
      this.connected_tooltip = "Connected";
      this.setConnectedMenuItem(true);
      this.currentServer = this.brtService.getCurrentServer();
  }

  setWalletUIDisconnected(){
      this.logger.debug("### HOME Set GUI Disconnected ###");
      this.connectionImage = "assets/icons/connected-red.png";
      this.connectionColorClass = "disconnected-color";
      this.connected_tooltip = "Disconnected";
      this.setConnectedMenuItem(false);
      // this.currentServer = { server_id: '', server_url: '', response_time: -1 };
  }

  onMenuClick() {
    this.logger.debug("Menu Clicked !!");
    this.show_menu = this.show_menu == 'small' ? 'wide' : 'small';
  }

  onSettingsMenuClick(event) {
    this.showSettingsDialog = true;
  }

  onToolsMenuClick(event) {
    this.tools_context_menu.popup({window: this.electron.remote.getCurrentWindow()});
  }

  onConnectionClick(event) {
    this.connection_context_menu.popup({window: this.electron.remote.getCurrentWindow()});
  }

  selectedMenuItem(item) {
    item.command();
  }

  onConnect(){
    this.logger.debug("### HOME Connect ###");
    this.manualDisconnect = false;
    this.brtService.connect();
    // this.connectTobrtNetwork();
  }

  onDisconnect(){
    this.logger.debug("### HOME Disconnect ###");
    this.manualDisconnect = true;
    this.brtService.disconnect();
  }

  onServerInfo() {
    this.currentServer = this.brtService.getCurrentServer();
    this.showServerInfoDialog = true;
  }

  onQuit() {
    this.logger.debug("Quit Clicked !!");
    // backup database
    // this.backupWallet();
    // close the Database!
    // this.walletService.closeWallet();
    // Close the windows to cause an application exit
    this.electron.remote.getGlobal("vars").exitFromRenderer = true;
    this.electron.remote.app.quit();
  }

  executePasswordCallback(){
    this.showPasswordCallback();
  }

  initPasswordCheck(label){
    this.walletPassword = "";
    this.error_message = "";
    this.footer_visible = false;
    this.passwordDialogHeader = label;
  }

  onPrivateKeyFileImport() {
    // this.showPrivateKeyImportDialog = true;
    this.logger.debug("### Open File Dialog: " + this.electron.remote.app.getPath("documents"));
    this.importKeys = [];
    let fileFilters = [{name: 'Private Keys', extensions: ['keys']} ];
    this.electron.remote.dialog.showOpenDialog(
        { title: 'Private Key Import',
          defaultPath: this.electron.remote.app.getPath("documents"),
          filters: fileFilters,
          properties: ['openFile']
        }, (files) => {
          this.logger.debug("### Files: " + JSON.stringify(files));
          if(files && files.length > 0){
            this.walletPassword = "";
            let keys:Array<LokiKey> = JSON.parse(fs.readFileSync(files[0]));
            this.logger.debug("### Keys: " + JSON.stringify(keys));
            keys.forEach( key => {
              // check if not yet exits
              let dbKey = this.walletService.getKey(key.accountID);
              if(dbKey == null){
                this.importKeys.push(key);
              }
            });
            if(this.importKeys.length > 0){
              this.logger.debug("### Show Import Key Dialog ###");
              this.showPrivateKeyImportDialog = true;
            } else {
              this.electron.remote.dialog.showMessageBox({ message: "There are no new keys to be imported from the selected file.", buttons: ["OK"] });
            }
          }
        }
    );
  }

  onPrivateKeysExport() {
    // show password dialog
    this.initPasswordCheck("Export Private Keys");
    this.showPasswordCallback = this.selectPrivateKeysExportLocation;
    this.showPasswordDialog = true;
  }

  onImportPrivateKey(){
    this.logger.debug("### Import Private Keys: " + this.importKeys);
    if(this.walletPassword.length == 0 ){
      this.error_message = "Please enter your password.";
      this.footer_visible = true;
    } else if(!this.walletService.checkWalletPasswordHash(this.walletPassword)){
      this.error_message = "You entered an invalid password.";
      this.footer_visible = true;
    } else {
      this.importKeys.forEach(importKey => {
        this.walletService.importPrivateKey(importKey.secret, this.walletPassword);
      });
      // refresh accounts
      this.brtService.checkAllAccounts();
      this.showPrivateKeyImportDialog = false;
      this.importKeys = [];
      this.walletPassword = "";
      this.error_message = "";
      this.footer_visible = false;
    }
  }

  selectPrivateKeysExportLocation() {
    this.logger.debug("### selectPrivateKeysExportLocation()");
    // first check the password
    if(this.walletPassword.length == 0 ){
      this.error_message = "Please enter your password.";
      this.footer_visible = true;
    } else if(!this.walletService.checkWalletPasswordHash(this.walletPassword)){
      this.error_message = "You entered an invalid password.";
      this.footer_visible = true;
    } else {
      this.showPasswordDialog = false;
      this.logger.debug('Open File Dialog: ' + this.electron.remote.app.getPath("documents"));
      this.electron.remote.dialog.showOpenDialog(
          { title: 'Private Key Export Location',
            defaultPath: this.electron.remote.app.getPath("documents"),
            properties: ['openDirectory']}, (result) => {
            this.logger.debug('File Dialog Result: ' + JSON.stringify(result));
            if(result && result.length>0) {
              this.privateKeyExportLocation = result[0];
              // get all decrypted private keys
              let allPrivateKeys = this.walletService.decryptAllKeys(this.walletPassword);
              // create a filename
              let filename = this.datePipe.transform(Date.now(), "yyyy-MM-dd-HH-mm-ss-") + this.currentWallet + '.keys';
              let keyFilePath = path.join(result[0], filename);
              // Write the JSON array to the file
              fs.writeFile(keyFilePath, JSON.stringify(allPrivateKeys), (err) => {
                if(err){
                  this.electron.remote.dialog.showErrorBox("Error saving private keys", "An error occurred writing your private keys to a file: " + err.message);
                }
                this.electron.remote.dialog.showMessageBox(
                  { message: "Your private keys have been saved to a file in the chosen directory. Make sure you put it in a safe place as it contains your decrypted private keys!",
                    buttons: ["OK"]
                  });
              });
            }
          }
      );
    }
  }

  onBackupWallet(){
    this.logger.debug('Open File Dialog: ' + this.electron.remote.app.getPath("documents"));
    this.electron.remote.dialog.showOpenDialog(
        { title: 'Wallet Backup Location',
          defaultPath: this.electron.remote.app.getPath("documents"),
          properties: ['openDirectory','createDirectory']}, (result) => {
          this.logger.debug('File Dialog Result: ' + JSON.stringify(result));
          if(result && result.length>0) {
            let dbDump = this.walletService.getWalletDump();
            // create a filename
            let filename = this.datePipe.transform(Date.now(), "yyyy-MM-dd-HH-mm-ss") + "-"+ this.currentWallet + ".backup";
            let backupFilePath = path.join(result[0], filename);
            // Write the JSON array to the file
            fs.writeFile(backupFilePath, dbDump, (err) => {
              if(err){
                  alert("An error occurred creating the backup file: "+ err.message)
              }

              alert("The backup has been succesfully saved to: " + filename);
            });
          }
        }
    );
  }

  onRestoreBackup(){
    this.logger.debug('Open File Dialog: ' + this.electron.remote.app.getPath("documents"));
    this.electron.remote.dialog.showOpenDialog(
        { title: 'Select Wallet Backup File',
          defaultPath: this.electron.remote.app.getPath("documents"),
          filters: [
            { name: 'BRT Wallet Backups', extensions: ['backup'] }
          ],
          properties: ['openFile']
        }, (result) => {
          this.logger.debug('File Dialog Result: ' + JSON.stringify(result));
          if(result && result.length > 0) {
            let dbDump = fs.readFileSync(result[0]);
            if(dbDump.length > 0){
              this.walletService.importWalletDump(dbDump);
              // redirect to login
              this.router.navigate(['login']);
            }
          } else {
            alert("An error occurred reading the backup file: "+ result[0]);
          }
        }
    );
  }

  onAddWallet(){
    this.logger.debug('Open File Dialog: ' + this.electron.remote.app.getPath("documents"));
    this.electron.remote.dialog.showOpenDialog(
        { title: 'Select Wallet',
          defaultPath: this.electron.remote.app.getPath("documents"),
          filters: [
            { name: 'BRT Wallet', extensions: ['db'] }
          ],
          properties: ['openFile']
        }, (result) => {
          this.logger.debug('File Dialog Result: ' + JSON.stringify(result));
          if(result && result.length > 0) {
            this.importFileObject = path.parse(result[0]);
            this.initPasswordCheck("Add Wallet");
            this.showPasswordCallback = this.doWalletImport;
            this.showPasswordDialog = true;
            return;
          } else {
            return;
          }
        }
    );
  }

  updateMarketService(event){
    if (this.walletSettings.fiatCurrency !== undefined) {
        this.marketService.changeCurrency(this.walletSettings.fiatCurrency);
    }
  }

  updateShowNotification(event){
    this.localStorageService.set(AppConstants.KEY_WALLET_SETTINGS, this.walletSettings);
  }


  doBalanceUpdate() {
    this.walletBalance = this.walletService.getWalletBalance() ? this.walletService.getWalletBalance() : "0";
    this.logger.debug("### HOME - Wallet Balance: " + this.walletBalance);
    this.balance = BRTUtil.dropsToCsc(this.walletBalance);
    let balanceBRT = new Big(this.balance);
    if(this.marketService.coinMarketInfo != null && this.marketService.coinMarketInfo.price_fiat !== undefined){
      this.logger.debug("### BRT Price: " + this.marketService.brtPrice + " BTC: " + this.marketService.btcPrice + " Fiat: " + this.marketService.coinMarketInfo.price_fiat);
      let fiatValue = balanceBRT.times(new Big(this.marketService.coinMarketInfo.price_fiat)).toString();
      this.fiat_balance = this.currencyPipe.transform(fiatValue, this.marketService.coinMarketInfo.selected_fiat, "symbol", "1.2-2");
    }
  }

  doTransacionUpdate(){
    this.transaction_count = this.walletService.getWalletTxCount() ? this.walletService.getWalletTxCount() : 0;
    let lastTX = this.walletService.getWalletLastTx();
    if(lastTX != null){
        this.last_transaction = lastTX.timestamp;
    }
  }

  doWalletImport(){
    this.logger.debug("Add Wallet Location: " + JSON.stringify(this.importFileObject));
    let walletHash = this.walletService.generateWalletPasswordHash(this.importFileObject['name'], this.walletPassword);
    let newWallet =
        { "walletUUID": this.importFileObject['name'],
          "importedDate": BRTUtil.iso8601TobrtTime(new Date().toISOString()),
          "location": this.importFileObject['dir'],
          "hash": walletHash
        };
    let availableWallets = this.localStorageService.get(AppConstants.KEY_AVAILABLE_WALLETS);
    availableWallets.push(newWallet);
    this.localStorageService.set(AppConstants.KEY_AVAILABLE_WALLETS, availableWallets);
    // redirect to login
    this.sessionStorageService.remove(AppConstants.KEY_CURRENT_WALLET);
    this.router.navigate(['login']);
  }

  createWallet(){
    this.walletService.closeWallet();
    this.brtService.disconnect();
    this.sessionStorageService.remove(AppConstants.KEY_CURRENT_WALLET);
    this.walletService.openWalletSubject.next(AppConstants.KEY_INIT);
    this.sessionStorageService.set(AppConstants.KEY_CREATE_WALLET_RUNNING, true);
    this.router.navigate(['wallet-setup']);
  }

  closeWallet(){
    this.walletService.closeWallet();
    this.brtService.disconnect();
    this.sessionStorageService.remove(AppConstants.KEY_CURRENT_WALLET);
    this.router.navigate(['login']);
    // this.electron.remote.getCurrentWindow().reload();
  }

  setConnectedMenuItem(connected: boolean){
    if(connected){
      // enable disconnect
      this.connection_context_menu.items[0].visible = false;
      this.connection_context_menu.items[1].visible = true;
      this.connection_context_menu.items[2].visible = true;
    } else {
      // enable connect
      this.connection_context_menu.items[0].visible = true;
      this.connection_context_menu.items[1].visible = false;
      this.connection_context_menu.items[2].visible = false;
    }
  }

  // getConnectionColorClass(){
  //   if(this.isConnected.getValue()){
  //     return "connected-color";
  //   } else {
  //     return "disconnected-color"
  //   }
  // }

  // getConnectionImage(){
  //   if(this.isConnected.getValue()){
  //     return "../../../assets/icons/connected.png";
  //   } else {
  //     return "../../../assets/icons/connected-red.png"
  //   }
  // }

  onTransactions() {
    this.logger.debug("Transactions Clicked !!");
    this.active_menu_item = "transactions";
    // navigate to transactions
    this.router.navigate(['home','transactions']);
  }

  onSendCoins() {
    this.logger.debug("Send Coins Clicked !!");
    this.active_menu_item = "send";
    // navigate to send
    this.router.navigate(['home', 'send']);
  }

  onReceiveCoins() {
    this.logger.debug("Receive Coins Clicked !!");
    this.active_menu_item = "receive";
    // navigate to receive
    this.router.navigate(['home', 'receive']);
  }

  onAddressbook() {
    this.logger.debug("Addressbook Clicked !!");
    this.active_menu_item = "addressbook";
    // navigate to addressbook
    this.router.navigate(['home','addressbook']);
  }

  onPrivateKeyImport(){
    this.logger.debug("Private Key Import Clicked !!");
    this.active_menu_item = "";
    // navigate to paperwallet
    this.router.navigate(['home','importpaperwallet', {keyimport: true}]);
  }

  onPaperWallet(){
    this.logger.debug("Paperwallet Clicked !!");
    this.active_menu_item = "";
    // navigate to paperwallet
    this.router.navigate(['home','paperwallet']);
  }

  onRefreshWallet(){
    this.logger.debug("Refreshwallet Clicked !!");
    this.active_menu_item = "";
    // navigate to refresh wallet
    this.router.navigate(['home','transactions', {refreshWallet: true}]);
  }

  onImportPaperWallet(){
    this.logger.debug("ImportPaperwallet Clicked !!");
    this.active_menu_item = "";
    // navigate to paperwallet
    this.router.navigate(['home','importpaperwallet']);
  }

  changePassword(){
    this.logger.debug("Change Password Clicked !!");
    this.active_menu_item = "";
    this.router.navigate(['home','changepassword']);
  }

  onCoinSwap() {
    this.logger.debug("Coin Swap Clicked !!");
    this.active_menu_item = "coinswap";
    // navigate to swap
    this.router.navigate(['home','swap']);
  }

  onSupport() {
    this.logger.debug("Support Clicked !!");
    this.active_menu_item = "support";
    // navigate to support
    this.router.navigate(['home','support']);
  }

  onSettingsSave(){
    // save the settings to localstorage
    this.localStorageService.set(AppConstants.KEY_WALLET_SETTINGS, this.walletSettings);
    // update the balance to reflect the last changes
    this.doBalanceUpdate();
    this.showSettingsDialog = false;
  }

  backupWallet() {
    this.logger.debug("### HOME Backup DB ###");
    let dbDump = this.walletService.getWalletDump();
    // create a filename
    let filename = this.datePipe.transform(Date.now(), "yyyy-MM-dd-HH-mm-ss") + "-brt-wallet.backup";
    let backupFilePath = path.join(this.backupPath, filename);
    // Write the JSON array to the file
    fs.writeFileSync(backupFilePath, dbDump);
    // signal electron we are done
    // this.electron.ipcRenderer.sendSync("backup-finished");
  }

  onShowSignMessage(){
    this.logger.debug("### HOME Sign Message ###");
    this.resetSigning();
    this.showSignMessageDialog = true;
  }

  onShowVerifyMessage(){
    this.logger.debug("### HOME Verify Message ###");
    this.resetVerification();
    this.showVerifyMessageDialog = true;
  }

  onShowEnableMultisign(){
    this.logger.debug("### HOME Enable Multisigning ###");
    this.resetEnableMutlisign();
    this.showEnableMultisignDialog = true;
  }

  onShowComposeTransaction(){
    this.logger.debug("### HOME Compose Transaction###");
    this.resetEnableMutlisign();
    this.showComposeTransactionDialog = true;
  }

  onShowSignTransaction(){
    this.logger.debug("### HOME Sign Transaction###");
    this.resetEnableMutlisign();
    this.showSignTransactionDialog = true;
  }

  signMessage(){
    this.logger.debug("### Sign With Account: " + this.selectedAccount);
    if(!this.walletService.checkWalletPasswordHash(this.walletPassword)){
      this.notificationService.addMessage({title: 'Message Signing', body: 'Invalid password. Message can not be signed'});
    } else {
      let key:LokiKey = this.walletService.getKey(this.selectedAccount);
      let secret = this.walletService.getDecryptSecret(this.walletPassword, key);
      this.logger.debug("### Secret: " + secret);
      let signResult = this.electron.remote.getGlobal("vars").brtKeypairs.signMessage(this.msgToSign, secret);
      this.logger.debug("### HOME Sign Result: " + JSON.stringify(signResult));
      this.signPubKey = signResult.public_key;
      this.signSignature = signResult.signature;
    }
  }

  resetSigning(){
    this.accountDropdown.resetFilter();
    this.selectedAccount = null;
    this.msgToSign = "";
    this.walletPassword = "";
    this.signPubKey = "";
    this.signSignature = "";
  }

  verifyMessage(){
    if(this.msgToVerify.length == 0 || this.verifyPubKey.length < 32 || this.verifySignature.length < 128){
      this.notificationService.addMessage({title: 'Message Verification', body: 'Invalid parameters for message signature verification.'});
      this.verificationFinished = false;
    } else {
      this.verificationResult = this.brtService.verifyMessage(this.msgToVerify, this.verifySignature, this.verifyPubKey);
      this.verificationFinished = true;
      this.logger.debug('### HOME Verify Result: ' + this.verificationResult);
    }
  }

  signAndSubmit(txData) {
    const key: LokiKey = this.walletService.getKey(this.ms_setting_account);
    const secret = this.walletService.getDecryptSecret(this.walletPassword, key);
    const signedTx = this.brtService.sign(JSON.stringify(txData), secret);
    if (typeof signedTx.signedTransaction === 'undefined') {
      return false;
    }
    this.brtService.submitTx(signedTx.signedTransaction)
  }

  /**
   * @todo: add some dialog with ledger response and updated account settings
   */
  enableMultisigning() {
    const multisigTX = this.getMultiSignTx();
    this.logger.debug("### HOME Multisig TX: " + JSON.stringify(multisigTX));
    this.signAndSubmit(multisigTX);
    if (this.disableMasterKey === true) {
      this.signAndSubmit(this.getDisableMasterkeyTx());
    }

    this.showEnableMultisignDialog = false;
  }

  getMultiSignTx() {
    return {
      Flags: 0,
      TransactionType: 'SignerListSet',
      Account: this.ms_setting_account,
      Sequence: this.ms_setting_sequence,
      Fee: this.brtService.serverStateSubject.getValue().validated_ledger.base_fee + '',
      SignerQuorum: this.ms_setting_quorum,
      SignerEntries: this.ms_setting_signers.filter(signer => {
        return signer.weight > 0 && brtAddressCodec.isValidClassicAddress(signer.signer)
      }).map(signer => {
        return {
          SignerEntry: {
            Account: signer.signer,
            SignerWeight: signer.weight
          }
        }
      })
    };
  }

  updateMultisignAccountDetails() {
    this.ms_setting_sequence =  this.walletService.getAccount(this.ms_setting_account).lastSequence;
    // update account settings
    this.brtService.getSettings(this.ms_setting_account);
    this.brtService.accountSettingsSubject.subscribe( settings => {
      this.logger.debug('### HOME updateMultisignAccountDetails: ' + JSON.stringify(settings));
      if (settings.hasOwnProperty('signerQuorum')) {
        this.ms_setting_quorum = settings.signerQuorum;
      } else {
        this.ms_setting_quorum = null;
      }
      if (settings.hasOwnProperty('signers')) {
        this.ms_setting_signers = [];
        settings.signers.forEach(item => {
          this.ms_setting_signers.push( { signer: item.accountID, weight: item.weight} );
        });
      } else {
        this.ms_setting_signers = [];
      }
      if (settings.hasOwnProperty('disableMasterKey')) {
        this.disableMasterKey = settings.disableMasterKey;
      } else {
        this.disableMasterKey = false;
      }
    });
  }

  resetVerification() {
    this.msgToVerify = '';
    this.verifyPubKey = '';
    this.verifySignature = '';
    this.verificationFinished = false;
    this.verificationResult = false;
  }

  resetEnableMutlisign() {
    this.ms_setting_signers = [];
    this.ms_setting_account = '';
    this.ms_setting_quorum = null;
    this.disableMasterKey = false;

  }

  addSigner(signer, weight) {
    if (brtAddressCodec.isValidClassicAddress(signer) === false) {
      this.electron.remote.dialog.showMessageBox(
        { message: "You entered an invalid AccountID, it can not be added as a signer.",
          buttons: ["OK"]
        });
      this.signer_account = '';
      this.signer_weight = null;
      return false;
    }


    if (signer === this.ms_setting_account) {
      this.electron.remote.dialog.showMessageBox(
        { message: "Signer AccountID can not be the same as the AccountID to enable Multisigning for.",
          buttons: ["OK"]
        });
      this.signer_account = '';
      this.signer_weight = null;
      return false;
    }

    for (let i = 0, _len = this.ms_setting_signers.length; i < _len; i++) {
      if (this.ms_setting_signers[i].signer === signer) {
        this.electron.remote.dialog.showMessageBox(
          { message: "Signer AccountID already exists in the signer list.",
            buttons: ["OK"]
          });
        this.signer_account = '';
        this.signer_weight = null;
        return false;
      }
    }

    if (weight === 0 || weight < 1 || weight > this.ms_setting_quorum) {
      this.electron.remote.dialog.showMessageBox(
        { message: "Signer Weight can not be less or equal to 0 or more than the total Quorum.",
          buttons: ["OK"]
        });
      this.signer_weight = null;
      return false;
    }

    // let totalWeight = weight;
    // for (let i = 0, _len = this.ms_setting_signers.length; i < _len; i++) {
    //   totalWeight += this.ms_setting_signers[i].weight;

    //   if (totalWeight > this.ms_setting_quorum) {
    //     this.electron.remote.dialog.showMessageBox(
    //       { message: "The sum of all Signer Weights can not be more than the total Quorum.",
    //         buttons: ["OK"]
    //       });
    //     this.signer_weight = null;
    //     return false;
    //   }
    // }

    this.ms_setting_signers.push({
      signer: signer,
      weight: weight
    });

    this.signer_account = '';
    this.signer_weight = null;
  }

  removeSigner(signer) {
    this.logger.debug('### HOME removeSigner: ' + JSON.stringify(signer));
    for (let i = 0, _len = this.ms_setting_signers.length; i < _len; i++) {
      if (this.ms_setting_signers[i].signer === signer.signer) {
        this.ms_setting_signers.splice(i, 1);
        break;
      }
    }
  }

  removeSignature(signature) {
    this.logger.debug('### HOME removeSignature: ' + JSON.stringify(signature));
    for (let i = 0, _len = this.signerSignedTxSignatures.length; i < _len; i++) {
      this.logger.debug('### HOME removeSignature loop['+i+']: ' + JSON.stringify(this.signerSignedTxSignatures[i]));
      if (this.signerSignedTxSignatures[i]['signature'] === signature['signature']) {
        this.logger.debug('### HOME - Remove Signature: ' + i);
        this.signerSignedTxSignatures.splice(i, 1);
        break;
      }
    }
  }

  multisignButtonDisabled() {
    let totalWeight = 0;
    for (let i = 0, _len = this.ms_setting_signers.length; i < _len; i++) {
      totalWeight += this.ms_setting_signers[i].weight;
    }
    if (this.ms_setting_quorum && totalWeight >= this.ms_setting_quorum) {
      return false;
    } else {
      return true;
    }
  }

  saveCopyValue(field) {
    this.logger.debug('### HOME saveCopyValue: ' + field);
    if (field === 'signPubKey') {
      this.copiedValue = this.signPubKey;
    } else if (field === 'signSignature') {
      this.copiedValue = this.signSignature;
    }
    this.copy_context_menu.popup({window: this.electron.remote.getCurrentWindow()});

  }

  getDisableMasterkeyTx() {
    return {
      TransactionType: 'AccountSet',
      SetFlag: 4,
      Account: this.ms_setting_account,
      Fee: this.brtService.serverStateSubject.getValue().validated_ledger.base_fee + '',
      Sequence: this.ms_setting_sequence + 1
      // Fee: 1000000 + ''
    };
  }

  copyValueToClipboard() {
    this.electron.clipboard.writeText(this.copiedValue);
  }

  addSignature() {
    if (this.baseMultiSignedTx.trim().length > 0) {
      this.signerSignedTxSignatures.push({signature: this.baseMultiSignedTx.trim()});
      this.baseMultiSignedTx = '';
    } else {
      this.baseMultiSignedTx = '';
    }
  }

  combineSignatures() {
    this.logger.debug('### HOME Multisign combine transaction signatures and submit to ledger ###');
    const signatureArray: Array<string> = [];
    this.signerSignedTxSignatures.forEach( item => {
      signatureArray.push(item['signature']);
    })
    const combinedTx = this.brtService.combine(signatureArray);
    this.brtService.submitTx(combinedTx.signedTransaction);
    this.signerSignedTxSignatures = [];
    this.baseMultiSignedTx = '';
    this.showComposeTransactionDialog = false;
  }

  getAccountSettingsForSignature(){
    const multisignTx = this.electron.remote.getGlobal('vars').brtBinaryCodec.decode(this.multisignTxSignatureToSign.trim().toUpperCase());
    this.brtService.getSettings(multisignTx.Account);
  }

  updateSignersSelection() {
    this.logger.debug('### HOME Multisign update select with avaialble signing accounts matching the signers list of the signature ###');
    const multisignTx = this.electron.remote.getGlobal('vars').brtBinaryCodec.decode(this.multisignTxSignatureToSign.trim().toUpperCase());

    const accountSettings = this.brtService.accountSettings.find(account => {
      return (account.accountID === multisignTx.Account)
    });

    if (accountSettings.hasOwnProperty('signers')) {
      this.accountsForSigning = this.accounts.filter((account) => {
        return accountSettings.signers.some((signerAccount) => {
          return account.value === signerAccount.accountID
        });
      });
    }

  }

  viewSignedMutlisignTranscation() {
    const key: LokiKey = this.walletService.getKey(this.selectedSignerAccount);
    const secret = this.walletService.getDecryptSecret(this.walletPassword, key);
    const multisignTx = this.electron.remote.getGlobal('vars').brtBinaryCodec.decode(this.multisignTxSignatureToSign.trim().toUpperCase());

    delete multisignTx.TxnSignature;
    delete multisignTx.SigningPubKey;

    const signedTx = this.brtService.sign(JSON.stringify(multisignTx), secret, {
      signAs: this.selectedSignerAccount
    });

    this.signedMultisignTxSignature = signedTx.signedTransaction;
    this.showTransactionSignature = true;
  }

  onSignerChange(event) {
    this.signer_account = this.signer_account.trim();
  }

  copySignatureToClipboard() {
    this.electron.clipboard.writeText(this.signedMultisignTxSignature);
  }
}
