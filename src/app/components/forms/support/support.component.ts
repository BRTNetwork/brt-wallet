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
    this.electronService.remote.shell.openExternal("https://brt.network/#faq");
  }

  openReddit(){
    event.preventDefault();
    this.electronService.remote.shell.openExternal("https://www.reddit.com/r/BRTNetwork/");
  }

  openWebsite(){
    event.preventDefault();
    this.electronService.remote.shell.openExternal("https://brt.network");
  }

  openGithub(){
    event.preventDefault();
    this.electronService.remote.shell.openExternal("https://github.com/BRTNetwork/brt-wallet/issues");
  }

  openContactForm(){
    event.preventDefault();
    this.electronService.remote.shell.openExternal("https://brt.network/");
  }

  openEmail(){
    event.preventDefault();
    this.electronService.remote.shell.openExternal("mailto:support@brt.network");
  }

  openFacebook(){
    event.preventDefault();
    this.electronService.remote.shell.openExternal("https://www.facebook.com/brt.network/");
  }

  openTwitter(){
    event.preventDefault();
    this.electronService.remote.shell.openExternal("https://twitter.com/BRTNetwork");
  }
}
