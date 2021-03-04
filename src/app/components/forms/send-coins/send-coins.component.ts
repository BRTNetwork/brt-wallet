import {Component, OnInit, ViewChild} from '@angular/core';
import {Validators, FormControl, FormGroup, FormBuilder} from '@angular/forms';
import {LogService} from '../../../providers/log.service';
import {SelectItem, Dropdown, MenuItem, Message} from 'primeng/primeng';
import {MessageService} from 'primeng/components/common/messageservice';
import {brtService} from '../../../providers/brt.service';
import {WalletService} from '../../../providers/wallet.service';

import {ElectronService} from '../../../providers/electron.service';
import {ValidatorService} from '../../../providers/validator.service';
import {BRTUtil} from '../../../domain/brt-util';
import {AppConstants} from '../../../domain/app-constants';
import * as bigInt from 'big-integer';
import Big from 'big.js';
import {brtTxObject, PrepareTxPayment} from '../../../domain/brt-types';
import {BRTAmountPipe} from '../../../app-pipes.module';
import {LokiKey} from '../../../domain/lokijs';


@Component({
  selector: 'app-send-coins',
  templateUrl: './send-coins.component.html',
  styleUrls: ['./send-coins.component.scss']
})
export class SendCoinsComponent implements OnInit {

  @ViewChild('recipientInput') recipientInput;
  @ViewChild('descriptionInput') descriptionInput;
  @ViewChild('amountInput') amountInput;
  @ViewChild('accountDropdown') accountDropdown: Dropdown;
  @ViewChild('passwordInput') passwordInput;
  @ViewChild('feesInput') feesInput;

  accounts: SelectItem[] = [];
  addresses: SelectItem[] = [];
  selectedAccount: string;
  accountSettings: any;
  multiSignEnabled: boolean = false;
  signers: any;
  walletMasterKeyDisabled: boolean = false;
  showMultisignTxDialog: boolean = false;
  preparedPayment: string;
  multiSignTxSignature: string;
  signerSignature: string;
  signersSignatures: Array<string> = [];
  selectedAddress: string;
  recipient: string = '';
  txObject: brtTxObject;
  description: string = '';
  invoiceID: string;
  destinationTag: number;
  amount: string = '';
  payment: PrepareTxPayment;
  fees: string = '';
  minimalFee: string = '';
  accountReserve: string = '';
  totalSend: string = '';
  totalSendFormatted: string = '';
  walletPassword: string;
  showPasswordDialog: boolean = false;
  showPasswordDialogForMultisig: boolean = false;
  showAddressSearchDialog: boolean = false;
  signAndSubmitIcon: string = 'fa-check';
  amount_tooltip: string = 'Enter the amount to send only using numbers and a . (dot) indicating a decimal.';
  reserve_tooltip: string = 'The reserve is necessary to keep your account activated.';
  total_tooltip: string = 'Total amount necessary to sent ' + this.amount;
  includeReserve: boolean = false;
  invalidReceipient: boolean = true;
  isSendValid: boolean = true;
  isConnected: boolean = false;
  connected_tooltip: string = '';
  sendCoinsform: FormGroup;

  allowSendFromCurrentConnection: boolean = false;

  footer_visible: boolean = false;
  error_message: string = "";

  constructor(private logger:LogService, 
              private brtService: brtService,
              private walletService: WalletService,
              private messageService: MessageService,
              private electronService: ElectronService,
              private validators: ValidatorService,
              private brtAmountPipe: BRTAmountPipe,
              private fb: FormBuilder ) { }

