import { Component, OnInit } from '@angular/core';
import { LogService } from '../../../providers/log.service';
import { AppConstants } from '../../../domain/app-constants';
import { ElectronService } from '../../../providers/electron.service';

@Component({
  selector: 'app-support',
  templateUrl: './support.component.html',
  styleUrls: ['./support.component.scss']
})
export class SupportComponent implements OnInit {

  constructor(private logger: LogService,
              private electronService: ElectronService) { 
          this.logger.debug("### INIT Support ###");
  }

  ngOnInit() {

  }

  openFAQ(){
    event.preventDefault();
    this.electronService.remote.shell.openExternal("https://brt.org/faq/");
  }

  openReddit(){
    event.preventDefault();
    this.electronService.remote.shell.openExternal("https://www.reddit.com/r/brt/");
  }

  openDiscord(){
    event.preventDefault();
    this.electronService.remote.shell.openExternal("http://brt.chat/");
  }

  openWebsite(){
    event.preventDefault();
    this.electronService.remote.shell.openExternal("https://brt.org");
  }

  openGithub(){
    event.preventDefault();
    this.electronService.remote.shell.openExternal("https://github.com/BRTNetwork/brt-wallet/issues");
  }

  openContactForm(){
    event.preventDefault();
    this.electronService.remote.shell.openExternal("https://brt.org/contact");
  }

  openEmail(){
    event.preventDefault();
    this.electronService.remote.shell.openExternal("mailto:support@brt.org");
  }

  openFacebook(){
    event.preventDefault();
    this.electronService.remote.shell.openExternal("https://www.facebook.com/brt/");
  }

  openTwitter(){
    event.preventDefault();
    this.electronService.remote.shell.openExternal("https://twitter.com/brt");
  }

  openBitcoinTalk() {
    event.preventDefault();
    this.electronService.remote.shell.openExternal("https://bitcointalk.org/index.php?topic=3262543.0");
  }
}
