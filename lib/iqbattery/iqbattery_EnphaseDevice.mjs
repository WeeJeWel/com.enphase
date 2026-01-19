import Homey from 'homey';
import EnphaseAPI from './iqbattery_EnphaseAPI.mjs';

export default class EnphaseDevice extends Homey.Device {

  static POLL_INTERVAL_CLOUD = 1000 * 60 * 5; // 5 minutes
  static POLL_INTERVAL_LOCAL = 1000 * 5; // 5 seconds

  async onInit() {
    this.api = new EnphaseAPI({
      username: this.getSettings().username,
      password: this.getSettings().password,
    });

    if (this.homey.platform === 'local' || this.homey.platform === 'cloud') {
      this.pollIntervalCloud = setInterval(() => this.pollCloud(), this.constructor.POLL_INTERVAL_CLOUD);
      this.pollCloud();
    }

    if (this.homey.platform === 'local') {
      this.pollIntervalLocal = setInterval(() => this.pollLocal(), this.constructor.POLL_INTERVAL_LOCAL);
      this.pollLocal();
    }
  }

  async onUninit() {
    if (this.pollIntervalCloud) {
      clearInterval(this.pollIntervalCloud);
    }

    if (this.pollIntervalLocal) {
      clearInterval(this.pollIntervalLocal);
    }
  }

  pollCloud() {
    this.onPollCloud()
      .then(() => {
        this.setAvailable().catch(err => this.error(`Error Setting Available: ${err.message}`));
      })
      .catch(err => {
        this.error(`Error Polling Cloud: ${err.message}`);
        this.setUnavailable(err).catch(err => this.error(`Error Setting Unavailable: ${err.message}`));
      });
  }

  async onPollCloud() {
    // Overload Me
  }

  pollLocal() {
    this.onPollLocal()
      .catch(err => {
        this.error(`Error Polling Local: ${err.message}`);
      });
  }

  async onPollLocal() {
    // Overload Me
  }

  async onSettings({ newSettings, changedKeys }) {
    if (changedKeys.includes('username') || changedKeys.includes('password')) {
      await this.api.login({
        username: newSettings.username,
        password: newSettings.password,
      });

      this.pollCloud();
    }
  }

};