  ngOnInit() {
    this.logger.debug("### SendCoin onInit ###")
    // get accounts from wallet once its open
    this.walletService.openWalletSubject.subscribe( result => {
      if(result == AppConstants.KEY_LOADED){
        this.walletService.getAllAccounts().forEach( element => {
          if(new Big(element.balance) > 0){
            let accountLabel = element.label + " - " + element.accountID.substring(0,10) + '...' + " [Balance: " + 
                                this.brtAmountPipe.transform(element.balance, false, true) + "]";
            this.accounts.push({label: accountLabel, value: element.accountID});
          }
        });
      }
    });
    // subscribe to connected messages
    this.brtService.brtConnectedSubject.subscribe(connected => {
      if(connected){
        this.isConnected = true;
        this.connected_tooltip = "";
      } else {
        this.isConnected = false;
        this.connected_tooltip = AppConstants.NOT_CONNECTED_ON_SEND_TEXT;
      }
    });
    // set the default fee and account reserve
    this.brtService.serverStateSubject.subscribe(serverState => {
      this.logger.debug("### SendCoins - serverState: " + JSON.stringify(serverState));
      if(serverState.server_state == 'full'){
        if(serverState.validated_ledger != null && serverState.validated_ledger.base_fee != null){
          this.allowSendFromCurrentConnection = true;
          this.fees = BRTUtil.dropsToCsc(serverState.validated_ledger.base_fee.toString());
          this.minimalFee = this.fees;
          this.accountReserve = BRTUtil.dropsToCsc(serverState.validated_ledger.reserve_base.toString());
        } else {
          this.allowSendFromCurrentConnection = false;
        }
      } else {
        this.allowSendFromCurrentConnection = false;
      }
    });

    // subscribe to account updates
    this.brtService.accountSubject.subscribe( account => {
      this.doBalanceUpdate();
    });

    this.brtService.accountSettingsSubject.subscribe(settings => {
      this.logger.debug("### SendCoins - New Account Settings: " + JSON.stringify(settings));
      this.loadSettings(settings);
    });

    this.sendCoinsform = this.fb.group({
        'recipient': new FormControl('', Validators.required),
        'description': new FormControl(''),
        'destinationTag': new FormControl('', this.validators.isValidDestinationTag),
        'amount': new FormControl('', Validators.required)
    });
    // this.brtService.ledgerSubject.subscribe( ledger => {
    //   this.logger.debug("### SendCoins - ledger: " + JSON.stringify(ledger));
    //   this.fees = BRTUtil.dropsToCsc(ledger.fee_base.toString());
    //   this.minimalFee = this.fees;
    //   this.logger.debug("### SendCoins - minimalFee: " + this.minimalFee);
    // });
    this.checkSendValid();
    this.populateAddresses();
  }

  populateAddresses(){
      this.walletService.getAllAddresses().forEach(element => {
          let addressLabel = element.label;
          this.addresses.push({label: addressLabel, value: element.accountID});
      });
  }

  doBalanceUpdate(){
    // add empty item to accounts dropdown
    this.accounts = [];
    this.accounts.push({label:'Select Account ...', value:null});
    this.walletService.getAllAccounts().forEach( element => {
      if(new Big(element.balance) > 0){
        let accountLabel = element.label + "(" + element.accountID.substring(0,8)+ "...) [Balance: " + BRTUtil.dropsToCsc(element.balance) + "]";
        this.accounts.push({label: accountLabel, value: element.accountID});
      }
    });
  }

  onAmountChange(event){
    this.logger.debug("### onAmountChange: " + JSON.stringify(event));
    // remove any other chars than numbers or a single dot (.)
    let amount = event.replace(new RegExp(",", 'g'), "");
    // check if a number
    if(!isNaN(amount)){
      //this.amount = amount;
      amount = amount.split(".");
      if(amount[1] && amount[1].length > 8){
        amount[1] = amount[1].substring(0, 8);
        amount[0] = amount[0] + "." + amount[1];
      }
      else if(amount.length > 1){
        amount[0] = amount[0] + "." + amount[1];
      }
      this.amount = amount[0];
      (document.getElementById("amount") as HTMLInputElement).value = this.amount;
    } else {
      this.amount = "0.00";
    }
    this.calculateTotal(this.includeReserve);
    this.checkSendValid();
  }

  onFeesChange(event){
    this.calculateTotal(this.includeReserve);
    this.checkSendValid();
  }

  onIncludeReserveChange(event){
    this.calculateTotal(this.includeReserve);
    this.checkSendValid();
  }

  onRecipientChange(event){
    this.recipient = this.recipient.trim();
    let valid: boolean = BRTUtil.validateAccountID(this.recipient);
    this.logger.debug("### SendCoins - recipient: " + this.recipient + " valid: " + valid);
    this.invalidReceipient = !valid;
    this.checkSendValid();
  }

  onDestinationTagChange(event){
    if((event <= 0) || (event % 1 != 0)){
      this.logger.debug(event + " is not an whole number");
      this.messageService.add({severity:'error', summary:'Destination Tag', detail:'The Destination Tag must be a positive whole number.'});
    }
  }

  focusDescription(){
    this.descriptionInput.nativeElement.focus();
  }

  focusAmount(){
    this.amountInput.nativeElement.focus();
  }

  focusFees(){
    this.feesInput.nativeElement.focus();
  }

  initPasswordCheck(){
    this.walletPassword = "";
    this.error_message = "";
    this.footer_visible = false;
  }

  doCancelSignAndSubmitTx(){
    this.checkSendValid();
    this.showPasswordDialog = false;
  }

  doSignAndSubmitTx(){
    this.signAndSubmitIcon = "fa-refresh fa-spin";
    // check the user password for the current wallet
    if(this.walletPassword.length == 0 ){
      this.error_message = "Please enter your password.";
      this.footer_visible = true;
      this.signAndSubmitIcon = "fa-check";
    } else if(!this.walletService.checkWalletPasswordHash(this.walletPassword)){
      this.error_message = "You entered an invalid password.";
      this.footer_visible = true;
      this.walletPassword = "";
      this.signAndSubmitIcon = "fa-check";
    } else {
      let preparePayment: PrepareTxPayment = 
          { source: this.selectedAccount, 
            destination: this.recipient, 
            amountDrops: BRTUtil.brtToDrops(this.amount),
            feeDrops: BRTUtil.brtToDrops(this.fees),
            description: this.description
          };
        if(this.destinationTag){
          preparePayment.destinationTag = bigInt(this.destinationTag);
        }
        if(this.invoiceID && this.invoiceID.length > 0){
          preparePayment.invoiceID = BRTUtil.encodeInvoiceID(this.invoiceID);
        }
        let txObject = this.brtService.createPaymentTx(preparePayment);
        this.logger.debug("### Sign: " + JSON.stringify(txObject));
        let txBlob:string = this.brtService.signTx(txObject, this.walletPassword);
        if(txBlob == AppConstants.KEY_ERRORED){
          // probably a wrong password!
          this.messageService.add({severity:'error', summary:'Transaction Signing', detail:'There was an error signing the transactions. Verify your password.'});
        } else {
          this.brtService.submitTx(txBlob);
          // reset form and dialog fields
          this.selectedAccount = "";
          this.selectedAddress = "";
          this.recipient = "";
          this.description = "";
          this.walletPassword = "";
          this.amount = "";
          this.accountDropdown.resetFilter();
          this.invoiceID = "";
          this.destinationTag = undefined;
          this.totalSend = "";
          this.totalSendFormatted = "";
          this.checkSendValid();
        }
        this.showPasswordDialog = false;
        this.signAndSubmitIcon = "fa-check";
      }
  }

  cancelSend(){
    this.showPasswordDialog = false;
    this.checkSendValid();
    this.signAndSubmitIcon = "fa-check";
  }

  doSendCoins(){
    this.logger.debug("### SendCoinsComponent - doSendCoins ###");
    this.initPasswordCheck();
    if(!this.allowSendFromCurrentConnection){
      this.electronService.remote.dialog.showMessageBox(
        { message: "The server you are connected to can not relay your transaction at this moment. Reconnect or close and re-open your wallet to retry.", 
          buttons: ["OK"] 
        });
    } else {
      this.showPasswordDialog = true;
      this.passwordInput.nativeElement.focus();
    }
  }

  startAddressSearch(){
      this.showAddressSearchDialog = true;
  }

  closeAddressSearchDialog(){
      this.showAddressSearchDialog = false;
  }

  cancelAddressSearch(){
      this.closeAddressSearchDialog();
  }

  useAddressForSend(){
      this.recipient = this.selectedAddress;
      this.closeAddressSearchDialog();
      this.onRecipientChange(this.recipient);
      this.focusDescription();
  }

  calculateTotal(includeReserve: boolean){
    this.logger.debug("### SendCoins - calculateTotal: " + this.amount + " fees: " + this.fees);
    if(this.amount != null){

      if(new Big(this.amount) > 0 && new Big(this.fees) > 0){
        let amountToSend = new Big(BRTUtil.brtToDrops(this.amount));
        let maxToSend = new Big(this.walletService.getAccountBalance(this.selectedAccount))
                          .minus(new Big(BRTUtil.brtToDrops(this.fees)));
        if(!includeReserve){
          maxToSend = maxToSend.minus(new Big(BRTUtil.brtToDrops(this.accountReserve)));
        }
        this.logger.debug("amountToSend: " + amountToSend + " maxToSend: " + maxToSend + " this.accountReserve: " + this.accountReserve);
        if(amountToSend.gt(maxToSend)){
          // we need to reduce the amount so we do not pass maxToSend
          if(maxToSend < 0){
            amountToSend = 0;
          } else {
            amountToSend = maxToSend;
          }
          this.amount = BRTUtil.dropsToCsc(amountToSend.toString());
          this.logger.debug("### Set amount to limited: " + this.amount);
        }
        // set total to send
        if(!includeReserve){
          this.totalSend = BRTUtil.dropsToCsc(
            amountToSend.plus(new Big(BRTUtil.brtToDrops(this.fees)))
          );
        } else {
          this.totalSend = BRTUtil.dropsToCsc(
            amountToSend.plus(new Big(BRTUtil.brtToDrops(this.fees)))
                        .plus(new Big(BRTUtil.brtToDrops(this.accountReserve)))
          );
        }
      } else {
        this.totalSend = "0.00";
      }
    } else {
      this.totalSend = "0.00"
    }
    // format total to send
    this.totalSendFormatted = this.brtAmountPipe.transform(BRTUtil.brtToDrops(this.totalSend), false, true);
  }

  checkSendValid(){
    if( BRTUtil.validateAccountID(this.recipient) && this.amount){
      if(this.recipient == this.selectedAccount){
        this.isSendValid = false;
      } else if (new Big(BRTUtil.brtToDrops(this.amount)) >= 1) {
         this.isSendValid = true;
      } else {
        this.isSendValid = false;
      }
    } else {
      this.isSendValid = false;
    }
  }

  loadSettings(settings){
    this.accountSettings = settings;
    this.walletMasterKeyDisabled = false;
    this.multiSignEnabled = false;
    if (settings.hasOwnProperty('disableMasterKey')) {
      this.walletMasterKeyDisabled = settings.disableMasterKey;
    }

    if (settings.hasOwnProperty('signers')) {
      this.multiSignEnabled = true;
      this.signers = settings.signers;
    }
  }

  getAccountInfo() {
    this.brtService.getSettings(this.selectedAccount);
  }

  sendAllCoins() {
    this.logger.debug('### Send All coins !!');
    if (!this.includeReserve) {
      this.amount = BRTUtil.dropsToCsc(
        new Big(this.walletService.getAccountBalance(this.selectedAccount))
          .minus(new Big(BRTUtil.brtToDrops(this.fees)))
          .minus(new Big(BRTUtil.brtToDrops(this.accountReserve)))
      );
    } else {
      this.amount = BRTUtil.dropsToCsc(
        new Big(this.walletService.getAccountBalance(this.selectedAccount))
          .minus(new Big(BRTUtil.brtToDrops(this.fees)))
      );
    }
    this.calculateTotal(this.includeReserve);
    this.checkSendValid();
  }


  showGenerateTxNow() {
    this.logger.debug('### Show the multisign tx genereration');
    const key: LokiKey = this.walletService.getKey(this.selectedAccount);
    const secret = this.walletService.getDecryptSecret(this.walletPassword, key);
    this.showPasswordDialogForMultisig = false;
    const signedTransaction = this.brtService.sign(JSON.stringify(this.txObject), secret);
    this.multiSignTxSignature = signedTransaction.signedTransaction;
    this.showMultisignTxDialog = true;
    return false;
  }

  showGenerateTx() {
    let fee = new Big(this.fees);
    if (this.accountSettings.signers.length > 0) {
       fee = (new Big(this.fees) * (this.accountSettings.signers.length + 1));
    }

    this.payment = {
          source: this.selectedAccount,
          destination: this.recipient,
          amountDrops: BRTUtil.brtToDrops(this.amount),
          feeDrops: BRTUtil.brtToDrops(fee.toString()),
          description: this.description,
          sequence: this.accountSettings.Sequence
        };
    if (this.destinationTag) {
      this.payment.destinationTag = bigInt(this.destinationTag);
    }
    if (this.invoiceID && this.invoiceID.length > 0) {
      this.payment.invoiceID = BRTUtil.encodeInvoiceID(this.invoiceID);
    }


    this.txObject = this.brtService.createPaymentTx(this.payment);
    this.logger.debug('### Sign: ' + JSON.stringify( this.txObject));
    this.initPasswordCheck();
    this.showPasswordDialogForMultisig = true;
    this.passwordInput.nativeElement.focus();

  }

  copyTxToClipboard(){
    this.electronService.clipboard.writeText(this.multiSignTxSignature);
  }
}
